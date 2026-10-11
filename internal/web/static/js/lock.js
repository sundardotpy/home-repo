// The passcode screen. The server decides whether one is needed: when the app is
// deployed with APP_PASSCODE every data request answers 401 until someone has
// unlocked it, and this covers the app until they do. At home, with no passcode
// set, none of this ever shows.

let required = false;
let showing = false;

export const lockRequired = () => required;

export async function checkSession() {
  try {
    const s = await fetch('/api/session').then((r) => r.json());
    required = !!s.required;
    if (s.required && !s.authed) showLock();
  } catch {
    // Offline: the cached screens still work, and the first real request will
    // say whether a passcode is needed.
  }
}

export async function lockNow() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {}
  location.reload();
}

export function showLock(message = '') {
  if (showing) return;
  showing = true;
  required = true;

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
      if (res.ok) return location.reload();
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
}

// Any API call that comes back 401 means the session ended (or never began).
addEventListener('auth-required', () => showLock());
