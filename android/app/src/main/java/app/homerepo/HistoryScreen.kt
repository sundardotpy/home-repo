package app.homerepo

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.Outbox
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private fun dayLabel(ms: Long): String {
    val zone = ZoneId.systemDefault()
    val day = Instant.ofEpochMilli(ms).atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    return when (day) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> day.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    }
}

private fun timeLabel(ms: Long): String =
    Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalTime()
        .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))

@Composable
fun HistoryScreen() {
    val ui = LocalUi.current
    val scope = rememberCoroutineScope()
    var moves by remember { mutableStateOf<List<MoveRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var detail by remember { mutableStateOf<ItemRow?>(null) }

    LaunchedEffect(ui.tick) {
        error = null
        try {
            moves = withContext(Dispatchers.IO) { Db.recentMoves(100) }
        } catch (e: Exception) {
            error = e.message ?: "Couldn't reach the database"
        }
    }

    ScreenScaffold(title = "History") { pad ->
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 24.dp),
        ) {
            if (moves == null && error == null) item { LinearProgressIndicator(Modifier.fillMaxWidth().padding(16.dp)) }
            error?.let { item { Notice("Couldn't load history", it) { FilledTonalButton(onClick = { ui.refresh() }) { Text("Try again") } } } }
            if (moves?.isEmpty() == true) {
                item { Notice("Nothing yet", "Every add, move and declutter shows up here, newest first.") }
            }
            moves.orEmpty().groupBy { dayLabel(it.movedAt) }.forEach { (day, rows) ->
                item(key = "h$day") { SectionTitle(day) }
                items(rows, key = { it.itemId + it.movedAt + it.kind }) { m ->
                    HistoryRow(m) {
                        scope.launch {
                            try {
                                detail = withContext(Dispatchers.IO) { Db.item(m.itemId) }
                            } catch (e: Exception) { ui.say(e.message ?: "That thing is gone") }
                        }
                    }
                }
            }
        }
    }

    detail?.let { ItemSheet(it, onDismiss = { detail = null }) }
}

@Composable
private fun HistoryRow(m: MoveRow, onClick: () -> Unit) {
    val (icon, verb) = when (m.kind) {
        "added" -> Icons.Outlined.AddCircleOutline to (if ((m.quantity ?: 0) > 1) "Added ×${m.quantity}" else "Added")
        "decluttered" -> Icons.Outlined.Outbox to "Decluttered"
        else -> Icons.Outlined.SwapHoriz to "Moved"
    }
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    m.itemName, style = MaterialTheme.typography.titleMedium,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
                Text(timeLabel(m.movedAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                if (m.kind == "moved" && m.fromPath.isNotEmpty()) "$verb from ${pathParts(m.fromPath).joinToString(" › ")}" else verb,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            if (m.kind == "decluttered") {
                Text("Out of the house, kept in the record", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                DrawerPath(m.toPath)
            }
        }
    }
}
