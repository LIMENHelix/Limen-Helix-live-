/**
 * lib/tool-fetch.js — shared plumbing for the per-domain public tools.
 *
 * Every *-tools.js handler needs the same three things: a timeout-bounded JSON/text fetch,
 * a Redis read-through cache with a per-tool TTL, and a stale-on-failure fallback. This is
 * that, once, so the handlers hold only the part that is actually domain-specific.
 *
 * The contract the tools rely on: a failed upstream returns { ok:false, reason } and NEVER
 * a filler value. The public fronts render that reason verbatim. Nothing here invents data.
 */
var db = require('./limen-db');

var UA = 'LIMEN-Helix/1.0 (limenhelix.com public tools)';

function getJSON(url, ms, headers) {
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, ms || 10000);
  var h = { 'User-Agent': UA, 'Accept': 'application/json' };
  for (var k in (headers || {})) h[k] = headers[k];
  return fetch(url, { signal: ctl.signal, headers: h })
    .then(function (r) {
      clearTimeout(tid);
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        return { status: r.status, body: j, raw: t };
      });
    })
    .catch(function (e) { clearTimeout(tid); return { status: 0, body: null, err: e.message || 'timeout' }; });
}

function getText(url, ms, headers) {
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, ms || 10000);
  var h = { 'User-Agent': UA };
  for (var k in (headers || {})) h[k] = headers[k];
  return fetch(url, { signal: ctl.signal, headers: h })
    .then(function (r) { clearTimeout(tid); return r.text().then(function (t) { return { status: r.status, raw: t }; }); })
    .catch(function (e) { clearTimeout(tid); return { status: 0, raw: '', err: e.message || 'timeout' }; });
}

/**
 * Read-through cache. fn() must resolve to { ok:true, ... } or { ok:false, reason }.
 * On upstream failure the last good payload is served, flagged stale with the reason,
 * because a slightly old real number beats an error card for a public page.
 */
async function cached(key, ttlMs, fn) {
  var now = Date.now();
  try {
    var c = await db.get(key);
    if (c && c.updatedMs && (now - c.updatedMs) < ttlMs && c.data && c.data.ok) {
      var hit = Object.assign({}, c.data);
      hit.cached = true; hit.updated = c.updated;
      return hit;
    }
  } catch (e) {}

  var data = await fn();
  if (data && data.ok) {
    try { await db.set(key, { updated: new Date(now).toISOString(), updatedMs: now, data: data }); } catch (e) {}
    data.cached = false;
    data.updated = new Date(now).toISOString();
    return data;
  }
  try {
    var stale = await db.get(key);
    if (stale && stale.data && stale.data.ok) {
      var s = Object.assign({}, stale.data);
      s.cached = true; s.stale = true; s.updated = stale.updated;
      s.staleReason = (data && data.reason) || 'upstream unavailable';
      return s;
    }
  } catch (e) {}
  return data || { ok: false, reason: 'unavailable' };
}

/** Short-TTL cache for user-driven lookups (a search box), keyed by the normalised query. */
async function cachedQuery(key, ttlMs, fn) {
  try {
    var hit = await db.get(key);
    if (hit && hit.updatedMs && (Date.now() - hit.updatedMs) < ttlMs && hit.data) {
      var h = Object.assign({}, hit.data); h.cached = true; return h;
    }
  } catch (e) {}
  var data = await fn();
  if (data && data.ok) {
    try { await db.set(key, { updatedMs: Date.now(), data: data }, Math.round(ttlMs / 1000)); } catch (e) {}
  }
  if (data) data.cached = false;
  return data;
}

/** Strip anything that is not a plain search term, so a query cannot be used to shape a URL. */
function cleanQuery(q, max) {
  return String(q || '').trim().replace(/[^A-Za-z0-9 .,&'\-]/g, '').replace(/\s+/g, ' ').slice(0, max || 60);
}

function slugKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

/** Standard JSON reply used by every tool handler. */
function send(res, payload, status) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.statusCode = status || 200;
  return res.end(JSON.stringify(payload));
}

module.exports = { getJSON: getJSON, getText: getText, cached: cached, cachedQuery: cachedQuery, cleanQuery: cleanQuery, slugKey: slugKey, send: send };
