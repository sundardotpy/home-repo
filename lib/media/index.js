// Takes whatever a phone camera produces and turns it into two predictable
// JPEGs: a display image and a thumbnail.
//
// sharp handles image decoding and EXIF orientation; .rotate() applies the tag.

import sharp from 'sharp';

import { newUUID } from '../uuid.js';

const DISPLAY_MAX = 1600; // enough to pinch-zoom a label on a box
const THUMB_MAX = 400;

const DISPLAY_QUALITY = 82;
const THUMB_QUALITY = 75;

/**
 * MaxUpload is generous enough for a modern phone photo and small enough that a
 * bad request cannot exhaust memory.
 */
export const MAX_UPLOAD = 15 << 20;

export class MediaError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'MediaError';
    this.kind = kind;
  }
}

export const ErrUnsupported = 'unsupported image format';
export const ErrTooLarge = 'image too large';
export const ErrNotFound = 'photo not found';

// Variants of a stored photo.
export const Display = 'display';
export const Thumb = 'thumb';

/**
 * Identifies a photo. Keys are content-free and never reused, which is what
 * lets the URLs be cached forever.
 */
export function newKey() {
  const id = newUUID();
  return `items/${id.slice(0, 2)}/${id}`;
}

/**
 * Process decodes, rotates and re-encodes an upload into both sizes.
 *
 * Re-encoding is deliberate: it normalises the format and drops EXIF —
 * including the GPS coordinates phones attach — from everything served.
 */
export async function process(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (raw.length > MAX_UPLOAD) {
    throw new MediaError(ErrTooLarge, `upload exceeds ${MAX_UPLOAD} bytes`);
  }
  if (raw.length === 0) {
    throw new MediaError(ErrUnsupported, 'empty upload');
  }

  // .rotate() with no argument reads the EXIF orientation and bakes it in.
  // Phones record rotation there rather than in the pixels, and re-encoding
  // drops the tag, so this has to happen before anything is resized.
  const base = sharp(raw, { failOn: 'error' }).rotate();

  let meta;
  try {
    meta = await base.metadata();
  } catch (err) {
    throw new MediaError(ErrUnsupported, err.message);
  }
  if (!meta.width || !meta.height) {
    throw new MediaError(ErrUnsupported, 'could not read image dimensions');
  }

  try {
    const display = await base
      .clone()
      .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: DISPLAY_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    const thumb = await base
      .clone()
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      display: { bytes: display.data, width: display.info.width, height: display.info.height },
      thumb: { bytes: thumb.data, width: thumb.info.width, height: thumb.info.height },
    };
  } catch (err) {
    if (err instanceof MediaError) throw err;
    throw new MediaError(ErrUnsupported, err.message);
  }
}

/**
 * VariantFromPath maps a request path suffix to a variant: `<key>_t.jpg` is the
 * thumbnail, `<key>.jpg` the display image.
 */
export function variantFromPath(p) {
  if (p.length > 6 && p.endsWith('_t.jpg')) return { key: p.slice(0, -6), variant: Thumb };
  if (p.length > 4 && p.endsWith('.jpg')) return { key: p.slice(0, -4), variant: Display };
  return { key: '', variant: '', ok: false };
}
