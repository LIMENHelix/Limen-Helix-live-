'use strict';

/* Declaration-only B9 candidate audit.  It looks for channels that two different
 * binders claim to observe, then rejects shared-provider overlaps as corroboration.
 * It does not read a clock, fetch data, declare a link, or activate a pathway. */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'assets', 'data', 'deep', 'cross-domain-edge-candidates.json');
var DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','technology','trade'];

function providerFamily(source) {
  var s = String(source || '').toLowerCase();
  if (!s) return null;
  if (s.indexOf('federalregister.gov') >= 0) return 'federalregister.gov';
  if (s.indexOf('api.weather.gov') >= 0) return 'api.weather.gov';
  if (s.indexOf('cisa') >= 0) return 'cisa';
  if (s.indexOf('usgs') >= 0) return 'usgs';
  if (s.indexOf('fda recalls') >= 0) return 'fda-recalls';
  if (s.indexOf('pubmed') >= 0) return 'pubmed';
  if (s.indexOf('arxiv') >= 0) return 'arxiv';
  if (s.indexOf('world bank') >= 0) return 'world-bank';
  if (s.indexOf('openalex') >= 0) return 'openalex';
  if (s.indexOf('ofac') >= 0) return 'ofac';
  if (s.indexOf('phmsa') >= 0) return 'phmsa';
  if (s.indexOf('uaw') >= 0) return 'uaw';
  if (s.indexOf('noaa') >= 0) return 'noaa';
  return s.split(/[,;|]/)[0].trim() || null;
}

var channels = [];
DOMAINS.forEach(function (domain) {
  var binder = require(path.join(ROOT, 'brain-v2', 'bind', domain + '.js'));
  var spec = typeof binder.spec === 'function' ? binder.spec() : binder;
  (spec.channels || []).forEach(function (channel) {
    channels.push({
      domain: domain,
      key: channel.key || null,
      name: channel.name || null,
      source: channel.source || channel.provider || null,
      providerFamily: providerFamily(channel.source || channel.provider)
    });
  });
});

var pairs = [];
for (var i = 0; i < channels.length; i++) {
  for (var j = i + 1; j < channels.length; j++) {
    var a = channels[i], b = channels[j];
    if (a.domain === b.domain) continue;
    var sameKey = !!a.key && a.key === b.key;
    var sameName = !!a.name && a.name === b.name;
    var sameSource = !!a.source && a.source === b.source;
    if (!sameKey && !sameName && !sameSource) continue;
    var sameProvider = !!a.providerFamily && a.providerFamily === b.providerFamily;
    pairs.push({
      a: a,
      b: b,
      overlap: { sameKey: sameKey, sameName: sameName, sameSource: sameSource },
      status: sameProvider ? 'REJECTED_SHARED_PROVIDER' : 'CANDIDATE_REQUIRES_REVIEW',
      reason: sameProvider
        ? 'both declarations resolve to the same upstream provider; this is not independent corroboration'
        : 'provider families differ by declaration, but independence, cadence, and observation identity still require review'
    });
  }
}

var shared = pairs.filter(function (p) { return p.status === 'REJECTED_SHARED_PROVIDER'; });
var candidates = pairs.filter(function (p) { return p.status === 'CANDIDATE_REQUIRES_REVIEW'; });
var report = {
  schemaVersion: 'cross-domain-edge-candidates/1.0',
  readOnly: true,
  note: 'Declaration-only audit. No link, pathway, corroboration, or activation is created.',
  domains: DOMAINS.length,
  channels: channels.length,
  overlapPairs: pairs.length,
  exactSourcePairs: pairs.filter(function (p) { return p.overlap.sameSource; }).length,
  sharedProviderPairs: shared.length,
  distinctProviderCandidates: candidates.length,
  pairs: pairs
};

if (require.main === module) {
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.indexOf('--write') >= 0) fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
}

module.exports = report;
