/**
 * scripts/gen-offer-catalog.cjs — generate lib/offer-catalog.js from the client offers file.
 *
 * WHY THIS EXISTS. The browser reads assets/js/domain-offers.js, but Vercel's function bundle
 * EXCLUDES assets/** (see vercel.json functions.excludeFiles), so a handler cannot require it.
 * The server therefore needs its own copy, and a hand-maintained second copy of a PRICE LIST
 * drifts, which means charging a number the page never showed.
 *
 * Generating it removes that class of bug: assets/js/domain-offers.js stays the single source
 * of truth, and this rewrites the server copy from it. Re-run after any price or copy change:
 *
 *     node scripts/gen-offer-catalog.cjs
 *
 * Note the server copy is authoritative for CHARGING regardless. A checkout never accepts a
 * price from the client; it looks the rung up here. Drift would be a display bug, not a way to
 * pay less than the sticker.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'assets', 'js', 'domain-offers.js');
var OUT = path.join(ROOT, 'lib', 'offer-catalog.js');

var ALL_DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy',
  'environment','finance','governance','industry','infrastructure','intelligence','law','medicine',
  'population','religion','science','technology','trade'];

// Run the browser IIFE against a stub window and read what it publishes.
var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'domain-offers.js' });

var api = sandbox.window.LIMEN_DOMAIN_OFFERS;
if (!api || typeof api.get !== 'function') {
  console.error('FAIL: domain-offers.js did not publish window.LIMEN_DOMAIN_OFFERS.get');
  process.exit(1);
}

// "from $3 / mo" -> 300. Refuse anything that is not a clean dollar figure rather than
// guessing, because the result of guessing here is a wrong charge.
function cents(priceStr) {
  var m = String(priceStr || '').match(/\$(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * 100);
}

var catalog = {};
var count = 0, rungs = 0;
ALL_DOMAINS.forEach(function (d) {
  var o = api.get(d);
  if (!o) return;
  var entry = { who: o.who, band: o.band, rungs: {} };
  ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'].forEach(function (k) {
    if (!o[k]) return;
    var c = cents(o[k].price);
    if (c === null) {
      console.error('FAIL: ' + d + '.' + k + ' has an unparseable price: ' + o[k].price);
      process.exit(1);
    }
    if (c < 50) {                       // Stripe's own floor for a USD charge
      console.error('FAIL: ' + d + '.' + k + ' is ' + c + ' cents, below the $0.50 minimum.');
      process.exit(1);
    }
    entry.rungs[k] = { name: o[k].name, line: o[k].line, cadence: o[k].cadence, priceCents: c };
    rungs++;
  });
  catalog[d] = entry;
  count++;
});

if (!count) { console.error('FAIL: no domains extracted.'); process.exit(1); }

var header = [
  '/**',
  ' * lib/offer-catalog.js — GENERATED. Do not edit by hand.',
  ' *',
  ' * Source of truth: assets/js/domain-offers.js',
  ' * Regenerate:     node scripts/gen-offer-catalog.cjs',
  ' *',
  ' * This is the AUTHORITATIVE price list for charging. A checkout never accepts a price from',
  ' * the browser; it looks the rung up here, so a tampered client can only ask for a rung that',
  ' * exists, never for a cheaper one. The browser copy in assets/ is display only, and Vercel',
  ' * excludes assets/** from the function bundle, which is why this file has to exist at all.',
  ' */',
  ''
].join('\n');

var body = 'var CATALOG = ' + JSON.stringify(catalog, null, 2) + ';\n\n' + [
  '/** Look up one purchasable rung. Returns null for anything not in the catalogue. */',
  'function lookup(domain, rung) {',
  '  var d = CATALOG[String(domain || "").toLowerCase()];',
  '  if (!d) return null;',
  '  var r = d.rungs[String(rung || "").toLowerCase()];',
  '  if (!r) return null;',
  '  return {',
  '    domain: String(domain).toLowerCase(), rung: String(rung).toLowerCase(),',
  '    name: r.name, line: r.line, cadence: r.cadence, priceCents: r.priceCents,',
  '    who: d.who, band: d.band',
  '  };',
  '}',
  '',
  'function domains() { return Object.keys(CATALOG); }',
  '',
  'module.exports = { CATALOG: CATALOG, lookup: lookup, domains: domains };',
  ''
].join('\n');

fs.writeFileSync(OUT, header + body, 'utf8');
console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + count + ' domains, ' + rungs + ' purchasable rungs');
