/**
 * scripts/test-uscourts-caseload.js — the versioned Table B reader and its refusals.
 *
 *   node scripts/test-uscourts-caseload.js
 *
 * FIXTURES ARE REAL PUBLISHED WORKBOOKS, not hand-forged zips: test/fixtures/uscourts/
 * holds three genuine files retrieved from uscourts.gov (one v1 "Commenced", two v2
 * "Filed"). Refusal cases are produced by MUTATING a real parsed workbook — changing a
 * header, blanking a cell, corrupting a count. A forged fixture would mostly test the
 * forger; a mutated real one tests the validator.
 *
 * The property under test is not "it parses". It is that the reader REFUSES rather than
 * guesses whenever the published shape stops matching a declared schema version, because
 * a silent coercion here would put an unfounded number in front of an operator.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var C = require('../lib/uscourts-caseload.js');

var FIX = path.join(__dirname, '..', 'test', 'fixtures', 'uscourts');
var V1 = 'stfj_b_630.2021.xlsx';     // Commenced | Terminated | Pending
var V2 = 'stfj_b_630.2026.xlsx';     // Filed     | Terminated | Pending
var V2_PRIOR = 'stfj_b_630.2025.xlsx';

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function buf(f) { return fs.readFileSync(path.join(FIX, f)); }
function wbOf(f) { return C.readWorkbook(buf(f)); }
/** Deep-ish clone of a parsed workbook so a mutation cannot leak between cases. */
function clone(wb) { return JSON.parse(JSON.stringify(wb)); }
function cellsOf(wb, n) { for (var i = 0; i < wb.rows.length; i++) if (wb.rows[i].n === n) return wb.rows[i].cells; return null; }

/* ── 1. Both published schema versions parse, and keep their own labels ───────────────── */

console.log('\n1. BOTH SCHEMA VERSIONS');

var v1 = C.parse(buf(V1), { filename: V1 });
var v2 = C.parse(buf(V2), { filename: V2 });

assert('v1 workbook parses', v1.ok === true, v1.code);
assert('v1 is detected as v1', v1.schemaVersion === 'v1', v1.schemaVersion);
assert('v1 keeps its published label "Commenced"', v1.firstVariableLabel === 'Commenced', v1.firstVariableLabel);
assert('v2 workbook parses', v2.ok === true, v2.code);
assert('v2 is detected as v2', v2.schemaVersion === 'v2', v2.schemaVersion);
assert('v2 keeps its published label "Filed"', v2.firstVariableLabel === 'Filed', v2.firstVariableLabel);

// The whole reason the schema is versioned: the two labels must NOT be silently unified.
assert('the two versions do not share a label', v1.firstVariableLabel !== v2.firstVariableLabel);
assert('equivalence is reported as NOT established (v1)', v1.equivalenceEstablished === false);
assert('equivalence is reported as NOT established (v2)', v2.equivalenceEstablished === false);
assert('module constant agrees', C.EQUIVALENCE_ESTABLISHED === false);

assert('v1 has the 13 declared circuits in order',
  v1.circuits.map(function (c) { return c.circuit; }).join(',') === C.EXPECTED_CIRCUITS.join(','));
assert('v2 has the 13 declared circuits in order',
  v2.circuits.map(function (c) { return c.circuit; }).join(',') === C.EXPECTED_CIRCUITS.join(','));
assert('v1 periods are consecutive', v1.currentPeriod === v1.priorPeriod + 1, v1.priorPeriod + '/' + v1.currentPeriod);
assert('v2 periods are consecutive', v2.currentPeriod === v2.priorPeriod + 1, v2.priorPeriod + '/' + v2.currentPeriod);
assert('v1 declares the revision marker (footnote-bearing vintage)', v1.revisionMarkerDeclared === true);
assert('v2 does not declare the revision marker', v2.revisionMarkerDeclared === false);
assert('every value carries units', v2.circuits.every(function (c) {
  return ['commencedOrFiled', 'terminated', 'pending'].every(function (k) { return c.variables[k].units === 'cases'; });
}));
assert('publisher note is captured', /Federal Circuit/.test(String(v2.note)), String(v2.note).slice(0, 40));

