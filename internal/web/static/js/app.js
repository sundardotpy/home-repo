// Screens, routing and the actions that drive optimistic mutations.

import { get, post, qs } from './api.js';
import { closeAnyPopup, createSelect, wireAccordions } from './components.js';
import { ICON_KEYS, ITEM_ICONS, itemIconSVG, suggestIcon } from './item-icons.js';
import { barcodeCaptureSheet, labelCard, qrSheet, scanSheet } from './labels.js';
import { attachPhoto, removePhoto } from './photos.js';
import * as store from './store.js';
import { manageTagSheet, propertyEditor, propertyList, tagChips, tagPickerSheet } from './taxonomy.js';
import { appearanceSheet, initTheme } from './theme.js';
import {
  addRow,
  breadcrumb,
  emptyState,
  esc,
  field,
  ghostButton,
  icon,
  inputCls,
  itemAvatar,
  itemRow,
  listCard,
  openSheet,
  closeAllSheets,
  plural,
  primaryButton,
  roomBadge,
  roomRow,
  sectionTitle,
  skeletonList,
  toast,
  unitRow,
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
  properties = {}, roomId, unit,
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
      room_id: unit ? undefined : roomId,
      storage_unit_id: unit?.id || undefined,
    },
    temp: id,
    record,
  });
  toast(`Added ${name}`);
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
  toast(`Moved to ${record.location.path_string}`);
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
function itemSheet({ item = null, roomId = null, unitId = null, barcode = '' } = {}) {
  const editing = !!item;
  store.load('/rooms');

  let selectedRoom = item?.room_id || roomId || rooms()[0]?.id || '';
  let selectedUnit = item?.storage_unit_id || unitId || '';

  openSheet({
    title: editing ? 'Edit item' : 'Add item',
    body: `
      <form data-form>
        <div class="flex items-center gap-3 mb-4">
          <div data-preview class="w-16 h-16 rounded-xl bg-[var(--sunken)] overflow-hidden grid place-items-center text-[var(--ink-faint)] shrink-0 transition-colors">
            ${
              item?.photo_thumb_url
                ? `<img src="${esc(item.photo_thumb_url)}" alt="" class="w-full h-full object-cover">`
                : item?.icon
                  ? `<span class="text-[var(--color-accent)]">${itemIconSVG(item.icon, 'w-7 h-7')}</span>`
                  : icon('camera', 'w-6 h-6')
            }
          </div>
          <div class="flex-1 flex flex-wrap gap-2">
            <label class="inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-[var(--line)] font-medium active:bg-[var(--sunken)] transition-colors cursor-pointer">
              ${icon('camera', 'w-5 h-5')}
              <span data-photo-label>${item?.photo_thumb_url ? 'Change' : 'Photo'}</span>
              <!-- accept+capture is what opens the camera directly on a phone -->
              <input type="file" name="photo" accept="image/*" capture="environment" class="hidden">
            </label>
            <button type="button" data-pick-icon
              class="inline-flex items-center gap-2 h-11 px-3 rounded-lg border border-[var(--line)] font-medium active:bg-[var(--sunken)] transition-colors">
              ${icon('layers', 'w-5 h-5')} Icon
            </button>
            <button type="button" data-clear-photo
              class="h-11 px-3 rounded-lg text-[var(--ink-soft)] font-medium active:bg-[var(--sunken)] transition-colors ${item?.photo_thumb_url || item?.icon ? '' : 'hidden'}">
              Clear
            </button>
          </div>
        </div>
        ${field('Name', `<input name="name" class="${inputCls}" required autocomplete="off"
            placeholder="Cordless drill" value="${esc(item?.name || '')}">`)}
        <div class="grid grid-cols-[1fr_auto] gap-3">
          ${field(
            'Tags',
            `<button type="button" data-pick-tags
               class="${inputCls} flex items-center gap-1.5 flex-wrap text-left h-auto min-h-11 py-1.5">
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
               class="w-11 h-11 shrink-0 grid place-items-center rounded-lg border border-[var(--line)] active:bg-[var(--sunken)] transition-colors">
               ${icon('barcode', 'w-5 h-5')}
             </button>
           </div>`,
          'For shop-bought products. Scanning the box finds it — no QR label needed.',
        )}
        ${field(
          'Custom fields',
          `<div data-properties></div>`,
          'Anything you want to record — “Part of: Homelab”, “Warranty until: 2027-03”.',
        )}
        ${field('Room', `<div data-room-select></div>`)}
        ${field('Storage unit', `<div data-unit-select></div>`,
          'Leave as "Anywhere in the room" for things that are not in a box.')}
        <div class="flex gap-2 pt-1">
          ${primaryButton(editing ? 'Save' : 'Add item', 'data-save class="flex-1"')}
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
          ? `<span class="text-[var(--color-accent)]">${itemIconSVG(chosenIcon, 'w-7 h-7')}</span>`
          : item?.photo_thumb_url && !clearPhoto
            ? `<img src="${esc(item.photo_thumb_url)}" alt="" class="w-full h-full object-cover">`
            : icon('camera', 'w-6 h-6');
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

      body.querySelector('[data-pick-icon]').addEventListener('click', () => {
        iconPickerSheet(chosenIcon, (key) => {
          chosenIcon = key;
          iconTouched = true;
          paintPreview();
        });
      });

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

        // Close first: the point is that the UI never waits.
        close();

        const properties = props.values();

        if (editing) {
          updateItem(item, { name, quantity, tags, icon: iconKey, barcode, properties });
          const moved = (item.storage_unit_id || '') !== unitId2 || item.room_id !== selectedRoom;
          if (moved) moveItem({ ...item, name, quantity, tags, icon: iconKey }, selectedRoom, unit);
          if (pickedPhoto) attachPhoto(item.id, pickedPhoto);
          else if (clearPhoto) removePhoto(item);
        } else {
          const newId = addItem({
            name, quantity, tags, icon: iconKey, barcode, properties,
            roomId: selectedRoom, unit,
          });
          // The upload waits for the item's own POST to return an id.
          if (pickedPhoto) attachPhoto(newId, pickedPhoto);
        }
      });

      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        close();
        deleteItem(item);
      });

      if (!editing) setTimeout(() => form.name.focus(), 250);
    },
  });
}

// The icon grid. Filterable, because forty icons is more than a person wants
// to scan through on a phone.
function iconPickerSheet(selected, onPick) {
  const cell = (key) => {
    const on = key === selected;
    return `
      <button type="button" data-icon="${esc(key)}" title="${esc(ITEM_ICONS[key].label)}"
        class="aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1
               transition-all active:scale-95
               ${on
                 ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                 : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-faint)]'}">
        ${itemIconSVG(key, 'w-6 h-6')}
        <span class="text-[10px] leading-tight text-center truncate w-full px-0.5">${esc(ITEM_ICONS[key].label)}</span>
      </button>`;
  };

  openSheet({
    title: 'Choose an icon',
    body: `
      <input data-filter class="${inputCls} mb-3" placeholder="Filter icons" autocomplete="off">
      <div data-grid class="grid grid-cols-4 sm:grid-cols-5 gap-2">
        ${ICON_KEYS.map(cell).join('')}
      </div>
      <button type="button" data-none
        class="mt-4 w-full h-11 rounded-lg border border-[var(--line)] font-medium active:bg-[var(--sunken)] transition-colors">
        No icon
      </button>`,
    onMount(body, close) {
      const grid = body.querySelector('[data-grid]');
      const wire = () =>
        grid.querySelectorAll('[data-icon]').forEach((b) =>
          b.addEventListener('click', () => {
            close();
            onPick(b.dataset.icon);
          }),
        );
      wire();

      body.querySelector('[data-filter]').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const keys = !q
          ? ICON_KEYS
          : ICON_KEYS.filter(
              (k) =>
                ITEM_ICONS[k].label.toLowerCase().includes(q) ||
                ITEM_ICONS[k].keywords.some((w) => w.includes(q)),
            );
        grid.innerHTML = keys.length
          ? keys.map(cell).join('')
          : `<p class="col-span-full text-center text-[13px] text-[var(--ink-soft)] py-6">Nothing matches “${esc(q)}”.</p>`;
        wire();
      });

      body.querySelector('[data-none]').addEventListener('click', () => {
        close();
        onPick('');
      });
    },
  });
}

function itemDetailSheet(item) {
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
        <div class="surface p-3">
          <div class="text-[13px] text-[var(--ink-soft)] mb-1">Location</div>
          <div class="font-medium">${esc(item.location?.path_string || '—')}</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="surface p-3">
            <div class="text-[13px] text-[var(--ink-soft)] mb-1">Quantity</div>
            <div class="font-medium">${esc(item.quantity)}</div>
          </div>
          <div class="surface p-3">
            <div class="text-[13px] text-[var(--ink-soft)] mb-1">Tags</div>
            <div class="font-medium truncate">${esc((item.tags || []).join(', ') || '—')}</div>
          </div>
        </div>
        ${
          item.barcode
            ? `<div class="surface p-3 flex items-center gap-3">
                 <span class="text-[var(--ink-soft)]">${icon('barcode', 'w-5 h-5')}</span>
                 <span class="flex-1 min-w-0">
                   <span class="block text-[13px] text-[var(--ink-soft)]">Barcode</span>
                   <span class="block font-mono tracking-wider truncate">${esc(item.barcode)}</span>
                 </span>
               </div>`
            : ''
        }
        ${propertyList(item.properties)}
        ${item.description ? `<div class="surface p-3"><div class="text-[13px] text-[var(--ink-soft)] mb-1">Notes</div><div>${esc(item.description)}</div></div>` : ''}
        <div class="flex gap-2">
          ${primaryButton(`${icon('pencil', 'w-5 h-5')} Edit`, 'data-edit class="flex-1"')}
          ${ghostButton(icon('trash', 'w-5 h-5'), 'data-delete aria-label="Delete item"')}
        </div>
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
      body.querySelector('[data-delete]').addEventListener('click', () => {
        close();
        deleteItem(item);
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
               <input type="checkbox" data-cascade class="mt-1 w-4 h-4 accent-[var(--color-accent)]">
               <span>
                 <span class="block font-medium">Delete everything inside</span>
                 <span class="block text-[13px] text-[var(--ink-soft)]">
                   ${kind === 'room' ? 'All its storage units and items are removed.' : 'All nested units and their items are removed.'}
                 </span>
               </span>
             </label>
             <p class="text-[13px] text-[var(--ink-soft)] mb-4">
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

// -------------------------------------------------------------- sidebar ----

// One navigation, two homes: the desktop rail and the phone drawer render the
// same markup, so they can never drift apart.
function sidebarMarkup() {
  const hash = location.hash || '#/';
  const link = (href, label, ic, active) => `
    <a href="${href}" class="sidebar-link ${active ? 'is-active' : ''}" title="${esc(label)}">
      <span class="shrink-0">${icon(ic, 'w-4.5 h-4.5')}</span>
      <span class="truncate sidebar-label">${esc(label)}</span>
    </a>`;

  const groups = roomsByFloor();
  const showFloors = multiFloor();

  return `
    <div class="px-2 pb-2">
      ${primaryButton(
        `${icon('plus', 'w-5 h-5')}<span class="sidebar-label">Add item</span>`,
        'data-side-add class="w-full"',
      )}
    </div>
    <nav class="px-2 space-y-0.5">
      ${link('#/', 'Home', 'home', hash === '#/' || hash === '')}
      ${link('#/search', 'Search', 'search', hash.startsWith('#/search'))}
      <button type="button" data-side-scan class="sidebar-link w-full text-left" title="Scan a code">
        <span class="shrink-0">${icon('scan', 'w-4.5 h-4.5')}</span>
        <span class="sidebar-label">Scan a code</span>
      </button>
    </nav>

    <div class="mt-5 px-2">
      <div class="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)] sidebar-section-label">
        Rooms
      </div>
      ${
        groups.length
          ? groups
              .map(
                ([floor, list]) => `
              ${
                showFloors
                  ? `<div class="px-2.5 mt-3 mb-1 text-[11px] font-medium text-[var(--ink-faint)] sidebar-section-label">
                       ${esc(list[0].floor_label || floorLabel(floor))}
                     </div>`
                  : ''
              }
              ${list
                .map(
                  (r) => `
                <a href="#/room/${esc(r.id)}" title="${esc(r.name)}"
                   class="sidebar-link ${hash === `#/room/${r.id}` ? 'is-active' : ''} ${store.isTemp(r.id) ? 'is-pending' : ''}">
                  ${roomBadge(r, 'w-6 h-6 text-[10px]')}
                  <span class="flex-1 truncate sidebar-label">${esc(r.name)}</span>
                  <span class="text-[12px] text-[var(--ink-faint)] sidebar-count">${r.item_count || 0}</span>
                </a>`,
                )
                .join('')}`,
              )
              .join('')
          : `<p class="px-2.5 text-[13px] text-[var(--ink-faint)] sidebar-label">No rooms yet.</p>`
      }
      <button type="button" data-side-add-room class="sidebar-link w-full text-left text-[var(--color-accent)] mt-1" title="New room">
        <span class="shrink-0">${icon('plus', 'w-4.5 h-4.5')}</span>
        <span class="sidebar-label">New room</span>
      </button>
    </div>

    <div class="mt-5 px-2 pt-3 border-t border-[var(--line)] space-y-0.5">
      ${link('#/settings', 'Settings', 'settings', hash.startsWith('#/settings'))}
      <button type="button" data-side-appearance class="sidebar-link w-full text-left" title="Appearance">
        <span class="shrink-0">${icon('palette', 'w-4.5 h-4.5')}</span>
        <span class="sidebar-label">Appearance</span>
      </button>
    </div>`;
}

function wireSidebar(el, { onNavigate } = {}) {
  el.querySelector('[data-side-add]').addEventListener('click', () => {
    onNavigate?.();
    itemSheet();
  });
  el.querySelector('[data-side-scan]').addEventListener('click', () => {
    onNavigate?.();
    scanWithFallback();
  });
  el.querySelector('[data-side-add-room]').addEventListener('click', () => {
    onNavigate?.();
    roomSheet();
  });
  el.querySelector('[data-side-appearance]').addEventListener('click', () => {
    onNavigate?.();
    appearanceSheet();
  });
  if (onNavigate) el.querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener('click', onNavigate));
}

function renderSidebar() {
  const rail = document.getElementById('sidebar-body');
  if (rail && rail.offsetParent) {
    rail.innerHTML = sidebarMarkup();
    wireSidebar(rail);
  }
  const drawer = document.getElementById('drawer-body');
  if (drawer && !document.getElementById('drawer').classList.contains('hidden')) {
    drawer.innerHTML = sidebarMarkup();
    wireSidebar(drawer, { onNavigate: closeDrawer });
  }
  // Bottom bar highlight.
  const hash = location.hash || '#/';
  document.querySelectorAll('[data-nav]').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.nav === hash || (b.dataset.nav === '#/' && hash === '')),
  );
}

// ---------------------------------------------------------------- drawer ----

function openDrawer() {
  const el = document.getElementById('drawer');
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderSidebar();
  addEventListener('keydown', drawerKey);
}

function closeDrawer() {
  const el = document.getElementById('drawer');
  if (el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  document.body.style.overflow = '';
  removeEventListener('keydown', drawerKey);
}

function drawerKey(e) {
  if (e.key === 'Escape') closeDrawer();
}

const SIDEBAR_KEY = 'hsh.sidebar.collapsed';

function initSidebarCollapse() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {}
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);

  document.getElementById('sidebar-collapse')?.addEventListener('click', () => {
    const now = document.documentElement.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem(SIDEBAR_KEY, now ? '1' : '0');
    } catch {}
  });
}

// -------------------------------------------------------------- screens ----

// Any mutation still in flight is worth surfacing, but quietly.
function syncBanner() {
  const failed = store.failedMutations();
  if (!failed.length) return '';
  return `
    <div class="surface is-failed px-4 py-3 mb-3 flex items-center gap-3 text-sm fade-in">
      <span class="text-[var(--color-accent)]">${icon('cloud', 'w-5 h-5')}</span>
      <span class="flex-1">
        <span class="block font-medium">${failed.length} change${failed.length > 1 ? 's' : ''} could not be saved</span>
        <span class="block text-[13px] text-[var(--ink-soft)]">${esc(failed[0].error || '')}</span>
      </span>
      <button type="button" data-retry class="font-medium text-[var(--color-accent)]">Retry</button>
      <button type="button" data-discard class="font-medium text-[var(--ink-soft)]">Discard</button>
    </div>`;
}

function wireSyncBanner(root) {
  root.querySelector('[data-retry]')?.addEventListener('click', () => store.retryFailed());
  root.querySelector('[data-discard]')?.addEventListener('click', () => store.discardFailed());
}

const homeScreen = {
  paths: () => ['/rooms'],
  header: () => `
    <div class="px-4 pt-3 pb-2">
      <h1 class="text-2xl font-bold tracking-tight">Home</h1>
      <div class="mt-3 flex gap-2">
        <button type="button" data-go-search
          class="flex-1 h-11 px-3 rounded-lg bg-[var(--sunken)] flex items-center gap-2 text-[var(--ink-faint)]">
          ${icon('search', 'w-4.5 h-4.5')}<span>Search items and tags</span>
        </button>
        <button type="button" data-scan aria-label="Scan a label"
          class="w-11 h-11 rounded-lg bg-[var(--sunken)] grid place-items-center text-[var(--ink-soft)] active:text-[var(--color-accent)]">
          ${icon('scan', 'w-5 h-5')}
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
    const { data, cached } = store.peek('/rooms');
    const list = data?.rooms || [];

    const groups = roomsByFloor();
    const showFloors = multiFloor();

    body.innerHTML = `
      ${syncBanner()}
      ${
        !cached
          ? sectionTitle('Rooms') + skeletonList(4)
          : list.length
            ? groups
                .map(
                  ([floor, roomsOnFloor]) => `
                ${sectionTitle(
                  showFloors ? roomsOnFloor[0].floor_label || floorLabel(floor) : 'Rooms',
                  showFloors
                    ? `<span class="text-[11px] text-[var(--ink-faint)]">${plural(roomsOnFloor.length, 'room', 'rooms')}</span>`
                    : '',
                )}
                <div class="room-grid stagger">
                  ${roomsOnFloor
                    .map((r) => roomRow(r, store.isTemp(r.id), { showFloor: false }))
                    .join('')}
                </div>`,
                )
                .join('') + `<div class="mt-2">${listCard(addRow('New room', 'data-add-room'))}</div>`
            : emptyState(
                'No rooms yet',
                'Start with the rooms in your home, then add the cupboards and boxes inside them.',
                primaryButton('Add your first room', 'data-add-room'),
              )
      }
      ${
        cached
          ? `<div class="mt-6 mb-2 lg:hidden">
               ${listCard(`
                 <button type="button" data-appearance class="row-press w-full flex items-center gap-3 px-4 py-3.5">
                   <span class="w-9 h-9 rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center shrink-0">
                     ${icon('palette', 'w-4.5 h-4.5')}
                   </span>
                   <span class="flex-1 text-left">
                     <span class="block font-medium">Appearance</span>
                     <span class="block text-[13px] text-[var(--ink-soft)]">Accent colour</span>
                   </span>
                   <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
                 </button>`)}
             </div>`
          : ''
      }`;

    wireSyncBanner(body);
    body.querySelectorAll('[data-add-room]').forEach((b) =>
      b.addEventListener('click', () => roomSheet()),
    );
    body.querySelector('[data-appearance]')?.addEventListener('click', () => appearanceSheet());
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
    return `
      <div class="px-2 pt-2 pb-2 flex items-center gap-1">
        <a href="#/" class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)] transition-colors">
          ${icon('back', 'w-5 h-5')}
        </a>
        ${room ? roomBadge(room, 'w-8 h-8 text-[12px] mr-1') : ''}
        <div class="flex-1 min-w-0">
          <h1 class="text-lg font-semibold truncate">
            ${room ? esc(room.name) : '<span class="skeleton inline-block h-4 w-32 align-middle"></span>'}
          </h1>
          ${
            room && multiFloor()
              ? `<p class="text-[13px] text-[var(--ink-soft)] truncate">${esc(room.floor_label)}</p>`
              : ''
          }
        </div>
        <button type="button" data-rename class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Rename room">
          ${icon('pencil', 'w-5 h-5')}
        </button>
        <button type="button" data-delete class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Delete room">
          ${icon('trash', 'w-5 h-5')}
        </button>
      </div>`;
  },
  mount(el, params) {
    if (this.id !== params.id) this.openBranches = new Set(); // a different room, a fresh tree
    this.id = params.id;
    el.innerHTML = `<div id="room-body" class="px-4 screen-in"></div>`;
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
        <div class="flex items-stretch border-t border-[var(--line)]">
          ${
            kids.length
              ? `<button type="button" data-acc-toggle aria-expanded="${isOpen}"
                   aria-label="Show what is inside ${esc(unit.name)}"
                   class="w-8 shrink-0 grid place-items-center text-[var(--ink-faint)] active:bg-[var(--sunken)] transition-colors"
                   style="margin-left:${depth * 18}px">
                   <span data-caret ${isOpen ? 'style="transform:rotate(90deg)"' : ''}>${icon('chevron', 'w-4 h-4')}</span>
                 </button>`
              : `<span class="w-8 shrink-0" style="margin-left:${depth * 18}px"></span>`
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
        `<a href="#/labels/${esc(this.id)}" class="text-[13px] font-medium text-[var(--color-accent)]">QR labels</a>`,
      )}
      ${
        !cached
          ? skeletonList(3)
          : tree.length
            ? `<div class="surface overflow-hidden [&>.acc:first-child>div>div]:border-t-0">
                 ${tree.map((u) => branch(u, 0)).join('')}
                 ${addRow('New storage unit', 'data-add-unit class="border-t border-[var(--line)]"')}
               </div>`
            : emptyState(
                'Nothing in here yet',
                'Add a wardrobe, a shelf or a labelled box — they can nest as deep as you like.',
                primaryButton('Add storage unit', 'data-add-unit'),
              )
      }
      ${sectionTitle('Loose in this room')}
      ${
        !cached
          ? skeletonList(2)
          : loose.length
            ? `<div class="surface divide-y divide-[var(--line)] overflow-hidden stagger">
                 ${loose.map((i) => itemRow(i, { pending: store.isTemp(i.id) })).join('')}
               </div>`
            : `<div class="surface px-4 py-5 text-[13px] text-[var(--ink-soft)] text-center">
                 Nothing loose — everything here lives inside a storage unit.
               </div>`
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
    return `
      <div class="px-2 pt-2 pb-2 flex items-center gap-1">
        <button type="button" data-back class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Back">
          ${icon('back', 'w-5 h-5')}
        </button>
        <div class="flex-1 min-w-0">
          <h1 class="text-lg font-semibold truncate">
            ${unit ? esc(unit.name) : '<span class="skeleton inline-block h-4 w-28 align-middle"></span>'}
          </h1>
          ${
            unit
              ? breadcrumb([
                  { label: unit.room_name, href: `#/room/${unit.room_id}` },
                  ...(unit.path || []).slice(0, -1).map((p) => ({ label: p })),
                ])
              : '<span class="skeleton inline-block h-2.5 w-40"></span>'
          }
        </div>
        <button type="button" data-qr class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="QR label">
          ${icon('qr', 'w-5 h-5')}
        </button>
        <button type="button" data-rename class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Rename unit">
          ${icon('pencil', 'w-5 h-5')}
        </button>
        <button type="button" data-delete class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Delete unit">
          ${icon('trash', 'w-5 h-5')}
        </button>
      </div>`;
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
        `<button type="button" data-deep class="text-[13px] font-medium ${this.deep ? 'text-[var(--color-accent)]' : 'text-[var(--ink-soft)]'}">
           ${this.deep ? 'Showing nested' : 'Include nested'}
         </button>`,
      )}
      ${
        !cached
          ? skeletonList(3)
          : items.length
            ? listCard(
                items
                  .map((i) => itemRow(i, { pending: store.isTemp(i.id), showLocation: this.deep }))
                  .join('') + addRow('Add item here', 'data-add-item'),
              )
            : emptyState(
                'Empty',
                'Nothing is stored in here yet.',
                primaryButton('Add item here', 'data-add-item'),
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
    return `
      <div class="px-2 pt-2 pb-2 flex items-center gap-1 no-print">
        <button type="button" data-back class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]" aria-label="Back">
          ${icon('back', 'w-5 h-5')}
        </button>
        <h1 class="flex-1 text-lg font-semibold truncate">
          Labels${room ? ` · ${esc(room.name)}` : ''}
        </h1>
        <button type="button" data-print class="h-10 px-3 rounded-lg font-medium text-[var(--color-accent)] active:bg-[var(--sunken)]">
          Print
        </button>
      </div>`;
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
      <p class="no-print text-[13px] text-[var(--ink-soft)] my-3">
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
const settingsScreen = {
  paths: () => ['/storage-units', '/items?has_barcode=true&limit=200', '/rooms', '/tags', '/properties'],
  header: () => `
    <div class="px-2 pt-2 pb-2 flex items-center gap-1">
      <a href="#/" class="w-10 h-10 grid place-items-center rounded-lg text-[var(--ink-soft)] active:bg-[var(--sunken)]">
        ${icon('back', 'w-5 h-5')}
      </a>
      <h1 class="flex-1 text-lg font-semibold truncate">Settings</h1>
    </div>`,
  mount(el) {
    el.innerHTML = `<div id="settings-body" class="px-4 screen-in"></div>`;
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
          <span class="block text-[13px] text-[var(--ink-soft)] truncate">
            ${esc([u.room_name, ...(u.path || []).slice(0, -1)].filter(Boolean).join(' › '))}
          </span>
          <span class="block font-mono text-[12px] tracking-wider text-[var(--ink-faint)] mt-0.5">${esc(u.qr_slug)}</span>
        </span>
        <button type="button" data-edit-code="${esc(u.id)}"
          class="h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--color-accent)] active:bg-[var(--sunken)] transition-colors">
          Edit
        </button>
      </div>`;

    const itemRowMarkup = (i) => `
      <div class="flex items-center gap-3 px-4 py-3">
        ${itemAvatar(i)}
        <span class="flex-1 min-w-0">
          <span class="block font-medium truncate">${esc(i.name)}</span>
          <span class="block text-[13px] text-[var(--ink-soft)] truncate">${esc(i.location?.path_string || '')}</span>
          <span class="block font-mono text-[12px] tracking-wider text-[var(--ink-faint)] mt-0.5">${esc(i.barcode)}</span>
        </span>
        <button type="button" data-edit-item="${esc(i.id)}"
          class="h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--color-accent)] active:bg-[var(--sunken)] transition-colors">
          Edit
        </button>
      </div>`;

    body.innerHTML = `
      ${sectionTitle('Appearance')}
      ${listCard(`
        <button type="button" data-appearance class="row-press w-full flex items-center gap-3 px-4 py-3.5">
          <span class="w-9 h-9 rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center shrink-0">
            ${icon('palette', 'w-4.5 h-4.5')}
          </span>
          <span class="flex-1 text-left">
            <span class="block font-medium">Accent colour</span>
            <span class="block text-[13px] text-[var(--ink-soft)]">Presets or a custom colour</span>
          </span>
          <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
        </button>`)}

      ${sectionTitle(
        'Tags',
        `<button type="button" data-add-tag class="text-[13px] font-medium text-[var(--color-accent)]">New tag</button>`,
      )}
      <p class="px-1 mb-2 text-[13px] text-[var(--ink-soft)]">
        Rename a tag and every item using it follows. Deleting one removes it from them.
      </p>
      ${
        tags.length
          ? `<div class="surface p-3 flex flex-wrap gap-1.5">
               ${tags
                 .map(
                   (t) => `
                 <button type="button" data-edit-tag="${esc(t.name)}" class="text-left">
                   ${tagChips([t.name])}<span class="ml-1 text-[11px] text-[var(--ink-faint)]">${t.count}</span>
                 </button>`,
                 )
                 .join('')}
             </div>`
          : `<div class="surface px-4 py-5 text-[13px] text-[var(--ink-soft)] text-center">No tags yet.</div>`
      }

      ${sectionTitle(
        'Custom fields',
        `<span class="text-[11px] text-[var(--ink-faint)]">${plural(propKeys.length, 'field', 'fields')}</span>`,
      )}
      <p class="px-1 mb-2 text-[13px] text-[var(--ink-soft)]">
        Every field name in use. Tap a value to see everything that shares it.
      </p>
      ${
        propKeys.length
          ? `<div class="surface divide-y divide-[var(--line)] overflow-hidden">
               ${propKeys
                 .map(
                   (p) => `
                 <div class="px-4 py-3">
                   <div class="flex items-baseline gap-2">
                     <span class="font-medium">${esc(p.key)}</span>
                     <span class="text-[12px] text-[var(--ink-faint)]">${plural(p.count, 'item', 'items')}</span>
                   </div>
                   <div class="mt-1.5 flex flex-wrap gap-1.5">
                     ${p.values
                       .slice(0, 8)
                       .map(
                         (v) => `
                       <a href="#/search?q=${encodeURIComponent(v)}"
                          class="px-2 py-0.5 rounded-full bg-[var(--sunken)] text-[12px] text-[var(--ink-soft)] hover:text-[var(--color-accent)] transition-colors">${esc(v)}</a>`,
                       )
                       .join('')}
                   </div>
                 </div>`,
                 )
                 .join('')}
             </div>`
          : `<div class="surface px-4 py-5 text-[13px] text-[var(--ink-soft)] text-center">
               No custom fields yet. Add one while editing an item.
             </div>`
      }

      ${sectionTitle(
        'Storage unit codes',
        `<span class="text-[11px] text-[var(--ink-faint)]">${plural(units.length, 'unit', 'units')}</span>`,
      )}
      <p class="px-1 mb-2 text-[13px] text-[var(--ink-soft)]">
        Override a printed code, or issue a new one if a label is lost or reused.
      </p>
      ${
        units.length
          ? `<div class="surface divide-y divide-[var(--line)] overflow-hidden">${units.map(unitRowMarkup).join('')}</div>`
          : `<div class="surface px-4 py-5 text-[13px] text-[var(--ink-soft)] text-center">No storage units yet.</div>`
      }

      ${sectionTitle(
        'Item barcodes',
        `<span class="text-[11px] text-[var(--ink-faint)]">${plural(coded.length, 'item', 'items')}</span>`,
      )}
      <p class="px-1 mb-2 text-[13px] text-[var(--ink-soft)]">
        Products whose own barcode is stored — these need no QR label.
      </p>
      ${
        coded.length
          ? `<div class="surface divide-y divide-[var(--line)] overflow-hidden">${coded.map(itemRowMarkup).join('')}</div>`
          : `<div class="surface px-4 py-5 text-[13px] text-[var(--ink-soft)] text-center">
               Nothing has a barcode yet. Add one while editing an item.
             </div>`
      }

      ${sectionTitle('Data')}
      ${listCard(`
        <button type="button" data-export-all class="row-press w-full flex items-center gap-3 px-4 py-3.5">
          <span class="w-9 h-9 rounded-lg bg-[var(--sunken)] text-[var(--ink-soft)] grid place-items-center shrink-0">
            ${icon('cloud', 'w-4.5 h-4.5')}
          </span>
          <span class="flex-1 text-left">
            <span class="block font-medium">Export inventory</span>
            <span class="block text-[13px] text-[var(--ink-soft)]">Download as JSON or CSV</span>
          </span>
          <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
        </button>
        <div class="border-t border-[var(--line)]"></div>
        <button type="button" data-import class="row-press w-full flex items-center gap-3 px-4 py-3.5">
          <span class="w-9 h-9 rounded-lg bg-[var(--sunken)] text-[var(--ink-soft)] grid place-items-center shrink-0">
            ${icon('upload', 'w-4.5 h-4.5')}
          </span>
          <span class="flex-1 text-left">
            <span class="block font-medium">Import inventory</span>
            <span class="block text-[13px] text-[var(--ink-soft)]">Restore from backup</span>
          </span>
          <span class="text-[var(--ink-faint)]">${icon('chevron', 'w-4 h-4')}</span>
        </button>`)}

      <div class="h-6"></div>`;

    body.querySelector('[data-appearance]').addEventListener('click', () => appearanceSheet());
    body.querySelector('[data-export-all]').addEventListener('click', () => exportDataSheet());
    body.querySelector('[data-import]').addEventListener('click', () => importDataSheet());
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
        <div class="surface is-failed px-3 py-2.5 text-[13px] mb-4">
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
        <span class="w-9 h-9 rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center shrink-0">
          ${icon('box', 'w-4.5 h-4.5')}
        </span>
        <span class="flex-1 min-w-0">
          <span class="block font-medium truncate">${esc(unit.name)}</span>
          <span class="block text-[13px] text-[var(--ink-soft)] truncate">${esc(trail || unit.room_name || '')}</span>
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
    <div style="display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem; background: var(--canvas);">
      <a href="#/" style="width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 0.5rem; color: var(--ink-soft); flex-shrink: 0;">
        ${icon('back', 'w-5 h-5')}
      </a>
      <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; height: 2.75rem; padding: 0 0.75rem; border-radius: 0.5rem; background: var(--sunken); border: 1px solid transparent;">
        <span style="color: var(--ink-faint); flex-shrink: 0;">${icon('search', 'w-4.5 h-4.5')}</span>
        <input id="search-input" type="search" autocomplete="off" enterkeyhint="search"
          placeholder="Search items and tags"
          style="flex: 1; background: transparent; outline: none; border: none; color: var(--ink); font: inherit;">
      </div>
      <button id="search-filters" type="button" aria-label="Filters"
        style="width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 0.5rem; color: var(--ink-soft); border: none; background: transparent; cursor: pointer; flex-shrink: 0;">
        ${icon('settings', 'w-5 h-5')}
      </button>
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

    body.innerHTML = `
      ${match ? `<div class="mb-4">${sectionTitle('Matches this code')}${codeMatchCard(match)}</div>` : ''}
      ${
        !cached && loading
          ? skeletonList(5)
          : results.length
            ? listCard(results.map((i) => itemRow(i, { showLocation: true, pending: store.isTemp(i.id) })).join(''))
            : cached
              ? match
                ? ''
                : emptyState('No matches', `Nothing here matches "${searchQuery}".`)
              : skeletonList(5)
      }
      ${
        cached && results.length
          ? `<p class="text-[13px] text-[var(--ink-faint)] text-center mt-4">${data.total} match${data.total === 1 ? '' : 'es'}</p>`
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
          <label class="block text-[13px] font-medium text-[var(--ink-soft)] mb-1.5">Room</label>
          <select id="filter-room" class="${inputCls}">
            <option value="">All rooms</option>
            ${rooms().map((r) => `<option value="${r.id}" ${searchFilters.room_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[13px] font-medium text-[var(--ink-soft)] mb-1.5">Tags</label>
          <input type="text" id="filter-tags" placeholder="Comma-separated tags" value="${esc(searchFilters.tags)}"
            class="${inputCls}">
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="filter-barcode" ${searchFilters.has_barcode ? 'checked' : ''}
            class="w-4 h-4 rounded border-[var(--line)]">
          <span class="text-[13px] text-[var(--ink)]">Has barcode</span>
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

function exportDataSheet() {
  openSheet({
    title: 'Export inventory',
    body: `
      <p class="text-[13px] text-[var(--ink-soft)] mb-4">
        Download all your data as JSON (complete backup) or CSV (spreadsheet).
      </p>
      <div class="space-y-2">
        <button type="button" data-export-json
          class="w-full h-11 rounded-lg bg-[var(--color-accent)] text-white font-medium active:bg-[var(--color-accent-hover)] transition-colors">
          Export as JSON
        </button>
        <button type="button" data-export-csv
          class="w-full h-11 rounded-lg border border-[var(--line)] font-medium active:bg-[var(--sunken)] transition-colors">
          Export as CSV
        </button>
      </div>`,
    onMount(body) {
      body.querySelector('[data-export-json]').addEventListener('click', () => {
        exportInventoryJSON();
      });
      body.querySelector('[data-export-csv]').addEventListener('click', () => {
        exportInventoryCSV();
      });
    },
  });
}

function importDataSheet() {
  openSheet({
    title: 'Import inventory',
    body: `
      <p class="text-[13px] text-[var(--ink-soft)] mb-4">
        Restore rooms, items, tags, and properties from a backup file.
      </p>
      <input type="file" id="import-file" accept=".json" style="display: none;">
      <button type="button" data-choose-file
        class="w-full h-11 rounded-lg bg-[var(--color-accent)] text-white font-medium active:bg-[var(--color-accent-hover)] transition-colors">
        Choose JSON file
      </button>
      <div id="import-status" class="mt-4"></div>`,
    onMount(body, close) {
      const fileInput = body.querySelector('#import-file');
      body.querySelector('[data-choose-file]').addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await importInventoryJSON(data);
          body.querySelector('#import-status').innerHTML = '<p class="text-[13px] text-green-600 font-medium">Import successful!</p>';
          setTimeout(close, 1500);
        } catch (err) {
          body.querySelector('#import-status').innerHTML = `<p class="text-[13px] text-red-600 font-medium">${esc(err.message)}</p>`;
        }
      });
    },
  });
}

