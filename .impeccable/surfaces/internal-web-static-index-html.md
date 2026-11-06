---
version: 1
slug: "internal-web-static-index-html"
primary_target: "internal/web/static/index.html"
related_targets: ["internal/web/static/js","internal/web/css/input.css"]
---

# Web app (all screens)

Scope: the web client in `internal/web/`, every screen. Mode: Operate.
Audience and job: the household on a phone or laptop, finding where a thing is or recording that it moved, in seconds.
Constraints: every existing feature stays; dependency-free ES modules + Tailwind; one look (Repo skin removed, user's call); no bundled fonts.
Unresolved: none.

## Direction contract

THESIS: The web joins the Android app in Clear Drawers: every place is a frosted drawer you can see into, and a location path is the stack of drawers. One product on two clients.

OWN-WORLD: Inherited from DESIGN.md: sea-glass ground, tonal depth with no card shadows, the user's accent (sea glass default, seven choices) on one action per screen, six room tints chosen by the same name hash as the phone, the device's system sans at Material roles.

STORY: The visitor sees their things with where each one lives, finds one by typing, speaking or scanning, and moves or adds it with one explicit yes.

FIRST VIEWPORT: Find. Small top bar (h/repo, settings). A 56px search well with mic and scan. "Put away today" when anything moved today, then "Your things": tinted avatar, name, drawer-tab path down a spine. Extended FAB "Add"; Material navigation bar on phones, a rail with the FAB on desktop.

FORM: Clear Drawers (established world, inherited from the Android surface). seed: none (inherited direction, no roll)

FINISH: finish review on the built screens; DESIGN.md scope widened to cover the web.
