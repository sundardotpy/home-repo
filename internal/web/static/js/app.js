// Screens, routing and the actions that drive optimistic mutations.

import { api, get, post, qs } from './api.js';
import { closeAnyPopup, createSelect, wireAccordions } from './components.js';
import { BRAND_ICONS, BRAND_KEYS } from './brand-icons.js';
import { MONOGRAMS, MONOGRAM_KEYS } from './brand-monograms.js';
import { checkSession, lockNow, lockRequired, showLock } from './lock.js';
import { ICON_GROUPS, ICON_KEYS, ITEM_ICONS, iconLabel, isBrandKey, itemIconSVG, suggestIcon } from './item-icons.js';
import { barcodeCaptureSheet, labelCard, qrSheet, scanSheet } from './labels.js';
import { openVoiceSheet } from './voice.js';
import { ago, pathText, rupees, rupeesPerDay, setValueLine, valueLine } from './look.js';
import { attachPhoto, removePhoto } from './photos.js';
import * as store from './store.js';
import { manageTagSheet, propertyEditor, propertyList, tagChips, tagPickerSheet } from './taxonomy.js';
import { appearanceMarkup, initTheme, wireAppearance } from './theme.js';
import {
  addRow,
  emptyState,
  esc,
  field,
  ghostButton,
  icon,
  inputCls,
  itemAvatar,
  itemRow,
  listCard,
  moveRow,
  openSheet,
  closeAllSheets,
  plural,
  primaryButton,
  tonalButton,
  roomBadge,
  roomTint,
  topBar,
  barAction,
  drawerPath,
  roomRow,
  sectionTitle,
  skeletonList,
  toast,
  unitRow,
  valuePill,
} from './ui.js';

const screenEl = () => document.getElementById('screen');
const headerEl = () => document.getElementById('header');

// ------------------------------------------------------------- utilities ---

const rooms = () => store.peek('/rooms').data?.rooms || [];
const roomById = (id) => rooms().find((r) => r.id === id);

// ------------------------------------------------------------------ floors --

// The floors offered when creating a room. Anything else can be typed as a name.
const FLOOR_CHOICES = [-2, -1, 0, 1, 2, 3, 4];

export function floorLabel(floor, name = '') {
  const n = (name || '').trim();
  if (n) return n;
  if (floor === 0) return 'Ground floor';
  if (floor === -1) return 'Basement';
  if (floor < -1) return `Basement ${-floor}`;
  const s = ['th', 'st', 'nd', 'rd'][floor % 100 >= 11 && floor % 100 <= 13 ? 0 : Math.min(floor % 10, 4)] || 'th';
  return `${floor}${s} floor`;
}

// Floors only earn screen space once there is more than one of them.
const floorsInUse = () => [...new Set(rooms().map((r) => r.floor))].sort((a, b) => a - b);
const multiFloor = () => floorsInUse().length > 1;

function roomsByFloor() {
  const groups = new Map();
  for (const r of rooms()) {
    if (!groups.has(r.floor)) groups.set(r.floor, []);
    groups.get(r.floor).push(r);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

// Flatten a nested unit tree for pickers and for depth-aware rendering.
function flattenUnits(units, depth = 0, out = []) {
  for (const u of units || []) {
    out.push({ ...u, _depth: depth });
    flattenUnits(u.children, depth + 1, out);
  }
  return out;
}

function locationFor(roomId, unit) {
  const room = roomById(roomId);
  const path = [room?.name || 'Room', ...(unit?.path || [])];
  return {
    room_id: roomId,
    room_name: room?.name || '',
    storage_unit_id: unit?.id || null,
    path,
    path_string: path.join(' > '),
  };
}

// ------------------------------------------------------------- actions -----

function addItem({
  name, description, quantity, tags, icon: iconKey = '', barcode = '',
  properties = {}, purchasePrice = null, purchasedOn = null, roomId, unit,
}) {
  const id = store.tempId();
  const record = {
    id,
    name,
    description: description || '',
    quantity,
    tags,
    icon: iconKey,
    barcode,
    properties,
    purchase_price: purchasePrice,
    purchased_on: purchasedOn,
    room_id: roomId,
    storage_unit_id: unit?.id || null,
    photo_path: null,
    location: locationFor(roomId, unit),
    created_at: new Date().toISOString(),
  };
  store.mutate({
    kind: 'item.create',
    method: 'POST',
    path: '/items',
    body: {
      name,
      description: description || '',
      quantity,
      tags,
      icon: iconKey,
      barcode,
      properties,
      purchase_price: purchasePrice ?? undefined,
      purchased_on: purchasedOn || undefined,
      room_id: unit ? undefined : roomId,
      storage_unit_id: unit?.id || undefined,
    },
    temp: id,
    record,
  });
  toast(`Put away ${name}`);
  return id;
}

function updateItem(item, patch) {
  store.mutate({
    kind: 'item.update',
    method: 'PATCH',
    path: `/items/${item.id}`,
    body: patch,
    targetId: item.id,
    temp: item.id,
    record: patch,
  });
}

function moveItem(item, roomId, unit) {
  const record = {
    ...item,
    room_id: roomId,
    storage_unit_id: unit?.id || null,
    location: locationFor(roomId, unit),
  };
  store.mutate({
    kind: 'item.move',
    method: 'POST',
    path: `/items/${item.id}/move`,
    body: unit ? { storage_unit_id: unit.id } : { room_id: roomId },
    targetId: item.id,
    temp: item.id,
    record,
  });
  toast(`Moved to ${pathText(record.location.path)}`);
}

// Into another item: the container decides room and unit, the server guards cycles.
function moveIntoItem(item, container) {
  const path = [...(container.location?.path || []), container.name];
  const record = {
    ...item,
    room_id: container.room_id,
    storage_unit_id: container.storage_unit_id || null,
    parent_item_id: container.id,
    location: {
      ...container.location,
      container_id: container.id,
      path,
      path_string: path.join(' > '),
    },
  };
  store.mutate({
    kind: 'item.move',
    method: 'POST',
    path: `/items/${item.id}/move`,
    body: { parent_item_id: container.id },
    targetId: item.id,
    temp: item.id,
    record,
  });
  toast(`Moved into ${container.name}`);
}

function deleteItem(item) {
  store.mutate({
    kind: 'item.delete',
    method: 'DELETE',
    path: `/items/${item.id}`,
    targetId: item.id,
    record: item,
  });
  toast(`Deleted ${item.name}`, {
    action: 'Undo',
    onAction: () =>
      addItem({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        tags: item.tags,
        roomId: item.room_id,
        unit: item.storage_unit_id ? { id: item.storage_unit_id, path: item.location?.path?.slice(1) } : null,
      }),
  });
}

function addRoom({ name, floor = 0, floorName = '' }) {
  const id = store.tempId();
  store.mutate({
    kind: 'room.create',
    method: 'POST',
    path: '/rooms',
    body: { name, floor, floor_name: floorName },
    temp: id,
    record: {
      id,
      name,
      description: '',
      floor,
      floor_name: floorName,
      floor_label: floorLabel(floor, floorName),
      storage_unit_count: 0,
      item_count: 0,
    },
  });
}

function updateRoom(room, { name, floor, floorName }) {
  store.mutate({
    kind: 'room.update',
    method: 'PATCH',
    path: `/rooms/${room.id}`,
    body: { name, floor, floor_name: floorName },
    targetId: room.id,
    record: { name, floor, floor_name: floorName, floor_label: floorLabel(floor, floorName) },
  });
}

function addUnit({ name, kind, roomId, parent }) {
  const id = store.tempId();
  store.mutate({
    kind: 'unit.create',
    method: 'POST',
    path: '/storage-units',
    body: {
      name,
      kind: kind || '',
      parent_id: parent?.id || undefined,
      room_id: parent ? undefined : roomId,
    },
    temp: id,
    record: {
      id,
      name,
      kind: kind || '',
      room_id: roomId,
      parent_id: parent?.id || null,
      item_count: 0,
      children: [],
      path: [...(parent?.path || []), name],
      depth: (parent?.depth || 0) + 1,
    },
  });
}

function renameEntity(kind, entity, name) {
  store.mutate({
    kind: `${kind}.update`,
    method: 'PATCH',
    path: kind === 'room' ? `/rooms/${entity.id}` : `/storage-units/${entity.id}`,
    body: { name },
    targetId: entity.id,
  });
}

function deleteEntity(kind, entity, cascade) {
  const base = kind === 'room' ? `/rooms/${entity.id}` : `/storage-units/${entity.id}`;
  store.mutate({
    kind: `${kind}.delete`,
    method: 'DELETE',
    path: base + (cascade ? '?cascade=true' : ''),
    targetId: entity.id,
  });
  toast(`Deleted ${entity.name}`);
}

// --------------------------------------------------------------- sheets ----

// One sheet handles add and edit; the difference is only the starting values.
function itemSheet({ item = null, roomId = null, unitId = null, barcode = '', focusPrice = false } = {}) {
  const editing = !!item;
  store.load('/rooms');

  let selectedRoom = item?.room_id || roomId || rooms()[0]?.id || '';
  let selectedUnit = item?.storage_unit_id || unitId || '';

  openSheet({
    title: editing ? 'Edit item' : 'Add (bought)',
    body: `
      <form data-form>
        <div class="flex items-end gap-3 mb-4">
          <button type="button" data-pick-icon data-preview aria-label="Choose an icon"
            class="avatar w-14 h-14 mb-px shrink-0 bg-[var(--sunken)] overflow-hidden grid place-items-center text-[var(--ink-faint)] transition-colors">
            ${
              item?.photo_thumb_url
                ? `<img src="${esc(item.photo_thumb_url)}" alt="" class="w-full h-full object-cover">`
                : item?.icon
                  ? `<span class="text-[var(--ink)]">${itemIconSVG(item.icon, 'w-7 h-7')}</span>`
                  : icon('box', 'w-6 h-6')
            }
          </button>
          <label class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-[var(--ink-soft)] mb-1.5">What is it?</span>
            <input name="name" class="${inputCls}" required autocomplete="off"
              placeholder="Spare earphones" value="${esc(item?.name || '')}">
          </label>
        </div>

        <div class="mb-1">
          <span class="block text-sm font-medium text-[var(--ink-soft)] mb-2">Where did it go?</span>
          <div data-recent-places class="flex flex-wrap gap-2 mb-3 hidden"></div>
        </div>
        ${field('Room', `<div data-room-select></div>`)}
        ${field('Storage unit', `<div data-unit-select></div>`,
          'Leave as "Anywhere in the room" for things that are not in a box.')}

        <div class="grid grid-cols-2 gap-3">
          ${field('Price (₹)', `<input name="price" type="number" inputmode="decimal" min="0" step="any"
              class="${inputCls}" placeholder="1499" value="${esc(item?.purchase_price ?? '')}">`)}
          ${field('Bought on', `<input name="bought" type="date" max="${new Date().toISOString().slice(0, 10)}"
              class="${inputCls}" value="${esc(item?.purchased_on || '')}">`)}
        </div>
        <p class="-mt-2 mb-4 text-xs text-[var(--ink-faint)]">Optional. With both, the app can tell you what it costs per day.</p>

        <details class="mb-5 group" ${editing ? 'open' : ''}>
          <summary class="cursor-pointer list-none flex items-center justify-between h-11 text-sm font-semibold text-[var(--ink-soft)]">
            <span>More details: photo, tags, barcode, fields</span>
            <span class="transition-transform group-open:rotate-90">${icon('chevron', 'w-4 h-4')}</span>
          </summary>
          <div class="pt-2">
            <div class="flex flex-wrap gap-2 mb-4">
              <label class="btn btn-ghost !h-11 cursor-pointer">
                ${icon('camera', 'w-5 h-5')}
                <span data-photo-label>${item?.photo_thumb_url ? 'Change photo' : 'Photo'}</span>
                <!-- accept+capture is what opens the camera directly on a phone -->
                <input type="file" name="photo" accept="image/*" capture="environment" class="hidden">
              </label>
              <button type="button" data-pick-icon class="btn btn-ghost !h-11">${icon('layers', 'w-5 h-5')} Icon</button>
              <button type="button" data-clear-photo
                class="h-11 px-3 rounded-lg text-[var(--ink-soft)] font-medium active:bg-[var(--sunken)] transition-colors ${item?.photo_thumb_url || item?.icon ? '' : 'hidden'}">
                Clear
              </button>
            </div>
            <div class="grid grid-cols-[1fr_auto] gap-3">
              ${field(
                'Tags',
                `<button type="button" data-pick-tags
                   class="${inputCls} flex items-center gap-1.5 flex-wrap text-left h-auto min-h-12 py-1.5">
                   <span data-tag-chips class="flex flex-wrap gap-1.5"></span>
                 </button>`,
              )}
              ${field('Qty', `<input name="quantity" type="number" min="0" inputmode="numeric"
                  class="${inputCls} w-20 text-center" value="${esc(item?.quantity ?? 1)}">`)}
            </div>
            ${field(
              'Barcode',
              `<div class="flex gap-2">
                 <input name="barcode" class="${inputCls} font-mono" autocomplete="off" inputmode="numeric"
                   placeholder="5000157024671" value="${esc(item?.barcode || barcode)}">
                 <button type="button" data-scan-barcode aria-label="Scan barcode"
                   class="w-12 h-12 shrink-0 grid place-items-center rounded-lg bg-[var(--sunken)] active:bg-[var(--line)] transition-colors">
                   ${icon('barcode', 'w-5 h-5')}
                 </button>
               </div>`,
              'For shop-bought products. Scanning the box finds it, no QR label needed.',
            )}
            ${field(
              'Custom fields',
              `<div data-properties></div>`,
              'Anything you want to record, such as "Part of: Homelab" or "Warranty until: 2027-03".',
            )}
          </div>
        </details>

        <div class="flex gap-2 pt-1">
          ${primaryButton(editing ? 'Save' : 'Add', 'data-save class="flex-1"')}
          ${editing ? ghostButton(icon('trash', 'w-5 h-5'), 'data-delete aria-label="Delete item"') : ''}
        </div>
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');

      // Tags live in a picker now, and properties in their own editor; both keep
      // their state here until save.
      let tags = [...(item?.tags || [])];
      const chipsEl = body.querySelector('[data-tag-chips]');
      const paintTags = () => {
        chipsEl.innerHTML = tags.length
          ? tagChips(tags)
          : `<span class="text-[var(--ink-faint)]">Add tags</span>`;
      };
      paintTags();
      body.querySelector('[data-pick-tags]').addEventListener('click', () =>
        tagPickerSheet(tags, (next) => {
          tags = next;
          paintTags();
          props.refreshSuggestions(); // suggested fields follow the tags
          autoIcon();
        }),
      );

      const props = propertyEditor(
        body.querySelector('[data-properties]'),
        item?.properties || {},
        () => tags,
      );

      // Photo and icon choices are applied on save, with the rest of the form.
      let pickedPhoto = null;
      let clearPhoto = false;
      let chosenIcon = item?.icon || '';
      let iconTouched = !!item?.icon;
      const preview = body.querySelector('[data-preview]');
      const clearBtn = body.querySelector('[data-clear-photo]');

      const paintPreview = () => {
        if (pickedPhoto) return; // a real photo always wins
        preview.innerHTML = chosenIcon
          ? `<span class="text-[var(--ink)]">${itemIconSVG(chosenIcon, 'w-7 h-7')}</span>`
          : item?.photo_thumb_url && !clearPhoto
            ? `<img src="${esc(item.photo_thumb_url)}" alt="" class="w-full h-full object-cover">`
            : icon('box', 'w-6 h-6');
        clearBtn.classList.toggle('hidden', !chosenIcon && !(item?.photo_thumb_url && !clearPhoto));
      };

      form.photo.addEventListener('change', () => {
        const file = form.photo.files?.[0];
        if (!file) return;
        pickedPhoto = file;
        clearPhoto = false;
        // Show it here too, before anything has been uploaded.
        preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" class="w-full h-full object-cover">`;
        body.querySelector('[data-photo-label]').textContent = 'Change';
        clearBtn.classList.remove('hidden');
      });

      clearBtn.addEventListener('click', () => {
        pickedPhoto = null;
        clearPhoto = !!item?.photo_thumb_url;
        chosenIcon = '';
        iconTouched = true;
        form.photo.value = '';
        body.querySelector('[data-photo-label]').textContent = 'Photo';
        paintPreview();
      });

      // Scanning here fills the field rather than navigating away.
      body.querySelector('[data-scan-barcode]').addEventListener('click', () => {
        barcodeCaptureSheet((code) => {
          form.barcode.value = code;
          toast(`Barcode ${code}`);
        });
      });

      body.querySelectorAll('[data-pick-icon]').forEach((b) =>
        b.addEventListener('click', () => {
          iconPickerSheet(chosenIcon, (key) => {
            chosenIcon = key;
            iconTouched = true;
            paintPreview();
          });
        }),
      );

      // Until the user picks one themselves, the icon follows what they type.
      function autoIcon() {
        if (iconTouched) return;
        const guess = suggestIcon(form.name.value, tags);
        if (guess !== chosenIcon) {
          chosenIcon = guess;
          paintPreview();
        }
      }
      form.name.addEventListener('input', autoIcon);

      // App-drawn dropdowns rather than native <select>s: these can show the
      // floor a room is on, and indent a unit under its parent.
      const roomOptions = () =>
        rooms().map((r) => ({
          value: r.id,
          label: r.name,
          hint: multiFloor() ? r.floor_label : '',
        }));

      const unitOptions = () => {
        const flat = flattenUnits(store.peek(`/rooms/${selectedRoom}/tree`).data?.storage_units || []);
        return [
          { value: '', label: 'Anywhere in the room' },
          ...flat.map((u) => ({ value: u.id, label: u.name, depth: u._depth + 1 })),
        ];
      };

      const unitSelect = createSelect(body.querySelector('[data-unit-select]'), {
        options: unitOptions(),
        value: selectedUnit,
        onChange: (v) => {
          selectedUnit = v;
        },
      });

      const loadUnits = () => {
        if (!selectedRoom) return;
        store.load(`/rooms/${selectedRoom}/tree`).finally(() => {
          unitSelect.setOptions(unitOptions());
          unitSelect.value = selectedUnit;
        });
      };

      const roomSelect = createSelect(body.querySelector('[data-room-select]'), {
        options: roomOptions(),
        value: selectedRoom,
        placeholder: 'Choose a room',
        onChange: (v) => {
          selectedRoom = v;
          selectedUnit = '';
          unitSelect.setOptions([{ value: '', label: 'Anywhere in the room' }], false);
          loadUnits();
        },
      });

      loadUnits();
      store.load('/rooms').then(() => {
        if (!selectedRoom && rooms()[0]) {
          selectedRoom = rooms()[0].id;
          loadUnits();
        }
        roomSelect.setOptions(roomOptions());
        roomSelect.value = selectedRoom;
      });

      // One tap for the places things have gone lately.
      const recentHolder = body.querySelector('[data-recent-places]');
      const paintRecent = () => {
        const places = recentPlaces(4);
        recentHolder.classList.toggle('hidden', !places.length);
        recentHolder.innerHTML = recentChips(places, `${selectedRoom}|${selectedUnit}`);
        recentHolder.querySelectorAll('[data-recent]').forEach((b) =>
          b.addEventListener('click', () => {
            const p = places[Number(b.dataset.recent)];
            placeTouched = true;
            selectedRoom = p.roomId;
            selectedUnit = p.unitId;
            roomSelect.value = selectedRoom;
            loadUnits();
            paintRecent();
          }),
        );
      };
      // A fresh item starts where the last one went, unless told otherwise.
      let placeTouched = !!(editing || roomId || unitId);
      store
        .load('/activity?limit=30')
        .then(() => {
          const last = recentPlaces(1)[0];
          if (last && !placeTouched) {
            selectedRoom = last.roomId;
            selectedUnit = last.unitId;
            roomSelect.value = selectedRoom;
            loadUnits();
          }
          paintRecent();
        })
        .catch(() => {});
      paintRecent();
      body.querySelector('[data-room-select]').addEventListener('click', () => (placeTouched = true));
      body.querySelector('[data-unit-select]').addEventListener('click', () => (placeTouched = true));

      form.querySelector('[data-save]').addEventListener('click', () => {
        const name = form.name.value.trim();
        if (!name) {
          form.name.focus();
          return;
        }
        const quantity = Math.max(0, parseInt(form.quantity.value, 10) || 0);
        const barcode = form.barcode.value.trim().replace(/[\s-]/g, '');
        const unitId2 = unitSelect.value || '';
        const flat = flattenUnits(store.peek(`/rooms/${selectedRoom}/tree`).data?.storage_units || []);
        const unit = flat.find((u) => u.id === unitId2) || null;
        // An untouched suggestion still counts as the user's choice on save.
        const iconKey = chosenIcon;
        const priceRaw = form.price.value.trim();
        const purchasePrice = priceRaw === '' ? null : Number(priceRaw);
        const purchasedOn = form.bought.value || null;
        if (purchasePrice !== null && !(purchasePrice >= 0)) {
          form.price.focus();
          return toast('Enter the price as a number', { tone: 'error' });
        }

        // Close first: the point is that the UI never waits.
        close();

        const properties = props.values();

        if (editing) {
          updateItem(item, {
            name, quantity, tags, icon: iconKey, barcode, properties,
            purchase_price: purchasePrice, purchased_on: purchasedOn,
          });
          const moved = (item.storage_unit_id || '') !== unitId2 || item.room_id !== selectedRoom;
          if (moved) moveItem({ ...item, name, quantity, tags, icon: iconKey }, selectedRoom, unit);
          if (pickedPhoto) attachPhoto(item.id, pickedPhoto);
          else if (clearPhoto) removePhoto(item);
        } else {
          const newId = addItem({
            name, quantity, tags, icon: iconKey, barcode, properties,
            purchasePrice, purchasedOn, roomId: selectedRoom, unit,
          });
          // The upload waits for the item's own POST to return an id.
          if (pickedPhoto) attachPhoto(newId, pickedPhoto);
        }
      });

      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        close();
        deleteItem(item);
      });

      if (focusPrice) setTimeout(() => form.price.focus(), 250);
      else if (!editing) setTimeout(() => form.name.focus(), 250);
    },
  });
}

