/**
 * post-adapters.js — real per-platform publishing. Honest about each API's limits.
 *
 * Safety default: create as DRAFT / unpublished. Auto-publishing live to an audience is
 * outward-facing, so it requires an explicit opt-in (LIMEN_AUTOPUBLISH=1 or confirm flag),
 * even though content posting is NOT a money-movement sign-off item.
 *
 * Capability (verified 2026-06-06):
 *   beehiiv  → real Create Post API (draft by default; confirm to send)        [AUTO-DRAFT]
 *   printful → real create-product API, but needs variant_id + design file URL [AUTO IF ASSETS]
 *   gumroad  → NO create-product API (404); AI packages, human uploads          [PACKAGE-ONLY]
 *   others   → token-gated stub: hold as draft until an adapter is wired
 */

const db = require('./limen-db');   // owned-site publish channel
function _now() { return new Date().toISOString(); }

function _autopublish(opts) {
  return (opts && opts.confirm === true) || process.env.LIMEN_AUTOPUBLISH === '1';
}
function _disclosed(artifact) {
  const d = (artifact.disclosures || []).join(' ');
  const body = (artifact.content && (artifact.content.body || '')) || '';
  return d ? (body + '\n\n— ' + d) : body;
}

// ── Beehiiv: real Create Post (draft unless confirmed) ─────────────
async function beehiiv(artifact, opts) {
  const key = process.env.BEEHIIV_API_KEY;
  let pub = (process.env.BEEHIIV_PUB_ID || '').trim();
  if (!key || !pub) return { ok: false, status: 'needs-token', reason: 'Add BEEHIIV_API_KEY + BEEHIIV_PUB_ID to env.' };
  if (!/^pub_/.test(pub)) pub = 'pub_' + pub;   // Beehiiv requires the pub_ prefix; tolerate a raw UUID in env
  const status = _autopublish(opts) ? 'confirmed' : 'draft';
  const c = artifact.content || {};
  const r = await fetch('https://api.beehiiv.com/v2/publications/' + pub + '/posts', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: c.title || 'LIMEN Helix', status: status, body_content: '<p>' + _disclosed(artifact).replace(/\n/g, '<br>') + '</p>' })
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, status: 'platform-error', http: r.status, reason: (j && (j.errors || j.message)) || 'beehiiv error', hint: r.status === 403 ? 'Send/Create-Post API may need access enabled by Beehiiv.' : undefined };
  return { ok: true, status: status === 'confirmed' ? 'published' : 'draft-created', externalId: j.data && j.data.id, platform: 'beehiiv' };
}

// ── Printful: create product if design assets present ──────────────
async function printful(artifact, opts) {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) return { ok: false, status: 'needs-token', reason: 'Add PRINTFUL_API_KEY to env.' };
  const c = artifact.content || {};
  const pf = c.printful || {};   // expected: { variant_id, fileUrl, retail_price }
  if (!pf.variant_id || !pf.fileUrl) {
    return { ok: false, status: 'needs-design', reason: 'Printful product needs content.printful.variant_id + fileUrl (design). AI can generate the design; map a catalog variant_id first.' };
  }
  const r = await fetch('https://api.printful.com/store/products', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sync_product: { name: c.title || 'LIMEN Helix', thumbnail: pf.fileUrl },
      sync_variants: [{ variant_id: pf.variant_id, retail_price: String(pf.retail_price || '24.00'), files: [{ url: pf.fileUrl }] }]
    })
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, status: 'platform-error', http: r.status, reason: (j && j.error && j.error.message) || 'printful error' };
  return { ok: true, status: 'product-created', externalId: j.result && j.result.id, platform: 'printful' };
}

// ── Gumroad: no create API → package for manual upload ────────────
async function gumroad(artifact) {
  const c = artifact.content || {};
  return {
    ok: false, status: 'manual-upload', platform: 'gumroad',
    reason: 'Gumroad has no create-product API (returns 404). Asset is packaged below — upload once in the dashboard (~2 min).',
    package: { name: c.title || 'LIMEN Helix', description: _disclosed(artifact), suggestedPrice: c.suggestedPrice || '9', cta: c.cta || '' }
  };
}

// ── Owned site: publish to limenhelix.com/journal — fully autonomous, no platform gate ──
async function site(artifact) {
  const c = artifact.content || {};
  const autofire = artifact.autofire || {};
  const article = {
    id: artifact.id,
    streamId: artifact.streamId,
    lane: artifact.lane || null,
    outputId: artifact.outputId || artifact.id || null,
    actionId: autofire.actionId || artifact.actionId || null,
    ownerDomain: autofire.ownerDomain || artifact.ownerDomain ||
      (artifact.lane === 'investment' ? 'finance' : artifact.lane === 'research' ? 'research' : null),
    title: c.title || 'LIMEN Helix',
    preview: c.preview || '',
    body: _disclosed(artifact),
    cta: c.cta || '',
    affiliateLinks: artifact.affiliateLinks || [],
    sourceCard: artifact.sourceCard || null,
    provenance: artifact.provenance || null,
    publishedAt: _now()
  };
  try {
    await db.lpush('site:articles', article);
    await db.ltrim('site:articles', 0, 499);
    return { ok: true, status: 'site-published', externalId: artifact.id, url: '/journal#' + artifact.id, platform: 'site' };
  } catch (e) {
    return { ok: false, status: 'platform-error', reason: 'site publish failed: ' + (e && e.message || e) };
  }
}

const ADAPTERS = { beehiiv: beehiiv, printful: printful, gumroad: gumroad, site: site };

async function dispatch(artifact, opts) {
  const fn = ADAPTERS[artifact.connector];
  if (fn) return await fn(artifact, opts);
  return { ok: false, status: 'no-adapter', reason: 'No publish adapter for connector "' + artifact.connector + '". Content is queued; wire an adapter or publish manually.' };
}

module.exports = { dispatch, beehiiv, printful, gumroad, site };
