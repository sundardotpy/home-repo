package app.homerepo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.FloatingActionButton
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// ------------------------------------------------------------- app state

/**
 * What every screen shares: a refresh counter that reloads whatever is on
 * screen after a write, and the snackbar that says what just happened.
 */
class Ui(val snackbar: SnackbarHostState, private val scope: CoroutineScope) {
    var tick by mutableIntStateOf(0)
        private set
    var shiftOn by androidx.compose.runtime.mutableStateOf(false)
    /** When Settings last confirmed the database answered, this session. */
    var lastSync by androidx.compose.runtime.mutableStateOf<Long?>(null)

    fun refresh() { tick += 1 }

    /** A write landed: reload, and say so in the product's words. */
    fun done(message: String) {
        refresh()
        scope.launch { snackbar.showSnackbar(message) }
    }

    fun say(message: String) {
        scope.launch { snackbar.showSnackbar(message) }
    }

    /** A write with a safe way back: the snackbar offers Undo. */
    fun done(message: String, undo: () -> Unit) {
        refresh()
        scope.launch {
            val r = snackbar.showSnackbar(message, actionLabel = "Undo", duration = SnackbarDuration.Long)
            if (r == SnackbarResult.ActionPerformed) {
                try {
                    withContext(Dispatchers.IO) { undo() }
                    refresh()
                } catch (e: Exception) {
                    snackbar.showSnackbar(e.message ?: "Couldn't undo")
                }
            }
        }
    }
}

val LocalUi = staticCompositionLocalOf<Ui> { error("Ui not provided") }

// ----------------------------------------------------------- the drawers

/** The rooms-and-boxes path as its parts: "Bedroom > Wardrobe > Box" → three drawers. */
fun pathParts(path: String): List<String> = path.split(" > ").map { it.trim() }.filter { it.isNotEmpty() }

private val TabHeight = 22.dp
private val TabIndent = 10.dp

/**
 * The signature: a location as a stack of drawer tabs down one spine. The
 * room's tab carries its tint; every drawer inside it is a white slip label.
 * Tabs keep one height everywhere so paths compare at a glance; past four
 * levels the middle collapses to an ellipsis tab.
 */
@Composable
fun DrawerPath(path: String, modifier: Modifier = Modifier, roomTintFor: String? = null) {
    val parts = pathParts(path)
    if (parts.isEmpty()) return
    val shown = if (parts.size > 4) listOf(parts[0], "…") + parts.takeLast(2) else parts
    // A tail (inside a room or box) starts with a box, which stays a plain slip label.
    val startsAtRoom = roomTintFor == null || roomTintFor == parts[0]
    val tint = roomTint(parts[0])
    val colors = MaterialTheme.colorScheme
    Row(
        modifier
            .height(IntrinsicSize.Min)
            .clearAndSetSemantics { contentDescription = "In " + parts.joinToString(", ") },
    ) {
        Box(Modifier.width(2.dp).fillMaxHeight().background(colors.outlineVariant, CircleShape))
        Column(Modifier.padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            shown.forEachIndexed { i, label ->
                DrawerTab(
                    label = label,
                    container = if (i == 0 && startsAtRoom) tint.container else colors.surfaceContainerLowest,
                    content = if (i == 0 && startsAtRoom) tint.onContainer else colors.onSurface,
                    indent = TabIndent * minOf(i, 3),
                )
            }
        }
    }
}

