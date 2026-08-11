/**
 * scripts/brain-audit/regen-finding-map.js — re-derive the diagnosis mapping from the
 * predicates that existed before the registry, and check the registry still matches it.
 *
 * WHY THIS EXISTS. The declarative registry claims to represent exactly what sixty-three
 * executable predicates did. A claim like that decays: entries get edited, forms get added,
 * and the document that recorded the original mapping ages out of agreement with the code.
 * So the derivation is a script rather than a paragraph, and it reads the ORIGINAL predicates
 * out of git rather than trusting any copy of them.
 *
 * A note on why it does not read the current binders: it used to, and that was correct for
 * exactly one commit. After the migration the binders carry compiled entries whose function
 * bodies are the interpreter's wrapper, so classifying them would report sixty-three
 * unmatched predicates and mean nothing. The baseline is the only place the original
 * predicates still exist, which is precisely why the comparison is worth running.
 *
 * Usage:
 *   node scripts/brain-audit/regen-finding-map.js            table + counts + agreement
 *   node scripts/brain-audit/regen-finding-map.js --json     machine-readable rows
 *   node scripts/brain-audit/regen-finding-map.js --baseline <sha>
 *
 * Exits non-zero if any predicate fails to classify or the registry disagrees with the
 * re-derivation. Zero unmatched is the only acceptable result: an unmatched predicate means
 * the grammar does not cover the library, and inventing an eleventh form is a separate
 * review, not a patch.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var REPO = path.join(__dirname, '..', '..');
var BIND_DIR = path.join(REPO, 'brain-v2', 'bind');
var DEFAULT_BASELINE = 'ea5923ba';
var CH = '[A-Za-z_$][A-Za-z0-9_$]*';

/* The ten forms, in match order. Order matters: the *_SUM variants must be tried before
   their shorter prefixes, or a three-clause predicate matches the two-clause pattern and its
   sum term is silently dropped. */
