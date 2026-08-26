'use strict';
var crypto = require('node:crypto'), Redis = require('./redis-kv.js');
var SCHEMA = 'intelligence-autopilot-decision/1.0', LOG_KEY = 'intelligence_autopilot_decision_log', PREFIX = 'intelligence_autopilot_decision:';
var MAX_AGE = 45 * 60 * 1000, MAX_DECISION_AGE = 10 * 60 * 1000;
function hash(v) { return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; } function key(id) { return PREFIX + id; }
function candidate(state, action, mail) { var email = text(state && state.email), leadId = text(state && state.leadId), domain = text(state && state.domain);
  var subject = text(mail && mail.subject), body = text(mail && mail.body), kind = text(action && action.kind), channel = text(action && action.channel);
  if (!email || !leadId || !domain || !subject || !body || !kind || !channel || !/email/.test(channel)) return null;
  return { schemaVersion: 'intelligence-autopilot-candidate/1.0', productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot',
    leadId: leadId, leadHash: hash(leadId), email: email.toLowerCase(), emailHash: hash(email.toLowerCase()), subjectDomain: domain,
    actionKind: kind, channel: channel, transition: text(action.transition), subject: subject, subjectHash: hash(subject), body: body, contentHash: hash(body), liveMoney: false };
}
function validCandidate(v) { return !!(v && v.schemaVersion === 'intelligence-autopilot-candidate/1.0' && v.productDomain === 'intelligence' && v.ownerDomain === 'intelligence' &&
  v.lane === 'autopilot' && text(v.leadId) && v.leadHash === hash(v.leadId) && text(v.email) && v.emailHash === hash(v.email) && text(v.subjectDomain) &&
  text(v.actionKind) && /email/.test(v.channel) && text(v.subject) && v.subjectHash === hash(v.subject) && text(v.body) && v.contentHash === hash(v.body)); }
async function entry(domain, deps) { if (deps && deps.cognition && deps.cognition[domain]) return deps.cognition[domain]; return (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:' + domain); }
function validEntry(v, domain, now) { var c = v && v.c, ts = Number(v && v.ts), p = c && c.serverPacket, g = Date.parse(p && p.generatedAt);
  return !!(c && c.domain === domain && Number.isFinite(ts) && now >= ts && now - ts <= MAX_AGE && p && p.schemaVersion === 'civilization-domain-packet/1.0' &&
    p.domainId === domain && p.sourceIdentity && p.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(g) && now >= g && now - g <= MAX_AGE); }
async function persist(store, r) { var created = await store.setIfAbsent(key(r.decisionReceiptId), r), restored = await store.get(key(r.decisionReceiptId));
  if (!restored || restored.actionId !== r.actionId || restored.status !== r.status) throw new Error('intelligence autopilot decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); } return restored; }
async function decide(store, v, now, deps) { var at = Number(now) || Date.now();
  if (!validCandidate(v)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'intelligence-autopilot-candidate-invalid', blockers: ['exact-lead-email-action-required'], providerCalled: false, liveMoney: false };
  try { store.assertDurable(); var intelligence = await entry('intelligence', deps), subject = await entry(v.subjectDomain, deps), blockers = [];
    if (!validEntry(intelligence, 'intelligence', at)) blockers.push('intelligence-brain-state-missing-or-stale');
    if (!validEntry(subject, v.subjectDomain, at)) blockers.push('subject-brain-state-missing-or-stale');
    var c = intelligence && intelligence.c || {}, p = c.serverPacket || {}, organs = c.brainOrgans || {}, truth = p.truth || {}, sp = subject && subject.c && subject.c.serverPacket || {};
    if (!blockers.length) { if ((c.immune || {}).immuneState !== 'clear') blockers.push('intelligence-immune-veto');
      if ((c.awareness || {}).humanReviewRequired === true) blockers.push('intelligence-human-review-veto');
      var emission = organs.autonomousInternalEmission || {}; if (emission.holdReason) blockers.push('intelligence-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('intelligence-b10-no-action-selected');
      if (!truth.feedHealth || !(Number(truth.feedHealth.live) > 0)) blockers.push('intelligence-live-feeds-unavailable');
      if (!sp.truth || !sp.truth.feedHealth || !(Number(sp.truth.feedHealth.live) > 0)) blockers.push('subject-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('intelligence-resource-metabolism-inhibited'); }
    var actionId = 'iaa_' + hash({ leadHash: v.leadHash, emailHash: v.emailHash, contentHash: v.contentHash, kind: v.actionKind, transition: v.transition }).slice(0, 24), status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, { schemaVersion: SCHEMA, decisionReceiptId: 'iad_' + hash({ actionId: actionId, intelligence: p.packetId || null, subject: sp.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'intelligence-b10-held' : null, blockers: blockers,
      productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot', decisionContract: 'crm-email-decision/1', leadHash: v.leadHash, emailHash: v.emailHash,
      subjectDomain: v.subjectDomain, actionKind: v.actionKind, transition: v.transition, subjectHash: v.subjectHash, contentHash: v.contentHash,
      intelligencePacketId: p.packetId || null, subjectPacketId: sp.packetId || null, predictedOutcome: blockers.length ? null : { providerAcceptance: true, mailServerEvent: 'delivered-or-terminal-failure', businessResponse: 'independently-unobserved-until-CRM-event' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE, providerCalled: false, liveMoney: false });
  } catch (error) { return { ok: true, status: 'NO_ACTION', released: false, reason: 'intelligence-b10-unavailable', blockers: ['decision-persistence-or-input-unavailable'], detail: String(error && error.message || error), providerCalled: false, liveMoney: false }; } }
function validateReceipt(r, v, now) { var at = Number(now) || Date.now(); return !!(validCandidate(v) && r && r.schemaVersion === SCHEMA && r.status === 'RELEASED' && r.released === true &&
  r.actionId === 'iaa_' + hash({ leadHash: v.leadHash, emailHash: v.emailHash, contentHash: v.contentHash, kind: v.actionKind, transition: v.transition }).slice(0, 24) &&
  r.emailHash === v.emailHash && r.subjectHash === v.subjectHash && r.contentHash === v.contentHash && Number(r.decidedAt) <= at && at < Number(r.expiresAt)); }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, candidate: candidate, validateCandidate: validCandidate, validEntry: validEntry, decide: decide, validateReceipt: validateReceipt };
