/**
 * scripts/test-relay-firewall.js — Relay must not be able to break the rest of the system.
 * Run: node scripts/test-relay-firewall.js
 *
 * Relay lives inside the connectome and does transmit funds to the finance portal. This
 * file pins exactly how much else it may touch, so the coupling cannot widen quietly.
 * Every rule here exists because breaking it caused, or nearly caused, a real fault.
 *
 * THE FAULT THAT PROMPTED THIS: lib/relay-marketplace.js is named for Relay but is the
 * TRADE domain's auction store. handlers/trade-auction-cycle.js and trade-auction-recovery.js
 * pass it in as `marketplace`, and lib/trade-auction-observer.js verifies its own published
 * auctions by reading /api/relay-marketplace?action=list-listings and checking contentHash,
 * saleMode, bindingSaleAuthorized, orderAcceptanceAuthorized and paymentAuthorized. Adding
 * a customer-safe allow-list to that shared module dropped four of those five, which would
 * have made trade report PUBLIC_LISTING_ABSENCE_OR_MISMATCH_OBSERVED for every auction it
 * had just successfully published. A Relay feature silently breaking another domain.
 *
 *   F1  core Relay imports nothing outside its allow-list, and legacy coupling cannot grow
 *   F2  nothing outside Relay imports Relay's core
 *   F3  core Relay never touches lib/relay-marketplace
 *   F4  the trade domain's contract on that shared module is intact
 *   F5  Relay writes only to relay: db keys, in its own namespace
 *   F6  money crosses the seam in exactly one file, and only inbound
 *   F7  Relay needs exactly one route registration and already has it
 *   F8  the bridge fails soft on the ledger and hard on the charge
 */

const fs = require('fs');
const path = require('path');

let failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const ROOT = path.resolve(__dirname, '..');

/**
 * TWO GENERATIONS OF RELAY LIVE IN THIS REPO, and pretending otherwise would make this
 * file a lie.
 *
 *   CORE    the sourcing engine and storefront built on lib/relay-store. Firewalled: it
 *           may import Relay modules, node builtins, lib/limen-db (relay: keys only) and
 *           lib/relay-finance-bridge. Nothing else.
 *
 *   LEGACY  older surfaces sitting on lib/relay-marketplace (trade's store) or driving the
 *           standalone scraper libraries. They predate the firewall. They are PINNED here,
 *           and the test fails if the list GROWS, so this coupling can only ever shrink.
 */
const LEGACY = [
  'lib/relay-crypto-payout.js',
  'lib/relay-marketplace-scraper.js',
  'lib/relay-marketplace.js',
  'handlers/relay-csv-import.js',
  'handlers/relay-ebay-scraper.js',
  'handlers/relay-marketplace-checkout.js',
  'handlers/relay-marketplace-control.js',
  'handlers/relay-marketplace-page.js',
  'handlers/relay-marketplace-scraper.js',
  'handlers/relay-marketplace.js',
  'handlers/relay-stripe-webhook.js',
  'handlers/relay-vinted-scraper.js'
];
const LEGACY_SET = new Set(LEGACY);

function allRelayFiles() {
  const out = [];
  for (const dir of ['lib', 'handlers']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (/^relay.*\.js$/.test(f)) out.push(dir + '/' + f);
    }
  }
  return out.sort();
}

