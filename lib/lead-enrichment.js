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
 * SCOPE HONESTY: `web-contact` scrapes the lead's own company website, so it
 * skips finance-desk leads (their url is SEC/EDGAR filing metadata, not a
 * contact surface). `ddg-search` fills that gap for free: it searches
 * DuckDuckGo by COMPANY NAME (lead.org), finds the company's own site, and
 * scrapes that. It runs only for business leads (org present) — never a
 * people-search on a private individual (homestead owners have org=''). DDG has
 * no official API; the reliable transport is DDGS_API_URL (a self-hosted
 * `ddgs[api]` server, see the backend comment), with direct DDG HTML as a
 * best-effort fallback behind a circuit breaker. A paid provider still slots
 * in behind the cost guard for higher-yield finance enrichment.
 */

var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
var PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
// US street address: "2450 S Watney Way, Fairfield, CA 94533" (suite optional).
// Deliberately requires street-suffix + 2-letter state + zip so prose can't match.
var ADDRESS_RE = /(\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9 .'&-]{2,48}?\s(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Parkway|Pkwy|Highway|Hwy|Place|Pl|Circle|Cir|Terrace|Ter|Trail|Trl|Plaza|Square|Sq)\b\.?(?:[ ,]+(?:Suite|Ste|Unit|Bldg|Building|Floor|Fl|#)\.?\s*[A-Za-z0-9-]+)?)[\s,]+([A-Za-z][A-Za-z .'-]{1,28}?)[\s,]+([A-Z]{2})[\s,]+(\d{5}(?:-\d{4})?)/;

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

// ── ddg-search helpers ────────────────────────────────────────────────────────
// Hosts that rank for company-name queries but are never the company's own
// contact surface (directories, socials, news, data brokers). Skipped as
// scrape candidates.
// Brokers are doubly dangerous: their pages carry THEIR OWN support email,
// which passes the same-domain precision rule (observed live: leadiq.com page
// -> support@leadiq.com). This list is the guard; keep it aggressive.
var DDG_SKIP_HOSTS = /(linkedin\.|facebook\.|twitter\.|(^|\.)x\.com|instagram\.|youtube\.|wikipedia\.|yelp\.|crunchbase\.|zoominfo\.|bloomberg\.|reuters\.|wsj\.com|marketwatch\.|stocktwits\.|yahoo\.com|glassdoor\.|indeed\.|bbb\.org|pitchbook\.|dnb\.com|apollo\.io|rocketreach\.|leadiq\.|owler\.|tracxn\.|globenewswire\.|prnewswire\.|businesswire\.|pissedconsumer\.|readycontacts\.|prospeo\.|contactout\.|hunter\.io|snov\.io|lusha\.|signalhire\.|wiza\.co|similarweb\.|growjo\.|craft\.co|6sense\.|aeroleads\.|uplead\.|clearbit\.|datanyze\.|kaspr\.io|cience\.|swordfish\.|anymailfinder\.|voilanorbert\.|findymail\.|nymblr\.|salesintel\.|seamless\.ai|instantly\.ai|scrapin\.io|comparably\.|zippia\.|zaubacorp\.|complaintsboard\.|trustpilot\.|sitejabber\.|mapquest\.|yellowpages\.|whitepages\.|manta\.com|buzzfile\.|opencorporates\.|chamber|allbiz\.|alignable\.|superpages\.|merchantcircle\.|hotfrog\.|cylex|citysquares\.|foursquare\.|birdeye\.|nextdoor\.)/i;

// First mailable US street address in a page's text. Returns
// { street, city, state, zip, full } or null. Feeds homestead-automail-style
// physical outreach; the extract transport's plain text parses cleanly.
function pickAddress(text) {
  var m = String(text == null ? '' : text).match(ADDRESS_RE);
  if (!m) return null;
  var street = m[1].replace(/\s+/g, ' ').trim();
  var city = m[2].replace(/\s+/g, ' ').trim();
  var out = { street: street, city: city, state: m[3], zip: m[4] };
  out.full = street + ', ' + city + ', ' + m[3] + ' ' + m[4];
  return out;
}

function baseHost(host) {
  var parts = String(host == null ? '' : host).toLowerCase().replace(/^www\./, '').split('.');
  return parts.slice(-2).join('.');
}

