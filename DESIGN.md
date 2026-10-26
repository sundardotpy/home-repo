---
name: h/repo (Android)
description: Clear Drawers. Every place is a frosted drawer you can see into, and a location path is the stack of drawers.
colors:
  deep-teal: "#0E5E58"
  on-deep-teal: "#FFFFFF"
  sea-glass-tonal: "#B8E0D2"
  on-sea-glass-tonal: "#00201C"
  mist-tonal: "#CCE8E3"
  on-mist-tonal: "#05201D"
  shift-amber: "#F6E0B5"
  on-shift-amber: "#261A00"
  sea-glass-ground: "#F4F7F6"
  ink: "#1C2326"
  ink-muted: "#4A5557"
  slip-white: "#FFFFFF"
  sheet-ground: "#EEF3F2"
  search-well: "#E2E9E7"
  status-well: "#DCE3E1"
  outline: "#6F7A79"
  spine-line: "#C3CCCA"
  error: "#B3261E"
  deep-teal-dark: "#7FD3C6"
  on-deep-teal-dark: "#003732"
  sea-glass-ground-dark: "#101615"
  ink-dark: "#DEE4E2"
  ink-muted-dark: "#BFC9C7"
  slip-dark: "#0B100F"
  sheet-ground-dark: "#181E1D"
  search-well-dark: "#262D2B"
  spine-line-dark: "#3F4947"
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
  section-top: "20px"
  tab-height: "22px"
  spine-width: "2px"
  avatar: "40px"
  action-height: "52px"
  field-height: "56px"
  fab-clearance: "96px"
components:
  button-primary:
    backgroundColor: "{colors.deep-teal}"
    textColor: "{colors.on-deep-teal}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "52px"
  fab-extended:
    backgroundColor: "{colors.deep-teal}"
    textColor: "{colors.on-deep-teal}"
    typography: "{typography.label-large}"
    rounded: "{rounded.large}"
    height: "56px"
  button-tonal:
    backgroundColor: "{colors.mist-tonal}"
    textColor: "{colors.on-mist-tonal}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "52px"
  button-outlined:
    backgroundColor: "{colors.sea-glass-ground}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    height: "52px"
  search-field:
    backgroundColor: "{colors.search-well}"
    textColor: "{colors.ink}"
    typography: "{typography.body-large}"
    rounded: "{rounded.extra-large}"
    height: "56px"
  filter-chip-selected:
    backgroundColor: "{colors.mist-tonal}"
    textColor: "{colors.on-mist-tonal}"
    typography: "{typography.label-large}"
    rounded: "{rounded.small}"
  drawer-tab-room:
    backgroundColor: "{colors.room-seafoam}"
    textColor: "{colors.on-room-seafoam}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.extra-small}"
    padding: "1px 9px"
    height: "22px"
  drawer-tab-slip:
    backgroundColor: "{colors.slip-white}"
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

> **Scope.** This file covers the native Android client only (`android/`, Jetpack Compose + Material 3). The web app under `internal/web/` has its own, older look. That look is not described here, and nothing here applies to it.

## Overview

**Creative North Star: "Clear Drawers"**

Every place is a frosted drawer you can see into, and a location path is the stack of drawers. The ground is pale sea-glass, cool and quiet. Colour belongs to rooms: each room carries one of six soft tints. One accent is the only loud colour: deep teal by default, or whichever of six the user picks in Settings. It marks the one main action on each screen. The category default is a grey list with the path as a faint subtitle. This system turns that path into the picture itself: a short stack of same-height tabs hanging from one thin spine.

The world is Material 3 tuned rather than replaced. Scheme roles, shapes, motion and navigation come from the platform. Character comes from the palette, from drawer geometry repeated at every scale (list row, place header, app icon), and from a refusal to add boxes. Hierarchy comes from Material type size and weight in the device's own sans, so the app follows the user's font and font-size settings. Cards and dividers are not used for hierarchy. The density is calm: one item per row, generous 16dp gutters, and enough room under the list for the extended FAB.

