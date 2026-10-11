#!/usr/bin/env sh
# End-to-end smoke test for the phase 1 API. Run against a live stack:
#   docker compose up -d && ./scripts/smoke.sh
set -eu
BASE="${BASE:-http://localhost:8080/api}"
fails=0
# Room names are unique in the schema, so tag this run to stay re-runnable.
RUN=$(date +%s)

# Every room this run creates, so an early exit does not leave test data in a
# real database. Deleting a room cascades to its units and items.
CREATED_ROOMS=""
cleanup() {
  for id in $CREATED_ROOMS; do
    curl -sS -o /dev/null -X DELETE "$BASE/rooms/$id?cascade=true" || true
  done
}
trap cleanup EXIT

# curl helper: METHOD PATH [BODY] -> prints body, sets STATUS
req() {
  method=$1; path=$2; body=${3:-}
  if [ -n "$body" ]; then
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "$BASE$path" \
      -H 'Content-Type: application/json' -d "$body")
  else
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "$BASE$path")
  fi
  STATUS=$(printf '%s' "$out" | tail -n1)
  BODY=$(printf '%s' "$out" | sed '$d')
}

check() { # DESCRIPTION EXPECTED_STATUS
  if [ "$STATUS" = "$2" ]; then
    printf '  ok    %s (%s)\n' "$1" "$STATUS"
  else
    printf '  FAIL  %s: expected %s got %s\n        %s\n' "$1" "$2" "$STATUS" "$BODY"
    fails=$((fails + 1))
  fi
}

# field a.b.0.c -> pluck a value out of the last response body
field() {
  printf '%s' "$BODY" | python3 -c '
import sys, json
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d[int(k)] if k.isdigit() else d[k]
print(d)' "$1"
}

echo "== health =="
req GET /healthz; check "healthz" 200

echo "== rooms =="
req POST /rooms "{\"name\":\"Bedroom $RUN\",\"description\":\"upstairs\"}"; check "create room" 201
ROOM=$(field "id"); CREATED_ROOMS="$CREATED_ROOMS $ROOM"
req POST /rooms "{\"name\":\"bedroom $RUN\"}"; check "duplicate room name rejected" 409
req POST /rooms '{"description":"no name"}'; check "room without name rejected" 400
req POST /rooms "{\"name\":\"Garage $RUN\"}"; check "create second room" 201
GARAGE=$(field "id"); CREATED_ROOMS="$CREATED_ROOMS $GARAGE"
req GET /rooms; check "list rooms" 200
req PATCH "/rooms/$ROOM" '{"description":"master bedroom"}'; check "patch room" 200

echo "== floors =="
printf '        ground: %s\n' "$(field "floor_label")"
req POST /rooms "{\"name\":\"Bedroom $RUN\",\"floor\":1}"; check "same name on another floor allowed" 201
UPSTAIRS=$(field "id"); CREATED_ROOMS="$CREATED_ROOMS $UPSTAIRS"
printf '        upstairs: %s\n' "$(field "floor_label")"
req POST /rooms "{\"name\":\"bedroom $RUN\",\"floor\":1}"; check "duplicate on the same floor rejected" 409
req POST /rooms "{\"name\":\"Loft $RUN\",\"floor\":2,\"floor_name\":\"Attic\"}"; check "named floor" 201
LOFT=$(field "id"); CREATED_ROOMS="$CREATED_ROOMS $LOFT"
printf '        named: %s\n' "$(field "floor_label")"
req POST /rooms "{\"name\":\"Cellar $RUN\",\"floor\":-1}"; check "basement" 201
CELLAR=$(field "id"); CREATED_ROOMS="$CREATED_ROOMS $CELLAR"
printf '        below: %s\n' "$(field "floor_label")"