async function exportInventoryJSON() {
  try {
    const rooms = store.peek('/rooms').data?.rooms || [];
    const units = store.peek('/storage-units').data?.storage_units || [];
    const items = store.peek('/items?limit=10000').data?.items || [];
    const tags = store.peek('/tags').data?.tags || [];
    const props = store.peek('/properties').data?.properties || [];

    const data = { rooms, units, items, tags, properties: props, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-repo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Inventory exported');
  } catch (err) {
    toast(err.message || 'Export failed', { tone: 'error' });
  }
}

async function exportInventoryCSV() {
  try {
    const items = store.peek('/items?limit=10000').data?.items || [];
    const rows = [['Name', 'Description', 'Quantity', 'Room', 'Location', 'Tags', 'Barcode', 'Icon']];
    for (const i of items) {
      rows.push([
        i.name,
        i.description || '',
        i.quantity,
        i.location?.room_name || '',
        i.location?.path_string || '',
        (i.tags || []).join('; '),
        i.barcode || '',
        i.icon || '',
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-repo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Inventory exported as CSV');
  } catch (err) {
    toast(err.message || 'Export failed', { tone: 'error' });
  }
}

async function importInventoryJSON(data) {
  if (!data.rooms || !Array.isArray(data.rooms)) throw new Error('Invalid backup: missing rooms');
  let imported = 0;
  for (const room of data.rooms) {
    try {
      await post('/rooms', { name: room.name, floor: room.floor, floor_name: room.floor_name });
      imported++;
    } catch {}
  }
  toast(`Imported ${imported} room${imported === 1 ? '' : 's'}`);
  store.revalidate();
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

const routes = [
  { re: /^\/?$/, screen: homeScreen },
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
  closeDrawer();

  if (key !== currentKey) {
    currentKey = key;
    current = route.screen;
    if (route.screen === searchScreen && query.get('q')) searchQuery = query.get('q');

    current.id = params.id || current.id;
    lastHeader = current.header();
    headerEl().innerHTML = lastHeader;
    current.mount(screenEl(), params);
    scrollTo({ top: 0 });

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
  renderSidebar();
  document.getElementById('sync-pip').classList.toggle('hidden', store.pendingCount() === 0);
  // Adding an item makes no sense on the label sheet or in settings, and the
  // floating button would sit on top of their controls.
  document
    .getElementById('fab')
    .classList.toggle('hidden', current === settingsScreen || current === labelsScreen);
}

// The header is rebuilt from a string, so its listeners must be reattached.
function rewireHeader() {
  const head = headerEl();
  head.querySelector('[data-go-search]')?.addEventListener('click', () => {
    location.hash = '#/search';
  });
  head.querySelector('[data-scan]')?.addEventListener('click', () => scanWithFallback());
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
  if (current === unitScreen) {
    const unit = store.peek(current.paths()[0]).data?.storage_unit;
    itemSheet({ roomId: unit?.room_id, unitId: unit?.id });
  } else if (current === roomScreen) {
    itemSheet({ roomId: current.id });
  } else {
    itemSheet();
  }
});

document.querySelectorAll('[data-nav]').forEach((el) =>
  el.addEventListener('click', () => {
    location.hash = el.dataset.nav;
  }),
);

document.getElementById('nav-scan').addEventListener('click', () => scanWithFallback());
document.getElementById('nav-menu').addEventListener('click', openDrawer);
document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
initSidebarCollapse();

// Escape hatch while the sheet is open on iOS, where scroll can get stuck.
addEventListener('pageshow', () => closeAllSheets());

initTheme();
store.load('/rooms').catch(() => {});
render();

// The sidebar only exists above lg; render it when the layout crosses over.
matchMedia('(min-width: 1024px)').addEventListener('change', renderSidebar);
