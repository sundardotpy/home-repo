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
import androidx.compose.ui.unit.dp

// Clear Drawers: a frosted sea-glass ground, deep teal spent only on the one
// main action per screen, and a tint per room so the first drawer of every path
// says which room it is in. The palette is the app's identity, so wallpaper
// (dynamic) colour is deliberately not used.

private val LightScheme = lightColorScheme(
    primary = Color(0xFF0E5E58),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFB8E0D2),
    onPrimaryContainer = Color(0xFF00201C),
    secondary = Color(0xFF4A6360),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFCCE8E3),
    onSecondaryContainer = Color(0xFF05201D),
    tertiary = Color(0xFF7A5900),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFF6E0B5),
    onTertiaryContainer = Color(0xFF261A00),
    background = Color(0xFFF4F7F6),
    onBackground = Color(0xFF1C2326),
    surface = Color(0xFFF4F7F6),
    onSurface = Color(0xFF1C2326),
    surfaceVariant = Color(0xFFDAE4E2),
    onSurfaceVariant = Color(0xFF4A5557),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFEEF3F2),
    surfaceContainer = Color(0xFFE8EEED),
    surfaceContainerHigh = Color(0xFFE2E9E7),
    surfaceContainerHighest = Color(0xFFDCE3E1),
    outline = Color(0xFF6F7A79),
    outlineVariant = Color(0xFFC3CCCA),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B),
    inverseSurface = Color(0xFF2D3433),
    inverseOnSurface = Color(0xFFECF2F0),
    inversePrimary = Color(0xFF7FD3C6),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF7FD3C6),
    onPrimary = Color(0xFF003732),
    primaryContainer = Color(0xFF1F4F49),
    onPrimaryContainer = Color(0xFFB8F0E4),
    secondary = Color(0xFFB0CCC7),
    onSecondary = Color(0xFF1B3531),
    secondaryContainer = Color(0xFF324B47),
    onSecondaryContainer = Color(0xFFCCE8E3),
    tertiary = Color(0xFFEBC277),
    onTertiary = Color(0xFF412D00),
    tertiaryContainer = Color(0xFF5D4300),
    onTertiaryContainer = Color(0xFFF6E0B5),
    background = Color(0xFF101615),
    onBackground = Color(0xFFDEE4E2),
    surface = Color(0xFF101615),
    onSurface = Color(0xFFDEE4E2),
    surfaceVariant = Color(0xFF3F4947),
    onSurfaceVariant = Color(0xFFBFC9C7),
    surfaceContainerLowest = Color(0xFF0B100F),
    surfaceContainerLow = Color(0xFF181E1D),
    surfaceContainer = Color(0xFF1C2221),
    surfaceContainerHigh = Color(0xFF262D2B),
    surfaceContainerHighest = Color(0xFF313836),
    outline = Color(0xFF899391),
    outlineVariant = Color(0xFF3F4947),
    error = Color(0xFFF2B8B5),
    onError = Color(0xFF601410),
    errorContainer = Color(0xFF8C1D18),
    onErrorContainer = Color(0xFFF9DEDC),
    inverseSurface = Color(0xFFDEE4E2),
    inverseOnSurface = Color(0xFF2D3433),
    inversePrimary = Color(0xFF0E5E58),
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

/** The accent's roles in one mode: the loud colour, its container, and the tonal fill. */
data class AccentRoles(
    val primary: Color, val onPrimary: Color,
    val container: Color, val onContainer: Color,
    val tonal: Color, val onTonal: Color,
)

/**
 * The user's accent. It replaces the teal on actions, selection and the FAB;
 * the sea-glass ground and the room tints stay, because they carry the drawers.
 */
