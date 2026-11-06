---
name: h/repo
description: Warm Drawers. White cards on a warm ground, one tangerine action per screen, and every location drawn as a stack of drawers.
colors:
  tangerine: "#FEBD61"
  on-tangerine: "#1A1C1E"
  tangerine-ink: "#8F5A00"
  tangerine-tonal: "#F9EBD5"
  shift-amber: "#F6E0B5"
  on-shift-amber: "#261A00"
  warm-ground: "#F8F7F5"
  card: "#FFFFFF"
  ink: "#1F1E1D"
  ink-muted: "#6C6A67"
  well: "#EEEDEB"
  pressed: "#DFDEDC"
  status-well: "#E8E7E4"
  outline: "#7A7876"
  hairline: "#DCDAD6"
  error: "#B3261E"
  tangerine-ink-dark: "#FED498"
  warm-ground-dark: "#161514"
  card-dark: "#242321"
  ink-dark: "#E8E6E3"
  ink-muted-dark: "#C4C1BC"
  well-dark: "#2C2A28"
  hairline-dark: "#3D3B38"
  room-seafoam: "#CDEBE1"
  on-room-seafoam: "#0F3D33"
  room-amber: "#F6E0B5"
  on-room-amber: "#4A3405"
  room-rose: "#F6D3DA"
  on-room-rose: "#5A1D2B"
  room-lavender: "#DED8F5"
  on-room-lavender: "#2E2463"
  room-sky: "#D3E5F6"
  on-room-sky: "#12344F"
  room-sage: "#DCE6CF"
  on-room-sage: "#2C3A1C"
  room-seafoam-dark: "#24453C"
  on-room-seafoam-dark: "#C6EBDD"
  room-amber-dark: "#4A3A16"
  on-room-amber-dark: "#F6E0B5"
  room-rose-dark: "#52303A"
  on-room-rose-dark: "#F6D3DA"
  room-lavender-dark: "#3A3458"
  on-room-lavender-dark: "#DED8F5"
  room-sky-dark: "#2A3D52"
  on-room-sky-dark: "#D3E5F6"
  room-sage-dark: "#38432B"
  on-room-sage-dark: "#DCE6CF"
typography:
  display-small:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: "44px"
  headline-small:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "32px"
  title-large:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
  title-medium:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0.15px"
  title-small:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0.1px"
  body-large:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0.5px"
  body-medium:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0.25px"
  label-large:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0.1px"
  label-medium:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.5px"
  label-small:
    fontFamily: "system-ui, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.5px"
rounded:
  extra-small: "6px"
  small: "10px"
  medium: "14px"
  large: "20px"
  extra-large: "28px"
  full: "9999px"
spacing:
  tab-stack-gap: "3px"
  status-pad-x: "6px"
  spine-gap: "8px"
  tab-pad-x: "9px"
  tab-indent: "10px"
  row-pad-y: "12px"
  row-gap: "14px"
  gutter: "16px"
  card-inset: "12px"
  segment-gap: "2px"
  segment-outer: "14px"
  segment-inner: "4px"
  section-top: "12px"
  tab-height: "22px"
  spine-width: "2px"
  avatar: "40px"
  action-height: "52px"
  field-height: "56px"
  fab-clearance: "96px"
