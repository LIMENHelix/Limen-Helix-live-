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

/** POST JSON and parse JSON back. USAspending and NIH RePORTER are POST-only search APIs. */
function postJSON(url, body, ms, headers) {
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, ms || 12000);
  var h = { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json' };
  for (var k in (headers || {})) h[k] = headers[k];
  return fetch(url, { method: 'POST', signal: ctl.signal, headers: h, body: JSON.stringify(body) })
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

/**
 * Latest observation of a FRED series, plus the nearest point ~N days earlier.
 * Returns null when the key is missing or the series has no usable data; callers must
 * treat null as "unavailable" and say so, never substitute a value.
 */
async function fredSeries(id, backDays, keepObs) {
  var key = process.env.FRED_API_KEY;
  if (!key) return null;
  var url = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + encodeURIComponent(id)
    + '&api_key=' + key + '&file_type=json&sort_order=desc&limit=800';
  var r = await getJSON(url, 12000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.observations)) return null;
  var obs = r.body.observations.filter(function (o) { return o.value && o.value !== '.'; });
  if (!obs.length) return null;
  var cur = { date: obs[0].date, value: parseFloat(obs[0].value) };
  if (!isFinite(cur.value)) return null;
  var out = { id: id, date: cur.date, value: cur.value, prior: null, priorDate: null, changePct: null, first: null, firstDate: null };
  var last = obs[obs.length - 1];
  if (last && isFinite(parseFloat(last.value))) { out.first = parseFloat(last.value); out.firstDate = last.date; }
  // Callers that need to ALIGN two series in time (a price against the income of the same
  // year) must have the observations, not just first/last. Comparing series' own "first"
  // points is invalid whenever they start in different years, which is the common case.
  if (keepObs) {
    out.obs = obs.map(function (o) { return { date: o.date, value: parseFloat(o.value) }; })
      .filter(function (o) { return isFinite(o.value); });
  }
  if (backDays) {
    var target = Date.parse(cur.date) - backDays * 86400000;
    for (var i = 1; i < obs.length; i++) {
      if (Date.parse(obs[i].date) <= target) {
        var p = parseFloat(obs[i].value);
        if (isFinite(p) && p !== 0) { out.prior = p; out.priorDate = obs[i].date; out.changePct = +(((cur.value - p) / p) * 100).toFixed(1); }
        break;
      }
    }
  }
  return out;
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

module.exports = { getJSON: getJSON, postJSON: postJSON, getText: getText, fredSeries: fredSeries, cached: cached, cachedQuery: cachedQuery, cleanQuery: cleanQuery, slugKey: slugKey, send: send };
