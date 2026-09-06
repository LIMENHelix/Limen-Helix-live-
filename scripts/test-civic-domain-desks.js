/**
 * test-civic-domain-desks.js — Civic four (intelligence, population, law,
 * governance) have a free desk plus Helix checkout CTAs. Soft 3, killswitch,
 * Homestead, Economy, and outflow rails stay untouched.
 *
 * RUN: node scripts/test-civic-domain-desks.js
 */
var fs = require('fs');
var path = require('path');
var catalog = require('../lib/offer-catalog');
var checkout = require('../handlers/checkout');
var intel = require('../handlers/intelligence-tools');
var pop = require('../handlers/population-tools');
var law = require('../handlers/law-tools');
var gov = require('../handlers/governance-tools');

var ROOT = path.join(__dirname, '..');
var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var intelligence = read('intelligence.html');
var population = read('population.html');
var lawHtml = read('law.html');
var governance = read('governance.html');
var culture = read('culture.html');
var religion = read('religion.html');
var education = read('education.html');
var economy = read('economy.html');
var gen = read('scripts/gen-domain-fronts.cjs');
var civic = read('assets/js/civic-desk.js');
var soft = read('assets/js/soft-desk.js');
var checkoutSrc = read('handlers/checkout.js');
var rail = read('lib/stripe-rail.js');

ok('intelligence p1/p2 sellable',
  !!(catalog.lookup('intelligence', 'p1') && catalog.lookup('intelligence', 'p2')
    && catalog.lookup('intelligence', 'p1').priceCents === 800
    && catalog.lookup('intelligence', 'p2').priceCents === 400));
ok('population p2/p5 sellable',
  !!(catalog.lookup('population', 'p2') && catalog.lookup('population', 'p5')
    && catalog.lookup('population', 'p2').priceCents === 400
    && catalog.lookup('population', 'p5').priceCents === 600));
ok('law p1/p2/p4/p8/p9/p10 still sellable',
  ['p1', 'p2', 'p4', 'p8', 'p9', 'p10'].every(function (r) { return !!catalog.lookup('law', r); }));
ok('governance p1/p2 sellable',
  !!(catalog.lookup('governance', 'p1') && catalog.lookup('governance', 'p2')
    && catalog.lookup('governance', 'p1').priceCents === 800
    && catalog.lookup('governance', 'p2').priceCents === 400));

ok('intelligence free OFAC desk', /id="intelDesk"/.test(intelligence) && /id="intelQ"/.test(intelligence));
ok('intelligence live OFAC meter', /id="intelMeter"/.test(intelligence) && /intelligence-tools/.test(intelligence));
ok('population free county desk', /id="popDesk"/.test(population) && /id="popZip"/.test(population) && /id="popFips"/.test(population));
ok('population live TFR meter', /id="popMeter"/.test(population) && /tool=meter/.test(population));
ok('law free Register desk', /id="lawDesk"/.test(lawHtml) && /id="lawQ"/.test(lawHtml) && /id="lawAgency"/.test(lawHtml));
ok('law live OFAC/KEV meters', /id="lawMeter"/.test(lawHtml) && /tool=meter/.test(lawHtml));
ok('governance free award desk', /id="govDesk"/.test(governance) && /id="govQ"/.test(governance) && /id="govUei"/.test(governance));
ok('governance live WGI meter', /id="govMeter"/.test(governance) && /tool=meter/.test(governance));

ok('intelligence checkout p1+p2',
  /\/api\/checkout\?start=1&amp;domain=intelligence&amp;rung=p2/.test(intelligence)
  && /\/api\/checkout\?start=1&amp;domain=intelligence&amp;rung=p1/.test(intelligence));
ok('population checkout p2+p5',
  /\/api\/checkout\?start=1&amp;domain=population&amp;rung=p2/.test(population)
  && /\/api\/checkout\?start=1&amp;domain=population&amp;rung=p5/.test(population));
ok('law checkout p1+p2 and kept rungs',
  /domain=law&amp;rung=p1/.test(lawHtml) && /domain=law&amp;rung=p2/.test(lawHtml)
  && /domain=law&amp;rung=p4/.test(lawHtml) && /domain=law&amp;rung=p8/.test(lawHtml)
  && /domain=law&amp;rung=p9/.test(lawHtml) && /domain=law&amp;rung=p10/.test(lawHtml));
ok('governance checkout p1+p2',
  /\/api\/checkout\?start=1&amp;domain=governance&amp;rung=p2/.test(governance)
  && /\/api\/checkout\?start=1&amp;domain=governance&amp;rung=p1/.test(governance));

ok('intelligence uses SKU name', /Your Screening List, Every Update/.test(intelligence));
ok('population uses SKU name', /Your Markets, Monthly/.test(population));
ok('law uses SKU name', /Your Sector.s Open Docket/.test(lawHtml));
ok('governance uses SKU name', /Public Money Where You Operate/.test(governance));

ok('intel/law/gov dropped ZIP theater',
  !/WHERE AMERICA IS MOVING/.test(intelligence + lawHtml + governance)
  && !/id="popSection"/.test(intelligence + lawHtml + governance)
  && !/Distressed homes/.test(intelligence + lawHtml + governance));
ok('population keeps ZIP hinge, drops real-estate theater',
  /id="popZip"/.test(population) && !/Distressed homes/.test(population)
  && !/iBuyers/.test(population) && !/homestead/i.test(population)
  && !/id="popSection"/.test(population));

