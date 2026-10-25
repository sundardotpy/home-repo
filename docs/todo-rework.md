Feature 1: Voice-to-action. The user says something like "Helmet is in living room." The app parses the item name and target room, then asks "Move Helmet to living room?" with Yes and No buttons. Yes moves the item to that room; No cancels with no change. Cover how speech is captured and transcribed, how the item and room names are matched to existing records (including fuzzy matches and items or rooms that don't exist yet), and what happens when parsing is ambiguous.

Feature 2: Move anything, anywhere. Any item can be placed inside another item (a box inside a box) or moved as a whole container to a different room. Moving a container moves everything nested inside it. Prevent cycles, such as placing a box inside its own contents. The data model must support arbitrary nesting depth.

Feature 3: MCP server. Expose the inventory so an external AI of the user's choice can add and remove data through the Model Context Protocol. Define the tools, their input schemas, authentication, and how these operations stay consistent with what the app shows.

Feature 4: Android client. A native Android client that syncs with the production database. Address conflict resolution when the same record is edited on both the app and the client, offline behavior, and how the sync protocol relates to the existing backend.

Feature 5: Split "Put away" into three actions. Replace the single "Put away" action with Add (buy), Decluttered, and Move item. Each has its own meaning and effect on the inventory. Specify what each action records and how existing "Put away" history should be migrated.

Feature 6: House Shift mode. A temporary mode that copies the current database, so the user can reorganize without touching live data. Within that copy, items are packed in two levels: L1 Room (Office, Living, Kitchen, Bedroom, Bathroom) and L2 type (Tech, Fragile, Wet, Soft, Small, Unsure). Cover how the copy is created and discarded, how the user exits the mode, and whether and how changes can be committed back to the live database.

Feature 7: Home screen redesign. Search is the hero element at the top of the home screen, with Items listed below it. Specify the layout hierarchy, the search behavior, and how it interacts with the voice-to-action and nesting features.

For each feature, deliver: the data-model and schema changes, the core logic, the API or interface changes, edge cases and failure modes, and a test plan. Then give one ordered implementation sequence showing which features must come first because others depend on them, and flag any decision that needs my input before building. Where I haven't specified something, choose the most reasonable default and state it explicitly rather than leaving it open.