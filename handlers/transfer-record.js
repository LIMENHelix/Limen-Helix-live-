/**
 * handlers/transfer-record.js — operable surface for the cross-domain transfer ledger (P5).
 *
 *   POST /api/transfer-record  { packet:{sourceDomain,targetDomain,canonicalId,relationType,
 *                                sourceConfidence,calibrationState,madeAt,...}, target:{...}, history:{...},
 *                                influence:{changed,fields} }
 *        → build the CrossDomainEvidencePacket, compute the RECEIVING domain's disposition, and record
 *          the receipt on the tamper-evident transfer ledger. Returns { ref, disposition, weight }.
 *   POST /api/transfer-record  { outcome:{ target, ref, verdict, delta } }
 *        → record whether an accepted transfer later improved/worsened/did-not-affect calibration.
 *   GET  /api/transfer-record?target=finance&uplift=1  → OBSERVATIONAL uplift readout (not a baseline).
 *   GET  /api/transfer-record?target=finance&n=50      → read the transfer ledger (newest-first).
 *   GET  /api/transfer-record?target=finance&verify=1  → verify the ledger's hash chain.
 *
 * Records provenance only — it builds/gates/logs a transfer; it changes no prior, arms nothing, spends
 * nothing, sends nothing. Writes are token-gated (reuse BRAIN_WEIGHTS_TOKEN, the durable-learning opt-in),
 * fail-closed, so the ledger can't be polluted anonymously. GET is open (low-sensitivity calibration state).
 */

var db = require('../lib/limen-db');
var EP = require('../lib/evidence-packet');
var TL = require('../lib/transfer-ledger');
var audit = require('../lib/audit-ledger');

var MAX_BYTES = 8 * 1024;
var DOMAIN_RE = /^[a-z][a-zA-Z]{1,23}$/;
var TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || '';

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var d = '';
    req.on('data', function (c) { d += c; if (d.length > MAX_BYTES * 2) { try { req.destroy(); } catch (e) {} resolve({}); } });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-brain-token');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();
  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  if (m === 'GET') {
    var target = String(q.target || '');
    if (!DOMAIN_RE.test(target)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad or missing target' })); }
    try {
      if (q.uplift) return res.end(JSON.stringify({ ok: true, target: target, uplift: await TL.uplift(db, target), backend: db.getBackend() }));
      if (q.verify) return res.end(JSON.stringify({ ok: true, target: target, verify: await audit.verify(db, TL.stream(target)), backend: db.getBackend() }));
      var n = Math.max(1, Math.min(500, parseInt(q.n, 10) || 100));
      return res.end(JSON.stringify({ ok: true, target: target, entries: await audit.read(db, TL.stream(target), n), backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  if (m === 'POST') {
    var body = await readBody(req);
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var tok = req.headers['x-brain-token'] || (body && body.token);
    if (!TOKEN || tok !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'unauthorized' })); }
    var now = Date.now();
    try {
      // outcome update path
      if (body && body.outcome) {
        var oc = body.outcome;
        if (!DOMAIN_RE.test(String(oc.target || '')) || !oc.ref) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'outcome{target,ref} required' })); }
        var o = await TL.recordOutcome(db, oc.target, String(oc.ref), oc.verdict, oc.delta, now);
        return res.end(JSON.stringify({ ok: true, recorded: 'outcome', outcome: o, appliedAnything: false }));
      }
      // receipt path
      var built = EP.build(Object.assign({}, body.packet, { madeAt: (body.packet && typeof body.packet.madeAt === 'number') ? body.packet.madeAt : now }));
      if (!built.ok) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'invalid packet', details: built.errors })); }
      var disp = EP.disposition(built.packet, body.target || {}, body.history || {});
      built.packet.disposition = disp;
      var rec = await TL.recordReceipt(db, built.packet, disp, body.influence || { changed: false }, now);
      return res.end(JSON.stringify({ ok: true, recorded: 'receipt', ref: rec.ref, disposition: disp.disposition, weight: disp.weight, reasons: disp.reasons, appliedAnything: false, backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};
