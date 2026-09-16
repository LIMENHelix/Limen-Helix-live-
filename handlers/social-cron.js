/**
 * api/social-cron.js — generate a post from live data and publish it.
 *
 *   GET /api/social-cron?key=...            → PREVIEW. Builds the post, publishes nothing.
 *   GET /api/social-cron?key=...&post=1     → actually publishes.
 *   GET /api/social-cron?key=...&domain=law → force a specific domain (preview or post).
 *
 * DEFAULTS TO PREVIEW FOR HUMANS. A hit with an admin key publishes nothing unless post=1, so
 * a stray click or a browser prefetch cannot put something on a public timeline.
 *
 * A SCHEDULED run publishes without it. Requiring post=1 from the scheduler is fragile, because
 * Vercel can strip the query string off a cron path, and a schedule that quietly previews
 * forever looks exactly like one that never fired.
 *
 * Every other guard lives in lib/social-post.js and applies here unchanged: the operator's
 * posting pause first, then the daily rate cap, then the post; failures release the rate slot;
 * every published post records its AT URI so it can be deleted.
 *
 * Rotation is persisted so the same domain does not repeat back to back across invocations.
 */
var T = require('../lib/tool-fetch');
var db = require('../lib/limen-db');
var gen = require('../lib/social-generator');
var social = require('../lib/social-post');
var motorStore = require('../lib/autofire-efference-store');
var socialExecutor = require('../lib/communication-social-executor');
var socialDecision = require('../lib/communication-social-decision');
var domainDistribution = require('../lib/domain-commercial-distribution-decision');
var CycleObservability = require('../lib/autonomy-cycle-observability');

var LAST_KEY = 'social:lastDomain:v1';

// Any operator-level admin key opens this. They already gate lead PII, which is more
// sensitive than a post preview, and accepting them means the admin console can use the key
// it has already prompted for instead of asking for a second one.
function cronHit(req) {
  var h = req.headers || {};
  // FAILS CLOSED. Per Vercel's documentation x-vercel-cron and x-vercel-signature are
  // informational, not credentials: any caller can set them. CRON_SECRET compared against
  // the Authorization: Bearer header Vercel provisions is the only trusted mechanism, so
  // an unset secret means no cron identity rather than an open door.
  return !!(process.env.CRON_SECRET &&
    h['authorization'] === 'Bearer ' + process.env.CRON_SECRET);
}

var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];
var SAFE_DECISION_BLOCKERS = new Set([
  'candidate-identity-missing', 'candidate-text-over-platform-limit',
  'candidate-verification-link-missing', 'candidate-live-source-identity-invalid-or-stale',
  'communication-brain-state-missing-or-stale', 'subject-brain-state-missing-or-stale',
  'communication-immune-veto', 'communication-human-review-veto',
  'communication-b10-no-action-selected', 'communication-live-feeds-unavailable',
  'subject-live-feeds-unavailable', 'subject-brain-no-salient-condition',
  'decision-persistence-or-input-unavailable'
]);
var SUBJECT_SPECIFIC_CHANNEL_BLOCKERS = new Set([
  'candidate-identity-missing', 'candidate-text-over-platform-limit',
  'candidate-verification-link-missing', 'candidate-live-source-identity-invalid-or-stale',
  'subject-brain-state-missing-or-stale', 'subject-live-feeds-unavailable',
  'subject-brain-no-salient-condition'
]);

function safeDecisionBlocker(value) {
  var blocker = typeof value === 'string' ? value : '';
  if (blocker.indexOf('communication-b10-brake-held:') === 0) return 'communication-b10-brake-held';
  return SAFE_DECISION_BLOCKERS.has(blocker) ? blocker : null;
}

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; })
                           .filter(Boolean);
  if (!configured.length) return false;          // no key configured anywhere = closed, not open
  if (supplied && configured.indexOf(supplied) !== -1) return true;
  return cronHit(req);
}

// A valid veto belongs to the subject brain, but it must not monopolize the
// shared Communication motor. Try the already-ranked candidates in this one
// cycle until one subject releases its exact artifact. No provider is called,
// no veto is weakened, and every held subject remains held.
async function selectSubjectCandidate(candidates, store, now, decide) {
  var held = [];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var release = await decide(store, candidate, now);
    if (release && release.status === 'RELEASED') {
      return { ok: true, post: candidate, release: release, held: held };
    }
    held.push({ domain: candidate.domain,
      reason: release && release.reason || 'subject-domain-distribution-held' });
  }
  return { ok: false, held: held };
}

function subjectSpecificChannelHold(decision) {
  var blockers = decision && Array.isArray(decision.blockers) ? decision.blockers : [];
  return blockers.length > 0 && blockers.every(function (blocker) {
    return SUBJECT_SPECIFIC_CHANNEL_BLOCKERS.has(blocker);
  });
}

