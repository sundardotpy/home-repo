# House Move Planner Webapp: Brainstorm

A brainstorm for a webapp that supports the end-to-end house-move plan from the uploaded discussion: plan, declutter, pack, label, final week, unpack.

## Core concept

The source document is really a **pipeline for boxes and tasks**, so the app should track both, with labelling as the centerpiece. It would be a mobile-first, installable PWA: you set a move date and get a timeline of tasks, then track every room, box, and item from "to declutter" through "unpacked in the new home." Since you will mostly use it standing in a room with a box in hand, phone use and speed of input matter most.

## Feature ideas, mapped to the document

### 1. Timeline generator (8 weeks out to moving day)

- Enter the move date and the app builds a checklist with relative due dates (book movers, utilities, mail forwarding, start decluttering, confirm elevator and parking).
- Tasks are editable and split into "do early" and "moving day only," as the document suggests.
- A "today" view shows what is due this week and what is overdue.

### 2. Declutter sorter

- Quick-add an item (optional photo) and tag it Keep, Give/Sell, or Toss.
- Progress per room, plus a running list of things to donate or sell.

### 3. Room-by-room packing planner

- Pre-filled suggested room order (garage and attic first, bathroom and daily essentials last), which you can reorder.
- Each room shows a progress bar (boxes packed, status).
- A daily nudge such as "pack one small area today."

### 4. Box tracker and label generator (the heart of the app)

- Create a box in a few taps: destination room, contents, priority (Open first or Day 1), box number ("Kitchen 3 of 7").
- Color is auto-assigned per room, so the color coding follows the document's advice.
- Print-ready labels with a QR code, designed for top and side placement (the document recommends labelling both).
- Print-ready colored door signs for the new home.
- Scan a box's QR to see its contents and update its status: Packed, Loaded, Delivered, Unpacked. The "N of 7" count then flags anything missing at delivery.

### 5. Open-first box builder

- A checklist template (toiletries, chargers, medications, tools, bedding, snacks, change of clothes), one per person.
- Marked "travels with me, not on the truck," along with valuables and documents.

### 6. Inventory and new-home planner

- Furniture list with dimensions, and a list of doorway, hall, and stair measurements.
- A simple warning when a piece may not fit through a measured opening.
- Optional simple floor plan sketch assigning furniture to rooms.

### 7. Admin tracker

- Movers, van booking, elevator, parking, utilities (shutoff and activation dates), and mail forwarding, with status and contact details.

### 8. Final week and walkthrough

- Defrost fridge, disconnect appliances, cleaning kit, and a final walk-through checklist per room (cupboards, drawers, attic, outdoors).
- A reminder to photograph electronics and cable setups before unplugging, with photos attached to the item.

### 9. Unpacking mode

- Search "scissors" or "chargers" and see which box holds them, and whether it has been unpacked.
- Boxes grouped by room and priority, so Day 1 boxes show first.

## Data model (simple)

| Entity | Fields |
| :-- | :-- |
| Move | Date, old and new address |
| Room | Name, color, belongs to old or new home |
| Box | Number, room, priority, status, label printed |
| Item | Name, photo, box or declutter decision, dimensions if furniture |
| Task | Title, due date, category, done |
| Booking/Contact | Type, date, notes |

## Phasing

- **MVP:** timeline checklist, rooms, box creation, printable QR labels, scan and status, search.
- **Phase 2:** declutter sorter with photos, open-first box templates, furniture measurements and fit check.
- **Phase 3:** floor plan sketch, shareable read-only view for family or movers, offline mode polish, reusable templates for future moves.

## Nice touches worth considering

- Voice input for contents ("kitchen, small appliances, cookbooks") to speed up box creation.
- Printable summary of the packing list and box count for the movers.
- Source attributions inside tips (the articles from the document) so advice has context.
- Works offline, since signal in a half-empty house can be unreliable.

## Open questions that shape the build

- **Audience:** just you and your household, or something you might share with others? This decides whether you need accounts and sync, or whether a single-user setup is enough.
- **Printing:** how important is printing physical labels versus handwriting? If you will print, label sheet sizing becomes a real design constraint.

## Possible next steps

- Screen-by-screen flow
- Label design
- Tech stack and build order

## Project name: mpm (moving package manager)

The working name is **mpm**, a joke on npm. A box is a package: it has a name, a version ("3 of 7"), a destination, and a dependency tree of items. The name can also be read as "my packed stuff, mapped."

The joke can carry through the interface by naming actions after package manager commands:

| Command | What it does in the app |
| :-- | :-- |
| `mpm init` | Set your move date and addresses |
| `mpm install kitchen` | Create the Kitchen room and its checklist |
| `mpm pack` | Add a new box (room, contents, priority) |
| `mpm publish` | Print the label, QR code included |
| `mpm audit` | Final-week walkthrough, plus flagging boxes that never arrived |
| `mpm ls` | List boxes by room and status |
| `mpm search scissors` | Find which box holds them |
| `mpm update` | Advance a box from Packed to Loaded to Delivered |
| `mpm uninstall clutter` | The declutter sorter |
| `mpm lock` | The open-first essentials box, which stays with you |
| `mpm run build` | The moving-day checklist |

### More jokes that fit

- A lockfile for the final box list.
- "Peer dependencies" for the family members who help.
- "Deprecated" as the label for the Toss pile.
- A missing box shows "ERR! 404: box 6 not found."
- A finished move ends with "added 47 boxes in 1 day."

### Name caveat

MPM is already used by a few other things, including the Apache multi-processing module and some package tools. Check the domain before committing. Variants such as mpm.app, getmpm or movempm are fallbacks if the plain name is taken.

### Other name ideas considered

Tallybox, Moveline, Boxtrail, Findbox, Doorstep and Settle.