ok('civic pages are not Domain Watch shells',
  !/id="title">Domain Watch</.test(intelligence + population + lawHtml + governance)
  && !/domain-front-app\.js/.test(intelligence + population + lawHtml + governance));
ok('civic pages are not a killswitch clone',
  !/killswitch/i.test(intelligence + population + lawHtml + governance)
  && !/We'll build your/.test(intelligence + population + lawHtml + governance));

ok('Soft 3 culture still has royalty desk + Watch p2',
  /id="royalty"/.test(culture) && /domain=culture&amp;rung=p2/.test(culture));
ok('Soft 3 religion still has 990 desk + Watch p2',
  /id="relDesk"/.test(religion) && /domain=religion&amp;rung=p2/.test(religion));
ok('Soft 3 education still has Scorecard desk + Watch p2',
  /id="eduDesk"/.test(education) && /domain=education&amp;rung=p2/.test(education));
ok('soft-desk.js comment still Soft-only',
  /culture, religion, education/.test(soft) && !/intelligence/.test(soft));
ok('economy still generated shell (Homestead/Economy work not touched)',
  /id="checkoutSection"/.test(economy) && /WHERE AMERICA IS MOVING/.test(economy));

ok('generator skips civic four',
  /PRODUCTIZED_FRONTS/.test(gen)
  && /'intelligence'/.test(gen) && /'population'/.test(gen)
  && /'law'/.test(gen) && /'governance'/.test(gen));
ok('civic-desk helper does not start Stripe',
  !/createSubscriptionCheckout/.test(civic) && /start=1/.test(civic));
ok('checkout start=1 still documented', /start=1/.test(checkoutSrc));
ok('stripe-rail still halts outflow', /never sends money on its own/.test(rail));
ok('no second Stripe account mentioned',
  !/second Stripe|new Stripe account|killswitch Stripe/i.test(
    intelligence + population + lawHtml + governance + civic));
ok('no secrets in civic files',
  !/sk_live|sk_test|STRIPE_SECRET|whsec_/.test(
    intelligence + population + lawHtml + governance + civic));

ok('OSINT / no surveillance copy on intelligence',
  /OSINT only/.test(intelligence) && /not person-level/.test(intelligence));
ok('aggregate-only copy on population', /Never re-identifies|county totals/i.test(population));
ok('not-legal-advice copy on law', /not legal advice/i.test(lawHtml));
ok('non-partisan / as-published copy on governance',
  /Non-partisan/.test(governance) && /as published/i.test(governance));

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = s || ''; }
  };
}
function fakeReq(url, query) {
  return { method: 'GET', url: url, query: query || {} };
}

(async function () {
  var r1 = mockRes();
  await intel(fakeReq('/api/intelligence-tools?tool=sdn&q=ab', { tool: 'sdn', q: 'ab' }), r1);
  var j1 = JSON.parse(r1.body || '{}');
  ok('intelligence short query refuses without OFAC fetch', j1.ok === false && /three/i.test(j1.reason || ''));

  var r2 = mockRes();
  await pop(fakeReq('/api/population-tools?tool=mig', { tool: 'mig' }), r2);
  var j2 = JSON.parse(r2.body || '{}');
  ok('population mig without ZIP/FIPS/name refuses', j2.ok === false && /ZIP|FIPS|county/i.test(j2.reason || ''));

  var r3 = mockRes();
  await law(fakeReq('/api/law-tools?tool=comments&q=ab', { tool: 'comments', q: 'ab' }), r3);
  var j3 = JSON.parse(r3.body || '{}');
  ok('law short topic without agency refuses', j3.ok === false && /three|agency/i.test(j3.reason || ''));

  var r4 = mockRes();
  await gov(fakeReq('/api/governance-tools?tool=entity&q=ab', { tool: 'entity', q: 'ab' }), r4);
  var j4 = JSON.parse(r4.body || '{}');
  ok('governance short entity refuses', j4.ok === false && /three/i.test(j4.reason || ''));

  var r5 = mockRes();
  await gov(fakeReq('/api/governance-tools?tool=uei&id=ABC', { tool: 'uei', id: 'ABC' }), r5);
  var j5 = JSON.parse(r5.body || '{}');
  ok('governance short UEI refuses', j5.ok === false && /twelve/i.test(j5.reason || ''));

  var res = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout' }, res);
  var j = JSON.parse(res.body);
  ok('GET /api/checkout without start still lists rungs', j.ok === true && Array.isArray(j.rungs) && j.count > 0);
  var civicRungs = (j.rungs || []).filter(function (r) {
    return (r.domain === 'intelligence' || r.domain === 'population'
      || r.domain === 'law' || r.domain === 'governance') && (r.rung === 'p2' || r.rung === 'p1');
  });
  ok('catalog probe includes civic p1/p2 rungs', civicRungs.length >= 7, 'got ' + civicRungs.length);

  var res2 = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout?start=1&domain=intelligence&rung=p2' }, res2);
  var jStart = {};
  try { jStart = JSON.parse(res2.body || '{}'); } catch (e) { jStart = {}; }
  ok('GET start=1 intelligence without Stripe key refuses closed', res2.statusCode === 503 && jStart.enabled === false);

  var res3 = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout?start=1&domain=not-a-domain&rung=p2' }, res3);
  var jBad = {};
  try { jBad = JSON.parse(res3.body || '{}'); } catch (e) { jBad = {}; }
  ok('GET start=1 unknown domain is rejected', res3.statusCode === 400 && /not a plan/i.test(jBad.error || ''));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