function requiresOf(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = [];
  const re = /require\(\s*'([^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function couplesOutward(rel) {
  return requiresOf(rel).some(function (d) {
    return /relay-marketplace$/.test(d) ||
           /stripe-rail|finance-ledger|capital-engine/.test(d) ||
           /(ebay|mercari|vinted|poshmark)-scraper/.test(d);
  });
}

const ALL = allRelayFiles();
const CORE = ALL.filter(function (r) { return !LEGACY_SET.has(r); });
console.log('Relay: ' + CORE.length + ' core files, ' + LEGACY.length + ' pinned legacy files');

// ── F1 ──────────────────────────────────────────────────────────────────────
console.log('F1: core Relay imports nothing outside its allow-list');
const ALLOWED_FOREIGN = new Set(['fs', 'path', 'crypto', 'node:crypto', 'node:fs', 'node:path']);
const violations = [];
for (const rel of CORE) {
  if (rel === 'lib/relay-finance-bridge.js') continue;   // the seam itself; F6 covers it
  for (const dep of requiresOf(rel)) {
    if (/relay/i.test(dep)) continue;
    if (ALLOWED_FOREIGN.has(dep)) continue;
    if (/limen-db$/.test(dep)) continue;
    violations.push(rel + ' -> ' + dep);
  }
}
assert('no core file imports a foreign subsystem', violations.length === 0, violations.join(', '));

const unpinned = ALL.filter(function (rel) {
  if (LEGACY_SET.has(rel)) return false;
  if (rel === 'lib/relay-finance-bridge.js') return false;
  return couplesOutward(rel);
});
assert('no NEW file joined the legacy coupling', unpinned.length === 0, unpinned.join(', '));

const shrunk = LEGACY.filter(function (rel) { return !fs.existsSync(path.join(ROOT, rel)); });
assert('pinned legacy list matches the tree', shrunk.length === 0,
  'these are pinned but gone, remove them from LEGACY: ' + shrunk.join(', '));

// ── F2 ──────────────────────────────────────────────────────────────────────
console.log('F2: nothing outside Relay imports a core Relay module');
const coreBasenames = CORE.map(function (r) { return path.basename(r, '.js'); });
const inbound = [];
function scan(dir) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + '/' + entry.name;
    if (entry.isDirectory()) {
      if (/node_modules|\.git|_wip-backup/.test(entry.name)) continue;
      scan(rel);
      continue;
    }
    if (!/\.(js|cjs)$/.test(entry.name)) continue;
    if (ALL.indexOf(rel) !== -1) continue;                 // Relay importing Relay
    if (rel === 'api/[...route].js') continue;             // the one door; F7 covers it
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const base of coreBasenames) {
      const pattern = new RegExp('require\\([^)]*[\'"][^\'"]*\\/' + base + '(\\.js)?[\'"]');
      if (pattern.test(src)) inbound.push(rel + ' imports ' + base);
    }
  }
}
['lib', 'handlers', 'api'].forEach(scan);
assert('no foreign file imports Relay core', inbound.length === 0, inbound.join(', '));

// ── F3 ──────────────────────────────────────────────────────────────────────
console.log('F3: core Relay does not touch the trade-shared marketplace module');
const touchesShared = CORE.filter(function (rel) {
  return requiresOf(rel).some(function (d) { return /relay-marketplace$/.test(d); });
});
assert('no core file requires lib/relay-marketplace', touchesShared.length === 0, touchesShared.join(', '));

// ── F4 ──────────────────────────────────────────────────────────────────────
console.log('F4: the trade domain\'s contract on the shared store is intact');
const sharedMarket = require('../lib/relay-marketplace.js');
assert('shared module still exports createListing', typeof sharedMarket.createListing === 'function');
const observerSrc = fs.readFileSync(path.join(ROOT, 'lib/trade-auction-observer.js'), 'utf8');
const marketSrc = fs.readFileSync(path.join(ROOT, 'lib/relay-marketplace.js'), 'utf8');
const REQUIRED_BY_TRADE = ['contentHash', 'saleMode', 'bindingSaleAuthorized', 'orderAcceptanceAuthorized', 'paymentAuthorized'];
REQUIRED_BY_TRADE.forEach(function (f) {
  assert('trade checks ' + f + ' and the shared listing carries it',
    observerSrc.indexOf(f) !== -1 && marketSrc.indexOf(f) !== -1);
});
assert('shared module exposes NO customer sanitiser (that belongs to Relay alone)',
  typeof sharedMarket.publicListing === 'undefined',
  'a publicListing on the shared module would strip fields trade needs');

