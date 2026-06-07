/**
 * stream-ops.js — autonomous content production + publishing for revenue streams.
 *
 * produce(): uses the multi-AI orchestrator to write platform-ready verbiage for a
 *            stream (post copy, hashtags, affiliate-link slots, mandatory AI-disclosure
 *            + FTC-affiliate-disclosure labels), cross-verifies, and queues the artifact.
 * publish(): dispatches a queued artifact to its platform IF the platform token exists;
 *            otherwise saves it as a draft flagged needs-token. No token = no silent post.
 *
 * Disclosure is NON-NEGOTIABLE and injected by code, not left to the model:
 *   - AI-generated media → platform synthetic-media label text.
 *   - Affiliate content   → FTC "#ad / affiliate link" disclosure.
 */
const orch = require('./ai-orchestrator');
const db = require('./limen-db');

const QUEUE_KEY = 'finance:content-queue';
const PUBLISHED_KEY = 'finance:published';

function _now() { return new Date().toISOString(); }
function _id(streamId, n) { return streamId + '-' + (n || Math.abs(hashStr(streamId + _now())) % 100000); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

// Map a stream to the env token its platform needs to actually publish.
const PLATFORM_TOKEN = {
  youtube: ['YOUTUBE_API_KEY'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  meta: ['META_ACCESS_TOKEN'],
  beehiiv: ['BEEHIIV_API_KEY', 'BEEHIIV_PUB_ID'],
  gumroad: ['GUMROAD_ACCESS_TOKEN'],
  etsy: ['ETSY_API_KEY'],
  printful: ['PRINTFUL_API_KEY'],
  manual: []
};

function _tokenReady(connector) {
  const keys = PLATFORM_TOKEN[connector] || [];
  if (keys.length === 0) return connector === 'manual' ? false : true; // manual always needs a human
  return keys.every(function (k) { return !!process.env[k]; });
}

// content format by connector → drives length + structure
function _format(stream) {
  const c = stream.connector;
  if (c === 'beehiiv' || c === 'site') return 'newsletter';   // long-form essays for the owned journal
  if (['gumroad', 'etsy', 'printful'].indexOf(c) > -1) return 'storefront';
  if (['youtube', 'tiktok', 'meta', 'pinterest'].indexOf(c) > -1 || (stream.id && stream.id.indexOf('faceless') > -1)) return 'social';
  return 'post';
}

// robust JSON extraction: strips ```json fences, falls back to first {...} block
function _extractJson(t) {
  let s = (t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// ── PRODUCE: generate the verbiage (format-aware) ──────────────────
async function produce(stream, brand) {
  brand = brand || {};
  const isAI = stream.connector === 'youtube' || stream.connector === 'tiktok' || (stream.id && stream.id.indexOf('faceless') > -1);
  const isAffiliate = stream.category === 'affiliate' || (stream.connector && ['amazon_paapi', 'impact', 'rakuten', 'shareasale', 'cj', 'clickbank'].indexOf(stream.connector) > -1);
  const format = _format(stream);
  const niche = brand.niche || 'systemic-risk intelligence / KC business / AI tooling';

  // ── Stage 1 · RETRIEVE (Grok): current/timely angles for this niche ──
  let retrieved = null, retrieveProvider = null, retrieveErr = null;
  try {
    const rr = await orch.call('RETRIEVE', { prompt: 'In 4-5 terse factual bullets, what hooks/angles/keywords are working RIGHT NOW for ' + format + ' content in this niche: ' + niche + (stream.connector ? (' (platform: ' + stream.connector + ')') : '') + '. Specifics only, no preamble.', maxTokens: 500 });
    if (rr.ok) { retrieved = (rr.text || '').trim().slice(0, 1200); retrieveProvider = rr.provider; }
    else { retrieveErr = (rr.error || 'retrieve failed').slice(0, 160); }
  } catch (e) { retrieveErr = String(e && e.message || e).slice(0, 160); }

  // schema + length tuned per format; all formats keep title + body for the adapters
  const SCHEMA = {
    newsletter: '{"title":"<subject line>","preview":"<inbox preview, <90 chars>","body":"<full issue, 350-600 words, 3 sections with ## headings, scannable>","cta":"","linkSlots":["affiliate|stripe"]}',
    storefront: '{"title":"<product name>","body":"<product description, 120-200 words, benefit-led>","suggestedPrice":"<usd number>","cta":"","linkSlots":["stripe"]}',
    social: '{"title":"<hook>","body":"<post, 60-120 words>","hashtags":["",""],"cta":"","linkSlots":["amazon|affiliate"]}',
    post: '{"title":"","body":"","hashtags":["",""],"cta":"","linkSlots":["amazon|affiliate|stripe"]}'
  };
  const LEN = { newsletter: 2400, storefront: 900, social: 700, post: 1200 };

  // ── Corpus grounding (IP-safe): back the piece with the author's real framework ──
  let sourceCard = null, grounding = '', ipGuard = '';
  try {
    const corpus = require('./corpus');
    sourceCard = corpus.select(stream, brand);
    if (sourceCard) { grounding = corpus.groundingText(sourceCard); ipGuard = corpus.ipGuard(); }
  } catch (e) { /* corpus optional */ }

  const system = 'You write platform-ready, high-educational ' + format + ' content for LIMEN Helix'
    + (sourceCard ? (' grounded in the author’s cross-domain framework (' + (sourceCard.domains || []).join(', ') + ')') : '') + '. '
    + 'Output STRICT JSON only matching this shape: ' + SCHEMA[format] + '. '
    + 'Voice: precise, credible, non-hype; cite the referenced frameworks where they fit. '
    + 'This is EDUCATIONAL content, not medical or financial advice; never promise outcomes or returns; no fabricated statistics. '
    + (ipGuard ? ('IP RULE: ' + ipGuard) : '');
  const prompt = 'Stream: ' + (stream.name || stream.id) + '\nCategory: ' + (stream.category || '') + '\nConnector: ' + (stream.connector || '')
    + '\nFormat: ' + format + '\nBrand: ' + (brand.name || 'LIMEN Helix') + '\nNiche: ' + niche
    + (grounding ? ('\n\nGROUND THE PIECE IN THIS SOURCE (use the concepts, cross-domain examples, and references; quote only the listed verbatim quotes; obey the GUARDS):\n' + grounding) : '')
    + (retrieved ? ('\nCurrent angles (use what is relevant, ignore the rest):\n' + retrieved) : '')
    + '\nWrite one publishable ' + format + '. JSON only.';

  // ── Stage 2 · AUTHOR (Anthropic) ──
  const draftRes = await orch.call('REFRESH_ARTIFACT', { system: system, prompt: prompt, maxTokens: LEN[format] });
  if (!draftRes.ok) return { ok: false, error: 'produce failed: ' + draftRes.error, budget: draftRes.budget || null };

  let parsed = _extractJson(draftRes.text) || { title: stream.name, body: draftRes.text, hashtags: [], cta: '', linkSlots: [] };

  // ── Stage 3 · VERIFY (OpenAI) cross-check — flags hype/claims; advisory only ──
  let verify = null, verifyProvider = null;
  try {
    const vr = await orch.call('VERIFY', { prompt: 'Reply OK or list problems (claims, guarantees, missing disclosure) in this post:\n' + JSON.stringify(parsed), maxTokens: 256 });
    if (vr.ok) { verify = vr.text.trim().slice(0, 400); verifyProvider = vr.provider; }
  } catch (e) {}

  // Affiliate-link injection (tracked links for the content's own topic)
  let affiliateLinks = [];
  try {
    const injector = require('./affiliate-injector');
    const inj = injector.inject(parsed, stream);
    parsed = inj.content;
    affiliateLinks = inj.links;
  } catch (e) { /* injector optional; content still valid without it */ }

  // Code-injected disclosures (never trust the model to remember)
  const disclosures = [];
  if (isAI) disclosures.push('Contains AI-generated media.');
  if (isAffiliate || affiliateLinks.length) disclosures.push('#ad — contains affiliate links; we may earn a commission.');

  const artifact = {
    id: _id(stream.id),
    streamId: stream.id,
    connector: stream.connector,
    format: format,
    createdAt: _now(),
    status: 'queued',
    content: parsed,
    disclosures: disclosures,
    affiliateLinks: affiliateLinks,
    verify: verify,
    tokenReady: _tokenReady(stream.connector),
    provider: draftRes.provider,
    provenance: { retrieve: retrieveProvider, author: draftRes.provider, verify: verifyProvider, retrieveError: retrieveErr },
    retrievedContext: !!retrieved,
    sourceCard: sourceCard ? sourceCard.id : null,
    tokens: { in: draftRes.tokensIn, out: draftRes.tokensOut }
  };
  await db.lpush(QUEUE_KEY, artifact);
  await db.ltrim(QUEUE_KEY, 0, 999);
  return { ok: true, artifact: artifact };
}

// ── PUBLISH: dispatch to the real platform adapter ─────────────────
const adapters = require('./post-adapters');
async function publish(artifact, opts) {
  const result = await adapters.dispatch(artifact, opts);
  // Record every outcome so the ledger/audit sees it — nothing silently dropped.
  const rec = {
    id: artifact.id, streamId: artifact.streamId, connector: artifact.connector,
    publishedAt: _now(), status: result.status, ok: result.ok,
    externalId: result.externalId || null, reason: result.reason || null,
    title: (artifact.content && artifact.content.title) || ''
  };
  await db.lpush(PUBLISHED_KEY, rec);
  await db.ltrim(PUBLISHED_KEY, 0, 999);
  return Object.assign({ recorded: true }, result);
}

async function queue(limit) { return await db.lrange(QUEUE_KEY, 0, (limit || 50) - 1); }
async function published(limit) { return await db.lrange(PUBLISHED_KEY, 0, (limit || 50) - 1); }

module.exports = { produce, publish, queue, published, _tokenReady, PLATFORM_TOKEN };
