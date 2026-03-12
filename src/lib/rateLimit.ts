/**
 * Simple client-side rate limiter to prevent brute-force on auth forms.
 * Uses in-memory tracking — resets on page reload (intentional).
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blocked: boolean;
  blockedUntil: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCK_MS = 10 * 60 * 1000; // 10 minutes

export function checkRateLimit(key: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, firstAttempt: now, blocked: false, blockedUntil: 0 });
    return { allowed: true, remainingMs: 0 };
  }

  // Check if still in block period
  if (entry.blocked && now < entry.blockedUntil) {
    return { allowed: false, remainingMs: entry.blockedUntil - now };
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttempt: now, blocked: false, blockedUntil: 0 });
    return { allowed: true, remainingMs: 0 };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    entry.blocked = true;
    entry.blockedUntil = now + BLOCK_MS;
    store.set(key, entry);
    return { allowed: false, remainingMs: BLOCK_MS };
  }

  store.set(key, entry);
  return { allowed: true, remainingMs: 0 };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export function formatBlockTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return `${minutes}m`;
}
