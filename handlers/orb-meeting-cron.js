/**
 * handlers/orb-meeting-cron.js — convene the full table on a schedule and record what was asked.
 *
 * Without this the ledger only ever fills on the machine a human ran the script from, which
 * means production reads an empty record and every meeting there starts cold forever. This is
 * the thing that makes the loop self-sustaining.
 *
 * AUTH FAILS CLOSED, WITH NO HEADER FALLBACK. This repo has already been bitten once by a cron
 * that accepted `x-vercel-cron` when CRON_SECRET was unset — headers any caller can set, which
 * made the only writing path authenticated by a string the caller chooses. So: CRON_SECRET must
 * be non-empty AND `authorization` must equal `Bearer <CRON_SECRET>` exactly. Unset secret means
 * execution is refused outright, not waved through.
 *
 * WRITES ARE THE POINT, so the guards around them matter:
 *   - It refuses to record a meeting with no snapshot. A commitment recorded against absent
 *     data is worse than no commitment, because it looks settleable later and is not.
 *   - GET without `run=1` reports what it WOULD do and writes nothing, so the schedule can be
 *     checked without adding rows.
 *
 * It calls the public API over HTTP rather than reaching into the handlers, so it sees exactly
 * what a visitor's page sees and cannot drift from it.
 */

var ledger = require('../lib/orb-ledger');
var ORB = require('../assets/js/orb-briefing.js');

function base() {
  if (process.env.ORB_CRON_BASE) return process.env.ORB_CRON_BASE;
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'https://limenhelix.com';
}

async function getJSON(u) {
  try {
    var r = await fetch(u, { headers: { 'User-Agent': 'LIMEN-Helix-orb-cron/1.0' } });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

function authorised(req) {
  var secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, why: 'CRON_SECRET is not set; refusing to execute' };
  var got = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (got !== 'Bearer ' + secret) return { ok: false, why: 'bad or missing bearer token' };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  var auth = authorised(req);
  if (!auth.ok) { res.status(403).json({ ok: false, error: auth.why }); return; }

  var q = req.query || {};
  var run = String(q.run || '') === '1';
  var B = base();

  var cache = { snap: null, opps: null, cons: null, subs: {}, news: {} };
  var head = await Promise.all([
    getJSON(B + '/api/domain-snapshot'),
    getJSON(B + '/api/limen-snapshot?type=opportunities'),
    getJSON(B + '/api/limen-snapshot?type=console'),
    getJSON(B + '/api/grounded-stress-history?all=1')
  ]);
  cache.snap = head[0]; cache.opps = head[1]; cache.cons = head[2];
  cache.hist = head[3];

  if (!cache.snap) {
    res.status(503).json({ ok: false, error: 'no domain-snapshot; refusing to record a meeting with no data' });
    return;
  }

  var ids = ORB.DOMAINS.map(function (d) { return d[0]; });
  await Promise.all(ids.map(async function (id) {
    cache.subs[id] = await getJSON(B + '/assets/data/deep/' + id + '-neuro-substrate.json');
    if (ORB.NEWS[id]) cache.news[id] = await getJSON(B + '/api/' + id + '-news');
  }));

  // Prior entries, so this meeting picks threads up exactly as the page does.
  try { cache.ledger = await ledger.readAll(); } catch (e) { cache.ledger = []; }

  var turns = ORB.meeting(ids, cache);
  var at = new Date().toISOString();
  var rows = [];
  for (var i = 0; i < turns.length; i++) {
    var t = turns[i];
    if (!t.commit) continue;
    var c = t.commit;
    rows.push({
      t: at, room: ids, from: c.from, to: c.to, fromName: c.fromName, toName: c.toName,
      kind: c.kind, watch: c.watch, witness: witnessFor(c.watch, cache.hist),
      said: t.lines[t.lines.length - 1], via: 'cron'
    });
  }

  var settleable = rows.filter(function (r) { return !r.witness.frozen; }).length;
  var recalled = 0;
  for (var j = 0; j < turns.length; j++) {
    for (var k = 0; k < turns[j].lines.length; k++)
      if (/I asked you|I told you|I said the same/.test(turns[j].lines[k])) { recalled++; break; }
  }

  var body = {
    ok: true, ran: run, at: at, backend: ledger.backend(),
    turns: turns.length, commitments: rows.length,
    settleable: settleable, threadsPickedUp: recalled,
    priorEntries: (cache.ledger || []).length
  };

  if (!run) { body.note = 'dry: add run=1 to write'; res.status(200).json(body); return; }

  try {
    var wrote = await ledger.append(rows);
    body.written = wrote.written;
  } catch (e) {
    res.status(500).json({ ok: false, error: 'ledger write failed', detail: String(e && e.message || e) });
    return;
  }
  res.status(200).json(body);
};

/* The channel a commitment will be judged against: whichever of that domain's series has
   actually moved the most. A flat channel is marked frozen rather than quietly stored, because
   a pinned reading can never settle anything and an entry that admits it is unfalsifiable is
   worth more than one that pretends otherwise. */
function witnessFor(id, hist) {
  var key = ORB.snapshotKey(id);
  var chans = (hist && hist.domains && hist.domains[key] && hist.domains[key].channels) || null;
  if (!chans) return { channel: null, value: null, points: 0, frozen: true, why: 'no history for domain' };
  var best = null;
  Object.keys(chans).forEach(function (name) {
    var arr = chans[name];
    if (!Array.isArray(arr) || arr.length < 2) return;
    var span = Math.max.apply(null, arr) - Math.min.apply(null, arr);
    if (!best || span > best.span) best = { name: name, span: span, arr: arr };
  });
  if (!best) return { channel: null, value: null, points: 0, frozen: true, why: 'no usable channel' };
  var frozen = best.span <= 1e-6;
  return {
    channel: best.name, value: best.arr[best.arr.length - 1], points: best.arr.length,
    span: Number(best.span.toFixed(6)), frozen: frozen,
    why: frozen ? 'channel is flat across its whole series' : undefined
  };
}

module.exports = require('../lib/heartbeat').wrap('orb-meeting-cron', module.exports);