// The icon grid: everyday things grouped by where they live, plus product
// brands. Filterable, because two hundred icons is more than anyone wants to
// scroll on a phone.
function iconPickerSheet(selected, onPick) {
  let tab = isBrandKey(selected) ? 'brands' : 'things';
  let query = '';

  const cell = (key) => {
    const on = key === selected;
    return `
      <button type="button" data-icon="${esc(key)}" title="${esc(iconLabel(key))}"
        class="aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1
               transition-[transform,background-color] active:scale-95
               ${on
                 ? 'border-[var(--ink)] bg-[var(--accent-tonal)] text-[var(--ink)]'
                 : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]'}">
        ${itemIconSVG(key, 'w-6 h-6')}
        <span class="t-label-sm text-center truncate w-full px-0.5">${esc(iconLabel(key))}</span>
      </button>`;
  };

  const matches = (key) => {
    if (!query) return true;
    if (isBrandKey(key)) return iconLabel(key).toLowerCase().includes(query) || key.slice(6).includes(query);
    const d = ITEM_ICONS[key];
    return d.label.toLowerCase().includes(query) || d.keywords.some((w) => w.includes(query));
  };

  const grid = (keys) =>
    `<div class="grid grid-cols-4 sm:grid-cols-5 gap-2">${keys.map(cell).join('')}</div>`;

  const content = () => {
    if (tab === 'brands') {
      // A hundred-odd marks read best alphabetically; the monogram groups come
      // from the data, in the order brand-monograms.js lists them.
      const real = [...BRAND_KEYS]
        .sort((a, b) => BRAND_ICONS[a].localeCompare(BRAND_ICONS[b], 'en', { sensitivity: 'base' }))
        .map((k) => `brand:${k}`)
        .filter(matches);
      const note = `<p class="text-xs text-[var(--ink-soft)] mt-5 mb-2">No official mark to ship for these, so each is a badge with the brand's initials, not its logo.</p>`;
      const mono = MONOGRAM_KEYS.filter((k) => !BRAND_ICONS[k]).map((k) => `brand:${k}`).filter(matches);
      if (!real.length && !mono.length) return nothing();
      return (
        (real.length ? grid(real) : '') +
        (mono.length
          ? note +
            [...new Set(Object.values(MONOGRAMS).map((m) => m.group))]
              .map((g) => {
                const ks = mono.filter((k) => MONOGRAMS[k.slice(6)].group === g);
                return ks.length
                  ? `<h3 class="section-title mt-4 mb-2">${esc(g)}</h3>${grid(ks)}`
                  : '';
              })
              .join('')
          : '')
      );
    }
    if (query) {
      const keys = ICON_KEYS.filter(matches);
      return keys.length ? grid(keys) : nothing();
    }
    return ICON_GROUPS.map((g) => {
      const keys = ICON_KEYS.filter((k) => ITEM_ICONS[k].group === g);
      return keys.length
        ? `<h3 class="section-title mt-5 mb-2">${esc(g)}</h3>${grid(keys)}`
        : '';
    }).join('');
  };
  const nothing = () =>
    `<p class="text-center text-sm text-[var(--ink-soft)] py-6">Nothing matches "${esc(query)}".</p>`;

  openSheet({
    title: 'Choose an icon',
    body: `
      <div class="segmented mb-3" role="radiogroup" aria-label="Icon set" data-tabs></div>
      <input data-filter class="${inputCls}" placeholder="Filter icons" autocomplete="off">
      <div data-content class="-mt-2"></div>
      <button type="button" data-none class="btn btn-ghost w-full mt-5">No icon</button>`,
    onMount(body, close) {
      const tabsEl = body.querySelector('[data-tabs]');
      const holder = body.querySelector('[data-content]');

      const paint = () => {
        tabsEl.innerHTML = [['things', 'Things'], ['brands', 'Brands']]
          .map(
            ([id, label]) => `
          <button type="button" data-tab="${id}"
            role="radio" aria-checked="${tab === id}">${tab === id ? icon('check', 'w-4 h-4') : ''}${label}</button>`,
          )
          .join('');
        tabsEl.querySelectorAll('[data-tab]').forEach((b) =>
          b.addEventListener('click', () => {
            tab = b.dataset.tab;
            paint();
          }),
        );
        holder.innerHTML = content();
        holder.querySelectorAll('[data-icon]').forEach((b) =>
          b.addEventListener('click', () => {
            close();
            onPick(b.dataset.icon);
          }),
        );
      };
      paint();

      body.querySelector('[data-filter]').addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        paint();
      });
      body.querySelector('[data-none]').addEventListener('click', () => {
        close();
        onPick('');
      });
    },
  });
}

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Where things went lately, most recent first, one entry per place. Offered as
// one-tap choices: you usually put the next thing where you put the last.
function recentPlaces(limit = 4, excludeKey = '') {
  const moves = store.peek('/activity?limit=30').data?.moves || [];
  const seen = new Set();
  const out = [];
  for (const m of moves) {
    const key = `${m.to_room_id}|${m.to_unit_id || ''}`;
    if (seen.has(key) || key === excludeKey) continue;
    seen.add(key);
    out.push({ roomId: m.to_room_id, unitId: m.to_unit_id || '', path: m.to_path });
    if (out.length >= limit) break;
  }
  return out;
}

const recentChips = (places, activeKey = '') =>
  places
    .map(
      (p, i) => `
    <button type="button" data-recent="${i}" aria-pressed="${`${p.roomId}|${p.unitId}` === activeKey}"
      class="h-10 px-3 max-w-full inline-flex items-center gap-2 rounded-[10px] text-sm font-medium t-path ${
        `${p.roomId}|${p.unitId}` === activeKey
          ? 'bg-[var(--accent-tonal)]'
          : 'border border-[var(--line)] text-[var(--ink-soft)]'
      }"><span class="room-badge ${roomTint(p.path?.[0])} w-3 h-3 rounded-[3px] shrink-0"></span><span class="truncate">${esc(pathText(p.path))}</span></button>`,
    )
    .join('');

