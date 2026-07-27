#!/usr/bin/env node
/**
 * scripts/check-harness-map.js — prove lib/harness-map.js still tells the truth.
 *
 * The map restates vercel.json and .github/workflows because neither is readable
 * at runtime (see the header of lib/harness-map.js). A restatement can drift, so
 * this diffs it against the real files and exits non-zero when they disagree.
 *
 * It also checks the code matches the declaration: every outward job must be
 * wired with heartbeat.guard() and appear in heartbeat.OUTWARD, every inward one
 * with wrap(). A job declared outward but wired inward would be a job the panel
 * shows a valve for that has no valve, which is the worst possible lie for a
 * safety control to tell.
 *
 *   node scripts/check-harness-map.js
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var MAP = require(path.join(ROOT, 'lib', 'harness-map.js'));
var HB = require(path.join(ROOT, 'lib', 'heartbeat.js'));

var problems = [];
function bad(msg) { problems.push(msg); }

// ── 1. Vercel crons ───────────────────────────────────────────────────────
var vj = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
var realVercel = {};
(vj.crons || []).forEach(function (c) {
  var job = String(c.path).replace(/^\/api\//, '').split('?')[0];
  realVercel[job] = c.schedule;
});
var mapVercel = {};
MAP.JOBS.filter(function (j) { return j.source === 'vercel'; }).forEach(function (j) { mapVercel[j.job] = j.schedule; });

Object.keys(realVercel).forEach(function (job) {
  if (!(job in mapVercel)) bad('vercel.json has cron "' + job + '" that lib/harness-map.js does not declare');
  else if (mapVercel[job] !== realVercel[job]) bad('schedule drift for "' + job + '": vercel.json says "' + realVercel[job] + '", map says "' + mapVercel[job] + '"');
});
Object.keys(mapVercel).forEach(function (job) {
  if (!(job in realVercel)) bad('lib/harness-map.js declares vercel cron "' + job + '" that vercel.json does not have');
});

// ── 2. GitHub Actions crons ───────────────────────────────────────────────
var wfDir = path.join(ROOT, '.github', 'workflows');
var realGh = {};
fs.readdirSync(wfDir).filter(function (f) { return /\.ya?ml$/.test(f); }).forEach(function (f) {
  var src = fs.readFileSync(path.join(wfDir, f), 'utf8');
  var m = src.match(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/m);
  if (m) realGh[f.replace(/\.ya?ml$/, '')] = m[1].trim();
});
var mapGh = {};
MAP.JOBS.filter(function (j) { return j.source === 'github'; }).forEach(function (j) { mapGh[j.job] = j.schedule; });

Object.keys(realGh).forEach(function (job) {
  if (!(job in mapGh)) bad('.github/workflows/' + job + '.yml has a cron the map does not declare');
  else if (mapGh[job] !== realGh[job]) bad('schedule drift for "' + job + '": workflow says "' + realGh[job] + '", map says "' + mapGh[job] + '"');
});
Object.keys(mapGh).forEach(function (job) {
  if (!(job in realGh)) bad('map declares github job "' + job + '" but no workflow has that cron');
});

// ── 3. Declaration vs wiring ──────────────────────────────────────────────
var declaredOutward = MAP.outward().slice().sort();
var hbOutward = HB.OUTWARD.slice().sort();
if (declaredOutward.join(',') !== hbOutward.join(',')) {
  bad('outward sets disagree: harness-map says [' + declaredOutward.join(', ') + '], heartbeat.OUTWARD says [' + hbOutward.join(', ') + ']');
}

MAP.JOBS.filter(function (j) { return j.source === 'vercel'; }).forEach(function (j) {
  var f = path.join(ROOT, 'handlers', j.job + '.js');
  if (!fs.existsSync(f)) { bad('no handler for vercel cron "' + j.job + '"'); return; }
  var src = fs.readFileSync(f, 'utf8');
  var wired = /require\(['"]\.\.\/lib\/heartbeat['"]\)\.(wrap|guard)\(/.exec(src);
  if (!wired) { bad(j.job + ' is not wired to the heartbeat at all: it will never report a run'); return; }
  var want = j.kind === 'outward' ? 'guard' : 'wrap';
  if (wired[1] !== want) bad(j.job + ' is declared ' + j.kind + ' but wired with ' + wired[1] + '(), expected ' + want + '()');
});

// ── 4. Every role used is defined ─────────────────────────────────────────
MAP.JOBS.forEach(function (j) {
  if (!MAP.ROLES[j.role]) bad(j.job + ' has role "' + j.role + '" which is not defined in ROLES');
});

// ── report ────────────────────────────────────────────────────────────────
var counts = { vercel: Object.keys(realVercel).length, github: Object.keys(realGh).length, outward: declaredOutward.length };
if (problems.length) {
  console.log('\nHARNESS MAP DRIFT (' + problems.length + '):\n');
  problems.forEach(function (p) { console.log('  x ' + p); });
  console.log('');
  process.exit(1);
}
console.log('harness map matches reality: ' + counts.vercel + ' vercel crons, ' + counts.github + ' github crons, '
  + counts.outward + ' outward jobs with valves (' + declaredOutward.join(', ') + ')');
process.exit(0);