// The endpoint trade reads must return rows unfiltered.
const sharedHandlerSrc = fs.readFileSync(path.join(ROOT, 'handlers/relay-marketplace.js'), 'utf8');
assert('list-listings still returns raw rows for trade',
  /listings:\s*listings\s*\}/.test(sharedHandlerSrc),
  'trade-auction-observer needs the unfiltered listing objects');

// ── F5 ──────────────────────────────────────────────────────────────────────
console.log('F5: Relay writes only to relay: db keys');
const badKeys = [];
for (const rel of CORE) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /\bdb\.(?:set|get|del|lpush|lrange|ltrim)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    if (!/^relay[:_]/.test(m[1])) badKeys.push(rel + ' -> ' + m[1]);
  }
}
assert('every literal db key is namespaced to relay', badKeys.length === 0, badKeys.join(', '));

const store = require('../lib/relay-store.js');
assert('Relay listings key does not collide with the shared store',
  store.LISTINGS_KEY === 'relay:store:listings', store.LISTINGS_KEY);
assert('Relay orders key does not collide with the shared store',
  store.ORDERS_KEY === 'relay:store:orders', store.ORDERS_KEY);
assert('the shared store still owns relay:listings',
  marketSrc.indexOf("'relay:listings'") !== -1);

// ── F6 ──────────────────────────────────────────────────────────────────────
console.log('F6: money crosses the seam in exactly one file, inbound only');
const moneyImporters = CORE.filter(function (rel) {
  return requiresOf(rel).some(function (d) { return /stripe-rail|finance-ledger|capital-engine/.test(d); });
});
assert('only relay-finance-bridge imports a money module',
  moneyImporters.length === 1 && /relay-finance-bridge/.test(moneyImporters[0]),
  moneyImporters.join(', '));