**Key Characteristics:**
- Frosted sea-glass ground (light and dark), with tonal surface containers for depth and no card shadows.
- The accent (deep teal by default) on exactly one main action per screen. Secondary actions are tonal or outlined.
- Light, Dark, or System (follow the phone), chosen in Settings and saved on the phone.
- Six room tints (seafoam, amber, rose, lavender, sky, sage). Each is a light/dark tonal pair, picked by a hash of the room name.
- The drawer path is the signature: one spine, fixed 22dp tabs, a tinted room tab, and white slip-label inner tabs.
- The device's system sans at stock Material roles. No bundled font.
- Two motions only: a shared-axis Y "drawer pull" into and out of places, and a fade-through everywhere else.

## Colors

The palette is a cool, low-chroma sea-glass neutral set, plus one accent (deep teal by default, five others to choose from) and six pastel room tints that each carry their own ink.

### Primary
- **Deep Teal** (`deep-teal`; dark theme `deep-teal-dark`): the one main action on a screen. That means the extended FAB (Add, New room, Box inside), the filled confirm button in a sheet (Move, Save, Yes, Go, Restore), and the launcher icon ground. Nothing decorative uses it. When the user picks another accent it takes this role everywhere except the launcher icon, which stays teal.
- **Sea-Glass Tonal** (`sea-glass-tonal`): the primary container. It also colours the spine and the room tab in the launcher icon.

### User choices

Settings offers the theme mode and the accent as cards, each a miniature of the app drawn from the real colour scheme it stands for.

- **Theme mode:** System (follows the phone; its card is split half light, half dark), Light, or Dark. The status and navigation bar icons follow the chosen mode, not only the phone.
- **Accent:** each one replaces `primary`, `primary-container`, the tonal `secondary-container` and `inverse-primary`, in matched light and dark pairs. The sea-glass ground, the neutrals and the room tints never change; they carry the drawers.

| Accent | Light primary | Light tonal | Dark primary | Dark tonal |
| --- | --- | --- | --- | --- |
| Sea glass (default) | #0E5E58 | #CCE8E3 | #7FD3C6 | #324B47 |
| Tangerine | #9A4A00 | #FFE2CC | #FFB77A | #5C3A1F |
| Blueberry | #3654A8 | #DDE2F9 | #B3C5FF | #3E4759 |
| Raspberry | #A3324F | #FFD9DF | #FFB1C0 | #5C3F43 |
| Kale | #3F6B2E | #D8E7CB | #A5D68E | #3C4B35 |
| Lavender | #6750A4 | #E8DEF8 | #CFBCFF | #4A4458 |

