const FRESH_START_VERSION = '2026-05-18-eventus-fresh-ats-v2-import-autopilot';
const FRESH_START_KEY = 'eventus:fresh-start-version';

const RESET_PREFIXES = ['eventus:test:', 'recruitiq:test:'];

export function applyFreshAtsReset() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(FRESH_START_KEY) === FRESH_START_VERSION) return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && RESET_PREFIXES.some(prefix => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => window.localStorage.removeItem(key));
  window.localStorage.setItem(FRESH_START_KEY, FRESH_START_VERSION);
}
