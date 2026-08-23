#!/usr/bin/env node
'use strict';

/*
 * Read-only diagnosis-surface audit.
 *
 * The digest has a deliberate 180-entry working-set cap.  A domain below that
 * cap is not automatically missing diagnoses: it may simply have fewer
 * unique authored issue IDs.  Deep directives are treatment-level candidates,
 * not diagnosis records, and must not be promoted into diagnoses by counting.
 *
 * This report makes that distinction explicit for every domain and is safe to
 * run in CI or against a checkout.  It never writes data or creates tasks.
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DOMAINS = path.join(ROOT, 'assets', 'data', 'domains');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');
var CAP = 180;
var PORTAL_KEYS = [
  'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science',
  'technology', 'trade'
];

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function row(pk) {
  var files = fs.readdirSync(DOMAINS)
    .filter(function (f) { return f.endsWith('.json') && (f === pk + '.json' || f.indexOf(pk + '_') === 0); })
    .sort();
  var ids = Object.create(null);
  var duplicateGroups = [];
  var issueEntries = 0;
  files.forEach(function (file) {
    var data = read(path.join(DOMAINS, file));
    (data.issues || []).forEach(function (issue) {
      if (!issue || !issue.id) return;
      issueEntries++;
      (ids[issue.id] = ids[issue.id] || []).push(file);
    });
  });
  Object.keys(ids).forEach(function (id) {
    if (ids[id].length > 1) duplicateGroups.push({ id: id, files: ids[id] });
  });
  var digest = read(path.join(DEEP, pk + '-diagnosis-digest.json'));
  var directives = read(path.join(DEEP, pk + '-deep-directives.json'));
  var uniqueDiagnosisIds = Object.keys(ids).length;
  return {
    domain: pk,
    sourceFiles: files.length,
    sourceIssueEntries: issueEntries,
    uniqueDiagnosisIds: uniqueDiagnosisIds,
    duplicateIdGroups: duplicateGroups.length,
    duplicateEntries: duplicateGroups.reduce(function (n, g) { return n + g.files.length - 1; }, 0),
    digestDiagnosisCount: digest.diagnosisCount || (digest.diagnoses || []).length,
    digestDiagnosisTotalAvailable: digest.diagnosisTotalAvailable == null
      ? null : digest.diagnosisTotalAvailable,
    digestCap: CAP,
    digestStatus: uniqueDiagnosisIds >= CAP ? 'CAP_REACHED' : 'SOURCE_SURFACE_BELOW_CAP',
    deepDirectiveCount: (directives.directives || []).length,
    deepDirectivesAreDiagnoses: false,
    interpretation: uniqueDiagnosisIds >= CAP
      ? 'digest is capped; deeper source reconciliation is required to know what is omitted'
      : 'digest is below cap because the authored issue-ID surface is smaller; directives are not promoted by counting'
  };
}

var report = {
  schemaVersion: 'diagnosis-surface-audit/1.0',
  generatedAt: new Date().toISOString(),
  readOnly: true,
  digestCap: CAP,
  rows: PORTAL_KEYS.map(row)
};

console.log(JSON.stringify(report, null, 2));

