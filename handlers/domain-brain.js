/**
 * handlers/domain-brain.js — public, read-only brain-v2 operator surface.
 *
 * GET /api/domain-brain?domain=energy returns the latest persisted brain-v2 cycle for one
 * canonical domain. GET without a domain returns the twenty-domain fleet. This handler never
 * runs a cycle and never writes state. It publishes only operator-readout.js projections;
 * packets, raw values, source identities, memory and executable predicates remain private.
 */
'use strict';

var RUNTIME = require('../lib/brain-shadow-runtime');
var STORE = require('../lib/brain-shadow-store');
var REG = require('../brain-v2/bind/registry.js');
var READOUT = require('../brain-v2/core/operator-readout.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

async function readProduct(product) {
  var descriptor = REG.descriptorFor(product);
  if (!descriptor) return null;
  var report = await STORE.readCycle(descriptor.snapshot);
  if (!report) {
    return {
      ok: false,
      ready: false,
      authority: 'brain-v2',
      domain: descriptor.snapshot,
      product: product,
      error: 'no persisted brain-v2 cycle yet'
    };
  }
  var projected = READOUT.publicReport(report);
  projected.ready = !!projected.state;
  return projected;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });

  var url = new URL(req.url, 'http://localhost');
  var requested = url.searchParams.get('domain');

  try {
    if (requested) {
      if (!REG.descriptorFor(requested)) {
        return send(res, 400, {
          ok: false,
          error: 'unknown domain',
          allowed: RUNTIME.INSTALLED_DOMAINS
        });
      }
      return send(res, 200, await readProduct(requested));
    }

    var domains = {};
    for (var i = 0; i < RUNTIME.INSTALLED_DOMAINS.length; i++) {
      var product = RUNTIME.INSTALLED_DOMAINS[i];
      var read = await readProduct(product);
      domains[read.domain || product] = read;
    }
    var keys = Object.keys(domains);
    return send(res, 200, {
      ok: keys.every(function (key) { return domains[key].ok === true; }),
      authority: 'brain-v2',
      runtime: RUNTIME.RUNTIME_VERSION,
      installedCount: keys.length,
      readyCount: keys.filter(function (key) { return domains[key].ready; }).length,
      domains: domains
    });
  } catch (error) {
    return send(res, 500, {
      ok: false,
      authority: 'brain-v2',
      error: (error && error.message) || String(error)
    });
  }
};
