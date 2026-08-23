/**
 * Job 1 contract: the product vocabulary and the conceptual homology labels
 * coexist in one registry.  This test does not claim the homology is proven;
 * it prevents the two vocabularies from drifting or silently replacing one
 * another.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var spec = require('../lib/phase-spec.js');

var pass = 0, fail = 0;
function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

ok('eleven primary phase codes', spec.PHASES.length === 11, 'got ' + spec.PHASES.length);
ok('primary codes are unique', new Set(spec.PHASES.map(function (p) { return p.code; })).size === 11);
ok('P7a/P7b remain variants, not vector phases', !!spec.VARIANTS.p7a && !!spec.VARIANTS.p7b);
ok('P7a and P7b share P7 parent', spec.VARIANTS.p7a.parent === 'P7' && spec.VARIANTS.p7b.parent === 'P7');

spec.PHASES.forEach(function (p) {
  ok(p.code + ' has product title', typeof p.title === 'string' && p.title.length > 0);
  ok(p.code + ' has conceptual label', typeof p.neuralLabel === 'string' && p.neuralLabel.length > 0);
  ok(p.code + ' has conceptual evidence status', typeof p.conceptEvidence === 'string');
  ok(p.code + ' has alias array', Array.isArray(p.aliases));
  ok(p.code + ' resolves through get()', spec.get(p.code) === p);
});

ok('P7a resolves as a variant', spec.get('P7a') === spec.VARIANTS.p7a);
ok('P7b resolves as a variant', spec.get('P7b') === spec.VARIANTS.p7b);
ok('unknown code abstains', spec.get('PX') === null);

// The domain renderer consumes the generated browser copy. Load it as a real
// browser script and compare every canonical field that crosses that boundary.
var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'phase-registry.js'), 'utf8'), sandbox, { filename: 'phase-registry.js' });
var browser = sandbox.window.LIMEN_PHASE_REGISTRY;
ok('generated browser registry publishes', !!browser && browser.version === 1);
ok('browser primary count matches Node registry', browser && browser.primary.length === spec.PHASES.length);
spec.PHASES.forEach(function (p, i) {
  var b = browser && browser.primary[i];
  ok(p.code + ' browser copy matches canonical labels', b && b.code === p.code && b.title === p.title && b.neuralLabel === p.neuralLabel && b.conceptEvidence === p.conceptEvidence);
  ok(p.code + ' browser copy matches alert shape', browser && browser.shape[p.code.toLowerCase()] === spec.cadenceShape(p.code));
});
ok('browser variants preserve P7a/P7b', browser && browser.variants.p7a.parent === 'P7' && browser.variants.p7b.parent === 'P7');

var domainPages = [
  'agriculture.html', 'communication.html', 'defense.html', 'domain-front.html',
  'economy.html', 'education.html', 'environment.html', 'finance.html',
  'governance.html', 'industry.html', 'infrastructure.html', 'intelligence.html',
  'law.html', 'medicine.html', 'population.html', 'religion.html', 'science.html',
  'technology.html', 'trade.html'
];
domainPages.forEach(function (page) {
  var html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  var registryAt = html.indexOf('/assets/js/phase-registry.js');
  var offersAt = html.indexOf('/assets/js/domain-offers.js');
  ok(page + ' loads registry before offers', registryAt >= 0 && offersAt > registryAt);
});

console.log('\n' + pass + '/' + (pass + fail) + ' passed');
process.exitCode = fail ? 1 : 0;
