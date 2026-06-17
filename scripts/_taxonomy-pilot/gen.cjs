/**
 * _taxonomy-pilot/gen.cjs — generate the finance shared-engine pilot artifacts by
 * MECHANICAL source-transform of the OLD finance files (read from git HEAD, so this
 * is idempotent/re-runnable). Functions stay byte-identical; only:
 *   - top-level pure-data consts  → read from the factory's __DATA param
 *   - the IIFE wrapper            → a `window.LIMENTaxonomy.makeX(__DATA[,ctx])` factory
 *   - the global registration     → `return {...}`
 *   - (promotion-bridge only) sibling-global lookups + 'finance' literal → ctx-parameterized
 *
 * Writes: assets/js/domain-taxonomy/shared-*.js, finance-taxonomy-data.js,
 *         and overwrites the 4 finance files with thin shims.
 * Run: node scripts/_taxonomy-pilot/gen.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const L = require('./lib.cjs');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets', 'js');
const TAXDIR = path.join(ASSETS, 'domain-taxonomy');
if (!fs.existsSync(TAXDIR)) fs.mkdirSync(TAXDIR, { recursive: true });

function oldSource(file) {
  return cp.execSync('git show HEAD:assets/js/' + file, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const ENGINES = [
  { file: 'finance-directive-ranker.js', make: 'makeDirectiveRanker', dataKey: 'directiveRanker', global: 'LIMENFinanceDirectiveRanker',
    consts: ['EVIDENCE_SCORE', 'TYPE_ACTION_MAP', 'ROLE_WEIGHT', 'DEPTH_FACTOR', 'MECHANISMS', 'DX_VALID_MECHANISMS', 'DRIFT_SIGNALS'], params: '__DATA' },
  { file: 'finance-targeting-engine.js', make: 'makeTargetingEngine', dataKey: 'targetingEngine', global: 'LIMENFinanceTargetingEngine',
    consts: ['SEGMENTS', 'NODE_SEGMENTS', 'EXCLUSIONS'], params: '__DATA' },
  { file: 'finance-directive-translator.js', make: 'makeDirectiveTranslator', dataKey: 'directiveTranslator', global: 'LIMENFinanceDirectiveTranslator',
    consts: ['PATH_LABELS', 'REJECT_SIGNALS', 'ACTION_VERBS', 'REVENUE_MODELS', 'DELIVERABLE_MAP', 'TITLE_TEMPLATES'], params: '__DATA' },
  { file: 'finance-promotion-bridge.js', make: 'makePromotionBridge', dataKey: 'promotionBridge', global: 'LIMENFinancePromotionBridge',
    consts: [], params: '__DATA, ctx', extra: [
      ['window.LIMENFinanceDirectiveExtractor', "window['LIMEN' + ctx.globalName + 'DirectiveExtractor']"],
      ['window.LIMENFinanceDirectiveRanker', "window['LIMEN' + ctx.globalName + 'DirectiveRanker']"],
      ['window.LIMENFinanceDirectiveTranslator', "window['LIMEN' + ctx.globalName + 'DirectiveTranslator']"],
      ['window.LIMENFinanceTargetingEngine', "window['LIMEN' + ctx.globalName + 'TargetingEngine']"],
      ["\n      'finance',", "\n      ctx.domain,"],          // _computeSignature domain tag (line 55)
      ["|| 'finance')", '|| ctx.domain)']                     // overlay-id fallback (line 305)
    ] }
];

function genShared(eng) {
  let src = oldSource(eng.file);
  const { data } = L.extractData(src, eng.consts);
  // 1. data consts -> __DATA["NAME"]
  src = L.buildPrototypeSource(src, Object.keys(data));
  // 2. promotion-bridge sibling/domain parameterization (BEFORE reg rewrite)
  if (eng.extra) for (const [a, b] of eng.extra) {
    if (src.indexOf(a) === -1) throw new Error(eng.file + ': extra target not found: ' + a);
    src = src.split(a).join(b);
  }
  // 3. wrapper open (first occurrence of the IIFE)
  const openOld = '(function () {';
  const oi = src.indexOf(openOld);
  if (oi === -1) throw new Error(eng.file + ': IIFE open not found');
  const openNew = '(function () { window.LIMENTaxonomy = window.LIMENTaxonomy || {}; window.LIMENTaxonomy.' + eng.make + ' = function (' + eng.params + ') {';
  src = src.slice(0, oi) + openNew + src.slice(oi + openOld.length);
  // 4. registration -> return
  const regLHS = 'window.' + eng.global + ' = ';
  const ri = src.indexOf(regLHS);
  if (ri === -1) throw new Error(eng.file + ': registration not found');
  src = src.slice(0, ri) + 'return ' + src.slice(ri + regLHS.length);
  // 5. wrapper close (last `})();`) -> close factory fn then IIFE
  const closeOld = '})();';
  const ci = src.lastIndexOf(closeOld);
  if (ci === -1) throw new Error(eng.file + ': IIFE close not found');
  src = src.slice(0, ci) + '}; })();' + src.slice(ci + closeOld.length);

  const banner = '/* AUTO-GENERATED shared taxonomy engine (C6 finance pilot, gen.cjs).\n'
    + ' * Functions are byte-identical to the original ' + eng.file + '; data comes from the\n'
    + ' * factory __DATA param. Registers window.LIMENTaxonomy.' + eng.make + '. */\n';
  return { shared: banner + src, data };
}

