package app.homerepo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Notes
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CurrencyRupee
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Numbers
import androidx.compose.material.icons.outlined.Outbox
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Restore
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Every sheet's frame: full-height-capable, scrolls, clears the nav bar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Sheet(onDismiss: () -> Unit, scroll: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            Modifier
                .then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier)
                .padding(horizontal = 20.dp)
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun SheetTitle(text: String) = Text(text, style = MaterialTheme.typography.headlineSmall)

@Composable
fun ErrorLine(error: String?) {
    error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
}

// ------------------------------------------------------------------ item

private enum class ItemMode { Main, Move, Declutter, Edit, Tags }

/**
 * One thing owns the sheet. Top: where it is (tap to move) and an overflow.
 * Then a title card, one white row per property (place, quantity, price,
 * tags, custom fields, notes), and a row of pill actions.
 */
@Composable
fun ItemSheet(item: ItemRow, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(ItemMode.Main) }
    var confirmDelete by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var details by remember { mutableStateOf<ItemDetails?>(null) }
    val parts = pathParts(item.path)
    val room = parts.firstOrNull().orEmpty()

    LaunchedEffect(item.id, ui.tick) {
        details = runCatching { withContext(Dispatchers.IO) { Db.itemDetails(item.id) } }.getOrNull()
    }

    fun act(work: () -> Unit, after: () -> Unit) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) { work() }
                after()
                onDismiss()
            } catch (e: Exception) { error = e.message }
        }
    }

    when (mode) {
        ItemMode.Move -> MoveSheet(item, onDismiss = onDismiss)
        ItemMode.Declutter -> DeclutterSheet(item, onDismiss = onDismiss)
        ItemMode.Edit -> EditItemSheet(item, onDismiss = onDismiss)
        ItemMode.Tags -> TagsSheet(item, details?.tags.orEmpty(), onDismiss = { mode = ItemMode.Main })
        ItemMode.Main -> Sheet(onDismiss) {
            // Where it is, as a breadcrumb that opens the move picker.
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .clickable(enabled = item.active) { mode = ItemMode.Move }
                        .padding(vertical = 8.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    RoomSwatch(room, 22.dp)
                    Text(
                        parts.joinToString(" › "),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (item.active) Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = "Move", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
                OverflowMenu(header = details?.added?.takeIf { it.isNotEmpty() }?.let { "Added on $it" }) { close ->
                    MenuRow(Icons.Outlined.Edit, "Edit details") { close(); mode = ItemMode.Edit }
                    MenuRow(Icons.Outlined.Sell, "Tags") { close(); mode = ItemMode.Tags }
                    if (item.active) MenuRow(Icons.Outlined.Outbox, "Declutter") { close(); mode = ItemMode.Declutter }
                    HorizontalDivider(Modifier.padding(vertical = 4.dp), color = MaterialTheme.colorScheme.outlineVariant)
                    MenuRow(Icons.Outlined.Delete, "Delete", danger = true) { close(); confirmDelete = true }
                }
            }

            // The title card.
            Row(
                Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium).background(MaterialTheme.colorScheme.surfaceContainerLowest).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ItemAvatar(item.icon, item.name, room, 48.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(item.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Medium)
                    if (!item.active) StatusLabel("Decluttered")
                }
            }

            // One row per property; empty ones invite you to fill them in.
            val d = details
            val rows = buildList<PropertyRow> {
                add(PropertyRow(Icons.Outlined.Place, onClick = { mode = ItemMode.Move }.takeIf { item.active }) { DrawerPath(item.path) })
                add(PropertyRow(Icons.Outlined.Numbers, onClick = { mode = ItemMode.Edit }) {
                    Text(if (item.quantity == 1) "1 of it" else "${item.quantity} of them", style = MaterialTheme.typography.bodyLarge)
                })
                add(PropertyRow(Icons.Outlined.CurrencyRupee, onClick = { mode = ItemMode.Edit }) {
                    if (item.price != null) {
                        Text("₹${"%,.0f".format(item.price)}" + (item.purchasedOn?.let { " · bought $it" } ?: ""), style = MaterialTheme.typography.bodyLarge)
                    } else Placeholder("Price")
                })
                add(PropertyRow(Icons.Outlined.Sell, onClick = { mode = ItemMode.Tags }) {
                    if (d?.tags.isNullOrEmpty()) Placeholder("Tags")
                    else FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        d!!.tags.forEach { TagChip(it) }
                    }
                })
                d?.properties?.forEach { (k, v) ->
                    add(PropertyRow(Icons.Outlined.Info, onClick = { mode = ItemMode.Edit }) {
                        Column {
                            Text(k, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(v, style = MaterialTheme.typography.bodyLarge)
                        }
                    })
                }
                if (!d?.description.isNullOrBlank()) {
                    add(PropertyRow(Icons.AutoMirrored.Outlined.Notes, onClick = { mode = ItemMode.Edit }) {
                        Text(d!!.description, style = MaterialTheme.typography.bodyLarge)
                    })
                }
            }
            Column {
                rows.forEachIndexed { i, r ->
                    Row(
                        Modifier
                            .segment(i, rows.size, inset = 0.dp)
                            .then(if (r.onClick != null) Modifier.clickable(onClick = r.onClick) else Modifier)
                            .fillMaxWidth()
                            .heightIn(min = 56.dp)
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Icon(r.icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Box(Modifier.weight(1f)) { r.content() }
                    }
                }
            }
            ErrorLine(error)

            // What you can do, as pills; the main one (Move) in the accent.
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (item.active) {
                    ActionPill(Icons.Outlined.SwapHoriz, "Move", accent = true) { mode = ItemMode.Move }
                    ActionPill(Icons.Outlined.Add, "+1") { act({ Db.addQuantity(item.id, 1) }) { ui.done("${item.name}: now ${item.quantity + 1}") } }
                    ActionPill(Icons.Outlined.Outbox, "Declutter") { mode = ItemMode.Declutter }
                } else {
                    ActionPill(Icons.Outlined.Restore, "Restore", accent = true) {
                        act({ Db.restoreItem(item.id) }) { ui.done("${item.name} is back") }
                    }
                }
                ActionPill(Icons.Outlined.Edit, "Edit") { mode = ItemMode.Edit }
            }
        }
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Delete ${item.name}?",
            message = "It's gone for good, history and all. Declutter it instead to keep the record. Anything inside moves up one level.",
            onDismiss = { confirmDelete = false },
        ) {
            confirmDelete = false
            act({ Db.deleteItem(item.id) }) { ui.done("Deleted ${item.name}") }
        }
    }
}

