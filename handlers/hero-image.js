/**
 * api/hero-image.js — generate domain hero images with xAI, triggered by cron, not by a key.
 *
 *   (Vercel scheduler)                    → generates ONE missing image per run, then stops
 *   GET /api/hero-image?list=1            → PUBLIC. what has been generated so far
 *   GET /api/hero-image?key=...&domain=x  → manual override, still available
 *   GET /api/hero-image?key=...&domain=x&raw=1 → the JPEG bytes
 *
 * WHY THE SPLIT. Generating costs money; retrieving does not, and these images are destined to
 * be public static files in assets/img/ anyway. So GENERATION is gated to Vercel's own
 * scheduler (or an admin key) and RETRIEVAL is public. That means no key has to be handled by a
 * person to get the results out.
 *
 * SELF-TERMINATING BY DESIGN. Each cron run generates at most one image, and only for a domain
 * with no stored result. Once every domain has one, the cron finds nothing to do and spends
 * nothing. It cannot loop.
 *
 * THREE INDEPENDENT BRAKES, because this is the only paid job on the schedule.
 *   1. lib/ai-kill-switch  — the same gate every other paid caller respects.
 *      Added 2026-07-27. Until then this handler consulted NO kill switch, so it
 *      kept generating through the 2026-06-26 billing stop; "AI is off" was not
 *      strictly true while this cron ran. A counter is a cap, not a switch: it
 *      cannot be turned off, only used up.
 *   2. lib/spend-meter     — reserve before, settle after, against a run and a
 *      daily dollar ceiling. Fails CLOSED when the ledger is unreachable.
 *   3. HERO_IMAGE_CAP      — a counter in Redis capping total generations ever
 *      (default 40, against 20 domains). If it cannot be read, generation
 *      REFUSES.
 * A runaway image loop is the one failure mode here that costs real money, so
 * every one of the three fails closed rather than open.
 *
 * Only the xAI URL is stored, not the bytes. Upstash bills bandwidth and these are ~300KB
 * each; a URL is a few hundred bytes. The images are fetched from those URLs once and committed
 * as static files, after which this endpoint is scaffolding.
 *
 * WHAT THIS IS NOT. Decorative backdrops. Nothing here produces a figure or anything a reader
 * could mistake for evidence, which matters on a site whose claim is that its numbers are
 * checkable. Prompts are abstract and none depicts a real place, event or person.
 */
var T = require('../lib/tool-fetch');
var db = require('../lib/limen-db');
var ks = require('../lib/ai-kill-switch');
var meter = require('../lib/spend-meter');
var motorStore = require('../lib/autofire-efference-store');
var heroPolicy = require('../lib/culture-hero-policy');
var heroDecision = require('../lib/culture-hero-decision');
var heroExecutor = require('../lib/culture-hero-executor');
var heroRecovery = require('../lib/culture-hero-recovery');

var ENDPOINT = 'https://api.x.ai/v1/images/generations';
var MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';
var STORE_KEY = 'hero:img:v1';
var COUNT_KEY = 'hero:img:count:v1';
var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

/**
 * Dollars per generated image.
 *
 * lib/spend-meter refuses to guess vendor per-unit prices, and this is a guess,
 * so it is deliberately a HIGH one. The only figure I could source is $0.02 for
 * `grok-imagine-image`, and this deployment defaults to the dearer
 * `-quality` variant, whose price I have not verified. Over-estimating makes a
 * budget refuse early; under-estimating spends real money while reporting less.
 * Only one of those is recoverable.
 *
 * Set XAI_IMAGE_USD once you have the real number off an xAI invoice.
 */
function imageUsd() {
  var n = parseFloat(process.env.XAI_IMAGE_USD);
  return isFinite(n) && n >= 0 ? n : 0.10;
}

function cap() {
  var n = parseInt(process.env.HERO_IMAGE_CAP, 10);
  return isFinite(n) && n >= 0 ? n : 40;
}

// Deliberately abstract. A hero sits behind white headline text, so these ask for dark,
// low-contrast, wide compositions with the subject CENTRED: the hero box is landscape on
// desktop and PORTRAIT on a phone, where cover crops hard to the middle and discards the sides.
var SUBJECT = heroPolicy.SUBJECT;
var STYLE = heroPolicy.STYLE;

function cronHit(req) {
  var h = req.headers || {};
  // FAILS CLOSED. Per Vercel's documentation x-vercel-cron and x-vercel-signature are
  // informational, not credentials: any caller can set them. CRON_SECRET compared against
  // the Authorization: Bearer header Vercel provisions is the only trusted mechanism, so
  // an unset secret means no cron identity rather than an open door.
  return !!(process.env.CRON_SECRET &&
    h['authorization'] === 'Bearer ' + process.env.CRON_SECRET);
}

function keyed(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; }).filter(Boolean);
  return !!(configured.length && supplied && configured.indexOf(supplied) !== -1);
}

