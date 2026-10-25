// Home Repo for Android. One database, two clients: the phone talks straight
// to Postgres, so what it writes is what the web app shows on its next read.
// The home mirrors the web app: hero search, the put-away actions as a
// Transactions grid, filter chips, and the "last put away" feed.

package app.homerepo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.activity.compose.rememberLauncherForActivityResult
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import android.widget.Toast
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("homerepo", MODE_PRIVATE)
        if (prefs.contains("host")) {
            Db.profile = Profile(
                host = prefs.getString("host", "")!!,
                port = prefs.getInt("port", 5432),
                database = prefs.getString("database", "")!!,
                user = prefs.getString("user", "")!!,
                password = prefs.getString("password", "")!!,
                ssl = prefs.getBoolean("ssl", true),
            )
        }

        setContent {
            RepoTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    App(prefs)
                }
            }
        }
    }
}

// ------------------------------------------------------------------ theme

// The web app's Classic skin, flattened into Material 3 tokens.
private val Canvas = Color(0xFFFAF9F5)
private val Paper = Color(0xFFFFFFFF)
private val Ink = Color(0xFF1D1B26)
private val InkSoft = Color(0xFF6B6879)
private val InkFaint = Color(0xFF9B98A6)
private val Line = Color(0xFFE8E6DE)
private val Accent = Color(0xFFF5C518)
private val Good = Color(0xFF2F7D4F)
private val Danger = Color(0xFFB3382C)

// The Transactions tiles borrow the reference screenshot's soft tints.
private val TintRedBg = Color(0xFFFDE8E8)
private val TintRedFg = Color(0xFFD95757)
private val TintBlueBg = Color(0xFFE3F0FB)
private val TintBlueFg = Color(0xFF4A90D9)
private val TintYellowBg = Color(0xFFFDF3DC)
private val TintYellowFg = Color(0xFFDBA23C)
private val TintPurpleBg = Color(0xFFEFEAFB)
private val TintPurpleFg = Color(0xFF8B6FD8)

@Composable
fun RepoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            background = Canvas,
            surface = Paper,
            primary = Ink,
            onPrimary = Canvas,
            secondary = Accent,
            onSecondary = Ink,
            outline = Line,
            onSurfaceVariant = InkSoft,
            error = Danger,
        ),
        typography = Typography(),
        content = content,
    )
}

private fun hue(name: String): Color {
    var h = 0
    for (ch in name) h = (h * 31 + ch.code) % 360
    return Color.hsl(h.toFloat(), 0.55f, 0.88f)
}

private fun ago(ms: Long): String {
    val mins = (System.currentTimeMillis() - ms) / 60_000
    return when {
        mins < 1 -> "now"
        mins < 60 -> "${mins}m"
        mins < 60 * 24 -> "${mins / 60}h"
        else -> "${mins / 60 / 24}d"
    }
}

/**
 * The web app's item avatar: a stored icon key (line icon) or brand mark
 * (brand:<slug>) rendered from the bundled VectorDrawables, falling back to
 * the brand monogram, then to the item's initial.
 */
@Composable
fun ItemAvatar(iconKey: String, name: String, size: Int = 44) {
    val res = when {
        iconKey.startsWith("brand:") -> ItemIcons.brands[iconKey.removePrefix("brand:")]
        else -> ItemIcons.items[iconKey]
    }
    if (res != null) {
        Box(
            Modifier.size(size.dp).background(hue(name), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                painter = painterResource(res),
                contentDescription = name,
                tint = Ink,
                modifier = Modifier.size((size * 0.56f).dp),
            )
        }
        return
    }
    if (iconKey.startsWith("brand:")) {
        val mono = ItemIcons.monograms[iconKey.removePrefix("brand:")]
        if (mono != null) {
            Box(
                Modifier.size(size.dp).background(TintPurpleBg, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(mono.initials, fontWeight = FontWeight.Bold, fontSize = (size * 0.3f).sp, color = TintPurpleFg)
            }
            return
        }
    }
    Box(
        Modifier.size(size.dp).background(hue(name), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(name.take(1).uppercase(), fontWeight = FontWeight.Bold, fontSize = (size * 0.38f).sp, color = Ink)
    }
}

private fun kindLabel(kind: String, quantity: Int?): String = when (kind) {
    "added" -> if (quantity != null && quantity > 0) "Added ×$quantity" else "Added"
    "moved" -> "Moved"
    "decluttered" -> "Decluttered"
    else -> kind
}

// -------------------------------------------------------------------- app

private sealed interface Screen {
    data object Home : Screen
    data object Places : Screen
    data object Recent : Screen
    data object Settings : Screen
}

@Composable
private fun NavTab(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.clickable(onClick = onClick).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = if (active) Accent else Color.Transparent,
        ) {
            Icon(
                icon, contentDescription = label,
                tint = if (active) Ink else InkFaint,
                modifier = Modifier.padding(horizontal = 22.dp, vertical = 5.dp).size(24.dp),
            )
        }
        Text(
            label, fontSize = 11.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
            color = if (active) Ink else InkFaint,
        )
    }
}