private class PropertyRow(val icon: ImageVector, val onClick: (() -> Unit)? = null, val content: @Composable () -> Unit)

@Composable
private fun Placeholder(text: String) = Text(text, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)

@Composable
fun TagChip(text: String) {
    Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
        Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
    }
}

/** A tonal pill: icon and label. The screen's main action takes the accent fill. */
@Composable
private fun ActionPill(icon: ImageVector, label: String, accent: Boolean = false, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (accent) colors.primaryContainer else colors.surfaceContainer,
        contentColor = if (accent) colors.onPrimaryContainer else colors.onSurface,
    ) {
        Row(
            Modifier.heightIn(min = 44.dp).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Text(label, style = MaterialTheme.typography.labelLarge)
        }
    }
}

/**
 * The ⋮ menu: a white card with icon rows, an optional muted header (such as
 * when the thing was added), and dividers between groups.
 */
@Composable
fun OverflowMenu(header: String? = null, content: @Composable ColumnScope.(close: () -> Unit) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "More") }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            shape = RoundedCornerShape(16.dp),
            containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
        ) {
            if (header != null) {
                Text(
                    header, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
            content { open = false }
        }
    }
}

@Composable
fun MenuRow(icon: ImageVector, label: String, danger: Boolean = false, onClick: () -> Unit) {
    val tint = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    DropdownMenuItem(
        text = { Text(label, color = tint) },
        leadingIcon = { Icon(icon, contentDescription = null, tint = if (danger) tint else MaterialTheme.colorScheme.onSurfaceVariant) },
        onClick = onClick,
    )
}

// ------------------------------------------------------------------ tags

/**
 * Pick an item's tags: the chosen ones as chips in a tray at the top, then
 * every tag with a checkbox, and Cancel / Save at the foot. Typing a name that
 * doesn't exist offers to create it.
 */
