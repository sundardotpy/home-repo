package app.homerepo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun count(n: Int, one: String, many: String) = "$n ${if (n == 1) one else many}"

/** Loads a screen's data whenever anything is written, keeping errors visible. */
@Composable
private fun <T> rememberLoad(vararg keys: Any?, load: () -> T): Triple<T?, String?, () -> Unit> {
    val ui = LocalUi.current
    var data by remember { mutableStateOf<T?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(ui.tick, *keys) {
        error = null
        try {
            data = withContext(Dispatchers.IO) { load() }
        } catch (e: CancellationException) {
            throw e // keys changed and a newer load took over
        } catch (e: Exception) {
            error = e.message ?: "Couldn't reach the database"
        }
    }
    return Triple(data, error) { ui.refresh() }
}

// ---------------------------------------------------------------- places

@Composable
fun PlacesScreen(onOpenRoom: (RoomRow) -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    val (rooms, error, retry) = rememberLoad { Db.rooms() }
    var newRoom by remember { mutableStateOf(false) }

    ScreenScaffold(
        title = "Places",
        fab = {
            ExtendedFloatingActionButton(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                onClick = { newRoom = true },
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("New room") },
            )
        },
    ) { pad ->
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 96.dp),
        ) {
            if (rooms == null && error == null) item { LinearProgressIndicator(Modifier.fillMaxWidth().padding(16.dp)) }
            error?.let { item { Notice("Couldn't load places", it) { FilledTonalButton(onClick = retry) { Text("Try again") } } } }
            if (rooms != null && rooms.isEmpty()) {
                item {
                    Notice("No rooms yet", "Start with the rooms in your home, then add the cupboards and boxes inside them.")
                }
            }
            items(rooms.orEmpty(), key = { it.id }) { r ->
                PlaceRow(
                    leading = { RoomSwatch(r.name, icon = r.icon) },
                    title = r.name,
                    sub = count(r.unitCount, "box", "boxes") + " · " + count(r.itemCount, "thing", "things"),
                ) { onOpenRoom(r) }
            }
        }
    }

    if (newRoom) {
        TextPromptDialog(
            title = "New room", placeholder = "Bedroom", confirmLabel = "Create",
            onDismiss = { newRoom = false },
        ) { name ->
            newRoom = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.createRoom(name) }
                    ui.done("Added $name")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't add the room") }
            }
        }
    }
}

/** A room or box in a list: its drawer front, name, counts, and a way in. */
@Composable
private fun PlaceRow(leading: @Composable () -> Unit, title: String, sub: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        leading()
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (sub.isNotEmpty()) {
                Text(sub, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.outline)
    }
}

@Composable
private fun BoxIcon() {
    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
        Icon(Icons.Outlined.Inventory2, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Rename and delete, tucked behind the top bar's overflow. */
@Composable
private fun PlaceMenu(onRename: () -> Unit, onDelete: () -> Unit, onMove: (() -> Unit)? = null, onIcon: (() -> Unit)? = null) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "More") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            if (onMove != null) DropdownMenuItem(text = { Text("Move") }, onClick = { open = false; onMove() })
            if (onIcon != null) DropdownMenuItem(text = { Text("Change icon") }, onClick = { open = false; onIcon() })
            DropdownMenuItem(text = { Text("Rename") }, onClick = { open = false; onRename() })
            DropdownMenuItem(
                text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                onClick = { open = false; onDelete() },
            )
        }
    }
}

// ------------------------------------------------------------------ room

