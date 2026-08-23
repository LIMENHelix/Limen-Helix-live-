#!/usr/bin/env node
'use strict';

/*
 * Read-only production/source-surface audit.
 *
 * Usage:
 *   node scripts/audit-runtime-source-surface.js
 *   node scripts/audit-runtime-source-surface.js --input snapshot.json
 *   node scripts/audit-runtime-source-surface.js --url=https://example/api/domain-snapshot
 *
 * This reports what the snapshot contains. It does not infer that a source is
 * authoritative, fresh, semantically sufficient, or safe to drive stress.
 */

var fs = require('fs');
var path = require('path');
var registry = require('../brain-v2/bind/registry.js');

var DEFAULT_URL = 'https://limenhelix.com/api/domain-snapshot';
var inputArg = process.argv.find(function (a) { return a.indexOf('--input=') === 0; });
var urlArg = process.argv.find(function (a) { return a.indexOf('--url=') === 0; });
var inputPath = inputArg ? inputArg.slice('--input='.length) : null;
var url = urlArg ? urlArg.slice('--url='.length) : DEFAULT_URL;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
  catch (e) { throw new Error('could not read --input file: ' + e.message); }
}

async function load() {
  if (inputPath) return readJson(inputPath);
  if (typeof fetch !== 'function') throw new Error('Node fetch is unavailable; use --input=snapshot.json');
  var response = await fetch(url);
  if (!response.ok) throw new Error('snapshot HTTP ' + response.status);
  return response.json();
}

function domainEntries(domains) {
  if (!domains || typeof domains !== 'object') return [];
  if (Array.isArray(domains)) return domains.map(function (value, index) { return [String(index), value]; });
  return Object.keys(domains).map(function (key) { return [key, domains[key]]; });
}

function auditDomain(runtimeKey, value, promoted) {
  var sources = value && Array.isArray(value.sources) ? value.sources : [];
  var live = sources.filter(function (s) { return s && s.live === true; }).length;
  var headlines = sources.filter(function (s) {
    return s && ((Array.isArray(s.headlines) && s.headlines.length > 0) ||
      (Array.isArray(s.headlineLinks) && s.headlineLinks.length > 0));
  }).length;
  var updated = sources.filter(function (s) { return s && s.sourceUpdatedAt !== null && s.sourceUpdatedAt !== undefined; }).length;
  var missingUpdated = sources.length - updated;
  var text = sources.filter(function (s) {
    /* `signal` is generated numeric narration, not source-supplied semantics. */
    return s && ((typeof s.text === 'string' && s.text.length > 0) ||
      (typeof s.title === 'string' && s.title.length > 0) ||
      (Array.isArray(s.headlines) && s.headlines.length > 0));
  }).length;
  var descriptor = registry.descriptorFor(runtimeKey);
  return {
    runtimeKey: runtimeKey,
    product: descriptor ? descriptor.product : null,
    canonicalRuntimeKey: descriptor ? descriptor.snapshot : null,
    present: !!value,
    sourceCount: sources.length,
    liveCount: live,
    fallbackCount: sources.filter(function (s) { return s && s.live === false; }).length,
    headlineBearingSources: headlines,
    textFieldSources: text,
    sourceUpdatedAtPresent: updated,
    sourceUpdatedAtMissing: missingUpdated,
    status: value && value.status || null,
    stressBasis: value && value.stressBasis || null,
    stressUsable: value && value.stressUsable === true,
    promotedStress: promoted.indexOf(runtimeKey) !== -1,
    semanticSurface: headlines > 0 || text > 0 ? 'present' : 'numeric-or-empty'
  };
}

load().then(function (snapshot) {
  var meta = snapshot && snapshot.meta || {};
  var promoted = Array.isArray(meta.promotedStressDomains) ? meta.promotedStressDomains : [];
  var byKey = Object.create(null);
  domainEntries(snapshot && snapshot.domains).forEach(function (entry) { byKey[entry[0]] = entry[1]; });
  var rows = registry.SNAPSHOT_KEYS.map(function (key) { return auditDomain(key, byKey[key], promoted); });
  var missing = rows.filter(function (r) { return !r.present; });
  var out = {
    readOnly: true,
    source: inputPath ? path.resolve(inputPath) : url,
    snapshotId: meta.snapshotId || null,
    fetchedAt: meta.fetchedAt || null,
    metaLiveCount: meta.liveCount === undefined ? null : meta.liveCount,
    metaFallbackCount: meta.fallbackCount === undefined ? null : meta.fallbackCount,
    domains: rows.length,
    presentDomains: rows.filter(function (r) { return r.present; }).length,
    missingDomains: missing.map(function (r) { return r.runtimeKey; }),
    liveSources: rows.reduce(function (n, r) { return n + r.liveCount; }, 0),
    headlineBearingSources: rows.reduce(function (n, r) { return n + r.headlineBearingSources; }, 0),
    textFieldSources: rows.reduce(function (n, r) { return n + r.textFieldSources; }, 0),
    sourcesMissingUpdatedAt: rows.reduce(function (n, r) { return n + r.sourceUpdatedAtMissing; }, 0),
    rows: rows
  };
  if (process.argv.indexOf('--json') !== -1) console.log(JSON.stringify(out, null, 2));
  else {
    console.log('Runtime source-surface audit (read-only)');
    console.log(JSON.stringify({ snapshotId: out.snapshotId, fetchedAt: out.fetchedAt,
      domains: out.domains, present: out.presentDomains, missing: out.missingDomains,
      liveSources: out.liveSources, headlineBearingSources: out.headlineBearingSources,
      textFieldSources: out.textFieldSources, sourcesMissingUpdatedAt: out.sourcesMissingUpdatedAt }, null, 2));
    rows.forEach(function (r) {
      console.log(r.runtimeKey + ' [' + (r.product || 'unmapped') + '] sources=' + r.sourceCount +
        ' live=' + r.liveCount + ' headlines=' + r.headlineBearingSources +
        ' textFields=' + r.textFieldSources + ' sourceUpdatedAt=' + r.sourceUpdatedAtPresent + '/' + r.sourceCount +
        ' semantic=' + r.semanticSurface);
    });
  }
  if (missing.length) process.exitCode = 1;
}).catch(function (err) {
  console.error('runtime source-surface audit failed: ' + err.message);
  process.exitCode = 1;
});