@Composable
fun TagsSheet(item: ItemRow, current: List<String>, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var chosen by remember { mutableStateOf(current) }
    var all by remember { mutableStateOf<List<String>?>(null) }
    var query by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        all = runCatching { withContext(Dispatchers.IO) { Db.allTags() } }.onFailure { error = it.message }.getOrNull()
    }
    fun toggle(t: String) { chosen = if (t in chosen) chosen - t else chosen + t }

    Sheet(onDismiss = { if (!busy) onDismiss() }, scroll = false) {
        SheetTitle("Tags")
        // The tray: what this thing is tagged with right now.
        FlowRow(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).clip(RoundedCornerShape(28.dp))
                .background(MaterialTheme.colorScheme.surfaceContainer).padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (chosen.isEmpty()) Placeholder("No tags yet")
            chosen.forEach { t ->
                Surface(onClick = { toggle(t) }, shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.surfaceContainerHighest) {
                    Row(Modifier.padding(start = 10.dp, end = 6.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(t, style = MaterialTheme.typography.labelLarge)
                        Icon(Icons.Outlined.Close, contentDescription = "Remove $t", modifier = Modifier.padding(start = 4.dp).size(16.dp))
                    }
                }
            }
        }
        SearchWell(query, { query = it }, "Find or make a tag")
        ErrorLine(error)
        val q = query.trim().lowercase()
        val shown = all.orEmpty().filter { q.isEmpty() || it.contains(q) }
        val fresh = q.isNotEmpty() && all != null && q !in all.orEmpty() && q !in chosen
        LazyColumn(Modifier.weight(1f, fill = false).heightIn(max = 420.dp)) {
            if (fresh) item {
                Row(
                    Modifier.segment(0, 1, inset = 0.dp).clickable { toggle(q); query = "" }.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text("Create “$q”", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyLarge)
                }
                Spacer(Modifier.height(8.dp))
            }
            segments(shown, key = { it }, inset = 0.dp) { t, m ->
                Row(
                    m.clickable { toggle(t) }.fillMaxWidth().heightIn(min = 52.dp).padding(start = 16.dp, end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Icon(Icons.Outlined.Sell, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                    Text(t, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Checkbox(checked = t in chosen, onCheckedChange = { toggle(t) })
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) {
            FilledTonalButton(
                onClick = onDismiss, enabled = !busy, modifier = Modifier.height(48.dp),
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = MaterialTheme.colorScheme.surfaceContainer, contentColor = MaterialTheme.colorScheme.onSurface),
            ) { Text("Cancel") }
            Button(
                colors = confirmColors(),
                enabled = !busy,
                modifier = Modifier.height(48.dp),
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { Db.setTags(item.id, chosen) }
                            ui.done(if (chosen.isEmpty()) "Removed the tags from ${item.name}" else "Tagged ${item.name}")
                            onDismiss()
                        } catch (e: Exception) {
                            error = e.message
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save") }
        }
    }
}

// ------------------------------------------------------------------ move

private data class Spot(val label: String, val path: String, val room: String?, val apply: () -> Unit)

/** Anywhere it can go: a room, a box, or inside another thing. */
@Composable
fun MoveSheet(item: ItemRow, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var filter by remember { mutableStateOf("") }
    var spots by remember { mutableStateOf<Triple<List<RoomRow>, List<UnitRow>, List<ItemRow>>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            spots = withContext(Dispatchers.IO) {
                // Cycle guard: never offer the item itself or anything inside it.
                val blocked = Db.selfAndNested(item.id)
                Triple(Db.rooms(), Db.units(), Db.items("").filter { it.id !in blocked })
            }
        } catch (e: Exception) { error = e.message }
    }

    fun go(where: String, work: () -> Unit) {
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) { work() }
                // Undo puts it back exactly where it was: room, box and container.
                ui.done("Moved ${item.name} to $where") { Db.moveItem(item.id, item.roomId, item.unitId, item.parentItemId) }
                onDismiss()
            } catch (e: Exception) {
                error = e.message
                busy = false
            }
        }
    }

    Sheet(onDismiss, scroll = false) {
        SheetTitle("Move ${item.name}")
        SearchWell(filter, { filter = it }, "Find a room, box or thing")
        ErrorLine(error)
        if (spots == null || busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        val (rooms, units, things) = spots ?: Triple(emptyList(), emptyList(), emptyList())
        val q = filter.trim()
        fun hit(s: String) = q.isEmpty() || s.contains(q, ignoreCase = true)
        val loose = item.unitId == null && item.parentItemId == null
        // Rooms with their boxes nested under them, one stack; each box indented by depth.
        val places = buildList<@Composable (Modifier) -> Unit> {
            rooms.forEach { room ->
                val inRoom = units.filter { it.roomId == room.id }.sortedBy { it.pathString.lowercase() }
                if (hit(room.name)) {
                    val here = loose && item.roomId == room.id
                    add { m ->
                        MoveRow(room.name, if (here) "Here now" else "Loose in the room", { RoomSwatch(room.name, 36.dp, room.icon) }, !busy && !here, m, here = here) {
                            go(room.name) { Db.moveItem(item.id, room.id, null, null) }
                        }
                    }
                }
                inRoom.filter { hit(it.pathString) }.forEach { unit ->
                    val here = item.parentItemId == null && item.unitId == unit.id
                    val depth = (pathParts(unit.pathString).size - 1).coerceAtLeast(1)
                    add { m ->
                        MoveRow(unit.name, if (here) "Here now" else "", { BoxGlyph() }, !busy && !here, m, depth = depth, here = here) {
                            go(unit.name) { Db.moveItem(item.id, null, unit.id, null) }
                        }
                    }
                }
            }
        }
        val t = things.filter { hit(it.name) }
        LazyColumn(Modifier.heightIn(max = 520.dp)) {
            items(places.size) { i -> places[i](Modifier.segment(i, places.size, inset = 0.dp)) }
            if (t.isNotEmpty()) {
                item { SectionTitle("Inside another thing") }
                segments(t, key = { "i" + it.id }, inset = 0.dp) { thing, m ->
                    val here = item.parentItemId == thing.id
                    MoveRow(thing.name, if (here) "Here now" else pathParts(thing.path).joinToString(" › "),
                        { ItemAvatar(thing.icon, thing.name, pathParts(thing.path).firstOrNull().orEmpty(), 36.dp) }, !busy && !here, m, here = here) {
                        go(thing.name) { Db.moveItem(item.id, null, null, thing.id) }
                    }
                }
            }
        }
    }
}

/** The search field in a picker: a filled 28dp well, no outline. */
@Composable
fun SearchWell(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    val well = MaterialTheme.colorScheme.surfaceContainer
    OutlinedTextField(
        value, onValueChange,
        placeholder = { Text(placeholder) },
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
        singleLine = true,
        shape = RoundedCornerShape(28.dp),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedContainerColor = well, unfocusedContainerColor = well,
            unfocusedBorderColor = androidx.compose.ui.graphics.Color.Transparent,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun BoxGlyph() = Icon(Icons.Outlined.Inventory2, contentDescription = null, modifier = Modifier.size(36.dp).padding(6.dp))

/**
 * A place you can send something. In a picker it sits in a segmented stack
 * (`modifier`), indented by `depth`; where the thing is now is shaded and
 * can't be picked.
 */
@Composable
fun MoveRow(
    title: String,
    sub: String,
    leading: @Composable () -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    depth: Int = 0,
    here: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .then(if (here) Modifier.background(MaterialTheme.colorScheme.surfaceContainerHighest) else Modifier)
            .clickable(enabled = enabled, onClick = onClick)
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .padding(start = 16.dp + 20.dp * minOf(depth, 3), end = 16.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        leading()
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (sub.isNotEmpty()) Text(sub, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

// -------------------------------------------------------------- declutter

@Composable
fun DeclutterSheet(item: ItemRow, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Sheet(onDismiss = { if (!busy) onDismiss() }) {
        SheetTitle("Declutter ${item.name}?")
        Text(
            "It leaves the house but stays in the record, with its history. Anything inside it goes too. You can restore it any time.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(note, { note = it }, label = { Text("Note (optional): sold, given away…") },
            modifier = Modifier.fillMaxWidth(), singleLine = true)
        ErrorLine(error)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.weight(1f).height(52.dp)) { Text("Keep it") }
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            val gone = withContext(Dispatchers.IO) { Db.declutterItem(item.id, note.trim().ifBlank { null }) }
                            val inside = gone.size - 1
                            ui.done(
                                if (inside > 0) "Decluttered ${item.name} and $inside inside it" else "Decluttered ${item.name}"
                            ) { Db.restoreItems(gone) }
                            onDismiss()
                        } catch (e: Exception) {
                            error = e.message
                            busy = false
                        }
                    }
                },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
                modifier = Modifier.weight(1f).height(52.dp),
            ) { Text("Declutter") }
        }
    }
}

