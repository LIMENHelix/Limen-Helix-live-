/**
 * test-homestead-mvp.js — Homestead Desk on Economy, Soft 3 untouched,
 * killswitch paths absent, $4 L1 still the live checkout.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var catalog = require('../lib/offer-catalog');
var checkout = require('../handlers/checkout');
var H = require('../lib/homestead-read');
var C = require('../lib/homestead-chat');
var readHandler = require('../handlers/homestead-read');
var chatHandler = require('../handlers/homestead-chat');
var eventsHandler = require('../handlers/homestead-events');

var ROOT = path.join(__dirname, '..');
var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var economy = read('economy.html');
var homestead = read('economy/homestead.html');
var culture = read('culture.html');
var religion = read('religion.html');
var education = read('education.html');
var finance = read('finance.html');
var gen = read('scripts/gen-domain-fronts.cjs');
var router = read('api/[...route].js');
var checkoutSrc = read('handlers/checkout.js');
var rail = read('lib/stripe-rail.js');

ok('economy p2 is still $4', !!(catalog.lookup('economy', 'p2') && catalog.lookup('economy', 'p2').priceCents === 400));
ok('no $19 economy rung in catalog (waitlist, not a fake SKU)', !catalog.lookup('economy', 'p3') && !catalog.lookup('economy', 'p6'));
ok('culture p2 unchanged', (catalog.lookup('culture', 'p2') || {}).name === 'Your Royalty and Audience Read');
ok('religion p2 unchanged', (catalog.lookup('religion', 'p2') || {}).name === 'Your Charities, Each Filing');
ok('education p2 unchanged', (catalog.lookup('education', 'p2') || {}).name === 'Your Shortlist, Each Release');

ok('economy still generated Watch shell', /id="checkoutSection"/.test(economy) && /WHERE AMERICA IS MOVING/.test(economy));
ok('economy $4 checkout CTA', /\/api\/checkout\?start=1&amp;domain=economy&amp;rung=p2/.test(economy));
ok('economy homestead section', /id="homesteadDesk"/.test(economy) && /id="hsQ"/.test(economy));
ok('economy links to /economy/homestead', /href="\/economy\/homestead"/.test(economy));
ok('economy loads homestead scripts', /homestead-desk\.js/.test(economy) && /homestead-chat\.js/.test(economy));
ok('finance was not productized', /id="checkoutSection"/.test(finance) && !/id="homesteadDesk"/.test(finance));

ok('homestead page title', /Homestead Desk · sell before auction/.test(homestead));
ok('homestead free read', /id="homesteadRead"/.test(homestead) && /id="hsQ"/.test(homestead));
ok('homestead $4 CTA', /\/api\/checkout\?start=1&amp;domain=economy&amp;rung=p2/.test(homestead));
ok('homestead honest waitlist', /Desk Alerts/.test(homestead) && /not live/.test(homestead) && /id="deskWaitlist"/.test(homestead));
ok('homestead has no fake $19 checkout', !/rung=p3/.test(homestead) && !/start=1&amp;domain=economy&amp;rung=p19/.test(homestead));
ok('homestead educational disclaimer', /Not legal/.test(homestead) && /do not invent auction dates/i.test(homestead));
ok('homestead chat launcher script', /homestead-chat\.js/.test(homestead));

ok('Soft 3 culture desk intact', /id="royalty"/.test(culture) && /domain=culture&amp;rung=p2/.test(culture));
ok('Soft 3 religion desk intact', /id="relDesk"/.test(religion) && /domain=religion&amp;rung=p2/.test(religion));
ok('Soft 3 education desk intact', /id="eduDesk"/.test(education) && /domain=education&amp;rung=p2/.test(education));
ok('Soft 3 still not killswitch clones', !/killswitch/i.test(culture + religion + education));

ok('generator re-injects economy homestead hook', /id="homesteadDesk"/.test(gen) && /economy\/homestead/.test(gen));
ok('generator still skips religion and education', /PRODUCTIZED_FRONTS/.test(gen) && /'religion'/.test(gen));
ok('router registers homestead-read', /'homestead-read': require\('\.\.\/handlers\/homestead-read'\)/.test(router));
ok('router registers homestead-chat', /'homestead-chat': require\('\.\.\/handlers\/homestead-chat'\)/.test(router));
ok('router registers homestead-events', /'homestead-events': require\('\.\.\/handlers\/homestead-events'\)/.test(router));

var newSrc = [
  read('lib/homestead-read.js'),
  read('lib/homestead-chat.js'),
  read('handlers/homestead-read.js'),
  read('handlers/homestead-chat.js'),
  read('handlers/homestead-events.js'),
  read('assets/js/homestead-desk.js'),
  read('assets/js/homestead-chat.js'),
  homestead,
  economy
].join('\n');
ok('new code never calls proposeFee', !/proposeFee\s*\(/.test(newSrc));
ok('new code never calls proposeLending', !/proposeLending\s*\(/.test(newSrc));
ok('new code has no Twilio send path', !/api\.twilio\.com|twilio\.messages|calls\.create/.test(newSrc));
ok('stripe-rail still halts outflow', /never sends money on its own/.test(rail) && /proposeFee/.test(rail));
ok('checkout start=1 still documented', /start=1/.test(checkoutSrc));

var killHits = [];
['killswitch', 'killswitchwebsites', 'KILLSWITCH'].forEach(function (p) {
  try {
    var hits = require('child_process').execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
      .split('\0').filter(function (f) { return f && /killswitch/i.test(f); });
    killHits = killHits.concat(hits);
  } catch (e) {}
});
ok('no killswitch repo files in this tree', killHits.length === 0, killHits.join(','));

ok('stage clock never invents a date', H.clock('sale', { state: 'MO' }).auctionDate === null && H.clock('sale').inventedAuctionDate === false);
ok('NOD maps to nod', H.stageOf('nod') === 'nod');
ok('sale maps to auction_scheduled', H.stageOf('sale') === 'auction_scheduled');
ok('unsure is educational overview', H.stageOf('unsure') === 'unknown');
ok('MO gets a state resource', H.resourcesFor('MO').some(function (r) { return /missouri/i.test(r.name); }));
ok('federal HUD counselor always present', H.resourcesFor('ZZ').some(function (r) { return /hud\.gov\/findacounselor/.test(r.url); }));
ok('disclaimer on every clock', /not legal/i.test(H.clock('nod').disclaimer));
ok('ZIP extractor', H.extractZip('64111') === '64111' && H.extractZip('1200 Main St, Kansas City, MO 64105') === '64105');
ok('street detector', H.looksLikeStreet('1200 Main St, Kansas City, MO') && !H.looksLikeStreet('64111'));

ok('FAQ answers NOD', /Notice of Default/.test(C.matchFaq('what is a NOD').reply));
ok('FAQ refuses invented dates', /will not invent/.test(C.matchFaq('when is the auction date').reply));
ok('FAQ says $19 is waitlist', /not live/.test(C.matchFaq('what is the $19 desk alert').reply));
ok('crisis is detected', C.isCrisis('I want to kill myself'));
ok('crisis reply has 988', /988/.test(C.crisisReply().reply) && /211/.test(C.crisisReply().reply));
ok('homeowner+high urgency routes human', C.routeFor({ role: 'homeowner', urgency: 'high' }).id === 'human');
ok('default route is $4 L1', C.routeFor({}).id === 'l1' && /domain=economy&rung=p2/.test(C.routeFor({}).url));
ok('investor routes waitlist', C.routeFor({ role: 'investor' }).id === 'waitlist');
ok('qualify marks homeowner+timeline', C.qualify([{ role: 'user', content: 'I own my house and I got a notice of default this month' }]).qualified === true);

ok('analytics allowlist', eventsHandler.ALLOWED.read_complete && eventsHandler.ALLOWED.email_capture &&
  eventsHandler.ALLOWED.chat_open && eventsHandler.ALLOWED.chat_qualified && eventsHandler.ALLOWED.checkout_start);
ok('client tracks the five events', /read_complete/.test(read('assets/js/homestead-desk.js')) &&
  /chat_open/.test(read('assets/js/homestead-chat.js')) && /chat_qualified/.test(read('assets/js/homestead-chat.js')));

ok('sitemap has /economy/homestead', /limenhelix.com\/economy\/homestead/.test(read('sitemap.xml')));
ok('vercel rewrite for homestead', /\/economy\/homestead/.test(read('vercel.json')));
ok('chat documents env placeholders', /XAI_API_KEY/.test(read('handlers/homestead-chat.js')) &&
  /LIMEN_AI_ENABLED/.test(read('handlers/homestead-chat.js')));
ok('chat uses kill switch', /spendDisabled/.test(read('handlers/homestead-chat.js')));

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
  ok('GET /api/checkout still lists rungs', j.ok === true && Array.isArray(j.rungs) && j.count > 0);
  var econ = (j.rungs || []).filter(function (r) { return r.domain === 'economy' && r.rung === 'p2'; });
  ok('catalog probe still has economy p2 at 400', econ.length === 1 && econ[0].priceCents === 400);

  var res2 = mockRes();
  await checkout({ method: 'GET', url: '/api/checkout?start=1&domain=economy&rung=p2' }, res2);
  var j2 = {};
  try { j2 = JSON.parse(res2.body || '{}'); } catch (e) { j2 = {}; }
  ok('economy L1 start without Stripe refuses closed', res2.statusCode === 503 && j2.enabled === false);

  var res3 = mockRes();
  await readHandler({ method: 'GET', url: '/api/homestead-read' }, res3);
  var j3 = JSON.parse(res3.body);
  ok('GET homestead-read idle is educational', j3.ok === true && j3.educational === true && j3.inventedAuctionDate === false);

  var res4 = mockRes();
  await chatHandler({ method: 'GET', url: '/api/homestead-chat' }, res4);
  var j4 = JSON.parse(res4.body);
  ok('GET homestead-chat readiness hides secrets', j4.ok === true && j4.outbound === false && !j4.key && j4.env && j4.env.XAI_API_KEY);

  var res5 = mockRes();
  await chatHandler({
    method: 'POST', url: '/api/homestead-chat',
    body: { messages: [{ role: 'user', content: 'when is the auction date?' }] }
  }, res5);
  var j5 = JSON.parse(res5.body);
  ok('chat FAQ refuses dates without Grok', j5.ok === true && /will not invent/i.test(j5.reply) && j5.provider === 'faq');

  var res6 = mockRes();
  await chatHandler({
    method: 'POST', url: '/api/homestead-chat',
    body: { messages: [{ role: 'user', content: 'I want to kill myself' }] }
  }, res6);
  var j6 = JSON.parse(res6.body);
  ok('chat crisis escalates', j6.crisis === true && /988/.test(j6.reply) && j6.route && j6.route.id === 'human_crisis');

  var res7 = mockRes();
  await eventsHandler({ method: 'POST', url: '/api/homestead-events', body: { event: 'not-a-real-event' } }, res7);
  var j7 = JSON.parse(res7.body);
  ok('unknown analytics event rejected', res7.statusCode === 400 && j7.ok === false);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
