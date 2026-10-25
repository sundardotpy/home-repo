# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

Scope note: this record covers the native Android client in `android/`. The web
app (`internal/web/`) is a separate surface with its own incumbent look.

## Users

The household, phone in hand at home: finding where a thing is, putting
something away, scanning a box label, or saying "Helmet is in living room".
Quick, one-handed, glanceable lookups; sessions are seconds long.

## Product Purpose

Know what you own and where it is. Every lookup answers with the full location
path (`Bedroom > Wardrobe > Top Shelf > Blue Box`). Success is finding a thing
faster than walking around looking for it, and recording a move faster than
forgetting it.

## Positioning

Nesting is unlimited and exact: rooms hold storage units, units nest, items
nest inside items, and every answer is a full path. The Android app talks to
the same Postgres database as the web app directly, so both clients are always
the same story with no sync layer.

## Operating Context

- At home, standing at a cupboard or holding the thing; often one hand free.
- Printed QR labels on boxes; scanning one opens what is inside.
- Voice: the phone's own speech dialog, then one explicit Yes before anything changes.
- House Shift (packing for a move) runs on the web; the phone only shows that it is on.

## Capabilities and Constraints

Kept in the rebuild (user-confirmed: all features stay):

- Home: search, every active item newest first, filters (Your things / Decluttered / All).
- Places: rooms → storage units (nested) → items; create, rename, delete rooms and units.
- Recent: the move/add/declutter history.
- Item actions: add (bought), move (to room, unit, or inside another item; cycles refused),
  +1 quantity, declutter / restore, edit, delete.
- Scan QR labels and product barcodes; voice-to-action; House Shift banner; connection settings.
- Data layer: direct Postgres over JDBC (`Db.kt`), same schema and invariants as the server.
  Credentials entered in-app; the scoped role is `docs/android-role.sql`.
- Build: Kotlin, Jetpack Compose, Material 3, JDK 21 toolchain; latest stable libraries.
- Online-first: no offline write queue (spec §7).

## Brand Commitments

- Name and wordmark: "h/repo" (Home Repo).
- Copy voice: plain and direct, e.g. "Where did I put it?", "Move it", "Decluttered — out of the house, kept in the record."

## Product Principles

1. The answer is a path: always show where, all the way down.
2. Nothing changes without an explicit yes.
3. One hand, a few seconds: the common job never needs more than two taps after opening.
4. One database, two clients: the phone never invents state the web would not show.

## Accessibility & Inclusion

No product-specific standard set; follow platform defaults (TalkBack labels,
48dp targets, font scaling, sufficient contrast in light and dark).