// Distinctive tokens of a company name, for matching against candidate hosts.
// Generic corporate words are dropped so "Vince Holding Corp" -> ["vince"].
var ORG_STOPWORDS = /^(the|and|for|inc|incorporated|corp|corporation|co|company|companies|llc|llp|ltd|limited|plc|holding|holdings|group|industries|industrial|international|enterprises|technologies|technology|solutions|systems|services|brands|partners|capital|financial|global|worldwide|usa|america|american|of)$/;
function orgTokens(org) {
  return String(org == null ? '' : org).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter(function (t) { return t.length >= 3 && !ORG_STOPWORDS.test(t); });
}

// Reduce a raw result-url list to up to `max` scrapable candidates, one per
// base domain, skipping directories/socials. When `tokens` is given, a
// candidate's base domain must also contain one of the company-name tokens —
// STRUCTURAL guard against aggregator pages whose own same-domain email would
// otherwise pass pickContactForHost (observed live: a stocktitan.net page
// yielding info@stocktitan.net for a company query). The blacklist can never
// be exhaustive; this gate is what actually holds.
function filterCandidateUrls(rawUrls, max, tokens) {
  var out = [], seen = {};
  for (var i = 0; i < (rawUrls || []).length && out.length < max; i++) {
    var u = scrapableSite(rawUrls[i]);
    if (!u) continue;
    var host;
    try { host = new URL(u).hostname; } catch (e) { continue; }
    if (DDG_SKIP_HOSTS.test(host)) continue;
    var b = baseHost(host);
    if (seen[b]) continue;
    if (tokens && !tokens.some(function (t) { return b.indexOf(t) !== -1; })) continue;
    seen[b] = 1; out.push(u);
  }
  return out;
}

// Parse DuckDuckGo's HTML-endpoint results. Result links are redirect urls
// carrying the target in a `uddg=` param; some variants link directly. Returns
// up to `max` scrapable candidate urls, one per base domain.
function ddgResultUrls(html, max, tokens) {
  var text = String(html == null ? '' : html);
  var raw = [], m;
  var re = /uddg=([^&"'<>]+)/g;
  while ((m = re.exec(text)) !== null) {
    try { raw.push(decodeURIComponent(m[1])); } catch (e) { /* bad encoding */ }
  }
  var re2 = /class="result__a"[^>]*href="(https?:\/\/[^"]+)"/g;
  while ((m = re2.exec(text)) !== null) raw.push(m[1]);
  return filterCandidateUrls(raw, max, tokens);
}

// Precision rule: an email harvested from a searched-up page is accepted ONLY
// when its domain matches the page's own host. That pins the contact to the
// company itself rather than to whatever directory or ad happens to be on the
// page. A PHONE alone is also accepted: by the time we're here the page passed
// the org-token domain gate, so it is the company's own site, and a phone the
// company publishes on its own site is a legitimate contact (most small
// manufacturers are form+phone only — observed live: abcolabs.com).
function pickContactForHost(html, host) {
  var text = String(html == null ? '' : html);
  var b = baseHost(host);
  var matched = (text.match(EMAIL_RE) || [])
    .map(function (e) { return e.toLowerCase(); })
    .filter(function (e) { return !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(e); })
    .filter(validEmail)
    .filter(function (e) { return baseHost(e.split('@')[1]) === b; })[0];
  var phones = (text.match(PHONE_RE) || []).map(normPhone).filter(function (p) { return p.length === 10; });
  var addr = pickAddress(text);
  if (!matched && !phones.length) return null;
  return { email: matched || '', phone: phones[0] || '', address: addr ? addr.full : '', addressParts: addr };
}

function fetchOpts() {
  var o = { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LIMEN-enrich/1.0)' } };
  // Bound every outbound fetch so a hung host can't eat the serverless budget.
  try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) o.signal = AbortSignal.timeout(8000); } catch (e) { /* older runtime */ }
  return o;
}

// Where the DDGS search server lives. DDGS_API_URL env always wins; in Vercel
// production it defaults to this deployment's OWN /api/ddgs-search python
// function (free, key-gated, same origin) so no env setup is needed. Empty
// string = no API transport (direct-DDG fallback only).
function ddgsApiBase(ctx) {
  var explicit = String((ctx && ctx.ddgsApiUrl) || process.env.DDGS_API_URL || '').replace(/\/+$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === 'production') return 'https://limenhelix.com/api/ddgs-search';
  return '';
}

