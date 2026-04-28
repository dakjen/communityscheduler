/**
 * In-memory sliding window rate limiter.
 * Tracks attempts per key (e.g. IP or username) and blocks
 * requests that exceed the configured threshold.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Maximum number of attempts allowed within the window */
  maxAttempts: number;
  /** Time window in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const { maxAttempts, windowMs } = options;
  const store = getStore(name);

  // Periodically clean up expired entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, windowMs).unref();

  return {
    /**
     * Check if the key has exceeded the rate limit.
     * Records the attempt and throws if limit exceeded.
     */
    check(key: string): void {
      const now = Date.now();
      const entry = store.get(key) || { timestamps: [] };

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= maxAttempts) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = windowMs - (now - oldestInWindow);
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        throw new Error(
          `Too many attempts. Please try again in ${retryAfterSec} seconds.`
        );
      }

      entry.timestamps.push(now);
      store.set(key, entry);
    },
  };
}

// Login: 5 attempts per 15 minutes per username
export const loginLimiter = createRateLimiter('login', {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
});

// Registration: 3 attempts per 15 minutes per IP (keyed by a general key since
// we don't have easy IP access in server actions — we key by username instead
// to prevent username enumeration spam)
export const registrationLimiter = createRateLimiter('registration', {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000,
});

// Username check: 10 lookups per minute to prevent enumeration
export const usernameCheckLimiter = createRateLimiter('username-check', {
  maxAttempts: 10,
  windowMs: 60 * 1000,
});