async function loadStore() {
  var s = await db.get(STORE_KEY);
  return (s && typeof s === 'object') ? s : {};
}

async function generate(domain, promptOverride) {
  var key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!key) return { ok: false, definitiveFailure: true, ambiguous: false, providerCalled: false, spentUsd: 0,
    error: 'XAI_API_KEY is not set on this deployment.' };

  // ── the kill switch ──────────────────────────────────────────────────────
  // This handler spent money for months without consulting it. It was the only
  // paid AI caller in the repo that did not, which meant "AI is disabled" was
  // never strictly true while this cron ran every five minutes. The hard
  // counter below is a cap, not a switch: it cannot be turned off, only used up.
  if (await ks.spendDisabled()) {
    return { ok: false, disabled: true, definitiveFailure: true, ambiguous: false, providerCalled: false, spentUsd: 0,
      error: 'AI spend is disabled (LIMEN_AI_ENABLED, or the operator pause). No image generated.' };
  }

  // ── the budget ───────────────────────────────────────────────────────────
  // Reserve BEFORE the call so an over-budget generation is refused rather than
  // discovered afterwards, and settle after so the ledger reflects reality.
  var rsv = await meter.reserve({
    kind: 'image', costUsd: imageUsd(),
    label: 'hero-image:' + (domain || 'manual') + ':' + MODEL
  });
  if (!rsv.ok) {
    return { ok: false, budgetBlocked: true, definitiveFailure: true, ambiguous: false, providerCalled: false, spentUsd: 0,
      error: rsv.reason || 'spend refused by the budget meter' };
  }

  var prompt = promptOverride ? String(promptOverride).slice(0, 900) : (SUBJECT[domain] + '. ' + STYLE);
  var body = { model: MODEL, prompt: prompt, n: 1, aspect_ratio: '16:9' };

  async function call(b) {
    try {
      var r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(b)
      });
      var j = await r.json().catch(function () { return null; });
      return { ok: r.ok, status: r.status, j: j };
    } catch (error) {
      return { ok: false, status: null, j: null, ambiguous: true, error: String(error && error.message || error) };
    }
  }

  var res = await call(body);
  // One command is one firing. An uncertain response is never retried because
  // the first call may have been accepted even when its response was lost.
  // Settle every path, or the reservation sits against the budget until it ages
  // out and blocks generations that should have been allowed.
  // A rejected request produced no image, so it settles at zero. A successful
  // one settles at the reserved estimate, since images are fixed-price.
  if (!res.ok || !res.j) {
    var failedCharge = await meter.settle(rsv.id, res.ambiguous === true ? {} : { costUsd: 0 });
    return { ok: false, ambiguous: res.ambiguous === true, definitiveFailure: res.status != null, providerCalled: true,
      error: res.error || ('xAI returned ' + res.status), detail: res.j && (res.j.error && res.j.error.message || JSON.stringify(res.j).slice(0, 240)),
      spentUsd: failedCharge && failedCharge.chargedUsd != null ? failedCharge.chargedUsd : (res.ambiguous === true ? imageUsd() : 0) };
  }

  var item = (res.j.data && res.j.data[0]) || res.j;
  var url = item.url || item.image_url || null;
  var b64 = item.b64_json || item.base64 || null;
  if (!url && !b64) {
    // A 2xx that carried no image. The call was accepted, so assume it billed.
    await meter.settle(rsv.id, {});
    return { ok: false, ambiguous: true, definitiveFailure: false, providerCalled: true,
      error: 'xAI response carried no image', spentUsd: imageUsd() };
  }

  var charged = await meter.settle(rsv.id, {});
  return { ok: true, providerCalled: true, url: url, requestId: res.j && (res.j.id || res.j.request_id) || null,
           hasBase64: !!b64, b64: b64, prompt: prompt,
           revised: item.revised_prompt || null,
           spentUsd: (charged && charged.chargedUsd != null) ? charged.chargedUsd : null };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    // ── PUBLIC: what has been generated. No key, no cost, nothing sensitive. ──
    if (q.list === '1') {
      var store = await loadStore();
      var suppression = null;
      var suppressionStateKnown = false;
      try { suppression = await motorStore.get(heroRecovery.CATALOG_KEY); suppressionStateKnown = true; } catch (_) {}
      if (suppression && typeof suppression === 'object') Object.keys(suppression).forEach(function (d) {
        if (suppression[d] && suppression[d].suppressed) delete store[d];
      });
      var done = Object.keys(store);
      var count = 0;
      try { count = parseInt(await db.get(COUNT_KEY), 10) || 0; } catch (e) {}
      return T.send(res, {
        ok: true,
        generated: done.length,
        ofDomains: Object.keys(SUBJECT).length,
        spentImages: count,
        capImages: cap(),
        pending: Object.keys(SUBJECT).filter(function (d) { return !store[d]; }),
        images: store,
        suppressionStateKnown: suppressionStateKnown,
        note: 'URLs come from xAI and may expire. Fetch and commit them to assets/img/<domain>.jpg.'
      });
    }

    var isCron = cronHit(req);
    var isKeyed = keyed(req);
    if (!isCron && !isKeyed) {
      return T.send(res, { ok: false, error: 'Generation is restricted. Add ?list=1 to read results without a key.' }, 401);
    }

    // ── SPEND CAP. Fails CLOSED: an unreadable counter refuses to generate. ──
    var used;
    try { used = parseInt(await motorStore.get(COUNT_KEY), 10) || 0; }
    catch (e) { return T.send(res, { ok: false, error: 'Spend counter unreachable; refusing to generate.' }, 503); }
    if (used >= cap()) {
      return T.send(res, { ok: false, error: 'Image cap reached: ' + used + ' of ' + cap() + '. Raise HERO_IMAGE_CAP to continue.', spentImages: used }, 429);
    }

    var store2;
    try { store2 = await motorStore.get(STORE_KEY); }
    catch (e) { return T.send(res, { ok: false, error: 'Durable asset catalog unreachable; refusing to generate.' }, 503); }
    if (!store2 || typeof store2 !== 'object') store2 = {};

    // A cron run picks the FIRST domain with no stored image and stops when there are none.
    var domain = String(q.domain || '').toLowerCase().trim();
    if (isCron && !domain) {
      domain = Object.keys(SUBJECT).filter(function (d) { return !store2[d]; })[0] || '';
      if (!domain) {
        return T.send(res, { ok: true, done: true, generated: Object.keys(store2).length, note: 'Every domain already has an image. Nothing generated, nothing spent.' });
      }
    }
    if (q.prompt) {
      return T.send(res, { ok: false, error: 'Custom prompts are not autonomous Culture decisions; only the canonical Culture-local policy can enter this effector.' }, 400);
    }
    if (!SUBJECT[domain]) {
      return T.send(res, { ok: false, error: 'Unknown domain.', domains: Object.keys(SUBJECT) }, 400);
    }
    // Never silently regenerate and re-charge for something already done.
    if (store2[domain]) {
      return T.send(res, { ok: true, skipped: domain, note: 'Already generated; not regenerating.' });
    }

    var candidate = heroPolicy.candidate(domain, MODEL, 'missing-public-hero');
    var decision = await heroDecision.decide(motorStore, candidate, Date.now());
    if (!decision || decision.status !== 'RELEASED') return T.send(res, {
      ok: true, acted: false, generated: false, brainHeld: true,
      reason: decision && decision.reason || 'culture-b10-held', blockers: decision && decision.blockers || [],
      decisionReceiptId: decision && decision.decisionReceiptId || null, providerCalled: false, spentUsd: 0
    });
    var g = await heroExecutor.execute({
      store: motorStore, candidate: candidate, decision: decision, now: Date.now(),
      provider: { generate: function (exact) { return generate(exact.assetDomain, exact.prompt); } }
    });
    if (!g.ok) return T.send(res, { ok: false, domain: domain, status: g.status, error: g.reason || 'generation unresolved',
      detail: g.detail, commandId: g.commandId || null, decisionReceiptId: decision.decisionReceiptId,
      providerCalled: g.providerCalled === true, spentUsd: g.spentUsd == null ? null : g.spentUsd }, g.status === 'HELD' ? 200 : 502);

    await motorStore.set(COUNT_KEY, used + 1);
    if (parseInt(await motorStore.get(COUNT_KEY), 10) !== used + 1) throw new Error('strict image counter readback invalid');
    store2[domain] = { url: g.receipt.url, prompt: candidate.prompt, revised: null, at: new Date().toISOString(), model: MODEL,
      commandId: g.commandId, decisionReceiptId: decision.decisionReceiptId, motorReceiptId: g.productMotorReceiptId };
    await motorStore.set(STORE_KEY, store2);
    var restoredStore = await motorStore.get(STORE_KEY);
    if (!restoredStore || !restoredStore[domain] || restoredStore[domain].commandId !== g.commandId) throw new Error('strict image catalog readback invalid');

    if (q.raw === '1' && g.receipt && g.receipt.url) {
      var buf;
      {
        var img = await fetch(g.receipt.url);
        if (!img.ok) return T.send(res, { ok: false, error: 'could not fetch the generated image (' + img.status + ')' }, 502);
        buf = Buffer.from(await img.arrayBuffer());
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(buf);
    }

    return T.send(res, {
      ok: true, domain: domain, model: MODEL, url: g.receipt.url, prompt: candidate.prompt,
      commandId: g.commandId, decisionReceiptId: decision.decisionReceiptId, motorReceiptId: g.productMotorReceiptId,
      spentImages: used + 1, capImages: cap(),
      remaining: Object.keys(SUBJECT).filter(function (d) { return !store2[d]; }),
      note: 'Decorative only: nothing here is data. Read all results with ?list=1, no key needed.'
    });
  } catch (e) {
    return T.send(res, { ok: false, error: e.message || 'handler error' }, 500);
  }
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('hero-image', module.exports);
