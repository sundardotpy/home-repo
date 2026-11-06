# Design reference: proposed system (draft)

## Decisions (2026-11-06)

Apply to **both clients**, then fold into `DESIGN.md`.

- **Keep:** warm ground with white cards; Tangerine as the default accent (the other six stay as choices); segmented card rows (this retires the "no cards" rule); big titles with counts; the item detail sheet; the move-to picker; the tag picker with a tray; overflow menus; collapsible sections; the square FAB with a cream nav pill; Settings rows and toggles.
- **Not taken:** breadcrumb text in rows. The **Drawer Path stays** as the location in every row.
- **Out of scope:** priority flags, reminders, deadlines, comments, navigation customisation, upsell surfaces.

Extracted from 21 screenshots of a task app (Android, light mode, "Tangerine"
theme) shared on 2026-11-06. This is a proposal: nothing here is in
`DESIGN.md` until each part is chosen. Colours were sampled from the
full-resolution screenshots (5×5 px averages), so they are close but not
exact.

This takes the patterns and tokens, not the product: no logo, product name,
brand red or upsell surfaces.

## 1. Foundations

### Colour

| Role | Hex | Seen on |
| --- | --- | --- |
| Ground (canvas) | `#F8F7F5` | list background, sheets, top bar: one warm off-white for all three |
| Card (surface) | `#FFFFFF` | every row, field group and menu |
| Well (neutral fill) | `#EEEDEB` | search field, Cancel button, chip tray |
| Pressed / selected row | `#DFDEDC` | current choice in a picker ("Inbox" in Move to) |
| Chip | `#E6E6E6` | label chips in the detail sheet |
| Hairline | `#ECECEC` | dividers inside menus and Settings |
| Scrim | ground at ~30% black | behind sheets |
| Ink | near-black (`#1F1F1F`-ish) | titles, row text |
| Ink muted | `#A8A8A8` | row subtitles, label tokens, "Added on…" |
| Icon idle | `#7A7979` | nav icons, field icons |

**Accent is a family, not one colour** (Tangerine shown):

| Accent role | Hex | Used for |
| --- | --- | --- |
| Fill | `#FEBD61` | FAB, primary button (Save), selected radio |
| On fill | `#1A1209` (near-black) | "+" and "Save" on the fill |
| Container | `#FEF3D5` | active nav pill |
| Strong | `#D68300` | toggle track (on) |
| Ink | `#995E00`–`#A27428` | checked checkbox, active nav label, Settings section headers, "+ Add sub-task" |

**Semantic colours** (independent of the accent):

| Meaning | Hex |
| --- | --- |
| Priority 1 / overdue / danger | `#D2453B` (overdue text `#C65246`) |
| Priority 2 | `#EB8A08` |
| Priority 3 / "in progress" ring | `#236FDF`; selected tint `#E9EFFB`, border `#72A2E5` |
| Priority 4 / default | grey outline |

Project colours are small coloured `#` glyphs only (red, mauve, green,
brown), never fills.

### Type
- Device sans throughout, mostly **regular weight**. Hierarchy comes from size, not bold.
- Screen title ~24 sp regular ("Inbox", "Today"), with an optional count line under it in muted ink ("11 tasks").
- Sheet title ~22 sp regular ("Move to", "Labels", "Priority").
- Detail title ~22 sp medium: the only heavy text on screen.
- Row title ~17 sp regular; meta ~13 sp muted; label tokens ~13 sp muted, as plain words (not chips) in lists.
- Settings section headers ~14 sp in accent ink, sentence case ("Personalization").

### Shape and spacing
- Cards: 12–14 dp corners. Lists are **segmented**: each row is its own white card, with a 2 dp ground gap between rows, and the group's outer corners are rounded.
- Sheets: 28 dp top corners, a 32×4 dp drag handle, and 24 dp side padding for the title.
- FAB: about 64 dp, a **rounded square** (≈20 dp radius), icon only.
- Buttons: 48 dp, fully rounded pills (Cancel neutral well, Save accent fill).
- Chips: 8 dp radius, neutral fill, 36 dp tall.
- Gutters: 12 dp from the card to the screen edge, 16–24 dp inside cards.

### Depth
Flat. Cards sit on the ground with no shadow; the white-on-warm contrast does
the separating. Menus and popovers get a soft shadow. Sheets dim the screen
behind them.

## 2. Components

