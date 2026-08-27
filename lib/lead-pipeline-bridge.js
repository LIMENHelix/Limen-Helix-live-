'use strict';

/**
 * Idempotent bridge from public identity capture and Stripe enrollment into
 * the existing Leads → Appointments → Shows → Enrollments → Referrals system.
 *
 * A self-serve subscription is allowed to bypass appointment/show as
 * explicitly not required; it never fabricates those events.  The enrolled
 * CRM identity can still enter the referral loop.
 */
var crypto = require('node:crypto');
var DB = require('./limen-db.js');
var Sales = require('./sales-engine.js');

var K = {
  dedup: 'leadgen:dedup', index: 'leadgen:index', lead: 'leadgen:lead:',
  sourceStats: 'leadgen:sourcestats', domainStats: 'leadgen:domainstats', companyStats: 'leadgen:companystats',
  crmWorklist: 'crm:worklist', crmState: 'crm:state:', salesAgg: 'sales:agg', salesMeta: 'sales:meta',
  event: 'commerce:lead-event:', enrollment: 'commerce:enrollment:'
};
function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function email(v) { var e = clip(v, 200).toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null; }
function hash(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function unique(list, value) { list = Array.isArray(list) ? list : []; if (value && list.indexOf(value) < 0) list.push(value); return list; }
function eventKey(prefix, id) { return prefix + hash(id).slice(0, 32); }
function companyFor(domain) { return domain ? domain + '-subscriptions' : 'limen-domain-watch'; }

async function capture(input, deps) {
  input = input || {}; deps = deps || {}; var db = deps.db || DB;
  var normalized = email(input.email); if (!normalized) return { ok: false, reason: 'valid-email-required' };
  var eventId = clip(input.eventId || ('capture:' + normalized + ':' + (input.domain || '') + ':' + (input.rung || '')), 300);
  var priorEvent = await db.get(eventKey(K.event, eventId));
  if (priorEvent && priorEvent.leadId) return { ok: true, duplicate: true, leadId: priorEvent.leadId, newLead: false };

  var now = new Date().toISOString(), domain = clip(input.domain, 40).toLowerCase(), rung = clip(input.rung, 40).toLowerCase();
  var dedup = await db.get(K.dedup); if (!dedup || typeof dedup !== 'object') dedup = {};
  var dedupIdentity = 'e:' + normalized;
  var leadId = dedup[dedupIdentity] || ('LGW-' + hash(normalized).slice(0, 20));
  var lead = await db.get(K.lead + leadId), isNew = !lead;
  if (!lead) lead = { id: leadId, ts: now, email: normalized, phone: '', org: '', city: '', state: '', website: '',
    source: 'inbound-form', costCents: 0, score: input.name ? 45 : 30, status: 'new', dedup: dedupIdentity };
  if (clip(input.name, 200)) lead.name = clip(input.name, 200);
  lead.domain = domain || lead.domain || '';
  lead.company = companyFor(domain || lead.domain);
  lead.domains = unique(lead.domains, domain);
  lead.offers = unique(lead.offers, rung ? domain + ':' + rung : null);
  lead.lastCaptureAt = now; lead.lastCaptureSource = clip(input.source || 'public-domain', 60);
  lead.consent = input.consent === true || lead.consent === true;
  lead.notes = clip(input.note || lead.notes || '', 500);
  await db.set(K.lead + leadId, lead);
  var restored = await db.get(K.lead + leadId);
  if (!restored || restored.id !== leadId || restored.email !== normalized) throw new Error('lead pipeline bridge readback invalid');

  if (isNew) {
    dedup[dedupIdentity] = leadId; await db.set(K.dedup, dedup);
    var index = await db.get(K.index); if (!Array.isArray(index)) index = [];
    if (index.indexOf(leadId) < 0) index.unshift(leadId); await db.set(K.index, index.slice(0, 5000));
    var stats = await db.get(K.sourceStats); if (!stats || typeof stats !== 'object') stats = {};
    var source = stats['inbound-form'] || (stats['inbound-form'] = { count: 0, costCents: 0, scoreSum: 0 });
    source.count++; source.scoreSum += lead.score; await db.set(K.sourceStats, stats);
    var domains = await db.get(K.domainStats); if (!domains || typeof domains !== 'object') domains = {};
    var ds = domains[domain || 'unassigned'] || (domains[domain || 'unassigned'] = { count: 0, costCents: 0 }); ds.count++; await db.set(K.domainStats, domains);
    var companies = await db.get(K.companyStats); if (!companies || typeof companies !== 'object') companies = {};
    var cs = companies[lead.company] || (companies[lead.company] = { count: 0, costCents: 0 }); cs.count++; await db.set(K.companyStats, companies);
    if (input.recordAcquisition !== false) {
      var agg = await db.get(K.salesAgg); if (!agg || typeof agg !== 'object') agg = Sales.emptyAgg();
      Sales.applyEvent(agg, { transitionId: 'source>leads', from: 'source', to: 'leads', unit: 'lead-gen-marketing', won: true, costCents: 0, dealSize: 'small', trigger: 'trust' });
      await db.set(K.salesAgg, agg);
      var meta = await db.get(K.salesMeta); if (!meta || typeof meta !== 'object') meta = {};
      meta.realEvents = (meta.realEvents || 0) + 1; meta.dataMode = meta.simEvents > 0 ? 'mixed' : 'real'; await db.set(K.salesMeta, meta);
    }
  }

  var state = await db.get(K.crmState + leadId);
  if (!state) state = { leadId: leadId, name: lead.name || '', email: normalized, phone: lead.phone || '',
    company: lead.company, domain: domain, source: 'inbound-form', score: lead.score || 0, notes: lead.notes || '',
    consent: lead.consent === true, status: 'new', touches: [], apptAt: null, nextAt: null, createdTs: now };
  if (lead.name) state.name = lead.name; state.email = normalized; state.domain = domain || state.domain || '';
  state.company = lead.company; state.rung = rung || state.rung || ''; state.consent = lead.consent === true || state.consent === true; state.updatedTs = now;
  await db.set(K.crmState + leadId, state);
  var worklist = await db.get(K.crmWorklist); if (!Array.isArray(worklist)) worklist = [];
  if (worklist.indexOf(leadId) < 0) { worklist.unshift(leadId); await db.set(K.crmWorklist, worklist); }

  var receipt = { schemaVersion: 'lead-pipeline-bridge/1.0', eventId: eventId, leadId: leadId, newLead: isNew,
    domain: domain, rung: rung, capturedAt: now };
  await db.set(eventKey(K.event, eventId), receipt);
  return { ok: true, duplicate: false, leadId: leadId, newLead: isNew, crmStatus: state.status };
}

async function enroll(input, deps) {
  input = input || {}; deps = deps || {}; var db = deps.db || DB;
  var eventId = clip(input.eventId, 300); if (!eventId) return { ok: false, reason: 'enrollment-event-id-required' };
  var key = eventKey(K.enrollment, eventId), prior = await db.get(key);
  if (prior && prior.leadId) return Object.assign({ ok: true, duplicate: true }, prior);
  var captured = await capture(Object.assign({}, input, { eventId: 'enrollment-capture:' + eventId, source: 'stripe-checkout', consent: true }), deps);
  if (!captured.ok) return captured;
  var state = await db.get(K.crmState + captured.leadId); if (!state) throw new Error('enrollment CRM state missing after capture');
  var now = new Date().toISOString();
  state.status = 'enrolled'; state.enrolledAt = state.enrolledAt || now; state.updatedTs = now;
  state.directCheckout = true; state.appointmentRequired = false; state.showRequired = false;
  state.subscriptionIdHash = input.subscriptionId ? hash(input.subscriptionId) : state.subscriptionIdHash || null;
  state.revenueCents = (state.revenueCents || 0) + (Number(input.revenueCents) || 0);
  await db.set(K.crmState + captured.leadId, state);
  var lead = await db.get(K.lead + captured.leadId);
  if (lead) {
    lead.status = 'enrolled'; lead.enrolledAt = lead.enrolledAt || now; lead.lastRevenueAt = now;
    await db.set(K.lead + captured.leadId, lead);
  }
  var restored = await db.get(K.crmState + captured.leadId);
  if (!restored || restored.status !== 'enrolled') throw new Error('enrollment CRM readback invalid');
  var receipt = { schemaVersion: 'lead-pipeline-enrollment/1.0', leadId: captured.leadId, eventId: eventId,
    status: 'enrolled', domain: state.domain, rung: state.rung, directCheckout: true,
    appointmentRequired: false, showRequired: false, revenueCents: Number(input.revenueCents) || 0, enrolledAt: now };
  await db.set(key, receipt); return Object.assign({ ok: true, duplicate: false }, receipt);
}

module.exports = { capture: capture, enroll: enroll, _keys: K };
