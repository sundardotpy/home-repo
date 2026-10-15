// Renders storage-unit label codes.
//
// Labels get printed once and then live on a box for years, so SVG is the
// primary output: it stays sharp at any label size and on any printer. PNG is
// there for anything that cannot place an SVG.
//
// Uses the qrcode package to render both formats.

import QRCode from 'qrcode';

// Level M tolerates ~15% damage — the right trade for a sticker that will be
// scuffed, taped over and photographed at an angle.
const ERROR_CORRECTION = 'M';

// Two modules of mandatory white border, the QR spec's quiet zone.
const MARGIN = 2;

/** Renders the code as a self-contained SVG, scaled purely by viewBox. */
export async function svg(text) {
  const markup = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: ERROR_CORRECTION,
    margin: MARGIN,
  });
  // crispEdges stops browsers anti-aliasing the modules into mush when a label
  // is scaled up for print.
  return markup.replace('<svg ', '<svg shape-rendering="crispEdges" role="img" aria-label="QR code" ').trimEnd();
}

/** Renders the code as a raster image, for contexts that cannot use SVG. */
export function png(text) {
  return QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: ERROR_CORRECTION,
    margin: MARGIN,
    scale: 8, // ~8px per module: comfortably scannable from a screen
  });
}
