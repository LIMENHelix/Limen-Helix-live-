#!/usr/bin/env node
/**
 * score-companies.js — Multi-source batch scoring pipeline for Command Board
 *
 * Sources:
 *   1. assets/data/company-index.json (LIMEN index)
 *   2. assets/data/sp500-ciks.json (S&P 500 subset)
 *   3. assets/data/entity-registry.json (entity CIKs, if available)
 *
 * Outputs: assets/data/command-board-data.json
 *
 * Usage: node scripts/score-companies.js
 *        node scripts/score-companies.js --metadata-only --ciks 901832,10456
 *        node scripts/score-companies.js --refresh-selected --ciks 31462,1805284
 *
 * Features:
 *   - Deduplicates by CIK across all sources
 *   - Resumes from existing output (only scores missing CIKs)
 *   - Rate-limited (300ms between API calls)
 *   - Retries once on timeout
 *   - Logs counts by source
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'assets', 'data');
const INDEX_PATH = path.join(DATA_DIR, 'company-index.json');
const SP500_PATH = path.join(DATA_DIR, 'sp500-ciks.json');
const ENTITY_PATH = path.join(DATA_DIR, 'entity-registry.json');
const OPERATOR_REFS_PATH = path.join(DATA_DIR, 'operator-references.json');
const HIST_DISTRESS_PATH = path.join(DATA_DIR, 'historical-distress-cohort.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'command-board-data.json');
const COMPANIES_DIR = path.join(DATA_DIR, 'companies');
const IDENTITY_REPAIRS_PATH = path.join(DATA_DIR, 'audit', 'sec-cik-identity-repairs.json');
const REFRESH_ERRORS = process.argv.includes('--refresh-errors');
const METADATA_ONLY = process.argv.includes('--metadata-only');
const REFRESH_SELECTED = process.argv.includes('--refresh-selected');
const ciksArgIndex = process.argv.indexOf('--ciks');
const METADATA_CIKS = new Set(
  ciksArgIndex >= 0 && process.argv[ciksArgIndex + 1]
    ? process.argv[ciksArgIndex + 1].split(',').map(normCik)
    : []
);

// Subcategory -> parent canonical domain mapping. Per memory
// limen_command_board_audit.md: the 20 canonical LIMEN domain ids are the
// invariant; subcategories like 'neurology' / 'addiction' / 'psychedelic'
// collapse to a parent ('medicine') for cross-domain coupling but the
// original is preserved on each row in `subTag` so per-subcategory rendering
// stays available.
const SUBCATEGORY_TO_PARENT = {
  neurology:    'medicine',
  addiction:    'medicine',
  psychedelic:  'medicine',
  metabolic:    'medicine',
  pediatric:    'medicine',
  health:       'medicine',
  contemplative:'religion',
  p2_agri:      'agriculture',
  legal:        'law',
  research:     'science',
  supplyChain:  'trade',
};

function canonicalizeDomain(rawDomain) {
  if (!rawDomain) return { domain: '', subTag: null };
  const parent = SUBCATEGORY_TO_PARENT[rawDomain];
  if (parent) return { domain: parent, subTag: rawDomain };
  return { domain: rawDomain, subTag: null };
}

function normCik(c) { return String(c == null ? '' : c).replace(/^0+/, '') || '0'; }

function loadIdentityRepairs() {
  const doc = JSON.parse(fs.readFileSync(IDENTITY_REPAIRS_PATH, 'utf8'));
  const repairs = doc.repairs || [];
  return {
    source: doc.authoritativeTickerSource,
    repairs,
    canonicalize(company) {
      const ticker = String(company.ticker || '').trim().toUpperCase();
      const cik = normCik(company.cik);
      const repair = repairs.find((entry) =>
        (entry.oldTickers || []).some((old) => String(old).toUpperCase() === ticker) &&
        (entry.oldCiks || []).some((old) => normCik(old) === cik)
      );
      if (!repair) {
        const canonical = repairs.find((entry) => normCik(entry.cik) === cik && String(entry.ticker).toUpperCase() === ticker);
        return { company, repair: canonical || null, changed: false };
      }
      return {
        company: { ...company, ticker: repair.ticker, cik: repair.cik },
        repair,
        changed: ticker !== String(repair.ticker).toUpperCase() || cik !== normCik(repair.cik)
      };
    }
  };
}

// Map normalized CIK -> canonical portal filename slug, scanned from the live
// portal corpus. The Command Board's `s` (slug) MUST equal the portal filename
// so company-portal.html?company=<s> resolves. Source-derived slugs (ticker /
// index / name) frequently do not match (e.g. 'mmm' vs '3m', 'acn' vs
// 'accenture', 'abbv' vs 'abbvie'), which silently broke every such
// company->portal link on the board. Resolving `s` against this map fixes the
// fractal company->portal join at the source.
function loadPortalSlugMap() {
  const map = {};
  if (!fs.existsSync(COMPANIES_DIR)) return map;
  const files = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), 'utf8'));
      if (p && p.cik) map[normCik(p.cik)] = p.slug || f.replace(/\.json$/, '');
    } catch (e) { /* skip unreadable portal */ }
  }
  return map;
}