var FORMS = [
  ['DOMAIN_DEPART', new RegExp('^typeof s\\.departure === \'number\' && Math\\.abs\\(s\\.departure\\) >= (SIGMA|[0-9.]+)$')],
  ['SINGLE_DEPART_ABS', new RegExp('^d\\.(' + CH + ') && Math\\.abs\\(d\\.\\1\\.z\\) >= (SIGMA|[0-9.]+)$')],
  ['SINGLE_DEPART_SIGNED', new RegExp('^d\\.(' + CH + ') && d\\.\\1\\.z >= (SIGMA|[0-9.]+)$')],
  ['PAIR_CO_DEPART_ABS_SUM', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && Math\\.abs\\(d\\.\\1\\.z\\) >= (SIGMA|[0-9.]+) && Math\\.abs\\(d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+) && \\(Math\\.abs\\(d\\.\\1\\.z\\) \\+ Math\\.abs\\(d\\.\\2\\.z\\)\\) >= (SIGMA|[0-9.]+)$')],
  ['PAIR_CO_DEPART_ABS', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && Math\\.abs\\(d\\.\\1\\.z\\) >= (SIGMA|[0-9.]+) && Math\\.abs\\(d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+)$')],
  ['PAIR_CO_DEPART_SIGNED_SUM', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && d\\.\\1\\.z >= (SIGMA|[0-9.]+) && d\\.\\2\\.z >= (SIGMA|[0-9.]+) && \\(d\\.\\1\\.z \\+ d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+)$')],
  ['PAIR_CO_DEPART_SIGNED', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && d\\.\\1\\.z >= (SIGMA|[0-9.]+) && d\\.\\2\\.z >= (SIGMA|[0-9.]+)$')],
  ['PAIR_EITHER_PLUS_SUM', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && \\(d\\.\\1\\.z >= (SIGMA|[0-9.]+) \\|\\| d\\.\\2\\.z >= (SIGMA|[0-9.]+)\\) && \\(d\\.\\1\\.z \\+ d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+)$')],
  ['PAIR_SUM_ONLY', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && \\(d\\.\\1\\.z \\+ d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+)$')],
  ['PAIR_SIGN_DISAGREE', new RegExp('^d\\.(' + CH + ') && d\\.(' + CH + ') && Math\\.sign\\(d\\.\\1\\.z\\) !== Math\\.sign\\(d\\.\\2\\.z\\) && Math\\.abs\\(d\\.\\1\\.z - d\\.\\2\\.z\\) >= (SIGMA|[0-9.]+)$')]
];

/**
 * Resolve the baseline to a full commit sha, and refuse anything that is not a commit.
 *
 * THE POINT IS THAT THIS NEVER READS HEAD. `git show <ref>:<path>` accepts a branch name as
 * happily as a sha, so a baseline of 'HEAD' or of a moving branch would quietly re-derive the
 * mapping from whatever the code became, compare it to itself, and always agree. Pinning to a
 * commit and PRINTING the resolved sha is what makes the comparison falsifiable: a reader can
 * see which predicates were actually read.
 */
function resolveBaseline(ref) {
  var sha, type;
  /* NOT `ref^{commit}`: child_process shells out through cmd.exe on Windows, where `^` is the
     escape character, so the peel silently becomes `ref{commit}` and git reports "needed a
     single revision". Resolve, then ask what the object is. */
  try { sha = cp.execSync('git rev-parse --verify ' + ref, { cwd: REPO }).toString().trim(); }
  catch (e) { throw new Error('baseline "' + ref + '" does not resolve to anything in this repository'); }
  try { type = cp.execSync('git cat-file -t ' + sha, { cwd: REPO }).toString().trim(); }
  catch (e) { type = 'unknown'; }
  if (type !== 'commit') throw new Error('baseline "' + ref + '" resolves to a ' + type + ', not a commit');
  var head = '';
  try { head = cp.execSync('git rev-parse --verify HEAD', { cwd: REPO }).toString().trim(); } catch (e) { /* detached or empty */ }
  return { ref: ref, sha: sha, isHead: sha === head };
}

function normalizeBody(fn) {
  return fn.toString().replace(/\s+/g, ' ')
    .replace(/^function \(v, s, d\) \{ return /, '')
    .replace(/; \}$/, '');
}

function binderFiles() {
  return fs.readdirSync(BIND_DIR).filter(function (f) {
    return f.slice(-3) === '.js' &&
      ['factory.js', 'registry.js', 'diagnosis-registry.js', 'diagnosis-forms.js'].indexOf(f) < 0;
  });
}

/**
 * The FINDINGS array as it was at `baseline`, evaluated with SIGMA in scope.
 *
 * Only the array is lifted, not the module: the baseline binder calls the factory, and the
 * factory now refuses inline test functions, which is the change being audited. SIGMA is the
 * one free name those bodies ever referenced.
 */
function baselineFindings(file, baseline) {
  var src;
  try { src = cp.execSync('git show ' + baseline + ':brain-v2/bind/' + file, { cwd: REPO, maxBuffer: 1 << 24 }).toString(); }
  catch (e) { return null; }
  var start = src.search(/^var FINDINGS = \[/m);
  if (start < 0) return [];
  var rest = src.slice(start);
  var end = rest.search(/^\];\s*$/m);
  if (end < 0) throw new Error(file + ': could not delimit the baseline FINDINGS array');
  return new Function('SIGMA', rest.slice(0, end + 2) + '\nreturn FINDINGS;')(2.0);
}

/** Classify every baseline predicate. Rows carry the seven mapped fields. */
function classify(baseline) {
  baseline = baseline || DEFAULT_BASELINE;
  var rows = [];
  binderFiles().forEach(function (file) {
    var domain = require(path.join(BIND_DIR, file)).domain;
    var olds = baselineFindings(file, baseline);
    if (!olds) return;
    olds.forEach(function (f) {
      var row = { domain: domain, id: f.id, requires: (f.requires || []).slice(), basis: f.basis || '' };
      var body = normalizeBody(f.test), hit = null, m = null;
      for (var i = 0; i < FORMS.length; i++) { m = body.match(FORMS[i][1]); if (m) { hit = FORMS[i][0]; break; } }
      if (!hit) { row.form = null; row.body = body; rows.push(row); return; }
      var g = m.slice(1).filter(function (x) { return x !== undefined; });
      row.form = hit;
      if (hit === 'DOMAIN_DEPART') { row.operands = []; row.thresholds = g; }
      else if (hit.indexOf('PAIR') === 0) { row.operands = [g[0], g[1]]; row.thresholds = g.slice(2); }
      else { row.operands = [g[0]]; row.thresholds = g.slice(1); }
      rows.push(row);
    });
  });
  rows.sort(function (a, b) { return a.domain === b.domain ? a.id.localeCompare(b.id) : a.domain.localeCompare(b.domain); });
  return rows;
}

/** Compare the re-derivation against what bind/diagnosis-registry.js currently declares. */
function agreesWithRegistry(rows) {
  var REG = require(path.join(BIND_DIR, 'diagnosis-registry.js'));
  var out = [];
  var byKey = {};
  REG.allEntries().forEach(function (e) { byKey[e.domain + '/' + e.entry.id] = e.entry; });
  rows.forEach(function (r) {
    var key = r.domain + '/' + r.id;
    var e = byKey[key];
    if (!e) { out.push(key + ': absent from the registry'); return; }
    var want = (r.thresholds || []).map(function (t) { return t === 'SIGMA' ? 'SIGMA' : String(parseFloat(t)); }).join(',');
    var got = (e.thresholds || []).map(function (t) { return typeof t === 'string' ? t : String(t); }).join(',');
    if (e.form !== r.form) out.push(key + ': form ' + e.form + ' vs derived ' + r.form);
    if ((e.operands || []).join(',') !== (r.operands || []).join(',')) out.push(key + ': operands differ');
    if ((e.requires || []).join(',') !== (r.requires || []).join(',')) out.push(key + ': requires differ');
    if (want !== got) out.push(key + ': thresholds ' + got + ' vs derived ' + want);
    if (e.basis !== r.basis) out.push(key + ': basis differs');
  });
  if (Object.keys(byKey).length !== rows.length) {
    out.push('registry holds ' + Object.keys(byKey).length + ' entries, derivation produced ' + rows.length);
  }
  return out;
}

module.exports = { classify: classify, FORMS: FORMS, normalizeBody: normalizeBody,
                   baselineFindings: baselineFindings, agreesWithRegistry: agreesWithRegistry };

if (require.main === module) {
  var argv = process.argv.slice(2);
  var bi = argv.indexOf('--baseline');
  var baseline = bi > -1 ? argv[bi + 1] : DEFAULT_BASELINE;
  var pin = resolveBaseline(baseline);
  var rows = classify(baseline);
  var unmatched = rows.filter(function (r) { return !r.form; });

  if (argv.indexOf('--json') > -1) {
    console.log(JSON.stringify(rows, null, 1));
  } else {
    console.log('| # | domain | finding ID | form | operands | requires | thresholds |');
    console.log('|---|---|---|---|---|---|---|');
    rows.forEach(function (r, i) {
      console.log('| ' + (i + 1) + ' | ' + r.domain + ' | ' + r.id + ' | ' + (r.form || 'UNMATCHED') + ' | ' +
        ((r.operands || []).join(', ') || (r.form === 'DOMAIN_DEPART' ? 's.departure' : '')) + ' | ' +
        r.requires.join(', ') + ' | ' + (r.thresholds || []).join(', ') + ' |');
    });
  }

  var tally = {};
  rows.forEach(function (r) { var k = r.form || 'UNMATCHED'; tally[k] = (tally[k] || 0) + 1; });
  console.log('');
  console.log('baseline ref "' + pin.ref + '" resolved to ' + pin.sha);
  if (pin.isHead) {
    console.log('  NOTE: that commit is also the current HEAD. The derivation is still read from');
    console.log('  the pinned commit, but a baseline that tracks HEAD would compare the code to');
    console.log('  itself and always agree. Pass --baseline <sha> explicitly if that is not intended.');
  }
  console.log('findings: ' + rows.length + '   unmatched: ' + unmatched.length);
  Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).forEach(function (k) {
    console.log('  ' + String(tally[k]).padStart(3) + '  ' + k);
  });

  var disagreements = agreesWithRegistry(rows);
  console.log('');
  console.log(disagreements.length
    ? 'REGISTRY DISAGREES WITH THE RE-DERIVATION:\n  ' + disagreements.join('\n  ')
    : 'registry agrees with the re-derivation on all ' + rows.length + ' entries');

  if (unmatched.length) { console.error('UNMATCHED PREDICATES PRESENT — stop, do not assume'); process.exit(1); }
  if (disagreements.length) process.exit(1);
}