enum class Accent(val label: String, val light: AccentRoles, val dark: AccentRoles) {
    SeaGlass(
        "Sea glass",
        AccentRoles(Color(0xFF0E5E58), Color.White, Color(0xFFB8E0D2), Color(0xFF00201C), Color(0xFFCCE8E3), Color(0xFF05201D)),
        AccentRoles(Color(0xFF7FD3C6), Color(0xFF003732), Color(0xFF1F4F49), Color(0xFFB8F0E4), Color(0xFF324B47), Color(0xFFCCE8E3)),
    ),
    Tangerine(
        "Tangerine",
        AccentRoles(Color(0xFF9A4A00), Color.White, Color(0xFFFFDCC2), Color(0xFF321200), Color(0xFFFFE2CC), Color(0xFF2F1500)),
        AccentRoles(Color(0xFFFFB77A), Color(0xFF522300), Color(0xFF763600), Color(0xFFFFDCC2), Color(0xFF5C3A1F), Color(0xFFFFDCC2)),
    ),
    Blueberry(
        "Blueberry",
        AccentRoles(Color(0xFF3654A8), Color.White, Color(0xFFDBE1FF), Color(0xFF00184A), Color(0xFFDDE2F9), Color(0xFF131B2C)),
        AccentRoles(Color(0xFFB3C5FF), Color(0xFF002A77), Color(0xFF1A3C8F), Color(0xFFDBE1FF), Color(0xFF3E4759), Color(0xFFDDE2F9)),
    ),
    Raspberry(
        "Raspberry",
        AccentRoles(Color(0xFFA3324F), Color.White, Color(0xFFFFD9DF), Color(0xFF3F0016), Color(0xFFFFD9DF), Color(0xFF2C1519)),
        AccentRoles(Color(0xFFFFB1C0), Color(0xFF650025), Color(0xFF851A3A), Color(0xFFFFD9DF), Color(0xFF5C3F43), Color(0xFFFFD9DF)),
    ),
    Kale(
        "Kale",
        AccentRoles(Color(0xFF3F6B2E), Color.White, Color(0xFFC0F2A8), Color(0xFF032100), Color(0xFFD8E7CB), Color(0xFF131F0D)),
        AccentRoles(Color(0xFFA5D68E), Color(0xFF0E3900), Color(0xFF275219), Color(0xFFC0F2A8), Color(0xFF3C4B35), Color(0xFFD8E7CB)),
    ),
    Lavender(
        "Lavender",
        AccentRoles(Color(0xFF6750A4), Color.White, Color(0xFFE9DDFF), Color(0xFF22005D), Color(0xFFE8DEF8), Color(0xFF1D192B)),
        AccentRoles(Color(0xFFCFBCFF), Color(0xFF381E72), Color(0xFF4F378B), Color(0xFFE9DDFF), Color(0xFF4A4458), Color(0xFFE8DEF8)),
    ),
}

/** The full colour scheme for a mode and an accent, also used by the settings previews. */
fun schemeFor(dark: Boolean, accent: Accent): androidx.compose.material3.ColorScheme {
    val a = if (dark) accent.dark else accent.light
    return (if (dark) DarkScheme else LightScheme).copy(
        primary = a.primary, onPrimary = a.onPrimary,
        primaryContainer = a.container, onPrimaryContainer = a.onContainer,
        secondaryContainer = a.tonal, onSecondaryContainer = a.onTonal,
        inversePrimary = (if (dark) accent.light else accent.dark).primary,
    )
}

fun tintsFor(dark: Boolean): List<RoomTint> = if (dark) DarkTints else LightTints

/** Light/dark and accent, saved on this phone and applied the moment they change. */
class Appearance(private val prefs: android.content.SharedPreferences) {
    var mode by androidx.compose.runtime.mutableStateOf(
        ThemeMode.entries.firstOrNull { it.name == prefs.getString("theme_mode", null) } ?: ThemeMode.System,
    )
        private set
    var accent by androidx.compose.runtime.mutableStateOf(
        Accent.entries.firstOrNull { it.name == prefs.getString("accent", null) } ?: Accent.SeaGlass,
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