// Carry the same bounded fairness through both pre-motor gates. A hold tied to
// one subject may defer that subject and try the next candidate. A
// Communication-wide hold remains terminal because it applies to the channel,
// not merely to the current artifact.
async function selectPublishableCandidate(candidates, store, now, subjectDecide, channelDecide) {
  var subjectHeld = [], channelHeld = [];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var domainRelease = await subjectDecide(store, candidate, now);
    if (!domainRelease || domainRelease.status !== 'RELEASED') {
      subjectHeld.push({ domain: candidate.domain,
        reason: domainRelease && domainRelease.reason || 'subject-domain-distribution-held' });
      continue;
    }
    candidate.domainDecisionReceipt = domainRelease;
    var channelDecision = await channelDecide(store, {
      subjectDomain: candidate.domain,
      text: candidate.text,
      sourceIdentity: candidate.sourceIdentity,
      sourceArtifactId: candidate.sourceArtifactId,
      sourceIntentId: candidate.sourceIntentId,
      sourcePacketId: candidate.sourcePacketId,
      candidateHash: candidate.candidateHash,
      selectedProgram: candidate.selectedProgram,
      domainDecisionReceipt: domainRelease
    }, now);
    if (channelDecision && channelDecision.status === 'RELEASED') {
      return { ok: true, post: candidate, domainRelease: domainRelease,
        channelDecision: channelDecision, subjectHeld: subjectHeld, channelHeld: channelHeld };
    }
    var channelReason = safeDecisionBlocker(channelDecision && channelDecision.blockers &&
      channelDecision.blockers[0]) || channelDecision && channelDecision.reason || 'communication-b10-held';
    channelHeld.push({ domain: candidate.domain, reason: channelReason });
    if (!subjectSpecificChannelHold(channelDecision)) {
      return { ok: false, terminal: true, post: candidate, domainRelease: domainRelease,
        channelDecision: channelDecision, subjectHeld: subjectHeld, channelHeld: channelHeld };
    }
  }
  return { ok: false, terminal: false, post: candidates[0] || null,
    subjectHeld: subjectHeld, channelHeld: channelHeld };
}

