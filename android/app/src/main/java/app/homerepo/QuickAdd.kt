package app.homerepo

import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.CurrencyRupee
import androidx.compose.material.icons.outlined.EmojiObjects
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Numbers
import androidx.compose.material3.AssistChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Somewhere a new thing can go: a room, or a box in it. */
private data class Place(val roomId: String, val unitId: String?, val room: String, val path: String, val icon: String = "") {
    val label: String get() = pathParts(path).joinToString(" › ")
}

/** "#off" at the end of the text: the place being typed, if any. */
private val HashToken = Regex("""(?:^|\s)#(\S*)$""")

/**
 * Quick add: type the thing, pick where it goes from the chips (or with "#"),
 * and send. The sheet stays open for the next one, keeping the place.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddSheet(initialName: String, onDismiss: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf(initialName) }
    var places by remember { mutableStateOf<List<Place>>(emptyList()) }
    var place by remember { mutableStateOf<Place?>(null) }
    var qty by remember { mutableStateOf(1) }
    var price by remember { mutableStateOf<Double?>(null) }
    var icon by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var moreOpen by remember { mutableStateOf(false) }
    var placeOpen by remember { mutableStateOf(false) }
    var asking by remember { mutableStateOf<String?>(null) } // "qty" | "price"
    var pickingIcon by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        try {
            places = withContext(Dispatchers.IO) {
                val rooms = Db.rooms()
                rooms.map { Place(it.id, null, it.name, it.name, it.icon) } +
                    Db.units().map { u ->
                        Place(u.roomId, u.id, pathParts(u.pathString).firstOrNull().orEmpty(), u.pathString,
                            rooms.firstOrNull { it.id == u.roomId }?.icon.orEmpty())
                    }
            }
            if (place == null) place = places.firstOrNull()
        } catch (e: Exception) { error = e.message }
        runCatching { focus.requestFocus() }
    }

    // "#" picks a place without leaving the keyboard.
    val hash = HashToken.find(text)?.groupValues?.get(1)
    val suggestions = if (hash == null) emptyList()
    else places.filter { hash.isEmpty() || it.path.contains(hash, ignoreCase = true) }.take(5)
    fun choose(p: Place) {
        place = p
        if (hash != null) text = text.replace(HashToken, "").trimEnd() + " "
    }

    val name = text.replace(HashToken, "").trim()
    fun send() {
        val p = place ?: return
        if (name.isEmpty() || busy) return
        busy = true
        error = null
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    Db.addItem(AddItem(name = name, roomId = p.roomId, unitId = p.unitId, quantity = qty, price = price, icon = icon))
                }
                ui.refresh()
                note = "Added $name to ${p.label}"
                // Ready for the next thing, in the same place.
                text = ""; qty = 1; price = null; icon = ""
            } catch (e: Exception) { error = e.message }
            busy = false
        }
    }

    // Speech: "helmet is in the office" fills the name and the place.
    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: return@rememberLauncherForActivityResult
        when (val parsed = parseUtterance(said)) {
            is Parsed.Move -> {
                text = parsed.item
                places.filter { it.path.contains(parsed.place, ignoreCase = true) }
                    .minByOrNull { it.path.length }?.let { place = it }
            }
            else -> text = said
        }
    }
    fun listen() {
        try {
            speech.launch(
                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Helmet is in the office"),
            )
        } catch (_: ActivityNotFoundException) {
            error = "No speech recogniser on this phone. Type it instead."
        }
    }

    if (pickingIcon) {
        IconPickerSheet("Icon for ${name.ifEmpty { "this" }}", icon, onDismiss = { pickingIcon = false }) {
            icon = it; pickingIcon = false
        }
        return
    }

    ModalBottomSheet(
        onDismissRequest = { if (!busy) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
    ) {
        Column(Modifier.navigationBarsPadding().padding(horizontal = 16.dp).padding(bottom = 12.dp)) {
            if (suggestions.isNotEmpty()) {
                Surface(
                    shape = MaterialTheme.shapes.large,
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                ) {
                    Column(Modifier.heightIn(max = 260.dp).verticalScroll(rememberScrollState()).padding(vertical = 6.dp)) {
                        Text("Places", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
                        suggestions.forEach { p -> PlaceLine(p) { choose(p) } }
                    }
                }
            }
            TextField(
                text, { text = it; note = null },
                placeholder = { Text("What are you putting away?", style = MaterialTheme.typography.titleLarge) },
                textStyle = MaterialTheme.typography.titleLarge,
                maxLines = 3,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { send() }),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
            note?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp)) }
            ErrorLine(error)
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box {
                        AssistChip(onClick = { moreOpen = true }, label = { Icon(Icons.Outlined.Add, contentDescription = "More details") })
                        DropdownMenu(expanded = moreOpen, onDismissRequest = { moreOpen = false }) {
                            DropdownMenuItem(text = { Text("Icon") }, leadingIcon = { Icon(Icons.Outlined.EmojiObjects, null) },
                                onClick = { moreOpen = false; pickingIcon = true })
                            DropdownMenuItem(text = { Text("How many") }, leadingIcon = { Icon(Icons.Outlined.Numbers, null) },
                                onClick = { moreOpen = false; asking = "qty" })
                            DropdownMenuItem(text = { Text("Price") }, leadingIcon = { Icon(Icons.Outlined.CurrencyRupee, null) },
                                onClick = { moreOpen = false; asking = "price" })
                        }
                    }
                    Box {
                        val p = place
                        AssistChip(
                            onClick = { placeOpen = true },
                            label = { Text(p?.label ?: "Pick a place", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            leadingIcon = { if (p != null) RoomSwatch(p.room, 20.dp, p.icon) },
                        )
                        DropdownMenu(expanded = placeOpen, onDismissRequest = { placeOpen = false }, modifier = Modifier.heightIn(max = 360.dp)) {
                            places.forEachIndexed { i, p ->
                                if (i > 0 && p.unitId == null) HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text(p.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                    leadingIcon = { if (p.unitId == null) RoomSwatch(p.room, 24.dp, p.icon) else Icon(Icons.Outlined.Inventory2, null) },
                                    onClick = { placeOpen = false; place = p },
                                )
                            }
                        }
                    }
                    if (icon.isNotEmpty()) {
                        AssistChip(onClick = { pickingIcon = true }, label = { Text("Icon") },
                            leadingIcon = { iconRes(icon)?.let { Icon(painterResource(it), null, Modifier.size(18.dp)) } })
                    }
                    if (qty != 1) AssistChip(onClick = { asking = "qty" }, label = { Text("×$qty") })
                    price?.let { AssistChip(onClick = { asking = "price" }, label = { Text("₹" + "%,.0f".format(it)) }) }
                }
                SendButton(empty = name.isEmpty(), enabled = !busy && (name.isEmpty() || place != null)) {
                    if (name.isEmpty()) listen() else send()
                }
            }
        }
    }

    when (asking) {
        "qty" -> TextPromptDialog(title = "How many?", initial = qty.toString(), confirmLabel = "Set",
            keyboardType = KeyboardType.Number, onDismiss = { asking = null }) {
            qty = it.toIntOrNull()?.coerceAtLeast(1) ?: qty; asking = null
        }
        "price" -> TextPromptDialog(title = "Price (₹)", initial = price?.let { "%.0f".format(it) } ?: "", confirmLabel = "Set",
            keyboardType = KeyboardType.Decimal, onDismiss = { asking = null }) {
            price = it.toDoubleOrNull(); asking = null
        }
    }
}

@Composable
private fun PlaceLine(p: Place, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (p.unitId == null) RoomSwatch(p.room, 28.dp, p.icon)
        else Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Inventory2, null) }
        Text(p.label, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** The accent button: speak while the name is empty, send once there is one. */
@Composable
private fun SendButton(empty: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Box(
        Modifier
            .padding(start = 8.dp)
            .size(52.dp)
            .background(if (enabled) c.primary else c.surfaceContainerHighest, MaterialTheme.shapes.large)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (empty) Icons.Outlined.Mic else Icons.Outlined.ArrowUpward,
            contentDescription = if (empty) "Say it" else "Add",
            tint = if (enabled) c.onPrimary else c.onSurfaceVariant,
        )
    }
}