1. **Segmented row list.** White row cards with 2 dp gaps. Row: a leading 24 dp ring (its colour = priority; blue = started), a title, an optional one-line muted subtitle, and a muted meta line (labels as words, a date in red when overdue, a repeat icon, a sub-count "0/2"). Right-aligned breadcrumb text ("home… / Daily #") marks where it lives.
2. **Section header with an action.** Title left ("Overdue"), a text action in red or accent ("Reschedule"), and a collapse chevron on the right.
3. **Screen header.** Large regular title, a count subtitle, and trailing icon buttons (view options, overflow).
4. **Detail sheet** (full-height bottom sheet):
   - A breadcrumb chip at the top ("Inbox ›") that opens the move picker, and an overflow on the right.
   - A title card: a ring and a large title.
   - **Property rows**, one white card each, with a leading icon and the value or a muted placeholder: description, date, priority (flag in its colour), labels (chips).
   - A horizontally scrolling row of **tonal pill actions** (Reminders, Deadline, Locations, Move to…).
   - "+ Add sub-task": a centred text button in accent ink on a white card.
   - A **sticky composer** at the bottom: a pill field ("Add a comment") with an attach button.
5. **Move-to picker sheet.** A search well, then a nested list: the current place highlighted with the pressed fill; groups (projects with a coloured `#`) and children (sections) indented one step with their own icon.
6. **Multi-select picker sheet** (Labels). A **tray** of chosen chips at the top in a well, then rows with a tag icon and a square checkbox (accent ink when checked), and a footer with Cancel (neutral) and Save (accent fill) on the right.
7. **Segmented choice cards** (Priority). Four equal cards in a row, each with an icon and a label; the chosen one gets a tint and a 1 dp border in the choice's own colour.
8. **Overflow menus.** Two kinds: a popover card anchored top-right (icon + label rows, hairline between groups), or a bottom-sheet menu with a muted metadata header ("Added on 1 Oct 12:51 PM").
9. **Explainer card.** A neutral-well card with a coloured badge icon, a bold line, body copy, and an optional accent text action. (Used there for upsells; it could carry tips or notices.)
10. **Navigation bar.** Five destinations; the active one gets a container pill behind its icon and an accent-ink label. Badge dots for news. The FAB floats above the bar, on the right.
11. **Hub screen** (Browse). A profile row with actions, an explainer card, a grouped menu card (Search, Reporting, More) with **accent-coloured icons**, then a collapsible "My Projects" group with right-aligned counts.
12. **Settings.** Full-bleed white rows (not cards) under a warm top bar. Leading outline icons, two-line rows (title + muted value), accent section headers, hairlines between sections. Toggles: accent track with a black thumb when on, outlined when off. Danger rows have a red icon.
13. **Theme cards.** A miniature row preview on top and the theme name in its own colour on a tinted footer, with a check for the chosen one.
14. **Navigation customisation.** FAB placement (left, centre, right) as phone miniatures with radios, a reorderable destination list with drag handles, and an outlined "Restore defaults".

## 3. How it lines up with h/repo today

| Topic | h/repo now (`DESIGN.md`) | Reference |
| --- | --- | --- |
| Ground | cool sea-glass `#F4F7F6` | warm off-white `#F8F7F5` |
| Rows | plain rows on the ground, **no cards** (a named rule) | segmented white cards |
| Default accent | deep teal; Tangerine is one of 7 choices | Tangerine family (fill, container, ink) |
| Location in a row | **Drawer Path** (spine + tabs): the signature | right-aligned breadcrumb text |
| FAB | extended, with a label ("Add") | icon-only rounded square |
| Active nav | mist tonal pill | accent container pill + accent label |
| Section titles | title-small, muted | larger, with an action and a collapse |
| Settings | choice cards in a list | full-bleed rows, accent section headers, toggles |
| Pickers | Move and Tags exist as sheets | search + nested list; chip tray + Save/Cancel |
| Item sheet | name, path, fields | property rows with icons, pill actions, sticky composer |
| Shadows | none on custom surfaces | none on cards; soft on menus |
| Type | stock Material roles, device sans | same family, more regular weights |

Natural fits for a home inventory: the item detail sheet (as property rows:
place, quantity, tags, price, brand), the move picker (rooms → boxes is
exactly the nested list), the tag picker with a tray, collapsible sections
with counts on Places, the hub-style Settings, and explainer cards for
notices.

Weak fits: priority flags, reminders/deadlines, comments, sub-tasks (except
as "things inside this thing"), and navigation customisation.
