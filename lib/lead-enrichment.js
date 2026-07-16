'use strict';
/**
 * lead-enrichment.js — provider-agnostic contact-enrichment seam (Phase 1).
 *
 * WHY: desk leads (finance-desk, later industry/energy) arrive with NO email, so
 * autopilot's `canAuto` check (which requires state.email, autopilot.js) can
 * never fire for them. This resolves a reachable contact (email/phone) BEFORE a
 * lead enters the pipeline and writes it onto lead.email / lead.phone — the exact
 * field scoreLead scores and crm-load copies into state.email.
 *
 * DESIGN
 *  - Ordered BACKEND registry. The first backend that returns a usable contact
 *    wins. A real paid provider (Apollo / Hunter / Clearbit) slots in as ONE more
 *    backend entry with `requiresEnv` set — no other code changes.
 *  - COST GUARD (inline): a backend with costModel !== 'free' runs ONLY when
 *    LEAD_ENRICH_PAID_ENABLED === '1' AND its key env is present. Default: only
 *    free backends run, so enrichment NEVER spends money by default. That env
 *    flag is the arm switch; flipping it is a human action, not this module's.
 *  - This module NEVER contacts anyone. It READS public pages / provider APIs to
 *    resolve a contact. Sending remains a separate, human-gated step elsewhere.
 *
 * SCOPE HONESTY: the only shipped backend (`web-contact`) scrapes the lead's own
 * company website. finance-desk leads carry an SEC/EDGAR url, which is filing
 * metadata, not the company's contact surface — so web-contact correctly SKIPS
 * them and returns nothing. Real finance enrichment therefore needs a paid
 * provider keyed on company name/ticker (the disarmed slot below). The seam is
 * built and verified; the finance yield is gated on that provider, by design.
 */

var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
var PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }
function normPhone(p) { return String(p || '').replace(/[^\d]/g, '').replace(/^1(\d{10})$/, '$1'); }