echo "== storage units =="
req POST /storage-units "{\"room_id\":\"$ROOM\",\"name\":\"Wardrobe\",\"kind\":\"cupboard\"}"; check "create unit" 201
WARDROBE=$(field "id")
req POST /storage-units "{\"parent_id\":\"$WARDROBE\",\"name\":\"Top Shelf\"}"; check "create nested unit" 201
SHELF=$(field "id")
req POST /storage-units "{\"parent_id\":\"$SHELF\",\"name\":\"Blue Box\"}"; check "create 3-deep unit" 201
BOX=$(field "id")
BOXSLUG=$(field "qr_slug")
req GET "/storage-units/$BOX"; check "get unit" 200
printf '        path: %s\n' "$(field "path")"
req PATCH "/storage-units/$WARDROBE" "{\"parent_id\":\"$BOX\"}"; check "cycle rejected" 400
req GET "/storage-units?room_id=$ROOM&root_only=true"; check "list root units" 200

echo "== items =="
req POST /items "{\"name\":\"Cordless Drill\",\"storage_unit_id\":\"$BOX\",\"tags\":[\"Tools\",\"tools\",\" power \"],\"quantity\":1}"; check "create item in box" 201
DRILL=$(field "id")
printf '        location: %s\n' "$(field "location.path_string")"
printf '        tags: %s\n' "$(field "tags")"
req POST /items "{\"name\":\"Winter Jacket\",\"storage_unit_id\":\"$SHELF\",\"tags\":[\"clothes\"]}"; check "create item on shelf" 201
JACKET=$(field "id")
req POST /items "{\"name\":\"Ladder\",\"room_id\":\"$GARAGE\"}"; check "create loose room item" 201
LADDER=$(field "id")
req POST /items "{\"name\":\"Nowhere\"}"; check "item without location rejected" 400
req POST /items "{\"name\":\"Cross\",\"room_id\":\"$GARAGE\",\"storage_unit_id\":\"$BOX\"}"; check "room/unit mismatch rejected" 400
req PATCH "/items/$DRILL" '{"quantity":2}'; check "patch item quantity" 200
req PATCH "/items/$DRILL" '{"quantity":-1}'; check "negative quantity rejected" 400
req POST /items "{\"name\":\"Torch\",\"room_id\":\"$GARAGE\",\"icon\":\"bulb\"}"; check "item with a chosen icon" 201
TORCH=$(field "id")
printf '        icon: %s\n' "$(field "icon")"
req PATCH "/items/$TORCH" '{"icon":"battery"}'; check "change icon" 200
req PATCH "/items/$TORCH" '{"icon":""}'; check "clear icon" 200
printf '        icon now: %s\n' "$(field "icon")"
req GET "/items/$TORCH"; check "item carries its floor" 200
printf '        floor: %s\n' "$(field "location.floor_label")"

echo "== browse =="
req GET "/rooms/$ROOM/tree"; check "room tree" 200
req GET "/storage-units/$WARDROBE/contents?deep=true"; check "deep contents" 200
printf '        deep item count: %s\n' "$(field "item_total")"
req GET "/storage-units/$WARDROBE/contents"; check "shallow contents" 200
printf '        shallow item count: %s\n' "$(field "item_total")"

echo "== search =="
req GET "/search?q=drill"; check "search by name" 200
printf '        %s -> %s\n' "$(field "results.0.name")" "$(field "results.0.location")"
req GET "/search?q=power"; check "search by tag" 200
printf '        hits: %s\n' "$(field "total")"
req GET "/search?q=zzzznope"; check "search miss returns empty" 200
printf '        hits: %s\n' "$(field "total")"
req GET "/search"; check "search without q rejected" 400
req GET "/items?tags=clothes"; check "filter by tag" 200

echo "== qr =="
req GET "/qr/$BOXSLUG"; check "lookup unit by qr slug" 200
printf '        %s\n' "$(field "storage_unit.path")"
req GET "/qr/NOPE"; check "unknown slug 404" 404
req GET "/qr/$BOXSLUG/target"; check "qr target" 200
printf '        scan url: %s\n' "$(field "scan_url")"
req GET "/qr/$(printf '%s' "$BOXSLUG" | tr 'A-Z' 'a-z')/target"; check "slug is case-insensitive" 200

# Label artwork and the printed short link live outside /api.
ROOT=$(printf '%s' "$BASE" | sed 's|/api$||')
raw() { STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$ROOT$1"); }
raw "/api/qr/$BOXSLUG/svg"; check "qr svg" 200
raw "/api/qr/$BOXSLUG/png"; check "qr png" 200
raw "/api/qr/NOPE/svg"; check "qr svg for unknown slug 404" 404
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$ROOT/q/$BOXSLUG"); check "printed link redirects" 303
printf '        -> %s\n' "$(curl -sS -o /dev/null -w '%{redirect_url}' "$ROOT/q/$BOXSLUG")"
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "$ROOT/q/NOPE"); check "unknown printed link still lands in the app" 303