/* ── 2. Supersession, across all three variables ──────────────────────────────────────── */

console.log('\n2. SUPERSESSION');

var v2p = C.parse(buf(V2_PRIOR), { filename: V2_PRIOR });
assert('prior edition parses', v2p.ok === true, v2p.code);

var sup = C.supersession(v2, v2p);
assert('supersession computes', sup.ok === true, sup.code);
assert('overlap period is the current edition prior period', sup.overlapPeriod === v2.priorPeriod);
assert('all three variables are compared (39 cells)', sup.comparedCells === 39, String(sup.comparedCells));
assert('no restatement observed for this 2025/2026 pair', sup.restatedCount === 0, JSON.stringify(sup.changes).slice(0, 160));
assert('no label boundary between these two editions', sup.labelBoundaryCrossed === false);

// A restatement MUST be detected when one exists. Mutate one prior-edition cell and re-run;
// an assertion that only ever sees zero differences proves nothing.
var mutPrior = JSON.parse(JSON.stringify(v2p));
var beforeVal = mutPrior.circuits[3].variables.terminated.current;
mutPrior.circuits[3].variables.terminated.current = beforeVal + 7;
var sup2 = C.supersession(v2, mutPrior);
assert('a restatement in ANY variable is detected', sup2.restatedCount === 1, String(sup2.restatedCount));
assert('the detected restatement names the right variable', sup2.changes[0] && sup2.changes[0].variable === 'terminated');
assert('the detected restatement reports the delta', sup2.changes[0] && sup2.changes[0].delta === -7, JSON.stringify(sup2.changes[0]));

// Non-overlapping editions must refuse, not silently compare unrelated periods.
var noOverlap = C.supersession(v2, v1);
assert('non-overlapping editions refuse to compare', noOverlap.ok === false && noOverlap.code === 'NO_OVERLAP', JSON.stringify(noOverlap).slice(0, 120));

// Crossing the Commenced/Filed boundary must be flagged, never quietly joined.
var v1prior = C.parse(buf(V1), { filename: V1 });
var faked = JSON.parse(JSON.stringify(v1prior));
faked.currentPeriod = v2.priorPeriod;                       // force an overlap
faked.circuits.forEach(function (c, i) {
  ['commencedOrFiled', 'terminated', 'pending'].forEach(function (k) {
    c.variables[k].current = v2.circuits[i].variables[k].prior;   // identical values
  });
});
var crossed = C.supersession(v2, faked);
assert('a label-boundary comparison is flagged', crossed.ok === true && crossed.labelBoundaryCrossed === true);
assert('the flagged comparison names both labels',
  crossed.priorLabel === 'Commenced' && crossed.currentLabel === 'Filed',
  crossed.priorLabel + '/' + crossed.currentLabel);

/* ── 3. Altered headers are REFUSED, not coerced ──────────────────────────────────────── */

console.log('\n3. ALTERED-HEADER REFUSAL');

function mutateHeader(file, col, value) {
  var wb = clone(wbOf(file));
  cellsOf(wb, 3)[col] = value;
  return C.parseWorkbookObject(wb, { filename: file });
}

var r = mutateHeader(V2, 'B', 'Initiated');
assert('an unknown first-variable header is refused', r.ok === false && r.code === 'UNKNOWN_SCHEMA', r.code);
assert('the refusal reports what it saw', r.ok === false && Array.isArray(r.got) && r.got[0] === 'initiated', JSON.stringify(r.got));
assert('the refusal lists the known versions', r.ok === false && r.known && r.known.length === 2);

r = mutateHeader(V2, 'E', 'Disposed');
assert('an unknown second-variable header is refused', r.ok === false && r.code === 'UNKNOWN_SCHEMA', r.code);
r = mutateHeader(V2, 'H', 'Open');
assert('an unknown third-variable header is refused', r.ok === false && r.code === 'UNKNOWN_SCHEMA', r.code);
r = mutateHeader(V2, 'A', 'District');
assert('a changed row-label header is refused', r.ok === false && r.code === 'HEADER_MISMATCH', r.code);

