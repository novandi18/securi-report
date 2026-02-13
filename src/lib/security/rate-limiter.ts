/**
 * In-memory sliding-window rate limiter.
 *
 * Used to protect auth endpoints, destructive actions, and
 * to detect brute-force login attempts (OWASP A07).
 *
 * Production note: for multi-instance deployments, swap this
 * with a Redis-backed implementation.
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

// Cleanup interval: purge expired keys every 60 s
const CLEANUP_INTERVAL = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
  // Don't prevent Node from exiting
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

/**
 * Check rate limit for a given key (e.g. IP or userId).
 *
 * @param key        Unique identifier (IP address, user ID, etc.)
 * @param maxAttempts  Max requests allowed in the window
 * @param windowMs     Sliding window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  ensureCleanup(windowMs);

  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxAttempts) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Record this attempt
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxAttempts - entry.timestamps.length,
    retryAfterMs: null,
  };
}

/**
 * Returns the count of attempts in the current window for a key.
 * Useful for detecting brute-force patterns without consuming a slot.
 */
export function getAttemptCount(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry) return 0;
  const now = Date.now();
  return entry.timestamps.filter((t) => now - t < windowMs).length;
}

/**
 * Resets the rate limit for a key (e.g. after a successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

// ─── Pre-configured limiters ─────────────────────────────

/** Login: 5 attempts per 10 minutes */
export function checkLoginRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`login:${ip}`, 5, 10 * 60 * 1000);
}

/** Forgot password: 3 attempts per 15 minutes */
export function checkForgotPasswordRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
}

/** Delete actions: 10 per minute */
export function checkDeleteRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`delete:${userId}`, 10, 60 * 1000);
}

/** 2FA verification: 5 attempts per 5 minutes */
export function check2FARateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`2fa:${ip}`, 5, 5 * 60 * 1000);
}
