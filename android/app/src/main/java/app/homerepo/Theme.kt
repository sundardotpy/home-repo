package app.homerepo

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.unit.dp

// A warm off-white ground with white cards on it, one accent family (Tangerine
// by default) for the main action, and a tint per room so the first drawer of
// every path says which room it is in. The palette is the app's identity, so
// wallpaper (dynamic) colour is deliberately not used.

private val LightScheme = lightColorScheme(
    primary = Color(0xFF8F5A00),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFEBD61),
    onPrimaryContainer = Color(0xFF1A1C1E),
    secondary = Color(0xFF66605A),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFF9EBD5),
    onSecondaryContainer = Color(0xFF1F1E1D),
    tertiary = Color(0xFF7A5900),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFF6E0B5),
    onTertiaryContainer = Color(0xFF261A00),
    background = Color(0xFFF8F7F5),
    onBackground = Color(0xFF1F1E1D),
    surface = Color(0xFFF8F7F5),
    onSurface = Color(0xFF1F1E1D),
    surfaceVariant = Color(0xFFE8E6E3),
    onSurfaceVariant = Color(0xFF6C6A67),
    // Cards: white on the warm ground.
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF3F2EF),
    surfaceContainer = Color(0xFFEEEDEB),
    surfaceContainerHigh = Color(0xFFE8E7E4),
    surfaceContainerHighest = Color(0xFFDFDEDC),
    outline = Color(0xFF7A7876),
    outlineVariant = Color(0xFFDCDAD6),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
    inverseSurface = Color(0xFF31302E),
    inverseOnSurface = Color(0xFFF4F2EF),
    inversePrimary = Color(0xFFFEBD61),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFFED39A),
    onPrimary = Color(0xFF3A2600),
    primaryContainer = Color(0xFFFEBD61),
    onPrimaryContainer = Color(0xFF1A1C1E),
    secondary = Color(0xFFCFC6BB),
    onSecondary = Color(0xFF353029),
    secondaryContainer = Color(0xFF4A3D2A),
    onSecondaryContainer = Color(0xFFE8E6E3),
    tertiary = Color(0xFFEBC277),
    onTertiary = Color(0xFF412D00),
    tertiaryContainer = Color(0xFF5D4300),
    onTertiaryContainer = Color(0xFFF6E0B5),
    background = Color(0xFF161514),
    onBackground = Color(0xFFE8E6E3),
    surface = Color(0xFF161514),
    onSurface = Color(0xFFE8E6E3),
    surfaceVariant = Color(0xFF3A3836),
    onSurfaceVariant = Color(0xFFC4C1BC),
    // Cards sit one step lighter than the ground, as white does in light mode.
    surfaceContainerLowest = Color(0xFF242321),
    surfaceContainerLow = Color(0xFF1C1B19),
    surfaceContainer = Color(0xFF201F1D),
    surfaceContainerHigh = Color(0xFF2A2927),
    surfaceContainerHighest = Color(0xFF353331),
    outline = Color(0xFF9A9690),
    outlineVariant = Color(0xFF3D3B38),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
    inverseSurface = Color(0xFFE8E6E3),
    inverseOnSurface = Color(0xFF31302E),
    inversePrimary = Color(0xFF8F5A00),
)

/** One room's drawer colour: the tinted front and the ink that reads on it. */
data class RoomTint(val container: Color, val onContainer: Color)

// Seafoam, amber, rose, lavender, sky, sage — each a light/dark tonal pair.
private val LightTints = listOf(
    RoomTint(Color(0xFFCDEBE1), Color(0xFF0F3D33)),
    RoomTint(Color(0xFFF6E0B5), Color(0xFF4A3405)),
    RoomTint(Color(0xFFF6D3DA), Color(0xFF5A1D2B)),
    RoomTint(Color(0xFFDED8F5), Color(0xFF2E2463)),
    RoomTint(Color(0xFFD3E5F6), Color(0xFF12344F)),
    RoomTint(Color(0xFFDCE6CF), Color(0xFF2C3A1C)),
)
private val DarkTints = listOf(
    RoomTint(Color(0xFF24453C), Color(0xFFC6EBDD)),
    RoomTint(Color(0xFF4A3A16), Color(0xFFF6E0B5)),
    RoomTint(Color(0xFF52303A), Color(0xFFF6D3DA)),
    RoomTint(Color(0xFF3A3458), Color(0xFFDED8F5)),
    RoomTint(Color(0xFF2A3D52), Color(0xFFD3E5F6)),
    RoomTint(Color(0xFF38432B), Color(0xFFDCE6CF)),
)

private val LocalTints = staticCompositionLocalOf { LightTints }

/**
 * A room's tint, stable for its name. ponytail: six tints by name hash, so two
 * rooms can share a colour; store a tint per room if households outgrow six.
 */
@Composable
fun roomTint(room: String): RoomTint {
    val tints = LocalTints.current
    return tints[Math.floorMod(room.trim().lowercase().hashCode(), tints.size)]
}

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

