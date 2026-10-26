package app.homerepo

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ViewAgenda
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

// --------------------------------------------------------------- routes

@Serializable data object FindKey : NavKey
@Serializable data object PlacesKey : NavKey
@Serializable data object HistoryKey : NavKey
@Serializable data object SettingsKey : NavKey
@Serializable data class RoomKey(val id: String, val name: String, val icon: String = "") : NavKey
@Serializable data class UnitKey(val id: String, val name: String, val roomId: String, val path: String, val parentId: String? = null) : NavKey

private data class Tab(val key: NavKey, val label: String, val icon: ImageVector)

private val Tabs = listOf(
    Tab(FindKey, "Find", Icons.Outlined.Search),
    Tab(PlacesKey, "Places", Icons.Outlined.ViewAgenda),
    Tab(HistoryKey, "History", Icons.Outlined.History),
)

// Opening a room or box pulls its drawer toward you and going back pushes it in:
// a shared-axis Y where both screens move. Everything else fades through.
private const val DrawerMs = 300
private fun drawerOut(): ContentTransform =
    (slideInVertically(tween(DrawerMs)) { it / 10 } + fadeIn(tween(DrawerMs)))
        .togetherWith(slideOutVertically(tween(DrawerMs)) { -it / 10 } + fadeOut(tween(DrawerMs)))
private fun drawerIn(): ContentTransform =
    (slideInVertically(tween(DrawerMs)) { -it / 10 } + fadeIn(tween(DrawerMs)))
        .togetherWith(slideOutVertically(tween(DrawerMs)) { it / 10 } + fadeOut(tween(DrawerMs)))
private fun fadeThrough(): ContentTransform =
    (fadeIn(tween(210, delayMillis = 90)) + scaleIn(tween(210, delayMillis = 90), initialScale = 0.92f))
        .togetherWith(fadeOut(tween(90)))
private fun NavKey?.isDrawer() = this is RoomKey || this is UnitKey

@Composable
fun App(prefs: android.content.SharedPreferences) {
    var connected by rememberSaveable { mutableStateOf(Db.profile != null) }
    val scope = rememberCoroutineScope()
    val ui = remember { Ui(SnackbarHostState(), scope) }

    CompositionLocalProvider(LocalUi provides ui) {
        if (!connected) {
            ConnectionScreen(prefs, onConnected = { connected = true; ui.refresh() })
            return@CompositionLocalProvider
        }

        val backStack = rememberNavBackStack(FindKey)
        LaunchedEffect(ui.tick, backStack.lastOrNull()) {
            // A failed check (old role, offline) just hides the notice.
            ui.shiftOn = runCatching { withContext(Dispatchers.IO) { Db.shiftOn() } }.getOrDefault(false)
        }
        // The tab is the last tab root on the stack; Find is always the bottom, so Back ends there.
        val top = backStack.lastOrNull { k -> Tabs.any { it.key == k } } ?: FindKey
        // The motion is decided by the navigation itself, before the stack changes:
        // into or out of a room or box pulls a drawer; everything else fades through.
        var drawer by remember { mutableStateOf(false) }
        fun go(key: NavKey) { drawer = key.isDrawer(); backStack.add(key) }
        fun back() {
            if (backStack.size > 1) {
                drawer = backStack.lastOrNull().isDrawer()
                backStack.removeAt(backStack.lastIndex)
            }
        }

        NavigationSuiteScaffold(
            navigationSuiteItems = {
                Tabs.forEach { tab ->
                    item(
                        selected = top == tab.key,
                        onClick = {
                            // A tab tap returns to that tab's root, with Find underneath.
                            drawer = false
                            backStack.clear()
                            backStack.add(FindKey)
                            if (tab.key != FindKey) backStack.add(tab.key)
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(tab.label) },
                    )
                }
            },
        ) {
            NavDisplay(
                backStack = backStack,
                onBack = { back() },
                transitionSpec = { if (drawer) drawerOut() else fadeThrough() },
                popTransitionSpec = { if (drawer) drawerIn() else fadeThrough() },
                // A back swipe starts before the stack changes, so read the screen being left.
                predictivePopTransitionSpec = { if (backStack.lastOrNull().isDrawer()) drawerIn() else fadeThrough() },
                entryProvider = entryProvider {
                    entry<FindKey> { FindScreen(onOpenSettings = { go(SettingsKey) }) }
                    entry<PlacesKey> { PlacesScreen(onOpenRoom = { go(RoomKey(it.id, it.name, it.icon)) }) }
                    entry<RoomKey> { key ->
                        RoomScreen(
                            key,
                            onBack = { back() },
                            onOpenUnit = { go(UnitKey(it.id, it.name, it.roomId, it.pathString, it.parentId)) },
                        )
                    }
                    entry<UnitKey> { key ->
                        UnitScreen(
                            key,
                            onBack = { back() },
                            onOpenUnit = { go(UnitKey(it.id, it.name, it.roomId, it.pathString, it.parentId)) },
                        )
                    }
                    entry<HistoryKey> { HistoryScreen() }
                    entry<SettingsKey> {
                        SettingsScreen(
                            prefs,
                            onBack = { back() },
                            onForget = { connected = false },
                        )
                    }
                },
            )
        }
    }
}
