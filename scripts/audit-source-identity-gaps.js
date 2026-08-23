#!/usr/bin/env node
'use strict';

/*
 * Read-only audit of source-level observation identity in a domain snapshot.
 *
 * A missing sourceUpdatedAt is not a single repair instruction:
 *   - headline feeds may have item-level publication dates, but that is not
 *     automatically an identity for the aggregate numeric reading;
 *   - numeric/no-headline sources need the adapter's upstream observation key,
 *     or an explicit abstention if the publisher supplies none.
 *
 * This script records the distinction. It never derives or writes a timestamp
 * into a snapshot, and its queue cannot create stress, diagnoses, or activation.
 *
 * Usage:
 *   node scripts/audit-source-identity-gaps.js --input=snapshot.json --write-queue
 */

var fs = require('fs');
var path = require('path');

var inputArg = process.argv.find(function (a) { return a.indexOf('--input=') === 0; });
var inputPath = inputArg ? inputArg.slice('--input='.length) : null;
var writeQueue = process.argv.indexOf('--write-queue') !== -1;
var DEFAULT_QUEUE = path.resolve(__dirname, '../assets/data/deep/source-identity-gap-queue.json');

function loadSnapshot() {
  if (!inputPath) throw new Error('--input=snapshot.json is required for this read-only audit');
  var file = path.resolve(inputPath);
  var raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return { file: file, value: JSON.parse(raw) };
}

function sourceList(snapshot) {
  var domains = snapshot && snapshot.domains;
  if (!domains || typeof domains !== 'object') return [];
  var out = [];
  Object.keys(domains).forEach(function (domain) {
    var value = domains[domain];
    var sources = value && Array.isArray(value.sources) ? value.sources : [];
    sources.forEach(function (source, index) {
      if (!source || typeof source !== 'object') return;
      var hasIdentity = source.sourceUpdatedAt !== undefined &&
        source.sourceUpdatedAt !== null && source.sourceUpdatedAt !== '';
      if (hasIdentity) return;
      var headlines = Array.isArray(source.headlines) && source.headlines.length > 0;
      var published = Array.isArray(source.headlinePublishedAt) &&
        source.headlinePublishedAt.some(function (v) { return v !== null && v !== undefined && v !== ''; });
      var kind = headlines ? 'headline-item-identity-only' : 'numeric-upstream-identity-missing';
      out.push({
        id: 'SOURCE_IDENTITY_GAP:' + domain + ':' + (source.name || index),
        domain: domain,
        source: source.name || null,
        sourceIndex: index,
        kind: kind,
        live: source.live === true,
        headlineCount: headlines ? source.headlines.length : 0,
        itemPublicationDatesPresent: published,
        sourceUpdatedAt: null,
        status: 'open',
        requiredAction: headlines
          ? 'Review an aggregate observation-identity contract. Item publication times and title-set hashes remain observational evidence; do not promote either to sourceUpdatedAt without a reviewed rule.'
          : 'Trace the adapter to the publisher response. Expose a source-supplied observation key with units/semantics, or record an explicit abstention. Never use fetchedAt/updated or a fallback constant as identity.'
      });
    });
  });
  return out;
}

var loaded;
try { loaded = loadSnapshot(); }
catch (e) { console.error('source-identity audit failed: ' + e.message); process.exit(1); }

var tasks = sourceList(loaded.value);
var byKind = tasks.reduce(function (acc, task) {
  acc[task.kind] = (acc[task.kind] || 0) + 1;
  return acc;
}, {});
var result = {
  generatedAt: new Date().toISOString(),
  readOnlyAudit: true,
  source: loaded.file,
  snapshotId: loaded.value && loaded.value.meta ? loaded.value.meta.snapshotId || null : null,
  note: 'Open identity tasks only. No timestamp is derived, and no task creates stress, diagnosis, pathway, or activation.',
  totalTasks: tasks.length,
  byKind: byKind,
  tasks: tasks
};

if (writeQueue) fs.writeFileSync(DEFAULT_QUEUE, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({
  readOnly: true,
  snapshotId: result.snapshotId,
  totalTasks: result.totalTasks,
  byKind: result.byKind,
  queue: writeQueue ? DEFAULT_QUEUE : null
}, null, 2));
