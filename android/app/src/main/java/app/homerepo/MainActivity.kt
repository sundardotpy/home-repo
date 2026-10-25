// Home Repo for Android. One database, two clients: the phone talks straight
// to Postgres, so what it writes is what the web app shows on its next read.

package app.homerepo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

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

        setContent { HrepoTheme { App(prefs) } }
    }
}
