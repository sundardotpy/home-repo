package app.homerepo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** First run: where the household database lives. */
@Composable
fun ConnectionScreen(prefs: android.content.SharedPreferences, onConnected: () -> Unit) {
    val scope = rememberCoroutineScope()
    var host by remember { mutableStateOf(prefs.getString("host", "") ?: "") }
    var port by remember { mutableStateOf(prefs.getInt("port", 5432).toString()) }
    var database by remember { mutableStateOf(prefs.getString("database", "") ?: "") }
    var user by remember { mutableStateOf(prefs.getString("user", "") ?: "") }
    var password by remember { mutableStateOf(prefs.getString("password", "") ?: "") }
    var ssl by remember { mutableStateOf(prefs.getBoolean("ssl", true)) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun connect() {
        busy = true
        error = null
        scope.launch {
            try {
                val p = Profile(host.trim(), port.trim().toIntOrNull() ?: 5432, database.trim(), user.trim(), password, ssl)
                withContext(Dispatchers.IO) {
                    Db.profile = p
                    try { Db.defaultUserId() } catch (e: Exception) { Db.profile = null; throw e }
                }
                prefs.edit {
                    putString("host", p.host); putInt("port", p.port)
                    putString("database", p.database); putString("user", p.user)
                    putString("password", p.password); putBoolean("ssl", p.ssl)
                }
                onConnected()
            } catch (e: Exception) {
                error = e.message ?: "Couldn't connect"
            } finally {
                busy = false
            }
        }
    }

    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxSize()) {
        Column(
            Modifier.safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(16.dp))
            Text("h/repo", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
            Text(
                "Connect to your household database. Both the phone and the web app use the same one, " +
                    "so what you change here shows up there.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            val field = Modifier.fillMaxWidth()
            val next = KeyboardOptions(imeAction = ImeAction.Next)
            OutlinedTextField(host, { host = it }, label = { Text("Host") }, modifier = field, singleLine = true,
                keyboardOptions = next.copy(keyboardType = KeyboardType.Uri))
            OutlinedTextField(port, { port = it }, label = { Text("Port") }, modifier = field, singleLine = true,
                keyboardOptions = next.copy(keyboardType = KeyboardType.Number))
            OutlinedTextField(database, { database = it }, label = { Text("Database") }, modifier = field, singleLine = true, keyboardOptions = next)
            OutlinedTextField(user, { user = it }, label = { Text("User") }, modifier = field, singleLine = true, keyboardOptions = next)
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, modifier = field, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Encrypted connection", style = MaterialTheme.typography.bodyLarge)
                    Text("Keep on for a hosted database; off for one on this network.",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = ssl, onCheckedChange = { ssl = it })
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Button(
                onClick = { connect() },
                enabled = !busy && host.isNotBlank() && database.isNotBlank() && user.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text(if (busy) "Connecting…" else "Connect") }
        }
    }
}

/** Which database this phone uses, and the way out of it. */
@Composable
fun SettingsScreen(prefs: android.content.SharedPreferences, onBack: () -> Unit, onForget: () -> Unit) {
    val ui = LocalUi.current
    val p = Db.profile
    var confirmForget by remember { mutableStateOf(false) }

    ScreenScaffold(title = "Connection", onBack = onBack) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState())) {
            if (p != null) {
                ListItem(headlineContent = { Text(p.database) }, supportingContent = { Text("Database") })
                ListItem(headlineContent = { Text("${p.host}:${p.port}") }, supportingContent = { Text("Host") })
                ListItem(headlineContent = { Text(p.user) }, supportingContent = { Text("User") })
                ListItem(
                    headlineContent = { Text(if (p.ssl) "Encrypted" else "Not encrypted") },
                    supportingContent = { Text("Connection") },
                )
            }
            Text(
                (if (Db.builtIn) "Built into this app. " else "") +
                    "The phone and the web app share this database. The last change wins, so both always show the same thing.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp),
            )
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { ui.done("Reloaded") }, modifier = Modifier.fillMaxWidth()) { Text("Reload everything") }
                if (!Db.builtIn) {
                    OutlinedButton(onClick = { confirmForget = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Disconnect this phone", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }

    if (confirmForget) {
        ConfirmDialog(
            title = "Disconnect this phone?",
            message = "The saved connection details are removed from this phone. Nothing in the database changes.",
            confirmLabel = "Disconnect",
            onDismiss = { confirmForget = false },
        ) {
            confirmForget = false
            prefs.edit { clear() }
            Db.profile = null
            onForget()
        }
    }
}
