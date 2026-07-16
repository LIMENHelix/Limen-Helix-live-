/**
 * leadgen.js — /api/leadgen — the LEAD GENERATION machine.
 *
 * A universal lead intake that unifies every source into one pipeline with
 * dedup + quality scoring + source attribution, then mirrors each capture into
 * the sales funnel's acquisition step (source>leads) so cost-per-lead and
 * downstream conversion show up on the SALES hub.
 *
 * SOURCES (adapters):
 *   inbound-form   LIVE  — imports the site's own captured leads (/api/lead)
 *   referral       LIVE  — leads that arrive with a referrer
 *   list-import    LIVE  — paste / CSV / bought-or-scraped lists
 *   google-places  KEY   — real B2B business leads by query+location (Places API)
 *   web-scrape     BEST  — extract emails/phones from a public URL you provide
 *   serp           KEY   — search-result harvesting via a SERP provider
 *   twilio-inbound KEY   — inbound call/text responses become leads (stub)
 *
 * GUARDRAILS
 *  - This STORES and SCORES leads. It NEVER emails, calls, texts, or contacts
 *    anyone. Outreach is a separate, deliberate action the operator takes.
 *  - Scraping adapters are user-initiated on a target you specify and are
 *    best-effort; respect each site's ToS/robots. No mass/background scraping.
 *  - Lead records are PII — every data action is key-gated (LEAD_ADMIN_KEY /
 *    SALES_ADMIN_KEY). Public `status` exposes source availability only.
 */

var db = require('../lib/limen-db');
var E = require('../lib/sales-engine');
var enrich = require('../lib/lead-enrichment');
var budget = require('../lib/autonomy-budget');

var K = {
  index: 'leadgen:index',       // list of lead ids (newest first)
  lead: 'leadgen:lead:',        // per-lead record
  dedup: 'leadgen:dedup',       // { normKey: leadId }
  stats: 'leadgen:sourcestats', // { source: {count, costCents, scoreSum} }
  domainStats: 'leadgen:domainstats',   // { domain: {count, costCents} }
  companyStats: 'leadgen:companystats', // { companyId: {count, costCents} }
  companies: 'sales:companies', // editable venture registry
  companiesSeeded: 'sales:companies_seeded', // default ids already introduced (so deletes stick)
  companiesCorr: 'sales:companies_corr',     // one-time correction ids already applied
  salesAgg: 'sales:agg',        // shared with the sales funnel
  salesMeta: 'sales:meta'
};
var INDEX_CAP = 5000;

// The 20 LIMEN domains — the top organizing layer for lead management.
var DOMAINS = ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'];

// L1 ventures. Domains are best-guess and EDITABLE from the page (or via
// action=company) — the operator owns the real mapping. New entries here are
// merged into the live registry on deploy (introduced once; a later delete
// sticks — see loadCompanies). The 5 domain "desks" are the P3 instances.
var DEFAULT_COMPANIES = [
  { id: 'killswitch', name: 'Killswitch', domain: 'technology', level: 'L1', note: 'Web agency — free-site anchor + module upsells.' },
  { id: 'relay', name: 'Relay', domain: 'finance', level: 'L1', note: 'Arbitrage broker (Relay / Spread).' },
  { id: 'homestead', name: 'Homestead', domain: 'economy', level: 'L1', note: 'Distressed real-estate desk (P3 / RE).' },
  { id: 'tension', name: 'TENSION', domain: 'population', level: 'L1', note: 'Fitness — time-under-tension + meal replacement.' },
  { id: 'heartland', name: 'Heartland', domain: 'medicine', level: 'L1', note: 'TRT clinic — sales presentation deck.' },
  { id: 'industry-desk', name: 'Industry Desk', domain: 'industry', level: 'L1', note: 'Industrial distress / WARN desk (P3).' },
  { id: 'finance-desk', name: 'Finance Desk', domain: 'finance', level: 'L1', note: 'Distressed securities / EDGAR desk (P3).' },
  { id: 'technology-desk', name: 'Technology Desk', domain: 'technology', level: 'L1', note: 'Tech layoffs desk (P3 / layoffs.fyi).' }
];
// Ventures retired by the operator — stripped from the registry on load even if
// a prior seed already introduced them (belt-and-suspenders removal).
var RETIRED_COMPANIES = ['medicine-desk', 'energy-desk'];
// One-time corrections applied to an already-seeded registry (each id runs once,
// tracked in companiesCorr). Lets us fix a default's domain post-seed without
// clobbering later operator page-edits.
var CORRECTIONS = {
  'tension-to-population': function (stored) { var c = stored.filter(function (x) { return x.id === 'tension'; })[0]; if (c && c.domain === 'medicine') c.domain = 'population'; }
};

