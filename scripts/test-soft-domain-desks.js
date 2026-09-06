/**
 * test-soft-domain-desks.js — Soft three (culture, religion, education)
 * have a free desk plus a Helix checkout CTA, and nothing else was overwritten.
 */
var fs = require('fs');
var path = require('path');
var catalog = require('../lib/offer-catalog');
var checkout = require('../handlers/checkout');

var ROOT = path.join(__dirname, '..');
var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var culture = read('culture.html');
var religion = read('religion.html');
var education = read('education.html');
var economy = read('economy.html');
var finance = read('finance.html');
var gen = read('scripts/gen-domain-fronts.cjs');
var checkoutSrc = read('handlers/checkout.js');
var soft = read('assets/js/soft-desk.js');

ok('culture p2 is sellable', !!(catalog.lookup('culture', 'p2') && catalog.lookup('culture', 'p2').priceCents === 400));
ok('religion p2 is sellable', !!(catalog.lookup('religion', 'p2') && catalog.lookup('religion', 'p2').name.indexOf('Charities') !== -1));
ok('education p2 is sellable', !!(catalog.lookup('education', 'p2') && catalog.lookup('education', 'p2').name.indexOf('Shortlist') !== -1));

ok('culture free desk present', /id="royalty"/.test(culture) && /Show what I earn/.test(culture));
ok('religion free 990 desk present', /id="relDesk"/.test(religion) && /id="relQ"/.test(religion));
ok('education free Scorecard desk present', /id="eduDesk"/.test(education) && /id="eduQ"/.test(education));

ok('culture checkout CTA', /\/api\/checkout\?start=1&amp;domain=culture&amp;rung=p2/.test(culture));
ok('religion checkout CTA', /\/api\/checkout\?start=1&amp;domain=religion&amp;rung=p2/.test(religion));
ok('education checkout CTA', /\/api\/checkout\?start=1&amp;domain=education&amp;rung=p2/.test(education));

ok('culture uses SKU name', /Your Royalty and Audience Read/.test(culture));
ok('religion uses SKU name', /Your Charities, Each Filing/.test(religion));
ok('education uses SKU name', /Your Shortlist, Each Release/.test(education));

ok('religion is not the generic Domain Watch shell', !/id="title">Domain Watch</.test(religion) && !/WHERE AMERICA IS MOVING/.test(religion));
ok('education is not the generic Domain Watch shell', !/id="title">Domain Watch</.test(education) && !/WHERE AMERICA IS MOVING/.test(education));
ok('religion is not a killswitch clone', !/killswitch/i.test(religion) && !/We'll build your/.test(religion));
ok('education is not a killswitch clone', !/killswitch/i.test(education));
ok('culture is not a killswitch clone', !/killswitch/i.test(culture));

ok('culture Gazette link kept', /href="\/news"/.test(culture));
ok('religion Gazette link kept', /href="\/news"/.test(religion));
ok('education Gazette link kept', /href="\/news"/.test(education));

ok('culture result upgrade CTA', /id="royaltyUpgrade"/.test(culture) || /Watch this mix each month/.test(culture));
ok('religion result upgrade CTA', /id="relUpgrade"/.test(religion));
ok('education result upgrade CTA', /id="eduUpgrade"/.test(education));

ok('generator skips religion and education', /PRODUCTIZED_FRONTS/.test(gen) && /'religion'/.test(gen) && /'education'/.test(gen));
ok('checkout start=1 still documented', /start=1/.test(checkoutSrc));
ok('soft-desk helper does not start Stripe', !/createSubscriptionCheckout/.test(soft) && /start=1/.test(soft));

ok('other domain fronts untouched (economy still generated shell)', /id="checkoutSection"/.test(economy) && /WHERE AMERICA IS MOVING/.test(economy));
ok('other domain fronts untouched (finance still generated shell)', /id="checkoutSection"/.test(finance));
ok('no second Stripe account mentioned', !/second Stripe|new Stripe account|killswitch Stripe/i.test(culture + religion + education));

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = s || ''; }
  };
}

(async function () {
  var res = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout' }, res);
  var j = JSON.parse(res.body);
  ok('GET /api/checkout without start still lists rungs', j.ok === true && Array.isArray(j.rungs) && j.count > 0);
  var softRungs = (j.rungs || []).filter(function (r) {
    return (r.domain === 'culture' || r.domain === 'religion' || r.domain === 'education') && r.rung === 'p2';
  });
  ok('catalog probe includes the three Soft p2 rungs', softRungs.length === 3, 'got ' + softRungs.length);

  var res2 = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout?start=1&domain=religion&rung=p2' }, res2);
  var j2 = {};
  try { j2 = JSON.parse(res2.body || '{}'); } catch (e) { j2 = {}; }
  ok('GET start=1 without Stripe key refuses closed', res2.statusCode === 503 && j2.enabled === false);

  var res3 = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout?start=1&domain=not-a-domain&rung=p2' }, res3);
  var j3 = {};
  try { j3 = JSON.parse(res3.body || '{}'); } catch (e) { j3 = {}; }
  ok('GET start=1 unknown domain is rejected', res3.statusCode === 400 && /not a plan/i.test(j3.error || ''));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
