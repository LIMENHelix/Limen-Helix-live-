'use strict';

/**
 * Compatibility endpoint for the retired patent and grant/NSF expander.
 *
 * Those application lanes are intentionally gone. Keep a small explicit
 * refusal at the old route so stale clients cannot fall through into paid AI
 * generation and operators receive a truthful answer instead of a 404.
 */
module.exports = async function retiredArtifactExpander(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  res.status(410).json({
    ok: false,
    error: 'LANE_RETIRED',
    message: 'Patent and grant application generation is retired. Active lanes: investment, research.'
  });
};