echo "== barcodes =="
# Run-scoped, so a previous run's product cannot make this ambiguous.
BC="90${RUN}"
req POST /items "{\"name\":\"Baked Beans\",\"room_id\":\"$GARAGE\",\"barcode\":\"$BC\"}"; check "item with a barcode" 201
BEANS=$(field "id")
req GET "/scan?code=$BC"; check "scan resolves a barcode" 200
printf '        %s -> %s\n' "$(field "kind")" "$(field "app_url")"
req GET "/scan?code=$(printf '%s' "$BC" | sed 's/./&%20/3' | sed 's/./&-/6')"; check "spaces and hyphens ignored" 200

# Two of the same product is normal; the scan then offers a choice.
req POST /items "{\"name\":\"Baked Beans (spare)\",\"room_id\":\"$GARAGE\",\"barcode\":\"$BC\"}"; check "a second identical product" 201
req GET "/scan?code=$BC"; check "duplicate barcode returns a list" 200
printf '        kind: %s (%s items)\n' "$(field "kind")" "$(python3 -c "
import json,sys
print(len(json.loads(sys.argv[1])['items']))" "$BODY")"
req GET "/scan?code=$BOXSLUG"; check "scan resolves our own code" 200
printf '        %s -> %s\n' "$(field "kind")" "$(field "storage_unit.name")"
req GET "/scan?code=$ROOT/q/$BOXSLUG"; check "scan resolves a full label URL" 200
req GET "/scan?code=0000000000000"; check "unknown code is a 404" 404
printf '        %s\n' "$(field "kind")"
req GET "/scan"; check "scan without a code rejected" 400
req GET "/items?has_barcode=true"; check "filter to items with barcodes" 200
req PATCH "/items/$BEANS" '{"barcode":""}'; check "clear a barcode" 200

echo "== tags =="
req GET /tags; check "tag vocabulary" 200
req POST /tags "{\"name\":\"  Test Tag $RUN  \"}"; check "create tag (normalised)" 201
printf '        stored as: %s\n' "$(field "name")"
req PATCH "/tags/test%20tag%20$RUN" "{\"name\":\"kit $RUN\"}"; check "rename tag" 200
req PATCH "/tags/nope-$RUN" '{"name":"x"}'; check "rename unknown tag 404" 404
req POST /items "{\"name\":\"Tagged Thing\",\"room_id\":\"$GARAGE\",\"tags\":[\"kit $RUN\",\"brand new $RUN\"]}"; check "item tags join the vocabulary" 201
TAGGED=$(field "id")
req GET /tags; check "new tag is catalogued" 200
req DELETE "/tags/kit%20$RUN"; check "delete tag" 204
req GET "/items/$TAGGED"; check "tag stripped from the item" 200
printf '        tags now: %s\n' "$(field "tags")"
req DELETE "/tags/brand%20new%20$RUN"; check "cleanup tag" 204

echo "== custom properties =="
req PATCH "/items/$TAGGED" '{"properties":{"Part of":"Homelab","Brand":"Acme"}}'; check "set properties" 200
printf '        %s\n' "$(field "properties")"
req GET "/items?prop=Part%20of:Homelab"; check "filter by field and value" 200
printf '        matches: %s\n' "$(field "total")"
req GET "/items?prop=Brand"; check "filter by field presence" 200
req GET "/search?q=homelab"; check "search finds a field value" 200
printf '        hits: %s\n' "$(field "total")"
req GET /properties; check "field catalogue" 200
req PATCH "/items/$TAGGED" '{"quantity":3}'; check "unrelated patch keeps fields" 200
printf '        still: %s\n' "$(field "properties")"
req PATCH "/items/$TAGGED" '{"properties":{}}'; check "clear fields" 200
printf '        cleared: %s\n' "$(field "properties")"

