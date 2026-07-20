/**
 * scripts/test-energy-market-feed.js — proves the PURE parts of lib/energy-market-feed.js. OFFLINE.
 * Run: node scripts/test-energy-market-feed.js
 *
 * fetchWtiSeries/getLiveMarketChannel do real network I/O and are intentionally NOT covered here (no
 * network in the deterministic suites, matching every other lib's discipline). parseFredCsv is pure
 * and is fully covered, including the exact real-world edge case that broke silently otherwise: FRED
 * prints a holiday as a blank value ("2026-07-03,") which must be skipped, not parsed as 0 or NaN-stress.
 */

var M = require('../lib/energy-market-feed.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }

section('1. parseFredCsv — the exact real CSV shape returned by FRED');
var real = 'observation_date,DCOILWTICO\n2026-07-06,69.60\n2026-07-07,71.53\n2026-07-08,74.56\n2026-07-13,79.20\n';
var s = M.parseFredCsv(real);
ok('parses 4 valid rows', s.length === 4, 'got ' + s.length);
ok('sorted ascending by time', s[0].v === 69.60 && s[3].v === 79.20);
ok('values are numbers, not strings', typeof s[0].v === 'number');

section('2. Holiday blank rows are skipped, not fabricated as 0 or NaN');
var withBlank = 'observation_date,DCOILWTICO\n2026-07-02,69.73\n2026-07-03,\n2026-07-06,69.60\n';
var sb = M.parseFredCsv(withBlank);
ok('blank-value row is dropped entirely', sb.length === 2, 'got ' + sb.length);
ok('no NaN or 0 leaked through', sb.every(function (r) { return isFinite(r.v) && r.v > 0; }));

section('3. Malformed / empty input abstains rather than throwing');
ok('empty string => empty array, no throw', M.parseFredCsv('').length === 0);
ok('header only => empty array', M.parseFredCsv('observation_date,DCOILWTICO\n').length === 0);
ok('garbage input => empty array, no throw', M.parseFredCsv('not,a,csv\nfile').length === 0);
ok('null/undefined input => empty array, no throw', M.parseFredCsv(null).length === 0 && M.parseFredCsv(undefined).length === 0);

section('4. Negative/zero prices are rejected (a real WTI price is never <= 0)');
var neg = 'observation_date,DCOILWTICO\n2020-04-20,-37.63\n2020-04-21,10.01\n';
var sn = M.parseFredCsv(neg);
ok('a negative price (the real 2020 COVID event) is filtered, not passed through as valid', sn.length === 1 && sn[0].v === 10.01,
   'NOTE: WTI genuinely went negative on 2020-04-20 — filtering it is a stated scope choice (marketStress assumes v>0), not a data error');

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
