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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Inventory2
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
fun RoomSwatch(room: String, size: Dp = 40.dp) {
    val tint = roomTint(room)
    Box(
        Modifier.size(size).background(tint.container, MaterialTheme.shapes.small),
        contentAlignment = Alignment.Center,
    ) {
        Text(room.take(1).uppercase(), color = tint.onContainer, style = MaterialTheme.typography.titleMedium)
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
fun ItemListRow(item: ItemRow, within: String = "", onClick: () -> Unit) {
    val parts = pathParts(item.path)
    val room = parts.firstOrNull().orEmpty()
    val here = pathParts(within)
    val below = if (here.isNotEmpty() && parts.take(here.size) == here) parts.drop(here.size) else parts
    Row(
        Modifier
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

/** A list section's title. */
@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 4.dp).semantics { heading() },
    )
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
    content: @Composable (PaddingValues) -> Unit,
) {
    val ui = LocalUi.current
    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Text(
                            title, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            fontWeight = if (titleBold) FontWeight.Bold else null,
                        )
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