// Mixing versions must not resolve to either one.
var mixed = clone(wbOf(V2));
cellsOf(mixed, 3).B = 'Commenced';       // v1 first variable ...
r = C.parseWorkbookObject(mixed, { filename: V2 });
assert('a v1 label inside a v2 sheet still resolves only by full header match', r.ok === true && r.schemaVersion === 'v1', r.code || r.schemaVersion);
assert('  ...and it reports the label it actually saw', r.ok === true && r.firstVariableLabel === 'Commenced');

// Footnote superscripts must normalise away: v1 headers carry them and must still match.
assert('normalisation strips footnote superscripts', C._norm('Percent\r\nChange¹') === 'percentchange', C._norm('Percent\r\nChange¹'));
assert('normalisation is case- and space-insensitive', C._norm('  FILED ') === 'filed');

/* ── 4. Structural merges must be present ─────────────────────────────────────────────── */

console.log('\n4. MERGE VALIDATION');

var noMerge = clone(wbOf(V2));
noMerge.merges = noMerge.merges.filter(function (m) { return m !== 'E3:G3'; });
r = C.parseWorkbookObject(noMerge, { filename: V2 });
assert('a missing structural merge is refused', r.ok === false && r.code === 'MERGE_MISMATCH', r.code);
assert('the refusal names the missing range', r.ok === false && r.missing.indexOf('E3:G3') >= 0);

var allMerges = clone(wbOf(V2));
allMerges.merges = [];
r = C.parseWorkbookObject(allMerges, { filename: V2 });
assert('a sheet with no merges at all is refused', r.ok === false && r.code === 'MERGE_MISMATCH');

/* ── 5. Period-header validation ──────────────────────────────────────────────────────── */

console.log('\n5. PERIOD HEADERS');

function mutateYear(col, value) {
  var wb = clone(wbOf(V2));
  cellsOf(wb, 4)[col] = value;
  return C.parseWorkbookObject(wb, { filename: V2 });
}
r = mutateYear('B', 'FY');
assert('a non-year period label is refused', r.ok === false && r.code === 'PERIOD_HEADER_MISMATCH', r.code);
r = mutateYear('C', '2030');
assert('non-consecutive periods are refused', r.ok === false && r.code === 'PERIOD_NOT_CONSECUTIVE', r.code);
r = mutateYear('D', 'Delta');
assert('a renamed percent-change column is refused', r.ok === false && r.code === 'PERCENT_HEADER_MISMATCH', r.code);

/* ── 6. Missing cells and invalid units ───────────────────────────────────────────────── */

console.log('\n6. MISSING CELLS AND INVALID UNITS');

function mutateData(col, rowNum, value) {
  var wb = clone(wbOf(V2));
  cellsOf(wb, rowNum)[col] = value;
  return C.parseWorkbookObject(wb, { filename: V2 });
}
// Row 5 is the Total row in the v2 layout.
r = mutateData('C', 5, '');
assert('a blank count is refused', r.ok === false && r.code === 'CELL_VALIDATION_FAILED', r.code);
assert('the refusal names the missing cell', r.ok === false && /Total\.commencedOrFiled\.current: missing/.test(r.problems.join('|')), r.problems && r.problems.join('|').slice(0, 120));

r = mutateData('C', 5, '44,203');
assert('a thousands-separated count is refused (not silently coerced)', r.ok === false && r.code === 'CELL_VALIDATION_FAILED');
r = mutateData('C', 5, '44203.5');
assert('a non-integer count is refused', r.ok === false && r.code === 'CELL_VALIDATION_FAILED');
r = mutateData('C', 5, '-12');
assert('a negative count is refused', r.ok === false && r.code === 'CELL_VALIDATION_FAILED');
r = mutateData('C', 5, '44203 cases');
assert('a unit-suffixed count is refused', r.ok === false && r.code === 'CELL_VALIDATION_FAILED');
r = mutateData('D', 5, 'n/a');
assert('a non-numeric percent change is refused', r.ok === false && r.code === 'CELL_VALIDATION_FAILED');

