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

@Composable
fun HrepoTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    CompositionLocalProvider(LocalTints provides if (dark) DarkTints else LightTints) {
        MaterialTheme(
            colorScheme = if (dark) DarkScheme else LightScheme,
            // The device system sans at Material roles: the app follows the user own font and size.
            typography = Typography(),
            shapes = AppShapes,
            content = content,
        )
    }
}