// Is this url the lead's OWN contact surface (worth scraping), or filing/search
// metadata (never has a reachable email)? Return the scrapable url, or null.
function scrapableSite(url) {
  var s = String(url == null ? '' : url);
  if (!/^https?:\/\//i.test(s)) return null;
  if (/(sec\.gov|edgar|\.gov(?:[\/:]|$)|google\.[a-z.]+\/|bing\.com|duckduckgo\.com)/i.test(s)) return null;
  return s;
}

function extractContact(html) {
  var text = String(html == null ? '' : html);
  var emails = Array.from(new Set((text.match(EMAIL_RE) || [])
    .filter(function (e) { return !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(e); })
    .map(function (e) { return e.toLowerCase(); })
    .filter(validEmail)));
  var phones = Array.from(new Set((text.match(PHONE_RE) || [])
    .map(normPhone).filter(function (p) { return p.length === 10; })));
  if (!emails.length && !phones.length) return null;
  return { email: emails[0] || '', phone: phones[0] || '' };
}

// ── backend registry ─────────────────────────────────────────────────────────
// Each backend: { id, label, costModel, requiresEnv, enabled(), run(lead, ctx) }
// run() returns { email, phone, source, costCents } or null. ctx.fetchImpl lets
// tests inject a fetch stub (defaults to global fetch).
var BACKENDS = [
  {
    id: 'web-contact',
    label: 'Company website scrape',
    costModel: 'free',
    requiresEnv: null,
    enabled: function () { return true; },
    run: async function (lead, ctx) {
      var site = scrapableSite(lead && lead.website);
      if (!site) return null;
      var fetchImpl = (ctx && ctx.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
      if (!fetchImpl) return null;
      try {
        var r = await fetchImpl(site, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LIMEN-enrich/1.0)' } });
        if (!r || !r.ok) return null;
        var html = await r.text();
        var c = extractContact(html);
        if (!c) return null;
        return { email: c.email, phone: c.phone, source: 'web-contact', costCents: 0 };
      } catch (e) { return null; }
    }
  }
  // ── PAID PROVIDER SLOT (disarmed) ──────────────────────────────────────────
  // Drop a real provider in here. It runs only when armed + keyed (see
  // backendActive). Example shape:
  // {
  //   id: 'apollo', label: 'Apollo enrichment', costModel: 'per-lead',
  //   requiresEnv: 'APOLLO_API_KEY',
  //   enabled: function () { return true; },
  //   run: async function (lead, ctx) {
  //     // call the provider by lead.name / lead.org, map response ->
  //     // { email, phone, source: 'apollo', costCents: <price> }
  //     return null;
  //   }
  // }
];

function paidArmed() { return process.env.LEAD_ENRICH_PAID_ENABLED === '1'; }

// Cost guard: free backends always active; paid backends require the global arm
// flag AND their key present.
function backendActive(b) {
  if (b.costModel === 'free') return b.enabled ? b.enabled() : true;
  if (!paidArmed()) return false;
  if (b.requiresEnv && !process.env[b.requiresEnv]) return false;
  return b.enabled ? b.enabled() : true;
}

// Enrich ONE lead in place. Writes lead.email / lead.phone only when currently
// missing; never overwrites an existing valid contact. Adds any cost to
// lead.costCents. Returns { enriched, via?, cost?, reason? }.
async function enrichLead(lead, ctx) {
  if (!lead) return { enriched: false, reason: 'no-lead' };
  if (validEmail(lead.email)) return { enriched: false, reason: 'already-has-email' };
  for (var i = 0; i < BACKENDS.length; i++) {
    var b = BACKENDS[i];
    if (!backendActive(b)) continue;
    var got = await b.run(lead, ctx || {});
    if (got && (validEmail(got.email) || normPhone(got.phone).length === 10)) {
      if (validEmail(got.email) && !validEmail(lead.email)) lead.email = String(got.email).toLowerCase();
      if (normPhone(got.phone).length === 10 && normPhone(lead.phone).length < 10) lead.phone = got.phone;
      lead.enrichedBy = got.source;
      lead.costCents = (lead.costCents || 0) + (got.costCents || 0);
      return { enriched: true, via: got.source, cost: got.costCents || 0 };
    }
  }
  return { enriched: false, reason: 'no-contact-found' };
}

// Enrich a batch in place. maxAttempts caps how many contact-less leads we try
// per call (protects against a 500-lead pull firing 500 fetches). Leads that
// already have an email are free (skipped, not counted). Returns a report.
async function enrichLeads(leads, ctx) {
  ctx = ctx || {};
  var maxAttempts = ctx.maxAttempts != null ? ctx.maxAttempts : 25;
  var attempts = 0;
  var out = { total: (leads || []).length, attempted: 0, enriched: 0, cost: 0, byBackend: {}, capped: false };
  for (var i = 0; i < (leads || []).length; i++) {
    var lead = leads[i];
    if (validEmail(lead && lead.email)) continue;
    if (attempts >= maxAttempts) { out.capped = true; break; }
    attempts++; out.attempted++;
    var r = await enrichLead(lead, ctx);
    if (r.enriched) { out.enriched++; out.cost += r.cost || 0; out.byBackend[r.via] = (out.byBackend[r.via] || 0) + 1; }
  }
  return out;
}

// Operator visibility: which backends exist and whether each is active right now.
function backendsStatus() {
  return BACKENDS.map(function (b) {
    return { id: b.id, label: b.label, costModel: b.costModel, requiresEnv: b.requiresEnv || null, active: backendActive(b) };
  });
}

module.exports = {
  enrichLead: enrichLead,
  enrichLeads: enrichLeads,
  backendsStatus: backendsStatus,
  paidArmed: paidArmed,
  // exported for tests
  _extractContact: extractContact,
  _scrapableSite: scrapableSite,
  _backendActive: backendActive
};