// A blank percent change is the publisher's documented suppression, and is ALLOWED.
r = mutateData('D', 5, '');
assert('a blank percent change parses as suppressed, not as an error', r.ok === true, r.code);
assert('  ...and is marked suppressed rather than zero',
  r.ok === true && r.circuits[0].variables.commencedOrFiled.percentChange === null &&
  r.circuits[0].variables.commencedOrFiled.percentChangeSuppressed === true);

/* ── 7. Row-schema drift ──────────────────────────────────────────────────────────────── */

console.log('\n7. ROW SCHEMA DRIFT');

var dropRow = clone(wbOf(V2));
dropRow.rows = dropRow.rows.filter(function (rw) { return String(rw.cells.A || '').trim() !== '11th'; });
r = C.parseWorkbookObject(dropRow, { filename: V2 });
assert('a removed circuit row is refused', r.ok === false && r.code === 'ROW_SCHEMA_DRIFT', r.code);

var renameRow = clone(wbOf(V2));
cellsOf(renameRow, 6).A = 'Fed';    // 'DC' -> 'Fed'
r = C.parseWorkbookObject(renameRow, { filename: V2 });
assert('a renamed circuit row is refused', r.ok === false && r.code === 'ROW_SCHEMA_DRIFT', r.code);
assert('the refusal shows expected vs got', r.ok === false && r.expected.length === 13 && Array.isArray(r.got));

/* ── 8. Reporting endpoints ───────────────────────────────────────────────────────────── */

console.log('\n8. REPORTING ENDPOINTS');

var ep = C.parseEndpoint('stfj_b_630.2026.xlsx');
assert('June endpoint parses', ep.ok === true && ep.endpoint === '0630' && ep.year === 2026, JSON.stringify(ep));
assert('June endpoint label states the 12-month period', /12-month period ending June 30, 2026/.test(ep.label), ep.label);
ep = C.parseEndpoint('stfj_b_1231.2025.xlsx');
assert('December endpoint parses', ep.ok === true && ep.endpoint === '1231' && ep.year === 2025);
assert('December endpoint label states the 12-month period', /December 31, 2025/.test(ep.label), ep.label);
ep = C.parseEndpoint('stfj_b_d14_630.2026_0.xlsx');
assert('an unrecognised filename is refused', ep.ok === false && ep.code === 'UNKNOWN_FILENAME', ep.code);

// The cadence question: a quarterly endpoint is NOT a variant to absorb, it is a refusal.
['0331', '331', '930', '0930', '1130'].forEach(function (bad) {
  var e2 = C.parseEndpoint('stfj_b_' + bad + '.2026.xlsx');
  assert('endpoint ' + bad + ' is refused as an unknown cadence',
    e2.ok === false && (e2.code === 'UNKNOWN_REPORTING_ENDPOINT' || e2.code === 'UNKNOWN_FILENAME'), e2.code);
});
assert('only two endpoints are declared', Object.keys(C.ENDPOINTS).sort().join(',') === '1231,630', Object.keys(C.ENDPOINTS).join(','));

/* ── 9. Non-workbook input ────────────────────────────────────────────────────────────── */

console.log('\n9. NON-WORKBOOK INPUT');

r = C.parse(Buffer.from('<!DOCTYPE html><html><body>404 Not Found</body></html>'), { filename: V2 });
assert('an HTML error page is refused', r.ok === false && r.code === 'NOT_A_WORKBOOK', r.code);
r = C.parse(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), { filename: V2 });
assert('a truncated zip is refused', r.ok === false && r.code === 'NOT_A_WORKBOOK', r.code);
r = C.parse(Buffer.alloc(0), { filename: V2 });
assert('an empty body is refused', r.ok === false && r.code === 'NOT_A_WORKBOOK', r.code);

/* ── 10. The handler declares its own boundaries ──────────────────────────────────────── */

console.log('\n10. HANDLER CONTRACT');

