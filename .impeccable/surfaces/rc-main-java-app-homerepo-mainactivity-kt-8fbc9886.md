---
version: 1
slug: "rc-main-java-app-homerepo-mainactivity-kt-8fbc9886"
primary_target: "android/app/src/main/java/app/homerepo/MainActivity.kt"
related_targets: ["android/app/src/main/java/app/homerepo"]
---

# Android app (all screens)

Scope: the native Android client in `android/`, every screen. Mode: Operate.
Audience and job: the household, one-handed at home, finding where a thing is or recording that it moved, in seconds.
Constraints: every existing feature stays; Material 3 components and native controls only; direct Postgres via Db.kt.
Unresolved: none.

## Direction contract

THESIS: Every place is a frosted drawer you can see into, and a location path is the stack of drawers. Refuses the category default of a grey list with the path as a faint subtitle.

OWN-WORLD: Frosted pale-sea-glass ground, deep teal primary spent only on the one main action per screen, room tints (seafoam, amber, rose, lavender, sky, sage) as tonal tag colours. Drawer tabs: same-height translucent pills, white slip-label inner tabs. The device system sans at Material roles (Roboto on stock Android, the maker face elsewhere), so the app follows the user own font and size; scale contrast, not boxes, carries hierarchy.

STORY: The visitor sees their things with where each one lives, finds one by typing, speaking or scanning, and moves or adds it with one explicit yes.

FIRST VIEWPORT: Find tab. Small top bar (h/repo, settings). Full-width search bar with mic and scan. "Put away today" when anything moved today, then "Your things": rows of avatar, item name (title), drawer-tab stack down a left spine. Extended FAB "Add" bottom right. Nav bar: Find, Places, History. Signature move: the drawer-tab stack; opening a place slides its drawer out (shared-axis).
Raises: one spine (labanotation); fixed tab scale (botanical folio); one accent (monochrome canon); size-only hierarchy (type specimen); one item per sheet (vertical feed).

FORM: Clear Drawers, candidate 7 of 7 on the grounded list. seed:ae8098fb7fe952f2

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
