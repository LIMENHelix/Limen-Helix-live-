'use strict';

/**
 * handlers/commission-subscriber-lane.js — POST /api/commission-subscriber-lane
 *
 * The ONE-SHOT subscriber-lane commissioning proof, executed server-side where
 * the encrypted envs actually decrypt. The local script
 * (scripts/commission-subscriber-lane.cjs) cannot run outside production:
 * every credential it needs is a Vercel Sensitive env — write-only, so
 * `vercel env pull` returns them empty by design. This route runs the SAME
 * chain (it literally calls the script's runCommissioning) with the envs the
 * production runtime already holds:
 *
 *   intelligence-autopilot-decision → executor (ONE real email via crm-send →
 *   Resend, durable suppression) → outcome-observer (independent Resend READ
 *   API receipt) → capability verify/persist → 19-lane projection
 *   (6h TTL, kept alive by the /api/subscriber-email-capability cron).
 *
 * AUTHORITY SHAPE (all four required, fail-closed):
 *   1. master key (?key= or x-limen-pass, lib/admin-gate) — operator authority
 *   2. body { "consent": true } — the same ownership attestation as --consent
 *   3. INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED=1 — the pre-set
 *      developmental switch, enforced inside runCommissioning's preflight
 *   4. the one-shot slot itself: a replay is permanently held by durable
 *      suppression of the commissioning address
 *
 * The commissioning ADDRESS is read from INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL
 * server-side and is NEVER accepted from the request and NEVER returned — the
 * response carries addressConfigured/addressDeliverable booleans instead.
 *
 * Body { "dryRun": true } runs the full chain in memory with a stubbed
 * provider: nothing sent, nothing persisted, the one-shot slot untouched.
 * Money: bounded by the capability contract (≤ $0.01, daily email cap 1);
 * liveMoney is always false in the report.
 */

var Gate = require('../lib/admin-gate');
var Script = require('../scripts/commission-subscriber-lane.cjs');
var Store = require('../lib/autofire-efference-store.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 4000) data = data.slice(0, 4000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

/* The address is the one field that must never leave the server. Strip it from
   any report shape (success, refusal, or thrown error) — including inside error
   messages — before responding. */
function redact(report, env) {
  var address = String(env.INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL || '').trim();
  var out = Object.assign({}, report || {});
  delete out.address;
  out.addressConfigured = !!address;
  if (!address) return out;
  // Total redaction: serialize, remove every occurrence of the address string
  // (any case), parse back. Covers nested fields and unstructured error text.
  var scrubbed = JSON.stringify(out)
    .split(address).join('[redacted]')
    .split(address.toLowerCase()).join('[redacted]');
  return JSON.parse(scrubbed);
}

function createHandler(deps) {
  deps = deps || {};
  var run = deps.run || Script.runCommissioning;
  var store = deps.store || Store;
  var env = deps.env || process.env;
  var gate = deps.gate || Gate;

  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'POST') {
      return send(res, 405, { ok: false, error: 'POST only' });
    }
    if (!gate.isMaster(gate.reqKey(req))) return gate.deny(res);

    var body = await readBody(req);
    if (body.consent !== true) {
      return send(res, 400, {
        ok: false, status: 'REFUSED', reason: 'COMMISSIONING_CONTEST_ATTESTATION_REQUIRED',
        detail: 'body must be {"consent":true} — attesting you own the configured commissioning address and consent to the one-shot email',
        providerCalled: false, liveMoney: false
      });
    }

    var address = String(env.INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL || '').trim().toLowerCase();
    if (!address) {
      return send(res, 503, {
        ok: false, status: 'REFUSED', reason: 'COMMISSIONING_ENV_INCOMPLETE',
        detail: 'INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL is not set in this environment',
        missing: ['INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL=<owned consented address>'],
        addressConfigured: false, providerCalled: false, liveMoney: false
      });
    }

    var dryRun = body.dryRun === true;
    try {
      var report = await run({
        address: address,
        live: !dryRun,
        consent: true,
        env: env
      }, { store: dryRun ? new Script.MemoryStore() : store });
      return send(res, 200, redact(report, env));
    } catch (error) {
      // Preflight refusals carry a structured report; none of them reached a provider.
      return send(res, 200, redact(error.report || {
        ok: false, status: 'REFUSED', reason: String(error && error.message || error),
        providerCalled: false, liveMoney: false
      }, env));
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('commission-subscriber-lane', handler);
module.exports.createHandler = createHandler;
