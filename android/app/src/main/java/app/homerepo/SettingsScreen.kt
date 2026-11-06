package app.homerepo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ColorLens
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val PreviewHeight = 78.dp

/** How the app looks, and syncing with the household database. */
@Composable
fun SettingsScreen(prefs: android.content.SharedPreferences, onBack: () -> Unit, onForget: () -> Unit) {
    val ui = LocalUi.current
    val appearance = LocalAppearance.current
    val dark = appearance.isDark()
    val scope = rememberCoroutineScope()
    var syncing by remember { mutableStateOf(false) }
    var confirmForget by remember { mutableStateOf(false) }

    fun sync() {
        syncing = true
        scope.launch {
            try {
                // A real round trip, so "Synced" means the database answered.
                withContext(Dispatchers.IO) { Db.rooms() }
                ui.lastSync = System.currentTimeMillis()
                ui.done("Synced")
            } catch (e: Exception) {
                ui.say("Couldn't reach the database. ${e.message ?: ""}".trim())
            }
            syncing = false
        }
    }

    ScreenScaffold(title = "Settings", onBack = onBack) { pad ->
        // Settings is one white sheet under the warm top bar, as a list of bands.
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.surfaceContainerLowest)
                .verticalScroll(rememberScrollState())
                .padding(bottom = 32.dp),
        ) {
            SettingsSection("Appearance") {
                SettingsRow(Icons.Outlined.Palette, "Theme", "Light, dark, or follow your phone")
                Row(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ThemeMode.entries.forEach { mode ->
                        ChoiceCard(mode.label, appearance.mode == mode, { appearance.choose(mode) }, Modifier.weight(1f)) {
                            ModePreview(mode, appearance.accent)
                        }
                    }
                }
                SettingsRow(Icons.Outlined.ColorLens, "Accent colour", appearance.accent.label)
                // Large text gets two columns so every name fits whole.
                val columns = if (LocalDensity.current.fontScale > 1.15f) 2 else 3
                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Accent.entries.chunked(columns).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            row.forEach { accent ->
                                ChoiceCard(accent.label, appearance.accent == accent, { appearance.choose(accent) }, Modifier.weight(1f)) {
                                    MiniApp(schemeFor(dark, accent), tintsFor(dark), Modifier.fillMaxWidth().height(PreviewHeight))
                                }
                            }
                            repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }

            SettingsSection("Data") {
                SettingsRow(
                    Icons.Outlined.Sync,
                    if (syncing) "Syncing…" else "Sync now",
                    ui.lastSync?.let { at ->
                        "Last synced at " + Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalTime()
                            .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))
                    } ?: "Checks the database answers and reloads every screen",
                    onClick = if (syncing) null else ({ sync() }),
                )
                // Only a build without a built-in database can point somewhere else.
                if (!Db.builtIn) {
                    SettingsRow(Icons.Outlined.Storage, "Change database", "Forget this connection and enter another", onClick = { confirmForget = true })
                }
            }
        }
    }

    if (confirmForget) {
        ConfirmDialog(
            title = "Change database?",
            message = "The saved connection is removed from this phone and you can enter another. Nothing in the database changes.",
            confirmLabel = "Change",
            onDismiss = { confirmForget = false },
        ) {
            confirmForget = false
            prefs.edit().clear().apply()
            Db.profile = null
            onForget()
        }
    }
}

/**
 * A block of settings: a white, full-width band under a sentence-case header
 * in the accent's ink, with a hairline above it to part it from the last one.
 */
@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 8.dp).semantics { heading() },
        )
        content()
    }
}

/** One setting: an outline icon, its name, and its value or a hint underneath. */
@Composable
private fun SettingsRow(icon: ImageVector, title: String, value: String, onClick: (() -> Unit)? = null) {
    Row(
        Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .heightIn(min = 56.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** A selectable card: a picture of the choice, its name, and a check when chosen. */
@Composable
private fun ChoiceCard(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier, preview: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val shape = MaterialTheme.shapes.medium
    Surface(
        onClick = onClick,
        shape = shape,
        color = colors.surfaceContainerLowest,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) colors.primary else colors.outlineVariant),
        modifier = modifier.semantics { this.selected = selected; role = Role.RadioButton },
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(PreviewHeight).clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))) {
                preview()
                // The check sits on the picture, so the name keeps the full width.
                if (selected) {
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(6.dp).size(20.dp).background(colors.primary, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Outlined.Check, contentDescription = null, tint = colors.onPrimary, modifier = Modifier.size(14.dp)) }
                }
            }
            Text(
                label,
                style = MaterialTheme.typography.labelLarge,
                color = if (selected) colors.primary else colors.onSurface,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 10.dp),
            )
        }
    }
}

/** Light, dark, or System as half of each. */
@Composable
private fun ModePreview(mode: ThemeMode, accent: Accent) {
    when (mode) {
        ThemeMode.Light -> MiniApp(schemeFor(false, accent), tintsFor(false), Modifier.fillMaxWidth().height(PreviewHeight))
        ThemeMode.Dark -> MiniApp(schemeFor(true, accent), tintsFor(true), Modifier.fillMaxWidth().height(PreviewHeight))
        ThemeMode.System -> BoxWithConstraints(Modifier.fillMaxWidth().height(PreviewHeight)) {
            val w = maxWidth
            MiniApp(schemeFor(false, accent), tintsFor(false), Modifier.width(w).height(PreviewHeight))
            Box(Modifier.align(Alignment.CenterEnd).width(w / 2).fillMaxHeight().clipToBounds()) {
                MiniApp(schemeFor(true, accent), tintsFor(true), Modifier.requiredWidth(w).height(PreviewHeight).offset(x = -w / 4))
            }
        }
    }
}

/**
 * The app in miniature, drawn from a real colour scheme: the side rail, an item
 * with its drawer tabs on a spine, and the accent on the Add button.
 */
@Composable
private fun MiniApp(scheme: ColorScheme, tints: List<RoomTint>, modifier: Modifier) {
    Box(modifier.background(scheme.surface)) {
        Row(Modifier.fillMaxHeight()) {
            Column(
                Modifier.width(26.dp).fillMaxHeight().background(scheme.surfaceContainer).padding(6.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Bar(scheme.primary, 14.dp, 4.dp)
                Bar(scheme.secondaryContainer, 14.dp, 4.dp)
                Bar(scheme.outlineVariant, 14.dp, 4.dp)
            }
            Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Box(Modifier.size(10.dp).background(tints[0].container, CircleShape))
                    Bar(scheme.onSurface.copy(alpha = 0.55f), 30.dp, 4.dp)
                }
                Row(Modifier.height(IntrinsicSize.Min).padding(start = 4.dp)) {
                    Box(Modifier.width(1.5.dp).fillMaxHeight().background(scheme.outlineVariant))
                    Column(Modifier.padding(start = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Tab(tints[0].container, scheme.outlineVariant, 22.dp, 0.dp)
                        Tab(scheme.surfaceContainerLowest, scheme.outlineVariant, 18.dp, 4.dp)
                    }
                }
            }
        }
        Bar(scheme.primary, 18.dp, 9.dp, Modifier.align(Alignment.BottomEnd).padding(6.dp))
    }
}

@Composable
private fun Bar(color: Color, width: Dp, height: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(width, height).background(color, RoundedCornerShape(50)))
}

@Composable
private fun Tab(color: Color, line: Color, width: Dp, indent: Dp) {
    Box(
        Modifier.padding(start = indent).size(width, 6.dp)
            .background(color, RoundedCornerShape(2.dp))
            .border(0.5.dp, line, RoundedCornerShape(2.dp)),
    )
}
