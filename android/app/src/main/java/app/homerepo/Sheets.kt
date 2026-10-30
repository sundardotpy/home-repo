package app.homerepo

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
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
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
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

private enum class ItemMode { Main, Move, Declutter, Edit }

/** One thing owns the sheet: where it is, and what you can do with it. */
@Composable
fun ItemSheet(item: ItemRow, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(ItemMode.Main) }
    var confirmDelete by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val room = pathParts(item.path).firstOrNull().orEmpty()

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
        ItemMode.Main -> Sheet(onDismiss) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                ItemAvatar(item.icon, item.name, room, 56.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        item.name + if (item.quantity != 1) "  ×${item.quantity}" else "",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    DrawerPath(item.path)
                }
            }
            if (!item.active) {
                Text("Decluttered: out of the house, kept in the record.", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (item.price != null) {
                Text(
                    "₹${"%,.0f".format(item.price)}" + (item.purchasedOn?.let { " · bought $it" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            ErrorLine(error)
            if (item.active) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { mode = ItemMode.Move }, modifier = Modifier.weight(1f).height(52.dp)) {
                        Icon(Icons.Outlined.SwapHoriz, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Move")
                    }
                    FilledTonalButton(
                        onClick = { act({ Db.addQuantity(item.id, 1) }) { ui.done("${item.name}: now ${item.quantity + 1}") } },
                        modifier = Modifier.height(52.dp),
                    ) { Text("+1") }
                    OutlinedButton(onClick = { mode = ItemMode.Declutter }, modifier = Modifier.height(52.dp)) { Text("Declutter") }
                }
            } else {
                Button(
                    onClick = { act({ Db.restoreItem(item.id) }) { ui.done("${item.name} is back") } },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) { Text("Restore") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { mode = ItemMode.Edit }) { Text("Edit details") }
                TextButton(onClick = { confirmDelete = true }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
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
        DrawerPath(item.path)
        OutlinedTextField(
            filter, { filter = it },
            placeholder = { Text("Find a room, box or thing") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        ErrorLine(error)
        if (spots == null || busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        val (rooms, units, things) = spots ?: Triple(emptyList(), emptyList(), emptyList())
        val q = filter.trim()
        fun hit(s: String) = q.isEmpty() || s.contains(q, ignoreCase = true)
        LazyColumn(Modifier.heightIn(max = 520.dp)) {
            val r = rooms.filter { hit(it.name) }
            if (r.isNotEmpty()) item { SectionTitle("Rooms") }
            items(r, key = { "r" + it.id }) { room ->
                MoveRow(room.name, "Loose in the room", { RoomSwatch(room.name, 36.dp, room.icon) }, !busy) {
                    go(room.name) { Db.moveItem(item.id, room.id, null, null) }
                }
            }
            val u = units.filter { hit(it.pathString) }
            if (u.isNotEmpty()) item { SectionTitle("Boxes") }
            items(u, key = { "u" + it.id }) { unit ->
                MoveRow(unit.name, pathParts(unit.pathString).joinToString(" › "), { BoxGlyph() }, !busy) {
                    go(unit.name) { Db.moveItem(item.id, null, unit.id, null) }
                }
            }
            val t = things.filter { hit(it.name) }
            if (t.isNotEmpty()) item { SectionTitle("Inside another thing") }
            items(t, key = { "i" + it.id }) { thing ->
                MoveRow(thing.name, pathParts(thing.path).joinToString(" › "),
                    { ItemAvatar(thing.icon, thing.name, pathParts(thing.path).firstOrNull().orEmpty(), 36.dp) }, !busy) {
                    go(thing.name) { Db.moveItem(item.id, null, null, thing.id) }
                }
            }
        }
    }
}

@Composable
fun BoxGlyph() = Icon(Icons.Outlined.Inventory2, contentDescription = null, modifier = Modifier.size(36.dp).padding(6.dp))

@Composable
fun MoveRow(title: String, sub: String, leading: @Composable () -> Unit, enabled: Boolean, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(sub, maxLines = 1) },
        leadingContent = leading,
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        modifier = Modifier.clickable(enabled = enabled, onClick = onClick),
    )
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
        Button(
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
            Button(onClick = { run(text) }, enabled = !busy, modifier = Modifier.height(56.dp)) { Text("Go") }
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
        Button(onClick = onYes, modifier = Modifier.weight(1f).height(52.dp)) { Text("Yes") }
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
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Close") }
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