components:
  button-primary:
    backgroundColor: "{colors.tangerine}"
    textColor: "{colors.on-tangerine}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "52px"
  fab:
    backgroundColor: "{colors.tangerine}"
    textColor: "{colors.on-tangerine}"
    rounded: "{rounded.large}"
    size: "56px"
  button-tonal:
    backgroundColor: "{colors.tangerine-tonal}"
    textColor: "{colors.ink}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "52px"
  button-cancel:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "48px"
  list-row-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.medium}"
    padding: "12px 16px"
  pill-action:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "44px"
  menu-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "16px"
  search-field:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.extra-large}"
    height: "56px"
  filter-chip-selected:
    backgroundColor: "{colors.tangerine-tonal}"
    textColor: "{colors.ink}"
    typography: "{typography.label-large}"
    rounded: "{rounded.small}"
  nav-indicator:
    backgroundColor: "{colors.tangerine-tonal}"
    textColor: "{colors.tangerine-ink}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.full}"
  drawer-tab-room:
    backgroundColor: "{colors.room-seafoam}"
    textColor: "{colors.on-room-seafoam}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.extra-small}"
    padding: "1px 9px"
    height: "22px"
  drawer-tab-slip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.extra-small}"
    padding: "1px 9px"
    height: "22px"
  item-avatar:
    backgroundColor: "{colors.room-sky}"
    textColor: "{colors.on-room-sky}"
    rounded: "{rounded.medium}"
    size: "40px"
  room-swatch:
    backgroundColor: "{colors.room-sage}"
    textColor: "{colors.on-room-sage}"
    typography: "{typography.title-medium}"
    rounded: "{rounded.small}"
    size: "40px"
  status-label:
    backgroundColor: "{colors.status-well}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-small}"
    rounded: "{rounded.extra-small}"
    padding: "2px 6px"
  shift-notice:
    backgroundColor: "{colors.shift-amber}"
    textColor: "{colors.on-shift-amber}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.medium}"
    padding: "12px 14px"
---

# Design System: h/repo (Android)

