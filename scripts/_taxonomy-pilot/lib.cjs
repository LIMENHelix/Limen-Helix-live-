/**
 * _taxonomy-pilot/lib.cjs — isolated, read-only proof harness machinery.
 *
 * NOT wired into runtime. Lives under scripts/ (excluded from the Vercel bundle).
 * Loads the OLD per-domain taxonomy files (browser IIFEs) inside a stubbed,
 * fully-pinned Node vm context, extracts their pure-data constants, and builds
 * an in-memory "shared engine" prototype (functions byte-identical, data sourced
 * from the extracted JSON) so old vs prototype output can be deep-equal compared.
 *
 * Nondeterminism is pinned: Math.random (seeded mulberry32), Date.now / new Date
 * (fixed epoch), setTimeout/setInterval (no-op). DOM is a minimal stub.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');

// ── seeded RNG (deterministic Math.random replacement) ──────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIXED_EPOCH = 1750000000000; // pinned Date.now()

// ── stubbed browser context (all nondeterminism pinned) ─────────────────────
function makeContext(opts) {
  opts = opts || {};
  const seed = opts.seed == null ? 12345 : opts.seed;
  const rand = mulberry32(seed);

  // minimal document stub: only createElement(...).textContent/innerHTML (HTML-escape)
  const doc = {
    createElement() {
      let _t = '';
      return {
        set textContent(v) { _t = v == null ? '' : String(v); },
        get textContent() { return _t; },
        get innerHTML() {
          return _t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },
        set innerHTML(v) { _t = v; }
      };
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: {}
  };

  const store = {};
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  // Date with pinned now() but functional instances
  const RealDate = Date;
  function PinnedDate(...args) {
    if (args.length === 0) return new RealDate(FIXED_EPOCH);
    return new RealDate(...args);
  }
  PinnedDate.now = () => FIXED_EPOCH;
  PinnedDate.prototype = RealDate.prototype;

  // Math with pinned random
  const PinnedMath = Object.create(Math);
  PinnedMath.random = rand;

  const loc = { search: '?domain=finance', pathname: '/domain-console', href: 'https://limenhelix.com/domain-console?domain=finance' };
  const win = { LIMEN_ENABLE_DIRECTIVE_EXTRACTION: true, location: loc, document: doc, localStorage, navigator: { userAgent: 'node-harness' }, addEventListener() {}, setTimeout: () => 0, setInterval: () => 0 };
  const sandbox = {
    window: win,
    document: doc,
    localStorage,
    location: loc,
    navigator: { userAgent: 'node-harness' },
    console: { log() {}, warn() {}, error() {}, info() {} },
    Math: PinnedMath,
    Date: PinnedDate,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame: () => 0,
    JSON, Object, Array, String, Number, Boolean, RegExp, parseInt, parseFloat, isNaN, isFinite,
    URLSearchParams, URL, Map, Set, Promise, Symbol, Error, encodeURIComponent, decodeURIComponent,
    __DATA: opts.data || null
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function loadFileSource(ctx, src, filename) {
  vm.runInContext(src, ctx, { filename: filename || 'inline.js' });
}

// ── balanced-bracket span finder (string/comment aware; no regex inside data) ─
function skipString(src, i) {
  const q = src[i]; i++;
  for (; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === q) return i;
  }
  throw new Error('unterminated string at ' + i);
}
function scanBalanced(src, i) { // i at opening { or [
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced bracket');
}

// find `var NAME = {...};` (or [...]) declared at <=2-space indent (top of IIFE)
function findConstSpan(src, name) {
  const re = new RegExp('(^|\\n)([ \\t]*)var\\s+' + name + '\\s*=\\s*', 'g');
  const m = re.exec(src);
  if (!m) return null;
  const declStart = m.index + (m[1] ? m[1].length : 0); // start of indentation/var
  let bs = m.index + m[0].length;                       // first char after '='
  while (src[bs] === ' ' || src[bs] === '\t' || src[bs] === '\n') bs++;
  if (src[bs] !== '{' && src[bs] !== '[') return null;   // only object/array literals
  const be = scanBalanced(src, bs);
  let j = be + 1;
  while (src[j] === ' ' || src[j] === '\t') j++;
  if (src[j] !== ';') return null;
  return { declStart, declEnd: j + 1, valueStart: bs, valueEnd: be + 1, valueText: src.slice(bs, be + 1) };
}

// extract a literal's value by evaluating it in a clean vm (source-of-truth)
function evalLiteral(valueText) {
  return vm.runInNewContext('(' + valueText + ')', {});
}

function jsonClone(x) { return JSON.parse(JSON.stringify(x)); }

// extract all requested pure-data consts; report which are JSON-round-trippable
function extractData(src, names) {
  const data = {}, report = [];
  for (const name of names) {
    const span = findConstSpan(src, name);
    if (!span) { report.push({ name, status: 'NOT_FOUND' }); continue; }
    let value;
    try { value = evalLiteral(span.valueText); }
    catch (e) { report.push({ name, status: 'EVAL_FAILED', error: String(e) }); continue; }
    let roundTrips = false;
    try { roundTrips = deepDiff(value, jsonClone(value)).length === 0; } catch (e) { roundTrips = false; }
    if (roundTrips) { data[name] = value; report.push({ name, status: 'EXTRACTED' }); }
    else { report.push({ name, status: 'NOT_SERIALIZABLE_left_inline' }); }
  }
  return { data, report };
}

// build prototype source: replace each EXTRACTED const decl with `var NAME = __DATA["NAME"];`
function buildPrototypeSource(src, extractedNames) {
  const spans = [];
  for (const name of extractedNames) {
    const span = findConstSpan(src, name);
    if (span) spans.push({ name, ...span });
  }
  spans.sort((a, b) => b.declStart - a.declStart); // last → first to keep indices valid
  let out = src;
  for (const s of spans) {
    out = out.slice(0, s.declStart) + 'var ' + s.name + ' = __DATA[' + JSON.stringify(s.name) + '];' + out.slice(s.declEnd);
  }
  return out;
}

// ── deep structural diff (returns list of {path, a, b}) ─────────────────────
function deepDiff(a, b, path) {
  path = path || '$';
  const out = [];
  if (a === b) return out;
  const ta = typeof a, tb = typeof b;
  if (ta !== tb) { out.push({ path, a, b, reason: 'type ' + ta + ' vs ' + tb }); return out; }
  if (a === null || b === null || ta !== 'object') {
    if (a !== b) {
      // NaN check
      if (!(typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)))
        out.push({ path, a, b, reason: 'value' });
    }
    return out;
  }
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) { out.push({ path, reason: 'array vs object' }); return out; }
  if (aArr) {
    if (a.length !== b.length) out.push({ path: path + '.length', a: a.length, b: b.length, reason: 'array length' });
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) out.push(...deepDiff(a[i], b[i], path + '[' + i + ']'));
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) out.push(...deepDiff(a[k], b[k], path + '.' + k));
  return out;
}

module.exports = {
  makeContext, loadFileSource, extractData, buildPrototypeSource,
  deepDiff, jsonClone, FIXED_EPOCH, mulberry32
};
