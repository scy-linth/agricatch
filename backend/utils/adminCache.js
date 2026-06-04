/**
 * adminCache.js — Simple in-memory TTL cache for admin stats and heavy queries.
 *
 * Usage:
 *   const adminCache = require('./adminCache');
 *   const cached = adminCache.get('stats');
 *   if (!cached) {
 *     const data = await computeStats();
 *     adminCache.set('stats', data);
 *   }
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _cache = new Map(); // key -> { value, expiry }

const cache = {
  get(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      _cache.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    _cache.set(key, { value, expiry: Date.now() + ttlMs });
  },

  delete(key) {
    _cache.delete(key);
  },

  clear() {
    _cache.clear();
  },

  /** Evict all expired entries (call periodically to free memory) */
  evictExpired() {
    const now = Date.now();
    for (const [key, entry] of _cache) {
      if (now > entry.expiry) _cache.delete(key);
    }
  },

  /** Delete all keys matching a prefix pattern */
  deleteByPrefix(prefix) {
    for (const key of _cache.keys()) {
      if (key.startsWith(prefix)) {
        _cache.delete(key);
      }
    }
  }
};

// Passive cleanup every 10 minutes
setInterval(() => cache.evictExpired(), 10 * 60 * 1000).unref();

module.exports = cache;