// ------------------------------------------------------------------ edit

@Composable
fun EditItemSheet(item: ItemRow, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(item.name) }
    var qty by remember { mutableStateOf(item.quantity.toString()) }
    var price by remember { mutableStateOf(item.price?.let { "%.0f".format(it) } ?: "") }
    var bought by remember { mutableStateOf(item.purchasedOn ?: "") }
    var icon by remember { mutableStateOf(item.icon) }
    var pickingIcon by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    if (pickingIcon) {
        IconPickerSheet("Icon for ${name.ifBlank { item.name }}", icon, onDismiss = { pickingIcon = false }) {
            icon = it; pickingIcon = false
        }
        return
    }

    Sheet(onDismiss = { if (!busy) onDismiss() }) {
        SheetTitle("Edit details")
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            ItemAvatar(icon, name, pathParts(item.path).firstOrNull().orEmpty(), 52.dp)
            OutlinedButton(onClick = { pickingIcon = true }) { Text(if (icon.isEmpty()) "Choose icon" else "Change icon") }
        }
        OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(qty, { qty = it }, label = { Text("How many") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
            OutlinedTextField(price, { price = it }, label = { Text("Price ₹") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
        }
        OutlinedTextField(bought, { bought = it }, label = { Text("Bought on") }, placeholder = { Text("2026-10-25") },
            supportingText = { Text("Year-month-day; leave blank if unknown") },
            modifier = Modifier.fillMaxWidth(), singleLine = true)
        ErrorLine(error)
        Button(colors = confirmColors(),
            onClick = {
                busy = true
                scope.launch {
                    try {
                        val date = bought.trim()
                        withContext(Dispatchers.IO) {
                            Db.updateItem(
                                id = item.id,
                                name = name.trim().ifBlank { null },
                                quantity = qty.trim().toIntOrNull(),
                                price = price.trim().toDoubleOrNull(),
                                clearPrice = price.isBlank() && item.price != null,
                                purchasedOn = date.ifEmpty { null },
                                clearDate = date.isEmpty() && item.purchasedOn != null,
                                icon = icon.takeIf { it != item.icon },
                            )
                        }
                        ui.done("Saved ${name.trim()}")
                        onDismiss()
                    } catch (e: Exception) {
                        error = e.message
                        busy = false
                    }
                }
            },
            enabled = !busy && name.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) { Text(if (busy) "Saving…" else "Save") }
    }
}

// ----------------------------------------------------------------- voice

/** "Helmet is in living room" → match → one explicit yes. Nothing changes without it. */
@Composable
fun VoiceSheet(said: String, onDone: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf(said) }
    var move by remember { mutableStateOf<Parsed.Move?>(null) }
    var items by remember { mutableStateOf<List<ItemRow>>(emptyList()) }
    var places by remember { mutableStateOf<List<Target>>(emptyList()) }
    var note by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun run(t: String) {
        note = null
        move = null
        when (val p = parseUtterance(t)) {
            Parsed.Empty -> note = "Didn't catch that. Try again or type it."
            Parsed.Ambiguous -> note = "Say it like “Helmet is in living room”."
            is Parsed.Move -> scope.launch {
                busy = true
                try {
                    val m = withContext(Dispatchers.IO) { matchUtterance(p) }
                    items = m.items
                    places = m.places
                    move = p
                } catch (e: Exception) { note = e.message }
                busy = false
            }
        }
    }
    LaunchedEffect(Unit) { if (said.isNotBlank()) run(said) }

    // A missing place becomes a new room, as on the web.
    fun apply(item: ItemRow?, target: Target?) {
        val p = move ?: return
        busy = true
        scope.launch {
            try {
                val to = withContext(Dispatchers.IO) {
                    val to = target ?: Db.createRoom(p.place).let { Target(Target.Kind.ROOM, it.id, it.name) }
                    applyVoice(item, p.item, to)
                    to
                }
                ui.done(if (item != null) "Moved ${item.name} to ${to.name}" else "Added ${p.item} to ${to.name}")
                onDone()
            } catch (e: Exception) {
                note = e.message
                busy = false
            }
        }
    }

    Sheet(onDone) {
        SheetTitle("Say where something is")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                text, { text = it },
                placeholder = { Text("Helmet is in living room") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onGo = { run(text) }),
                modifier = Modifier.weight(1f),
            )
            Button(colors = confirmColors(), onClick = { run(text) }, enabled = !busy, modifier = Modifier.height(56.dp)) { Text("Go") }
        }
        note?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())

        val p = move
        if (p != null && !busy) {
            when {
                items.size > 1 -> {
                    Text("Which “${p.item}”?", style = MaterialTheme.typography.titleSmall)
                    items.forEach { i -> MoveRow(i.name, pathParts(i.path).joinToString(" › "), {
                        ItemAvatar(i.icon, i.name, pathParts(i.path).firstOrNull().orEmpty(), 36.dp) }, true) { items = listOf(i) } }
                }
                places.size > 1 -> {
                    Text("Which “${p.place}”?", style = MaterialTheme.typography.titleSmall)
                    places.forEach { t -> MoveRow(t.name, pathParts(t.sub).joinToString(" › "), { BoxGlyph() }, true) { places = listOf(t) } }
                }
                items.size == 1 && places.size == 1 ->
                    YesNo("Move ${items[0].name} to ${places[0].name}?", onDone) { apply(items[0], places[0]) }
                places.size == 1 ->
                    YesNo("Nothing called “${p.item}” yet. Add it to ${places[0].name}?", onDone) { apply(null, places[0]) }
                items.size == 1 ->
                    YesNo("No place called “${p.place}”. Create it and move ${items[0].name} there?", onDone) { apply(items[0], null) }
                else ->
                    YesNo("Add “${p.item}” to a new room called “${p.place}”?", onDone) { apply(null, null) }
            }
        }
    }
}

