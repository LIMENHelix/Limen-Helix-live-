/**
 * patent-packager.js — turn a FILED/signed patent draft into a marketplace-ready
 * listing + a targeted list of likely licensees.
 *
 * ADDITIVE & SAFE: this only CONSUMES patent text. It does not touch the patent-
 * generation pipeline (patent-snapshot, engine-output-generator, print pipeline).
 *
 * Legal: only package AFTER filing — public disclosure before filing can bar
 * patent rights. The listing is a marketing teaser for licensees, not the full
 * enabling disclosure.
 */
const orch = require('../api/lib/ai-orchestrator');
const db = require('../api/lib/limen-db');

const LIST_KEY = 'patent:listings';

function _now() { return new Date().toISOString(); }
function _slug(s) { return String(s || 'patent').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
function _extractJson(t) {
  let s = (t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// input: { id?, title?, patentText, domain? }
async function packageListing(input) {
  input = input || {};
  if (!input.patentText || input.patentText.length < 80) return { ok: false, error: 'patentText required (the filed/signed patent body)' };

  const system = 'You are an IP licensing analyst. From a FILED patent draft, produce a MARKETPLACE LISTING that markets the invention to potential licensees. '
    + 'Market the value and applications; do NOT reproduce full enabling detail or step-by-step trade secrets beyond what a public listing needs. '
    + 'Output STRICT JSON only: {"title":"","abstract":"<=150 words","problem":"","solution":"","applications":["",""],"claimSummary":"one-paragraph plain-English summary of the independent claim","targetCompanies":[{"name":"","whyFit":""}],"suggestedVenues":["USPTO eOG:P","MarketBlast","Yet2","PatentAuction.com","Open IP Market"],"licensingNote":"","suggestedAskUSD":""}';
  const prompt = 'Patent (filed) draft follows. Produce the listing JSON; give 5–10 concrete targetCompanies with a one-line whyFit each.\n\n' + String(input.patentText).slice(0, 14000);

  const r = await orch.call('AUTHOR_PATTERN', { system: system, prompt: prompt, maxTokens: 2200 });
  if (!r.ok) return { ok: false, error: r.error, budget: r.budget || null };
  const parsed = _extractJson(r.text);
  if (!parsed) return { ok: false, error: 'could not parse listing JSON' };

  const listing = {
    id: input.id || (_slug(parsed.title || input.title) + '-' + Date.now()),
    source: input.title || parsed.title || 'patent',
    domain: input.domain || null,
    createdAt: _now(),
    status: 'packaged',           // packaged → outreach-sent → listed → inquiry → licensed
    listing: parsed,
    provider: r.provider,
    tokens: { in: r.tokensIn, out: r.tokensOut }
  };
  await db.lpush(LIST_KEY, listing);
  await db.ltrim(LIST_KEY, 0, 499);
  return { ok: true, listing: listing };
}

async function listings(limit) { return await db.lrange(LIST_KEY, 0, (limit || 100) - 1); }

// update status of a listing (e.g. when outreach sent / licensed) — keeps the ledger honest
async function setStatus(id, status) {
  const all = await listings(500);
  const idx = all.findIndex(function (x) { return x.id === id; });
  if (idx === -1) return { ok: false, error: 'listing not found' };
  all[idx].status = status;
  await db.set('patent:listings:status:' + id, { status: status, at: _now() });
  return { ok: true, id: id, status: status };
}

module.exports = { packageListing, listings, setStatus };
