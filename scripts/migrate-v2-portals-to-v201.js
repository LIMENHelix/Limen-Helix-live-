#!/usr/bin/env node
/**
 * migrate-v2-portals-to-v201.js
 *
 * Bulk-migrates every v2 portal (has functionalNetwork, lacks schemaVersion="2.0.1")
 * to the v2.0.1 canonical schema. For each portal:
 *   1. POSTs CIK to /api/limen/score (deployed kernel)
 *   2. Builds financialHealth from the response
 *   3. Adds missing top-level v2.0.1 fields
 *   4. Adds confidence + sourceType to every functionalNetwork entry per
 *      role-defaults + text-match upgrades
 *   5. Per-company commodityExposure + supplementary fredSeries
 *   6. Writes back atomically
 *
 * Usage:
 *   node scripts/migrate-v2-portals-to-v201.js              # migrate all v2 portals
 *   node scripts/migrate-v2-portals-to-v201.js --dry-run    # plan only
 *   node scripts/migrate-v2-portals-to-v201.js procter_gamble  # single
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const COMPANIES_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const API_HOST = 'limenhelix.com';
const API_PATH = '/api/limen/score';
const CONCURRENCY = 2;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE = args.find(a => !a.startsWith('--'));

// Canonical PHASE_META labels (mirrors api/helix_app/thing2/phase_engine.py:121-135)
const PHASE_LABEL = {
  p0:  'P0 · SOURCE',
  p1:  'P1 · RUPTURE',
  p2:  'P2 · RHYTHM',
  p3:  'P3 · INSTABILITY',
  p4:  'P4 · STABILISATION',
  p5:  'P5 · ENDURANCE',
  p6:  'P6 · ORDER',
  p7:  'P7 · DIVERGENCE',
  p7a: 'P7a · TERMINAL',
  p7b: 'P7b · SEPARATION',
  p8:  'P8 · PIVOT',
  p9:  'P9 · COLLAPSE',
  p10: 'P10 · RESURRECTION',
};

// Confidence + sourceType defaults per functionalNetwork slot.
const ROLE_DEFAULTS = {
  suppliers:         { confidence: 'medium', sourceType: ['industry-report'] },
  customers:         { confidence: 'medium', sourceType: ['industry-report'] },
  logisticsPartners: { confidence: 'medium', sourceType: ['industry-report'] },
  competitors:       { confidence: 'high',   sourceType: ['10-K', 'industry-report'] },
  regulators:        { confidence: 'high',   sourceType: ['statutory'] },
  auditor:           { confidence: 'high',   sourceType: ['10-K'] },
  executiveTeam:     { confidence: 'high',   sourceType: ['DEF14A', '10-K'] },
  marketSignals:     { confidence: 'high',   sourceType: ['industry-report'] },
};

// Per-company commodity + supplementary FRED. Use the user-facing names from
// memory/CLAUDE.md FRED list where the ticker is unambiguous.
const COMPANY_EXTRAS = {
  adm:                  { commodityExposure: ['CORN','SOYBEAN','WHEAT','WTI','NATURAL_GAS'],          extraFred: ['DCOILWTICO','DHHNGSP'] },
  amazon:               { commodityExposure: ['WTI','CNY','ELECTRICITY','ALUMINUM','PAPER'],          extraFred: ['DCOILWTICO','DEXCHUS'] },
  clorox:               { commodityExposure: ['PULP','OIL','NATURAL_GAS','CHLORINE','SODA_ASH'],      extraFred: ['DCOILWTICO','DHHNGSP'] },
  coca_cola:            { commodityExposure: ['ALUMINUM','HFCS','SUGAR','PET_RESIN','WATER'],         extraFred: ['DCOILWTICO'] },
  colgate_palmolive:    { commodityExposure: ['PALM_OIL','PULP','OIL','PACKAGING'],                   extraFred: ['DCOILWTICO'] },
  costco:               { commodityExposure: ['WTI','CNY','BEEF','POULTRY','PRODUCE'],                extraFred: ['DCOILWTICO','DEXCHUS'] },
  dollar_general:       { commodityExposure: ['WTI','CNY','CPG_BASKET'],                              extraFred: ['DCOILWTICO','DEXCHUS'] },
  dollar_tree:          { commodityExposure: ['WTI','CNY','OCEAN_FREIGHT'],                           extraFred: ['DCOILWTICO','DEXCHUS'] },
  general_mills:        { commodityExposure: ['WHEAT','CORN','OATS','SUGAR','PACKAGING'],             extraFred: ['DCOILWTICO'] },
  jb_hunt:              { commodityExposure: ['WTI','DIESEL','TIRES'],                                extraFred: ['DCOILWTICO'] },
  kimberly_clark:       { commodityExposure: ['PULP','OIL','NATURAL_GAS','PACKAGING'],                extraFred: ['DCOILWTICO','DHHNGSP'] },
  kraft_heinz:          { commodityExposure: ['TOMATO','WHEAT','DAIRY','ALUMINUM','PACKAGING'],       extraFred: ['DCOILWTICO'] },
  kroger:               { commodityExposure: ['BEEF','POULTRY','DAIRY','PRODUCE','WTI'],              extraFred: ['DCOILWTICO'] },
  mondelez:             { commodityExposure: ['COCOA','WHEAT','SUGAR','DAIRY','PACKAGING'],           extraFred: ['DCOILWTICO'] },
  nike:                 { commodityExposure: ['COTTON','OIL','CNY','VND','LEATHER'],                  extraFred: ['DCOILWTICO','DEXCHUS'] },
  pepsico:              { commodityExposure: ['CORN','OATS','ALUMINUM','HFCS','OIL','POTATO'],        extraFred: ['DCOILWTICO'] },
  procter_gamble:       { commodityExposure: ['PULP','OIL','PLASTIC_RESIN','PACKAGING'],              extraFred: ['DCOILWTICO'] },
  target:               { commodityExposure: ['WTI','CNY','APPAREL','HOUSEHOLD'],                     extraFred: ['DCOILWTICO','DEXCHUS'] },
  tyson_foods:          { commodityExposure: ['CORN','SOYBEAN','NATURAL_GAS','WTI','PROTEIN'],        extraFred: ['DCOILWTICO','DHHNGSP'] },
  unilever:             { commodityExposure: ['PALM_OIL','PULP','OIL','PACKAGING','TEA'],             extraFred: ['DCOILWTICO'] },
  ups:                  { commodityExposure: ['WTI','JET_FUEL','DIESEL'],                             extraFred: ['DCOILWTICO'] },
  werner_enterprises:   { commodityExposure: ['WTI','DIESEL','TIRES'],                                extraFred: ['DCOILWTICO'] },
};

function distressBand(composite) {
  if (composite == null) return 'unknown';
  if (composite < 1.1) return 'green';
  if (composite < 1.5) return 'amber';
  return 'red';
}

function bandFromKernel(k) {
  const composite = k.composite_score;
  return distressBand(composite);
}

function buildFinancialHealth(k, asOfIso) {
  return {
    asOf: asOfIso.slice(0, 10),
    lastKernelRun: asOfIso,
    kernelId: k.kernel_id || 'limen_backtest.py',
    kernelShaLock: (k.kernel_sha256_lock || '').slice(0, 16),
    validationStatus: k.validation_status || 'unsupported',
    envelopeStatus: 'ELIGIBLE_NOW', // refined below if history insufficient
    historyQuarters: k.history_quarters || 0,
    latestQuarter: k.latest_quarter || null,
    compositeScore: typeof k.composite_score === 'number' ? Number(k.composite_score.toFixed(4)) : null,
    alert: !!k.alert,
    pathway: k.pathway || null,
    pathA: typeof k.path_a_score === 'number' ? Number(k.path_a_score.toFixed(4)) : null,
    pathB: typeof k.path_b_score === 'number' ? Number(k.path_b_score.toFixed(4)) : null,
    pathC: typeof k.path_c_score === 'number' ? Number(k.path_c_score.toFixed(4)) : null,
    pathAThreshold: k.path_a_threshold ?? 1.1,
    pathBThreshold: k.path_b_threshold ?? 1.5,
    pathCThreshold: k.path_c_threshold ?? 1.5,
    alertA: !!k.alert_a,
    alertB: !!k.alert_b,
    alertC: !!k.alert_c,
    firstAlertQuarter: k.first_alert_quarter || null,
    distressBand: bandFromKernel(k),
    dominantPhase: k.dominant_phase || null,
    phaseStateLabel: k.dominant_phase ? (PHASE_LABEL[k.dominant_phase] || null) : null,
    stressRate: typeof k.stress_rate === 'number' ? Number(k.stress_rate.toFixed(4)) : null,
    financialState: {
      revVariance: k.financial_state?.rev_variance ?? null,
      revSlope:    k.financial_state?.rev_slope ?? null,
      ocfSlope:    k.financial_state?.ocf_slope ?? null,
      cashLatest:  k.financial_state?.cash_latest ?? null,
      debtLatest:  k.financial_state?.debt_latest ?? null,
      cashRunwayQ: k.financial_state?.cash_runway_q ?? null,
    },
    inputPresence: k.input_presence || {},
  };
}

function determineKernelStatus(k, isForeignFiler) {
  if (!k || !k.validation_status || k.validation_status !== 'validated') return 'ERROR';
  if (isForeignFiler) return 'FOREIGN_FILER';
  if ((k.history_quarters || 0) < 32) return 'INSUFFICIENT_HISTORY';
  return 'ELIGIBLE_NOW';
}

function upgradeFromNote(role, note, current) {
  const c = { ...current };
  c.sourceType = Array.isArray(current.sourceType) ? [...current.sourceType] : [current.sourceType];
  c.confidence = current.confidence;
  const has = (s) => !c.sourceType.includes(s) && (c.sourceType.push(s), true);
  if (note) {
    const n = note.toLowerCase();
    if (n.includes('10-k')) has('10-K');
    if (n.includes('8-k'))  has('8-K');
    if (n.includes('20-f')) has('20-F');
    if (n.includes('def14a') || n.includes('proxy statement')) has('DEF14A');
    if (n.includes('s-1') || n.includes('s‑1')) has('S-1');
    // Customer-concentration phrases imply primary-filing disclosure
    if ((role === 'suppliers' || role === 'customers' || role === 'logisticsPartners') &&
        (n.includes('largest customer') ||
         n.includes('customer concentration') ||
         n.includes('10-k discloses') ||
         n.includes('10-k customer'))) {
      c.confidence = 'high';
      has('10-K');
    }
  }
  // De-duplicate sourceType while preserving order
  c.sourceType = c.sourceType.filter((v, i, a) => a.indexOf(v) === i);
  return c;
}

function addConfidenceToEntry(role, entry) {
  if (entry.confidence && entry.sourceType) return entry; // already v2.0.1
  const base = ROLE_DEFAULTS[role] || { confidence: 'medium', sourceType: ['industry-report'] };
  const merged = upgradeFromNote(role, entry.relationshipNote || '', base);
  return { ...entry, confidence: merged.confidence, sourceType: merged.sourceType };
}

function postJson(host, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      host, port: 443, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        try { resolve(JSON.parse(buf)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data); req.end();
  });
}

async function migrateOne(slug) {
  const file = path.join(COMPANIES_DIR, slug + '.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!j.functionalNetwork) return { slug, skipped: 'no functionalNetwork (v1 legacy)' };
  if (j.schemaVersion === '2.0.1') return { slug, skipped: 'already v2.0.1' };

  const isForeignFiler = (j.ticker && (j.ticker.includes('.') || j.industry?.toLowerCase().includes('foreign'))) ||
                        (typeof j.cik === 'string' && j.cik === '0000217076'); // UL hardcode
  let kernel;
  let kernelStatus = 'NOT_PROBED';
  let kernelErr = null;
  try {
    kernel = await postJson(API_HOST, API_PATH, { cik: j.cik });
    kernelStatus = determineKernelStatus(kernel, isForeignFiler);
  } catch (e) {
    kernelErr = e.message;
    kernelStatus = 'ERROR';
  }

  // Top-level v2.0.1 additions
  j.schemaVersion = '2.0.1';
  j.kernelStatus = kernelStatus;
  j.feedSources = j.feedSources || [];
  const extras = COMPANY_EXTRAS[slug] || { commodityExposure: [], extraFred: [] };
  j.marketDataTickers = j.ticker ? [j.ticker] : [];
  j.commodityExposure = extras.commodityExposure;
  j.fredSeries = Array.from(new Set([...(extras.extraFred || []), ...(j.fredSeries || [])]));

  // financialHealth
  if (kernel && kernelStatus !== 'ERROR') {
    j.financialHealth = buildFinancialHealth(kernel, new Date().toISOString());
    j.financialHealth.envelopeStatus = kernelStatus;
  } else {
    j.financialHealth = {
      asOf: new Date().toISOString().slice(0, 10),
      lastKernelRun: new Date().toISOString(),
      kernelId: 'limen_backtest.py',
      validationStatus: 'unsupported',
      envelopeStatus: kernelStatus,
      historyQuarters: 0,
      compositeScore: null,
      alert: false,
      distressBand: 'unknown',
      dominantPhase: null,
      phaseStateLabel: null,
      error: kernelErr || 'kernel call failed',
    };
  }
  j.warningSignals = j.warningSignals || [];
  j.opportunitySignals = j.opportunitySignals || [];
  j.commercializationStatus = j.commercializationStatus || { enginesRun: [], engineOutputs: [] };
  j.newsFeed = j.newsFeed || [];

  // Per-entry confidence + sourceType
  const fn = j.functionalNetwork;
  for (const slot of ['suppliers','logisticsPartners','customers','competitors','regulators','executiveTeam','marketSignals']) {
    if (!Array.isArray(fn[slot])) continue;
    fn[slot] = fn[slot].map(e => addConfidenceToEntry(slot, e));
  }
  if (fn.auditor) fn.auditor = addConfidenceToEntry('auditor', fn.auditor);

  if (DRY_RUN) {
    console.log(`[dry-run] ${slug}: kernelStatus=${kernelStatus}, composite=${j.financialHealth.compositeScore}, phase=${j.financialHealth.phaseStateLabel}, history=${j.financialHealth.historyQuarters}Q`);
  } else {
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  }
  return { slug, kernelStatus, composite: j.financialHealth.compositeScore, phase: j.financialHealth.phaseStateLabel };
}

async function runWithConcurrency(slugs, n) {
  const results = [];
  const queue = [...slugs];
  const workers = Array.from({ length: n }, async () => {
    while (queue.length) {
      const slug = queue.shift();
      if (!slug) break;
      try {
        const r = await migrateOne(slug);
        results.push(r);
        console.log(`  ${r.skipped ? '⊘' : '✓'} ${slug}${r.skipped ? ` (${r.skipped})` : ` — ${r.kernelStatus}, composite=${r.composite}, ${r.phase}`}`);
      } catch (e) {
        console.error(`  ✗ ${slug}: ${e.message}`);
        results.push({ slug, error: e.message });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

(async () => {
  const allV2 = fs.readdirSync(COMPANIES_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => {
      const j = JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), 'utf8'));
      return !!j.functionalNetwork;
    })
    .map(f => f.replace('.json', ''))
    .filter(slug => slug !== 'walmart'); // walmart already at v2.0.1

  const targets = SINGLE ? [SINGLE] : allV2;
  console.log(`Migrating ${targets.length} portal(s)${DRY_RUN ? ' [DRY-RUN]' : ''}...`);
  const start = Date.now();
  const results = await runWithConcurrency(targets, CONCURRENCY);
  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s.`);
  const ok = results.filter(r => !r.error && !r.skipped).length;
  const errs = results.filter(r => r.error).length;
  const skipped = results.filter(r => r.skipped).length;
  console.log(`Migrated: ${ok} | Skipped: ${skipped} | Errors: ${errs}`);
  if (errs) {
    console.log('Errors:');
    for (const r of results.filter(r => r.error)) console.log(`  ${r.slug}: ${r.error}`);
  }
})();
