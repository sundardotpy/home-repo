package app.homerepo

import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId

private enum class Filter(val label: String, val status: String) {
    Active("Your things", "active"), Decluttered("Decluttered", "decluttered"), All("All", "all")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FindScreen(onOpenSettings: () -> Unit) {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(Filter.Active) }
    var items by remember { mutableStateOf<List<ItemRow>?>(null) }
    var todayIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var detail by remember { mutableStateOf<ItemRow?>(null) }
    var adding by remember { mutableStateOf<String?>(null) }
    var voiceText by remember { mutableStateOf<String?>(null) }
    var scanResult by remember { mutableStateOf<ScanResult?>(null) }

    // The phone's own speech dialog: no microphone permission of ours to ask for.
    // Cancelled, denied or unheard, the sheet still opens to take typed text.
    val speech = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        voiceText = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: ""
    }
    fun listen() {
        try {
            speech.launch(
                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Helmet is in living room"),
            )
        } catch (_: ActivityNotFoundException) {
            voiceText = "" // no recogniser on this phone: the sheet takes typed text
        }
    }

    // Printed labels encode a URL; the resolver pulls the code out of it.
    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        val contents = result.contents ?: return@rememberLauncherForActivityResult
        scope.launch {
            try {
                when (val hit = withContext(Dispatchers.IO) { Db.resolveCode(contents) }) {
                    is ScanResult.ItemHit -> detail = hit.item
                    else -> scanResult = hit
                }
            } catch (e: Exception) {
                ui.say(e.message ?: "Couldn't read that code")
            }
        }
    }
    fun scan() = scanner.launch(
        ScanOptions()
            .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt("Point at a Home Repo label")
            .setBeepEnabled(false)
            .setOrientationLocked(false),
    )

    LaunchedEffect(query, filter, ui.tick) {
        // Typing fires one query after a pause, not one per keystroke.
        if (query.isNotBlank()) delay(300)
        loading = true
        error = null
        try {
            // Assigned only after the IO returns, so a superseded query never lands.
            val (found, today) = withContext(Dispatchers.IO) {
                val startOfDay = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                Db.items(query, status = filter.status) to
                    Db.recentMoves(40).filter { it.movedAt >= startOfDay && it.kind != "decluttered" }
                        .map { it.itemId }.distinct()
            }
            items = found
            todayIds = today
        } catch (e: CancellationException) {
            throw e // the next keystroke took over; not an error
        } catch (e: Exception) {
            error = e.message
            items = emptyList()
        }
        loading = false
    }

    val list = rememberLazyListState()
    val fabExpanded by remember { derivedStateOf { list.firstVisibleItemIndex == 0 } }
    val all = items.orEmpty()
    val showToday = query.isBlank() && filter == Filter.Active
    val today = if (showToday) todayIds.mapNotNull { id -> all.firstOrNull { it.id == id } } else emptyList()
    val rest = all.filterNot { it in today }

    ScreenScaffold(
        title = "h/repo",
        titleBold = true,
        actions = {
            IconButton(onClick = onOpenSettings) { Icon(Icons.Outlined.Settings, contentDescription = "Connection settings") }
        },
        fab = {
            ExtendedFloatingActionButton(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                onClick = { adding = "" },
                expanded = fabExpanded,
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text("Add") },
            )
        },
    ) { pad ->
        LazyColumn(
            state = list,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 96.dp),
        ) {
            item {
                Surface(
                    shape = MaterialTheme.shapes.extraLarge,
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                ) {
                    SearchBarDefaults.InputField(
                        query = query,
                        onQueryChange = { query = it },
                        onSearch = {},
                        expanded = false,
                        onExpandedChange = {},
                        placeholder = { Text("Where did I put it?", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                        trailingIcon = {
                            Row {
                                IconButton(onClick = { listen() }) {
                                    Icon(Icons.Outlined.Mic, contentDescription = "Say where something is")
                                }
                                IconButton(onClick = { scan() }) {
                                    Icon(Icons.Outlined.QrCodeScanner, contentDescription = "Scan a label")
                                }
                            }
                        },
                    )
                }
            }
            item {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Filter.entries.forEach { f ->
                        FilterChip(
                            selected = filter == f,
                            onClick = { filter = f },
                            label = { Text(f.label) },
                            leadingIcon = if (filter == f) {
                                { Icon(Icons.Outlined.Check, contentDescription = null) }
                            } else null,
                        )
                    }
                }
            }
            item {
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 16.dp))
                else Spacer(Modifier.height(4.dp))
            }
            error?.let { msg ->
                item {
                    Notice("Couldn't reach the database", msg) {
                        FilledTonalButton(onClick = { ui.refresh() }) { Text("Try again") }
                    }
                }
            }
            if (today.isNotEmpty()) {
                item { SectionTitle("Put away today") }
                items(today, key = { "t" + it.id }) { ItemListRow(it) { detail = it } }
            }
            when {
                items == null || error != null -> {}
                all.isEmpty() && query.isNotBlank() -> item {
                    Notice(
                        "Nothing called “${query.trim()}”",
                        if (filter == Filter.Active) "Check the spelling, or search decluttered things too." else "Check the spelling, or add it now.",
                    ) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            if (filter == Filter.Active) OutlinedButton(onClick = { filter = Filter.All }) { Text("Search everything") }
                            FilledTonalButton(onClick = { adding = query.trim() }) { Text("Add “${query.trim()}”") }
                        }
                    }
                }
                all.isEmpty() -> item {
                    Notice(
                        if (filter == Filter.Active) "Nothing tracked yet" else "Nothing here",
                        if (filter == Filter.Active) "Add the first thing and where it lives." else "Things you declutter stay listed here.",
                    ) {
                        if (filter == Filter.Active) FilledTonalButton(onClick = { adding = "" }) { Text("Add something") }
                    }
                }
                rest.isNotEmpty() -> {
                    item { SectionTitle(if (query.isBlank()) filter.label else "Matches") }
                    items(rest, key = { it.id }) { ItemListRow(it) { detail = it } }
                }
            }
        }
    }

    detail?.let { ItemSheet(it, onDismiss = { detail = null }) }
    adding?.let { name -> AddSheet(initialName = name, onDismiss = { adding = null }) }
    voiceText?.let { said -> VoiceSheet(said) { voiceText = null } }
    scanResult?.let { result ->
        ScanSheet(result, onDismiss = { scanResult = null }, onOpenItem = { scanResult = null; detail = it })
    }
}
