// The database layer. The phone is an ordinary Postgres client: same tables,
// same views, same invariants as the server's store layer. There is no sync
// protocol and no conflict resolution — one database, two clients, last write
// wins.
//
// One connection is kept alive and reused for every operation (opening a
// JDBC connection is a 30–500ms round trip; doing that per query is what made
// early builds feel sluggish). It is health-checked before each use and
// reconnected when it goes stale. All operations serialize on a single lock —
// household scale has no contention, and it keeps transactions from
// interleaving on the shared connection.

package app.homerepo

import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.Properties

data class Profile(
    val host: String,
    val port: Int,
    val database: String,
    val user: String,
    val password: String,
    val ssl: Boolean,
) {
    fun url(): String =
        "jdbc:postgresql://$host:$port/$database?sslmode=${if (ssl) "require" else "disable"}"

    companion object {
        /** postgresql://user:password@host:port/db?sslmode=… → a profile; null when blank or malformed. */
        fun fromUrl(url: String): Profile? {
            if (url.isBlank()) return null
            return runCatching {
                val u = java.net.URI(url.trim().replaceFirst(Regex("^postgres(ql)?://"), "http://"))
                val (user, password) = (u.rawUserInfo ?: "").split(":", limit = 2).map {
                    java.net.URLDecoder.decode(it, "UTF-8")
                } + listOf("", "")
                val sslmode = u.rawQuery.orEmpty().split("&").firstOrNull { it.startsWith("sslmode=") }?.substringAfter("=")
                Profile(
                    host = u.host,
                    port = if (u.port > 0) u.port else 5432,
                    database = u.path.trimStart('/'),
                    user = user,
                    password = password,
                    ssl = sslmode != "disable",
                )
            }.getOrNull()
        }
    }
}

data class RoomRow(
    val id: String,
    val name: String,
    val unitCount: Int,
    val itemCount: Int,
    val icon: String = "",
)

data class UnitRow(
    val id: String,
    val name: String,
    val roomId: String,
    val parentId: String?,
    val pathString: String,
)

data class ItemRow(
    val id: String,
    val name: String,
    val icon: String,
    val quantity: Int,
    val status: String,
    val roomId: String,
    val unitId: String?,
    val path: String,
    val price: Double?,
    val purchasedOn: String?,
    val parentItemId: String? = null,
) {
    val active: Boolean get() = status == "active"
}

data class AddItem(
    val name: String,
    val roomId: String?,
    val unitId: String?,
    val parentItemId: String? = null,
    val quantity: Int = 1,
    val description: String = "",
    val tags: List<String> = emptyList(),
    val price: Double? = null,
    val purchasedOn: String? = null,
    val icon: String = "",
)

data class MoveRow(
    val itemId: String,
    val kind: String,
    val itemName: String,
    val fromPath: String,
    val toPath: String,
    val quantity: Int?,
    val movedAt: Long,
)

/** What a scanned code turned out to be — mirrors the web's /api/scan. */
sealed interface ScanResult {
    data class UnitHit(val unit: UnitRow, val contents: List<ItemRow>) : ScanResult
    data class ItemHit(val item: ItemRow) : ScanResult
    data class ItemsHit(val items: List<ItemRow>) : ScanResult
    data class NotFound(val code: String) : ScanResult
}

class DbException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * pgjdbc sends setString as varchar, and Postgres refuses to put that into a
 * uuid column. Types.OTHER makes the driver send the string as an untyped
 * parameter, which Postgres happily casts — the standard JDBC-uuid trick.
 */
private fun java.sql.PreparedStatement.setUuid(index: Int, value: String?) {
    if (value == null) setNull(index, java.sql.Types.OTHER)
    else setObject(index, value, java.sql.Types.OTHER)
}

object Db {
    @Volatile
    var profile: Profile? = null

    /** True when the database is built into this build of the app, not entered on the phone. */
    var builtIn = false

    private val lock = Any()
    private var conn: Connection? = null
    private var actorId: String? = null

    init {
        // Android's DriverManager does not scan service providers, so the
        // driver is registered by hand.
        try {
            Class.forName("org.postgresql.Driver")
        } catch (_: ClassNotFoundException) {
            throw DbException("Postgres driver missing from the build")
        }
    }