// Same-origin proxy auth: the python function accepts any of these keys, all
// already server-side envs. Header is harmless to third-party ddgs servers.
function ddgsApiOpts() {
  var o = fetchOpts();
  var k = process.env.DDGS_PROXY_KEY || process.env.LEAD_ADMIN_KEY || process.env.SALES_ADMIN_KEY;
  if (k) o.headers['x-ddgs-key'] = k;
  return o;
}

// Circuit breaker: DDG scrapes an unofficial endpoint and WILL rate-limit
// bursts. First block (403/429/captcha page) trips the backend off for the
// rest of this process so a 25-lead batch degrades to one failed request, not
// twenty-five.
var ddgTripped = false;

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
        var r = await fetchImpl(site, fetchOpts());
        if (!r || !r.ok) return null;
        var html = await r.text();
        var c = extractContact(html);
        if (!c) return null;
        var a = pickAddress(html);
        return { email: c.email, phone: c.phone, address: a ? a.full : '', source: 'web-contact', costCents: 0 };
      } catch (e) { return null; }
    }
  },
  {
    // Free fallback when the lead has no scrapable website (finance-desk leads
    // carry only an EDGAR url): web-search the COMPANY NAME, take the top
    // non-directory results, scrape those pages, and accept ONLY a same-domain
    // email (see pickContactForHost). Business leads only — requires lead.org.
    // Search transport, in order:
    //   1. DDGS_API_URL (a `pip install ddgs[api]` FastAPI server) — the ddgs
    //      lib impersonates a browser's TLS fingerprint, which reliably gets
    //      past DDG's bot check. VERIFIED: plain Node fetch to DDG gets the
    //      captcha page; ddgs gets results. Point DDGS_API_URL at a server YOU
    //      host (it has no auth — never a public open proxy).
    //   2. Direct DDG HTML endpoint — zero-config best effort; the circuit
    //      breaker trips it off for this process on the first block.
    id: 'ddg-search',
    label: 'Web search (DDGS) -> company site scrape',
    costModel: 'free',
    requiresEnv: null,
    // Breaker only kills the backend outright when direct DDG is the ONLY
    // transport; a configured DDGS API server is unaffected by DDG blocks here.
    // Runs when a DDGS server is configured. The plain-DDG fallback (which gets
    // captcha'd from serverless) is OFF unless LEAD_ENRICH_DDG_DIRECT=1 opts in,
    // so "skip DDGS" leaves web-contact as the free path with no wasted requests.
    enabled: function () { return !!ddgsApiBase(null) || (process.env.LEAD_ENRICH_DDG_DIRECT === '1' && !ddgTripped); },
    run: async function (lead, ctx) {
      var org = String((lead && lead.org) || '').trim();
      if (org.length < 3) return null; // business leads only; never people-search an individual
      // Geo words are NOT distinctive: "ABCO Laboratories Fairfield" must not let
      // fairfieldsuisunchamber.com pass the domain gate (observed live: the chamber's
      // own info@ + phone came back as the company's contact). Strip the lead's
      // city/state words from the token set before gating.
      var geo = orgTokens(String((lead && lead.city) || '') + ' ' + String((lead && lead.state) || ''));
      var tokens = orgTokens(org).filter(function (t) { return geo.indexOf(t) === -1; });
      if (!tokens.length) return null; // all-generic name -> no safe way to pin a domain to it
      var fetchImpl = (ctx && ctx.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
      if (!fetchImpl) return null;
      if (ctx && typeof ctx._ddgBudget === 'number') { if (ctx._ddgBudget <= 0) return null; ctx._ddgBudget--; }
      var q = org + ' contact email';
      var urls = null;
      var api = ddgsApiBase(ctx);
      if (api) {
        try {
          var ar = await fetchImpl(api + '/search/text?query=' + encodeURIComponent(q) + '&max_results=8', ddgsApiOpts());
          if (ar && ar.ok) {
            var data = await ar.json();
            urls = filterCandidateUrls((data && data.results || []).map(function (x) { return x && x.href; }), 3, tokens);
          }
        } catch (e) { /* fall through to direct DDG */ }
      }
      if (urls == null && !ddgTripped) {
        try {
          var r = await fetchImpl('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), fetchOpts());
          if (!r || !r.ok) {
            if (r && (r.status === 403 || r.status === 429)) ddgTripped = true;
            return null;
          }
          var serp = await r.text();
          if (/anomaly|captcha/i.test(serp)) { ddgTripped = true; return null; }
          urls = ddgResultUrls(serp, 3, tokens);
        } catch (e) { return null; }
      }
      // Candidate pages often 403 plain serverless fetches (observed live:
      // abcolabs.com). The ddgs server's /extract fetches with browser
      // impersonation and returns the page text — use it when available.
      async function pageText(u2) {
        if (api) {
          try {
            var er = await fetchImpl(api + '/extract?url=' + encodeURIComponent(u2) + '&fmt=text_plain', ddgsApiOpts());
            if (er && er.ok) {
              var ed = await er.json();
              var t = ed && (ed.content || ed.text);
              if (t) return String(t);
            }
          } catch (e) { /* fall through to direct fetch */ }
        }
        try {
          var p = await fetchImpl(u2, fetchOpts());
          if (!p || !p.ok) return null;
          return await p.text();
        } catch (e) { return null; }
      }
      // Address fallback: most small-biz sites never publish a street address in
      // extractable text (verified live: abcolabs.com, hartzlerdairy.com), but
      // directory SNIPPETS for an "<org> address" query do. Directory hosts are
      // banned for EMAIL harvest (they inject their own), yet their snippet text
      // is fine for an address — provided the snippet names the company (token
      // guard, so a different business ranking for the query can't donate its
      // address). One extra search request, only when a contact was found
      // without an address.
      async function serpAddress() {
        try {
          var ar2 = await fetchImpl(api + '/search/text?query=' + encodeURIComponent(org + ' address') + '&max_results=8', ddgsApiOpts());
          if (!ar2 || !ar2.ok) return '';
          var d2 = await ar2.json();
          var rs = (d2 && d2.results) || [];
          for (var z = 0; z < rs.length; z++) {
            var blob = String((rs[z] && rs[z].title) || '') + ' ' + String((rs[z] && rs[z].body) || '');
            var lower = blob.toLowerCase();
            if (!tokens.some(function (t) { return lower.indexOf(t) !== -1; })) continue;
            var a2 = pickAddress(blob);
            if (a2) return a2.full;
          }
        } catch (e) { /* address stays empty */ }
        return '';
      }
      for (var i = 0; i < (urls || []).length; i++) {
        try {
          var text = await pageText(urls[i]);
          if (text == null) continue;
          var host = new URL(urls[i]).hostname;
          var c = pickContactForHost(text, host);
          if (!c) continue;
          // Email/address deepening: sites often publish phone in the header but
          // keep email + street address one page deeper. If the landing page
          // gave no email, try /contact and /contact-us on the SAME gated site
          // (max 2 extra fetches) and merge what they add.
          if (!c.email && !/contact/i.test(new URL(urls[i]).pathname)) {
            var origin = new URL(urls[i]).origin;
            var subs = ['/contact', '/contact-us'];
            for (var s2 = 0; s2 < subs.length && !c.email; s2++) {
              var t2 = await pageText(origin + subs[s2]);
              if (!t2) continue;
              var c2 = pickContactForHost(t2, host);
              if (c2) {
                c.email = c2.email || c.email;
                c.phone = c.phone || c2.phone;
                c.address = c.address || c2.address;
              }
            }
          }
          if (!c.address && api) c.address = await serpAddress();
          return { email: c.email, phone: c.phone, address: c.address || '', source: 'ddg-search', costCents: 0 };
        } catch (e) { /* next candidate */ }
      }
      return null;
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
      if (got.address && !lead.address) lead.address = got.address; // mailable street address (makeLead maps address -> notes)
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
  ddgTripped = false; // per-pull: give the direct-DDG fallback a fresh burst budget (breaker reset)
  if (ctx._ddgBudget == null) ctx._ddgBudget = (ctx.ddgMax != null ? ctx.ddgMax : 8); // bound the fetch-heavy ddg-search backend per pull
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
  _backendActive: backendActive,
  _ddgResultUrls: ddgResultUrls,
  _pickContactForHost: pickContactForHost,
  _orgTokens: orgTokens,
  _filterCandidateUrls: filterCandidateUrls,
  _pickAddress: pickAddress,
  _resetDdgBreaker: function () { ddgTripped = false; }
};