// The moves of one item, as a log: what changed, when, and the line it went to.
function historyMarkup(moves) {
  return moves
    .slice(0, 8)
    .map(
      (m, i) => `
    <div class="flex gap-3 items-start">
      <span class="journey-dot mt-1 ${i === 0 ? 'is-here' : ''}"></span>
      <span class="flex-1 min-w-0 pb-4">
        <span class="flex items-baseline justify-between gap-2">
          <span class="font-semibold text-sm">${
            m.kind === 'added' ? 'Added'
              : m.kind === 'decluttered' ? 'Decluttered'
                : 'Moved'
          }${m.quantity ? ` ×${m.quantity}` : ''}</span>
          <span class="text-xs text-[var(--ink-faint)] shrink-0">${esc(ago(m.moved_at, { long: true }))}</span>
        </span>
        <span class="block mt-1 text-xs leading-relaxed t-path">
          ${m.from_path?.length ? `<span class="block diff-del truncate">${esc(pathText(m.from_path))}</span>` : ''}
          <span class="block diff-add truncate">${esc(pathText(m.to_path))}</span>
        </span>
      </span>
    </div>`,
    )
    .join('');
}

function itemDetailSheet(item) {
  const parts = item.location?.path || [];
  const v = item.value;
  const line = valueLine();
  const under = v && v.per_day < line;

  const valueCard = v
    ? `
      <section>
        <h3 class="section-title">Value so far</h3>
        <p class="mt-1 flex items-center gap-2 flex-wrap text-sm tabular-nums">
          <span class="text-[var(--ink)] font-medium">${rupeesPerDay(v.per_day)} a day</span>
          <span class="pill ${under ? 'pill-good' : 'pill-warn'}">${under ? 'Under' : 'Over'} ${rupees(line)}/day</span>
        </p>
        <p class="text-sm text-[var(--ink-soft)] tabular-nums">
          ${rupees(item.purchase_price)} · bought ${esc(fmtDate(item.purchased_on))} · ${plural(v.days, 'day', 'days')}
        </p>
      </section>`
    : `
      <button type="button" data-add-price
        class="row-press w-full text-left rounded-[var(--radius-card)] border border-[var(--line)] p-4 text-sm text-[var(--ink-soft)] leading-snug">
        Add a price and date to see what this costs per day. <b class="font-medium text-[var(--accent-ink)]">Add</b>
      </button>`;

  openSheet({
    title: item.name,
    body: `
      <div class="space-y-4">
        ${
          item.photo_url
            ? `<div class="rounded-xl overflow-hidden bg-[var(--sunken)] skeleton">
                 <img src="${esc(item.photo_url)}" alt="${esc(item.name)}" data-photo
                      class="w-full max-h-72 object-cover opacity-0 transition-opacity duration-200">
               </div>`
            : ''
        }
        <div class="flex items-center gap-3">
          ${itemAvatar(item, 'w-16 h-16')}
          <div class="min-w-0">
            <div class="flex flex-wrap gap-1.5">
              ${(item.tags || []).slice(0, 4).map((tag) => `<span class="pill pill-quiet">${esc(tag)}</span>`).join('') ||
                '<span class="text-sm text-[var(--ink-faint)]">No tags</span>'}
            </div>
            ${item.quantity > 1 ? `<p class="text-sm text-[var(--ink-soft)] mt-1.5">Quantity ${esc(item.quantity)}</p>` : ''}
          </div>
        </div>

        <section>
          <h3 class="section-title">Where it is${multiFloor() ? ` · ${esc(item.location.floor_label)}` : ''}</h3>
          ${drawerPath(parts)}
          <p class="mt-3 text-sm text-[var(--ink-soft)]" data-lastmoved></p>
        </section>

        <div class="flex gap-2">
          ${primaryButton('Move it', 'data-move class="flex-1"')}
          ${
            item.status === 'decluttered'
              ? ghostButton('Restore', 'data-declutter class="flex-1"')
              : ghostButton('Declutter', 'data-declutter class="flex-1"')
          }
        </div>
        <div class="flex gap-1 -mx-3 -mt-2">
          <button type="button" data-edit class="btn btn-text">${icon('pencil', 'w-5 h-5')} Edit details</button>
          <button type="button" data-delete class="btn btn-text !text-[var(--error)]">${icon('trash', 'w-5 h-5')} Delete</button>
        </div>

        ${
          item.status === 'decluttered'
            ? `<div class="surface p-3 text-sm text-[var(--ink-soft)]">
                 ${esc('Decluttered — out of the house, kept in the record.')}
                 ${item.declutter_note ? `<span class="font-medium">${esc(item.declutter_note)}</span>` : ''}
               </div>`
            : ''
        }

        ${valueCard}

        ${
          item.barcode
            ? `<div class="surface p-3 flex items-center gap-3">
                 <span class="text-[var(--ink-soft)]">${icon('barcode', 'w-5 h-5')}</span>
                 <span class="flex-1 min-w-0">
                   <span class="block text-sm text-[var(--ink-soft)]">Barcode</span>
                   <span class="block font-mono tracking-wider truncate">${esc(item.barcode)}</span>
                 </span>
               </div>`
            : ''
        }
        ${propertyList(item.properties)}
        ${item.description ? `<div class="surface p-3"><div class="text-sm text-[var(--ink-soft)] mb-1">Notes</div><div>${esc(item.description)}</div></div>` : ''}

        <section data-history class="hidden">
          <h3 class="section-title mb-3">History</h3>
          <div class="journey" data-history-body></div>
        </section>
      </div>`,
    onMount(body, close) {
      // The shimmer stays until the full-size image has actually decoded.
      const photo = body.querySelector('[data-photo]');
      if (photo) {
        const reveal = () => {
          photo.classList.remove('opacity-0');
          photo.parentElement.classList.remove('skeleton');
        };
        photo.complete ? reveal() : photo.addEventListener('load', reveal, { once: true });
      }
      body.querySelector('[data-edit]').addEventListener('click', () => {
        close();
        itemSheet({ item });
      });
      body.querySelector('[data-add-price]')?.addEventListener('click', () => {
        close();
        itemSheet({ item, focusPrice: true });
      });
      body.querySelector('[data-move]').addEventListener('click', () => {
        close();
        moveSheet(item);
      });
      body.querySelector('[data-declutter]').addEventListener('click', () => {
        if (item.status === 'decluttered') {
          // Back into the active inventory, where it was.
          api('PATCH', `/items/${item.id}`, { status: 'active' }).then(() => {
            close();
            store.revalidate();
            toast('Restored');
          });
          return;
        }
        close();
        promptSheet({
          title: 'Decluttered',
          label: 'Note (optional)',
          value: '',
          onSubmit: (note) => {
            post(`/items/${item.id}/declutter`, { note }).then(() => store.revalidate());
            toast(`${item.name} decluttered`);
          },
        });
      });
      body.querySelector('[data-delete]').addEventListener('click', () => {
        close();
        deleteItem(item);
      });

      // History is its own request; the card is useful before it arrives.
      if (!store.isTemp(item.id)) {
        get(`/items/${item.id}/history`)
          .then(({ moves }) => {
            if (!moves?.length) return;
            const last = moves[0];
            body.querySelector('[data-lastmoved]').textContent =
              `${last.kind === 'added' ? 'Put here' : 'Last moved'} ${ago(last.moved_at, { long: true })}`;
            if (moves.length > 1) {
              body.querySelector('[data-history]').classList.remove('hidden');
              body.querySelector('[data-history-body]').innerHTML = historyMarkup(moves);
            }
          })
          .catch(() => {});
      }
    },
  });
}

// "I put it somewhere else": recent places for one tap, or any room and box.
function moveSheet(item) {
  store.load('/rooms');
  store.load('/activity?limit=30').catch(() => {});
  let selectedRoom = item.room_id;
  let selectedUnit = item.storage_unit_id || '';
  let selectedContainer = item.location?.container_id || item.parent_item_id || '';
  const here = `${item.room_id}|${item.storage_unit_id || ''}`;
  // Cycle guard: the item itself and everything nested inside it can't hold it.
  const blocked = new Set([item.id]);
  const insidePath = `/items?container_id=${item.id}&deep=true&limit=500`;
  const candidatesPath = () => `/items?room_id=${selectedRoom}&limit=500`;

  openSheet({
    title: 'Move it',
    body: `
      <p class="text-sm text-[var(--ink-soft)] mb-3">
        Now in <b class="t-path text-[var(--ink)]">${esc(pathText(item.location?.path || []))}</b>
      </p>
      <div data-recent class="flex flex-wrap gap-2 mb-4"></div>
      ${field('Room', `<div data-room-select></div>`)}
      ${field('Storage unit', `<div data-unit-select></div>`, 'Leave as "Anywhere in the room" for things that are not in a box.')}
      ${field('Put inside another item', `<div data-container-select></div>`, 'A box inside a box, a case inside a bag. It goes wherever that item is.')}
      ${primaryButton('Move here', 'data-save class="w-full"')}`,
    onMount(body, close) {
      const candidates = () =>
        (store.peek(candidatesPath()).data?.items || []).filter((i) => !blocked.has(i.id));
      const containerOptions = () => [
        { value: '', label: 'Not inside anything' },
        ...candidates().map((i) => ({ value: i.id, label: i.name, hint: pathText(i.location?.path || []) })),
      ];
      const containerSelect = createSelect(body.querySelector('[data-container-select]'), {
        options: containerOptions(),
        value: selectedContainer,
        onChange: (v) => {
          selectedContainer = v;
          // The container decides the unit; the two pickers never disagree.
          if (v) {
            selectedUnit = '';
            unitSelect.value = '';
          }
        },
      });
      const loadContainers = () =>
        Promise.all([store.load(candidatesPath()), store.load(insidePath)])
          .then(() => {
            for (const i of store.peek(insidePath).data?.items || []) blocked.add(i.id);
          })
          .catch(() => {})
          .finally(() => {
            containerSelect.setOptions(containerOptions());
            containerSelect.value = selectedContainer;
          });

      const unitOptions = () => {
        const flat = flattenUnits(store.peek(`/rooms/${selectedRoom}/tree`).data?.storage_units || []);
        return [
          { value: '', label: 'Anywhere in the room' },
          ...flat.map((u) => ({ value: u.id, label: u.name, depth: u._depth + 1 })),
        ];
      };
      const roomOptions = () =>
        rooms().map((r) => ({ value: r.id, label: r.name, hint: multiFloor() ? r.floor_label : '' }));

      const unitSelect = createSelect(body.querySelector('[data-unit-select]'), {
        options: unitOptions(),
        value: selectedUnit,
        onChange: (v) => {
          selectedUnit = v;
          selectedContainer = '';
          containerSelect.value = '';
          paintRecent();
        },
      });
      const loadUnits = () =>
        store.load(`/rooms/${selectedRoom}/tree`).finally(() => {
          unitSelect.setOptions(unitOptions());
          unitSelect.value = selectedUnit;
        });
      const roomSelect = createSelect(body.querySelector('[data-room-select]'), {
        options: roomOptions(),
        value: selectedRoom,
        onChange: (v) => {
          selectedRoom = v;
          selectedUnit = '';
          selectedContainer = '';
          unitSelect.setOptions([{ value: '', label: 'Anywhere in the room' }], false);
          loadUnits();
          loadContainers();
          paintRecent();
        },
      });
      loadUnits();
      loadContainers();
      store.load('/rooms').then(() => {
        roomSelect.setOptions(roomOptions());
        roomSelect.value = selectedRoom;
      });

      const holder = body.querySelector('[data-recent]');
      const paintRecent = () => {
        const places = recentPlaces(4, here);
        holder.classList.toggle('hidden', !places.length);
        holder.innerHTML = recentChips(places, `${selectedRoom}|${selectedUnit}`);
        holder.querySelectorAll('[data-recent]').forEach((b) =>
          b.addEventListener('click', () => {
            const p = places[Number(b.dataset.recent)];
            selectedRoom = p.roomId;
            selectedUnit = p.unitId;
            selectedContainer = '';
            roomSelect.value = selectedRoom;
            loadUnits();
            loadContainers();
            paintRecent();
          }),
        );
      };
      paintRecent();
      store.load('/activity?limit=30').then(paintRecent).catch(() => {});

      body.querySelector('[data-save]').addEventListener('click', () => {
        const flat = flattenUnits(store.peek(`/rooms/${selectedRoom}/tree`).data?.storage_units || []);
        const unit = flat.find((u) => u.id === (unitSelect.value || '')) || null;
        const container = candidates().find((i) => i.id === selectedContainer) || null;
        const wasIn = item.location?.container_id || item.parent_item_id || '';
        const unchanged = container
          ? container.id === wasIn
          : !wasIn && selectedRoom === item.room_id && (unit?.id || '') === (item.storage_unit_id || '');
        close();
        if (unchanged) return toast('It is already there');
        if (container) return moveIntoItem(item, container);
        moveItem(item, selectedRoom, unit);
      });
    },
  });
}

// Rooms carry a floor, so that two "Bedroom"s can coexist — and so the server's
// per-floor uniqueness rule has something to work with.
function roomSheet(room = null) {
  const editing = !!room;
  let floor = room?.floor ?? 0;

  openSheet({
    title: editing ? 'Edit room' : 'New room',
    body: `
      <form data-form>
        ${field('Room name', `<input name="name" class="${inputCls}" autocomplete="off"
            placeholder="Bedroom" value="${esc(room?.name || '')}">`)}
        ${field('Floor', `<div data-floor></div>`)}
        ${field(
          'Floor name (optional)',
          `<input name="floor_name" class="${inputCls}" autocomplete="off"
             placeholder="Attic, Annexe…" value="${esc(room?.floor_name || '')}">`,
          'Overrides the floor number wherever the floor is shown.',
        )}
        ${primaryButton(editing ? 'Save' : 'Add room', 'data-ok class="w-full"')}
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      const picker = createSelect(body.querySelector('[data-floor]'), {
        value: String(floor),
        options: FLOOR_CHOICES.map((f) => ({ value: String(f), label: floorLabel(f) })),
        onChange: (v) => {
          floor = Number(v);
        },
      });
      picker.value = String(floor);

      const submit = () => {
        const name = form.name.value.trim();
        if (!name) return form.name.focus();
        const floorName = form.floor_name.value.trim();
        close();
        if (editing) updateRoom(room, { name, floor, floorName });
        else addRoom({ name, floor, floorName });
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      body.querySelector('[data-ok]').addEventListener('click', submit);
      if (!editing) setTimeout(() => form.name.focus(), 250);
    },
  });
}

function promptSheet({ title, label, value = '', placeholder = '', confirm = 'Save', onSubmit }) {
  openSheet({
    title,
    body: `
      <form data-form>
        ${field(label, `<input name="value" class="${inputCls}" autocomplete="off"
            placeholder="${esc(placeholder)}" value="${esc(value)}">`)}
        ${primaryButton(confirm, 'data-ok class="w-full"')}
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      const submit = () => {
        const v = form.value.value.trim();
        if (!v) return form.value.focus();
        close();
        onSubmit(v);
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      body.querySelector('[data-ok]').addEventListener('click', submit);
      setTimeout(() => form.value.focus(), 250);
    },
  });
}

