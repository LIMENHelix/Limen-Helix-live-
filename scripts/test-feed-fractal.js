/**
 * scripts/test-feed-fractal.js — proves lib/feed-fractal.js (#1 the feed fractal). OFFLINE.
 * Run: node scripts/test-feed-fractal.js
 *
 * Each assertion maps to a claim in the module header: content-not-count typing, per-channel abstention,
 * differentiated phase-signatures, source-quality weighting, and an end-to-end feed into the estimator.
 */

var F = require('../lib/feed-fractal.js');
var PE = require('../lib/phase-estimator.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }
function sum(v) { var s = 0, i; for (i = 0; i < v.length; i++) s += v[i]; return s; }
function ch(list, key) { return list.filter(function (r) { return r.key === key; })[0]; }
function topPhase(L) { return L.indexOf(Math.max.apply(null, L)); }

// ── 1. Content classification — items typed by WHAT THEY SAY ─────────────────────────────────────
section('1. Items are classified by content, into the right channel type');
ok('"cuts 500 jobs" => workforce', F.classifyItem('Acme cuts 500 jobs in restructuring').indexOf('workforce') !== -1);
ok('"CEO resigns" => leadership', F.classifyItem('Acme CEO resigns amid turmoil').indexOf('leadership') !== -1);
ok('"recall" => recall', F.classifyItem('Regulator forces recall of defective units').indexOf('recall') !== -1);
ok('"antitrust probe" => litigation', F.classifyItem('DOJ opens antitrust probe').indexOf('litigation') !== -1);
ok('"debt downgrade" => capital', F.classifyItem('Rating agency issues downgrade on debt').indexOf('capital') !== -1);
ok('"supply shortage" => supply', F.classifyItem('Chip shortage disrupts supply chain').indexOf('supply') !== -1);
ok('untyped generic news => no type', F.classifyItem('Company announces annual charity gala').length === 0);

// ── 2. Content-not-count: only typed items make a channel; generic volume does not ───────────────
section('2. CONTENT NOT COUNT: generic article volume produces no channels; one typed item does');
var generic = [];
for (var i = 0; i < 50; i++) generic.push({ text: 'quarterly newsletter update number ' + i, quality: 'event' });
ok('50 generic articles => zero channels', F.toChannels(generic).length === 0, 'got ' + F.toChannels(generic).length);
var oneLayoff = F.toChannels([{ text: 'Acme announces mass layoffs', quality: 'real' }]);
ok('1 typed layoff item => a workforce channel', !!ch(oneLayoff, 'feed_workforce'));
ok('...and 50 generic still lose to 1 typed (0 vs 1 channel)', F.toChannels(generic).length < oneLayoff.length);

// ── 3. Per-channel abstention — no fabricated channels ───────────────────────────────────────────
section('3. Abstains per channel — a type absent from the feed yields no channel');
var mixed = F.toChannels([
  { text: 'CEO steps down', quality: 'real' },
  { text: 'weak demand hits orders', quality: 'event' }
]);
ok('only the present types appear (leadership + demand)', mixed.length === 2 && !!ch(mixed, 'feed_leadership') && !!ch(mixed, 'feed_demand'));
ok('absent types (workforce/recall/etc) are NOT emitted', !ch(mixed, 'feed_workforce') && !ch(mixed, 'feed_recall'));

// ── 4. Differentiated phase-signatures — different trouble loads different phases ────────────────
section('4. Phase-signatures are differentiated across the arc (not one rupture bucket)');
ok('workforce/layoffs loads Separation (P7)', topPhase(ch(F.toChannels([{ text: 'layoffs', quality: 'real' }]), 'feed_workforce').likelihood) === 7);
ok('leadership loads Threshold (P9)', topPhase(ch(F.toChannels([{ text: 'CEO resigns', quality: 'real' }]), 'feed_leadership').likelihood) === 9);
ok('litigation loads Conscience (P8)', topPhase(ch(F.toChannels([{ text: 'antitrust lawsuit', quality: 'real' }]), 'feed_litigation').likelihood) === 8);
ok('supply loads Darkness (P3)', topPhase(ch(F.toChannels([{ text: 'supply shortage', quality: 'real' }]), 'feed_supply').likelihood) === 3);
ok('pricing loads Endurance (P5)', topPhase(ch(F.toChannels([{ text: 'margin cost pressure', quality: 'real' }]), 'feed_pricing').likelihood) === 5);
ok('all signatures sum to 1', F.toChannels([{ text: 'layoffs and a recall and a lawsuit and debt default', quality: 'real' }]).every(function (r) { return Math.abs(sum(r.likelihood) - 1) < 1e-9; }));

// ── 5. Source-quality weighting + saturation ─────────────────────────────────────────────────────
section('5. Source quality weights intensity; value saturates, never a raw count');
var realItem = F.toChannels([{ text: 'layoffs', quality: 'real' }]);
var degradedItem = F.toChannels([{ text: 'layoffs', quality: 'degraded' }]);
ok('a real-source item outweighs a degraded one', ch(realItem, 'feed_workforce').value > ch(degradedItem, 'feed_workforce').value);
var manyLayoffs = []; for (i = 0; i < 40; i++) manyLayoffs.push({ text: 'layoffs round ' + i, quality: 'real' });
ok('value saturates in [0,1] even with 40 items', ch(F.toChannels(manyLayoffs), 'feed_workforce').value <= 1);
ok('broken-source items contribute nothing', F.toChannels([{ text: 'layoffs', quality: 'broken' }]).length === 0);

// ── 6. Market channel (one channel, not the label) ───────────────────────────────────────────────
section('6. Market score is ONE channel (not the label)');
ok('marketChannel returns a channel for a numeric score', !!F.marketChannel(0.8) && F.marketChannel(0.8).key === 'marketScore');
ok('marketChannel returns null for no score', F.marketChannel(null) === null && F.marketChannel(undefined) === null);
ok('market signature loads the Darkness band', topPhase(F.marketChannel(0.9).likelihood) === 3);

// ── 7. END-TO-END: a typed feed fractal drives the estimator to the matching band ────────────────
section('7. Typed feed fractal -> shared estimator moves the belief to the matching phase band');
var fractal = F.toChannels([
  { text: 'Acme cuts 1200 jobs', quality: 'real' },
  { text: 'CEO resigns abruptly', quality: 'real' },
  { text: 'SEC opens investigation', quality: 'real' }
]);
var bundle = { substrate: 'domain', subjectId: 'test', readings: fractal };
var est = PE.estimate(bundle);
ok('estimator grounds on the feed fractal', est.grounded === true && Math.abs(sum(est.belief) - 1) < 1e-6);
ok('belief concentrates in the distress arc (P3/P7/P8/P9), not the constructive band',
   (est.belief[3] + est.belief[7] + est.belief[8] + est.belief[9]) > (est.belief[1] + est.belief[2] + est.belief[4]),
   'distress=' + (est.belief[3] + est.belief[7] + est.belief[8] + est.belief[9]).toFixed(3));
console.log('        fractal: ' + fractal.map(function (r) { return r.key + '=' + r.value.toFixed(2); }).join(', ') + ' -> MAP=P' + est.phaseMAP);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
