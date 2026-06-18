/**
 * c1-energy-portal-cortex-audit.cjs — READ-ONLY content-quality audit of the Energy
 * portal cortex (assets/data/domains/energy*.json). Classifies each portal file
 * REAL / MIXED / SYNTHETIC / EMPTY by real-company presence + template-treatment ratio,
 * aggregates by level, builds a diagnosis->portal candidate map, and recommends whether
 * C2 traversal / G1d authoring are safe. Modifies nothing.
 * Run: node scripts/_taxonomy-pilot/c1-energy-portal-cortex-audit.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DOM = path.join(ROOT, 'assets', 'data', 'domains');

// Mad-lib treatments have the shape "{generic verb} {PortalTitle} {Group} {generic suffix}".
// Detect by generic verb START + generic program-noun END (real L0 treatments are noun phrases,
// e.g. "Diversified Generation Portfolio", which match neither).
const GEN_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate)\b/;
// Mad-lib treatments ALL start with a generic management verb; real L0 treatments are
// noun phrases ("Diversified Generation Portfolio") — verified 0/32 L0 reals start with a verb.
function isTemplate(l) { return GEN_VERB.test(l); }

function classifyFile(p) {
  var e; try { e = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { return { cls: 'EMPTY', companies: 0, acts: 0, treat: 0, tmplRatio: 1, issues: 0 }; }
  var acts = e.activations || [];
  var companies = 0; acts.forEach(function (a) { if (a.companies && a.companies.length) companies += a.companies.length; });
  var treatLabels = [];
  acts.forEach(function (a) { (a.treatments || []).forEach(function (t) { if (t && (t.label || t.title)) treatLabels.push(t.label || t.title); }); });
  var tmpl = treatLabels.filter(isTemplate).length;
  var tmplRatio = treatLabels.length ? tmpl / treatLabels.length : 1;
  var issues = (e.issues || []).length;
  var cls;
  if (acts.length === 0 && treatLabels.length === 0) cls = 'EMPTY';
  else if (companies > 0 && tmplRatio < 0.4) cls = 'REAL';
  else if (companies > 0) cls = 'MIXED';                 // real companies, template treatments
  else if (tmplRatio >= 0.6) cls = 'SYNTHETIC';          // no companies, template treatments
  else cls = 'EMPTY';
  return { cls: cls, companies: companies, acts: acts.length, treat: treatLabels.length, tmplRatio: Math.round(tmplRatio * 100) / 100, issues: issues };
}
function level(name) { return name.replace(/\.json$/, '').split('_').length - 1; }

var files = fs.readdirSync(DOM).filter(function (f) { return /^energy(_|\.)/.test(f) && f.endsWith('.json'); });
var byLevel = {};
var perFile = {};
files.forEach(function (f) {
  var L = level(f), r = classifyFile(path.join(DOM, f));
  perFile[f.replace(/\.json$/, '')] = r;
  byLevel[L] = byLevel[L] || { count: 0, REAL: 0, MIXED: 0, SYNTHETIC: 0, EMPTY: 0, companies: 0, tmplRatioSum: 0 };
  var b = byLevel[L]; b.count++; b[r.cls]++; b.companies += r.companies; b.tmplRatioSum += r.tmplRatio;
});

console.log('\n================ C1 — ENERGY PORTAL CORTEX QUALITY AUDIT (read-only) ================\n');
console.log('--- L0–L6 LEVEL COUNT + QUALITY TABLE ---');
console.log('Lvl | files | REAL | MIXED | SYNTH | EMPTY | totalCompanies | avgTmplRatio | verdict');
Object.keys(byLevel).sort().forEach(function (L) {
  var b = byLevel[L];
  var verdict = b.REAL / b.count > 0.5 ? 'REAL' : (b.MIXED / b.count > 0.4 ? 'MIXED' : (b.SYNTHETIC / b.count > 0.5 ? 'SYNTHETIC' : 'MIXED'));
  console.log('  L' + L + ' | ' + String(b.count).padStart(5) + ' | ' + String(b.REAL).padStart(4) + ' | ' + String(b.MIXED).padStart(5) + ' | ' + String(b.SYNTHETIC).padStart(5) + ' | ' + String(b.EMPTY).padStart(5) + ' | ' + String(b.companies).padStart(14) + ' | ' + (b.tmplRatioSum / b.count).toFixed(2).padStart(12) + ' | ' + verdict);
});

// diagnosis -> portal candidate branches (keyword match) + quality
var DX_BRANCHES = {
  GRID_COLLAPSE:           ['grid', 'transmission', 'gridmod'],
  RENEWABLE_INTERMITTENCY: ['solar', 'hydro', 'storage', 'offgrid'],
  PIPELINE_DISRUPTION:     ['pipeline'],
  OIL_SHOCK:               ['fossil', 'pipeline_oil'],
  NUCLEAR_INCIDENT:        ['nuclear'],
  SYSTEMIC_ENERGY_STRESS:  ['grid', 'energytrans', 'power']
};
console.log('\n--- DIAGNOSIS -> PORTAL CANDIDATE MAP (best real/mixed branch per diagnosis) ---');
var dxUsable = {};
Object.keys(DX_BRANCHES).forEach(function (dx) {
  var kws = DX_BRANCHES[dx];
  var matches = Object.keys(perFile).filter(function (n) { return kws.some(function (k) { return n.indexOf('energy_' + k) === 0 || n.indexOf('_' + k) >= 0 || n === 'energy_' + k; }); });
  var real = matches.filter(function (n) { return perFile[n].cls === 'REAL'; });
  var mixed = matches.filter(function (n) { return perFile[n].cls === 'MIXED'; });
  var synth = matches.filter(function (n) { return perFile[n].cls === 'SYNTHETIC'; });
  var bestL1 = matches.filter(function (n) { return level(n + '.json') === 1; });
  dxUsable[dx] = (real.length + mixed.length) > 0;
  console.log('  ' + dx.padEnd(24) + ' branches=' + matches.length + ' (REAL=' + real.length + ' MIXED=' + mixed.length + ' SYNTH=' + synth.length + ')'
    + ' | best=' + (real[0] || mixed[0] || synth[0] || '(none)') + ' [' + (perFile[real[0] || mixed[0] || synth[0]] ? perFile[real[0] || mixed[0] || synth[0]].cls : '-') + ']');
});

// strongest usable vs excluded
var usable = Object.keys(perFile).filter(function (n) { return perFile[n].cls === 'REAL' || perFile[n].cls === 'MIXED'; });
var excluded = Object.keys(perFile).filter(function (n) { return perFile[n].cls === 'SYNTHETIC' || perFile[n].cls === 'EMPTY'; });
console.log('\n--- USABLE branches (REAL/MIXED): ' + usable.length + ' | EXCLUDED (SYNTH/EMPTY): ' + excluded.length + ' ---');
console.log('  usable sample:', usable.slice(0, 12).join(', '));
console.log('  excluded sample:', excluded.slice(0, 8).join(', ') + ' …');

var l2 = byLevel['2'] || { SYNTHETIC: 0, count: 1 };
var l1 = byLevel['1'] || { REAL: 0, MIXED: 0, count: 1 };
var l2Synthetic = (l2.SYNTHETIC / l2.count) > 0.7;
var l1Usable = ((l1.REAL + l1.MIXED) / l1.count) > 0.5;

console.log('\n--- RECOMMENDATION ---');
console.log('  C2 live traversal: ' + (l2Synthetic ? 'BLOCKED below L1 (L2 is ' + Math.round(l2.SYNTHETIC / l2.count * 100) + '% synthetic) — allowed ONLY L0->L1 WITH FILTERS (require companies>0, drop template treatments)' : 'allowed with filters'));
console.log('  G1d bundle authoring: ' + (l1Usable ? 'L0+L1 can seed company/issue context, but treatments are template -> G1d needs EXTERNAL real treatment/evidence material (portal alone is not artifact-grade)' : 'REQUIRES external verified source material'));
console.log('  Diagnoses with a usable (REAL/MIXED) branch:', Object.keys(dxUsable).filter(function (d) { return dxUsable[d]; }).join(', ') || '(none)');
console.log('  Diagnoses with ONLY synthetic branches:', Object.keys(dxUsable).filter(function (d) { return !dxUsable[d]; }).join(', ') || '(none)');
console.log('\n================ END C1 AUDIT ================\n');