> **Scope.** This file covers both clients: the native Android app (`android/`, Jetpack Compose + Material 3) and the web app (`internal/web/`, ES modules + Tailwind). Every rule applies to both. Where the web differs, [Web client](#web-client) says how and why. Android sizes are in dp and sp; on the web, one dp is one CSS px and type roles are set in rem.

## Overview

**Creative North Star: "Warm Drawers"**

Every place is a drawer, and a location path is the stack of drawers. The ground is a warm off-white, and everything you act on sits on it as a white card: list rows, sheet properties, settings bands. Colour belongs to rooms: each room carries one of six soft tints. One accent family is the only loud colour, Tangerine by default or whichever of seven the user picks in Settings. Its fill marks the one main action on each screen, and its darker ink marks accent text. The category default is a grey list with the path as a faint subtitle. This system turns that path into the picture itself: a short stack of same-height tabs hanging from one thin spine.

The world is Material 3 tuned rather than replaced. Scheme roles, shapes, motion and navigation come from the platform. Character comes from the warm palette, segmented white cards, and drawer geometry repeated at every scale (list row, place header). Hierarchy comes from Material type size, mostly regular weight, in the device's own sans, so the app follows the user's font and font-size settings. The density is calm: one item per row, 12dp from the screen edge to a card and 16dp inside it, and enough room under the list for the FAB.

The patterns came from a reference set of task-app screenshots (see `docs/design-reference-proposal.md`): the layout and token ideas, never another product's branding.

**Key Characteristics:**
- A warm ground with white cards on it, in light and dark. Cards cast no shadow; only menus, sheets and the FAB lift.
- Segmented lists: every row is its own card, 2dp from its neighbour, with only the group's outer corners fully rounded.
- One accent family per screen: the fill (Tangerine `#FEBD61`) on the FAB and the confirm button, its ink (`#8F5A00`) for text, checkboxes, switches and the active tab, and a tonal mix for the active tab's pill and selected chips.
- Big regular titles on destinations, with a muted count line under them ("3 rooms · 37 things").
- Sections fold: a title with its count and a chevron.
- Light, Dark, or System (follow the phone), chosen in Settings and saved on the device.
- Six room tints (seafoam, amber, rose, lavender, sky, sage). Each is a light/dark tonal pair, picked by a hash of the room name.
- The drawer path is the signature: one spine, fixed 22dp tabs, a tinted room tab, and white slip-label inner tabs.
- The device's system sans at stock Material roles. No bundled font.
- Two motions only: a shared-axis Y "drawer pull" into and out of places, and a fade-through everywhere else.

## Colors

The palette is a warm, low-chroma neutral set, plus one accent family (Tangerine by default, six others to choose from) and six pastel room tints that each carry their own ink.

### Primary
- **Tangerine** (`tangerine` / `on-tangerine`): the fill of the one main action on a screen. That means the FAB, the filled confirm button in a sheet (Move, Save, Yes, Go, Restore, Download my data), and the main pill action in the item sheet. Nothing decorative uses it. In Compose it is `primaryContainer`; on the web, `--accent`.
- **Tangerine Ink** (`tangerine-ink`; dark `tangerine-ink-dark`): the accent as text and as small controls: text buttons, checked checkboxes, switches, focus rings, the active tab's icon and label, and Settings section headers. In Compose it is `primary`; on the web, `--accent-ink`. A light fill can't be text (Tangerine on white is 1.7:1), so the ink is a separate, saturated colour at 5.8:1, not the fill darkened, which goes muddy.
- **Tangerine Tonal** (`tangerine-tonal`): the fill mixed into the ground. It fills the active tab's pill, the selected filter chip, and tonal buttons. In Compose it is `secondaryContainer`; on the web, `--accent-tonal`.

### User choices

Settings offers the theme mode and the accent as cards, each a miniature of the app drawn from the real colour scheme it stands for.

- **Theme mode:** System (follows the phone; its card is split half light, half dark), Light, or Dark. The status and navigation bar icons follow the chosen mode, not only the phone.
- **Accent:** one exact fill per choice, with white or near-black (#1A1C1E) on it, whichever has more contrast. Its ink is named for a light fill (Tangerine) or else the fill stepped toward black until it reads at 4.5:1 on a card. In dark mode the fill stays, and the ink is the fill lifted 35% toward white (stepped further if needed). The tonal is the fill mixed into the ground (20% light, 30% dark). The ground, the neutrals and the room tints never change; they carry the drawers.

| Accent | Fill | Ink on fill | Light ink |
| --- | --- | --- | --- |
| Tangerine (default) | #FEBD61 | #1A1C1E | #8F5A00 |
| Sea glass | #0E5E58 | white | the fill |
| Moonstone | #4A5462 | white | the fill |
| Kale | #4B7A45 | white | the fill |
| Blueberry | #3569BA | white | the fill |
| Lavender | #756BBD | white | the fill |
| Raspberry | #CA4F71 | white | the fill (known limit: 4.3:1 for small text) |

Both choices are stored on the device (`theme_mode`, `accent` in the app's preferences; `hsh.theme`, `hsh.accent` in the browser) and apply the moment they change. A device that never chose gets Tangerine.

### Tertiary
- **Shift Amber** (`shift-amber` / `on-shift-amber`): the tertiary container. Its only use is the House Shift notice under the top bar, the one system-wide status the app has to raise.

### Room tints
- **Seafoam, Amber, Rose, Lavender, Sky, Sage** (`room-*` / `on-room-*`, with `-dark` pairs): one tint per room. It fills the room's drawer tab, its swatch on Places, and every item avatar in that room. Each container comes with a matched ink. Never set default ink on a tint.

### Neutral
- **Warm Ground** (`warm-ground`; dark `warm-ground-dark`): background, surface, top bar, navigation bar and bottom sheets. The launch window uses the same value, so nothing flashes before Compose draws.
- **Card** (`card`; dark `card-dark`): `surface-container-lowest`. Every list row, sheet property, title card, menu and Settings band, and the inner drawer tabs. In dark mode the card is one step lighter than the ground, as white is in light mode.
- **Ink** (`ink`) and **Muted Ink** (`ink-muted`): primary text, and secondary text (subtitles, counts, placeholders, field icons). Muted ink stays at 5:1 on the ground; the reference's lighter greys were too faint to read.
- **Well** (`well`): the neutral fill for the search field, Cancel buttons, pill actions and the tag tray.
- **Pressed** (`pressed`): the current choice in a picker ("Here now").
- **Status Well** (`status-well`): the Decluttered label and tag chips.
- **Hairline** (`hairline`): outline-variant. Used for the drawer spine, tab borders (at 70% alpha), menu and Settings dividers, and outlined strokes.
- **Error** (`error`): destructive text actions, Delete in menus, and the Declutter confirm button.

### Named Rules
**The One Accent Rule.** Each screen has at most one action in the accent fill: the FAB on a list, the filled confirm in a sheet, the main pill in the item sheet. Everything else is tonal, a neutral well, outlined, or a text button in accent ink.

**The Room Owns Its Colour Rule.** Tints identify rooms and never encode status or emphasis. An item's avatar, its room tab and its room's swatch always share one tint.

**The Own Palette Rule.** Dynamic (wallpaper) colour is deliberately off. The palette is the app's identity, and a room's tint has to stay stable from one launch to the next.

## Typography

**Display Font:** the device system sans (Roboto on stock Android, the maker's face elsewhere)
**Body Font:** the same
**Label/Mono Font:** the same; no mono

**Character:** One family at stock Material 3 roles (`Typography()` defaults, sizes in sp). The type follows the user's font and size choice, so size and weight carry the hierarchy, not new faces. One px in the frontmatter equals one sp on device.

### Hierarchy
- **Display Small** (36/44, set bold): the "h/repo" wordmark on the connection setup screen. Used once.
- **Headline Small** (400, 24/32): destination titles (Find, Places, History, Value) and sheet headings. The item name in its sheet's title card is set medium.
- **Title Large** (400, 22/28): the top app bar title on pushed screens (a room, a box, Settings). On Find, the "h/repo" wordmark title is set bold. The wordmark is the only text that gets a bold override.
- **Title Medium** (500, 16/24): item and place names in rows, list section titles ("Put away today", "Your things", day groups in History), empty-state titles, and the room and avatar initials.
- **Title Small** (500, 14/20, accent ink): Settings section headers ("Appearance", "Data").
- **Body Large / Medium** (400, 16/24 and 14/20): fields, notices, row subtitles, sheet copy.
- **Label Large** (500, 14/20): buttons, chips, quantities ("×3"), monogram initials.
- **Label Medium** (500, 12/16): drawer tab text, always one line with ellipsis.
- **Label Small** (500, 11/16): the status label.

### Named Rules
**The Borrowed Voice Rule.** Never bundle a font or hard-code sp sizes outside the Material roles. Every text style is a `MaterialTheme.typography` role.

**The Sentence Case Rule.** Section titles are sentence case at title-medium in ink, with a muted count. Never use uppercase tracking labels above them.

## Layout

The app is a single column with one item per row. Lists are segmented: each row is a card 12dp in from the screen edge, 2dp below its neighbour, with 14dp outer corners on the group and 4dp corners between rows. Inside a card a row has 16dp side padding and 12dp top and bottom: a 40dp avatar, a 14dp gap, then a column holding the name and the drawer path 6dp apart. Inside a sheet, which has its own 20dp padding, segments run edge to edge (inset 0). Section titles are at least 48dp tall, 12dp above their cards. Lists carry 96dp of bottom clearance so the FAB never covers the last row (24dp on History, which has no FAB). Sheet actions are 48–52dp tall and spaced 8dp apart; the field-adjacent Go button is 56dp to match the text field. Empty and error notices are centred, with 32dp horizontal and 40dp vertical padding and a 40dp outline icon.

Navigation is `NavigationSuiteScaffold` with three destinations: Find, Places, History. It shows a bottom bar on the ground colour on phones and adapts to a rail on wider windows. The active tab gets the tonal pill behind its icon, and its icon and label in accent ink. Tapping a tab returns to that tab's root, with Find underneath. The web's destinations are Find, Places and Value (see [Web client](#web-client)).

**Motion.** Opening or leaving a room or box is a drawer pull: a shared-axis Y over 300ms (`tween(300)`), where the incoming screen rises a tenth of its height while fading in and the outgoing one moves the opposite tenth while fading out. The pop and predictive-back gestures reverse it. Every other change fades through: the old screen fades out over 90ms, then the new one fades in over 210ms (after a 90ms delay) while scaling from 0.92.

## Elevation & Depth

Depth is white on warm. Cards sit flat on the ground, and the contrast between them does the separating. The only shadows are on things that float above the page: the FAB, overflow menus (a soft 24px blur), bottom sheets and dialogs. A sheet dims the screen behind it. Drawer tabs separate from a card with a 1dp hairline at 70%, not with shadow.

### Named Rules
**The Cards Lie Flat Rule.** A card never casts a shadow. To show that something floats (a menu, a sheet), lift it; to group things, put them on one card stack.

## Shapes

Corners are soft and step with size: 4dp between segmented rows, 6dp for tabs and status labels, 10dp for room swatches and tag chips, 14dp for item avatars, cards and the shift notice, 16dp for menus and the web FAB, 20dp for the Android FAB, 28dp for sheets, the search field and the tag tray. Buttons and chips keep the Material pill and 8dp-family shapes. The spine is a 2dp round-capped line. The launcher icon is the app's own artwork (a light rounded tile with a short list: an orange dot and grey pill, a blue pill, a green dot), generated for every density by `scripts/make-android-launcher-icon.mjs`, on a flat `#EFEEEE` background layer so a circle mask shows no corner, with a monochrome layer for themed icons.

## Components

### Buttons
- **Shape:** full pill, 52dp tall in sheets (48dp in a Cancel/Save footer).
- **Primary (accent fill):** the one confirm per sheet: Move, Save, Yes, Go, Restore, Close, Sync, Download my data.
- **Tonal:** secondary but useful actions such as Try again and Add "query" on a no-match result.
- **Cancel (well):** the neutral partner to Save in a picker footer, which sits right-aligned: Cancel, then Save.
- **Outlined:** alternative actions (No, Keep it, Restore data, Search everything) with a hairline stroke.
- **Text:** low-weight actions in accent ink. Delete takes the error colour.
- **Destructive confirm:** the Declutter confirm is a filled button in error / on-error.

### FAB
- An icon-only rounded square (56dp; 20dp corners on Android, 16dp on the web) in the accent fill, with a + in its ink. It is the screen's single accent action, and its accessible name says what it does ("Add something", "Add a room", "New box").

### Chips
- **Style:** Material filter chips at 8dp spacing in a horizontally scrolling row: Your things, Decluttered, All.
- **State:** the selected chip fills with the accent's tonal and gains a leading check. Unselected chips are outlined.
- **Tag chips:** status-well fill, 10dp corners, label-large.

### Inputs / Fields
- **Search:** a 56dp well with 28dp corners, a leading search icon and no outline: on Find ("Where did I put it?", with trailing mic and scan) and at the top of every picker.
- **Forms:** Material outlined text fields, full width and single line, with an error line beneath.

### Navigation
- **Top bar:** a small top app bar on the ground colour. Destinations show a headline-small title with an optional muted count line under it ("3 rooms · 37 things"; a room shows "2 boxes · 1 thing loose"). Pushed screens show a back arrow and a title-large title, plus trailing actions such as the overflow. The House Shift notice hangs directly under it while a shift runs.
- **Destinations:** see Layout: outlined icons and labels, the active one in accent ink on the tonal pill.

### Sections
- A section title is a full-width, at least 48dp row: the title (title-medium), its count (muted), an optional text action, and a chevron. Tapping the title or the chevron folds the section; what is folded is kept for the session (rotation on Android). Used for "Put away today" and the results on Find, the sections of a room and a box, and History's days.

### Item sheet
- **Breadcrumb:** the room swatch and the path ("Office › Grey Pouch 01 ›") as a pill; tapping it opens the move picker. The ⋮ overflow sits on the right.
- **Title card:** a white card with a 48dp avatar and the name (headline-small, medium).
- **Property rows:** one segmented stack, each row an outline icon and the value, or a muted invitation when empty: place (the drawer path, and "Put here 3 weeks ago" on the web), quantity, price (with cost per day on the web), tags (chips), barcode, each custom field (its name small and muted, the value under it), notes. Tapping a row opens what edits it.
- **Pill actions:** one horizontally scrolling row of 44dp pills: Move (the accent fill), +1 on Android, Declutter, Edit. A decluttered item shows Restore as the accent pill instead.
- **History** (web): the journey log under the pills.

### Pickers
- **Move:** a search well, recent places as chips (web), then one segmented stack: each room ("Loose in the room"), with its boxes nested under it and indented 20dp per level (at most three steps). Where the thing is now is shaded in `pressed`, says "Here now", and can't be picked. "Inside another thing" follows as its own stack (on the web, once you type).
- **Tags:** a tray of the chosen tags as removable chips in a 28dp well, a search well ("Find or make a tag"), then every tag as a card row with a tag icon, its use count (web) and a checkbox in accent ink, with "Create “name”" offered for a new name. Cancel and Save sit at the foot; nothing is written until Save.

### Menus
- The ⋮ overflow opens a white menu card (16dp corners, soft shadow): an optional muted header ("Added on 12 Oct 2026"), icon rows at least 48dp tall, a hairline before the destructive group, and Delete in the error colour. Escape or a tap outside closes the menu only, not the sheet it came from.

### Settings
- **Android:** one white page under the warm top bar, in bands. Each band starts with a hairline and a header in accent ink (Appearance, Data), then rows: an outline icon, the name in body-large, and its value or a hint in muted ink. Sync is a row ("Last synced at 5:03 PM"); Change database is a row on builds without a built-in database. The theme and accent choice cards sit inside the Appearance band.
- **Web:** the same headers in accent ink over white card groups, because the web's Settings hold far more controls (backup, value line, House Shift, labels, tags, fields, codes).

### Icons

- One icon set serves items and rooms: the line icons first, then brand marks (stored as `brand:<name>`). An empty key means no icon: the item or room shows its initial on its room tint.
- The icon picker is a sheet with a search field and an adaptive grid (68dp cells: a 44dp tile, the name in label-small under it). The first cell is "No icon". The chosen cell has a 2dp accent border and a tonal tile.
- Items change their icon from Edit details; rooms from the room's menu (Change icon). Room icons live in `rooms.icon` (migration 0010) and appear wherever the room's swatch does.

### Quick add

- A bottom sheet on `surface-container-lowest` with no border around the name: a title-large text field ("What are you putting away?"), focused with the keyboard up.
- Under it, one scrolling row of assist chips: "+" (Icon, How many, Price), the place chip (room swatch and path; a menu of every room and box), then a chip for each extra that is set.
- At the end, a 52dp accent-fill button: a mic while the name is empty (speech fills the name and, from "X is in Y", the place), an up arrow once there is text. Enter also sends.
- Typing `#` and part of a name lists matching rooms and boxes in a card above the field; picking one sets the place and removes the `#` text.
- After an add the sheet stays open: a one-line confirmation in `on-surface-variant`, the field cleared, the place kept.

### Settings choice cards

- A Material clickable surface, 14dp corners, `surface-container-lowest`, a 1dp `outline-variant` border that becomes a 2dp accent-ink border when chosen.
- A 78dp miniature of the app on top (rail, an item with drawer tabs on a spine, the accent on the Add button), drawn from the actual scheme it offers; the name below in label-large, accent-coloured when chosen.
- The chosen card carries a 20dp accent circle with a check in the miniature's top corner, so the name keeps the card's full width.
- Three per row; the accent grid drops to two per row when text is enlarged past 1.15×. Announced to TalkBack as radio choices.

### Drawer Path (signature)
A location shown as a stack of drawer tabs down one spine.
- **Spine:** one 2dp line in spine-line, full height of the stack, with an 8dp gap to the tabs.
- **Tabs:** fixed 22dp minimum height everywhere and 3dp apart, with 9dp horizontal padding and label-medium text on one ellipsised line. Each tab has a 6dp radius and a 1dp spine-line border at 70%.
- **Indent:** each level steps 10dp right, capped at three steps.
- **Colour:** the room tab takes the room's tint and ink. Every inner tab is a slip (surface-container-lowest with ink).
- **Collapse:** past four levels, the stack shows the room, an ellipsis tab, and the last two.
- **Relative paths:** inside a room or box, rows show only the drawers below the current place. A tail that starts at a box stays all slips, and the room is not repeated.
- **Accessibility:** the whole stack reads as one phrase, "In Bedroom, Wardrobe, Documents folder".

### Item Row and Avatar
- The row is a segmented card. It shows a 40dp avatar on the room's tint (14dp radius), then the title-medium name, an optional muted "×n", and an optional status label, with the drawer path below. The avatar holds the stored icon at 55% of its size in tint ink. Without an icon it falls back to the brand monogram, then the initial.
- **Room swatch:** a 40dp, 10dp-radius square in the room tint with the room's initial. It is the room's drawer front on Places.

### Status Label
- A 6dp-radius status-well slip with label-small muted ink and 2dp × 6dp padding. The only status it shows today is "Decluttered".

### Notices and Feedback
- **Notice:** a centred 40dp outline icon in outline colour, a title-medium heading, body-medium muted copy, and an optional tonal action 4dp below.
- **Shift notice:** a 14dp-radius shift-amber surface at the gutter, at least 48dp tall, in body-medium.
- **Snackbar:** every write ends with a snackbar in the product's words. A write with a safe way back offers Undo, with a long duration.

## Web client

The web app is the same world. These are the places where a browser, or a feature only the web has, changes the detail.

- **Tokens.** Colour roles are CSS custom properties on `:root`, with dark values under `html.dark`: `--canvas` (ground), `--paper` (card and slip), `--sheet` (a sheet's ground), `--bar` (navigation bar), `--sunken` (well), `--pressed`, `--status-well`, `--line` (hairline), `--outline`, `--ink`, `--ink-soft`, `--ink-faint`. The `surface` utility is a white card. Room tints are `.tint-0` to `.tint-5`, each setting `--tint` and `--on-tint`.
- **Segmented lists.** `.list` makes each child a card with the segment corners and 2px gaps, and gives `.row-press` children 16px side padding. The rules are unlayered on purpose, so they win over the rows' padding utilities. `.is-here` shades the current choice in a picker.
- **Accent.** `theme.js` computes the accent from the same seven hexes: the fill (`--accent`), lifted 35% toward white in dark mode; the ink on it (`--on-accent`), white or #1A1C1E by contrast; and `--accent-ink`, the accent as text: the accent's named ink (Tangerine's `#8F5A00`) in light mode, otherwise the fill stepped toward the ink until it reaches 4.5:1 on a card. CSS derives `--accent-container` and `--accent-tonal` with `color-mix(in oklab, …)`. The choice is stored in the browser (`hsh.accent`, `hsh.theme`); no stored choice means Tangerine.
- **Room tint.** `roomTint()` runs Java's `String.hashCode` on the trimmed, lowercased name (32-bit overflow, UTF-16 units), then floor-mod six. A room is the same colour on both clients.
- **Type.** System sans. Material roles are classes in rem (`t-headline-sm`, `t-title-lg`, `t-title-md`, `t-body-lg`, `t-label-md`, `t-label-sm`), alongside Tailwind's `text-sm`/`text-xs`, so the browser's text size carries through as the phone's font scale does. Form inputs stay at 16px so iOS Safari does not zoom on focus.
- **Grids.** One system in `input.css`, in rem tracks rather than breakpoints, so a grid reflows with its container and the text size: `grid-tiles` (icon and brand tiles, at least 4.75rem, 8px gaps), `grid-choices` (Settings cards, at least 6.5rem) and `grid-fields` (fields side by side, one column when one would be under 9rem). Lists of rows are segmented `.list` stacks, one column. `auto-fill` keeps tiles the same width when a filter leaves a few. `grid-heading` titles a group inside a gridded section and has no top margin when it comes first. Spacing belongs to the grid: never pull a grid up with a negative margin. A `tile` is square at rest, grows when text is enlarged, and when chosen gets the accent border and tonal fill, like the choice cards.
- **Destinations.** Find, Places, Value. Value (cost per day since purchase) is web-only and stands in History's slot: the web shows history inside each item's sheet. A Material navigation bar sits below 768px. From 768px up there is a navigation rail, with the mark at the top, the FAB under it, and Settings at the foot.
- **FAB.** The icon FAB is named "Add a room" on Places. Everywhere else it is "Add something" and adds a thing into the room or box on screen. Android's FAB says "New box" or "Box inside" there; the web keeps adding a thing because PRODUCT.md principle 3 keeps the common job within two taps. New boxes come from the "New storage unit" and "New unit in here" rows.
- **Find.** Find adds a row of room chips, each with its swatch, below "Your things", as a shortcut into Places.
- **Menus and sections.** `openMenu()` in `components.js` draws the overflow menu card; `foldSection()` in `ui.js` draws a folding section and remembers what is folded for the session.
- **Place header.** A box screen draws its drawer path (room and the boxes above it) under the top bar. The room tab links back to the room.
- **Value summary.** One plain line ("2 of 8 things under ₹10 a day", then the amount spent). No metric card. The item sheet's value is one line too.
- **Motion.** The same two motions, as CSS animations chosen by place depth (other screens 0, room 1, box 2): going deeper rises, going back drops, and every other change fades through. Under `prefers-reduced-motion` screens and sheets only fade.
- **Brand.** The wordmark and mark SVGs (with the blue slash) are unchanged brand assets. The phone sets "h/repo" as bold text instead.
- **Speed.** No web fonts. Static files are served brotli or gzip with an ETag, and every module is `modulepreload`ed.

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one accent-fill action: the FAB on lists, the filled confirm in sheets, the main pill in the item sheet.
- **Do** use the accent's ink, never its fill, for accent text and small controls.
- **Do** put rows on segmented white cards: 12dp from the screen edge (0 inside a sheet), 2dp apart, 14dp outer corners.
- **Do** show every location as a Drawer Path: one 2dp spine, 22dp tabs, a 10dp indent per level (at most three steps), and the room tab tinted while inner tabs are slips.
- **Do** show paths relative to the current place when listing inside a room or box.
- **Do** pair every room tint with its own ink (`on-room-*`), in both light and dark.
- **Do** give destinations a big title and, where it helps, a muted count line.
- **Do** keep 96dp bottom clearance on any list with a FAB.
- **Do** use the 300ms shared-axis Y only for moving into or out of a place, and fade-through for everything else.
- **Do** use Material type roles only, so the user's font and size settings carry through.

### Don't:
- **Don't** turn on dynamic (wallpaper) colour. The palette and stable room tints are the identity.
- **Don't** use the accent for decoration or a second filled action on the same screen. (Selected chips and the active tab use the accent's tonal, not the fill.)
- **Don't** set text in the Tangerine fill; it reads at 1.7:1.
- **Don't** add shadows to cards. Only things that float (FAB, menus, sheets) lift.
- **Don't** replace the drawer path with breadcrumb text in rows. The breadcrumb belongs to the item sheet's header only.
- **Don't** vary drawer tab height or text size to show depth. Depth is the indent, and the tab scale is fixed so paths compare at a glance.
- **Don't** use room tints for status or emphasis. A tint means "this room".
- **Don't** add uppercase tracked labels above section titles. Titles are sentence case.
- **Don't** treat two rooms that share a tint as related. Six tints chosen by name hash can collide, and that is a known limit, not a meaning.