@Composable
fun App(prefs: android.content.SharedPreferences) {
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    var connected by remember { mutableStateOf(Db.profile != null) }

    if (!connected) {
        ConnectionScreen(prefs, onConnected = { connected = true })
        return
    }

    val scope = rememberCoroutineScope()
    var refreshTick by remember { mutableStateOf(0) }
    fun refresh() { refreshTick += 1 }

    Scaffold(
        topBar = {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("h/repo", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { screen = Screen.Settings }) { Text("Settings") }
            }
        },
        bottomBar = {
            Box(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 10.dp)) {
                Surface(
                    shape = RoundedCornerShape(28.dp),
                    color = Paper,
                    shadowElevation = 10.dp,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Line),
                    modifier = Modifier.fillMaxWidth().height(68.dp),
                ) {
                    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                        NavTab("Home", Icons.Outlined.Home, screen == Screen.Home, Modifier.weight(1f)) { screen = Screen.Home }
                        NavTab("Places", Icons.Outlined.Folder, screen == Screen.Places, Modifier.weight(1f)) { screen = Screen.Places }
                        NavTab("Recent", Icons.Outlined.History, screen == Screen.Recent, Modifier.weight(1f)) { screen = Screen.Recent }
                    }
                }
            }
        },
    ) { pad ->
        when (screen) {
            Screen.Home -> HomeScreen(
                pad, refreshTick, ::refresh,
                onOpenSettings = { screen = Screen.Settings },
                onOpenRecent = { screen = Screen.Recent },
            )
            Screen.Places -> PlacesScreen(pad, refreshTick)
            Screen.Recent -> RecentScreen(pad, refreshTick)
            Screen.Settings -> SettingsScreen(pad, prefs, onForget = { connected = false }, onSaved = { connected = true })
        }
    }
}

// ------------------------------------------------------------- connection