echo "== code override =="
req PATCH "/storage-units/$BOX" '{"qr_slug":"pantry01"}'; check "override a printed code" 200
printf '        now: %s\n' "$(field "qr_slug")"
req GET "/scan?code=PANTRY01"; check "the new code resolves" 200
req PATCH "/storage-units/$BOX" '{"qr_slug":"no"}'; check "too-short code rejected" 400
req PATCH "/storage-units/$BOX" '{"qr_slug":"bad code!"}'; check "punctuation rejected" 400
req PATCH "/storage-units/$WARDROBE" '{"qr_slug":"pantry01"}'; check "duplicate code rejected" 409
req POST "/storage-units/$BOX/qr/regenerate" ''; check "issue a fresh code" 200
NEWSLUG=$(field "qr_slug")
printf '        reissued: %s\n' "$NEWSLUG"
req GET "/qr/PANTRY01"; check "the retired code stops working" 404

echo "== move =="
req POST "/items/$DRILL/move" "{\"room_id\":\"$GARAGE\"}"; check "move item to another room" 200
printf '        now at: %s\n' "$(field "location.path_string")"
req POST "/items/$DRILL/move" "{\"storage_unit_id\":\"$BOX\"}"; check "move item back into box" 200
printf '        now at: %s\n' "$(field "location.path_string")"

echo "== value and history =="
req PATCH "/items/$DRILL" '{"purchase_price":1000,"purchased_on":"2020-01-01"}'; check "set price and date" 200
printf '        per day: %s (%s days)\n' "$(field "value.per_day")" "$(field "value.days")"
req PATCH "/items/$DRILL" '{"purchased_on":"yesterday"}'; check "bad date rejected" 400
req PATCH "/items/$DRILL" '{"purchase_price":-5}'; check "negative price rejected" 400
req GET "/items?has_price=true&room_id=$ROOM"; check "has_price filter" 200
printf '        priced items in the room: %s\n' "$(field "total")"
req PATCH "/items/$DRILL" '{"purchase_price":null,"purchased_on":null}'; check "clear price and date" 200
printf '        price now: %s\n' "$(field "purchase_price")"
req PATCH "/items/$DRILL" '{"quantity":3}'; check "saving without moving adds no history" 200
req GET "/items/$DRILL/history"; check "item history" 200
printf '        moves: %s\n' "$(python3 -c "import json,sys; print(len(json.loads(sys.argv[1])['moves']))" "$BODY")"
req GET "/activity?limit=3"; check "recent activity" 200

echo "== relocating a unit carries its subtree =="
req PATCH "/storage-units/$SHELF" "{\"room_id\":\"$GARAGE\",\"parent_id\":null}"; check "move shelf to garage" 200
req GET "/items/$DRILL"; check "item followed the move" 200
printf '        drill now at: %s\n' "$(field "location.path_string")"
req PATCH "/storage-units/$SHELF" "{\"parent_id\":\"$WARDROBE\"}"; check "move shelf back under wardrobe" 200

echo "== deletes =="
req DELETE "/rooms/$ROOM"; check "non-empty room delete blocked" 409
req DELETE "/storage-units/$SHELF"; check "delete shelf (promotes contents)" 204
req GET "/items/$DRILL"; check "drill survived, promoted" 200
printf '        drill now at: %s\n' "$(field "location.path_string")"
req DELETE "/items/$JACKET"; check "delete item" 204
req GET "/items/$JACKET"; check "deleted item is gone" 404
req DELETE "/items/$LADDER"; check "delete loose item" 204
req DELETE "/rooms/$ROOM?cascade=true"; check "cascade room delete" 204
req GET "/rooms/$ROOM"; check "room gone" 404
req GET "/items/$DRILL"; check "cascaded item gone" 404
req DELETE "/rooms/$GARAGE?cascade=true"; check "cleanup garage" 204
req DELETE "/rooms/$UPSTAIRS"; check "cleanup upstairs" 204
req DELETE "/rooms/$LOFT"; check "cleanup loft" 204
req DELETE "/rooms/$CELLAR"; check "cleanup cellar" 204

echo
if [ "$fails" -eq 0 ]; then
  echo "all checks passed"
else
  echo "$fails check(s) failed"
  exit 1
fi