Both choices are stored on the phone (`theme_mode`, `accent` in the app's preferences) and apply the moment they change.

### Secondary
- **Mist Tonal** (`mist-tonal` / `on-mist-tonal`): the secondary container. It fills tonal buttons, the selected filter chip, and the navigation bar's active indicator. Use it for actions that matter but are not the screen's main one.

### Tertiary
- **Shift Amber** (`shift-amber` / `on-shift-amber`): the tertiary container. Its only use is the House Shift notice under the top bar, the one system-wide status the app has to raise.

### Room tints
- **Seafoam, Amber, Rose, Lavender, Sky, Sage** (`room-*` / `on-room-*`, with `-dark` pairs): one tint per room. It fills the room's drawer tab, its swatch on Places, and every item avatar in that room. Each container comes with a matched ink. Never set default ink on a tint.

### Neutral
- **Sea-Glass Ground** (`sea-glass-ground`; dark `sea-glass-ground-dark`): background and surface. The launch window uses the same value, so nothing flashes before Compose draws.
- **Ink** (`ink`) and **Muted Ink** (`ink-muted`): primary text. Muted ink is for secondary text: section titles, subtitles, quantities, status labels and history icons.
- **Slip White** (`slip-white`; dark `slip-dark`): surface-container-lowest, used as the inner drawer tabs. In dark theme the slip is the darkest surface, not white.
- **Sheet Ground** (`sheet-ground`): bottom sheets and the list items inside them.
- **Search Well** (`search-well`): the search field's container. **Status Well** (`status-well`) is for the Decluttered label.
- **Spine Line** (`spine-line`): outline-variant. Used for the drawer spine, tab borders (at 70% alpha), and chip and outlined-button strokes.
- **Error** (`error`): destructive text actions and the Declutter confirm button.

### Named Rules
**The One Accent Rule.** Each screen has at most one action in the accent colour: the FAB on a list, the filled confirm in a sheet. Everything else is tonal (`mist-tonal`), outlined, or a text button.

**The Room Owns Its Colour Rule.** Tints identify rooms and never encode status or emphasis. An item's avatar, its room tab and its room's swatch always share one tint.

**The Own Palette Rule.** Dynamic (wallpaper) colour is deliberately off. The palette is the app's identity, and a room's tint has to stay stable from one launch to the next.

## Typography

**Display Font:** the device system sans (Roboto on stock Android, the maker's face elsewhere)
**Body Font:** the same
**Label/Mono Font:** the same; no mono

**Character:** One family at stock Material 3 roles (`Typography()` defaults, sizes in sp). The type follows the user's font and size choice, so size and weight carry the hierarchy, not new faces. One px in the frontmatter equals one sp on device.

### Hierarchy
- **Display Small** (36/44, set bold): the "h/repo" wordmark on the connection setup screen. Used once.
- **Headline Small** (400, 24/32): sheet headings such as the item name in its sheet.
- **Title Large** (400, 22/28): the top app bar title. On Find, the "h/repo" wordmark title is set bold. The wordmark is the only text that gets a bold override.
- **Title Medium** (500, 16/24): item and place names in rows, empty-state titles, and the room and avatar initials.
- **Title Small** (500, 14/20, muted ink): list section titles in sentence case, such as "Put away today", "Your things" and day groups in History.
- **Body Large / Medium** (400, 16/24 and 14/20): fields, notices, row subtitles, sheet copy.
- **Label Large** (500, 14/20): buttons, chips, quantities ("×3"), monogram initials.
- **Label Medium** (500, 12/16): drawer tab text, always one line with ellipsis.
- **Label Small** (500, 11/16): the status label.

### Named Rules
**The Borrowed Voice Rule.** Never bundle a font or hard-code sp sizes outside the Material roles. Every text style is a `MaterialTheme.typography` role.

**The Sentence Case Rule.** Section titles are sentence case at title-small in muted ink. Never use uppercase tracking labels above them.

## Layout

The app is a single column with one item per row. Horizontal gutters are 16dp throughout: list rows, the search field, section titles, the shift notice, and a drawer path set as a header. A list row is 12dp padding top and bottom, a 40dp avatar, a 14dp gap, then a column holding the name and the drawer path 6dp apart. Section titles sit 20dp above their rows and 4dp below. Lists carry 96dp of bottom clearance so the extended FAB never covers the last row (24dp on History, which has no FAB). Sheet actions are 52dp tall and spaced 8dp apart, and the field-adjacent Go button is 56dp to match the text field. Empty and error notices are centred, with 32dp horizontal and 40dp vertical padding and a 40dp outline icon.

Navigation is `NavigationSuiteScaffold` with three destinations: Find, Places, History. It shows a bottom bar on phones and adapts to a rail on wider windows. Tapping a tab returns to that tab's root, with Find underneath.

**Motion.** Opening or leaving a room or box is a drawer pull: a shared-axis Y over 300ms (`tween(300)`), where the incoming screen rises a tenth of its height while fading in and the outgoing one moves the opposite tenth while fading out. The pop and predictive-back gestures reverse it. Every other change fades through: the old screen fades out over 90ms, then the new one fades in over 210ms (after a 90ms delay) while scaling from 0.92.

## Elevation & Depth

Depth is tonal. Ground, sheet ground, search well and status well are steps of the sea-glass surface-container ramp, and none of them casts a shadow. The only shadows are Material's own component elevation on the extended FAB, bottom sheets and dialogs. Drawer tabs separate from the ground with a 1dp hairline in spine-line at 70%, not with shadow.

### Named Rules
**The Frosted, Not Lifted Rule.** To show that something sits on top, use the next surface-container step or a hairline. Don't add shadows to custom surfaces.

## Shapes

Corners are soft and step with size: 6dp for tabs and status labels, 10dp for room swatches, 14dp for item avatars and the shift notice, 20dp and 28dp for the FAB, sheets and the search field. Buttons and chips keep the Material pill and 8dp-family shapes. The spine is a 2dp round-capped line. The launcher icon redraws the signature (a teal ground, a 3px spine, a tinted room tab, two white slips stepping right) and ships a monochrome layer for themed icons.

## Components

### Buttons
- **Shape:** full pill, 52dp tall in sheets.
- **Primary (filled, accent):** the one confirm per sheet, and Sync now in Settings: Move, Save, Yes, Go, Restore, Close.
- **Tonal (mist):** secondary but useful actions such as +1, Try again, and Add "query" on a no-match result.
- **Outlined:** cancel or alternative actions (No, Keep it, Declutter, Search everything) with a spine-line stroke.
- **Text:** low-weight actions such as Edit details. Delete takes the error colour as text.
- **Destructive confirm:** the Declutter confirm is a filled button in error / on-error.

### Extended FAB
- The accent with its on-accent ink, a leading Add icon, and a verb label ("Add", "New room", "Box inside"). It is the screen's single accent action. On Find it collapses to an icon once the list scrolls past its first item.

### Chips
- **Style:** Material filter chips at 8dp spacing in a horizontally scrolling row: Your things, Decluttered, All.
- **State:** the selected chip fills with mist tonal and gains a leading check. Unselected chips are outlined in spine-line.

### Inputs / Fields
- **Search:** a docked input field in a 28dp-radius search well at the 16dp gutter. It has a leading search icon, the placeholder "Where did I put it?", and trailing mic and scan icon buttons.
- **Forms:** Material outlined text fields, full width and single line, with an error line beneath.

### Navigation
- **Top bar:** a small top app bar on the ground colour (no tint, no elevation colour shift), with a back arrow on pushed screens and trailing actions such as settings or the place menu. The House Shift notice hangs directly under it while a shift runs.
- **Destinations:** a navigation suite with outlined icons and labels. The active indicator is mist tonal.

### Settings choice cards

- A Material clickable surface, 14dp corners, `surface-container-lowest`, a 1dp `outline-variant` border that becomes a 2dp accent border when chosen.
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
- The row shows a 40dp avatar on the room's tint (14dp radius), then the title-medium name, an optional muted "×n", and an optional status label, with the drawer path below. The avatar holds the stored icon at 55% of its size in tint ink. Without an icon it falls back to the brand monogram, then the initial.
- **Room swatch:** a 40dp, 10dp-radius square in the room tint with the room's initial. It is the room's drawer front on Places.

### Status Label
- A 6dp-radius status-well slip with label-small muted ink and 2dp × 6dp padding. The only status it shows today is "Decluttered".

### Notices and Feedback
- **Notice:** a centred 40dp outline icon in outline colour, a title-medium heading, body-medium muted copy, and an optional tonal action 4dp below.
- **Shift notice:** a 14dp-radius shift-amber surface at the gutter, at least 48dp tall, in body-medium.
- **Snackbar:** every write ends with a snackbar in the product's words. A write with a safe way back offers Undo, with a long duration.

## Do's and Don'ts

### Do:
- **Do** give each screen exactly one accent-coloured action: the extended FAB on lists, the filled confirm in sheets.
- **Do** use tonal (mist) for secondary actions and outlined for cancel or alternative choices.
- **Do** show every location as a Drawer Path: one 2dp spine, 22dp tabs, a 10dp indent per level (at most three steps), and the room tab tinted while inner tabs are slips.
- **Do** show paths relative to the current place when listing inside a room or box.
- **Do** pair every room tint with its own ink (`on-room-*`), in both light and dark.
- **Do** keep 16dp gutters and 96dp bottom clearance on any list with an extended FAB.
- **Do** use the 300ms shared-axis Y only for moving into or out of a place, and fade-through for everything else.
- **Do** use Material type roles only, so the user's font and size settings carry through.

### Don't:
- **Don't** turn on dynamic (wallpaper) colour. The palette and stable room tints are the identity.
- **Don't** use the accent for decoration or a second filled action on the same screen. (Selected chips and the active tab use the accent's tonal container, not the accent itself.)
- **Don't** vary drawer tab height or text size to show depth. Depth is the indent, and the tab scale is fixed so paths compare at a glance.
- **Don't** use room tints for status or emphasis. A tint means "this room".
- **Don't** wrap rows in cards or add shadows to custom surfaces. Depth is tonal.
- **Don't** add uppercase tracked labels above section titles. Titles are sentence-case title-small.
- **Don't** treat two rooms that share a tint as related. Six tints chosen by name hash can collide, and that is a known limit, not a meaning.