@Composable
fun ConnectionScreen(prefs: android.content.SharedPreferences, onConnected: () -> Unit) {
    val scope = rememberCoroutineScope()
    var host by remember { mutableStateOf(prefs.getString("host", "") ?: "") }
    var port by remember { mutableStateOf((prefs.getInt("port", 5432)).toString()) }
    var database by remember { mutableStateOf(prefs.getString("database", "") ?: "") }
    var user by remember { mutableStateOf(prefs.getString("user", "") ?: "") }
    var password by remember { mutableStateOf(prefs.getString("password", "") ?: "") }
    var ssl by remember { mutableStateOf(prefs.getBoolean("ssl", true)) }
    var status by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        Text("h/repo", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text(
            "Connect to the household database. The app speaks Postgres directly — " +
                "use the pooled Neon host in production, or 127.0.0.1 over adb reverse in development.",
            color = InkSoft, fontSize = 14.sp,
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(host, { host = it }, label = { Text("Host") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(port, { port = it }, label = { Text("Port") }, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
        OutlinedTextField(database, { database = it }, label = { Text("Database") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(user, { user = it }, label = { Text("User") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(), singleLine = true)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(ssl, { ssl = it })
            Text("TLS (sslmode=require)", color = InkSoft)
        }
        Button(
            onClick = {
                busy = true
                status = "Connecting…"
                scope.launch {
                    try {
                        val p = Profile(
                            host.trim(), port.trim().toIntOrNull() ?: 5432,
                            database.trim(), user.trim(), password, ssl,
                        )
                        withContext(Dispatchers.IO) {
                            Db.profile = p
                            try { Db.defaultUserId(); true } catch (e: Exception) { Db.profile = null; throw e }
                        }
                        prefs.edit()
                            .putString("host", p.host).putInt("port", p.port)
                            .putString("database", p.database).putString("user", p.user)
                            .putString("password", p.password).putBoolean("ssl", p.ssl)
                            .apply()
                        onConnected()
                    } catch (e: Exception) {
                        status = e.message ?: "Failed"
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = !busy && host.isNotBlank() && database.isNotBlank() && user.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
        ) { Text(if (busy) "Connecting…" else "Connect", fontSize = 16.sp) }
        if (status.isNotEmpty() && !status.startsWith("Connect")) {
            Text(status, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
    }
}

@Composable
fun SettingsScreen(
    pad: PaddingValues,
    prefs: android.content.SharedPreferences,
    onForget: () -> Unit,
    onSaved: () -> Unit,
) {
    val p = Db.profile
    Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Connection", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
        if (p != null) {
            Text(
                "${p.user}@${p.host}:${p.port}/${p.database} · ${if (p.ssl) "TLS" else "no TLS"}",
                color = InkSoft, fontSize = 14.sp,
            )
        }
        Text(
            "One database, two clients. What the phone writes is what the web app shows; " +
                "the last write wins, exactly as Postgres intends.",
            color = InkSoft, fontSize = 13.sp,
        )
        Button(onClick = onSaved, modifier = Modifier.fillMaxWidth()) { Text("Reload data") }
        OutlinedButton(
            onClick = {
                prefs.edit().clear().apply()
                Db.profile = null
                onForget()
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Forget this database", color = MaterialTheme.colorScheme.error) }
    }
}

// ------------------------------------------------------------------- home

@Composable
fun HomeScreen(pad: PaddingValues, tick: Int, refresh: () -> Unit, onOpenSettings: () -> Unit, onOpenRecent: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("active") }
    var items by remember { mutableStateOf<List<ItemRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var addOpen by remember { mutableStateOf(false) }
    var removeTarget by remember { mutableStateOf<ItemRow?>(null) }
    var moveTarget by remember { mutableStateOf<ItemRow?>(null) }
    var pickRemove by remember { mutableStateOf(false) }
    var pickMove by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<ItemRow?>(null) }
    var scanResult by remember { mutableStateOf<ScanResult?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // The printed labels encode an absolute URL; the scanner hands back the
    // whole contents and the resolver extracts the code.
    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val contents = result.contents ?: return@rememberLauncherForActivityResult
        scope.launch {
            try {
                val resolved = withContext(Dispatchers.IO) { Db.resolveCode(contents) }
                // A single item opens its card straight away; everything else
                // gets a sheet (a box with contents, a choice, or a dead end).
                if (resolved is ScanResult.ItemHit) {
                    scanResult = null
                    detail = resolved.item
                } else {
                    scanResult = resolved
                }
            } catch (e: Exception) {
                Toast.makeText(context, e.message ?: "Scan failed", Toast.LENGTH_LONG).show()
            }
        }
    }
    fun scan() {
        scanLauncher.launch(
            ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("Point at a Home Repo label")
                .setBeepEnabled(false)
                .setOrientationLocked(false),
        )
    }

    LaunchedEffect(query, status, tick) {
        // Typing fires one query after a pause, not one per keystroke.
        if (query.isNotBlank()) delay(300)
        error = null
        try {
            items = withContext(Dispatchers.IO) { Db.items(query, status = status) }
        } catch (e: Exception) {
            error = e.message
            items = emptyList()
        }
    }

    Box(Modifier.fillMaxSize().padding(pad)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text(
                    "Where did I\nput it?",
                    fontSize = 34.sp,
                    lineHeight = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                )
            }
            item {
                OutlinedTextField(
                    query, { query = it },
                    label = { Text("Charger, SIM pin, a box code…") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Ink,
                        unfocusedBorderColor = Line,
                    ),
                    trailingIcon = {
                        IconButton(onClick = { scan() }) {
                            Icon(Icons.Outlined.QrCodeScanner, contentDescription = "Scan a code", tint = Ink)
                        }
                    },
                )
            }
            item {
                Text(
                    "Transactions",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp,
                    color = InkFaint,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ActionTile(
                        "Add item", TintRedBg, TintRedFg,
                        Icons.Outlined.FileUpload, Modifier.weight(1f),
                    ) { addOpen = true }
                    ActionTile(
                        "Remove", TintBlueBg, TintBlueFg,
                        Icons.Outlined.FileDownload, Modifier.weight(1f),
                    ) { pickRemove = true }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ActionTile(
                        "Move", TintYellowBg, TintYellowFg,
                        Icons.Outlined.SwapHoriz, Modifier.weight(1f),
                    ) { pickMove = true }
                    ActionTile(
                        "Recent", TintPurpleBg, TintPurpleFg,
                        Icons.Outlined.History, Modifier.weight(1f),
                    ) { onOpenRecent() }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    FilterChip("Your things", status == "active") { status = "active" }
                    FilterChip("Decluttered", status == "decluttered") { status = "decluttered" }
                    FilterChip("All", status == "all") { status = "all" }
                }
            }
            item {
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                }
            }
            when {
                items == null -> item {
                    Text("Loading…", color = InkSoft, modifier = Modifier.padding(vertical = 16.dp))
                }
                items!!.isEmpty() -> item {
                    Text(
                        if (query.isBlank())
                            if (status == "active") "Nothing tracked yet. Add something with the tiles above."
                            else "Nothing here."
                        else "No match for “${query.trim()}”.",
                        color = InkSoft, modifier = Modifier.padding(vertical = 24.dp),
                    )
                }
                else -> items(items!!, key = { it.id }) { item ->
                    ItemCard(item) { detail = item }
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }

        FloatingActionButton(
            onClick = { addOpen = true },
            containerColor = Accent, contentColor = Ink,
            modifier = Modifier.align(Alignment.BottomEnd).padding(20.dp),
        ) { Text("+", fontSize = 26.sp) }
    }

    if (addOpen) AddSheet(refresh) { addOpen = false }
    if (pickRemove) {
        PickItemSheet(
            title = "Remove — what left the house?",
            hint = "It stays in the record; it just leaves the active inventory.",
            onDismiss = { pickRemove = false },
        ) { item ->
            pickRemove = false
            removeTarget = item
        }
    }
    if (pickMove) {
        PickItemSheet(
            title = "Move — which thing?",
            hint = "Pick it, then choose where it goes.",
            onDismiss = { pickMove = false },
        ) { item ->
            pickMove = false
            moveTarget = item
        }
    }
    removeTarget?.let { item ->
        DeclutterSheet(item, onDone = { removeTarget = null; refresh() })
    }
    moveTarget?.let { item ->
        MoveSheet(item, onDone = { moveTarget = null; refresh() })
    }
    detail?.let { item ->
        ItemSheet(item, { refresh() }, onDismiss = { detail = null }, onChanged = { refresh() })
    }
    scanResult?.let { result ->
        ScanSheet(
            result,
            onDismiss = { scanResult = null },
            onOpenItem = { scanResult = null; detail = it },
        )
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = if (selected) Ink else Paper,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Ink else Line),
    ) {
        Text(
            label,
            modifier = Modifier.clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) Canvas else Ink,
        )
    }
}

@Composable
private fun ActionTile(
    label: String,
    tintBg: Color,
    tintFg: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Paper,
        shadowElevation = 1.dp,
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(14.dp)) {
            Box(
                Modifier.size(44.dp).background(tintBg, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = tintFg,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Spacer(Modifier.weight(1f))
                Text("↗", fontSize = 13.sp, color = InkFaint)
            }
        }
    }
}

@Composable
private fun ItemCard(item: ItemRow, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Paper,
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            ItemAvatar(iconKey = item.icon, name = item.name)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        item.name,
                        fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (item.quantity != 1) {
                        Spacer(Modifier.width(6.dp))
                        Surface(shape = RoundedCornerShape(8.dp), color = Canvas) {
                            Text(
                                "×${item.quantity}",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                fontSize = 12.sp, color = InkSoft,
                            )
                        }
                    }
                    if (!item.active) {
                        Spacer(Modifier.width(6.dp))
                        Surface(shape = RoundedCornerShape(8.dp), color = TintRedBg) {
                            Text(
                                "decluttered",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                fontSize = 11.sp, color = TintRedFg,
                            )
                        }
                    }
                }
                Text(item.path, fontSize = 13.sp, color = InkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

// ------------------------------------------------------------- pick flows

/**
 * Search-and-pick sheet behind the Remove and Move tiles: find the thing
 * first, then the flow takes over.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PickItemSheet(
    title: String,
    hint: String,
    onDismiss: () -> Unit,
    onPick: (ItemRow) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var items by remember { mutableStateOf<List<ItemRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(query) {
        try {
            // Removing and moving both apply to the active inventory.
            items = withContext(Dispatchers.IO) { Db.items(query, status = "active") }
        } catch (e: Exception) {
            error = e.message
            items = emptyList()
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(hint, fontSize = 13.sp, color = InkSoft)
            OutlinedTextField(
                query, { query = it },
                label = { Text("Search") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            LazyColumn(
                modifier = Modifier.heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 24.dp),
            ) {
                when {
                    items == null -> {}
                    items!!.isEmpty() -> item {
                        Text("No match.", color = InkSoft, modifier = Modifier.padding(vertical = 16.dp))
                    }
                    else -> items(items!!, key = { it.id }) { item ->
                        ItemCard(item) { onPick(item) }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeclutterSheet(item: ItemRow, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = { if (!busy) onDone() }) {
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Remove ${item.name}?", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(
                "It is decluttered — out of the house, kept in the record. " +
                    "Undo any time from its card.",
                fontSize = 13.sp, color = InkSoft,
            )
            OutlinedTextField(
                note, { note = it },
                label = { Text("Note (optional) — sold, given away…") },
                modifier = Modifier.fillMaxWidth(), singleLine = true,
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        busy = true
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) { Db.declutterItem(item.id, note.trim().ifBlank { null }) }
                                onDone()
                            } catch (e: Exception) {
                                error = e.message
                                busy = false
                            }
                        }
                    },
                    enabled = !busy,
                    modifier = Modifier.weight(1f).height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = Paper),
                ) { Text(if (busy) "Removing…" else "Remove") }
                OutlinedButton(
                    onClick = { onDone() },
                    enabled = !busy,
                    modifier = Modifier.weight(1f).height(52.dp),
                ) { Text("Cancel") }
            }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoveSheet(item: ItemRow, onDone: () -> Unit) {
    val scope = rememberCoroutineScope()
    var rooms by remember { mutableStateOf<List<RoomRow>>(emptyList()) }
    var units by remember { mutableStateOf<List<UnitRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busyTarget by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            withContext(Dispatchers.IO) {
                rooms = Db.rooms()
                units = Db.units()
            }
        } catch (e: Exception) {
            error = e.message
        }
    }

    ModalBottomSheet(onDismissRequest = onDone) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text("Move ${item.name}", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text("Now at: ${item.path}", fontSize = 13.sp, color = InkSoft)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            Spacer(Modifier.height(10.dp))
            LazyColumn(
                modifier = Modifier.heightIn(max = 460.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                contentPadding = PaddingValues(bottom = 24.dp),
            ) {
                items(rooms) { r ->
                    MoveTargetRow(
                        label = r.name,
                        sub = "Loose in the room",
                        busy = busyTarget == r.id,
                    ) {
                        busyTarget = r.id
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) { Db.moveItem(item.id, r.id, null, null) }
                                onDone()
                            } catch (e: Exception) {
                                error = e.message
                                busyTarget = null
                            }
                        }
                    }
                }
                items(units) { u ->
                    MoveTargetRow(
                        label = u.name,
                        sub = u.pathString,
                        busy = busyTarget == u.id,
                    ) {
                        busyTarget = u.id
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) { Db.moveItem(item.id, null, u.id, null) }
                                onDone()
                            } catch (e: Exception) {
                                error = e.message
                                busyTarget = null
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MoveTargetRow(label: String, sub: String, busy: Boolean, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Paper,
        border = androidx.compose.foundation.BorderStroke(1.dp, Line),
        modifier = Modifier.fillMaxWidth().clickable(enabled = !busy, onClick = onClick),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(label, fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                Text(sub, fontSize = 12.sp, color = InkSoft)
            }
            if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            else Text("Move here", fontSize = 13.sp, color = Good, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ----------------------------------------------------------------- sheets

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddSheet(refresh: () -> Unit, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var rooms by remember { mutableStateOf<List<RoomRow>>(emptyList()) }
    var units by remember { mutableStateOf<List<UnitRow>>(emptyList()) }
    var roomId by remember { mutableStateOf<String?>(null) }
    var unitId by remember { mutableStateOf<String?>(null) }
    var qty by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            withContext(Dispatchers.IO) {
                rooms = Db.rooms()
                units = Db.units()
            }
            if (roomId == null && rooms.isNotEmpty()) roomId = rooms.first().id
        } catch (e: Exception) {
            error = e.message
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.padding(horizontal = 20.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Add (bought)", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            OutlinedTextField(name, { name = it }, label = { Text("What is it?") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(qty, { qty = it }, label = { Text("How many? (optional)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(), singleLine = true)
            Text("Room", fontSize = 13.sp, color = InkSoft)
            Column {
                rooms.forEach { r ->
                    Row(Modifier.fillMaxWidth().clickable { roomId = r.id; unitId = null }.padding(vertical = 10.dp)) {
                        RadioButton(selected = roomId == r.id, onClick = { roomId = r.id; unitId = null })
                        Text(r.name, modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }
            if (units.isNotEmpty()) {
                Text("Storage unit (optional)", fontSize = 13.sp, color = InkSoft)
                Column {
                    Row(Modifier.fillMaxWidth().clickable { unitId = null }.padding(vertical = 8.dp)) {
                        RadioButton(selected = unitId == null, onClick = { unitId = null })
                        Text("Anywhere in the room", color = InkSoft)
                    }
                    units.filter { it.roomId == roomId }.forEach { u ->
                        Row(Modifier.fillMaxWidth().clickable { unitId = u.id }.padding(vertical = 8.dp)) {
                            RadioButton(selected = unitId == u.id, onClick = { unitId = u.id })
                            Text(u.pathString)
                        }
                    }
                }
            }
            OutlinedTextField(price, { price = it }, label = { Text("Price ₹ (optional)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(), singleLine = true)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                Db.addItem(AddItem(
                                    name = name.trim(),
                                    roomId = roomId,
                                    unitId = unitId,
                                    quantity = qty.trim().toIntOrNull()?.coerceAtLeast(0) ?: 1,
                                    price = price.trim().toDoubleOrNull(),
                                ))
                            }
                            refresh()
                            onDismiss()
                        } catch (e: Exception) {
                            error = e.message
                        } finally {
                            busy = false
                        }
                    }
                },
                enabled = !busy && name.isNotBlank() && roomId != null,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
            ) { Text(if (busy) "Saving…" else "Add") }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemSheet(item: ItemRow, refresh: () -> Unit, onDismiss: () -> Unit, onChanged: () -> Unit) {
    val scope = rememberCoroutineScope()
    var moving by remember { mutableStateOf(false) }
    var editOpen by remember { mutableStateOf(false) }
    var deleteConfirm by remember { mutableStateOf(false) }
    var rooms by remember { mutableStateOf<List<RoomRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var statusLine by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            withContext(Dispatchers.IO) { rooms = Db.rooms() }
        } catch (_: Exception) { }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ItemAvatar(iconKey = item.icon, name = item.name)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(item.name + if (item.quantity != 1) " ×${item.quantity}" else "", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text(item.path, fontSize = 14.sp, color = InkSoft)
                }
            }
            if (!item.active) Text("Decluttered — out of the house, kept in the record.", color = InkSoft, fontSize = 13.sp)
            if (item.price != null && item.purchasedOn != null) {
                Text("₹${item.price} · bought ${item.purchasedOn}", fontSize = 13.sp, color = InkSoft)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            statusLine.let { if (it.isNotEmpty()) Text(it, color = Good, fontSize = 13.sp) }

            if (item.active) {
                if (moving) {
                    Text("Move to…", fontSize = 13.sp, color = InkSoft)
                    rooms.forEach { r ->
                        TextButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) { Db.moveItem(item.id, r.id, null, null) }
                                        moving = false
                                        onChanged()
                                        onDismiss()
                                    } catch (e: Exception) { error = e.message }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(r.name) }
                    }
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { moving = true }, modifier = Modifier.weight(1f)) { Text("Move") }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) { Db.addQuantity(item.id, 1) }
                                        onChanged(); onDismiss()
                                    } catch (e: Exception) { error = e.message }
                                }
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("+1") }
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        withContext(Dispatchers.IO) { Db.declutterItem(item.id, null) }
                                        onChanged(); onDismiss()
                                    } catch (e: Exception) { error = e.message }
                                }
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("Declutter", color = MaterialTheme.colorScheme.error) }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { editOpen = true },
                            modifier = Modifier.weight(1f),
                        ) { Text("Edit") }
                        OutlinedButton(
                            onClick = { deleteConfirm = true },
                            modifier = Modifier.weight(1f),
                        ) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                    }
                }
            } else {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) { Db.restoreItem(item.id) }
                                onChanged(); onDismiss()
                            } catch (e: Exception) { error = e.message }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Restore") }
            }
            if (editOpen) {
                EditItemSheet(
                    item,
                    onDone = { editOpen = false; onChanged(); onDismiss() },
                    onDismiss = { editOpen = false },
                )
            }
            if (deleteConfirm) {
                ConfirmDialog(
                    title = "Delete ${item.name}?",
                    message = "Gone for good, history and all — declutter instead if you want the record kept. Anything nested inside moves up one level.",
                    confirmLabel = "Delete",
                ) {
                    deleteConfirm = false
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { Db.deleteItem(item.id) }
                            onChanged(); onDismiss()
                        } catch (e: Exception) { error = e.message }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

// ----------------------------------------------------------------- places

@Composable
fun PlacesScreen(pad: PaddingValues, tick: Int) {
    var rooms by remember { mutableStateOf<List<RoomRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var localTick by remember { mutableStateOf(0) }
    var openRoom by remember { mutableStateOf<RoomRow?>(null) }
    var openUnit by remember { mutableStateOf<UnitRow?>(null) }
    var addRoomOpen by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<ItemRow?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun refresh() { localTick += 1 }

    LaunchedEffect(tick, localTick) {
        try {
            rooms = withContext(Dispatchers.IO) { Db.rooms() }
        } catch (e: Exception) {
            error = e.message
            rooms = emptyList()
        }
    }

    val room = openRoom
    val unit = openUnit
    when {
        unit != null -> UnitDetail(
            pad, unit, tick + localTick,
            onBack = { openUnit = null },
            onOpenUnit = { openUnit = it },
            onItem = { detail = it },
            onRename = { refresh() },
        )
        room != null -> RoomDetail(
            pad, room, tick + localTick,
            onBack = { openRoom = null },
            onOpenUnit = { openUnit = it },
            onItem = { detail = it },
            onRenamed = { refresh() },
            onDeleted = { openRoom = null; refresh() },
        )
        else -> Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 20.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Places", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.weight(1f))
                Button(
                    onClick = { addRoomOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                ) { Text("+ Room") }
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            when {
                rooms == null -> {}
                rooms!!.isEmpty() -> Text(
                    "No rooms yet — create one, then add boxes inside.",
                    color = InkSoft, modifier = Modifier.padding(vertical = 32.dp),
                )
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(rooms!!, key = { it.id }) { r ->
                        Surface(
                            shape = RoundedCornerShape(18.dp),
                            color = Paper,
                            shadowElevation = 1.dp,
                            modifier = Modifier.fillMaxWidth().clickable { openRoom = r },
                        ) {
                            Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    Modifier.size(38.dp).background(hue(r.name), CircleShape),
                                    contentAlignment = Alignment.Center,
                                ) { Text(r.name.take(1).uppercase(), fontWeight = FontWeight.Bold, color = Ink) }
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(r.name, fontWeight = FontWeight.SemiBold, color = Ink)
                                    Text("${r.unitCount} units · ${r.itemCount} items", fontSize = 13.sp, color = InkSoft)
                                }
                                Text("›", fontSize = 20.sp, color = InkFaint)
                            }
                        }
                    }
                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }
    }

    if (addRoomOpen) {
        TextPromptDialog(
            title = "New room",
            placeholder = "Bedroom",
            confirmLabel = "Create",
            onDismiss = { addRoomOpen = false },
            onOk = { name ->
                addRoomOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Db.createRoom(name) }
                        refresh()
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                    }
                }
            },
        )
    }
    detail?.let { item ->
        ItemSheet(item, { refresh() }, onDismiss = { detail = null }, onChanged = { refresh() })
    }
}

// ------------------------------------------------------- room / unit views

@Composable
private fun DetailHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TextButton(onClick = onBack) { Text("‹ Back") }
        Spacer(Modifier.weight(1f))
    }
    Text(title, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Ink)
    Text(subtitle, fontSize = 13.sp, color = InkSoft)
}

@Composable
fun RoomDetail(
    pad: PaddingValues,
    room: RoomRow,
    tick: Int,
    onBack: () -> Unit,
    onOpenUnit: (UnitRow) -> Unit,
    onItem: (ItemRow) -> Unit,
    onRenamed: () -> Unit,
    onDeleted: () -> Unit,
) {
    var units by remember { mutableStateOf<List<UnitRow>>(emptyList()) }
    var loose by remember { mutableStateOf<List<ItemRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var addBoxOpen by remember { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(room.id, tick) {
        try {
            withContext(Dispatchers.IO) {
                units = Db.units(room.id)
                loose = Db.itemsInRoom(room.id, loose = true)
            }
        } catch (e: Exception) { error = e.message }
    }

    Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 20.dp)) {
        DetailHeader(room.name, "${units.size} units · ${loose.size} loose in the room", onBack)
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { addBoxOpen = true },
                colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                modifier = Modifier.weight(1f),
            ) { Text("+ Box") }
            OutlinedButton(onClick = { renameOpen = true }, modifier = Modifier.weight(1f)) { Text("Rename") }
            OutlinedButton(onClick = { deleteOpen = true }, modifier = Modifier.weight(1f)) { Text("Delete", color = Danger) }
        }
        error?.let { Text(it, color = Danger, fontSize = 13.sp) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
            if (units.isNotEmpty()) {
                item { SectionLabel("Boxes") }
                items(units, key = { it.id }) { u ->
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Paper,
                        shadowElevation = 1.dp,
                        modifier = Modifier.fillMaxWidth().clickable { onOpenUnit(u) },
                    ) {
                        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(painterResource(R.drawable.ic_item_box), contentDescription = null, tint = InkSoft, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(u.name, fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.weight(1f))
                            Text("›", fontSize = 18.sp, color = InkFaint)
                        }
                    }
                }
            }
            item { SectionLabel(if (loose.isEmpty()) "" else "Loose in this room") }
            if (loose.isEmpty() && units.isEmpty()) {
                item {
                    Text(
                        "Nothing here yet — add a box, or put things straight in the room from Home.",
                        color = InkSoft, modifier = Modifier.padding(vertical = 16.dp),
                    )
                }
            }
            items(loose, key = { it.id }) { item -> ItemCard(item) { onItem(item) } }
        }
    }

    if (addBoxOpen) {
        TextPromptDialog(
            title = "New box in ${room.name}",
            placeholder = "Wardrobe",
            confirmLabel = "Create",
            onDismiss = { addBoxOpen = false },
            onOk = { name ->
                addBoxOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Db.createUnit(name, room.id, null) }
                        onRenamed() // refreshes the shared tick
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                    }
                }
            },
        )
    }
    if (renameOpen) {
        TextPromptDialog(
            title = "Rename room", initial = room.name, confirmLabel = "Rename",
            onDismiss = { renameOpen = false },
            onOk = { name ->
                renameOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Db.renameRoom(room.id, name) }
                        onRenamed()
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                    }
                }
            },
        )
    }
    if (deleteOpen) {
        ConfirmDialog(
            title = "Delete ${room.name}?",
            message = "A room with things inside refuses. Empty it first — or delete everything from the room list.",
        ) {
            deleteOpen = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.deleteRoom(room.id, cascade = false) }
                    onDeleted()
                } catch (e: Exception) {
                    Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

@Composable
fun UnitDetail(
    pad: PaddingValues,
    unit: UnitRow,
    tick: Int,
    onBack: () -> Unit,
    onOpenUnit: (UnitRow) -> Unit,
    onItem: (ItemRow) -> Unit,
    onRename: () -> Unit,
) {
    var children by remember { mutableStateOf<List<UnitRow>>(emptyList()) }
    var itemsHere by remember { mutableStateOf<List<ItemRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var addBoxOpen by remember { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(unit.id, tick) {
        try {
            withContext(Dispatchers.IO) {
                children = Db.units(unit.roomId).filter { it.parentId == unit.id }
                itemsHere = Db.itemsInUnit(unit.id)
            }
        } catch (e: Exception) { error = e.message }
    }

    Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 20.dp)) {
        DetailHeader(unit.name, unit.pathString, onBack)
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { addBoxOpen = true },
                colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                modifier = Modifier.weight(1f),
            ) { Text("+ Box inside") }
            OutlinedButton(onClick = { renameOpen = true }, modifier = Modifier.weight(1f)) { Text("Rename") }
            OutlinedButton(
                onClick = {
                    deleteOpen = true
                },
                modifier = Modifier.weight(1f),
            ) { Text("Delete", color = Danger) }
        }
        error?.let { Text(it, color = Danger, fontSize = 13.sp) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
            if (children.isNotEmpty()) {
                item { SectionLabel("Boxes inside") }
                items(children, key = { it.id }) { u ->
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Paper,
                        shadowElevation = 1.dp,
                        modifier = Modifier.fillMaxWidth().clickable { onOpenUnit(u) },
                    ) {
                        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(painterResource(R.drawable.ic_item_box), contentDescription = null, tint = InkSoft, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(u.name, fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.weight(1f))
                            Text("›", fontSize = 18.sp, color = InkFaint)
                        }
                    }
                }
            }
            item { SectionLabel(if (itemsHere.isEmpty()) "" else "Inside") }
            if (children.isEmpty() && itemsHere.isEmpty()) {
                item { Text("Empty box.", color = InkSoft, modifier = Modifier.padding(vertical = 16.dp)) }
            }
            items(itemsHere, key = { it.id }) { item -> ItemCard(item) { onItem(item) } }
        }
    }

    if (addBoxOpen) {
        TextPromptDialog(
            title = "New box inside ${unit.name}",
            placeholder = "Top shelf",
            confirmLabel = "Create",
            onDismiss = { addBoxOpen = false },
            onOk = { name ->
                addBoxOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Db.createUnit(name, null, unit.id) }
                        onRename() // refresh
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                    }
                }
            },
        )
    }
    if (renameOpen) {
        TextPromptDialog(
            title = "Rename box", initial = unit.name, confirmLabel = "Rename",
            onDismiss = { renameOpen = false },
            onOk = { name ->
                renameOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Db.renameUnit(unit.id, name) }
                        onRename()
                    } catch (e: Exception) {
                        Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                    }
                }
            },
        )
    }
    if (deleteOpen) {
        ConfirmDialog(
            title = "Delete ${unit.name}?",
            message = "Its boxes and things move up one level — nothing loses its place.",
        ) {
            deleteOpen = false
            scope.launch {
                try {
                    withContext(Dispatchers.IO) { Db.deleteUnit(unit.id) }
                    onRename() // refresh
                    onBack()
                } catch (e: Exception) {
                    Toast.makeText(context, e.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    if (text.isNotEmpty()) {
        Text(
            text,
            fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp,
            color = InkFaint,
            modifier = Modifier.padding(top = 8.dp, bottom = 2.dp),
        )
    }
}

// ------------------------------------------------------------ edit + dialogs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditItemSheet(item: ItemRow, onDone: () -> Unit, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(item.name) }
    var qty by remember { mutableStateOf(item.quantity.toString()) }
    var price by remember { mutableStateOf(item.price?.toString() ?: "") }
    var bought by remember { mutableStateOf(item.purchasedOn ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = { if (!busy) onDismiss() }) {
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Edit ${item.name}", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(qty, { qty = it }, label = { Text("How many") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(price, { price = it }, label = { Text("Price ₹ (blank = none)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(bought, { bought = it }, label = { Text("Bought on (YYYY-MM-DD)") },
                modifier = Modifier.fillMaxWidth(), singleLine = true)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
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
                                    purchasedOn = if (date.isEmpty()) null else date,
                                    clearDate = date.isEmpty() && item.purchasedOn != null,
                                )
                            }
                            onDone()
                        } catch (e: Exception) {
                            error = e.message
                        } finally {
                            busy = false
                        }
                    }
                },
                enabled = !busy && name.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
            ) { Text(if (busy) "Saving…" else "Save") }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
fun TextPromptDialog(
    title: String,
    initial: String = "",
    placeholder: String = "",
    confirmLabel: String = "Save",
    onDismiss: () -> Unit,
    onOk: (String) -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value, { value = it },
                placeholder = { Text(placeholder) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(onClick = { if (value.isNotBlank()) onOk(value.trim()) }) { Text(confirmLabel) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String = "Delete",
    onDismissRequest: () -> Unit = {},
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = { Text(title) },
        text = { Text(message, fontSize = 14.sp, color = InkSoft) },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text(confirmLabel, color = Danger, fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismissRequest) { Text("Cancel") } },
    )
}

// ----------------------------------------------------------------- recent

@Composable
fun RecentScreen(pad: PaddingValues, tick: Int) {
    var moves by remember { mutableStateOf<List<MoveRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(tick) {
        try {
            moves = withContext(Dispatchers.IO) { Db.recentMoves() }
        } catch (e: Exception) {
            error = e.message
            moves = emptyList()
        }
    }

    Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 20.dp)) {
        Text("Last put away", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Ink, modifier = Modifier.padding(vertical = 10.dp))
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
        when {
            moves == null -> {}
            moves!!.isEmpty() -> Text("Nothing put away yet.", color = InkSoft, modifier = Modifier.padding(vertical = 32.dp))
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(moves!!) { m ->
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = Paper,
                        shadowElevation = 1.dp,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(m.itemName, fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                                Spacer(Modifier.width(8.dp))
                                Text(kindLabel(m.kind, m.quantity), fontSize = 12.sp, color = InkSoft)
                                Spacer(Modifier.weight(1f))
                                Text(ago(m.movedAt), fontSize = 12.sp, color = InkFaint)
                            }
                            if (m.kind == "moved" && m.fromPath.isNotEmpty()) {
                                Text("from ${m.fromPath}", fontSize = 12.sp, color = InkFaint, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text(
                                if (m.kind == "decluttered") "out of the house" else "→ ${m.toPath}",
                                fontSize = 13.sp, color = Good, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------------- scan

/** What the scanner found: a box with its contents, a choice, or a dead end. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanSheet(result: ScanResult, onDismiss: () -> Unit, onOpenItem: (ItemRow) -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            when (result) {
                is ScanResult.UnitHit -> {
                    Text(result.unit.name, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text(result.unit.pathString, fontSize = 13.sp, color = InkSoft)
                    Text(
                        if (result.contents.isEmpty()) "Nothing inside."
                        else "${result.contents.size} thing(s) inside",
                        fontSize = 13.sp, color = InkSoft,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 430.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 24.dp),
                    ) {
                        items(result.contents) { item ->
                            ItemCard(item) { onOpenItem(item) }
                        }
                    }
                }
                is ScanResult.ItemsHit -> {
                    Text("Same product, several places", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("Pick the one you meant:", fontSize = 13.sp, color = InkSoft)
                    Spacer(Modifier.height(8.dp))
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 430.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 24.dp),
                    ) {
                        items(result.items) { item ->
                            ItemCard(item) { onOpenItem(item) }
                        }
                    }
                }
                is ScanResult.NotFound -> {
                    Text("Nothing has this code", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text(
                        "No storage unit or item matches “${result.code}”. " +
                            "The label may be retired — reissue a code from the web app's Settings.",
                        fontSize = 14.sp, color = InkSoft,
                        modifier = Modifier.padding(vertical = 10.dp),
                    )
                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                    ) { Text("Close") }
                    Spacer(Modifier.height(20.dp))
                }
                is ScanResult.ItemHit -> {
                    // Single items open their card directly; this branch only
                    // exists to keep the when exhaustive.
                    Text(result.item.name, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                }
            }
        }
    }
}
