// QR labels: view one, print a sheet of them, scan one back.
//
// The label is the physical half of the app. Everything here optimises for the
// paper: high contrast, the code spelled out in case the QR is damaged, and a
// dashed cut line.

import { qs } from './api.js';
import { esc, field, icon, inputCls, openSheet, primaryButton, ghostButton, toast } from './ui.js';

export const qrSVGUrl = (slug) => `/api/qr/${encodeURIComponent(slug)}/svg`;
export const scanURLFor = (slug) => `${location.origin}/q/${slug}`;

// A single label, sized in millimetres so screen and paper agree.
export function labelCard(unit) {
  const room = unit.room_name || '';
  const trail = [room, ...(unit.path || []).slice(0, -1)].filter(Boolean).join(' › ');
  return `
    <div class="label-card">
      <img src="${esc(qrSVGUrl(unit.qr_slug))}" alt="" class="label-qr">
      <div class="label-text">
        <div class="label-name">${esc(unit.name)}</div>
        ${trail ? `<div class="label-path">${esc(trail)}</div>` : ''}
        <div class="label-code">${esc(unit.qr_slug)}</div>
      </div>
    </div>`;
}

export function qrSheet(unit) {
  openSheet({
    title: `Label for ${unit.name}`,
    body: `
      <div class="text-center">
        <img src="${esc(qrSVGUrl(unit.qr_slug))}" alt="QR code for ${esc(unit.name)}"
             class="w-56 h-56 mx-auto rounded-xl border border-[var(--line)] bg-white p-2">
        <div class="mt-3 font-mono tracking-[0.2em] text-lg">${esc(unit.qr_slug)}</div>
        <p class="mt-1 text-[13px] text-[var(--ink-soft)] break-all">${esc(scanURLFor(unit.qr_slug))}</p>
        <p class="mt-3 text-[13px] text-[var(--ink-soft)]">
          Stick this on the box. Any phone camera opens it straight to what is inside.
        </p>
      </div>
      <div class="flex gap-2 mt-5">
        ${primaryButton(`${icon('print', 'w-5 h-5')} Print this label`, 'data-print class="flex-1"')}
        ${ghostButton('Copy link', 'data-copy')}
      </div>
      <div class="mt-2">
        ${ghostButton('Print every label in this room', 'data-print-room class="w-full"')}
      </div>`,
    onMount(body, close) {
      body.querySelector('[data-print]').addEventListener('click', () => {
        close();
        location.hash = `#/labels/${unit.room_id}?only=${unit.id}`;
      });
      body.querySelector('[data-print-room]').addEventListener('click', () => {
        close();
        location.hash = `#/labels/${unit.room_id}`;
      });
      body.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(scanURLFor(unit.qr_slug));
          toast('Link copied');
        } catch {
          toast('Could not copy — the link is shown above');
        }
      });
    },
  });
}

// ---------------------------------------------------------------- scanning ---

// Resolve whatever a scan produced — one of our QR labels, or the barcode
// already printed on a product — and go wherever it points. The server decides
// which kind it is; the camera cannot tell us.
//
// onUnknown is called with a code nothing recognises, so the caller can offer
// to attach it to a new item.
export async function openCode(raw, { onUnknown } = {}) {
  const text = String(raw || '').trim();
  if (!text) return false;

  let res;
  try {
    res = await fetch(`/api/scan${qs({ code: text })}`);
  } catch {
    toast('Offline — cannot look that code up', { tone: 'error' });
    return false;
  }
  const data = await res.json().catch(() => ({}));

  if (res.ok && data.app_url) {
    location.hash = data.app_url.replace(/^\/?#?/, '#');
    return true;
  }
  if (res.ok && data.kind === 'items') {
    // Several of the same product; the search screen shows them with paths.
    location.hash = `#/search?q=${encodeURIComponent(data.barcode)}`;
    return true;
  }
  if (res.status === 404) {
    if (onUnknown) {
      onUnknown(data.barcode || text);
      return true;
    }
    toast(`Nothing here has the code ${data.barcode || text}`, { tone: 'error' });
    return false;
  }
  toast(data.error || 'Could not read that code', { tone: 'error' });
  return false;
}

// Everything a phone camera can read that we might care about: our own QR
// labels, and the barcodes already printed on shop-bought products.
const SCAN_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
];

