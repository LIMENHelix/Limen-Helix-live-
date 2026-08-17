/**
 * Shared authority evidence router. Authority IDs are explicit: an unknown
 * destination refuses instead of falling through to a provider-shaped shell.
 */
'use strict';

var PROVIDERS = {
  scotus_docket: require('./authority-scotus'),
  us_courts_caseload: require('./authority-caseload'),
  wjp_rol_index: require('./authority-wjp')
};
var SUPPORTED = Object.keys(PROVIDERS).sort();

function respond(res, status, body) {
  res.setHeader('Cache-Control', status === 400 ? 'no-store' : 's-maxage=60, stale-while-revalidate=0');
  return res.status(status).json(body);
}

module.exports = function authorityEvidence(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var authority = String((req.query && req.query.authority) || '').trim();
  if (!authority) return respond(res, 400, {
    ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: SUPPORTED
  });
  if (!Object.prototype.hasOwnProperty.call(PROVIDERS, authority)) return respond(res, 404, {
    ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED',
    detail: 'No evidence implementation exists for this authority.',
    requested: authority, supported: SUPPORTED
  });
  return PROVIDERS[authority](req, res);
};

module.exports.PROVIDERS = PROVIDERS;
module.exports.SUPPORTED = SUPPORTED;