// ── source registry ──────────────────────────────────────────────────────
var SOURCE_DEFS = [
  { id: 'inbound-form', label: 'Website form', kind: 'inbound', costModel: 'free', note: "Imports leads captured by the site's own form (/api/lead)." },
  { id: 'referral', label: 'Referral', kind: 'referral', costModel: 'free', note: 'Leads from happy customers and follow-up asks. Cheapest, highest trust.' },
  { id: 'list-import', label: 'List / CSV import', kind: 'import', costModel: 'per-lead', note: 'Paste or upload a bought / scraped / exported list.' },
  { id: 'google-places', label: 'Google Places', kind: 'scrape', env: 'GOOGLE_PLACES_API_KEY', costModel: 'per-query', note: 'Real business leads (name, phone, address, website) by query + location.' },
  { id: 'web-scrape', label: 'Web scrape (URL)', kind: 'scrape', costModel: 'free', note: 'Best-effort extract of emails/phones from a public page you provide. Respect ToS/robots.' },
  { id: 'serp', label: 'Search (SERP API)', kind: 'scrape', env: 'SERP_API_KEY', costModel: 'per-query', note: 'Harvest leads from search results via a SERP provider.' },
  { id: 'twilio-inbound', label: 'Call / Text inbound', kind: 'inbound', env: 'TWILIO_AUTH_TOKEN', costModel: 'per-msg', note: 'Inbound calls/texts (from mailers, ads) become leads. Needs a Twilio number + webhook.' },
  // Internal LIMEN desks — sync their live candidate pools into the unified feed.
  { id: 'homestead-desk', label: 'Homestead desk', kind: 'desk', company: 'homestead', costModel: 'free', note: 'Distressed real-estate deals (realauction) → Homestead. Sync to pull the current top pool.' },
  { id: 'finance-desk', label: 'Finance desk', kind: 'desk', company: 'finance-desk', costModel: 'free', note: 'Distressed companies (EDGAR signals) → Finance Desk. Sync to pull the current pool.' }
];
var SOURCE_TRUST = { 'inbound-form': 12, referral: 16, 'list-import': 4, 'google-places': 9, 'web-scrape': 3, serp: 5, 'twilio-inbound': 10, 'homestead-desk': 12, 'finance-desk': 12 };

function sourceStatus(def) {
  if (!def.env) return def.kind === 'scrape' ? 'best-effort' : 'live';
  return process.env[def.env] ? 'live' : 'needs-key';
}

// ── helpers ────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var data = ''; req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); }); req.on('error', function () { resolve(''); });
  });
}
function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(obj)); }
function clip(v, n) { return String(v == null ? '' : v).slice(0, n).trim(); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }
function normPhone(p) { return String(p || '').replace(/[^\d]/g, '').replace(/^1(\d{10})$/, '$1'); }
function dedupKey(lead) {
  if (validEmail(lead.email)) return 'e:' + lead.email.toLowerCase();
  var ph = normPhone(lead.phone); if (ph.length >= 10) return 'p:' + ph;
  if (lead.name && (lead.org || lead.city)) return 'n:' + (lead.name + '|' + (lead.org || lead.city)).toLowerCase();
  return null; // uncheckable → allowed through
}
function scoreLead(lead, source) {
  var s = 0;
  if (validEmail(lead.email)) s += 30;
  if (normPhone(lead.phone).length >= 10) s += 25;
  if (lead.name) s += 15;
  if (lead.org) s += 10;
  if (lead.city || lead.state) s += 10;
  s += (SOURCE_TRUST[source] || 0);
  return Math.max(0, Math.min(100, s));
}
function makeLead(raw, source, costCents) {
  var lead = {
    name: clip(raw.name, 200), email: clip(raw.email, 200).toLowerCase(),
    phone: clip(raw.phone, 60), org: clip(raw.org || raw.organization || raw.company, 200),
    city: clip(raw.city, 120), state: clip(raw.state, 60),
    website: clip(raw.website || raw.websiteUri, 300), notes: clip(raw.notes || raw.address, 500)
  };
  lead.id = 'LG' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  lead.ts = new Date().toISOString();
  lead.source = source;
  lead.costCents = costCents || 0;
  lead.score = scoreLead(lead, source);
  lead.status = 'new';
  lead.domain = (DOMAINS.indexOf(clip(raw.domain, 40)) !== -1) ? clip(raw.domain, 40) : '';
  lead.company = clip(raw.company, 80);
  lead.dedup = dedupKey(lead);
  return lead;
}