// ------------------------------------------------------------ appearance

enum class ThemeMode(val label: String) { System("System"), Light("Light"), Dark("Dark") }

/**
 * The user's accent: one exact colour, the fill of the FAB and of each sheet's
 * confirm button. Text, checkboxes and switches use a darker step of the same
 * hue (see [schemeFor]). The ground and the room tints stay, because they carry
 * the drawers. Tangerine is the default.
 */
enum class Accent(val label: String, val color: Color, val lightInk: Color? = null) {
    // A light fill: its ink is a saturated amber, not the fill darkened (that goes muddy).
    Tangerine("Tangerine", Color(0xFFFEBD61), lightInk = Color(0xFF8F5A00)),
    SeaGlass("Sea glass", Color(0xFF0E5E58)),
    Moonstone("Moonstone", Color(0xFF4A5462)),
    Kale("Kale", Color(0xFF4B7A45)),
    Blueberry("Blueberry", Color(0xFF3569BA)),
    Lavender("Lavender", Color(0xFF756BBD)),
    Raspberry("Raspberry", Color(0xFFCA4F71)),
}

private fun contrast(a: Color, b: Color): Float {
    val (hi, lo) = listOf(a.luminance(), b.luminance()).sortedDescending()
    return (hi + 0.05f) / (lo + 0.05f)
}

/** White or near-black, whichever reads better on the fill. */
private fun inkOn(fill: Color): Color {
    val dark = Color(0xFF1A1C1E)
    return if (contrast(fill, Color.White) >= contrast(fill, dark)) Color.White else dark
}

/**
 * The accent as text on a card: the fill itself when it reads at 4.5:1, or
 * stepped toward black (light) or white (dark) until it does. Tangerine's
 * light fill becomes a dark amber this way.
 */
private fun accentInk(fill: Color, dark: Boolean): Color {
    val card = if (dark) Color(0xFF242321) else Color.White
    val target = if (dark) Color.White else Color.Black
    var c = fill
    repeat(20) { if (contrast(c, card) < 4.5f) c = lerp(c, target, 0.1f) }
    return c
}

/**
 * The full scheme for a mode and an accent, also used by the settings previews.
 * The accent splits in two: `primaryContainer` is the exact fill (FAB, confirm
 * buttons) with white or near-black on it, and `primary` is its readable ink
 * (text buttons, checkboxes, switches, focus, the active tab). The tonal
 * `secondaryContainer` (active tab pill, selected chip) is the fill mixed into
 * the ground.
 */
fun schemeFor(dark: Boolean, accent: Accent): androidx.compose.material3.ColorScheme {
    val base = if (dark) DarkScheme else LightScheme
    val fill = accent.color
    val ink = if (dark) accentInk(lerp(fill, Color.White, 0.35f), true) else accent.lightInk ?: accentInk(fill, false)
    return base.copy(
        primary = ink, onPrimary = inkOn(ink),
        primaryContainer = fill, onPrimaryContainer = inkOn(fill),
        secondaryContainer = lerp(base.surface, fill, if (dark) 0.30f else 0.20f), onSecondaryContainer = base.onSurface,
        inversePrimary = if (dark) accent.lightInk ?: accentInk(fill, false) else lerp(fill, Color.White, 0.35f),
    )
}

/** The filled confirm button: the accent fill, as on the FAB. */
@Composable
fun confirmColors() = androidx.compose.material3.ButtonDefaults.buttonColors(
    containerColor = MaterialTheme.colorScheme.primaryContainer,
    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
)

fun tintsFor(dark: Boolean): List<RoomTint> = if (dark) DarkTints else LightTints

/** Light/dark and accent, saved on this phone and applied the moment they change. */
class Appearance(private val prefs: android.content.SharedPreferences) {
    var mode by androidx.compose.runtime.mutableStateOf(
        ThemeMode.entries.firstOrNull { it.name == prefs.getString("theme_mode", null) } ?: ThemeMode.System,
    )
        private set
    var accent by androidx.compose.runtime.mutableStateOf(
        Accent.entries.firstOrNull { it.name == prefs.getString("accent", null) } ?: Accent.Tangerine,
    )
        private set

    fun choose(mode: ThemeMode) { this.mode = mode; prefs.edit().putString("theme_mode", mode.name).apply() }
    fun choose(accent: Accent) { this.accent = accent; prefs.edit().putString("accent", accent.name).apply() }

    @Composable
    fun isDark(): Boolean = when (mode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }
}

val LocalAppearance = staticCompositionLocalOf<Appearance> { error("Appearance not provided") }

@Composable
fun HrepoTheme(appearance: Appearance, content: @Composable () -> Unit) {
    val dark = appearance.isDark()
    CompositionLocalProvider(LocalTints provides tintsFor(dark), LocalAppearance provides appearance) {
        MaterialTheme(
            colorScheme = schemeFor(dark, appearance.accent),
            // The device system sans at Material roles: the app follows the user own font and size.
            typography = Typography(),
            shapes = AppShapes,
            content = content,
        )
    }
}