// Look for CALLS, not mentions: the bridge's own header names these to say it never uses
// them, so a plain substring search would flag its documentation.
const bridgeSrc = fs.readFileSync(path.join(ROOT, 'lib/relay-finance-bridge.js'), 'utf8');
assert('the bridge never proposes an outbound payment',
  !/\.\s*proposeFee\s*\(/.test(bridgeSrc) && !/\.\s*proposeLending\s*\(/.test(bridgeSrc));
assert('the bridge tags Relay income with one stream id',
  require('../lib/relay-finance-bridge.js').STREAM_ID === 'relay-order');

// ── F7 ──────────────────────────────────────────────────────────────────────
console.log('F7: Relay needs one route registration and already has it');
const routerSrc = fs.readFileSync(path.join(ROOT, 'api/[...route].js'), 'utf8');
assert("the 'relay' door is registered", /'relay':\s*require\('\.\.\/handlers\/relay'\)/.test(routerSrc));
const frontSrc = fs.readFileSync(path.join(ROOT, 'handlers/relay.js'), 'utf8');
['storefront', 'policy', 'autonomous-control', 'autonomous-scraper', 'cart-checkout', 'demand-search', 'demand-purchase']
  .forEach(function (v) {
    assert('the door can reach relay-' + v, frontSrc.indexOf('./relay-' + v) !== -1);
  });

// ── F9 ────────────────────────────────────────────────
// Every /api/relay* URL a Relay page or handler emits must actually resolve: either it
// is registered in the router, or it is a ?view= the front controller dispatches. The
// firewall means most new Relay handlers have NO route of their own, so a link written
// as /api/relay-<thing> is a 404 the moment it ships. That happened: the sale-terms
// link, the catalogue fetch and the cart checkout all pointed at unrouted paths.
console.log('F9: every URL Relay emits actually resolves');
const routed = new Set();
{
  const re = /'(relay[a-z0-9-]*)':\s*require/g;
  let m;
  while ((m = re.exec(routerSrc))) routed.add(m[1]);
}
const views = new Set();
{
  const re = /case '([a-z0-9-]+)':/g;
  let m;
  while ((m = re.exec(frontSrc))) views.add(m[1]);
}

const emitters = ALL.concat(['pages/relay-store.html', 'pages/relay.html', 'pages/relay-checkout.html'])
  .filter(function (f) { return fs.existsSync(path.join(ROOT, f)); });

const dead = [];
for (const rel of emitters) {
  // Live code only. A doc comment naming a path that was REMOVED (relay-autonomous-
  // fulfillment explains the dead /api/relay-fulfillment-record it used to call) must
  // not fail the build, or the fix becomes unexplainable.
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .split(/\r?\n/)
    .filter(function (line) { return !/^\s*(\*|\/\/|<!--)/.test(line); })
    .join('\n');
  const re = /\/api\/(relay[a-z0-9-]*)(\?view=([a-z-]+))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const view = m[3];
    if (name === 'relay') {
      // The one door. A ?view= must be one the controller knows.
      if (view && !views.has(view)) dead.push(rel + ' -> /api/relay?view=' + view + ' (no such view)');
      continue;
    }
    if (!routed.has(name)) dead.push(rel + ' -> /api/' + name + ' (not registered, not a view)');
  }
}
assert('no Relay URL points at an unrouted path', dead.length === 0, dead.join('; '));

// And the public front door must reach the storefront rather than a file that is not there.
const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const relayRewrite = (vercelCfg.rewrites || []).find(function (r) { return r.source === '/relay'; });
assert('/relay rewrites to the Relay door', !!relayRewrite && relayRewrite.destination === '/api/relay',
  relayRewrite ? relayRewrite.destination : 'no /relay rewrite');

// ── F8 ──────────────────────────────────────────────────────────────────────
console.log('F8: the bridge fails soft on the ledger, hard on the charge');
(async function () {
  const bridgePath = require.resolve('../lib/relay-finance-bridge.js');
  const ledgerPath = require.resolve('../lib/finance-ledger.js');
  const stripePath = require.resolve('../lib/stripe-rail.js');
  const realLedger = require('../lib/finance-ledger.js');
  const realStripe = require('../lib/stripe-rail.js');

  require.cache[ledgerPath].exports = { record: async function () { throw new Error('ledger down'); } };
  delete require.cache[bridgePath];
  const bridge = require('../lib/relay-finance-bridge.js');

  const r = await bridge.reportIncome({ amount: 60, orderId: 'o1' });
  assert('a dead ledger does not fail the sale', r.ok === true, JSON.stringify(r));
  assert('and the income is queued, not lost', r.recorded === false && r.queued === true, JSON.stringify(r));
  assert('the queue lives in Relay\'s own namespace', bridge.PENDING_KEY.indexOf('relay:') === 0, bridge.PENDING_KEY);
  assert('queue depth is readable', (await bridge.queueDepth()) >= 1);

  require.cache[ledgerPath].exports = { record: async function () { return true; } };
  const drained = await bridge.drainQueue(10);
  assert('recovery drains the queue', drained.ok === true && drained.drained >= 1, JSON.stringify(drained));
  assert('and the queue empties', (await bridge.queueDepth()) === 0);

  require.cache[stripePath].exports = {
    hasKey: function () { return true; },
    createPaymentLink: async function () { return { ok: false, error: 'card network down' }; }
  };
  delete require.cache[bridgePath];
  const bridge2 = require('../lib/relay-finance-bridge.js');
  const pay = await bridge2.createPayment({ amount: 60, orderId: 'o2' });
  assert('a failed charge is a HARD failure', pay.ok === false && /card network down/.test(pay.error), JSON.stringify(pay));
  const noOrder = await bridge2.createPayment({ amount: 60 });
  assert('a payment with no orderId is refused', noOrder.ok === false, JSON.stringify(noOrder));
  const zero = await bridge2.createPayment({ amount: 0, orderId: 'o3' });
  assert('a zero payment is refused', zero.ok === false, JSON.stringify(zero));

  require.cache[ledgerPath].exports = realLedger;
  require.cache[stripePath].exports = realStripe;

  console.log('');
  console.log(failures === 0
    ? 'FIREWALL INTACT (' + tests + ' assertions)'
    : failures + ' FAILED of ' + tests + ' assertions');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('HARNESS ERROR:', e && e.stack || e);
  process.exit(1);
});
