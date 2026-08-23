'use strict';

var fs = require('fs');
var path = require('path');
var RES = require('../lib/primary-source-resolution.js');
var ROOT = path.join(__dirname, '..');
var QUEUE = path.join(ROOT, 'assets', 'data', 'deep', 'primary-source-review-queue.json');
var OUT = path.join(ROOT, 'assets', 'data', 'deep', 'primary-source-resolution.json');
var WRITE = process.argv.indexOf('--write') >= 0;

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

async function main() {
  var queue = read(QUEUE);
  var records = await RES.resolveQueue(queue, RES.requestCrossref);
  var report = {
    schemaVersion: 'primary-source-resolution/1.0',
    generatedAt: new Date().toISOString(),
    readOnlyAdmission: true,
    registry: 'Crossref REST metadata (identity resolution only)',
    inputQueue: 'primary-source-review-queue.json',
    summary: {
      attempted: records.length,
      resolvedMetadataOnly: records.filter(function (x) { return x.status === 'RESOLVED_METADATA_ONLY'; }).length,
      unresolved: records.filter(function (x) { return x.status === 'UNRESOLVED'; }).length
    },
    records: records
  };
  if (WRITE) fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(function (err) { console.error(err.stack || err.message); process.exitCode = 1; });

