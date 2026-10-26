package app.homerepo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/** Every icon a thing or room can wear: the line set first, then brand marks. */
private val AllIcons: List<Pair<String, Int>> =
    ItemIcons.items.toList() + ItemIcons.brands.map { (k, v) -> "brand:$k" to v }

/** The drawable for a stored icon key ("hammer", "brand:sony"), or null for none. */
fun iconRes(key: String): Int? =
    if (key.startsWith("brand:")) ItemIcons.brands[key.removePrefix("brand:")] else ItemIcons.items[key]

private fun iconLabel(key: String) = key.removePrefix("brand:").replaceFirstChar { it.uppercase() }

/** A searchable grid of icons; "No icon" goes back to the letter on its tint. */
@Composable
fun IconPickerSheet(title: String, current: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    val q = query.trim()
    val shown = remember(q) { AllIcons.filter { q.isEmpty() || iconLabel(it.first).contains(q, ignoreCase = true) } }

    Sheet(onDismiss, scroll = false) {
        SheetTitle(title)
        OutlinedTextField(
            query, { query = it },
            placeholder = { Text("Search icons: hammer, sony, box…") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        if (shown.isEmpty()) {
            Text("No icon called “$q”.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LazyVerticalGrid(
            columns = GridCells.Adaptive(68.dp),
            modifier = Modifier.heightIn(max = 460.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (q.isEmpty()) item(key = "none") { IconCell(null, "No icon", current.isEmpty()) { onPick("") } }
            items(shown, key = { it.first }) { (key, res) -> IconCell(res, iconLabel(key), current == key) { onPick(key) } }
        }
    }
}

@Composable
private fun IconCell(res: Int?, label: String, selected: Boolean, onClick: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Column(
        Modifier
            .clip(MaterialTheme.shapes.medium)
            .then(if (selected) Modifier.border(BorderStroke(2.dp, c.primary), MaterialTheme.shapes.medium) else Modifier)
            .clickable(onClick = onClick)
            .semantics { this.selected = selected }
            .padding(vertical = 8.dp, horizontal = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            Modifier.size(44.dp).background(if (selected) c.secondaryContainer else c.surfaceContainerHigh, MaterialTheme.shapes.small),
            contentAlignment = Alignment.Center,
        ) {
            if (res != null) Icon(painterResource(res), contentDescription = null, modifier = Modifier.size(24.dp))
            else Icon(Icons.Outlined.Block, contentDescription = null, tint = c.onSurfaceVariant)
        }
        Text(label, style = MaterialTheme.typography.labelSmall, color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
