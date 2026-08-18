'use strict';

var IA = require('../lib/interfaith-america-pluralism');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=3600');
  res.end(JSON.stringify(body));
}

module.exports = async function authorityInterfaithAmerica(req, res) {
  var authority = req && req.query && req.query.authority;
  if (authority !== IA.AUTHORITY) return json(res, 404, { ok:false, error:'AUTHORITY_NOT_IMPLEMENTED', authority:authority || null });
  try {
    return json(res, 200, {
      ok: true,
      authority: authority,
      viewKind: 'interfaith_america_pluralism',
      descriptor: IA.descriptor(),
      evidence: IA.buildEvidence(),
      servedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(res, 503, { ok:false, error:error.code || 'INTERFAITH_SNAPSHOT_INVALID', message:error.message });
  }
};