function confirmDeleteSheet({ kind, entity, count }) {
  const noun = kind === 'room' ? 'room' : 'storage unit';
  openSheet({
    title: `Delete ${entity.name}?`,
    body: `
      <p class="text-[var(--ink-soft)] mb-4">
        ${
          count > 0
            ? `This ${noun} still holds things. Choose what happens to them.`
            : `This ${noun} is empty, so nothing else is affected.`
        }
      </p>
      ${
        count > 0
          ? `<label class="flex items-start gap-3 surface p-3 mb-4">
               <input type="checkbox" data-cascade class="mt-1 w-4 h-4 accent-[var(--accent)]">
               <span>
                 <span class="block font-medium">Delete everything inside</span>
                 <span class="block text-sm text-[var(--ink-soft)]">
                   ${kind === 'room' ? 'All its storage units and items are removed.' : 'All nested units and their items are removed.'}
                 </span>
               </span>
             </label>
             <p class="text-sm text-[var(--ink-soft)] mb-4">
               ${kind === 'room' ? 'Without this, the delete is refused while the room has contents.' : 'Without this, everything inside moves up one level instead.'}
             </p>`
          : ''
      }
      <div class="flex gap-2">
        ${ghostButton('Cancel', 'data-cancel class="flex-1"')}
        ${primaryButton('Delete', 'data-confirm class="flex-1"')}
      </div>`,
    onMount(body, close) {
      body.querySelector('[data-cancel]').addEventListener('click', close);
      body.querySelector('[data-confirm]').addEventListener('click', () => {
        const cascade = body.querySelector('[data-cascade]')?.checked || false;
        close();
        deleteEntity(kind, entity, cascade);
        if (kind === 'room') location.hash = '#/';
        else history.back();
      });
    },
  });
}

// ------------------------------------------------------------ navigation ----

// Three destinations, on a phone's bottom bar and in the desktop top bar. Scan
// lives in the search box, and Settings behind the gear.
const NAV = [
  {
    href: '#/',
    label: 'Find',
    icon: 'search',
    on: (h) => h === '' || h === '#/' || h.startsWith('#/search'),
  },
  {
    href: '#/places',
    label: 'Places',
    icon: 'folder',
    on: (h) => /^#\/(places|room|unit|labels)/.test(h),
  },
  { href: '#/value', label: 'Value', icon: 'chart', on: (h) => h.startsWith('#/value') },
];

function renderNav() {
  const hash = location.hash || '#/';
  const bottom = document.getElementById('app-nav');
  bottom.innerHTML = NAV.map((n) => {
    const on = n.on(hash);
    return `<button type="button" data-nav="${n.href}" class="nav-tab ${on ? 'is-active' : ''}"
              ${on ? 'aria-current="page"' : ''}><span class="nav-ind">${icon(n.icon, 'w-6 h-6')}</span><span>${n.label}</span></button>`;
  }).join('');
  bottom.querySelectorAll('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      location.hash = b.dataset.nav;
    }),
  );

  document.getElementById('topnav').innerHTML = NAV.map((n) => {
    const on = n.on(hash);
    return `<a href="${n.href}" class="${on ? 'is-active' : ''}" ${on ? 'aria-current="page"' : ''}>
              <span class="nav-ind">${icon(n.icon, 'w-6 h-6')}</span>${n.label}</a>`;
  }).join('');

  const gear = document.getElementById('topbar-settings');
  gear.innerHTML = icon('settings', 'w-6 h-6');
  gear.classList.toggle('is-active', hash.startsWith('#/settings'));
}


// -------------------------------------------------------------- screens ----

// Any mutation still in flight is worth surfacing, but quietly.
function syncBanner() {
  const failed = store.failedMutations();
  if (!failed.length) return '';
  return `
    <div class="surface is-failed px-4 py-3 mb-3 flex items-center gap-3 text-sm fade-in">
      <span class="text-[var(--accent-ink)]">${icon('cloud', 'w-5 h-5')}</span>
      <span class="flex-1">
        <span class="block font-medium">${failed.length} change${failed.length > 1 ? 's' : ''} could not be saved</span>
        <span class="block text-sm text-[var(--ink-soft)]">${esc(failed[0].error || '')}</span>
      </span>
      <button type="button" data-retry class="font-medium text-[var(--accent-ink)]">Retry</button>
      <button type="button" data-discard class="font-medium text-[var(--ink-soft)]">Discard</button>
    </div>`;
}

function wireSyncBanner(root) {
  root.querySelector('[data-retry]')?.addEventListener('click', () => store.retryFailed());
  root.querySelector('[data-discard]')?.addEventListener('click', () => store.discardFailed());
}

// A card that opens an item from somewhere that only knows its id (the feed of
// recent moves): fetch it, then show the same card every item row shows.
async function openItemSheetById(id) {
  try {
    itemDetailSheet(await get(`/items/${id}`));
  } catch {
    toast('That item no longer exists', { tone: 'error' });
  }
}

function wireMoveRows(root) {
  root.querySelectorAll('[data-move-item]').forEach((b) =>
    b.addEventListener('click', () => openItemSheetById(b.dataset.moveItem)),
  );
}

// ------------------------------------------------------------------ find ----

// The front door: one question, one box, and what you put away lately — often
// the answer is in that list before you have typed anything.
const findScreen = {
  limit: 20,
  shown: [],
  paths: () => ['/activity?limit=10', '/rooms', `/items?limit=${findScreen.limit}&sort=recent`],
  header: () => `
    <div class="px-4 pb-2">
      <div class="flex items-center justify-between h-16 md:hidden">
        <h1 class="flex items-center">
          <img class="logo-light h-6 w-auto" src="/static/brand/wordmark.svg" alt="h/repo" width="64" height="24">
          <img class="logo-dark h-6 w-auto" src="/static/brand/wordmark-dark.svg" alt="" width="64" height="24">
        </h1>
        <a href="#/settings" class="topround -mr-2" aria-label="Settings">${icon('settings', 'w-6 h-6')}</a>
      </div>
      <h1 class="hidden md:block t-title-lg pt-7 pb-4">Find</h1>
      <div data-sticky-anchor class="search-well">
        <button type="button" data-go-search class="flex-1 min-w-0 h-full flex items-center gap-4 text-left">
          <span class="text-[var(--ink)]">${icon('search', 'w-6 h-6')}</span>
          <span class="truncate text-base text-[var(--ink-soft)]">Where did I put it?</span>
        </button>
        <button type="button" data-voice aria-label="Speak to put something away" class="topround">
          ${icon('mic', 'w-6 h-6')}
        </button>
        <button type="button" data-scan aria-label="Scan a code" class="topround">
          ${icon('scan', 'w-6 h-6')}
        </button>
      </div>
    </div>`,
  mount(el) {
    el.innerHTML = `<div id="home-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('home-body');
    if (!body) return;
    const feed = store.peek('/activity?limit=10');
    // "Put away today" only shows when something went somewhere today, and
    // each thing once, at its latest place.
    const midnight = new Date().setHours(0, 0, 0, 0);
    const seen = new Set();
    const moves = (feed.data?.moves || []).filter(
      (m) =>
        new Date(m.moved_at).getTime() >= midnight &&
        m.kind !== 'decluttered' &&
        !seen.has(m.item_id) &&
        seen.add(m.item_id),
    );
    const { data: roomData, cached: roomsCached } = store.peek('/rooms');
    const list = roomData?.rooms || [];
    const { data: itemData, cached: fresh } = store.peek(this.paths()[2]);
    // While "Show more" loads, keep the rows already on screen instead of a skeleton.
    if (fresh) this.shown = itemData?.items || [];
    const items = this.shown;
    const itemsCached = fresh || items.length > 0;
    const more = fresh && (itemData?.total ?? 0) > items.length;

    body.innerHTML = `
      ${syncBanner()}
      ${
        moves.length
          ? `${sectionTitle('Put away today')}
             <div class="list -mx-2">${moves.map(moveRow).join('')}</div>`
          : ''
      }
      ${sectionTitle('Your things')}
      ${
        !itemsCached
          ? skeletonList(4)
          : items.length
            ? `<div class="list -mx-2">
                 ${items.map((it) => itemRow(it, { showLocation: true })).join('')}
               </div>
               ${more ? `<div class="mt-3">${ghostButton('Show more', 'data-more class="w-full"')}</div>` : ''}`
            : emptyState(
                'Nothing tracked yet',
                'Add something with the + button and it shows up here.',
                tonalButton('Add something', 'data-add-first'),
              )
      }
      ${sectionTitle('Rooms')}
      ${
        !roomsCached
          ? `<div class="flex gap-2"><div class="skeleton h-12 w-28 rounded-[10px]"></div><div class="skeleton h-12 w-28 rounded-[10px]"></div></div>`
          : list.length
            ? `<div class="flex flex-wrap gap-2">
                 ${list
                   .map(
                     (r) => `
                   <a href="#/room/${esc(r.id)}"
                      class="h-12 pl-2 pr-4 inline-flex items-center gap-2 rounded-[10px] border border-[var(--line)] text-sm font-medium
                             row-press ${store.isTemp(r.id) ? 'is-pending' : ''}">
                     ${roomBadge(r, 'w-8 h-8 text-sm rounded-[8px]')}
                     <span class="t-path">${esc(r.name)}</span>
                     ${r.item_count ? `<span class="text-[var(--ink-soft)] font-normal">${r.item_count}</span>` : ''}
                   </a>`,
                   )
                   .join('')}
               </div>`
            : `<p class="text-sm text-[var(--ink-soft)]">
                 No rooms yet. <a class="underline font-medium" href="#/places">Start with Places.</a>
               </p>`
      }`;

    wireSyncBanner(body);
    wireMoveRows(body);
    wireItemRows(body, items);
    body.querySelector('[data-add-first]')?.addEventListener('click', () => itemSheet());
    body.querySelector('[data-more]')?.addEventListener('click', () => {
      this.limit += 20;
      store.setActive(this.paths());
      store.load(this.paths()[2]).catch(() => {});
    });
  },
};

// Typing anywhere on Find (outside a field or sheet) starts a search with that key.
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || !e.key.trim()) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('[role=dialog]')) return;
  // Keys typed before the search field takes focus still belong to it.
  if (current === searchScreen) return document.getElementById('search-input')?.focus();
  if (current !== findScreen) return;
  e.preventDefault();
  searchQuery = e.key;
  location.hash = `#/search?q=${encodeURIComponent(e.key)}`;
});

// ---------------------------------------------------------------- places ----

// Rooms and, inside them, the boxes. The old home screen, now one tab among three.
const placesScreen = {
  paths: () => ['/rooms'],
  header: () => topBar({ title: 'Places' }),
  mount(el) {
    el.innerHTML = `<div id="places-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('places-body');
    if (!body) return;
    const { data, cached } = store.peek('/rooms');
    const list = data?.rooms || [];
    const groups = roomsByFloor();
    const showFloors = multiFloor();

    body.innerHTML = `
      ${syncBanner()}
      ${
        !cached
          ? skeletonList(4)
          : list.length
            ? groups
                .map(
                  ([floor, roomsOnFloor]) => `
                ${sectionTitle(
                  showFloors ? roomsOnFloor[0].floor_label || floorLabel(floor) : 'Rooms',
                  showFloors
                    ? `<span class="t-label-sm text-[var(--ink-faint)]">${plural(roomsOnFloor.length, 'room', 'rooms')}</span>`
                    : '',
                )}
                <div class="room-grid">
                  ${roomsOnFloor
                    .map((r) => roomRow(r, store.isTemp(r.id), { showFloor: false }))
                    .join('')}
                </div>`,
                )
                .join('')
            : emptyState(
                'No rooms yet',
                'Start with the rooms in your home, then add the cupboards and boxes inside them.',
                tonalButton('Add your first room', 'data-add-room'),
              )
      }`;

    wireSyncBanner(body);
    body.querySelectorAll('[data-add-room]').forEach((b) =>
      b.addEventListener('click', () => roomSheet()),
    );
  },
};

// ----------------------------------------------------------------- value ----

// What things cost per day. A price and a date are optional on every item;
// this is where they pay off. Under the user's line is good value.
const valueScreen = {
  filter: '',
  paths: () => ['/items?has_price=true&limit=200'],
  header: () =>
    `${topBar({ title: 'Value' })}
     <p class="px-4 -mt-1 pb-1 text-sm text-[var(--ink-soft)] text-pretty">Cost per day since you bought it. Under ${rupees(valueLine())} is a good deal.</p>`,
  mount(el) {
    el.innerHTML = `<div id="value-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('value-body');
    if (!body) return;
    const { data, cached } = store.peek(this.paths()[0]);
    const line = valueLine();
    const all = (data?.items || []).filter((i) => i.value);

    // Filter chips come from the tags actually in use on priced things.
    const tagCounts = new Map();
    for (const i of all) for (const tag of i.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag);
    if (this.filter && !tags.includes(this.filter)) this.filter = '';

    const items = all
      .filter((i) => !this.filter || (i.tags || []).includes(this.filter))
      .sort((a, b) => b.value.per_day - a.value.per_day);
    const good = items.filter((i) => i.value.per_day < line).length;
    const spent = items.reduce((sum, i) => sum + (i.purchase_price || 0), 0);

    const chip = (value, label) => `
      <button type="button" data-filter="${esc(value)}" aria-pressed="${this.filter === value}"
        class="h-10 px-4 shrink-0 inline-flex items-center gap-2 rounded-[10px] text-sm font-medium ${
          this.filter === value
            ? 'bg-[var(--accent-tonal)] pl-2.5'
            : 'border border-[var(--line)] text-[var(--ink-soft)]'
        }">${this.filter === value ? icon('check', 'w-[18px] h-[18px]') : ''}${esc(label)}</button>`;

    const row = (i) => `
      <button type="button" data-item="${esc(i.id)}"
         class="row-press w-full text-left flex items-center gap-3.5 px-2 py-3">
        ${itemAvatar(i)}
        <span class="flex-1 min-w-0">
          <span class="block t-title-md truncate t-name">${esc(i.name)}</span>
          <span class="block text-sm text-[var(--ink-soft)] truncate tabular-nums">
            ${rupees(i.purchase_price)} · ${plural(i.value.days, 'day', 'days')}
          </span>
        </span>
        ${valuePill(i)}
      </button>`;

    body.innerHTML = `
      ${syncBanner()}
      ${
        !cached
          ? skeletonList(4)
          : all.length
            ? `
        <p class="mt-2 t-body-lg">
          <span class="font-medium tabular-nums">${good} of ${items.length}</span>
          ${`thing${items.length === 1 ? '' : 's'}`} under ${rupees(line)} a day
        </p>
        <p class="text-sm text-[var(--ink-soft)] tabular-nums">${rupees(spent)} spent on ${plural(items.length, 'tracked item', 'tracked items')}</p>
        ${
          tags.length
            ? `<div class="flex gap-2 mt-4 overflow-x-auto pb-1 -mx-4 px-4">${chip('', 'All')}${tags.map((x) => chip(x, x)).join('')}</div>`
            : ''
        }
        <div class="list -mx-2 mt-3">${items.map(row).join('')}</div>`
            : emptyState(
                'Nothing priced yet',
                'Add a price and a purchase date to something and it shows up here with what it costs per day.',
                tonalButton('Add something', 'data-add-first'),
              )
      }`;

    wireSyncBanner(body);
    wireItemRows(body, items);
    body.querySelector('[data-add-first]')?.addEventListener('click', () => itemSheet());
    body.querySelectorAll('[data-filter]').forEach((b) =>
      b.addEventListener('click', () => {
        this.filter = b.dataset.filter;
        this.update();
      }),
    );
  },
};

