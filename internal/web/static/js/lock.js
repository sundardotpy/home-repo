// The passcode screen. The server decides whether one is needed: when the app is
// deployed with APP_PASSCODE every data request answers 401 until someone has
// unlocked it, and this covers the app until they do. At home, with no passcode
// set, none of this ever shows.

let required = false;
let showing = false;
let sessionCheck = null;

export const lockRequired = () => required;

/**
 * One session check at a time: the inline boot in index.html and app.js both
 * ask, and a second fetch at boot is pure latency.
 */
export function checkSession() {
  if (sessionCheck) return sessionCheck;
  sessionCheck = (async () => {
    try {
      const s = await fetch('/api/session').then((r) => r.json());
      required = !!s.required;
      if (s.required && !s.authed) showLock();
    } catch {
      // Offline: the cached screens still work, and the first real request will
      // say whether a passcode is needed.
    } finally {
      sessionCheck = null;
    }
  })();
  return sessionCheck;
}

export async function lockNow() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {}
  location.reload();
}

/** The inline boot can reach this before the <body> exists; wait for it. */
function whenBodyReady(fn) {
  if (document.body) {
    fn();
    return;
  }
  addEventListener('DOMContentLoaded', fn, { once: true });
}

export function showLock(message = '') {
  if (showing) return;
  showing = true;
  required = true;

  whenBodyReady(() => {
    const el = document.createElement('div');
    el.id = 'lock';
    el.className = 'fixed inset-0 z-[100] bg-[var(--canvas)] grid place-items-center px-6 overflow-y-auto';
    el.innerHTML = `
      <form class="w-full max-w-sm" autocomplete="on">
        <img class="logo-light h-9 w-auto mb-8" src="/static/brand/wordmark.svg" alt="h/repo">
        <img class="logo-dark h-9 w-auto mb-8" src="/static/brand/wordmark-dark.svg" alt="">
        <h1 class="font-display font-bold tracking-tight text-[2rem] leading-tight">Enter the passcode</h1>
        <p class="mt-2 text-[14px] text-[var(--ink-soft)]">This home is locked. The passcode is shared, so ask whoever set it up.</p>
        <label class="block mt-6">
          <span class="sr-only">Passcode</span>
          <input type="password" name="passcode" autocomplete="current-password" autofocus required
            class="w-full h-14 px-4 rounded-lg bg-[var(--paper)] border border-[var(--line)] outline-none focus:border-[var(--ink)]"
            placeholder="Passcode">
        </label>
        <p data-error role="alert" class="mt-3 min-h-[1.25rem] text-[13px] font-semibold text-[var(--del)]">${message}</p>
        <button type="submit" class="btn btn-primary w-full mt-2">Unlock</button>
      </form>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';

    const form = el.querySelector('form');
    const err = el.querySelector('[data-error]');
    const button = el.querySelector('button');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      button.disabled = true;
      err.textContent = '';
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: form.passcode.value }),
        });
        if (res.ok) return unlockInPlace();
        const body = await res.json().catch(() => ({}));
        err.textContent = body.error || 'Could not unlock';
        form.passcode.select();
      } catch {
        err.textContent = 'No connection. Try again.';
      } finally {
        button.disabled = false;
      }
    });
    setTimeout(() => form.passcode.focus(), 50);
  });
}

/**
 * Unlocking used to bounce through location.reload(), which re-downloaded and
 * re-parsed the whole app before a single value showed. From here the session
 * cookie is live, so unlock in place: let app.js know, and it re-runs the
 * loads under the standing screens. app.js may still be arriving when this
 * fires — its own boot re-checks the session either way.
 */
function unlockInPlace() {
  required = false;
  showing = false;
  document.getElementById('lock')?.remove();
  document.body.style.overflow = '';
  dispatchEvent(new Event('hsh-unlocked'));
}

// Any API call that comes back 401 means the session ended (or never began).
addEventListener('auth-required', () => showLock());
