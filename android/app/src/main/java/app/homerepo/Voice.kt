package app.homerepo

// Voice-to-action, ported from the web (voice-parse.js, voice.js): parse a
// transcript, match both halves against the household, and let the sheet
// confirm. test/voice-cases.tsv keeps the two parsers in step.

sealed interface Parsed {
    data object Empty : Parsed
    data object Ambiguous : Parsed
    data class Move(val item: String, val place: String) : Parsed
}

private val I = RegexOption.IGNORE_CASE
private val PREP = Regex("""\s+(?:in|into|inside|at|to)\s+""", I)
private val VERB = Regex("""^(?:is|are|was|goes|went)$""", I)
private val IS = Regex("""^(.+?)\s+(?:is|are|was|goes|went)\s+(?:in|inside|at|into)\s+(.+)$""", I)
private val POLITE = Regex("""^(?:please|can you|could you)\s+""", I)
private val ACTION = Regex("""^(?:put|move|place|keep|drop|shelve|file)\s+""", I)
private val ARTICLE = Regex("""^(?:the|a|an|my|our)\s+""", I)
private val TRAILING = Regex("""[.!?,;]+$""")

/** "please put the helmet in the living room" → Move("helmet", "living room"). */
fun parseUtterance(text: String): Parsed {
    var s = text.trim().replace(Regex("""\s+"""), " ")
    if (s.isEmpty()) return Parsed.Empty
    s = s.replace(POLITE, "").replace(ACTION, "")

    fun finished(a: String, b: String): Parsed {
        val item = clean(a)
        val place = clean(b)
        // "is in the kitchen" has no item: a bare verb is not a name.
        return if (item.isEmpty() || place.isEmpty() || VERB.matches(item)) Parsed.Ambiguous
        else Parsed.Move(item, place)
    }

    IS.find(s)?.let { return finished(it.groupValues[1], it.groupValues[2]) }
    // Split on the LAST preposition, so "tool box in drawer" keeps the item whole.
    val last = PREP.findAll(s).lastOrNull() ?: return Parsed.Ambiguous
    return finished(s.substring(0, last.range.first), s.substring(last.range.last + 1))
}

private fun clean(s: String) = s.replace(ARTICLE, "").replace(TRAILING, "").trim()

/** Where a thing can go: a room, a storage unit, or another item. */
data class Target(val kind: Kind, val id: String, val name: String, val sub: String = "") {
    enum class Kind { ROOM, UNIT, CONTAINER }
}

/** Both halves matched; each list is empty (missing), one (found) or several (choose). */
data class Matches(val items: List<ItemRow>, val places: List<Target>)

/** Same ladder as the web: exact name before contains; rooms, then units, then items. */
fun matchUtterance(move: Parsed.Move): Matches {
    val itemHits = Db.items(move.item).let { all ->
        all.filter { it.name.equals(move.item, ignoreCase = true) }.ifEmpty { all }.take(8)
    }
    return Matches(itemHits, findPlace(move.place))
}

private fun findPlace(q: String): List<Target> {
    fun <T> one(list: List<T>, name: (T) -> String): T? =
        list.singleOrNull { name(it).equals(q, ignoreCase = true) }
            ?: list.singleOrNull { name(it).contains(q, ignoreCase = true) }

    one(Db.rooms()) { it.name }?.let { return listOf(Target(Target.Kind.ROOM, it.id, it.name)) }
    one(Db.units()) { it.name }?.let { return listOf(Target(Target.Kind.UNIT, it.id, it.name, it.pathString)) }
    return Db.items(q)
        .filter { it.name.contains(q, ignoreCase = true) }
        .take(8)
        .map { Target(Target.Kind.CONTAINER, it.id, it.name, it.path) }
}

/** Moves an existing item, or adds a new one, into the target. */
fun applyVoice(item: ItemRow?, newItemName: String, target: Target) {
    val room = target.id.takeIf { target.kind == Target.Kind.ROOM }
    val unit = target.id.takeIf { target.kind == Target.Kind.UNIT }
    val container = target.id.takeIf { target.kind == Target.Kind.CONTAINER }
    if (item != null) Db.moveItem(item.id, room, unit, container)
    else Db.addItem(AddItem(name = newItemName, roomId = room, unitId = unit, parentItemId = container))
}