    private fun root(e: Throwable): String {
        var t: Throwable = e
        while (t.cause != null) t = t.cause!!
        return t.message ?: "operation failed"
    }

    /** A healthy connection, opening (or reopening) one when needed. */
    private fun connection(): Connection {
        conn?.let { c ->
            try {
                if (c.isValid(2)) return c
            } catch (_: SQLException) { }
            runCatching { c.close() }
            conn = null
        }
        val p = profile ?: throw DbException("Not connected")
        val props = Properties().apply {
            setProperty("user", p.user)
            setProperty("password", p.password)
            setProperty("loginTimeout", "8")
            setProperty("connectTimeout", "8")
            setProperty("socketTimeout", "30")
        }
        val c = try {
            DriverManager.getConnection(p.url(), props)
        } catch (e: Exception) {
            throw DbException(root(e), e)
        }
        conn = c
        return c
    }

    /**
     * Runs `block` against the shared connection. A connection-level failure
     * retires the connection and retries once, so a phone that changed
     * networks heals instead of erroring until restart.
     */
    private fun <T> db(block: (Connection) -> T): T = synchronized(lock) {
        try {
            block(connection())
        } catch (e: SQLException) {
            runCatching { conn?.close() }
            conn = null
            try {
                block(connection())
            } catch (e2: Exception) {
                throw if (e2 is DbException) e2 else DbException(root(e2), e2)
            }
        } catch (e: Exception) {
            throw if (e is DbException) e else DbException(root(e), e)
        }
    }

    /** A write transaction: all-or-nothing, on the shared connection. */
    private fun <T> tx(block: (Connection) -> T): T = db { c ->
        val wasAuto = c.autoCommit
        c.autoCommit = false
        try {
            val out = block(c)
            c.commit()
            out
        } catch (e: Exception) {
            runCatching { c.rollback() }
            throw e
        } finally {
            c.autoCommit = wasAuto
        }
    }

    /** The seeded household member, fetched once and cached. */
    private fun actor(c: Connection): String? {
        actorId?.let { return it }
        return try {
            c.prepareStatement("SELECT id FROM users WHERE is_default ORDER BY created_at LIMIT 1")
                .use { st ->
                    st.executeQuery().use { rs ->
                        if (rs.next()) rs.getString(1).also { actorId = it } else null
                    }
                }
        } catch (_: Exception) { null }
    }

    // --------------------------------------------------------------- reads

    /** House Shift runs on the web; while it is on, live edits bypass the copy being packed. */
    fun shiftOn(): Boolean = db { c ->
        c.prepareStatement("SELECT value FROM app_settings WHERE key = 'house_shift'").use { st ->
            st.executeQuery().use { rs -> rs.next() && rs.getString(1) == "on" }
        }
    }

    fun defaultUserId(): String = db { c ->
        actor(c) ?: throw DbException("no default user")
    }

    fun rooms(): List<RoomRow> = db { c ->
        c.prepareStatement(
            """SELECT r.id, r.name,
                 (SELECT count(*) FROM storage_units su WHERE su.room_id = r.id),
                 (SELECT count(*) FROM items i WHERE i.room_id = r.id AND i.status = 'active'),
                 r.icon
               FROM rooms r
               ORDER BY r.floor, r.sort_order, lower(r.name)"""
        ).use { st ->
            st.executeQuery().use { rs ->
                buildList {
                    while (rs.next()) add(
                        RoomRow(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getString(5) ?: "")
                    )
                }
            }
        }
    }

    fun units(roomId: String? = null): List<UnitRow> = db { c ->
        val sql = """
            SELECT su.id, su.name, su.room_id, su.parent_id,
                   array_to_string(ARRAY[r.name] || p.path, ' > ')
              FROM storage_units su
              JOIN rooms r ON r.id = su.room_id
              LEFT JOIN storage_unit_paths p ON p.id = su.id
              ${if (roomId != null) "WHERE su.room_id = ?" else ""}
             ORDER BY p.path"""
        c.prepareStatement(sql).use { st ->
            roomId?.let { st.setUuid(1, it) }
            st.executeQuery().use { rs ->
                buildList {
                    while (rs.next()) add(
                        UnitRow(
                            rs.getString(1), rs.getString(2), rs.getString(3),
                            rs.getString(4), rs.getString(5) ?: "",
                        )
                    )
                }
            }
        }
    }

