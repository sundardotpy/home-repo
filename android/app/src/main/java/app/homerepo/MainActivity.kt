// Home Repo for Android. One database, two clients: the phone talks straight
// to Postgres, so what it writes is what the web app shows on its next read.

package app.homerepo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import android.graphics.Color
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("homerepo", MODE_PRIVATE)
        val builtIn = Profile.fromUrl(BuildConfig.DB_URL)
        if (builtIn != null) {
            Db.profile = builtIn
            Db.builtIn = true
        } else if (prefs.contains("host")) {
            Db.profile = Profile(
                host = prefs.getString("host", "")!!,
                port = prefs.getInt("port", 5432),
                database = prefs.getString("database", "")!!,
                user = prefs.getString("user", "")!!,
                password = prefs.getString("password", "")!!,
                ssl = prefs.getBoolean("ssl", true),
            )
        }

        // With a database on file, open it now instead of when the first
        // query runs: driver class loading plus the connection handshake
        // happen while Compose draws, and the Find screen's reads then land on
        // a live socket. Every activity start warms it again, which is what
        // keeps the connection fresh across returns to the app.
        if (Db.profile != null) {
            lifecycleScope.launch(Dispatchers.IO) {
                runCatching { Db.warmup() }
            }
        }

        val appearance = Appearance(prefs)
        setContent {
            HrepoTheme(appearance) {
                // System bar icons follow the app's chosen mode, not only the phone's.
                val dark = appearance.isDark()
                DisposableEffect(dark) {
                    enableEdgeToEdge(
                        statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
                        navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
                    )
                    onDispose {}
                }
                App(prefs)
            }
        }
    }
}