const roomScreen = {
  id: null,
  openBranches: new Set(),
  paths() {
    return [`/rooms/${this.id}/tree`, '/rooms'];
  },
  header() {
    const room = roomById(this.id) || store.peek(`/rooms/${this.id}/tree`).data?.room;
    return topBar({
      back: '#/places',
      title: room
        ? `<span class="inline-flex items-center gap-3 max-w-full">${roomBadge(room, 'w-8 h-8 text-sm rounded-[8px]')}<span class="truncate">${esc(room.name)}</span></span>`
        : '<span class="skeleton inline-block h-5 w-32 align-middle"></span>',
      sub:
        room && multiFloor()
          ? `<p class="text-sm text-[var(--ink-soft)] truncate">${esc(room.floor_label)}</p>`
          : '',
      actions: barAction('pencil', 'Rename room', 'data-rename') + barAction('trash', 'Delete room', 'data-delete'),
    });
  },
  mount(el, params) {
    if (this.id !== params.id) this.openBranches = new Set(); // a different room, a fresh tree
    this.id = params.id;
    el.innerHTML = `<div id="room-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('room-body');
    if (!body) return;
    const path = `/rooms/${this.id}/tree`;
    const { data, cached } = store.peek(path);
    const tree = data?.storage_units || [];
    const loose = data?.unplaced_items || [];

    // Nested units collapse instead of sprawling: a wardrobe with six shelves
    // should not push everything else off the screen. Which branches are open
    // survives re-renders, so a background refresh never folds the tree up.
    const open = this.openBranches;
    const branch = (unit, depth) => {
      const kids = unit.children || [];
      const isOpen = open.has(unit.id);
      const row = `
        <div class="flex items-stretch">
          ${
            kids.length
              ? `<button type="button" data-acc-toggle aria-expanded="${isOpen}"
                   aria-label="Show what is inside ${esc(unit.name)}"
                   class="w-8 shrink-0 grid place-items-center rounded-[14px] text-[var(--ink-soft)] active:bg-[var(--sunken)] transition-colors"
                   style="margin-left:${Math.min(depth, 3) * 10}px">
                   <span data-caret ${isOpen ? 'style="transform:rotate(180deg)"' : ''}>${icon('down', 'w-5 h-5')}</span>
                 </button>`
              : `<span class="w-8 shrink-0" style="margin-left:${Math.min(depth, 3) * 10}px"></span>`
          }
          <span class="flex-1 min-w-0">${unitRow(unit, { pending: store.isTemp(unit.id), depth: 0 })}</span>
        </div>`;

      if (!kids.length) return `<div class="acc" data-acc data-key="${esc(unit.id)}">${row}</div>`;
      return `
        <div class="acc" data-acc data-key="${esc(unit.id)}">
          ${row}
          <div class="acc-panel ${isOpen ? 'is-open' : ''}">
            <div>${kids.map((k) => branch(k, depth + 1)).join('')}</div>
          </div>
        </div>`;
    };

    body.innerHTML = `
      ${syncBanner()}
      ${sectionTitle(
        'Storage units',
        `<a href="#/labels/${esc(this.id)}" class="btn btn-text !min-h-10 -mr-3">QR labels</a>`,
      )}
      ${
        !cached
          ? skeletonList(3)
          : tree.length
            ? `<div class="list -mx-2">
                 ${tree.map((u) => branch(u, 0)).join('')}
                 ${addRow('New storage unit', 'data-add-unit')}
               </div>`
            : emptyState(
                'Nothing in here yet',
                'Add a wardrobe, a shelf or a labelled box — they can nest as deep as you like.',
                tonalButton('Add storage unit', 'data-add-unit'),
              )
      }
      ${sectionTitle('Loose in this room')}
      ${
        !cached
          ? skeletonList(2)
          : loose.length
            ? `<div class="list -mx-2">
                 ${loose.map((i) => itemRow(i, { pending: store.isTemp(i.id) })).join('')}
               </div>`
            : `<p class="py-3 text-sm text-[var(--ink-soft)]">Nothing loose: everything here lives inside a storage unit.</p>`
      }`;

    wireSyncBanner(body);
    wireAccordions(body, {
      onToggle: (key, isOpen) => (isOpen ? open.add(key) : open.delete(key)),
    });
    body.querySelectorAll('[data-add-unit]').forEach((b) =>
      b.addEventListener('click', () =>
        promptSheet({
          title: 'New storage unit',
          label: 'Name',
          placeholder: 'Wardrobe',
          confirm: 'Add unit',
          onSubmit: (name) => addUnit({ name, roomId: this.id, parent: null }),
        }),
      ),
    );
    wireItemRows(body, [...loose]);
  },
};

const unitScreen = {
  id: null,
  paths() {
    return [`/storage-units/${this.id}/contents${this.deep ? '?deep=true' : ''}`];
  },
  deep: false,
  header() {
    const data = store.peek(this.paths()[0]).data;
    const unit = data?.storage_unit;
    return `${topBar({
      back: true,
      title: unit ? esc(unit.name) : '<span class="skeleton inline-block h-5 w-28 align-middle"></span>',
      actions:
        barAction('qr', 'QR label', 'data-qr') +
        barAction('pencil', 'Rename unit', 'data-rename') +
        barAction('trash', 'Delete unit', 'data-delete'),
    })}
    <div class="px-4 pb-2 -mt-2">${
      unit
        ? drawerPath([unit.room_name, ...(unit.path || []).slice(0, -1)], { roomHref: `#/room/${unit.room_id}` })
        : '<span class="skeleton block h-5 w-32 mt-1.5"></span>'
    }</div>`;
  },
  mount(el, params) {
    this.id = params.id;
    this.deep = false;
    el.innerHTML = `<div id="unit-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('unit-body');
    if (!body) return;
    const path = this.paths()[0];
    const { data, cached } = store.peek(path);
    const children = data?.children || [];
    const items = data?.items || [];

    body.innerHTML = `
      ${syncBanner()}
      ${
        children.length || !cached
          ? sectionTitle('Inside') +
            (!cached
              ? skeletonList(2)
              : listCard(
                  children.map((u) => unitRow(u, { pending: store.isTemp(u.id) })).join('') +
                    addRow('New unit in here', 'data-add-unit'),
                ))
          : ''
      }
      ${sectionTitle(
        'Items',
        `<button type="button" data-deep class="text-sm font-medium ${this.deep ? 'text-[var(--accent-ink)]' : 'text-[var(--ink-soft)]'}">
           ${this.deep ? 'Showing nested' : 'Include nested'}
         </button>`,
      )}
      ${
        !cached
          ? skeletonList(3)
          : items.length
            ? listCard(
                items
                  .map((i) => itemRow(i, { pending: store.isTemp(i.id), from: this.deep ? data?.storage_unit?.name : '' }))
                  .join('') + addRow('Add item here', 'data-add-item'),
              )
            : emptyState(
                'Empty',
                'Nothing is stored in here yet.',
                tonalButton('Add item here', 'data-add-item'),
              )
      }
      ${!children.length && cached ? `<div class="mt-3">${listCard(addRow('New unit in here', 'data-add-unit'))}</div>` : ''}`;

    wireSyncBanner(body);
    body.querySelector('[data-deep]')?.addEventListener('click', () => {
      this.deep = !this.deep;
      store.setActive(this.paths());
      store.load(this.paths()[0]);
      this.update();
    });
    body.querySelectorAll('[data-add-unit]').forEach((b) =>
      b.addEventListener('click', () => {
        const unit = data?.storage_unit;
        promptSheet({
          title: 'New storage unit',
          label: 'Name',
          placeholder: 'Blue box',
          confirm: 'Add unit',
          onSubmit: (name) => addUnit({ name, roomId: unit.room_id, parent: unit }),
        });
      }),
    );
    body.querySelectorAll('[data-add-item]').forEach((b) =>
      b.addEventListener('click', () => {
        const unit = data?.storage_unit;
        itemSheet({ roomId: unit?.room_id, unitId: unit?.id });
      }),
    );
    wireItemRows(body, items);
  },
};