    fun items(query: String, status: String = "active", limit: Int = 100): List<ItemRow> =
        db { c ->
            selectItems(
                c,
                "i.status = ?" + if (query.isNotBlank()) " AND i.name ILIKE ?" else "",
            ) { st ->
                var n = 1
                st.setString(n++, status)
                if (query.isNotBlank()) st.setString(n++, "%${query.trim()}%")
            }
        }

    fun itemsInRoom(roomId: String, loose: Boolean): List<ItemRow> =
        db { c ->
            selectItems(
                c,
                if (loose) "i.status = 'active' AND i.room_id = ? AND i.storage_unit_id IS NULL"
                else "i.status = 'active' AND i.room_id = ?",
            ) { st -> st.setUuid(1, roomId) }
        }

    fun itemsInUnit(unitId: String): List<ItemRow> =
        db { c -> selectItems(c, "i.status = 'active' AND i.storage_unit_id = ?") { st -> st.setUuid(1, unitId) } }

    private fun selectItems(
        c: Connection,
        where: String,
        bind: (java.sql.PreparedStatement) -> Unit = {},
    ): List<ItemRow> {
        val sql = """
            SELECT i.id, i.name, i.icon, i.quantity, i.status, i.room_id, i.storage_unit_id,
                   i.purchase_price::float8, to_char(i.purchased_on, 'YYYY-MM-DD'),
                   r.name, p.path, ip.path, i.parent_item_id
              FROM items i
              JOIN rooms r ON r.id = i.room_id
              LEFT JOIN storage_unit_paths p ON p.id = i.storage_unit_id
              LEFT JOIN item_paths ip ON ip.id = i.id
             WHERE $where
             ORDER BY i.created_at DESC, lower(i.name)
             LIMIT 200"""
        return c.prepareStatement(sql).use { st ->
            bind(st)
            st.executeQuery().use { rs ->
                buildList {
                    while (rs.next()) {
                        val unitPath: List<String> =
                            (rs.getArray(11)?.array as? Array<*>)?.map { it.toString() } ?: emptyList()
                        val itemPath: List<String> =
                            (rs.getArray(12)?.array as? Array<*>)?.map { it.toString() } ?: emptyList()
                        add(
                            ItemRow(
                                id = rs.getString(1),
                                name = rs.getString(2),
                                icon = rs.getString(3) ?: "",
                                quantity = rs.getInt(4),
                                status = rs.getString(5),
                                roomId = rs.getString(6),
                                unitId = rs.getString(7),
                                path = (listOf(rs.getString(10)) + unitPath + itemPath)
                                    .filter { it != null && it.isNotEmpty() }
                                    .joinToString(" > "),
                                price = rs.getObject(8)?.let { (it as Number).toDouble() },
                                purchasedOn = rs.getString(9),
                                parentItemId = rs.getString(13),
                            )
                        )
                    }
                }
            }
        }
    }

    /** One item with its full location, as the lists show it. */
    fun item(id: String): ItemRow = db { c -> locationOf(c, id) }

    private fun locationOf(c: Connection, id: String): ItemRow {
        val rows = selectItems(c, "i.id = ?") { st -> st.setUuid(1, id) }
        return rows.firstOrNull() ?: throw DbException("item not found")
    }

    // --------------------------------------------------------- item writes

    /** One placement rule, mirrored from the store: the container decides. */
    private fun resolvePlacement(
        c: Connection,
        roomId: String?,
        unitId: String?,
        parentId: String?,
    ): Pair<String, String?> {
        if (parentId != null) {
            c.prepareStatement("SELECT room_id, storage_unit_id FROM items WHERE id = ?").use { st ->
                st.setUuid(1, parentId)
                st.executeQuery().use { rs ->
                    if (!rs.next()) throw DbException("container item not found")
                    return Pair(rs.getString(1), rs.getString(2))
                }
            }
        }
        if (unitId != null) {
            c.prepareStatement("SELECT room_id FROM storage_units WHERE id = ?").use { st ->
                st.setUuid(1, unitId)
                st.executeQuery().use { rs ->
                    if (!rs.next()) throw DbException("storage unit not found")
                    return Pair(rs.getString(1), unitId)
                }
            }
        }
        return Pair(roomId ?: throw DbException("a location is required"), null)
    }