@Composable
private fun YesNo(question: String, onNo: () -> Unit, onYes: () -> Unit) {
    Text(question, style = MaterialTheme.typography.titleMedium)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onNo, modifier = Modifier.weight(1f).height(52.dp)) { Text("No") }
        Button(colors = confirmColors(), onClick = onYes, modifier = Modifier.weight(1f).height(52.dp)) { Text("Yes") }
    }
}

// ------------------------------------------------------------------ scan

/** What a label scan found: a box with its contents, a choice, or nothing. */
@Composable
fun ScanSheet(result: ScanResult, onDismiss: () -> Unit, onOpenItem: (ItemRow) -> Unit) {
    Sheet(onDismiss) {
        when (result) {
            is ScanResult.UnitHit -> {
                SheetTitle(result.unit.name)
                DrawerPath(result.unit.pathString)
                if (result.contents.isEmpty()) {
                    Text("Nothing inside yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                result.contents.forEach { ItemListRow(it) { onOpenItem(it) } }
            }
            is ScanResult.ItemsHit -> {
                SheetTitle("Same product, several places")
                Text("Pick the one you meant.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                result.items.forEach { ItemListRow(it) { onOpenItem(it) } }
            }
            is ScanResult.NotFound -> {
                SheetTitle("Nothing has this code")
                Text(
                    "No box or thing matches “${result.code}”. The label may be retired; reissue it from the web app's settings.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(colors = confirmColors(), onClick = onDismiss, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Close") }
            }
            is ScanResult.ItemHit -> ItemListRow(result.item) { onOpenItem(result.item) }
        }
    }
}

// --------------------------------------------------------------- dialogs

@Composable
fun TextPromptDialog(
    title: String,
    initial: String = "",
    placeholder: String = "",
    confirmLabel: String = "Save",
    keyboardType: KeyboardType = KeyboardType.Text,
    onDismiss: () -> Unit,
    onOk: (String) -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value, { value = it },
                placeholder = { Text(placeholder) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ImeAction.Done),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { if (value.isNotBlank()) onOk(value.trim()) }),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
        },
        confirmButton = { TextButton(onClick = { if (value.isNotBlank()) onOk(value.trim()) }, enabled = value.isNotBlank()) { Text(confirmLabel) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String = "Delete",
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirmLabel, color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
