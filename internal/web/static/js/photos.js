// Photo uploads.
//
// Same promise as every other action: the picture is on screen the moment it is
// chosen. The file goes up afterwards, and the local preview is swapped for the
// server's thumbnail once it lands.
//
// Unlike the JSON mutation queue, these are not persisted across a reload — a
// File cannot go into localStorage — so a failed upload offers Retry while the
// page is open, and the item simply keeps no photo if the tab is closed first.

import { clearItemOverlay, patchItem, setItemOverlay, whenSaved, revalidate } from './store.js';
import { toast } from './ui.js';

export function attachPhoto(itemId, file) {
  const localURL = URL.createObjectURL(file);
  // An overlay, not a plain patch: saving the item's other fields triggers a
  // revalidation, and the server does not have this photo yet.
  setItemOverlay(itemId, {
    photo_url: localURL,
    photo_thumb_url: localURL,
    _photo_uploading: true,
  });
  send(itemId, file, localURL);
}

async function send(itemId, file, localURL) {
  try {
    // A photo can be picked while the item is still being created.
    const realId = await whenSaved(itemId);
    if (realId !== itemId) {
      // The row is keyed by the server's id now; keep the preview attached.
      setItemOverlay(realId, {
        photo_url: localURL,
        photo_thumb_url: localURL,
        _photo_uploading: true,
      });
    }

    const form = new FormData();
    form.append('photo', file);
    const res = await fetch(`/api/items/${realId}/photo`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || body.error || 'upload failed');
    }
    const item = await res.json();

    const done = {
      photo_path: item.photo_path,
      photo_url: item.photo_url,
      photo_thumb_url: item.photo_thumb_url,
      _photo_uploading: false,
    };
    // Swap only once the server's thumbnail has decoded, otherwise the row
    // flashes empty between losing the blob and painting the real image.
    await preload(item.photo_thumb_url);

    clearItemOverlay(itemId);
    clearItemOverlay(realId);
    patchItem(itemId, done);
    if (realId !== itemId) patchItem(realId, done);
    URL.revokeObjectURL(localURL);
    revalidate();
  } catch (err) {
    clearItemOverlay(itemId);
    patchItem(itemId, { photo_url: null, photo_thumb_url: null, _photo_uploading: false });
    URL.revokeObjectURL(localURL);
    toast(err.message || 'Photo upload failed', {
      tone: 'error',
      action: 'Retry',
      onAction: () => attachPhoto(itemId, file),
    });
  }
}

function preload(url) {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

export async function removePhoto(item) {
  patchItem(item.id, { photo_url: null, photo_thumb_url: null, photo_path: null });
  try {
    const realId = await whenSaved(item.id);
    const res = await fetch(`/api/items/${realId}/photo`, { method: 'DELETE' });
    if (!res.ok) throw new Error('could not remove the photo');
    revalidate();
  } catch (err) {
    toast(err.message, { tone: 'error' });
    revalidate(); // put the server's truth back on screen
  }
}