// Validated kernel endpoint — sha256-locked limen_backtest.py
// (PR-AUC 0.8143/0.8288). The previous endpoint was a separate Vercel
// deployment with a different (unvalidated) kernel; this repoints the
// batch scorer at the same endpoint Helix Report calls so Command Board
// rows match the report verbatim.
const BASE_URL = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const API_URL = BASE_URL + '/api/limen/score';
const DELAY_MS = 300;
const TIMEOUT_MS = 60000;  // validated kernel SEC EDGAR fetch can be slow

const DOMAIN_STRESS = {
  energy:0.77, infrastructure:0.30, supplyChain:1.00, finance:0.44,
  law:0.50, industry:0.58, economy:0.13, environment:0.80,
  technology:0.51, defense:0.52, intelligence:0.51, health:0.65,
  communication:0.07, culture:0.30, religion:0.28, population:0.25,
  education:0.20, p2_agri:0.00, governance:0.32, trade:0.30,
  science:0.28, medicine:0.65, neurology:0.65, addiction:0.65,
  metabolic:0.65, pediatric:0.65, psychedelic:0.28, contemplative:0.20,
  legal:0.50
};

function postScore(cik, retries = 1) {
  const paddedCik = ('0000000000' + String(cik).replace(/^0+/, '')).slice(-10);
  const body = JSON.stringify({ cik: paddedCik });
  const u = new URL(API_URL);
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    path: u.pathname + u.search,
    port: u.port || 443,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'limen-batch-scorer'
    },
    timeout: TIMEOUT_MS
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 200)));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + e.message)); }
      });
    });
    req.on('error', (e) => {
      if (retries > 0) {
        console.log('    Retrying...');
        setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1000);
      } else { reject(e); }
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) {
        console.log('    Timeout, retrying...');
        setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1000);
      } else { reject(new Error('Timeout')); }
    });
    req.write(body);
    req.end();
  });
}

