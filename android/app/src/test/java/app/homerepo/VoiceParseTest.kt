package app.homerepo

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The web's parser cases (test/voice-cases.tsv), run against the Kotlin port. */
class VoiceParseTest {
    @Test
    fun matchesTheSharedCaseTable() {
        // Unit tests run from android/app; the table lives in the repo's test/.
        val cases = File("../../test/voice-cases.tsv").readLines()
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .map { it.split("\t") }
        assertTrue(cases.size > 10)
        for ((transcript, kind, item, place) in cases) {
            val expected = when (kind) {
                "move" -> Parsed.Move(item, place)
                "ambiguous" -> Parsed.Ambiguous
                else -> Parsed.Empty
            }
            assertEquals(transcript, expected, parseUtterance(transcript))
        }
    }
}