var H = require('../handlers/authority-caseload.js');
var desc = H.descriptor();
assert('descriptor states it is consumed by no Law finding', desc.consumedBy.lawFinding === false);
assert('descriptor states it is consumed by no brain channel', desc.consumedBy.brainChannel === false);
assert('descriptor states no Thing layer', desc.consumedBy.thingLayer === null);
assert('descriptor states it drives no pathway', desc.consumedBy.pathway === false);
assert('descriptor names the RSS proxy it must not be confused with',
  desc.notTheSameAs.channel === 'law.federalCaseload' && desc.notTheSameAs.channelUnits === 'articles/7d');
assert('descriptor states the semiannual 12-month rolling cadence',
  /semiannual/i.test(desc.publicationInterval) && /12 months, rolling/.test(desc.observationWindow),
  desc.publicationInterval + ' | ' + desc.observationWindow);
assert('descriptor states the Federal Circuit exclusion', /Federal Circuit/.test(desc.excluded));
assert('descriptor states the March 2014 break', /March 2014/.test(desc.knownBreak));
assert('descriptor carries no numeric measurement fields', (function () {
  var s = JSON.stringify(desc);
  return !/"(value|score|stress|rank|current|prior)"\s*:/.test(s);
})(), 'descriptor must describe, never measure');

// Candidate editions must be derived from the clock, never hardcoded, and never future.
var cands = H.candidateEditions(new Date(Date.UTC(2026, 7, 16)));
assert('candidate editions are derived, newest first', cands.length > 0 && cands[0].year === 2026 && cands[0].endpoint === '630',
  JSON.stringify(cands.slice(0, 2)));
assert('no candidate period ends in the future',
  cands.every(function (c) { return c.periodEnd <= Date.UTC(2026, 7, 16); }));
assert('filenameFor builds the published name', H.filenameFor({ endpoint: '630', year: 2026 }) === 'stfj_b_630.2026.xlsx');

/* ── 11. The page must not carry fabricated or unsupported claims ─────────────────────── */

console.log('\n11. PAGE CLAIM DISCIPLINE');

var page = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
var scriptBody = page.replace(/<style[\s\S]*?<\/style>/g, '');

/**
 * These terms must not be ASSERTED. They may legitimately appear in a DENIAL — the brief
 * requires the page to state that it produces no stress value and drives no pathway — so a
 * plain substring ban would fail on exactly the sentences that make the page honest.
 *
 * The denial constructs are therefore enumerated and removed first. Whatever survives is a
 * real claim. If someone later renders `stress: 0.42`, the term reappears outside the
 * whitelist and this fails, which is the property actually worth protecting.
 */
var DENIALS = [
  "No forecast, score, ranking, stress value, or validated status is asserted anywhere on this page.",
  "row('Produces stress / diagnosis / activation', '<span class=\"ap-pill no\">no</span>')"
];
var claimBody = scriptBody;
DENIALS.forEach(function (d) {
  assert('denial present verbatim: ' + d.slice(0, 44) + '...', claimBody.indexOf(d) >= 0);
  claimBody = claimBody.split(d).join('');
});
assert('page asserts no validated status', !/\bvalidated\b/i.test(claimBody));
assert('page asserts no stress value', !/\bstress\b/i.test(claimBody));
assert('page asserts no score or ranking', !/\b(score|ranking|rank)\b/i.test(claimBody));
assert('page makes no forecast claim', !/\bforecast\b/i.test(claimBody));
assert('page states the not-consumed position', /Consumed by a Law finding/.test(page));
assert('page distinguishes the RSS proxy by name', /law\.federalCaseload/.test(page) || /notTheSameAs/.test(page));
assert('page labels the measure semiannual and 12-month rolling',
  /semiannual, 12-month rolling administrative measure/i.test(page));
// No numeric literal may be rendered as evidence: every number must come from the payload.
var renderSection = page.slice(page.indexOf('function render('));
var literals = (renderSection.match(/>\s*[0-9]{3,}\s*</g) || []);
assert('no hardcoded multi-digit figure is rendered', literals.length === 0, JSON.stringify(literals).slice(0, 120));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