// Derive a single trajectory tag the Command Board can render, from the
// validated kernel's alert + pathway. Keeps Command Board's existing
// d.tr column compatible without inventing kernel state.
function deriveTrajectory(d) {
  if (!d) return 'NO_DATA';
  if (d.alert) {
    const path = d.pathway || '?';
    if (path.indexOf('C') !== -1) return 'RUPTURE';
    if (path.indexOf('A') !== -1) return 'UNRECOVERED_P3';
    if (path.indexOf('B') !== -1) return 'CASH_DECLINE';
    return 'ALERT';
  }
  return 'STABLE';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Source Loaders ──

function loadCompanyIndex() {
  if (!fs.existsSync(INDEX_PATH)) return [];
  const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const companies = idx.companies || {};
  const results = [];
  for (const [slug, co] of Object.entries(companies)) {
    const cik = co.cik || '';
    if (!cik || cik === '0') continue;
    if (!co.ticker || co.ticker.includes('-PRIV')) continue;
    results.push({ slug, name: co.name, ticker: co.ticker, cik, domain: co.domainId || '', source: 'company-index' });
  }
  return results;
}

function loadSP500() {
  if (!fs.existsSync(SP500_PATH)) return [];
  const sp = JSON.parse(fs.readFileSync(SP500_PATH, 'utf8'));
  return (sp.companies || []).map(co => ({
    slug: co.ticker.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: co.name, ticker: co.ticker, cik: co.cik,
    domain: co.domain || '', source: 'sp500'
  }));
}

function loadOperatorReferences() {
  // Companies cited in domain operator/opportunity files (industry-clarity-operator.js,
  // *-opportunities.html, etc.) that aren't in the reviewed company list. Generated
  // by scripts/extract-operator-ciks.js. Each row already carries a primary domain
  // inferred from the source-file name.
  if (!fs.existsSync(OPERATOR_REFS_PATH)) return [];
  try {
    const ref = JSON.parse(fs.readFileSync(OPERATOR_REFS_PATH, 'utf8'));
    return (ref.companies || []).map(co => ({
      slug: (co.ticker || co.cik).toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: co.name || co.ticker || ('CIK ' + co.cik),
      ticker: co.ticker || '',
      cik: co.cik,
      domain: co.domain || '',
      source: 'operator-references'
    }));
  } catch (e) { return []; }
}

function loadEntityRegistry() {
  if (!fs.existsSync(ENTITY_PATH)) return [];
  try {
    const reg = JSON.parse(fs.readFileSync(ENTITY_PATH, 'utf8'));
    const results = [];
    const domains = reg.domains || {};
    for (const domKey in domains) {
      const portals = domains[domKey].portals || {};
      for (const portalKey in portals) {
        const entities = portals[portalKey].entities || [];
        for (const ent of entities) {
          if (ent.cik && ent.ticker && ent.entityType === 'company') {
            results.push({
              slug: ent.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              name: ent.name, ticker: ent.ticker, cik: ent.cik,
              domain: ent.domainId || domKey, source: 'entity-registry'
            });
          }
        }
      }
    }
    return results;
  } catch (e) { return []; }
}

async function main() {
  // Load all sources
  const src1 = loadCompanyIndex();
  const src2 = loadSP500();
  const src3 = loadEntityRegistry();
  const src4 = loadOperatorReferences();

  console.log('Sources:');
  console.log('  company-index.json:    ' + src1.length + ' companies');
  console.log('  sp500-ciks.json:       ' + src2.length + ' companies');
  console.log('  entity-registry:       ' + src3.length + ' companies');
  console.log('  operator-references:   ' + src4.length + ' companies');

  // Merge and deduplicate by CIK
  const identity = loadIdentityRepairs();
  let identityCorrections = 0;
  let retiredExcluded = 0;
  const all = [...src1, ...src2, ...src3, ...src4].map((company) => {
    const result = identity.canonicalize(company);
    if (result.changed) identityCorrections++;
    return result;
  }).filter((result) => {
    if (result.repair && result.repair.status === 'retired') {
      retiredExcluded++;
      return false;
    }
    return true;
  }).map((result) => result.company);
  const seen = new Map();
  for (const co of all) {
    const key = normCik(co.cik);
    if (!seen.has(key)) {
      seen.set(key, co);
    }
  }
  const targets = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log('  Deduplicated total: ' + targets.length + ' unique CIKs');
  console.log('  Identity corrections: ' + identityCorrections + '; retired securities excluded: ' + retiredExcluded);

  // Canonical portal-slug map (cik -> portal filename slug). Used to set each
  // row's `s` so the Command Board's company->portal link resolves.
  const portalSlugByCik = loadPortalSlugMap();
  console.log('  portal slug map:    ' + Object.keys(portalSlugByCik).length + ' CIKs with a portal');

  // Load existing results for resume
  let existing = {};
  let previousOutput = null;
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      previousOutput = prev;
      (prev.companies || []).forEach(c => { existing[normCik(c.c)] = c; });
      console.log('  Existing results:   ' + Object.keys(existing).length + ' (will resume)');
    } catch (e) { console.log('  No valid existing results'); }
  }

  const results = [];
  let scored = 0, skipped = 0, errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const co = targets[i];

    // Resume: skip if already scored (but still correct the portal slug so
    // resumed rows link to their portal — see loadPortalSlugMap).
    const existingKey = normCik(co.cik);
    const selectedForRefresh = REFRESH_SELECTED && METADATA_CIKS.has(existingKey);
    if (existing[existingKey] && !(REFRESH_ERRORS && existing[existingKey].p === 'ERROR') && !selectedForRefresh) {
      const ex = existing[existingKey];
      const ps = portalSlugByCik[normCik(co.cik)];
      const canon = canonicalizeDomain(co.domain);
      const refreshMetadata = METADATA_CIKS.size === 0 || METADATA_CIKS.has(existingKey);
      if (refreshMetadata) {
        if (ps) ex.s = ps;
        ex.t = co.ticker;
        ex.c = co.cik;
        // Resume preserves measured kernel fields, but source-owned identity
        // and routing metadata must still refresh. Otherwise a corrected
        // source domain can never reach an already-scored Command Board row.
        ex.d = canon.domain;
        ex.subTag = canon.subTag;
        ex.ds = DOMAIN_STRESS[co.domain] || DOMAIN_STRESS[canon.domain] || 0.2;
      }
      results.push(ex);
      skipped++;
      continue;
    }

    // Metadata repair must never trigger a fresh SEC/kernel score. Existing
    // measured rows are retained above; unknown targets stay out of the file.
    if (METADATA_ONLY) continue;

    try {
      const d = await postScore(co.cik);
      const canon = canonicalizeDomain(co.domain);
      // Per-row ds prefers the original subcategory's hardcoded value (more
      // granular), falls back to the canonical parent, else 0.2.
      const ds = DOMAIN_STRESS[co.domain] || DOMAIN_STRESS[canon.domain] || 0.2;
      results.push({
        n: co.name, t: co.ticker, c: co.cik,
        s: portalSlugByCik[normCik(co.cik)] || co.slug, d: canon.domain,
        subTag: canon.subTag,
        p: d.dominant_phase || '?',
        tr: deriveTrajectory(d),
        co: d.composite_score || 0,
        a: d.alert || false,
        // Validated-kernel fields surfaced for the expand-row + Helix Report parity
        path: d.pathway || null,
        pa: d.path_a_score || 0,
        pb: d.path_b_score || 0,
        pc: d.path_c_score || 0,
        fq: d.first_alert_quarter || null,
        q:  d.latest_quarter || null,
        hist: d.history_quarters || 0,
        kid: d.kernel_id || 'limen_backtest.py',
        vs: d.validation_status || 'validated',
        ds: ds
      });
      scored++;
    } catch (e) {
      const canon = canonicalizeDomain(co.domain);
      const ds = DOMAIN_STRESS[co.domain] || DOMAIN_STRESS[canon.domain] || 0.2;
      results.push({
        n: co.name, t: co.ticker, c: co.cik,
        s: portalSlugByCik[normCik(co.cik)] || co.slug, d: canon.domain,
        subTag: canon.subTag,
        p: 'ERROR', tr: (e.message || '').substring(0, 50),
        co: 0, a: false,
        path: null, pa: 0, pb: 0, pc: 0,
        fq: null, q: null, hist: 0,
        kid: 'limen_backtest.py', vs: 'error',
        ds: ds
      });
      errors++;
    }

    if ((scored + errors) % 10 === 0 && (scored + errors) > 0) {
      console.log('  ' + (scored + errors + skipped) + '/' + targets.length + ' (' + scored + ' scored, ' + skipped + ' resumed, ' + errors + ' errors)');
    }
    await sleep(DELAY_MS);
  }

  // Merge historical-distress-cohort.json so P7a/P7b/P9 CIKs (filtered out
  // by the eligibility frontier due to weeks_since_latest > 26) actually
  // appear in command-board-data.json. Without this merge, polyvagal Pass 3A
  // and any consumer that reads peer-phase context never sees terminal-phase
  // peers — the most clinically interesting cohort is silently absent.
  let histAdded = 0;
  if (fs.existsSync(HIST_DISTRESS_PATH)) {
    try {
      const hd = JSON.parse(fs.readFileSync(HIST_DISTRESS_PATH, 'utf8'));
      const existing = new Set(results.map(r => String(r.c).replace(/^0+/, '')));
      for (const hc of (hd.companies || [])) {
        const cik = String(hc.c || '').replace(/^0+/, '');
        if (!cik || existing.has(cik)) continue;
        const canon = canonicalizeDomain(hc.d);
        const ds = DOMAIN_STRESS[hc.d] || DOMAIN_STRESS[canon.domain] || 0.2;
        results.push({
          n: hc.n, t: hc.t, c: hc.c,
          s: hc.t ? hc.t.toLowerCase().replace(/[^a-z0-9]/g, '_') : null,
          d: canon.domain,
          subTag: canon.subTag,
          p: hc.p || '?',
          tr: hc.tr || 'STABLE',
          co: hc.co || 0,
          a: hc.a || false,
          path: hc.pathway || null,
          pa: 0, pb: 0, pc: 0,
          fq: null,
          q: hc.q || null,
          hist: hc.hist || 0,
          kid: 'phase_engine.py',
          vs: 'experimental',
          ds: ds,
          source: hc.source || 'historical_fixture',
          eligibility_status_at_build: hc.eligibility_status_at_build || 'NOT_IN_FRONTIER'
        });
        histAdded++;
      }
      console.log('  Historical-distress merged: ' + histAdded + ' added (skipped duplicates)');
    } catch (e) {
      console.log('  Historical-distress merge failed: ' + e.message);
    }
  }

  // Derived mean_composite per canonical domain — companion to the hardcoded
  // DOMAIN_STRESS map. Per memory limen_command_board_audit.md the hardcoded
  // values should eventually be replaced by derived values; emitting both as
  // metadata lets cross-domain consumers pick. Per-row ds is unchanged to
  // preserve backward compat.
  const compositesByDomain = {};
  for (const r of results) {
    if (typeof r.co === 'number' && r.co > 0 && r.d) {
      (compositesByDomain[r.d] = compositesByDomain[r.d] || []).push(r.co);
    }
  }
  const derivedDsByDomain = {};
  for (const dom of Object.keys(compositesByDomain).sort()) {
    const arr = compositesByDomain[dom];
    derivedDsByDomain[dom] = {
      mean_composite: arr.reduce((s, v) => s + v, 0) / arr.length,
      n: arr.length
    };
  }

  // Write output
  const priorMetric = (key, current) =>
    METADATA_ONLY && previousOutput && previousOutput[key] !== undefined
      ? previousOutput[key]
      : current;
  const output = {
    _generated: new Date().toISOString(),
    _total: results.length,
    _scored: priorMetric('_scored', scored),
    _resumed: priorMetric('_resumed', skipped),
    _errors: priorMetric('_errors', errors),
    _historical_distress_added: histAdded,
    _sources: { companyIndex: src1.length, sp500: src2.length, entityRegistry: src3.length, operatorReferences: src4.length },
    _identity: {
      source: identity.source,
      repairRegistry: path.relative(DATA_DIR, IDENTITY_REPAIRS_PATH).replace(/\\/g, '/'),
      correctionsApplied: identityCorrections,
      retiredSecuritiesExcluded: retiredExcluded,
      refreshErrors: METADATA_ONLY && previousOutput?._identity
        ? previousOutput._identity.refreshErrors
        : REFRESH_ERRORS
    },
    _canonical_subcategory_map: SUBCATEGORY_TO_PARENT,
    _derived_ds_by_domain: derivedDsByDomain,
    companies: results
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  console.log('\nDone: ' + results.length + ' companies written to command-board-data.json');
  console.log('  Scored: ' + scored + ', Resumed: ' + skipped + ', Errors: ' + errors + ', HistoricalMerged: ' + histAdded);
  console.log('  File size: ' + (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1) + ' KB');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
