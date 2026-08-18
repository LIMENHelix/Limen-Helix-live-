'use strict';

var ATS = require('../lib/ats-seminary-enrollment');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=3600');
  res.end(JSON.stringify(body));
}

module.exports = async function authorityAts(req, res) {
  var authority = req && req.query && req.query.authority;
  if (authority !== 'ats_seminary_enrollment') return json(res, 404, { ok:false, error:'AUTHORITY_NOT_IMPLEMENTED', authority:authority || null });
  try {
    return json(res, 200, {
      ok: true,
      authority: authority,
      viewKind: 'ats_seminary_enrollment',
      descriptor: ATS.descriptor(),
      evidence: ATS.buildEvidence(),
      servedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(res, 503, { ok:false, error:error.code || 'ATS_SNAPSHOT_INVALID', message:error.message });
  }
};
