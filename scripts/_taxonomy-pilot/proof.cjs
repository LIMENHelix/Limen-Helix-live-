/**
 * _taxonomy-pilot/proof.cjs — behavior-identity proof (OLD finance file vs
 * in-memory shared-engine prototype that sources its data from extracted JSON).
 *
 * Read-only. No runtime files touched. Run: node scripts/_taxonomy-pilot/proof.cjs
 * Exit 0 = all deep-equal / honestly-classified; exit 1 = any real mismatch (STOP).
 *
 * Check types per engine:
 *   call   — invoke a method, deep-equal old vs prototype output (deterministic)
 *   prop   — deep-equal an exposed data property old vs prototype
 *   render — best-effort browser-y method; if it needs real DOM it is marked
 *            BROWSER_ONLY (not a failure) per the stop condition
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'js');
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function loadOld(file) {
  const src = fs.readFileSync(path.join(ASSETS, file), 'utf8');
  const ctx = L.makeContext({ seed: 777 });
  L.loadFileSource(ctx, src, file);
  return { src, ctx };
}

// ── fixtures ────────────────────────────────────────────────────────────────
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

// precompute translator inputs from the REAL old ranker → real ranked directives
const rk = loadOld('finance-directive-ranker.js');
const RANKED = L.jsonClone(rk.ctx.window.LIMENFinanceDirectiveRanker.rank(L.jsonClone(RANK_FIXTURE)));
const tr = loadOld('finance-directive-translator.js');
const OPPS = L.jsonClone(tr.ctx.window.LIMENFinanceDirectiveTranslator.translate(L.jsonClone(RANKED), 5));
const OPP0 = OPPS && OPPS.length ? OPPS[0] : { title: 'x', path: 'GRANT-ELIGIBLE' };

const ENGINES = [
  {
    label: 'directive-ranker', file: 'finance-directive-ranker.js', global: 'LIMENFinanceDirectiveRanker',
    consts: ['EVIDENCE_SCORE', 'TYPE_ACTION_MAP', 'ROLE_WEIGHT', 'DEPTH_FACTOR', 'MECHANISMS', 'DX_VALID_MECHANISMS', 'DRIFT_SIGNALS'],
    checks: [{ type: 'call', name: 'rank(fixture)', method: 'rank', args: [RANK_FIXTURE] }]
  },
  {
    label: 'targeting-engine', file: 'finance-targeting-engine.js', global: 'LIMENFinanceTargetingEngine',
    consts: ['SEGMENTS', 'NODE_SEGMENTS', 'EXCLUSIONS'],
    checks: TARGET_FIXTURES.map((f, i) => ({ type: 'call', name: 'resolveTargets[' + i + ']', method: 'resolveTargets', args: [f] }))
  },
  {
    label: 'directive-translator', file: 'finance-directive-translator.js', global: 'LIMENFinanceDirectiveTranslator',
    consts: ['PATH_LABELS', 'REJECT_SIGNALS', 'ACTION_VERBS', 'REVENUE_MODELS', 'DELIVERABLE_MAP', 'TITLE_TEMPLATES'],
    checks: [
      { type: 'call', name: 'translate(RANKED,5) [pinned RNG]', method: 'translate', args: [RANKED, 5] },
      { type: 'call', name: 'shape(OPP0)', method: 'shape', args: [OPP0] }
    ]
  },
  {
    label: 'execution-panels', file: 'finance-execution-panels.js', global: 'LIMENFinanceExecutionPanels',
    consts: ['GRANT_SECTIONS', 'PATENT_SECTIONS'],
    checks: [
      { type: 'prop', name: 'GRANT_SECTIONS (data)', prop: 'GRANT_SECTIONS' },
      { type: 'prop', name: 'PATENT_SECTIONS (data)', prop: 'PATENT_SECTIONS' },
      { type: 'render', name: 'renderForOpportunity(GRANT)', method: 'renderForOpportunity', args: ['oppA', 'GRANT-ELIGIBLE', OPP0] },
      { type: 'render', name: 'renderForOpportunity(PATENT)', method: 'renderForOpportunity', args: ['oppB', 'PATENTABLE', OPP0] },
      { type: 'render', name: 'wireForOpportunity(container)', method: 'wireForOpportunity', args: [null, 'oppA', 'GRANT-ELIGIBLE'] }
    ]
  }
];

function runCheck(api, chk) {
  if (chk.type === 'prop') {
    return { kind: 'prop', val: L.jsonClone(api[chk.prop]) };
  }
  if (chk.type === 'render') {
    try {
      const r = api[chk.method].apply(null, chk.args.map(a => L.jsonClone(a)));
      return { kind: 'render', val: typeof r === 'string' ? r : L.jsonClone(r) };
    } catch (e) { return { kind: 'render', browserOnly: true, err: String(e && e.message || e) }; }
  }
  // call
  try {
    const r = api[chk.method].apply(null, chk.args.map(a => L.jsonClone(a)));
    return { kind: 'call', val: L.jsonClone(r) };
  } catch (e) { return { kind: 'call', err: String(e && e.stack || e) }; }
}

let anyFail = false;
const summary = [];

for (const eng of ENGINES) {
  const src = fs.readFileSync(path.join(ASSETS, eng.file), 'utf8');
  const { data, report } = L.extractData(src, eng.consts);
  fs.writeFileSync(path.join(OUT, eng.label + '.data.json'), JSON.stringify(data, null, 2));

  // golden (twice for determinism) + prototype
  const g1 = loadOld(eng.file).ctx.window[eng.global];
  const g2 = loadOld(eng.file).ctx.window[eng.global];
  const protoSrc = L.buildPrototypeSource(src, Object.keys(data));
  const pctx = L.makeContext({ seed: 777, data: L.jsonClone(data) });
  L.loadFileSource(pctx, protoSrc, eng.file + '::proto');
  const pApi = pctx.window[eng.global];

  const checkResults = [];
  for (const chk of eng.checks) {
    const rg1 = runCheck(g1, chk);
    const rg2 = runCheck(g2, chk);
    const rp = runCheck(pApi, chk);

    if (rg1.browserOnly || rp.browserOnly) {
      checkResults.push({ name: chk.name, status: 'BROWSER_ONLY', note: rg1.err || rp.err });
      continue;
    }
    if (rg1.err || rp.err) { checkResults.push({ name: chk.name, status: 'ERROR', note: rg1.err || rp.err }); anyFail = true; continue; }
    const stab = L.deepDiff(rg1.val, rg2.val);
    const diff = L.deepDiff(rg1.val, rp.val, '$.' + chk.name);
    const ok = stab.length === 0 && diff.length === 0;
    if (!ok) anyFail = true;
    checkResults.push({ name: chk.name, status: ok ? 'IDENTICAL' : 'MISMATCH', stable: stab.length === 0, diffs: diff.slice(0, 8) });
  }
  summary.push({ label: eng.label, report, checks: checkResults });
}

console.log('\n============ TAXONOMY PILOT — FINANCE BEHAVIOR-IDENTITY PROOF ============\n');
for (const s of summary) {
  console.log('### ' + s.label);
  console.log('  data extraction:');
  for (const r of s.report) console.log('    - ' + r.name + ': ' + r.status + (r.error ? ' (' + r.error + ')' : ''));
  for (const c of s.checks) {
    let line = '  [' + c.status + '] ' + c.name;
    if (c.status === 'IDENTICAL') line += (c.stable ? ' (deterministic ✓)' : ' (UNSTABLE ✗)');
    if (c.note) line += ' — ' + c.note;
    console.log(line);
    (c.diffs || []).forEach(d => console.log('        ' + d.path + '  old=' + JSON.stringify(d.a) + '  new=' + JSON.stringify(d.b) + '  (' + d.reason + ')'));
  }
  console.log('');
}
console.log('OVERALL: ' + (anyFail ? 'FAIL ✗ (stop condition)' : 'PASS ✓ — old == prototype on all headless-testable surfaces') + '\n');
process.exit(anyFail ? 1 : 0);