@Composable
fun RoomScreen(room: RoomKey, onBack: () -> Unit, onOpenUnit: (UnitRow) -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(room.name) }
    var icon by remember { mutableStateOf(room.icon) }
    var pickingIcon by remember { mutableStateOf(false) }
    val (data, error, retry) = rememberLoad(room.id) {
        Db.units(room.id).filter { it.parentId == null } to Db.itemsInRoom(room.id, loose = true)
    }
    var detail by remember { mutableStateOf<ItemRow?>(null) }
    var newBox by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }

    ScreenScaffold(
        title = name,
        onBack = onBack,
        actions = { PlaceMenu(onRename = { renaming = true }, onDelete = { deleting = true }, onIcon = { pickingIcon = true }) },
        fab = {
            ExtendedFloatingActionButton(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                onClick = { newBox = true },
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("New box") },
            )
        },
    ) { pad ->
        val (units, loose) = data ?: (emptyList<UnitRow>() to emptyList())
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 96.dp),
        ) {
            item {
                Row(
                    Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    RoomSwatch(name, 48.dp, icon)
                    Text(
                        count(units.size, "box", "boxes") + " · " + count(loose.size, "thing", "things") + " loose",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (data == null && error == null) item { LinearProgressIndicator(Modifier.fillMaxWidth().padding(16.dp)) }
            error?.let { item { Notice("Couldn't load $name", it) { FilledTonalButton(onClick = retry) { Text("Try again") } } } }
            if (data != null && units.isEmpty() && loose.isEmpty()) {
                item { Notice("Nothing in $name yet", "Add a wardrobe, a shelf or a labelled box, or put things straight in the room.") }
            }
            if (units.isNotEmpty()) {
                item { SectionTitle("Boxes") }
                items(units, key = { it.id }) { u -> PlaceRow({ BoxIcon() }, u.name, "") { onOpenUnit(u) } }
            }
            if (loose.isNotEmpty()) {
                item { SectionTitle("Loose in $name") }
                items(loose, key = { it.id }) { ItemListRow(it, within = name) { detail = it } }
            }
        }
    }

    detail?.let { ItemSheet(it, onDismiss = { detail = null }) }
    if (pickingIcon) {
        IconPickerSheet("Icon for $name", icon, onDismiss = { pickingIcon = false }) { picked ->
            pickingIcon = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.setRoomIcon(room.id, picked) }
                    icon = picked
                    ui.done(if (picked.isEmpty()) "$name shows its initial again" else "Icon set for $name")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't change the icon") }
            }
        }
    }
    if (newBox) {
        TextPromptDialog(title = "New box in $name", placeholder = "Wardrobe", confirmLabel = "Create", onDismiss = { newBox = false }) { box ->
            newBox = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.createUnit(box, room.id, null) }
                    ui.done("Added $box to $name")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't add the box") }
            }
        }
    }
    if (renaming) {
        TextPromptDialog(title = "Rename room", initial = name, confirmLabel = "Rename", onDismiss = { renaming = false }) { new ->
            renaming = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.renameRoom(room.id, new) }
                    name = new
                    ui.done("Renamed to $new")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't rename") }
            }
        }
    }
    if (deleting) {
        ConfirmDialog(
            title = "Delete $name?",
            message = "Only an empty room can be deleted. Move or delete what's inside first.",
            onDismiss = { deleting = false },
        ) {
            deleting = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.deleteRoom(room.id, cascade = false) }
                    ui.done("Deleted $name")
                    onBack()
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't delete the room") }
            }
        }
    }
}

// ------------------------------------------------------------------- box