// captureSheet reads a code and hands it back instead of navigating — used
// when attaching a barcode to an item being edited.
export function barcodeCaptureSheet(onCode) {
  const canScan = 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  let stream = null;
  let timer = null;
  const stop = () => {
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  openSheet({
    title: 'Scan a barcode',
    onClose: stop,
    body: `
      ${
        canScan
          ? `<div class="relative aspect-[4/3] rounded-xl overflow-hidden bg-black mb-4">
               <video data-video playsinline muted class="w-full h-full object-cover"></video>
               <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-20 border-2 border-white/70 rounded-lg"></div>
               <p data-status class="absolute inset-x-0 bottom-2 text-center text-white/80 text-[13px]">
                 Line up the barcode
               </p>
             </div>`
          : `<p class="text-[13px] text-[var(--ink-soft)] mb-4">
               This browser cannot use the camera. Type the digits printed under the barcode.
             </p>`
      }
      <form data-form>
        ${field('Barcode', `<input name="code" class="${inputCls} font-mono" inputmode="numeric"
            autocomplete="off" placeholder="5000157024671">`)}
        ${primaryButton('Use this code', 'data-go class="w-full"')}
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      const submit = () => {
        const v = form.code.value.trim().replace(/[\s-]/g, '');
        if (!v) return form.code.focus();
        close();
        onCode(v);
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      body.querySelector('[data-go]').addEventListener('click', submit);

      if (!canScan) return;
      const video = body.querySelector('[data-video]');
      const status = body.querySelector('[data-status]');
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then(async (s) => {
          stream = s;
          video.srcObject = s;
          await video.play();
          let detector;
          try {
            detector = new BarcodeDetector({ formats: SCAN_FORMATS.filter((f) => f !== 'qr_code') });
          } catch {
            detector = new BarcodeDetector();
          }
          timer = setInterval(async () => {
            try {
              const [hit] = await detector.detect(video);
              if (!hit) return;
              clearInterval(timer);
              close();
              onCode(hit.rawValue.trim());
            } catch {
              // keep looking
            }
          }, 300);
        })
        .catch(() => {
          status.textContent = 'Camera unavailable — type the digits below';
        });
    },
  });
}

export function scanSheet({ onUnknown } = {}) {
  // BarcodeDetector is the only way to scan without shipping a decoder
  // library; where it is missing, typing the printed code is the fallback.
  const canScan = 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  let stream = null;
  let timer = null;

  const stop = () => {
    clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  openSheet({
    title: 'Scan a code',
    onClose: stop,
    body: `
      ${
        canScan
          ? `<div class="relative aspect-square rounded-xl overflow-hidden bg-black mb-4">
               <video data-video playsinline muted class="w-full h-full object-cover"></video>
               <div class="absolute inset-8 border-2 border-white/70 rounded-xl"></div>
               <p data-status class="absolute inset-x-0 bottom-2 text-center text-white/80 text-[13px]">
                 Point at a QR label or a product barcode
               </p>
             </div>`
          : `<p class="text-[13px] text-[var(--ink-soft)] mb-4">
               This browser cannot use the camera for scanning. Point your phone's camera app at
               a QR label instead — it opens the same link — or type the code below.
             </p>`
      }
      <form data-form>
        ${field(
          'Code',
          `<input name="code" class="${inputCls} font-mono tracking-wider"
             autocomplete="off" placeholder="8H90AQ6BRX or 5000157024671">`,
          'Our label codes and product barcodes both work.',
        )}
        ${primaryButton('Open', 'data-go class="w-full"')}
      </form>`,
    onMount(body, close) {
      const form = body.querySelector('[data-form]');
      const handleUnknown = onUnknown
        ? (code) => {
            close();
            onUnknown(code);
          }
        : undefined;
      const submit = async () => {
        const ok = await openCode(form.code.value, { onUnknown: handleUnknown });
        if (ok) close();
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      body.querySelector('[data-go]').addEventListener('click', submit);

      if (!canScan) return;
      const video = body.querySelector('[data-video]');
      const status = body.querySelector('[data-status]');

      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then(async (s) => {
          stream = s;
          video.srcObject = s;
          await video.play();
          // Some browsers reject formats they cannot decode, so fall back to
          // QR alone rather than losing the scanner entirely.
          let detector;
          try {
            detector = new BarcodeDetector({ formats: SCAN_FORMATS });
          } catch {
            detector = new BarcodeDetector({ formats: ['qr_code'] });
          }
          const look = async () => {
            try {
              const [hit] = await detector.detect(video);
              if (!hit) return;
              clearInterval(timer);
              status.textContent = 'Found it…';
              const ok = await openCode(hit.rawValue, { onUnknown: handleUnknown });
              if (ok) return close();
              // Unrecognised: pause before looking again, or the same code is
              // re-read (and re-rejected) several times a second.
              status.textContent = 'Not recognised — try another code';
              setTimeout(() => {
                if (stream) timer = setInterval(look, 300);
              }, 1500);
            } catch {
              // A frame that fails to decode is normal; keep looking.
            }
          };
          timer = setInterval(look, 300);
        })
        .catch(() => {
          status.textContent = 'Camera unavailable — type the code below';
        });
    },
  });
}
