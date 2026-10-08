/**
 * When to play the intro.
 *
 * DatePilot has no login, so a "session" here means:
 *  - a browser session (sessionStorage, cleared when the tab/browser closes), and
 *  - an inactivity timeout: if nobody has touched the site for IDLE_TIMEOUT_MS, the
 *    session counts as timed out and the intro plays again on the next visit or when the
 *    tab becomes visible again.
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const SEEN_KEY = 'dp:intro-seen';
const ACTIVE_KEY = 'dp:last-active';

function read(storage, key) {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    window[storage].setItem(key, value);
  } catch {
    // storage unavailable: the intro simply plays once per page load
  }
}

function idleTooLong(now = Date.now()) {
  const last = Number(read('localStorage', ACTIVE_KEY));
  return Boolean(last) && now - last > IDLE_TIMEOUT_MS;
}

/** True on the first visit in this browser session, or after the inactivity timeout. */
export function shouldPlayIntroOnLoad() {
  return !read('sessionStorage', SEEN_KEY) || idleTooLong();
}

/** Remember the intro was shown and the user is active now. */
export function markIntroPlayed() {
  write('sessionStorage', SEEN_KEY, '1');
  write('localStorage', ACTIVE_KEY, String(Date.now()));
}

/**
 * Track activity and call `onTimedOut` when the user comes back to the tab after being
 * idle longer than the timeout. Returns a cleanup function.
 */
export function watchSessionTimeout(onTimedOut) {
  let lastWrite = 0;
  const touch = () => {
    const now = Date.now();
    if (now - lastWrite < 15000) return; // at most every 15 s
    lastWrite = now;
    write('localStorage', ACTIVE_KEY, String(now));
  };
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (idleTooLong()) onTimedOut();
    else touch();
  };

  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  touch();
  return () => {
    events.forEach((e) => window.removeEventListener(e, touch));
    document.removeEventListener('visibilitychange', onVisible);
  };
}
