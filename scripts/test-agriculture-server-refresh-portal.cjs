#!/usr/bin/env node
'use strict';

// Focused regression: the hosted cognition VM must be able to read the shipped
// Agriculture portal before deriving diagnoses. This stays read-only and uses
// the real p2_agri artifact from the checkout as the pinned asset response.
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

var ROOT = path.join(__dirname, '..');
var refreshSource = fs.readFileSync(path.join(ROOT, 'handlers/brain-cognition-refresh.js'), 'utf8');
var start = refreshSource.indexOf('function buildSandbox');
var endMatch = /\r?\n\r?\nmodule\.exports/.exec(refreshSource.slice(start));
var end = endMatch ? start + endMatch.index : -1;
assert(start >= 0 && end > start, 'brain refresh sandbox function must remain discoverable');

function responseFor(url) {
  var pathname = new URL(String(url)).pathname;
  var allowed = {
    '/assets/data/domains/p2_agri.json': true,
    '/assets/data/deep/p2_agri-diagnosis-digest.json': true,
    '/assets/data/deep/p2_agri-fold.json': true
  };
  if (!allowed[pathname]) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  var file = path.join(ROOT, pathname.replace(/^\//, '').replace(/\//g, path.sep));
  if (!fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  var body = fs.readFileSync(file, 'utf8');
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } });
}

var context = {
  URL: URL,
  URLSearchParams: URLSearchParams,
  Promise: Promise,
  JSON: JSON,
  Buffer: Buffer,
  fetch: responseFor
};
vm.createContext(context);
vm.runInContext(refreshSource.slice(start, end) + '\nthis.buildSandbox = buildSandbox;', context, { filename: 'handlers/brain-cognition-refresh.js' });

var feed = function (name, value, label, signal) {
  return { name: name, value: value, label: label || name, signal: signal || label || name, live: true, channel: 'stress' };
};
var snap = {
  domains: {
    agriculture: {
      feeds: [
        feed('USDA Drought Monitor', 33.58, '33.6% CONUS in D2+ drought'),
        feed('NOAA NWS Ag Alerts', 123, '123 ag-impact alerts'),
        feed('RSS Agriculture', 73, '73 articles', 'fertilizer shortage and grain export disruption'),
        feed('Fed Reg APHIS', 8, '8 APHIS docs'),
        feed('Fed Reg EPA', 20, '20 EPA docs'),
        feed('World Bank Food Index', -3.55, 'Food production -3.55% YoY')
      ],
      signals: ['drought and fertilizer shortage are affecting agriculture']
    },
  },
  meta: {},
  domainCompanyJoin: {}
};

var sandbox = context.buildSandbox(snap, 'https://local.invalid', {});
sandbox.LIMENDomainBrains = { register: function () {} };
sandbox.window.LIMENDomainBrains = sandbox.LIMENDomainBrains;
vm.createContext(sandbox);
[
  'assets/js/domain-identity.js',
  'assets/js/limen-k4-selfconsistency.js',
  'assets/js/limen-plasticity.js',
  'assets/js/limen-active-inference.js',
  'assets/js/domain-brains/domain-brain-base.js',
  'assets/js/domain-brains/portal-content-resolver.js',
  'assets/js/domain-brains/inter-brain-bus.js',
  'assets/js/domain-brains/domain-change-log.js',
  'assets/js/domain-brains/agriculture-brain.js'
].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

(async function () {
  var brain = sandbox.LIMENAgricultureBrain;
  assert(brain, 'Agriculture brain must load in hosted-style VM');
  await brain.cycle();
  assert(brain._portalCache && Array.isArray(brain._portalCache.issues), 'hosted VM must load p2_agri issues');
  assert(brain._activeConditions.indexOf('water_stress') >= 0, 'live drought feed must become an Agriculture condition');
  assert(brain.state.diagnoses.some(function (d) { return d.active; }), 'portal-backed Agriculture diagnosis must activate');
  assert(brain.state.opportunities.some(function (o) { return o.domain === 'agriculture'; }), 'active Agriculture diagnosis must produce an opportunity');
  console.log('agriculture server refresh: pinned p2_agri asset access restores diagnosis and opportunity derivation');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