// Stamp domain + company context onto a batch (adapters don't know it; the
// pull/import/capture request does).
// Fills domain/company from the working context, but NEVER overrides a tag the
// adapter already set (desk pulls self-tag to their fixed venture).
function stampContext(leads, domain, company) {
  var d = (DOMAINS.indexOf(clip(domain, 40)) !== -1) ? clip(domain, 40) : '';
  var c = clip(company, 80);
  leads.forEach(function (l) { if (d && !l.domain) l.domain = d; if (c && !l.company) l.company = c; });
  return leads;
}

// ── company registry ────────────────────────────────────────────────────────
// Merge DEFAULT_COMPANIES into the live registry, introducing each default id
// AT MOST ONCE (tracked in companiesSeeded). So new defaults appear on deploy,
// operator edits are preserved, and a company the operator deletes stays gone.
async function loadCompanies() {
  var stored = await db.get(K.companies);
  stored = Array.isArray(stored) ? stored : [];
  var seeded = await db.get(K.companiesSeeded);
  seeded = Array.isArray(seeded) ? seeded : [];
  var have = {}; stored.forEach(function (c) { have[c.id] = 1; });
  var seen = {}; seeded.forEach(function (id) { seen[id] = 1; });
  var changed = false;
  DEFAULT_COMPANIES.forEach(function (d) {
    if (!seen[d.id]) {                             // never introduced before
      if (!have[d.id]) { stored.push(Object.assign({}, d)); have[d.id] = 1; }
      seeded.push(d.id); seen[d.id] = 1; changed = true;
    }
  });
  // strip any retired venture that a prior seed already introduced
  if (RETIRED_COMPANIES.length && stored.some(function (c) { return RETIRED_COMPANIES.indexOf(c.id) !== -1; })) {
    stored = stored.filter(function (c) { return RETIRED_COMPANIES.indexOf(c.id) === -1; });
    changed = true;
  }
  // apply one-time corrections (each id runs once)
  var applied = await db.get(K.companiesCorr);
  applied = Array.isArray(applied) ? applied : [];
  var appliedSet = {}; applied.forEach(function (id) { appliedSet[id] = 1; });
  var corrChanged = false;
  Object.keys(CORRECTIONS).forEach(function (cid) {
    if (!appliedSet[cid]) { CORRECTIONS[cid](stored); applied.push(cid); appliedSet[cid] = 1; corrChanged = true; }
  });
  if (corrChanged) await db.set(K.companiesCorr, applied);
  if (changed || corrChanged) { await db.set(K.companies, stored); await db.set(K.companiesSeeded, seeded); }
  return stored;
}
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || ('c' + Date.now().toString(36)); }

async function loadStats() { return (await db.get(K.stats)) || {}; }
async function loadDedup() { return (await db.get(K.dedup)) || {}; }
// Index is a single JSON array (newest first) — one write per batch, not N.
async function loadIndex() { var x = await db.get(K.index); return Array.isArray(x) ? x : []; }