function emitOutcome(stage, status, payload, source, logger) {
  payload = payload && typeof payload === 'object' ? payload : {};
  source = source && typeof source === 'object' ? source : {};
  return CycleObservability.emit('communication-social-cycle', {
    ok: status !== 'FAILED',
    evaluatedAt: Date.now(),
    rows: [{
      productDomain: source.domain || payload.domain || 'communication',
      stage: stage,
      status: status,
      reason: safeDecisionBlocker(Array.isArray(payload.decisionBlockers) && payload.decisionBlockers[0]) ||
        payload.reason || payload.error || null,
      selectedProgram: source.selectedProgram || payload.selectedProgram || null
    }]
  }, logger);
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  var post = null;
  var currentStage = 'candidate-selection';
  var outcomeEmitted = false;
  function finish(payload, httpStatus, stage, status, source) {
    emitOutcome(stage, status, payload, source);
    outcomeEmitted = true;
    return T.send(res, payload, httpStatus);
  }
  try {
    if (!authorized(req)) {
      return T.send(res, { ok: false, error: 'Not authorized. Pass ?key= (SOCIAL_CRON_KEY) or call from the Vercel scheduler.' }, 401);
    }

    // Review board: every domain at once. Read-only, and cannot publish by any argument.
    if (q.all === '1') {
      var rateAll = await social.rateStatus('bluesky');
      var lastAll = null;
      try { lastAll = await db.get(LAST_KEY); } catch (e) { lastAll = null; }
      var posts = await gen.previewAll({ store: motorStore, now: Date.now() });
      return T.send(res, {
        ok: true, published: false, mode: 'preview-all',
        generatedAt: new Date().toISOString(),
        lastPosted: lastAll || null,
        ready: posts.filter(function (p) { return p.ok; }).length,
        total: posts.length,
        posts: posts,
        rate: rateAll.ok ? { usedToday: rateAll.used, capPerDay: rateAll.cap, remaining: rateAll.remaining } : null
      });
    }

    var last = null;
    try { last = await db.get(LAST_KEY); } catch (e) { last = null; }

    var selection = await gen.candidates({ after: last && last.domain, domain: q.domain,
      store: motorStore, now: Date.now() });
    if (!selection.ready.length) {
      return finish({ ok: false, published: false,
        reason: 'No domain has a fresh source-linked commercial artifact ready for public distribution.',
        tried: selection.tried, skipped: selection.skipped }, undefined,
      'candidate-selection', 'NO_ACTION', null);
    }

    currentStage = 'decision';
    var releaseSelection = await selectPublishableCandidate(selection.ready, motorStore, Date.now(),
      domainDistribution.decide, socialDecision.decide);
    if (!releaseSelection.ok) {
      post = releaseSelection.post || selection.ready[0];
      var heldRows = releaseSelection.channelHeld.length
        ? releaseSelection.channelHeld : releaseSelection.subjectHeld;
      return finish({ ok: true, published: false,
        domainHeld: releaseSelection.subjectHeld.length > 0,
        brainHeld: releaseSelection.channelHeld.length > 0,
        reason: heldRows[heldRows.length - 1] && heldRows[heldRows.length - 1].reason ||
          'all-ready-domains-held',
        subjectHeld: releaseSelection.subjectHeld, channelHeld: releaseSelection.channelHeld,
        tried: selection.tried, skipped: selection.skipped }, undefined,
      releaseSelection.channelHeld.length ? 'channel-decision' : 'subject-decision', 'HELD', post);
    }
    post = releaseSelection.post;
    post.tried = selection.tried;
    post.skipped = selection.skipped;

    var rate = await social.rateStatus('bluesky');
    var preview = {
      ok: true, domain: post.domain, length: post.length, text: post.text,
      links: social.buildFacets(post.text).length,
      skipped: post.skipped,
      rate: rate.ok ? { usedToday: rate.used, capPerDay: rate.cap, remaining: rate.remaining } : null
    };

    // A SCHEDULED run publishes. Requiring ?post=1 here would be fragile: Vercel can strip the
    // query string from a cron path (autopilot carries the same warning), and a schedule that
    // silently previews forever is indistinguishable from one that never fired. A human or a
    // browser still has to ask for it explicitly.
    var wantPost = q.post === '1' || cronHit(req);
    if (!wantPost) {
      preview.published = false;
      preview.note = 'Preview only. Add &post=1 to publish. Publishing is never the default.';
      return finish(preview, undefined, 'preview', 'PREVIEWED', post);
    }

    // The subject domain first releases this exact artifact for this exact
    // public route. Communication then independently owns channel safety and
    // the public social effector. Neither domain can impersonate the other.
    var domainRelease = releaseSelection.domainRelease;
    var decision = releaseSelection.channelDecision;
    preview.subjectHeld = releaseSelection.subjectHeld;
    preview.channelHeld = releaseSelection.channelHeld;
    post.domainDecisionReceipt = domainRelease;
    currentStage = 'execution';
    var r = await socialExecutor.execute({
      store: motorStore,
      spec: { subjectDomain: post.domain, text: post.text, decisionReceipt: decision,
        sourceArtifactId: post.sourceArtifactId, sourceIntentId: post.sourceIntentId,
        sourcePacketId: post.sourcePacketId, candidateHash: post.candidateHash,
        selectedProgram: post.selectedProgram, domainDecisionReceipt: domainRelease },
      now: Date.now()
    });
    if (!r || r.status === 'HELD') {
      preview.published = false;
      preview.motorHeld = true;
      preview.reason = r && r.reason || 'communication-social-motor-held';
      preview.motorReceiptId = r && r.motorReceiptId || null;
      preview.motorBlockers = r && r.motorBlockers || [];
      return finish(preview, undefined, 'provider-gate', 'HELD', post);
    }
    if (!r.ok) {
      preview.published = false;
      preview.reason = r.reason;
      preview.rateLimited = !!r.rateLimited;
      preview.blocked = !!r.blocked;
      return finish(preview, undefined, 'execution', r.status || 'FAILED', post);
    }

    try { await db.set(LAST_KEY, { domain: post.domain, at: new Date().toISOString(), uri: r.uri }); } catch (e) {}

    preview.published = true;
    preview.commandId = r.commandId;
    preview.url = r.url;
    preview.uri = r.uri;   // keep this: it is what deleteBlueskyPost needs to undo the post
    preview.rate = { usedToday: r.used, capPerDay: r.cap, remaining: Math.max(0, r.cap - r.used) };
    return finish(preview, undefined, 'execution', 'PUBLISHED', post);
  } catch (e) {
    if (outcomeEmitted) throw e;
    return finish({ ok: false, reason: e.message || 'handler error' }, 500,
      currentStage, 'FAILED', post);
  }
};

// Outward-acting: this sends something into the world on a timer. Records every
// run AND consults the veto first, which is a separate structure that can cancel
// it without this handler being changed or redeployed.
var guarded = require('../lib/heartbeat').guard('social-cron', module.exports, {
  onVeto: function (gate) {
    emitOutcome('valve', 'HELD', {
      reason: gate && gate.reason || 'social-cron-valve-veto'
    }, null);
  }
});
guarded.emitOutcome = emitOutcome;
guarded.safeDecisionBlocker = safeDecisionBlocker;
guarded.selectSubjectCandidate = selectSubjectCandidate;
guarded.subjectSpecificChannelHold = subjectSpecificChannelHold;
guarded.selectPublishableCandidate = selectPublishableCandidate;
module.exports = guarded;
