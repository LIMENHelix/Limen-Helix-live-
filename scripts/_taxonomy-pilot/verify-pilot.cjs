/**
 * _taxonomy-pilot/verify-pilot.cjs — regression gate for the finance shared-engine pilot.
 * Compares OLD behavior (git HEAD original files) vs the NEW chain (shared engine +
 * finance-taxonomy-data + thin shim) and asserts deep-equal output. Exit 1 on any diff.
 * Run AFTER gen.cjs. Run: node scripts/_taxonomy-pilot/verify-pilot.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const L = require('./lib.cjs');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets', 'js');
const head = (f) => cp.execSync('git show HEAD:assets/js/' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const wt = (rel) => fs.readFileSync(path.join(ASSETS, rel), 'utf8');

// fixtures (same as proof.cjs)
const RANK_FIXTURE = [
  { treatmentLabel: 'Credit underwriting tightening model', treatmentDescription: 'A deep structural treatment for credit contraction with lending and default exposure across the loan book and mortgage portfolio over eighty characters long.', nodeLabel: 'lending desk', treatmentTarget: 'credit risk', treatmentSteps: ['assess npl', 'model delinquency'], treatmentMonitoring: 'weekly', treatmentEscalation: 'board', treatmentCite: 'Basel III', diagnosisId: 'BANKING_CRISIS', circuitEvidence: 'Strong', treatmentEvidence: 'Moderate', treatmentType: 'STRUCTURAL', functionalRole: 'executor', stress: 0.8, depth: 2, branchRelevance: 0.5, companies: [{ name: 'JPMorgan', ticker: 'JPM', bindingStrength: 0.7 }, { name: 'Wells Fargo', ticker: 'WFC', bindingStrength: 0.5 }] },
  { treatmentLabel: 'Community equity program rollout', treatmentDescription: 'social program for stakeholder alignment and workforce development', nodeLabel: 'culture', treatmentTarget: '', treatmentSteps: [], diagnosisId: null, treatmentType: 'culture', functionalRole: 'stabilizer', stress: 0.1, depth: 0, companies: [] },
  { treatmentLabel: 'Liquidity stress diagnostic', treatmentDescription: 'short', nodeLabel: 'treasury', treatmentTarget: 'liquidity', treatmentSteps: ['measure margin'], diagnosisId: 'MARKET_CRASH', circuitEvidence: 'B', treatmentEvidence: 'C', treatmentType: 'DIAGNOSTIC', functionalRole: 'signal_detector', stress: 0.55, depth: 1, companies: [] },
  { treatmentLabel: 'Currency peg defense regulatory filing', treatmentDescription: 'currency fx devaluation peg reserves regulatory compliance enforcement with deep evidence and a long descriptive body exceeding eighty chars to set hasDescription.', nodeLabel: 'fx desk', treatmentTarget: 'currency stress', treatmentSteps: ['monitor reserves', 'file', 'escalate'], treatmentMonitoring: 'daily', treatmentCitation: ['IMF'], diagnosisId: 'CURRENCY_COLLAPSE', circuitEvidence: 'Emerging', treatmentEvidence: 'Strong', treatmentType: 'regulatory', functionalRole: 'gatekeeper', stress: 0.9, depth: 4, branchRelevance: 0.3, companies: [{ name: 'HSBC', ticker: 'HSBC', bindingStrength: 0.9 }] }
];
const TARGET_FIXTURES = [
  { title: 'credit underwriting model', diagnosisId: 'BANKING_CRISIS', path: 'INVESTABLE', examples: ['JPMorgan Chase (JPM)', 'Random Co (XYZ)'], _directive: { nodeId: 'NODE_LEND', nodeLabel: 'commercial lending', treatmentLabel: 'credit facility underwriting', companies: [{ name: 'Wells Fargo', ticker: 'WFC' }, { name: 'Citigroup', ticker: 'C' }] } },
  { title: 'reinsurance treaty design', diagnosisId: '', path: 'GRANT-ELIGIBLE', examples: [], _directive: { nodeId: '', nodeLabel: 'insurance claims and reinsurance', treatmentLabel: 'actuarial loss ratio model' } },
  null,
  { title: 'patent for fraud detection', diagnosisId: 'FRAUD_SCANDAL', path: 'PATENTABLE', examples: ['Goldman Sachs (GS)'] }
];

// precompute translator inputs from OLD ranker/translator (HEAD)
const rkCtx = L.makeContext({ seed: 777 }); L.loadFileSource(rkCtx, head('finance-directive-ranker.js'));
const RANKED = L.jsonClone(rkCtx.window.LIMENFinanceDirectiveRanker.rank(L.jsonClone(RANK_FIXTURE)));
const trCtx = L.makeContext({ seed: 777 }); L.loadFileSource(trCtx, head('finance-directive-translator.js'));
const OPPS = L.jsonClone(trCtx.window.LIMENFinanceDirectiveTranslator.translate(L.jsonClone(RANKED), 5));
const OPP0 = OPPS && OPPS.length ? OPPS[0] : { title: 'x', path: 'GRANT-ELIGIBLE' };

function loadOld(file) { const c = L.makeContext({ seed: 777 }); L.loadFileSource(c, head(file), file); return c; }
function loadNew(files) { const c = L.makeContext({ seed: 777 }); for (const f of files) L.loadFileSource(c, wt(f), f); return c; }

const results = [];
function record(name, golden, cand) {
  const d = L.deepDiff(golden, cand, '$.' + name);
  results.push({ name, ok: d.length === 0, diffs: d.slice(0, 6) });
}

// ── standalone engines ──
{ // ranker
  const g = loadOld('finance-directive-ranker.js').window.LIMENFinanceDirectiveRanker;
  const n = loadNew(['domain-taxonomy/shared-directive-ranker.js', 'domain-taxonomy/finance-taxonomy-data.js', 'finance-directive-ranker.js']).window.LIMENFinanceDirectiveRanker;
  record('ranker.rank', L.jsonClone(g.rank(L.jsonClone(RANK_FIXTURE))), L.jsonClone(n.rank(L.jsonClone(RANK_FIXTURE))));
}
{ // targeting
  const g = loadOld('finance-targeting-engine.js').window.LIMENFinanceTargetingEngine;
  const n = loadNew(['domain-taxonomy/shared-targeting-engine.js', 'domain-taxonomy/finance-taxonomy-data.js', 'finance-targeting-engine.js']).window.LIMENFinanceTargetingEngine;
  TARGET_FIXTURES.forEach((f, i) => record('targeting[' + i + ']', L.jsonClone(g.resolveTargets(L.jsonClone(f))), L.jsonClone(n.resolveTargets(L.jsonClone(f)))));
}
{ // translator (RNG pinned via seed 777 in both contexts)
  const g = loadOld('finance-directive-translator.js').window.LIMENFinanceDirectiveTranslator;
  const n = loadNew(['domain-taxonomy/shared-directive-translator.js', 'domain-taxonomy/finance-taxonomy-data.js', 'finance-directive-translator.js']).window.LIMENFinanceDirectiveTranslator;
  record('translator.translate', L.jsonClone(g.translate(L.jsonClone(RANKED), 5)), L.jsonClone(n.translate(L.jsonClone(RANKED), 5)));
  record('translator.shape', L.jsonClone(g.shape(L.jsonClone(OPP0))), L.jsonClone(n.shape(L.jsonClone(OPP0))));
}

// ── promotion-bridge: identical mock siblings for OLD and NEW; isolates orchestration ──
function installMocks(ctx) {
  const w = ctx.window;
  w.LIMENFinanceDirectiveExtractor = { extract: function () { return Promise.resolve([{ id: 'c1' }, { id: 'c2' }]); } };
  w.LIMENFinanceDirectiveRanker = { rank: function () {
    return [
      { treatmentLabel: 'Deep credit model', _richness: 0.7, proofScore: 0.6, depth: 3, rankScore: 0.5 },
      { treatmentLabel: 'Shallow item', _richness: 0.2, proofScore: 0.1, depth: 0, rankScore: 0.4 }
    ];
  } };
  w.LIMENFinanceDirectiveTranslator = {
    translate: function () {
      return [
        { title: 'Promote A', path: 'INVESTABLE', rank: 0.9, moneyChain: { target: 'old' }, _directive: { treatmentLabel: 'Deep credit model', nodeId: 'N1', portalDomainId: 'finance' }, steps: ['s1'], explain: 'e', diagnosisId: 'BANKING_CRISIS', id: 'oppA' },
        { title: 'Existing dup', path: 'GRANT-ELIGIBLE', rank: 0.5, _directive: { treatmentLabel: 'Dup', nodeId: 'N2' }, id: 'oppB' }
      ];
    },
    shape: function (p) { return p; }
  };
  w.LIMENFinanceTargetingEngine = { resolveTargets: function () {
    return { formatted: 'Banks; Funds', tier1: [{ name: 'JPMorgan', ticker: 'JPM' }], tier3: [{ name: 'Goldman', ticker: 'GS' }] };
  } };
}
async function promoteRun(ctx) {
  installMocks(ctx);
  const state = { diagnoses: [{ active: true, id: 'BANKING_CRISIS', circuits: [{ nodeId: 'N1' }] }], stress: 0.6, opportunities: [{ title: 'Existing dup', source: 'brain' }], treatments: [] };
  const out = await ctx.window.LIMENFinancePromotionBridge.promote(state, {}, { limit: 5 });
  return { promoted: L.jsonClone(out), state: L.jsonClone(state) };
}

(async function () {
  const gctx = loadOld('finance-promotion-bridge.js');
  const nctx = loadNew(['domain-taxonomy/shared-promotion-bridge.js', 'domain-taxonomy/finance-taxonomy-data.js', 'finance-promotion-bridge.js']);
  const g = await promoteRun(gctx);
  const n = await promoteRun(nctx);
  record('promotion.promoted', g.promoted, n.promoted);
  record('promotion.state', g.state, n.state);

  // report
  let fail = false;
  console.log('\n========== C6 FINANCE PILOT — OLD(HEAD) vs NEW(shared+data+shim) ==========\n');
  for (const r of results) {
    console.log('  [' + (r.ok ? 'IDENTICAL ✓' : 'MISMATCH ✗') + '] ' + r.name);
    if (!r.ok) { fail = true; r.diffs.forEach(d => console.log('       ' + d.path + '  old=' + JSON.stringify(d.a) + '  new=' + JSON.stringify(d.b) + '  (' + d.reason + ')')); }
  }
  console.log('\nOVERALL: ' + (fail ? 'FAIL ✗ — STOP' : 'PASS ✓ — new chain behavior-identical to old') + '\n');
  process.exit(fail ? 1 : 0);
})();