// A sheet of labels for a room, ready to print and cut. `only` narrows it to a
// single unit, for when one box needs relabelling.
const labelsScreen = {
  id: null,
  only: null,
  paths() {
    return [`/rooms/${this.id}/tree`];
  },
  header() {
    const room = roomById(this.id) || store.peek(this.paths()[0]).data?.room;
    return `<div class="no-print">${topBar({
      back: true,
      title: `Labels${room ? ` · ${esc(room.name)}` : ''}`,
      actions: '<button type="button" data-print class="btn btn-text !min-h-10 mr-1">Print</button>',
    })}</div>`;
  },
  mount(el, params) {
    this.id = params.id;
    this.only = params.only || null;
    el.innerHTML = `<div id="labels-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('labels-body');
    if (!body) return;
    const { data, cached } = store.peek(this.paths()[0]);
    let units = flattenUnits(data?.storage_units || []);
    if (this.only) units = units.filter((u) => u.id === this.only);

    if (!cached) {
      body.innerHTML = skeletonList(4);
      return;
    }
    if (!units.length) {
      body.innerHTML = emptyState(
        'Nothing to label',
        'This room has no storage units yet — add one and its code is created with it.',
      );
      return;
    }

    body.innerHTML = `
      <p class="no-print text-sm text-[var(--ink-soft)] my-3">
        ${plural(units.length, 'label', 'labels')} · print, cut along the dashed lines and stick each
        one on its box. Scanning a label opens the app at whatever is inside.
      </p>
      <div class="label-sheet">${units.map(labelCard).join('')}</div>
      <div class="no-print mt-6">
        ${primaryButton(`${icon('print', 'w-5 h-5')} Print`, 'data-print-btn class="w-full"')}
      </div>`;

    body.querySelector('[data-print-btn]')?.addEventListener('click', () => print());
  },
};

// Settings: the management screen for the things that are awkward to reach from
// the browse flow — every code in the house, in one editable list.
const BACKUP_KEY = 'hsh.lastBackup';
const lastBackup = () => {
  try {
    return localStorage.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
};
const markBackup = () => {
  try {
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  } catch {}
};

const settingsScreen = {
  paths: () => ['/storage-units', '/items?has_barcode=true&limit=200', '/rooms', '/tags', '/properties'],
  header: () => topBar({ back: '#/', title: 'Settings' }),
  mount(el) {
    el.innerHTML = `<div id="settings-body" class="px-4"></div>`;
    rewireHeader();
    this.update();
  },
  update() {
    const body = document.getElementById('settings-body');
    if (!body) return;

    const units = store.peek('/storage-units').data?.storage_units || [];
    const coded = store.peek('/items?has_barcode=true&limit=200').data?.items || [];
    const tags = store.peek('/tags').data?.tags || [];
    const propKeys = store.peek('/properties').data?.properties || [];

    const unitRowMarkup = (u) => `
      <div class="flex items-center gap-3 px-4 py-3">
        <span class="w-9 h-9 rounded-lg bg-[var(--sunken)] text-[var(--ink-soft)] grid place-items-center shrink-0">
          ${icon('qr', 'w-4.5 h-4.5')}
        </span>
        <span class="flex-1 min-w-0">
          <span class="block font-medium truncate">${esc(u.name)}</span>
          <span class="block text-sm text-[var(--ink-soft)] truncate">
            ${esc([u.room_name, ...(u.path || []).slice(0, -1)].filter(Boolean).join(' › '))}
          </span>
          <span class="block font-mono text-xs tracking-wider text-[var(--ink-faint)] mt-0.5">${esc(u.qr_slug)}</span>
        </span>
        <button type="button" data-edit-code="${esc(u.id)}"
          class="h-11 px-3 rounded-lg text-sm font-medium text-[var(--accent-ink)] active:bg-[var(--sunken)] transition-colors">
          Edit
        </button>
      </div>`;

    const itemRowMarkup = (i) => `
      <div class="flex items-center gap-3 px-4 py-3">
        ${itemAvatar(i)}
        <span class="flex-1 min-w-0">
          <span class="block font-medium truncate">${esc(i.name)}</span>
          <span class="block text-sm text-[var(--ink-soft)] truncate">${esc(i.location?.path_string || '')}</span>
          <span class="block font-mono text-xs tracking-wider text-[var(--ink-faint)] mt-0.5">${esc(i.barcode)}</span>
        </span>
        <button type="button" data-edit-item="${esc(i.id)}"
          class="h-11 px-3 rounded-lg text-sm font-medium text-[var(--accent-ink)] active:bg-[var(--sunken)] transition-colors">
          Edit
        </button>
      </div>`;

    body.innerHTML = `

      ${sectionTitle(
        'Backup',
        lastBackup()
          ? `<span class="pill pill-good">Backed up ${esc(ago(lastBackup(), { long: true }))}</span>`
          : `<span class="pill pill-warn">Never backed up</span>`,
      )}
      <div class="surface p-4">
        <p class="t-body-lg">Everything lives in one database.</p>
        <p class="text-sm text-[var(--ink-soft)] mt-1">Keep a copy so a mistake never costs you your list.</p>
        <div class="flex gap-2 mt-4">
          <button type="button" data-export-all class="btn btn-primary flex-1">Download my data</button>
          <button type="button" data-import class="btn btn-ghost">Restore</button>
        </div>
      </div>

      ${sectionTitle('Good value line')}
      <div class="surface p-4 flex items-center justify-between gap-4">
        <p class="text-sm text-[var(--ink-soft)]">A thing is good value when it costs less than this per day.</p>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" data-line-dec aria-label="Lower the line" class="w-11 h-11 rounded-full bg-[var(--sunken)] grid place-items-center">${icon('minus', 'w-4 h-4')}</button>
          <span class="min-w-[4rem] text-center t-title-lg tabular-nums" data-line-value>${rupees(valueLine())}</span>
          <button type="button" data-line-inc aria-label="Raise the line" class="w-11 h-11 rounded-full bg-[var(--sunken)] grid place-items-center">${icon('plus', 'w-4 h-4')}</button>
        </div>
      </div>

      ${sectionTitle('Appearance')}
      <div data-appearance>${appearanceMarkup()}</div>

      ${sectionTitle('House shift')}
      <div class="surface p-4 flex items-center justify-between gap-3">
        <p class="text-sm text-[var(--ink-soft)] flex-1">
          Reorganise the whole house in a throwaway copy of the inventory.
        </p>
        <a href="#/shift" class="btn btn-ghost shrink-0" data-shift-open>
          ${shiftState.active
            ? 'Open — on'
            : 'Open'}
        </a>
      </div>

      ${sectionTitle('Labels')}
      ${listCard(`
        <button type="button" data-labels class="row-press w-full flex items-center gap-3 px-4 py-3.5">
          <span class="flex-1 text-left">
            <span class="block font-semibold">Print QR labels</span>
            <span class="block text-sm text-[var(--ink-soft)]">For boxes you want to scan</span>
          </span>
          <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
        </button>`)}

      ${
        lockRequired()
          ? sectionTitle('Passcode') +
            listCard(`
        <button type="button" data-lock-now class="row-press w-full flex items-center gap-3 px-4 py-3.5">
          <span class="flex-1 text-left">
            <span class="block font-semibold">Lock this device</span>
            <span class="block text-sm text-[var(--ink-soft)]">Ask for the passcode again next time</span>
          </span>
          <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
        </button>`)
          : ''
      }

      <details class="mt-6 group">
        <summary class="cursor-pointer list-none min-h-12 flex items-center justify-between section-title">
          <span>Advanced: tags, fields, codes</span>
          <span class="transition-transform group-open:rotate-90">${icon('chevron', 'w-4 h-4')}</span>
        </summary>
      ${sectionTitle(
        'Tags',
        `<button type="button" data-add-tag class="text-sm font-medium text-[var(--accent-ink)]">New tag</button>`,
      )}
      <p class="px-1 mb-2 text-sm text-[var(--ink-soft)]">
        Rename a tag and every item using it follows. Deleting one removes it from them.
      </p>
      ${
        tags.length
          ? `<div class="surface p-3 flex flex-wrap gap-1.5">
               ${tags
                 .map(
                   (t) => `
                 <button type="button" data-edit-tag="${esc(t.name)}" class="text-left">
                   ${tagChips([t.name])}<span class="ml-1 t-label-sm text-[var(--ink-faint)]">${t.count}</span>
                 </button>`,
                 )
                 .join('')}
             </div>`
          : `<div class="surface px-4 py-5 text-sm text-[var(--ink-soft)] text-center">No tags yet.</div>`
      }

      ${sectionTitle(
        'Custom fields',
        `<span class="t-label-sm text-[var(--ink-faint)]">${plural(propKeys.length, 'field', 'fields')}</span>`,
      )}
      <p class="px-1 mb-2 text-sm text-[var(--ink-soft)]">
        Every field name in use. Tap a value to see everything that shares it.
      </p>
      ${
        propKeys.length
          ? `<div class="list">
               ${propKeys
                 .map(
                   (p) => `
                 <div class="px-4 py-3">
                   <div class="flex items-baseline gap-2">
                     <span class="font-medium">${esc(p.key)}</span>
                     <span class="text-xs text-[var(--ink-faint)]">${plural(p.count, 'item', 'items')}</span>
                   </div>
                   <div class="mt-1.5 flex flex-wrap gap-1.5">
                     ${p.values
                       .slice(0, 8)
                       .map(
                         (v) => `
                       <a href="#/search?q=${encodeURIComponent(v)}"
                          class="px-2 py-0.5 rounded-full bg-[var(--sunken)] text-xs text-[var(--ink-soft)] hover:text-[var(--accent-ink)] transition-colors">${esc(v)}</a>`,
                       )
                       .join('')}
                   </div>
                 </div>`,
                 )
                 .join('')}
             </div>`
          : `<div class="surface px-4 py-5 text-sm text-[var(--ink-soft)] text-center">
               No custom fields yet. Add one while editing an item.
             </div>`
      }

      ${sectionTitle(
        'Storage unit codes',
        `<span class="t-label-sm text-[var(--ink-faint)]">${plural(units.length, 'unit', 'units')}</span>`,
      )}
      <p class="px-1 mb-2 text-sm text-[var(--ink-soft)]">
        Override a printed code, or issue a new one if a label is lost or reused.
      </p>
      ${
        units.length
          ? `<div class="list">${units.map(unitRowMarkup).join('')}</div>`
          : `<div class="surface px-4 py-5 text-sm text-[var(--ink-soft)] text-center">No storage units yet.</div>`
      }

      ${sectionTitle(
        'Item barcodes',
        `<span class="t-label-sm text-[var(--ink-faint)]">${plural(coded.length, 'item', 'items')}</span>`,
      )}
      <p class="px-1 mb-2 text-sm text-[var(--ink-soft)]">
        Products whose own barcode is stored — these need no QR label.
      </p>
      ${
        coded.length
          ? `<div class="list">${coded.map(itemRowMarkup).join('')}</div>`
          : `<div class="surface px-4 py-5 text-sm text-[var(--ink-soft)] text-center">
               Nothing has a barcode yet. Add one while editing an item.
             </div>`
      }

      </details>

      <div class="h-6"></div>`;

    wireAppearance(body.querySelector('[data-appearance]'));
    body.querySelector('[data-export-all]').addEventListener('click', () => exportDataSheet());
    body.querySelector('[data-import]').addEventListener('click', () => importDataSheet());
    body.querySelector('[data-labels]').addEventListener('click', () => labelRoomSheet());
    body.querySelector('[data-lock-now]')?.addEventListener('click', () => lockNow());
    const bump = (d) => {
      const next = Math.min(1000, Math.max(1, valueLine() + d));
      setValueLine(next);
      body.querySelector('[data-line-value]').textContent = rupees(next);
    };
    body.querySelector('[data-line-dec]').addEventListener('click', () => bump(-1));
    body.querySelector('[data-line-inc]').addEventListener('click', () => bump(1));
    const refreshTaxonomy = () => {
      store.load('/tags', { force: true }).catch(() => {});
      store.load('/properties', { force: true }).catch(() => {});
      store.revalidate();
    };
    body.querySelectorAll('[data-edit-tag]').forEach((b) =>
      b.addEventListener('click', () => {
        const tag = tags.find((t) => t.name === b.dataset.editTag);
        if (tag) manageTagSheet(tag, { onChanged: refreshTaxonomy });
      }),
    );
    body.querySelector('[data-add-tag]')?.addEventListener('click', () =>
      promptSheet({
        title: 'New tag',
        label: 'Name',
        placeholder: 'electronics',
        confirm: 'Add tag',
        onSubmit: async (name) => {
          try {
            await post('/tags', { name });
            toast(`Added ${name}`);
            refreshTaxonomy();
          } catch (err) {
            toast(err.message || 'Could not add that tag', { tone: 'error' });
          }
        },
      }),
    );
    body.querySelectorAll('[data-edit-code]').forEach((b) =>
      b.addEventListener('click', () => {
        const unit = units.find((u) => u.id === b.dataset.editCode);
        if (unit) codeSheet(unit);
      }),
    );
    body.querySelectorAll('[data-edit-item]').forEach((b) =>
      b.addEventListener('click', () => {
        const it = coded.find((i) => i.id === b.dataset.editItem);
        if (it) itemSheet({ item: it });
      }),
    );
  },
};

// Overriding a code re-points every label already stuck on a box, so this is
// deliberately a separate, explicit screen rather than a field in the unit form.
function codeSheet(unit) {
  openSheet({
    title: `Code for ${unit.name}`,
    body: `
      <form data-form>
        ${field(
          'Code',
          `<input name="code" class="${inputCls} font-mono tracking-[0.2em] uppercase"
             autocomplete="off" autocapitalize="characters" value="${esc(unit.qr_slug)}">`,
          '4 to 24 characters, A-Z and 0-9. Must be unique across the house.',
        )}
        <div class="surface is-failed px-3 py-2.5 text-sm mb-4">
          Changing this retires any label already printed with the old code.
        </div>
        <div class="flex gap-2">
          ${primaryButton('Save code', 'data-ok class="flex-1"')}
          ${ghostButton('New random', 'data-regen')}
        </div>
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      body.querySelector('[data-ok]').addEventListener('click', () => {
        const code = form.code.value.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,24}$/.test(code)) {
          toast('Use 4 to 24 letters or digits', { tone: 'error' });
          return;
        }
        close();
        store.mutate({
          kind: 'unit.update',
          method: 'PATCH',
          path: `/storage-units/${unit.id}`,
          body: { qr_slug: code },
          targetId: unit.id,
          record: { qr_slug: code },
        });
      });
      body.querySelector('[data-regen]').addEventListener('click', () => {
        close();
        store.mutate({
          kind: 'unit.update',
          method: 'POST',
          path: `/storage-units/${unit.id}/qr/regenerate`,
          targetId: unit.id,
        });
        toast('New code issued — reprint the label');
      });
    },
  });
}

let searchQuery = '';
let searchTimer = null;
let searchFilters = { room_id: '', tags: '', has_barcode: false };
let codeMatch = null; // { query, kind, storage_unit? | item? } — a hit from /api/scan

function buildSearchPath() {
  if (!searchQuery) return '';
  const params = { q: searchQuery, limit: 50 };
  if (searchFilters.room_id) params.room_id = searchFilters.room_id;
  if (searchFilters.tags) params.tags = searchFilters.tags;
  if (searchFilters.has_barcode) params.has_barcode = 'true';
  return `/search${qs(params)}`;
}

// A label code or barcode is a single compact token — never a phrase with
// spaces — so this is what filters out ordinary text searches before
// bothering the network with a lookup that can only ever 404 for them.
function looksLikeCode(q) {
  const stripped = q.replace(/[\s-]/g, '');
  return stripped.length >= 4 && stripped.length <= 24 && /^[A-Za-z0-9]+$/.test(stripped);
}

// Resolve a query against /api/scan (our QR labels and product barcodes) so a
// code typed or pasted into search jumps straight to the box it belongs to,
// the same way the camera scanner does.
async function lookupCode(query, screen) {
  if (!looksLikeCode(query)) return;
  let data;
  try {
    data = await get(`/scan${qs({ code: query })}`);
  } catch {
    return; // 404 (unknown code) or offline — search results stand on their own
  }
  if (query !== searchQuery) return; // superseded by further typing
  if (data.kind === 'storage_unit' || data.kind === 'item') {
    codeMatch = { ...data, query };
    screen.update();
  }
}

function codeMatchCard(data) {
  if (data.kind === 'storage_unit') {
    const unit = data.storage_unit;
    const trail = [unit.room_name, ...(unit.path || []).slice(0, -1)].filter(Boolean).join(' › ');
    return listCard(`
      <a href="#/unit/${esc(unit.id)}" class="row-press flex items-center gap-3 px-4 py-3.5">
        <span class="w-9 h-9 rounded-lg bg-[var(--accent-tonal)] text-[var(--accent-ink)] grid place-items-center shrink-0">
          ${icon('box', 'w-4.5 h-4.5')}
        </span>
        <span class="flex-1 min-w-0">
          <span class="block font-medium truncate">${esc(unit.name)}</span>
          <span class="block text-sm text-[var(--ink-soft)] truncate">${esc(trail || unit.room_name || '')}</span>
        </span>
        <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
      </a>`);
  }
  return listCard(itemRow(data.item, { showLocation: true }));
}

