/**
 * /api/print-document — expand a seed artifact into a 20-30 page filing-ready
 * DOCX and stream it as a download.
 *
 * GET /api/print-document?slug=<portalSlug>&lane=<patent|grant|sba|research>&index=<n>
 *   → Content-Disposition: attachment; filename="..."; Content-Type docx
 *
 * Long-form generator targets a NEW BUSINESS WITH NO INVESTOR YET:
 *   patent → USPTO Pro Se / Micro Entity utility specification (18-25 pages)
 *   grant  → NIH SBIR Phase I application (~$314k ceiling, 6mo) (20-30 pages)
 *   sba    → SBA Microloan or Express package (pre-revenue, no DSCR) (15-25 pages)
 *   research → OSF preregistration for independent researcher (8-15 pages)
 *
 * Realism rules baked into the system prompts in long-form-generator.js:
 *   - No fabricated dollar amounts beyond bridge/portal context
 *   - No fabricated citations
 *   - No claims of operating history that doesn't exist
 *   - Honest "pre-revenue, sole-founder" framing
 *   - USPTO Micro Entity / SBIR Phase I / SBA Microloan eligibility
 */
const fs = require('node:fs');
const path = require('node:path');
const { generate } = require('../lib/long-form-generator.js');
const { renderToBuffer } = require('../lib/markdown-to-docx.js');
const { loadPortal } = require('../lib/portal-loader');

function _getArtifact(p, lane, index) { const list = p.engineOutputs && p.engineOutputs[lane]; return list && list[parseInt(index, 10)] || null; }
function _getBridge(p, patternId) { return (p.bridgeReadings && p.bridgeReadings.matched || []).find(m => m.patternId === patternId); }

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const slug = q.slug;
    const lane = q.lane;
    const index = q.index || '0';
    const format = (q.format || 'docx').toLowerCase();

    if (!slug || !lane) return res.status(400).json({ error: 'slug + lane required' });
    if (!['research'].includes(lane)) return res.status(400).json({ error: 'lane must be research (patent/grant/sba retired; investment prints via /api/print-from-pattern)' });

    const _pl = await loadPortal(slug);
    const portal = _pl.portal;
    res.setHeader('X-LIMEN-PORTAL-LOADER', _pl.source);
    if (!portal) return res.status(404).json({ error: 'portal not found: ' + slug });

    let seed = _getArtifact(portal, lane, index);
    // If the requested lane has no seed (e.g. SBA — no derivedAngles in current
    // patterns), synthesize a seed from any matched bridge so the long-form
    // generator still has anchoring context.
    if (!seed) {
      const matched = (portal.bridgeReadings && portal.bridgeReadings.matched) || [];
      if (matched.length === 0) return res.status(404).json({ error: 'no bridge match on portal — cannot anchor long-form for ' + slug });
      const b = matched[0];
      seed = { lane, patternId: b.patternId, confidence: b.confidence, artifact: { synthesized: true, fromBridge: b.patternId, note: 'No prior seed artifact for ' + lane + '; long-form generator anchors directly to bridge.' } };
    }

    const bridge = _getBridge(portal, seed.patternId) || (portal.bridgeReadings && portal.bridgeReadings.matched && portal.bridgeReadings.matched[0]);
    if (!bridge) return res.status(404).json({ error: 'bridge match not found' });

    console.log('[print-document] generating', { slug, lane, patternId: bridge.patternId, format });
    const result = await generate({ lane, seedArtifact: seed, bridge, portal, maxTokens: 16000 });
    if (!result.ok) return res.status(502).json({ error: 'long-form generation failed', details: result.error });

    if (format === 'md' || format === 'markdown') {
      const fname = (portal.ticker || slug).toUpperCase() + '__' + lane + '__' + new Date().toISOString().slice(0, 10) + '.md';
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="' + fname + '"');
      return res.status(200).send(result.markdown);
    }

    // Render to DOCX
    const titlePrefix = lane === 'patent' ? 'PATENT APPLICATION' : lane === 'grant' ? 'NIH SBIR PHASE I' : lane === 'sba' ? 'SBA MICROLOAN' : 'PREREGISTRATION';
    const buf = await renderToBuffer(result.markdown, {
      title: titlePrefix + ' — ' + (portal.name || slug),
      subject: bridge.patternId,
      description: 'LIMEN Helix · bridge ' + bridge.patternId + ' · seed lane ' + lane
    });

    const fname = (portal.ticker || slug).toUpperCase() + '__' + lane + '__' + bridge.patternId.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) + '__' + new Date().toISOString().slice(0, 10) + '.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fname + '"');
    res.setHeader('X-Limen-Tokens-Used', String(result.tokensUsed || 0));
    res.setHeader('X-Limen-Provider', result.provider || '');
    res.setHeader('X-Limen-Model', result.model || '');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('[print-document]', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