const financeData = {};
const sharedFiles = {
  'finance-directive-ranker.js': 'shared-directive-ranker.js',
  'finance-targeting-engine.js': 'shared-targeting-engine.js',
  'finance-directive-translator.js': 'shared-directive-translator.js',
  'finance-promotion-bridge.js': 'shared-promotion-bridge.js'
};

for (const eng of ENGINES) {
  const { shared, data } = genShared(eng);
  fs.writeFileSync(path.join(TAXDIR, sharedFiles[eng.file]), shared);
  financeData[eng.dataKey] = data;
  console.log('wrote shared/' + sharedFiles[eng.file] + '  (consts: ' + Object.keys(data).join(', ') + ')');
}

// finance data module (JS, loads synchronously via <script> — preserves load-order contract)
const dataFile = '/* AUTO-GENERATED finance taxonomy data (C6 pilot, gen.cjs). Extracted verbatim\n'
  + ' * from the original finance engine constants. Loaded before the shims. */\n'
  + 'window.LIMENTaxData = window.LIMENTaxData || {};\n'
  + 'window.LIMENTaxData.finance = ' + JSON.stringify(financeData, null, 2) + ';\n';
fs.writeFileSync(path.join(TAXDIR, 'finance-taxonomy-data.js'), dataFile);
console.log('wrote finance-taxonomy-data.js');

// thin shims (overwrite the 4 finance files; original logic preserved in git HEAD + shared engines)
function shim(eng) {
  const dep = 'window.LIMENTaxonomy.' + eng.make;
  const call = eng.params.indexOf('ctx') !== -1
    ? dep + '(D.' + eng.dataKey + " || {}, { domain: 'finance', globalName: 'Finance' })"
    : dep + '(D.' + eng.dataKey + ')';
  return '/* ' + eng.file + ' — thin compatibility shim (C6 finance pilot).\n'
    + ' * Real logic: assets/js/domain-taxonomy/' + sharedFiles[eng.file] + '\n'
    + ' * Data:       assets/js/domain-taxonomy/finance-taxonomy-data.js\n'
    + ' * Preserves window.' + eng.global + ' with identical surface. */\n'
    + '(function () {\n'
    + "  'use strict';\n"
    + '  var T = window.LIMENTaxonomy, D = window.LIMENTaxData && window.LIMENTaxData.finance;\n'
    + '  if (!T || !T.' + eng.make + ' || !D) { console.warn(\'[' + eng.file + '] shared taxonomy engine/data not loaded\'); return; }\n'
    + '  window.' + eng.global + ' = ' + call + ';\n'
    + '})();\n';
}
for (const eng of ENGINES) {
  fs.writeFileSync(path.join(ASSETS, eng.file), shim(eng));
  console.log('shimmed ' + eng.file);
}
console.log('\nDONE. Now wire finance-brain.js loader + run verify-pilot.cjs.');