const searchScreen = {
  staticHeader: true,
  paths: () => {
    const path = buildSearchPath();
    return path ? [path] : [];
  },
  header: () => `
    <div class="flex items-center gap-1 px-2 py-2 md:pt-5">
      <a href="#/" class="topround shrink-0" aria-label="Back">${icon('back', 'w-6 h-6')}</a>
      <label class="search-well flex-1 min-w-0 !pl-4">
        <span class="sr-only">Search</span>
        <span class="text-[var(--ink-soft)] shrink-0">${icon('search', 'w-6 h-6')}</span>
        <input id="search-input" type="search" autocomplete="off" enterkeyhint="search"
          placeholder="Where did I put it?"
          class="flex-1 min-w-0 h-full bg-transparent outline-none border-0 text-base text-[var(--ink)] placeholder:text-[var(--ink-soft)] pl-3">
        <button id="search-filters" type="button" aria-label="Filters" class="topround shrink-0">${icon('settings', 'w-6 h-6')}</button>
      </label>
    </div>`,
  mount(el) {
    el.innerHTML = `<div id="search-body" class="px-4"></div>`;
    const input = document.getElementById('search-input');
    const filterBtn = document.getElementById('search-filters');
    input.value = searchQuery;
    input.addEventListener('input', () => {
      searchQuery = input.value.trim();
      history.replaceState(null, '', `#/search${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`);
      clearTimeout(searchTimer);
      this.update();
      searchTimer = setTimeout(() => {
        if (!searchQuery) return;
        store.setActive(this.paths());
        store.load(this.paths()[0], { maxAge: 10_000 }).catch(() => {});
        lookupCode(searchQuery, this);
      }, 180);
    });
    filterBtn.addEventListener('click', () => searchFilterSheet(this));
    setTimeout(() => input.focus(), 120);
    this.update();
  },
  update() {
    const body = document.getElementById('search-body');
    if (!body) return;

    if (!searchQuery) {
      body.innerHTML = emptyState(
        'Search your home',
        'Type part of a name or a tag, or enter a label code, and results show the full path, right down to the box.',
      );
      return;
    }

    const path = this.paths()[0];
    if (!path) return;
    const { data, cached, loading } = store.peek(path);
    const match = codeMatch && codeMatch.query === searchQuery ? codeMatch : null;
    const results = (data?.results || [])
      .map((r) => r.item || r)
      .filter((i) => !(match?.kind === 'item' && i.id === match.item.id));

    const best = results.length && searchQuery.length >= 2 ? results[0] : null;
    const rest = best ? results.slice(1) : results;
    const hero = best
      ? `<button type="button" data-item="${esc(best.id)}" class="hero row-press p-4 w-full text-left flex gap-3.5 items-start mb-3">
           ${itemAvatar(best)}
           <span class="flex-1 min-w-0">
             <span class="flex items-center gap-2">
               <span class="t-title-lg truncate t-name">${esc(best.name)}</span>
               <span class="pill pill-quiet shrink-0">Best match</span>
             </span>
             ${drawerPath(best.location?.path || [])}
           </span>
         </button>`
      : '';

    body.innerHTML = `
      ${match ? `<div class="mb-4">${sectionTitle('Matches this code')}${codeMatchCard(match)}</div>` : ''}
      ${
        !cached && loading
          ? skeletonList(5)
          : results.length
            ? hero +
              (rest.length
                ? listCard(rest.map((i) => itemRow(i, { showLocation: true, pending: store.isTemp(i.id) })).join(''))
                : '')
            : cached
              ? match
                ? ''
                : emptyState('No matches', `Nothing here matches "${searchQuery}".`)
              : skeletonList(5)
      }
      ${
        cached && results.length
          ? `<p class="text-sm text-[var(--ink-faint)] text-center mt-4">${data.total} match${data.total === 1 ? '' : 'es'}</p>`
          : ''
      }`;

    wireItemRows(body, match?.kind === 'item' ? [match.item, ...results] : results);
  },
};

function searchFilterSheet(screen) {
  const allTags = [...new Set((store.peek('/items').data?.items || []).flatMap((i) => i.tags || []))];
  openSheet({
    title: 'Search filters',
    body: `
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--ink-soft)] mb-1.5">Room</label>
          <select id="filter-room" class="${inputCls} !bg-[var(--canvas)] text-[var(--ink)]">
            <option value="">All rooms</option>
            ${rooms().map((r) => `<option value="${r.id}" ${searchFilters.room_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--ink-soft)] mb-1.5">Tags</label>
          <input type="text" id="filter-tags" placeholder="Comma-separated tags" value="${esc(searchFilters.tags)}"
            class="${inputCls}">
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="filter-barcode" ${searchFilters.has_barcode ? 'checked' : ''}
            class="w-4 h-4 rounded border-[var(--line)]">
          <span class="text-sm text-[var(--ink)]">Has barcode</span>
        </label>
      </div>`,
    onMount(body) {
      body.querySelector('#filter-room').addEventListener('change', (e) => {
        searchFilters.room_id = e.target.value;
        store.setActive(screen.paths());
        if (searchQuery) store.load(screen.paths()[0], { maxAge: 10_000 }).catch(() => {});
        screen.update();
      });
      body.querySelector('#filter-tags').addEventListener('change', (e) => {
        searchFilters.tags = e.target.value.trim();
        store.setActive(screen.paths());
        if (searchQuery) store.load(screen.paths()[0], { maxAge: 10_000 }).catch(() => {});
        screen.update();
      });
      body.querySelector('#filter-barcode').addEventListener('change', (e) => {
        searchFilters.has_barcode = e.target.checked;
        store.setActive(screen.paths());
        if (searchQuery) store.load(screen.paths()[0], { maxAge: 10_000 }).catch(() => {});
        screen.update();
      });
    },
  });
}

// Everything the API will list, page by page, so a backup is complete rather
// than whatever the current screen happened to have cached.
async function fetchAll(path, key) {
  const out = [];
  for (let offset = 0; ; offset += 200) {
    const page = await get(`${path}${path.includes('?') ? '&' : '?'}limit=200&offset=${offset}`);
    const rows = page[key] || [];
    out.push(...rows);
    if (rows.length < 200) break;
  }
  return out;
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function exportDataSheet() {
  openSheet({
    title: 'Download my data',
    body: `
      <p class="text-sm text-[var(--ink-soft)] mb-4">
        JSON is a complete backup you can restore from. CSV is a spreadsheet of your items.
        Photos are not included in either.
      </p>
      <div class="space-y-2">
        ${primaryButton('Download JSON backup', 'data-export-json class="w-full"')}
        ${ghostButton('Download CSV spreadsheet', 'data-export-csv class="w-full"')}
      </div>`,
    onMount(body, close) {
      body.querySelector('[data-export-json]').addEventListener('click', async () => {
        close();
        await exportInventoryJSON();
      });
      body.querySelector('[data-export-csv]').addEventListener('click', async () => {
        close();
        await exportInventoryCSV();
      });
    },
  });
}

async function exportInventoryJSON() {
  try {
    toast('Preparing your backup…');
    const [rooms, units, items, tags] = await Promise.all([
      fetchAll('/rooms', 'rooms'),
      fetchAll('/storage-units', 'storage_units'),
      fetchAll('/items', 'items'),
      get('/tags').then((r) => r.tags || []),
    ]);
    const data = { app: 'home-repo', version: 1, exportedAt: new Date().toISOString(), rooms, units, items, tags };
    download(
      `home-repo-${new Date().toISOString().slice(0, 10)}.json`,
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    markBackup();
    toast(`Backed up ${plural(items.length, 'item', 'items')}`);
    if (current === settingsScreen) current.update();
  } catch (err) {
    toast(err.message || 'Backup failed', { tone: 'error' });
  }
}

async function exportInventoryCSV() {
  try {
    const items = await fetchAll('/items', 'items');
    const rows = [
      ['Name', 'Description', 'Quantity', 'Room', 'Location', 'Tags', 'Barcode', 'Icon', 'Price', 'Purchased', 'Per day'],
    ];
    for (const i of items) {
      rows.push([
        i.name,
        i.description || '',
        i.quantity,
        i.location?.room_name || '',
        (i.location?.path || []).join(' > '),
        (i.tags || []).join('; '),
        i.barcode || '',
        i.icon || '',
        i.purchase_price ?? '',
        i.purchased_on || '',
        i.value?.per_day ?? '',
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    download(`home-repo-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv' }));
    toast('Items downloaded as CSV');
  } catch (err) {
    toast(err.message || 'Export failed', { tone: 'error' });
  }
}

function importDataSheet() {
  openSheet({
    title: 'Restore from a backup',
    body: `
      <p class="text-sm text-[var(--ink-soft)] mb-4">
        Choose a JSON backup. Anything already here is left alone and only what is missing is added, so
        restoring twice is safe. Photos are not part of a backup.
      </p>
      <input type="file" id="import-file" accept=".json,application/json" class="hidden">
      ${primaryButton('Choose backup file', 'data-choose-file class="w-full"')}
      <div id="import-status" class="mt-4 text-sm" role="status"></div>`,
    onMount(body, close) {
      const fileInput = body.querySelector('#import-file');
      const status = body.querySelector('#import-status');
      body.querySelector('[data-choose-file]').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          status.textContent = 'Restoring…';
          const made = await importInventoryJSON(JSON.parse(await file.text()), (msg) => {
            status.textContent = msg;
          });
          status.innerHTML = `<span class="font-semibold text-[var(--good-fg)]">Done.</span>
            Added ${plural(made.rooms, 'room', 'rooms')}, ${plural(made.units, 'box', 'boxes')} and
            ${plural(made.items, 'item', 'items')}.`;
          setTimeout(close, 2200);
        } catch (err) {
          status.innerHTML = `<span class="font-semibold text-[var(--del)]">${esc(err.message)}</span>`;
        }
      });
    },
  });
}