@Composable
fun UnitScreen(unit: UnitKey, onBack: () -> Unit, onOpenUnit: (UnitRow) -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(unit.name) }
    val (data, error, retry) = rememberLoad(unit.id) {
        Db.units(unit.roomId).filter { it.parentId == unit.id } to Db.itemsInUnit(unit.id)
    }
    var detail by remember { mutableStateOf<ItemRow?>(null) }
    var newBox by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var moving by remember { mutableStateOf(false) }

    ScreenScaffold(
        title = name,
        onBack = onBack,
        actions = { PlaceMenu(onRename = { renaming = true }, onDelete = { deleting = true }, onMove = { moving = true }) },
        fab = {
            ExtendedFloatingActionButton(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                onClick = { newBox = true },
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("Box inside") },
            )
        },
    ) { pad ->
        val (children, inside) = data ?: (emptyList<UnitRow>() to emptyList())
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 96.dp),
        ) {
            item { DrawerPath(unit.path, Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
            if (data == null && error == null) item { LinearProgressIndicator(Modifier.fillMaxWidth().padding(16.dp)) }
            error?.let { item { Notice("Couldn't load $name", it) { FilledTonalButton(onClick = retry) { Text("Try again") } } } }
            if (data != null && children.isEmpty() && inside.isEmpty()) {
                item { Notice("$name is empty", "Move things in from their sheet, or add a box inside it.") }
            }
            if (children.isNotEmpty()) {
                item { SectionTitle("Boxes inside") }
                items(children, key = { it.id }) { u -> PlaceRow({ BoxIcon() }, u.name, "") { onOpenUnit(u) } }
            }
            if (inside.isNotEmpty()) {
                item { SectionTitle("In $name") }
                items(inside, key = { it.id }) { ItemListRow(it, within = unit.path) { detail = it } }
            }
        }
    }

    detail?.let { ItemSheet(it, onDismiss = { detail = null }) }
    if (moving) MoveBoxSheet(unit, name, onDismiss = { moving = false }, onMoved = onBack)
    if (newBox) {
        TextPromptDialog(title = "New box inside $name", placeholder = "Top shelf", confirmLabel = "Create", onDismiss = { newBox = false }) { box ->
            newBox = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.createUnit(box, null, unit.id) }
                    ui.done("Added $box inside $name")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't add the box") }
            }
        }
    }
    if (renaming) {
        TextPromptDialog(title = "Rename box", initial = name, confirmLabel = "Rename", onDismiss = { renaming = false }) { new ->
            renaming = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.renameUnit(unit.id, new) }
                    name = new
                    ui.done("Renamed to $new")
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't rename") }
            }
        }
    }
    if (deleting) {
        ConfirmDialog(
            title = "Delete $name?",
            message = "Its boxes and things move up one level, so nothing loses its place.",
            onDismiss = { deleting = false },
        ) {
            deleting = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.deleteUnit(unit.id) }
                    ui.done("Deleted $name")
                    onBack()
                } catch (e: Exception) { ui.say(e.message ?: "Couldn't delete the box") }
            }
        }
    }
}

/** Where a box can go: a room, or inside another box. Everything in it goes too. */
@Composable
private fun MoveBoxSheet(unit: UnitKey, name: String, onDismiss: () -> Unit, onMoved: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var filter by remember { mutableStateOf("") }
    var spots by remember { mutableStateOf<Pair<List<RoomRow>, List<UnitRow>>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            spots = withContext(Dispatchers.IO) {
                // Cycle guard: never offer the box itself or a box inside it.
                val blocked = Db.unitAndNested(unit.id)
                Db.rooms() to Db.units().filter { it.id !in blocked }
            }
        } catch (e: Exception) { error = e.message }
    }

    fun go(where: String, roomId: String?, parentId: String?) {
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) { Db.moveUnit(unit.id, roomId, parentId) }
                // Undo puts it back exactly where it was.
                ui.done("Moved $name to $where") { Db.moveUnit(unit.id, unit.roomId, unit.parentId) }
                onDismiss()
                onMoved()
            } catch (e: Exception) {
                error = e.message
                busy = false
            }
        }
    }

    Sheet(onDismiss, scroll = false) {
        SheetTitle("Move $name")
        Text("Everything inside goes with it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        DrawerPath(unit.path)
        OutlinedTextField(
            filter, { filter = it },
            placeholder = { Text("Find a room or box") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        ErrorLine(error)
        if (spots == null || busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        val (rooms, boxes) = spots ?: (emptyList<RoomRow>() to emptyList())
        val q = filter.trim()
        fun hit(s: String) = q.isEmpty() || s.contains(q, ignoreCase = true)
        LazyColumn(Modifier.heightIn(max = 520.dp)) {
            val r = rooms.filter { hit(it.name) }
            if (r.isNotEmpty()) item { SectionTitle("Rooms") }
            items(r, key = { "r" + it.id }) { room ->
                MoveRow(room.name, "Straight in the room", { RoomSwatch(room.name, 36.dp, room.icon) }, !busy) { go(room.name, room.id, null) }
            }
            val b = boxes.filter { hit(it.pathString) }
            if (b.isNotEmpty()) item { SectionTitle("Inside another box") }
            items(b, key = { "u" + it.id }) { box ->
                MoveRow(box.name, pathParts(box.pathString).joinToString(" › "), { BoxGlyph() }, !busy) { go(box.name, null, box.id) }
            }
        }
    }
}