@Composable
private fun DrawerTab(label: String, container: androidx.compose.ui.graphics.Color, content: androidx.compose.ui.graphics.Color, indent: Dp) {
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = container,
        contentColor = content,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.7f)),
        modifier = Modifier.padding(start = indent).heightIn(min = TabHeight),
    ) {
        Box(Modifier.heightIn(min = TabHeight).padding(horizontal = 9.dp, vertical = 1.dp), contentAlignment = Alignment.CenterStart) {
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** The room's own drawer front, for the Places list and room headers. */
@Composable
fun RoomSwatch(room: String, size: Dp = 40.dp, icon: String = "") {
    val tint = roomTint(room)
    Box(
        Modifier.size(size).background(tint.container, MaterialTheme.shapes.small),
        contentAlignment = Alignment.Center,
    ) {
        val res = iconRes(icon)
        if (res != null) Icon(painterResource(res), contentDescription = null, tint = tint.onContainer, modifier = Modifier.size(size * 0.55f))
        else Text(room.take(1).uppercase(), color = tint.onContainer, style = if (size < 32.dp) MaterialTheme.typography.labelMedium else MaterialTheme.typography.titleMedium)
    }
}

// --------------------------------------------------------------- items

/**
 * The item's picture: its stored icon or brand mark on its room's tint,
 * falling back to a monogram, then to the initial.
 */
@Composable
fun ItemAvatar(iconKey: String, name: String, room: String, size: Dp = 40.dp) {
    val tint = roomTint(room)
    val res = when {
        iconKey.startsWith("brand:") -> ItemIcons.brands[iconKey.removePrefix("brand:")]
        else -> ItemIcons.items[iconKey]
    }
    Box(
        Modifier.size(size).background(tint.container, MaterialTheme.shapes.medium),
        contentAlignment = Alignment.Center,
    ) {
        when {
            res != null -> Icon(
                painterResource(res), contentDescription = null, tint = tint.onContainer,
                modifier = Modifier.size(size * 0.55f),
            )
            iconKey.startsWith("brand:") && ItemIcons.monograms[iconKey.removePrefix("brand:")] != null -> Text(
                ItemIcons.monograms.getValue(iconKey.removePrefix("brand:")).initials,
                color = tint.onContainer, style = MaterialTheme.typography.labelLarge,
            )
            else -> Text(name.take(1).uppercase(), color = tint.onContainer, style = MaterialTheme.typography.titleMedium)
        }
    }
}

/**
 * One thing in a list: picture, name, and where it lives. Inside a room or box
 * (`within`), only the drawers below that place are shown.
 */
@Composable
fun ItemListRow(item: ItemRow, within: String = "", modifier: Modifier = Modifier, onClick: () -> Unit) {
    val parts = pathParts(item.path)
    val room = parts.firstOrNull().orEmpty()
    val here = pathParts(within)
    val below = if (here.isNotEmpty() && parts.take(here.size) == here) parts.drop(here.size) else parts
    Row(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ItemAvatar(item.icon, item.name, room)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    item.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (item.quantity != 1) {
                    Text("×${item.quantity}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (!item.active) StatusLabel("Decluttered")
            }
            if (below.isNotEmpty()) DrawerPath(below.joinToString(" > "), roomTintFor = room)
        }
    }
}

@Composable
fun StatusLabel(text: String) {
    Surface(shape = MaterialTheme.shapes.extraSmall, color = MaterialTheme.colorScheme.surfaceContainerHighest) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/**
 * A list section's title: sentence case, with an optional count, a trailing
 * action, and a chevron when the section folds away (tap anywhere on it).
 */
@Composable
fun SectionTitle(
    text: String,
    modifier: Modifier = Modifier,
    count: Int? = null,
    expanded: Boolean? = null,
    onToggle: (() -> Unit)? = null,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(top = 12.dp)
            .then(if (onToggle != null) Modifier.clickable(onClick = onToggle) else Modifier)
            .heightIn(min = 48.dp)
            .padding(horizontal = 16.dp)
            .semantics(mergeDescendants = true) {
                heading()
                if (expanded != null) stateDescription = if (expanded) "Expanded" else "Collapsed"
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(text, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        if (count != null) Text("$count", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.weight(1f))
        action?.invoke()
        if (expanded != null) {
            Icon(
                if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * A titled group of rows that folds away: the title with its count and a
 * chevron, then the rows as one segmented stack.
 */
fun <T : Any> androidx.compose.foundation.lazy.LazyListScope.foldingSection(
    title: String,
    rows: List<T>,
    collapsed: Set<String>,
    onToggle: (String) -> Unit,
    key: (T) -> Any,
    row: @Composable (T, Modifier) -> Unit,
) {
    val open = title !in collapsed
    item(key = "section:$title") { SectionTitle(title, count = rows.size, expanded = open, onToggle = { onToggle(title) }) }
    if (open) segments(rows, key, row = row)
}

/** Which sections of a screen are folded, kept across rotation. */
@Composable
fun rememberFolds(): Pair<Set<String>, (String) -> Unit> {
    var folded by androidx.compose.runtime.saveable.rememberSaveable { androidx.compose.runtime.mutableStateOf(setOf<String>()) }
    return folded to { t: String -> folded = if (t in folded) folded - t else folded + t }
}

/** A centred empty or error state with an optional action under it. */
@Composable
fun Notice(title: String, body: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Outlined.Inventory2, contentDescription = null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(40.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Text(
            body, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(4.dp))
            action()
        }
    }
}

// ------------------------------------------------------- segmented lists

private val SegmentOuter = 14.dp
private val SegmentInner = 4.dp

/**
 * One row of a segmented list: a white card of its own, 2dp below its
 * neighbour, 12dp in from the screen edge. Only the group's outer corners are
 * fully rounded, so a run of rows reads as one stack of cards.
 */
fun Modifier.segment(index: Int, count: Int, inset: Dp = 12.dp): Modifier = composed {
    val top = if (index == 0) SegmentOuter else SegmentInner
    val bottom = if (index == count - 1) SegmentOuter else SegmentInner
    this
        .padding(start = inset, end = inset, top = if (index > 0) 2.dp else 0.dp)
        .clip(RoundedCornerShape(topStart = top, topEnd = top, bottomStart = bottom, bottomEnd = bottom))
        .background(MaterialTheme.colorScheme.surfaceContainerLowest)
}

/** A list of rows as one segmented group. Inside a sheet, which has its own padding, pass `inset = 0.dp`. */
fun <T : Any> androidx.compose.foundation.lazy.LazyListScope.segments(
    list: List<T>,
    key: (T) -> Any,
    inset: Dp = 12.dp,
    row: @Composable (T, Modifier) -> Unit,
) = items(list.size, key = { key(list[it]) }) { i -> row(list[i], Modifier.segment(i, list.size, inset)) }

/** The screen's one accent action: an icon-only rounded square in the accent fill. */
@Composable
fun AddFab(label: String, onClick: () -> Unit) {
    FloatingActionButton(
        onClick = onClick,
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Icon(Icons.Outlined.Add, contentDescription = label)
    }
}

// ------------------------------------------------------------- scaffold

/**
 * Every screen's frame: a top app bar, the House Shift notice under it while
 * a shift runs on the web, the shared snackbar, and an optional FAB.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit = {},
    fab: @Composable () -> Unit = {},
    titleBold: Boolean = false,
    /** A muted count line under the title, e.g. "24 things". */
    subtitle: String? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    val ui = LocalUi.current
    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column {
                            // Destinations get the big title; pushed screens a step smaller beside the back arrow.
                            Text(
                                title, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                style = if (onBack == null) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleLarge,
                                fontWeight = if (titleBold) FontWeight.Bold else null,
                            )
                            if (subtitle != null) {
                                Text(
                                    subtitle, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        if (onBack != null) {
                            IconButton(onClick = onBack) {
                                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                            }
                        }
                    },
                    actions = actions,
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
                )
                if (ui.shiftOn) ShiftNotice()
            }
        },
        floatingActionButton = fab,
        snackbarHost = { SnackbarHost(ui.snackbar) },
        containerColor = MaterialTheme.colorScheme.surface,
        content = { pad -> Box(Modifier.fillMaxSize()) { content(pad) } },
    )
}

@Composable
private fun ShiftNotice() {
    Surface(
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).heightIn(min = 48.dp),
    ) {
        Text(
            "House Shift is on — pack on the web. Changes here go to the live inventory.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
        )
    }
}