// Rooms first, then boxes parents-before-children, then items: each step needs
// the new ids of the one before. Existing records are matched, not duplicated.
async function importInventoryJSON(data, say = () => {}) {
  if (!Array.isArray(data?.rooms)) throw new Error('This does not look like a Home Repo backup.');
  const made = { rooms: 0, units: 0, items: 0 };
  const roomMap = new Map();
  const unitMap = new Map();

  say('Rooms…');
  const haveRooms = await fetchAll('/rooms', 'rooms');
  for (const r of data.rooms) {
    const same = haveRooms.find((x) => x.name === r.name && x.floor === r.floor);
    if (same) {
      roomMap.set(r.id, same.id);
      continue;
    }
    const created = await post('/rooms', {
      name: r.name,
      floor: r.floor,
      floor_name: r.floor_name,
      description: r.description || '',
    });
    roomMap.set(r.id, created.id);
    made.rooms++;
  }

  say('Boxes…');
  const haveUnits = await fetchAll('/storage-units', 'storage_units');
  const units = [...(data.units || [])].sort((a, b) => (a.path?.length || 1) - (b.path?.length || 1));
  for (const u of units) {
    const roomId = roomMap.get(u.room_id);
    const parentId = u.parent_id ? unitMap.get(u.parent_id) : null;
    if (!roomId || (u.parent_id && !parentId)) continue;
    const same = haveUnits.find((x) => x.room_id === roomId && (x.parent_id || null) === parentId && x.name === u.name);
    if (same) {
      unitMap.set(u.id, same.id);
      continue;
    }
    const created = await post('/storage-units', {
      name: u.name,
      kind: u.kind || '',
      description: u.description || '',
      parent_id: parentId || undefined,
      room_id: parentId ? undefined : roomId,
    });
    unitMap.set(u.id, created.id);
    made.units++;
    // Keep the printed code, so labels already stuck on boxes still scan.
    if (u.qr_slug) {
      try {
        await api('PATCH', `/storage-units/${created.id}`, { qr_slug: u.qr_slug });
      } catch {}
    }
  }

  say('Items…');
  const haveItems = await fetchAll('/items', 'items');
  const seen = new Set(haveItems.map((i) => `${i.name}|${i.room_id}|${i.storage_unit_id || ''}`));
  let n = 0;
  for (const i of data.items || []) {
    const roomId = roomMap.get(i.room_id);
    const unitId = i.storage_unit_id ? unitMap.get(i.storage_unit_id) : null;
    if (!roomId || (i.storage_unit_id && !unitId)) continue;
    const key = `${i.name}|${roomId}|${unitId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await post('/items', {
      name: i.name,
      description: i.description || '',
      quantity: i.quantity ?? 1,
      tags: i.tags || [],
      icon: i.icon || '',
      barcode: i.barcode || '',
      properties: i.properties || {},
      purchase_price: i.purchase_price ?? undefined,
      purchased_on: i.purchased_on || undefined,
      room_id: unitId ? undefined : roomId,
      storage_unit_id: unitId || undefined,
    });
    made.items++;
    if (++n % 10 === 0) say(`Items… ${n}`);
  }

  store.revalidate();
  store.load('/rooms', { force: true }).catch(() => {});
  return made;
}

// Which room's labels to print: a short list, then straight to the sheet.
function labelRoomSheet() {
  const list = rooms();
  openSheet({
    title: 'Print QR labels',
    body: list.length
      ? `<p class="text-sm text-[var(--ink-soft)] mb-3">Pick a room. Its boxes are laid out ready to print.</p>
         <div class="list">
           ${list
             .map(
               (r) => `
             <a href="#/labels/${esc(r.id)}" data-close
                class="row-press flex items-center gap-3 px-4 py-3.5">
               ${roomBadge(r)}
               <span class="flex-1 font-semibold">${esc(r.name)}</span>
               <span class="text-sm text-[var(--ink-soft)]">${plural(r.storage_unit_count || 0, 'box', 'boxes')}</span>
             </a>`,
             )
             .join('')}
         </div>`
      : '<p class="text-[var(--ink-soft)]">No rooms yet.</p>',
    onMount(body, close) {
      body.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', close));
    },
  });
}

// Item rows are buttons; open the detail sheet for whichever one was tapped.
function wireItemRows(root, items) {
  root.querySelectorAll('[data-item]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = items.find((i) => i.id === btn.dataset.item);
      if (item) itemDetailSheet(item);
    });
  });
}

// --------------------------------------------------------------- router ----

// ---------------------------------------------------------- house shift ----

// A temporary copy of the inventory to reorganise in. Everything here works
// against the copy; Commit replays the changes onto the real thing.
let shiftState = { active: false };
async function loadShiftState() {
  try {
    shiftState = await get('/shift');
  } catch {
    shiftState = { active: false };
  }
  paintShiftBanner();
  return shiftState;
}

function paintShiftBanner() {
  const head = headerEl();
  head.querySelector('[data-shift-banner]')?.remove();
  if (!shiftState.active || current === shiftScreen) return;
  head.insertAdjacentHTML('afterbegin', `
    <a href="#/shift" data-shift-banner
       class="flex items-center min-h-12 mx-4 mt-2 px-3.5 py-3 rounded-[14px] text-sm fade-in bg-[var(--shift-bg)] text-[var(--shift-fg)]">
      ${`Shift mode on — ${shiftState.changes ?? 0} change(s) live in a copy. Tap to open.`}
    </a>`);
}

const PACK_TYPES = ['Tech', 'Fragile', 'Wet', 'Soft', 'Small', 'Unsure'];

const shiftRow = (i) => `
  <div data-shift-row="${esc(i.id)}" class="px-4 py-3">
    <div class="flex items-center gap-2">
      <span class="flex-1 min-w-0">
        <span class="block font-semibold truncate t-name">${esc(i.name)}</span>
        <span class="block text-sm text-[var(--ink-soft)] truncate t-path">${esc(i.location.path_string)}</span>
      </span>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <div data-pack-type></div>
      <div data-pack-room></div>
    </div>
  </div>`;

const shiftScreen = {
  paths: () => ['/shift', '/rooms'],
  header: () =>
    `${topBar({ back: '#/settings', title: 'House Shift' })}
     <p class="px-4 -mt-1 text-sm text-[var(--ink-soft)]">Reorganise in a copy; commit when it looks right.</p>`,
  mount(el) {
    el.innerHTML = '<div id="shift-body" class="px-4 pb-8"></div>';
    this.update();
  },
  update() {
    const body = document.getElementById('shift-body');
    if (!body) return;
    const { data } = store.peek('/shift');
    if (!data) {
      body.innerHTML = skeletonList(3);
      return;
    }
    shiftState = data;
    paintShiftBanner();

    if (!data.active) {
      body.innerHTML = `
        ${emptyState(
          'Reorganise without touching the real thing',
          'House Shift copies your inventory. Move and pack freely, then commit the result back — or throw the copy away.',
          primaryButton('Start House Shift', 'data-shift-start'),
        )}`;
      body.querySelector('[data-shift-start]').addEventListener('click', async () => {
        await post('/shift/enter', {});
        await loadShiftState();
        await store.load('/shift', { force: true }).catch(() => {});
        this.update();
      });
      return;
    }

    const items = data.items ?? [];
    const { data: roomData } = store.peek('/rooms');
    const rooms = roomData?.rooms ?? [];
    const group = (type) => items.filter((i) => i.pack_type === type);

    body.innerHTML = `
      <div class="surface p-3 flex items-center gap-2 text-sm">
        <span class="flex-1">${`${data.item_count} items in the copy · ${data.changes} change(s) · ${data.unsure} unsure`}</span>
      </div>
      <div class="mt-3 flex gap-2 items-stretch">
        <div class="flex-1">${primaryButton('Commit changes', 'data-shift-commit')}</div>
        <div class="flex-1">${ghostButton('Discard', 'data-shift-discard')}</div>
      </div>
      ${PACK_TYPES.map((type) => `
        <div class="mt-5">
          <h3 class="section-title mb-2">${esc(type[0].toUpperCase() + type.slice(1))}</h3>
          ${
            group(type).length
              ? `<div class="list">
                   ${group(type).map(shiftRow).join('')}
                 </div>`
              : `<p class="text-sm text-[var(--ink-faint)] px-1">—</p>`
          }
        </div>`).join('')}`;

    body.querySelectorAll('[data-shift-row]').forEach((row) => {
      const item = items.find((i) => i.id === row.dataset.shiftRow);
      if (!item) return;
      createSelect(row.querySelector('[data-pack-type]'), {
        options: PACK_TYPES.map((p) => ({ value: p, label: p })),
        value: item.pack_type,
        placeholder: 'Pack as…',
        onChange: (v) => patchShiftItem(item.id, { pack_type: v }),
      });
      createSelect(row.querySelector('[data-pack-room]'), {
        options: [
          { value: '', label: 'Pack for… (room)' },
          ...rooms.map((r) => ({ value: r.id, label: r.name })),
        ],
        value: item.pack_room_id ?? '',
        placeholder: 'Pack for… (room)',
        onChange: (v) => patchShiftItem(item.id, { pack_room_id: v || null }),
      });
    });

    body.querySelector('[data-shift-commit]').addEventListener('click', () => exitConfirm(true));
    body.querySelector('[data-shift-discard]').addEventListener('click', () => exitConfirm(false));
  },
};

async function patchShiftItem(id, patch) {
  try {
    await api('PATCH', `/shift/items/${id}`, patch);
    await store.load('/shift', { force: true });
  } catch (err) {
    toast(err.message ?? 'Failed', { tone: 'error' });
  }
}

function exitConfirm(commit) {
  openSheet({
    title: commit ? 'Commit the shift?' : 'Discard the shift?',
    body: `
      <p class="text-sm leading-relaxed">${
        commit
          ? 'Every move and addition made in the copy is replayed onto the real inventory, oldest first.'
          : 'The copy and everything in it is thrown away. The real inventory was never touched.'
      }</p>
      <div class="mt-4 flex gap-2 items-stretch">
        <div class="flex-1">${primaryButton(commit ? 'Commit' : 'Discard', 'data-shift-go')}</div>
        <div class="flex-1">${ghostButton('Cancel', 'data-shift-cancel')}</div>
      </div>`,
    onMount(body, close) {
      body.querySelector('[data-shift-cancel]').addEventListener('click', close);
      body.querySelector('[data-shift-go]').addEventListener('click', async () => {
        await post('/shift/exit', { commit });
        close();
        await loadShiftState();
        await store.load('/shift', { force: true }).catch(() => {});
        shiftScreen.update();
        toast(commit ? 'Shift committed' : 'Shift discarded');
      });
    },
  });
}

const routes = [
  { re: /^\/?$/, screen: findScreen },
  { re: /^\/places$/, screen: placesScreen },
  { re: /^\/value$/, screen: valueScreen },
  { re: /^\/shift$/, screen: shiftScreen },
  { re: /^\/room\/([0-9a-z-]+)$/i, screen: roomScreen, keys: ['id'] },
  { re: /^\/unit\/([0-9a-z-]+)$/i, screen: unitScreen, keys: ['id'] },
  { re: /^\/labels\/([0-9a-z-]+)$/i, screen: labelsScreen, keys: ['id'] },
  { re: /^\/search$/, screen: searchScreen },
  { re: /^\/settings$/, screen: settingsScreen },
];

let current = null;
let currentKey = '';

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');

  // #/item/<id> has no screen of its own: a scanned barcode should open the
  // item's card over wherever the user already was.
  const item = /^\/item\/([0-9a-f-]{36})$/i.exec(path);
  if (item) {
    openItemById(item[1]);
    return null;
  }

  for (const r of routes) {
    const m = r.re.exec(path);
    if (!m) continue;
    const search = new URLSearchParams(query || '');
    // Query parameters are addressable too (?only=, ?unknown_code=).
    const params = Object.fromEntries(search);
    (r.keys || []).forEach((k, i) => (params[k] = m[i + 1]));
    return { route: r, params, query: search };
  }
  return { route: routes[0], params: {}, query: new URLSearchParams() };
}

// openItemById resolves the item, sends the user to the room it lives in, and
// opens its card on top.
async function openItemById(id) {
  try {
    const item = await get(`/items/${id}`);
    const target = item.storage_unit_id ? `#/unit/${item.storage_unit_id}` : `#/room/${item.room_id}`;
    history.replaceState(null, '', target);
    render();
    itemDetailSheet(item);
  } catch {
    toast('That item no longer exists', { tone: 'error' });
    location.hash = '#/';
  }
}

function render() {
  const parsed = parseHash();
  if (!parsed) return; // handled out of band (e.g. #/item/<id>)
  const { route, params, query } = parsed;
  const key = `${route.re}|${JSON.stringify(params)}`;
  closeAnyPopup(); // a portalled dropdown must not outlive its screen

  if (key !== currentKey) {
    const from = currentKey ? current : null;
    currentKey = key;
    current = route.screen;
    if (route.screen === searchScreen && query.get('q')) searchQuery = query.get('q');

    current.id = params.id || current.id;
    lastHeader = current.header();
    headerEl().innerHTML = lastHeader;
    current.mount(screenEl(), params);
    scrollTo({ top: 0 });
    if (from) playMotion(from, current);

    // A camera that scanned a retired or mistyped label lands here.
    if (query.get('unknown_code')) {
      toast(`No storage unit has the code ${query.get('unknown_code')}`, { tone: 'error' });
      history.replaceState(null, '', '#/');
    }

    const paths = current.paths();
    store.setActive(paths);
    for (const p of paths) store.load(p).catch(() => {});
  } else {
    current.update();
  }
  syncChrome();
}

// Two motions, as on the phone: into or out of a room or box pulls a drawer
// (rising going in, dropping coming back), everything else fades through.
const placeDepth = (screen) => (screen === roomScreen ? 1 : screen === unitScreen ? 2 : 0);
function playMotion(from, to) {
  const a = placeDepth(from);
  const b = placeDepth(to);
  const cls = !a && !b ? 'motion-fade' : b < a ? 'motion-drawer-back' : 'motion-drawer';
  for (const el of [headerEl().firstElementChild, screenEl()]) {
    if (!el) continue;
    el.classList.remove('motion-fade', 'motion-drawer', 'motion-drawer-back');
    void el.offsetWidth; // restart the animation on a reused element
    el.classList.add(cls);
  }
}

// Past the first row, Find's extended FAB folds to its icon, as on the phone.
addEventListener(
  'scroll',
  () => document.getElementById('fab').classList.toggle('is-collapsed', current === findScreen && scrollY > 120),
  { passive: true },
);

// Re-render the header only when its data arrives, so the title stops being a
// skeleton without rebuilding (and unfocusing) the screen below it.
let lastHeader = '';
function refresh() {
  if (!current) return;
  const head = current.staticHeader ? lastHeader : current.header();
  if (head !== lastHeader) {
    lastHeader = head;
    headerEl().innerHTML = head;
    rewireHeader();
  }
  current.update();
  syncChrome();
}

// Chrome that depends on the current screen or on pending work.
function syncChrome() {
  renderNav();
  paintShiftBanner();
  document.getElementById('sync-pip').classList.toggle('hidden', store.pendingCount() === 0);
  // Adding an item makes no sense on the label sheet or in settings, and the
  // floating button would sit on top of their controls.
  // The FAB says what it does: a new room on Places, otherwise adding a thing
  // into wherever you are (the common job, so it stays one tap away).
  const fab = document.getElementById('fab');
  const verb = current === placesScreen ? ['New room', 'Add a room'] : ['Add', 'Add something'];
  fab.querySelector('[data-fab-label]').textContent = verb[0];
  fab.setAttribute('aria-label', verb[1]);
  document.getElementById('topbar-add').setAttribute('aria-label', verb[1]);
  fab.classList.toggle('hidden', current === settingsScreen || current === labelsScreen);
  if (current !== findScreen) fab.classList.remove('is-collapsed');
}

// On phones the header is sticky. A tall one (Find's headline) would pin a
// third of the screen, so it sticks at a negative offset instead: the title
// scrolls away and only the [data-sticky-anchor] row stays in view.
function pinHeader() {
  const head = headerEl();
  const anchor = head.querySelector('[data-sticky-anchor]');
  if (!anchor) {
    head.style.top = '';
    return;
  }
  const safeTop = parseFloat(getComputedStyle(head).paddingTop) || 0;
  head.style.top = `${Math.min(0, safeTop + 8 - anchor.offsetTop)}px`;
}
addEventListener('resize', pinHeader);

// The header is rebuilt from a string, so its listeners must be reattached.
function rewireHeader() {
  const head = headerEl();
  pinHeader();
  head.querySelector('[data-go-search]')?.addEventListener('click', () => {
    location.hash = '#/search';
  });
  head.querySelector('[data-voice]')?.addEventListener('click', () => openVoiceSheet());
  head.querySelector('[data-scan]')?.addEventListener('click', () => scanWithFallback());
  head.querySelector('[data-add-room]')?.addEventListener('click', () => roomSheet());
  head.querySelector('[data-qr]')?.addEventListener('click', () => {
    const unit = store.peek(current.paths()[0]).data?.storage_unit;
    if (unit) qrSheet(unit);
  });
  head.querySelector('[data-print]')?.addEventListener('click', () => print());
  head.querySelector('[data-back]')?.addEventListener('click', () => history.back());
  if (current === roomScreen || current === unitScreen) {
    const kind = current === roomScreen ? 'room' : 'unit';
    head.querySelector('[data-rename]')?.addEventListener('click', () => {
      const entity =
        kind === 'room'
          ? roomById(current.id)
          : store.peek(current.paths()[0]).data?.storage_unit;
      if (!entity) return;
      // Rooms get the full sheet: their floor is editable too.
      if (kind === 'room') return roomSheet(entity);
      promptSheet({
        title: 'Rename storage unit',
        label: 'Name',
        value: entity.name,
        onSubmit: (name) => renameEntity(kind, entity, name),
      });
    });
    head.querySelector('[data-delete]')?.addEventListener('click', () => {
      const data = store.peek(current.paths()[0]).data;
      const entity = kind === 'room' ? roomById(current.id) || data?.room : data?.storage_unit;
      if (!entity) return;
      confirmDeleteSheet({
        kind,
        entity,
        count:
          kind === 'room'
            ? (entity.storage_unit_count || 0) + (entity.item_count || 0)
            : (data?.children?.length || 0) + (data?.items?.length || 0),
      });
    });
  }
}

// ----------------------------------------------------------------- boot ----

addEventListener('hashchange', render);
// The hash is the router, so the skip link moves focus instead of navigating.
document.querySelector('.skip-link').addEventListener('click', (e) => {
  e.preventDefault();
  screenEl().focus();
});
store.subscribe(refresh);

// A code nothing recognises is an opportunity, not an error: offer to file it.
function scanWithFallback() {
  scanSheet({
    onUnknown: (code) => {
      toast(`No item has ${code} yet`, {
        action: 'Add item',
        onAction: () => itemSheet({ barcode: code }),
      });
    },
  });
}

document.getElementById('fab').addEventListener('click', () => {
  if (current === placesScreen) {
    roomSheet();
  } else if (current === unitScreen) {
    const unit = store.peek(current.paths()[0]).data?.storage_unit;
    itemSheet({ roomId: unit?.room_id, unitId: unit?.id });
  } else if (current === roomScreen) {
    itemSheet({ roomId: current.id });
  } else {
    itemSheet();
  }
});

document.getElementById('topbar-add').addEventListener('click', () => document.getElementById('fab').click());

// Escape hatch while the sheet is open on iOS, where scroll can get stuck.
addEventListener('pageshow', () => closeAllSheets());

initTheme();
// The server marks the shell when a passcode is needed and this visitor has
// none: go straight to the passcode screen, and ask for no data that would
// only come back 401.
if (document.documentElement.hasAttribute('data-locked')) {
  showLock();
} else {
  checkSession();
  store.load('/rooms').catch(() => {});
  loadShiftState().catch(() => {});
  render();
}