// Persist a batch of NEW leads: dedup, store record, index, stats, and mirror
// each into the sales funnel's source>leads acquisition step.
async function persistLeads(newLeads) {
  var dd = await loadDedup();
  var stats = await loadStats();
  var dstats = (await db.get(K.domainStats)) || {};
  var cstats = (await db.get(K.companyStats)) || {};
  var agg = (await db.get(K.salesAgg)) || E.emptyAgg();
  var index = await loadIndex();
  var added = [], dupes = 0;
  for (var i = 0; i < newLeads.length; i++) {
    var lead = newLeads[i];
    if (lead.dedup && dd[lead.dedup]) { dupes++; continue; }
    if (lead.dedup) dd[lead.dedup] = lead.id;
    await db.set(K.lead + lead.id, lead);
    index.unshift(lead.id);
    var st = stats[lead.source] || (stats[lead.source] = { count: 0, costCents: 0, scoreSum: 0 });
    st.count += 1; st.costCents += lead.costCents; st.scoreSum += lead.score;
    var dk = lead.domain || 'unassigned';
    var ds = dstats[dk] || (dstats[dk] = { count: 0, costCents: 0 });
    ds.count += 1; ds.costCents += lead.costCents;
    if (lead.company) {
      var ck = lead.company;
      var cs = cstats[ck] || (cstats[ck] = { count: 0, costCents: 0 });
      cs.count += 1; cs.costCents += lead.costCents;
    }
    // mirror to sales funnel acquisition (cost + a captured lead = a won source>leads)
    E.applyEvent(agg, {
      transitionId: 'source>leads', from: 'source', to: 'leads', unit: lead.source,
      won: true, costCents: lead.costCents, dealSize: 'medium', trigger: 'trust'
    });
    added.push(lead);
  }
  if (index.length > INDEX_CAP) index = index.slice(0, INDEX_CAP);
  await db.set(K.dedup, dd);
  await db.set(K.stats, stats);
  await db.set(K.domainStats, dstats);
  await db.set(K.companyStats, cstats);
  await db.set(K.salesAgg, agg);
  await db.set(K.index, index);
  // bump sales realEvents so dataMode reflects real captures
  try {
    var meta = (await db.get(K.salesMeta)) || {};
    meta.realEvents = (meta.realEvents || 0) + added.length;
    meta.dataMode = (meta.simEvents > 0) ? 'mixed' : 'real';
    await db.set(K.salesMeta, meta);
  } catch (e) {}
  return { added: added, addedCount: added.length, dupes: dupes };
}

// ── CSV / text parsing for list import ──────────────────────────────────────
// Accepts a header row (name,email,phone,org,city,state) OR positional lines.
function parseCsv(text) {
  var rows = String(text).split(/\r?\n/).map(function (r) { return r.trim(); }).filter(Boolean);
  if (!rows.length) return [];
  var delim = rows[0].indexOf('\t') !== -1 ? '\t' : ',';
  var header = rows[0].toLowerCase().split(delim).map(function (h) { return h.trim(); });
  var known = ['name', 'email', 'phone', 'org', 'organization', 'company', 'city', 'state', 'website', 'notes'];
  var hasHeader = header.some(function (h) { return known.indexOf(h) !== -1; });
  var out = [];
  var start = hasHeader ? 1 : 0;
  var cols = hasHeader ? header : ['name', 'email', 'phone', 'org', 'city', 'state'];
  for (var i = start; i < rows.length; i++) {
    var cells = rows[i].split(delim).map(function (c) { return c.trim(); });
    var rec = {};
    for (var c = 0; c < cols.length; c++) rec[cols[c]] = cells[c] || '';
    // if the single cell looks like an email, treat it as email
    if (cols.length === 1 && validEmail(cells[0])) rec = { email: cells[0] };
    out.push(rec);
  }
  return out;
}

// ── ADAPTERS ────────────────────────────────────────────────────────────────

// inbound-form: import the site's own captured leads (real, free).
async function pullInboundForm(limit) {
  var ids = (await db.lrange('leads_index', 0, -1)) || [];
  var out = [];
  for (var i = 0; i < ids.length && out.length < (limit || 500); i++) {
    var l = await db.get('lead:' + ids[i]);
    if (!l || l.test) continue;
    out.push(makeLead({ name: l.name, email: l.email, phone: l.phone, org: l.organization, notes: l.message || l.interest }, 'inbound-form', 0));
  }
  return out;
}

