#!/usr/bin/env node
'use strict';

/*
 * Read-only company-portal domain-routing audit.
 *
 * Company identity JSON is an authored source surface and may legitimately
 * retain runtime or historical domain labels. This audit resolves each label
 * at read time and proves that its canonical portal target exists. It never
 * edits or rewrites a company record.
 */

var fs = require('fs');
var path = require('path');
var identity = require('../assets/js/domain-identity.js');

var ROOT = path.join(__dirname, '..');
var COMPANY_DIR = path.join(ROOT, 'assets', 'data', 'companies');
var rawCounts = Object.create(null);
var routeCounts = Object.create(null);
var staleAttachmentCounts = Object.create(null);
var failures = [];

fs.readdirSync(COMPANY_DIR).filter(function (name) {
  return name.endsWith('.json') && name[0] !== '_';
}).sort().forEach(function (name) {
  var record;
  try { record = JSON.parse(fs.readFileSync(path.join(COMPANY_DIR, name), 'utf8')); }
  catch (error) {
    failures.push({ file: name, reason: 'invalid-json', detail: error.message });
    return;
  }
  var raw = record.domainId || null;
  if (!raw) {
    failures.push({ file: name, reason: 'missing-domainId' });
    return;
  }
  var resolved = identity.resolve(raw);
  var target = resolved.portalKey + '_portal.html';
  rawCounts[raw] = (rawCounts[raw] || 0) + 1;
  routeCounts[target] = (routeCounts[target] || 0) + 1;
  if (record.portalAttachment && record.portalAttachment !== target) {
    var staleKey = record.portalAttachment + ' -> ' + target;
    staleAttachmentCounts[staleKey] = (staleAttachmentCounts[staleKey] || 0) + 1;
  }
  if (!fs.existsSync(path.join(ROOT, target))) {
    failures.push({ file: name, rawDomain: raw, canonical: resolved.canonical, target: target, reason: 'missing-target' });
  }
});

var aliases = Object.keys(rawCounts).filter(function (raw) {
  return identity.resolve(raw).canonical !== raw;
}).sort().map(function (raw) {
  var resolved = identity.resolve(raw);
  return {
    rawDomain: raw,
    records: rawCounts[raw],
    canonical: resolved.canonical,
    portalKey: resolved.portalKey,
    target: resolved.portalKey + '_portal.html'
  };
});

var report = {
  schemaVersion: 'company-portal-domain-routing-audit/1.0',
  readOnly: true,
  companyRecords: Object.keys(rawCounts).reduce(function (n, key) { return n + rawCounts[key]; }, 0),
  rawDomainLabels: Object.keys(rawCounts).length,
  canonicalDomains: identity.allCanonical().length,
  aliasRoutes: aliases,
  staleAttachmentRecords: Object.keys(staleAttachmentCounts).reduce(function (n, route) {
    return n + staleAttachmentCounts[route];
  }, 0),
  staleAttachmentRoutes: Object.keys(staleAttachmentCounts).sort().map(function (route) {
    return { route: route, records: staleAttachmentCounts[route] };
  }),
  routeCounts: routeCounts,
  failures: failures
};

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
