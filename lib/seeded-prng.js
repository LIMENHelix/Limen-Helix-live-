// api/lib/seeded-prng.js
//
// Mulberry32 — a deterministic, seedable 32-bit PRNG used by
// predictive-coding samplers and any other code path that needs
// reproducible randomness. Seed should come from the iteration
// inputHash so the same (portal, cycle, iteration) always produces
// the same sample sequence.
//
// Pure, synchronous, no dependencies, no side effects beyond the
// internal 32-bit counter. NOT cryptographically secure — do not
// use for keys, nonces, or anything security-sensitive.

'use strict';

/**
 * Normalize a seed value to an unsigned 32-bit integer.
 *
 *  - number     → cast via >>> 0 (truncates to uint32)
 *  - hex string → first 8 chars, parseInt(_, 16) (matches inputHash slicing)
 *  - other      → TypeError
 */
function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  if (typeof seed === 'string') {
    // strip optional 0x prefix, take first 8 hex chars
    const stripped = seed.startsWith('0x') || seed.startsWith('0X')
      ? seed.slice(2)
      : seed;
    const slice = stripped.slice(0, 8);
    const parsed = parseInt(slice, 16);
    if (!Number.isFinite(parsed)) {
      throw new TypeError(`seeded-prng: hex seed "${seed}" did not parse to a finite number`);
    }
    return parsed >>> 0;
  }
  throw new TypeError(`seeded-prng: seed must be number or hex string, got ${typeof seed}`);
}

/**
 * Build a mulberry32 PRNG from a seed.
 *
 * @param {number|string} seed - uint32 number or hex string (first 8 chars used)
 * @returns {{ next: () => number, nextInt: (max: number) => number, state: () => number }}
 */
function fromSeed(seed) {
  let s = normalizeSeed(seed);

  function next() {
    // mulberry32 — Tommy Ettinger, public domain.
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(max) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new RangeError(`seeded-prng: nextInt(max) requires positive integer, got ${max}`);
    }
    return Math.floor(next() * max);
  }

  function state() {
    return s;
  }

  return { next, nextInt, state };
}

module.exports = { fromSeed };