// google-places: real Places API (New) text search. Needs GOOGLE_PLACES_API_KEY.
async function pullGooglePlaces(query, location, limit) {
  var key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { error: 'GOOGLE_PLACES_API_KEY not set', leads: [] };
  var q = clip(query, 200) + (location ? (' in ' + clip(location, 120)) : '');
  try {
    var r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri'
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: Math.min(limit || 20, 20) })
    });
    var jd = await r.json();
    if (!r.ok) return { error: 'places ' + r.status + ': ' + JSON.stringify(jd).slice(0, 200), leads: [] };
    var places = (jd && jd.places) || [];
    // Places pricing varies; record an estimated cost per returned lead so ROI is honest.
    var costPer = parseInt(process.env.GOOGLE_PLACES_COST_CENTS || '3', 10);
    var leads = places.map(function (p) {
      return makeLead({
        name: (p.displayName && p.displayName.text) || '', org: (p.displayName && p.displayName.text) || '',
        phone: p.nationalPhoneNumber || '', website: p.websiteUri || '', notes: p.formattedAddress || ''
      }, 'google-places', costPer);
    });
    return { leads: leads, raw: places.length };
  } catch (e) { return { error: String(e && e.message || e), leads: [] }; }
}

// web-scrape: best-effort extract of emails + phones from a public page.
async function pullWebScrape(url, limit) {
  var target = clip(url, 500);
  if (!/^https?:\/\//i.test(target)) return { error: 'a full http(s) URL is required', leads: [] };
  try {
    var r = await fetch(target, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LIMEN-leadgen/1.0)' } });
    if (!r.ok) return { error: 'fetch ' + r.status + ' (page may block scraping)', leads: [] };
    var html = await r.text();
    var emails = Array.from(new Set((html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
      .filter(function (e) { return !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(e); })));
    var phones = Array.from(new Set((html.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])
      .map(normPhone).filter(function (p) { return p.length === 10; })));
    var leads = [];
    var n = Math.min(limit || 100, Math.max(emails.length, phones.length));
    for (var i = 0; i < n; i++) {
      var e = emails[i], p = phones[i];
      if (!e && !p) break;
      leads.push(makeLead({ email: e || '', phone: p || '', notes: 'scraped: ' + target }, 'web-scrape', 0));
    }
    return { leads: leads, note: emails.length + ' emails, ' + phones.length + ' phones found' };
  } catch (e) { return { error: String(e && e.message || e), leads: [] }; }
}

// homestead-desk: sync the distressed-RE pool (realauction:deals). Each owner+
// property is a mailable lead, tagged to Homestead / economy. Top-by-equity.
async function pullHomesteadDesk(limit) {
  var deals = (await db.get('realauction:deals')) || [];
  if (!Array.isArray(deals)) return { leads: [], note: 'no realauction:deals in store' };
  var withOwner = deals.filter(function (d) { return d && d.owner && d.owner.name; });
  withOwner.sort(function (a, b) { return (b.equity || 0) - (a.equity || 0); });
  var cap = Math.min(limit || 300, 500);
  var take = withOwner.slice(0, cap);
  var leads = take.map(function (d) {
    var o = d.owner || {};
    var mailTo = [o.mailAddr, o.mailCity, o.mailState, o.mailZip].filter(Boolean).join(', ');
    return makeLead({
      name: o.name, org: '',
      city: d.city || '', state: o.mailState || d.state || '',
      website: d.url || '',
      notes: [d.street || d.address, d.county && (d.county + ' County'), d.tier && ('tier ' + d.tier),
        d.equity && ('~$' + Math.round(d.equity).toLocaleString() + ' equity'),
        o.absentee ? 'absentee' : '', d.ownerDealCount > 1 ? (d.ownerDealCount + ' properties') : '',
        mailTo ? ('mail: ' + mailTo) : ''].filter(Boolean).join(' · '),
      domain: 'economy', company: 'homestead'
    }, 'homestead-desk', 0);
  });
  return { leads: leads, note: withOwner.length + ' deals in pool, synced top ' + take.length + (withOwner.length > cap ? ' (capped)' : '') };
}

// finance-desk: sync the distressed-company pool (finance:distress). Each company
// is a lead tagged to Finance Desk / finance.
async function pullFinanceDesk(limit) {
  var deals = (await db.get('finance:distress')) || [];
  if (!Array.isArray(deals)) return { leads: [], note: 'no finance:distress in store' };
  var cap = Math.min(limit || 300, 500);
  var take = deals.slice(0, cap);
  var leads = take.map(function (d) {
    return makeLead({
      name: d.company || d.ticker || 'unknown', org: d.company || '',
      website: d.cik ? ('https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + d.cik) : '',
      notes: [d.signalLabel || d.signalType, d.ticker && ('$' + d.ticker), d.cik && ('CIK ' + d.cik)].filter(Boolean).join(' · '),
      domain: 'finance', company: 'finance-desk'
    }, 'finance-desk', 0);
  });
  return { leads: leads, note: deals.length + ' distressed companies, synced top ' + take.length + (deals.length > cap ? ' (capped)' : '') };
}

// ── handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var action = (u.searchParams.get('action') || 'status').toLowerCase();

  // public: source availability only (no PII, no data)
  if (action === 'status') {
    return j(res, 200, {
      ok: true, surface: 'leadgen', backend: db.getBackend(),
      keyConfigured: !!(process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY),
      domains: DOMAINS,
      sources: SOURCE_DEFS.map(function (d) { return { id: d.id, label: d.label, kind: d.kind, status: sourceStatus(d), env: d.env || null, note: d.note }; }),
      enrichment: enrich.backendsStatus()
    });
  }

  var ADMIN = process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  var key = u.searchParams.get('key') || (req.headers && req.headers['x-sales-key']) || '';
  if (!ADMIN) return j(res, 503, { ok: false, error: 'Lead-gen admin not configured. No data exposed.' });
  if (key !== ADMIN) return j(res, 403, { ok: false, error: 'Valid admin key required (?key=).' });

  try {
    if (method === 'GET' && action === 'sources') {
      var stats = await loadStats();
      var out = SOURCE_DEFS.map(function (d) {
        var s = stats[d.id] || { count: 0, costCents: 0, scoreSum: 0 };
        return {
          id: d.id, label: d.label, kind: d.kind, status: sourceStatus(d), env: d.env || null, note: d.note,
          count: s.count, costCents: s.costCents,
          costPerLeadCents: s.count ? Math.round(s.costCents / s.count) : null,
          avgScore: s.count ? Math.round(s.scoreSum / s.count) : null
        };
      });
      return j(res, 200, { ok: true, sources: out });
    }

    if (method === 'GET' && action === 'leads') {
      var limit = Math.min(parseInt(u.searchParams.get('limit') || '100', 10) || 100, 500);
      var src = u.searchParams.get('source') || '';
      var fdomain = u.searchParams.get('domain') || '';
      var fcompany = u.searchParams.get('company') || '';
      var ids = await loadIndex();
      var leads = [];
      for (var i = 0; i < ids.length && leads.length < limit; i++) {
        var l = await db.get(K.lead + ids[i]);
        if (!l) continue;
        if (src && l.source !== src) continue;
        if (fdomain && (l.domain || '') !== fdomain) continue;
        if (fcompany && (l.company || '') !== fcompany) continue;
        leads.push(l);
      }
      return j(res, 200, { ok: true, count: leads.length, total: ids.length, leads: leads });
    }

    // Domain board + company registry with lead counts.
    if (method === 'GET' && action === 'board') {
      var dstats2 = (await db.get(K.domainStats)) || {};
      var cstats2 = (await db.get(K.companyStats)) || {};
      var companies = await loadCompanies();
      var domains = DOMAINS.map(function (d) {
        var s = dstats2[d] || { count: 0, costCents: 0 };
        return { id: d, count: s.count, costCents: s.costCents, companies: companies.filter(function (c) { return c.domain === d; }).map(function (c) { return c.id; }) };
      });
      var unassigned = dstats2.unassigned || { count: 0 };
      var comps = companies.map(function (c) {
        var s = cstats2[c.id] || cstats2[c.name] || { count: 0, costCents: 0 };
        return Object.assign({}, c, { count: s.count, costCents: s.costCents });
      });
      return j(res, 200, { ok: true, domains: domains, companies: comps, unassigned: unassigned.count });
    }

    if (method === 'GET' && action === 'companies') {
      return j(res, 200, { ok: true, companies: await loadCompanies() });
    }

    // Autonomy spend gate status (arm state + today's budget/spend). Key-gated.
    if (method === 'GET' && action === 'autonomy') {
      return j(res, 200, { ok: true, autonomy: await budget.status() });
    }

    // Single-company contact lookup: runs the FREE enrichment engine live and
    // returns the resolved contact WITHOUT persisting. Key-gated (an email is
    // PII). Paid backends never fire here (cost guard). Drives the /admin bar.
    if (method === 'GET' && action === 'lookup') {
      var lq = clip(u.searchParams.get('org') || u.searchParams.get('q') || '', 200);
      var lnm = clip(u.searchParams.get('name') || '', 200);
      if (!lq && !lnm) return j(res, 400, { ok: false, error: 'Provide ?org= (company name) or ?name=.' });
      var probe = { name: lnm, org: lq || lnm, website: clip(u.searchParams.get('website') || '', 300), email: '', phone: '', costCents: 0 };
      var lrep = await enrich.enrichLeads([probe], { maxAttempts: 1, ddgMax: 3 });
      return j(res, 200, {
        ok: true, query: lq || lnm, found: !!probe.enrichedBy,
        email: probe.email || '', phone: probe.phone || '',
        via: probe.enrichedBy || null, cost: lrep.cost || 0,
        backends: enrich.backendsStatus()
      });
    }

    var raw = '', body = {};
    if (method === 'POST') { raw = await readBody(req); body = raw; if (typeof raw === 'string' && raw) { try { body = JSON.parse(raw); } catch (e) { body = {}; } } if (!body || typeof body !== 'object') body = {}; }

    // Create or update a company (venture). Body: {id?, name, domain, level?, note?}
    if (method === 'POST' && action === 'company') {
      if (!body.name && !body.id) return j(res, 400, { ok: false, error: 'company name required' });
      var companies2 = await loadCompanies();
      var id = clip(body.id, 40) || slugify(body.name);
      var domain = (DOMAINS.indexOf(clip(body.domain, 40)) !== -1) ? clip(body.domain, 40) : '';
      var existing = companies2.filter(function (c) { return c.id === id; })[0];
      if (existing) {
        if (body.name) existing.name = clip(body.name, 80);
        if (body.domain !== undefined) existing.domain = domain;
        if (body.level) existing.level = clip(body.level, 8);
        if (body.note !== undefined) existing.note = clip(body.note, 300);
      } else {
        companies2.push({ id: id, name: clip(body.name, 80) || id, domain: domain, level: clip(body.level, 8) || 'L1', note: clip(body.note, 300) });
      }
      await db.set(K.companies, companies2);
      return j(res, 200, { ok: true, company: companies2.filter(function (c) { return c.id === id; })[0], count: companies2.length });
    }

    if (method === 'POST' && action === 'company-delete') {
      var delId = clip(body.id, 40);
      var companies3 = (await loadCompanies()).filter(function (c) { return c.id !== delId; });
      await db.set(K.companies, companies3);
      return j(res, 200, { ok: true, deleted: delId, count: companies3.length });
    }

    if (method === 'POST' && action === 'capture') {
      var one = body.lead || body;
      if (!one || (!validEmail(one.email) && normPhone(one.phone).length < 10 && !one.name)) {
        return j(res, 400, { ok: false, error: 'A lead needs at least an email, phone, or name.' });
      }
      var lead = makeLead(one, clip(one.source, 40) || 'manual', parseInt(one.costCents, 10) || 0);
      stampContext([lead], one.domain, one.company);
      var pr = await persistLeads([lead]);
      return j(res, 200, { ok: true, added: pr.addedCount, dupes: pr.dupes, lead: pr.added[0] || null });
    }

    if (method === 'POST' && action === 'import') {
      var recs = [];
      if (Array.isArray(body.leads)) recs = body.leads;
      else if (typeof body.csv === 'string') recs = parseCsv(body.csv);
      else if (typeof body.text === 'string') recs = parseCsv(body.text);
      if (!recs.length) return j(res, 400, { ok: false, error: 'Provide leads:[...] or csv:"..." text.' });
      var source = clip(body.source, 40) || 'list-import';
      var costEach = parseInt(body.costPerLeadCents, 10) || 0;
      var leads2 = recs.slice(0, 2000).map(function (r) { return makeLead(r, source, costEach); })
        .filter(function (l) { return validEmail(l.email) || normPhone(l.phone).length >= 10 || l.name; });
      stampContext(leads2, body.domain, body.company);
      var pr2 = await persistLeads(leads2);
      return j(res, 200, { ok: true, parsed: recs.length, valid: leads2.length, added: pr2.addedCount, dupes: pr2.dupes });
    }

    if (method === 'POST' && action === 'pull') {
      var source3 = clip(body.source, 40);
      var limit3 = Math.min(parseInt(body.limit, 10) || 50, 500);
      var got, note = null, err = null;
      if (source3 === 'inbound-form') { got = await pullInboundForm(limit3); }
      else if (source3 === 'google-places') { var g = await pullGooglePlaces(body.query, body.location, limit3); got = g.leads; note = g.note || (g.raw != null ? (g.raw + ' places') : null); err = g.error; }
      else if (source3 === 'web-scrape') { var w = await pullWebScrape(body.url, limit3); got = w.leads; note = w.note; err = w.error; }
      else if (source3 === 'homestead-desk') { var hd = await pullHomesteadDesk(limit3); got = hd.leads; note = hd.note; err = hd.error; }
      else if (source3 === 'finance-desk') { var fd = await pullFinanceDesk(limit3); got = fd.leads; note = fd.note; err = fd.error; }
      else { return j(res, 400, { ok: false, error: 'Pull not available for source "' + source3 + '". Live pull: inbound-form, google-places (key), web-scrape, homestead-desk, finance-desk.' }); }
      if (err) return j(res, 200, { ok: false, source: source3, error: err, added: 0 });
      stampContext(got || [], body.domain, body.company);
      // Phase 1 — contact enrichment. Desk leads (finance/homestead) arrive with
      // no email, so autopilot's canAuto (needs state.email) can never reach them.
      // Resolve a contact BEFORE intake and re-score/re-dedup the ones that gained
      // one. Free backends only unless a paid provider is keyed AND armed
      // (LEAD_ENRICH_PAID_ENABLED=1). Read-only lookup; contacts no one. Opt out
      // per-pull with body.enrich=false.
      var enrichReport = null;
      if (got && got.length && body.enrich !== false) {
        enrichReport = await enrich.enrichLeads(got, { maxAttempts: Math.min(limit3, 50) });
        got.forEach(function (l) { if (l && l.enrichedBy) { l.score = scoreLead(l, l.source); l.dedup = dedupKey(l); } });
      }
      var pr3 = await persistLeads(got || []);
      return j(res, 200, { ok: true, source: source3, pulled: (got || []).length, added: pr3.addedCount, dupes: pr3.dupes, note: note, enriched: enrichReport });
    }

    if (method === 'POST' && action === 'reset') {
      var ids2 = await loadIndex();
      for (var d = 0; d < ids2.length; d++) await db.del(K.lead + ids2[d]);
      await db.del(K.index); await db.del(K.dedup); await db.del(K.stats);
      await db.del(K.domainStats); await db.del(K.companyStats);
      // company registry is intentionally preserved across a lead reset
      return j(res, 200, { ok: true, reset: true, cleared: ids2.length });
    }

    return j(res, 405, { ok: false, error: 'Unsupported action/method: ' + method + ' ' + action });
  } catch (e) {
    return j(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