    fun addItem(input: AddItem): String = tx { c ->
        val (roomId, unitId) = resolvePlacement(c, input.roomId, input.unitId, input.parentItemId)
        val a = actor(c)

        var id = ""
        c.prepareStatement(
            """INSERT INTO items (name, description, quantity, tags, icon, room_id,
                   storage_unit_id, parent_item_id, purchase_price, purchased_on, created_by, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"""
        ).use { st ->
            st.setString(1, input.name)
            st.setString(2, input.description)
            st.setInt(3, input.quantity)
            st.setArray(4, c.createArrayOf("text", input.tags.toTypedArray()))
            st.setString(5, input.icon)
            st.setUuid(6, roomId)
            st.setUuid(7, unitId)
            st.setUuid(8, input.parentItemId)
            st.setObject(9, input.price)
            st.setObject(10, input.purchasedOn)
            st.setUuid(11, a)
            st.setUuid(12, a)
            st.executeQuery().use { rs -> rs.next(); id = rs.getString(1) }
        }

        recordMove(c, id, "added", null, roomId, unitId, a)
        id
    }

    /**
     * Editable item fields. Null means "leave alone"; use the clear markers
     * for price/date (empty string clears the date, negative price clears
     * the price).
     */
    fun updateItem(
        id: String,
        name: String? = null,
        quantity: Int? = null,
        price: Double? = null,
        clearPrice: Boolean = false,
        purchasedOn: String? = null,
        clearDate: Boolean = false,
        description: String? = null,
        icon: String? = null,
    ): Unit = tx { c ->
        c.prepareStatement(
            """UPDATE items SET
                   name        = COALESCE(?, name),
                   icon        = COALESCE(?, icon),
                   quantity    = COALESCE(?, quantity),
                   purchase_price = CASE WHEN ? THEN NULL ELSE COALESCE(?, purchase_price) END,
                   purchased_on   = CASE WHEN ? THEN NULL ELSE COALESCE(?::date, purchased_on) END,
                   description = COALESCE(?, description),
                   updated_at  = now()
                 WHERE id = ?"""
        ).use { st ->
            st.setString(1, name)
            st.setString(2, icon)
            st.setIntOrNull(3, quantity)
            st.setBoolean(4, clearPrice)
            if (!clearPrice) st.setObject(5, price) else st.setNull(5, java.sql.Types.DECIMAL)
            st.setBoolean(6, clearDate)
            if (!clearDate) st.setString(7, purchasedOn) else st.setNull(7, java.sql.Types.DATE)
            st.setString(8, description)
            st.setUuid(9, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
    }

    fun moveItem(id: String, roomId: String?, unitId: String?, parentItemId: String?): Unit = tx { c ->
        val inside = selfAndNested(c, id) - id
        if (parentItemId != null && (parentItemId == id || parentItemId in inside)) {
            throw DbException("would create a cycle — it can't go inside itself or its own contents")
        }
        val from = locationOf(c, id)
        // Where everything inside was, so each one that moves gets its own history row.
        val nestedBefore = inside.map { locationOf(c, it) }
        val (newRoom, newUnit) = resolvePlacement(c, roomId, unitId, parentItemId)
        c.prepareStatement(
            """UPDATE items
                  SET room_id = ?, storage_unit_id = ?, parent_item_id = ?, updated_at = now()
                WHERE id = ?"""
        ).use { st ->
            st.setUuid(1, newRoom)
            st.setUuid(2, newUnit)
            st.setUuid(3, parentItemId)
            st.setUuid(4, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
        retagSubtree(c, id, newRoom, newUnit)
        val a = actor(c)
        recordMove(c, id, "moved", from, newRoom, newUnit, a)
        nestedBefore.forEach { old ->
            if (locationOf(c, old.id).path != old.path) recordMove(c, old.id, "moved", old, newRoom, newUnit, a)
        }
    }

    fun declutterItem(id: String, note: String?): Unit = tx { c ->
        val from = locationOf(c, id)
        c.prepareStatement(
            """UPDATE items SET status = 'decluttered', decluttered_at = now(),
                      declutter_note = ?, updated_at = now() WHERE id = ?"""
        ).use { st ->
            st.setString(1, note)
            st.setUuid(2, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
        recordMove(c, id, "decluttered", from, from.roomId, from.unitId, actor(c))
    }

    fun restoreItem(id: String): Unit = db { c ->
        c.prepareStatement(
            """UPDATE items SET status = 'active', decluttered_at = NULL,
                      declutter_note = NULL, updated_at = now() WHERE id = ?"""
        ).use { st ->
            st.setUuid(1, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
    }

    fun addQuantity(id: String, delta: Int): Unit = tx { c ->
        c.prepareStatement("UPDATE items SET quantity = quantity + ? WHERE id = ?").use { st ->
            st.setInt(1, delta)
            st.setUuid(2, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
        // More of the thing arrived: an acquisition, logged like the web's quantity_delta.
        if (delta > 0) {
            val now = locationOf(c, id)
            recordMove(c, id, "added", null, now.roomId, now.unitId, actor(c), delta)
        }
    }

    /** Real delete: nested items are promoted one level, exactly as the server does. */
    fun deleteItem(id: String): Unit = tx { c ->
        c.prepareStatement(
            "UPDATE items SET parent_item_id = (SELECT parent_item_id FROM items WHERE id = ?) WHERE parent_item_id = ?"
        ).use { st ->
            st.setUuid(1, id)
            st.setUuid(2, id)
            st.executeUpdate()
        }
        c.prepareStatement("DELETE FROM items WHERE id = ?").use { st ->
            st.setUuid(1, id)
            if (st.executeUpdate() == 0) throw DbException("item not found")
        }
    }

    // --------------------------------------------------------- room writes

    fun createRoom(name: String, floor: Int = 0): RoomRow = tx { c ->
        c.prepareStatement(
            "SELECT 1 FROM rooms WHERE lower(name) = lower(?) AND floor = ?"
        ).use { st ->
            st.setString(1, name)
            st.setInt(2, floor)
            st.executeQuery().use { rs ->
                if (rs.next()) throw DbException("a room with that name already exists on that floor")
            }
        }
        val id: String
        c.prepareStatement(
            """INSERT INTO rooms (name, description, sort_order, floor, floor_name)
               VALUES (?, '', 0, ?, '') RETURNING id"""
        ).use { st ->
            st.setString(1, name)
            st.setInt(2, floor)
            st.executeQuery().use { rs -> rs.next(); id = rs.getString(1) }
        }
        RoomRow(id, name, 0, 0)
    }

    /** Picks a room's icon; "" goes back to its initial. */
    fun setRoomIcon(id: String, icon: String): Unit = db { c ->
        c.prepareStatement("UPDATE rooms SET icon = ?, updated_at = now() WHERE id = ?").use { st ->
            st.setString(1, icon)
            st.setUuid(2, id)
            if (st.executeUpdate() == 0) throw DbException("room not found")
        }
    }

    fun renameRoom(id: String, name: String): Unit = tx { c ->
        c.prepareStatement(
            """UPDATE rooms SET name = ?, updated_at = now()
                 WHERE id = ?
                   AND NOT EXISTS (SELECT 1 FROM rooms r2
                                    WHERE lower(r2.name) = lower(?) AND r2.floor = rooms.floor AND r2.id <> ?)"""
        ).use { st ->
            st.setString(1, name)
            st.setUuid(2, id)
            st.setString(3, name)
            st.setUuid(4, id)
            if (st.executeUpdate() == 0) {
                // Distinguish not-found from a duplicate name on the same floor.
                c.prepareStatement("SELECT 1 FROM rooms WHERE id = ?").use { q ->
                    q.setUuid(1, id)
                    q.executeQuery().use { rs ->
                        if (!rs.next()) throw DbException("room not found")
                    }
                }
                throw DbException("a room with that name already exists on that floor")
            }
        }
    }

    fun deleteRoom(id: String, cascade: Boolean): Unit = tx { c ->
        c.prepareStatement(
            """SELECT (SELECT count(*) FROM storage_units WHERE room_id = ?),
                      (SELECT count(*) FROM items WHERE room_id = ?)"""
        ).use { st ->
            st.setUuid(1, id)
            st.setUuid(2, id)
            st.executeQuery().use { rs ->
                rs.next()
                if (!cascade && (rs.getInt(1) > 0 || rs.getInt(2) > 0)) {
                    throw DbException("it still holds storage units or items; delete everything inside first")
                }
            }
        }
        if (cascade) {
            c.prepareStatement("DELETE FROM items WHERE room_id = ?").use { st ->
                st.setUuid(1, id); st.executeUpdate()
            }
            c.prepareStatement("DELETE FROM storage_units WHERE room_id = ? AND parent_id IS NULL").use { st ->
                st.setUuid(1, id); st.executeUpdate()
            }
        }
        c.prepareStatement("DELETE FROM rooms WHERE id = ?").use { st ->
            st.setUuid(1, id)
            if (st.executeUpdate() == 0) throw DbException("room not found")
        }
    }

    // --------------------------------------------------------- unit writes

    fun createUnit(name: String, roomId: String?, parentId: String?): UnitRow = tx { c ->
        val (room, parent) = if (parentId != null) {
            c.prepareStatement("SELECT room_id FROM storage_units WHERE id = ?").use { st ->
                st.setUuid(1, parentId)
                st.executeQuery().use { rs ->
                    if (!rs.next()) throw DbException("parent unit not found")
                    Pair(rs.getString(1), parentId)
                }
            }
        } else {
            Pair(roomId ?: throw DbException("a room or a parent unit is required"), null)
        }

        c.prepareStatement(
            """SELECT 1 FROM storage_units
                WHERE room_id = ?
                  AND COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
                    = COALESCE(?::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
                  AND lower(name) = lower(?)"""
        ).use { st ->
            st.setUuid(1, room)
            st.setUuid(2, parent)
            st.setString(3, name)
            st.executeQuery().use { rs ->
                if (rs.next()) throw DbException("there is already a storage unit with that name in the same place")
            }
        }

        val id: String
        c.prepareStatement(
            """INSERT INTO storage_units (room_id, parent_id, name, kind, description, qr_slug)
               VALUES (?, ?, ?, '', '', ?) RETURNING id"""
        ).use { st ->
            st.setUuid(1, room)
            st.setUuid(2, parent)
            st.setString(3, name)
            st.setString(4, newQrSlug())
            st.executeQuery().use { rs -> rs.next(); id = rs.getString(1) }
        }
        UnitRow(id, name, room, parent, name)
    }

    private const val SLUG_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    /**
     * A fresh label code, same alphabet and length as the server's (Crockford-ish:
     * no I/L/O/U, so a code read aloud or retyped cannot be misread).
     */
    private fun newQrSlug(): String {
        val rnd = java.security.SecureRandom()
        return buildString {
            repeat(10) { append(SLUG_ALPHABET[rnd.nextInt(SLUG_ALPHABET.length)]) }
        }
    }

    fun renameUnit(id: String, name: String): Unit = tx { c ->
        c.prepareStatement(
            """UPDATE storage_units su SET name = ?, updated_at = now()
                 WHERE id = ?
                   AND NOT EXISTS (SELECT 1 FROM storage_units s2
                                    WHERE s2.room_id = su.room_id
                                      AND COALESCE(s2.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
                                        = COALESCE(su.parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
                                      AND lower(s2.name) = lower(?) AND s2.id <> su.id)"""
        ).use { st ->
            st.setString(1, name)
            st.setUuid(2, id)
            st.setString(3, name)
            if (st.executeUpdate() == 0) {
                c.prepareStatement("SELECT 1 FROM storage_units WHERE id = ?").use { q ->
                    q.setUuid(1, id)
                    q.executeQuery().use { rs ->
                        if (!rs.next()) throw DbException("storage unit not found")
                    }
                }
                throw DbException("there is already a storage unit with that name in the same place")
            }
        }
    }

    /** Children and contents are promoted one level up, exactly as the server does. */
    /** A box and every box inside it — none of them can take it in (cycle guard). */
    fun unitAndNested(id: String): Set<String> = db { c ->
        c.prepareStatement("SELECT id FROM storage_unit_paths WHERE ? = ANY(id_path)").use { st ->
            st.setUuid(1, id)
            st.executeQuery().use { rs -> buildSet { add(id); while (rs.next()) add(rs.getString(1)) } }
        }
    }

    /**
     * Moves a box to a room (parentId null) or into another box. Every box and
     * thing inside follows it into the new room, as the server does.
     */
    fun moveUnit(id: String, roomId: String?, parentId: String?): Unit = tx { c ->
        if (parentId != null) {
            c.prepareStatement("SELECT ? = ANY(id_path) FROM storage_unit_paths WHERE id = ?").use { st ->
                st.setUuid(1, id)
                st.setUuid(2, parentId)
                st.executeQuery().use { rs ->
                    if (parentId == id || (rs.next() && rs.getBoolean(1))) {
                        throw DbException("a box can't go inside itself or a box within it")
                    }
                }
            }
        }
        val room = if (parentId != null) {
            c.prepareStatement("SELECT room_id FROM storage_units WHERE id = ?").use { st ->
                st.setUuid(1, parentId)
                st.executeQuery().use { rs -> if (rs.next()) rs.getString(1) else throw DbException("box not found") }
            }
        } else roomId ?: throw DbException("pick a room or a box")
        c.prepareStatement(
            """SELECT 1 FROM storage_units o, storage_units me
                WHERE me.id = ? AND o.id <> me.id AND o.room_id = ?
                  AND o.parent_id IS NOT DISTINCT FROM ?::uuid
                  AND lower(o.name) = lower(me.name)"""
        ).use { st ->
            st.setUuid(1, id)
            st.setUuid(2, room)
            st.setUuid(3, parentId)
            st.executeQuery().use { rs -> if (rs.next()) throw DbException("there's already a box with that name there") }
        }
        c.prepareStatement("UPDATE storage_units SET parent_id = ?, updated_at = now() WHERE id = ?").use { st ->
            st.setUuid(1, parentId)
            st.setUuid(2, id)
            if (st.executeUpdate() == 0) throw DbException("box not found")
        }
        val subtree = """WITH RECURSIVE sub AS (
                SELECT id FROM storage_units WHERE id = ?
                UNION ALL
                SELECT su.id FROM storage_units su JOIN sub ON su.parent_id = sub.id
            )"""
        for (table in listOf("items", "storage_units")) {
            val col = if (table == "items") "storage_unit_id" else "id"
            c.prepareStatement("$subtree UPDATE $table SET room_id = ?, updated_at = now() WHERE $col IN (SELECT id FROM sub)").use { st ->
                st.setUuid(1, id)
                st.setUuid(2, room)
                st.executeUpdate()
            }
        }
    }

    fun deleteUnit(id: String): Unit = tx { c ->
        c.prepareStatement("SELECT parent_id, room_id FROM storage_units WHERE id = ?").use { st ->
            st.setUuid(1, id)
            st.executeQuery().use { rs ->
                if (!rs.next()) throw DbException("storage unit not found")
                val parent = rs.getString(1)
                c.prepareStatement("UPDATE storage_units SET parent_id = ?, updated_at = now() WHERE parent_id = ?").use { u ->
                    u.setUuid(1, parent)
                    u.setUuid(2, id)
                    u.executeUpdate()
                }
                c.prepareStatement("UPDATE items SET storage_unit_id = ?, updated_at = now() WHERE storage_unit_id = ?").use { u ->
                    u.setUuid(1, parent)
                    u.setUuid(2, id)
                    u.executeUpdate()
                }
            }
        }
        c.prepareStatement("DELETE FROM storage_units WHERE id = ?").use { st ->
            st.setUuid(1, id)
            st.executeUpdate()
        }
    }

    // -------------------------------------------------------------- shared

    /** Everything nested inside follows the move — same rule as the server. */
    private fun retagSubtree(c: Connection, rootId: String, roomId: String, unitId: String?) {
        c.prepareStatement(
            """WITH RECURSIVE sub AS (
                   SELECT id FROM items WHERE id = ?
                   UNION ALL
                   SELECT ch.id FROM items ch JOIN sub ON ch.parent_item_id = sub.id
                 )
                 UPDATE items SET room_id = ?, storage_unit_id = ?, updated_at = now()
                  WHERE id IN (SELECT id FROM sub)"""
        ).use { st ->
            st.setUuid(1, rootId)
            st.setUuid(2, roomId)
            st.setUuid(3, unitId)
            st.executeUpdate()
        }
    }

    /** The item and everything nested below it — none of them can hold it (cycle guard). */
    fun selfAndNested(id: String): Set<String> = db { c -> selfAndNested(c, id) }

    private fun selfAndNested(c: Connection, id: String): Set<String> =
        c.prepareStatement("SELECT id FROM item_paths WHERE ? = ANY(id_path)").use { st ->
            st.setUuid(1, id)
            st.executeQuery().use { rs ->
                buildSet { add(id); while (rs.next()) add(rs.getString(1)) }
            }
        }

    private fun recordMove(
        c: Connection,
        itemId: String,
        kind: String,
        from: ItemRow?,
        toRoom: String,
        toUnit: String?,
        a: String?,
        quantity: Int? = null,
    ) {
        // The item's own location after the write: room, units and containers, like the web.
        val toPath = locationOf(c, itemId).path.split(" > ")

        c.prepareStatement(
            """INSERT INTO item_moves (item_id, kind, from_room_id, from_unit_id, to_room_id,
                       to_unit_id, from_path, to_path, moved_by, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        ).use { st ->
            st.setUuid(1, itemId)
            st.setString(2, kind)
            st.setUuid(3, from?.roomId)
            st.setUuid(4, from?.unitId)
            st.setUuid(5, toRoom)
            st.setUuid(6, toUnit)
            st.setArray(7, c.createArrayOf("text", (from?.path?.split(" > ") ?: emptyList()).toTypedArray()))
            st.setArray(8, c.createArrayOf("text", toPath.toTypedArray()))
            st.setUuid(9, a)
            st.setIntOrNull(10, quantity)
            st.executeUpdate()
        }
    }

    /** The "last put away" feed — the same rows the web home shows. */
    fun recentMoves(limit: Int = 20): List<MoveRow> = db { c ->
        c.prepareStatement(
            """SELECT m.kind, i.name,
                      COALESCE(array_to_string(m.from_path, ' > '), ''),
                      array_to_string(m.to_path, ' > '),
                      m.quantity,
                      EXTRACT(EPOCH FROM m.moved_at)::bigint * 1000,
                      m.item_id
                 FROM item_moves m
                 JOIN items i ON i.id = m.item_id
                ORDER BY m.moved_at DESC
                LIMIT ?"""
        ).use { st ->
            st.setInt(1, limit)
            st.executeQuery().use { rs ->
                buildList {
                    while (rs.next()) add(
                        MoveRow(
                            itemId = rs.getString(7),
                            kind = rs.getString(1),
                            itemName = rs.getString(2),
                            fromPath = rs.getString(3) ?: "",
                            toPath = rs.getString(4) ?: "",
                            quantity = rs.getObject(5)?.let { (it as Number).toInt() },
                            movedAt = rs.getLong(6),
                        )
                    )
                }
            }
        }
    }

    /**
     * Resolves a scanned QR label or product barcode, the way /api/scan does:
     * a label URL or bare slug finds a storage unit, a barcode finds its item
     * (several of the same product arrive as a list). Spaces and hyphens in
     * barcodes never matter.
     */
    fun resolveCode(raw: String): ScanResult = db { c ->
        var code = raw.trim()
        Regex(".*/q/([A-Za-z0-9]+).*").find(code)?.let { code = it.groupValues[1] }
        code = code.replace(" ", "").replace("-", "")
        if (code.isEmpty()) return@db ScanResult.NotFound(raw)

        c.prepareStatement(
            """SELECT su.id, su.name, su.room_id, su.parent_id,
                      array_to_string(ARRAY[r.name] || p.path, ' > ')
                 FROM storage_units su
                 JOIN rooms r ON r.id = su.room_id
                 LEFT JOIN storage_unit_paths p ON p.id = su.id
                WHERE lower(su.qr_slug) = lower(?)"""
        ).use { st ->
            st.setString(1, code)
            st.executeQuery().use { rs ->
                if (rs.next()) {
                    val unit = UnitRow(
                        rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5) ?: "",
                    )
                    val contents = selectItems(c, "i.storage_unit_id = ? AND i.status = 'active'") { s ->
                        s.setUuid(1, unit.id)
                    }
                    return@db ScanResult.UnitHit(unit, contents)
                }
            }
        }

        val hits = selectItems(
            c,
            "i.status = 'active' AND replace(replace(i.barcode, ' ', ''), '-', '') = ?",
        ) { st -> st.setString(1, code) }
        when (hits.size) {
            0 -> ScanResult.NotFound(code)
            1 -> ScanResult.ItemHit(hits.first())
            else -> ScanResult.ItemsHit(hits)
        }
    }
}

private fun java.sql.PreparedStatement.setIntOrNull(index: Int, value: Int?) {
    if (value == null) setNull(index, java.sql.Types.INTEGER) else setInt(index, value)
}
