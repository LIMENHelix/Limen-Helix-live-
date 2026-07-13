/**
 * LIMEN Helix — Reciprocity Prose Rewrite (Phase 2)
 *
 * POST /api/limen-reciprocity-prose-rewrite
 *
 * Tightly scoped Haiku 4.5 call that rewrites the boilerplate
 * relationshipNote on reciprocity-derived stub entries. Phase 1 of
 * this fix populated structural fields (sourceType, confidence,
 * brainNodeId, brainNodeRole, neuralRole) via inheritance from
 * partner portals. Phase 2 replaces the generic note
 *   "X is a customer of this entity, per reciprocity audit..."
 * with a 50-70w note from THIS portal's perspective grounded in
 * what the partner publicly does.
 *
 * Strict integrity rules — no fabrication:
 *   - NEVER invent dollar amounts, contract names, dates, percentages
 *   - NEVER claim tier ("Tier 1 supplier") without partner evidence
 *   - NEVER cite specific filings the model can't verify
 *   - ALLOWED: name the partner's publicly-known products / industry
 *   - ALLOWED: describe the structural relationship category
 *   - ALLOWED: reference brainNodeRole and brainNodeId labels
 *
 * Request body:
 *   {
 *     "hostPortal": {
 *       "slug": "abbott_laboratories",
 *       "name": "Abbott Laboratories",
 *       "industry": "Pharmaceutical Preparations",
 *       "domainId": "medicine",
 *       "businessSummary": "first 500c of portalRelevance text"
 *     },
 *     "stubs": [
 *       {
 *         "slug": "insulet",
 *         "category": "customers",
 *         "name": "Insulet Corporation",
 *         "ticker": "PODD",
 *         "brainNodeId": "S1",
 *         "brainNodeRole": "downstream_demand_anchor",
 *         "neuralRole": "feedforward_demand_signal"
 *       }, ...
 *     ],
 *     "partnerSummaries": {
 *       "insulet": {
 *         "name": "Insulet Corporation",
 *         "industry": "Medical Devices",
 *         "businessSummary": "first 400c of partner's portalRelevance",
 *         "theirView": "first 300c of partner's reciprocal entry's relationshipNote (their description of the host)"
 *       }, ...
 *     }
 *   }
 *
 * Response:
 *   {
 *     "ok": true,
 *     "rewrites": [
 *       { "slug": "insulet", "relationshipNote": "Insulet's Omnipod...", "wordCount": 62 },
 *       ...
 *     ],
 *     "model": "claude-haiku-4-5-20251001",
 *     "elapsedMs": 4321
 *   }
 *
 * On invalid output (banned vocab, wrong word count, missing slugs),
 * returns { ok: false, error: ..., parseError: ..., rawTextHead: ... }
 * so the orchestrator can retry or skip.
 *
 * Auth: gated by LIMEN_OPERATOR_TOKEN bearer if set (mirrors
 * limen-engine-output / limen-outcome).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.RECIPROCITY_MODEL ||
                        process.env.ANTHROPIC_MODEL ||
                        'claude-haiku-4-5-20251001';
const ANTHROPIC_MAX_TOKENS = parseInt(process.env.RECIPROCITY_MAX_TOKENS || '4000', 10);
const ANTHROPIC_TIMEOUT_MS = parseInt(process.env.RECIPROCITY_TIMEOUT_MS || '90000', 10);
const ANTHROPIC_VERSION = '2023-06-01';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;

const BANNED_TERMS = [
  'limen', 'limenhelix', 'limenhelix.com',
  'kernel phase', 'kernel state', 'polyvagal',
  'thing 1', 'thing 2', 'thing1', 'thing2',
  'civilization brain', 'connectome brain', 'master brain',
  'master living brain', 'super-brain', 'super brain',
  'domain brain', 'sub-brain', 'fractal brain', 'fractal recursive',
  'pattern envelope', 'pattern broker', 'pattern signature',
  'dominant phase', 'phase confidence', 'phase vector',
  'phase tracking', 'phase logic', 'salience score',
  'opportunity signal', 'cross-domain audit', 'handoff packet',
  'per reciprocity audit', 'structural reciprocity fill',
  'see X portal for canonical narrative' // boilerplate must not be regenerated
];

// Per-category narrative template for the model — what kind of
// relationship each category encodes, in THIS portal's voice.
const CATEGORY_FRAMING = {
  customers:         'This entity is a CUSTOMER of the host. The host SUPPLIES or SERVES this entity.',
  suppliers:         'This entity is a SUPPLIER to the host. The host BUYS FROM or DEPENDS ON this entity.',
  competitors:       'This entity COMPETES WITH the host in the same market or product category.',
  logisticsPartners: 'This entity provides TRANSPORT or LOGISTICS services to the host.',
  capitalProviders:  'This entity is a CAPITAL PROVIDER to the host (banker, lender, investor).',
  regulators:        'This entity REGULATES or sets policy that the host must comply with.'
};

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true, mode: 'disabled' };
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true, mode: 'operator' };
}

function buildSystemPrompt() {
  return `You are a senior equity-research analyst rewriting reciprocity-derived stub entries on company portal JSON documents.

Each request gives you ONE host portal and a list of stub entries that currently have boilerplate text like "X is a customer of this entity, per reciprocity audit. See X portal for canonical narrative..."

Your job: replace each stub's relationshipNote with a dense 50-70 word note FROM THE HOST PORTAL'S PERSPECTIVE describing the partner.

═══════════════════════════════════════════════════════════════════
INTEGRITY RULES — ABSOLUTE
═══════════════════════════════════════════════════════════════════

1. NEVER invent specific dollar amounts (no "$2.3B contract", no
   "12% of revenue"). If unknown, omit the number — do not
   approximate, do not hedge with "approximately".

2. NEVER invent contract names, program names, deal codes, or
   specific dates. ("Project Atlas", "Q3 2024 master services
   agreement", "since 2019" — all forbidden unless visibly named
   in the partnerSummary you were given.)

3. NEVER claim partnership tier ("Tier 1 supplier",
   "preferred vendor", "exclusive distributor") without evidence
   in the partnerSummary.

4. NEVER cite specific SEC filings, earnings calls, or press
   releases by date or quarter. The sourceType array carries the
   audit trail for you.

5. NEVER use the word "approximately" or "roughly" with numbers.
   Either you know the number from context, or omit it.

6. ALLOWED — name the partner's PUBLICLY KNOWN products and
   business categories. ("Omnipod insulin pump", "AWS cloud
   services", "Lipitor brand"). These are public-domain product
   names, not fabricated specifics.

7. ALLOWED — describe the structural relationship using the
   category framing provided. ("As a customer of...", "The host
   buys from...", "Competes in the same therapeutic area...")

8. ALLOWED — reference the brainNodeRole or neuralRole if they
   inform the relationship character.

═══════════════════════════════════════════════════════════════════
WORD COUNT — STRICT
═══════════════════════════════════════════════════════════════════

Each relationshipNote: 50-70 words. Not 49, not 71. Count words
before returning. Output that violates word count will be rejected.

═══════════════════════════════════════════════════════════════════
BANNED VOCABULARY
═══════════════════════════════════════════════════════════════════

Do not use any of these internal terms in output:
${BANNED_TERMS.join(', ')}

Also: do not start any note with "Per reciprocity audit..." or
"This is a structural fill..." — the audit trail is metadata,
not user-facing text.

═══════════════════════════════════════════════════════════════════
OUTPUT SHAPE — JSON
═══════════════════════════════════════════════════════════════════

Return ONLY this JSON shape (no markdown, no commentary, no \`\`\`json fences):

{
  "rewrites": [
    {
      "slug": "<partner_slug>",
      "relationshipNote": "<50-70 word note in host's voice>"
    },
    ...
  ]
}

The "slug" must match a slug from the requested stubs exactly.
Return one rewrite per stub. Same length array as stubs.`;
}

function buildUserPrompt(body) {
  const host = body.hostPortal || {};
  const stubs = Array.isArray(body.stubs) ? body.stubs : [];
  const partners = body.partnerSummaries || {};

  let prompt = `HOST PORTAL\n`;
  prompt += `  slug:      ${host.slug || '?'}\n`;
  prompt += `  name:      ${host.name || '?'}\n`;
  prompt += `  industry:  ${host.industry || '?'}\n`;
  prompt += `  domain:    ${host.domainId || '?'}\n`;
  if (host.businessSummary) {
    prompt += `  business:  ${host.businessSummary.slice(0, 600)}\n`;
  }
  prompt += `\nSTUBS TO REWRITE (${stubs.length}):\n\n`;

  for (let i = 0; i < stubs.length; i++) {
    const s = stubs[i];
    const partner = partners[s.slug] || {};
    const framing = CATEGORY_FRAMING[s.category] || 'Relationship category unspecified.';

    prompt += `[${i + 1}] partner slug: ${s.slug}\n`;
    prompt += `    partner name: ${s.name}\n`;
    prompt += `    category:     ${s.category}\n`;
    prompt += `    framing:      ${framing}\n`;
    if (s.brainNodeId) prompt += `    brainNodeId:  ${s.brainNodeId}\n`;
    if (s.brainNodeRole) prompt += `    brainNodeRole: ${s.brainNodeRole}\n`;
    if (s.neuralRole) prompt += `    neuralRole:    ${s.neuralRole}\n`;
    if (partner.industry) prompt += `    partner industry: ${partner.industry}\n`;
    if (partner.businessSummary) {
      prompt += `    partner business: ${partner.businessSummary.slice(0, 400)}\n`;
    }
    if (partner.theirView) {
      prompt += `    partner's view of host (for context, do not echo verbatim):\n      "${partner.theirView.slice(0, 300)}"\n`;
    }
    prompt += `\n`;
  }

  prompt += `Return JSON with ${stubs.length} rewrites. Each note 50-70 words. Slug must match exactly.`;
  return prompt;
}

function wordCount(s) {
  if (typeof s !== 'string') return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function containsBanned(s) {
  if (typeof s !== 'string') return null;
  const lower = s.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.indexOf(term.toLowerCase()) !== -1) return term;
  }
  return null;
}

function parseAndValidate(rawText, requestedStubs) {
  // Strip code fences if present
  let txt = rawText.trim();
  if (txt.startsWith('```')) {
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  let parsed;
  try { parsed = JSON.parse(txt); }
  catch (e) { return { ok: false, parseError: e.message, rawTextHead: rawText.slice(0, 300) }; }

  if (!parsed || !Array.isArray(parsed.rewrites)) {
    return { ok: false, parseError: 'missing rewrites array', rawTextHead: rawText.slice(0, 300) };
  }

  const requestedSlugs = new Set(requestedStubs.map(s => s.slug));
  const seen = new Set();
  const validated = [];
  const errors = [];

  for (const r of parsed.rewrites) {
    if (!r || typeof r !== 'object') {
      errors.push({ kind: 'not_object' });
      continue;
    }
    if (typeof r.slug !== 'string' || !requestedSlugs.has(r.slug)) {
      errors.push({ kind: 'unknown_slug', slug: r.slug });
      continue;
    }
    if (seen.has(r.slug)) {
      errors.push({ kind: 'duplicate_slug', slug: r.slug });
      continue;
    }
    if (typeof r.relationshipNote !== 'string') {
      errors.push({ kind: 'missing_note', slug: r.slug });
      continue;
    }
    const wc = wordCount(r.relationshipNote);
    if (wc < 30 || wc > 110) {
      errors.push({ kind: 'word_count_out_of_range', slug: r.slug, wc });
      continue;
    }
    const banned = containsBanned(r.relationshipNote);
    if (banned) {
      errors.push({ kind: 'banned_vocab', slug: r.slug, term: banned });
      continue;
    }
    seen.add(r.slug);
    validated.push({ slug: r.slug, relationshipNote: r.relationshipNote.trim(), wordCount: wc });
  }

  const missing = [];
  for (const s of requestedStubs) {
    if (!seen.has(s.slug)) missing.push(s.slug);
  }

  if (validated.length === 0 && errors.length > 0) {
    return { ok: false, parseError: 'all rewrites rejected', errors, rawTextHead: rawText.slice(0, 300) };
  }

  return {
    ok: true,
    rewrites: validated,
    errors: errors.length ? errors : undefined,
    missing: missing.length ? missing : undefined
  };
}

async function callAnthropic(systemPrompt, userPrompt) {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: 'no-anthropic-key' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const j = await r.json();
    if (!r.ok) {
      return { ok: false, error: 'anthropic-non-2xx', status: r.status, body: j };
    }
    const blocks = (j && j.content) || [];
    const text = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('\n').trim();
    return { ok: true, text, usage: j.usage };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: 'fetch-error', detail: String((e && e.message) || e) };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (await require('../lib/ai-kill-switch').spendDisabled()) { res.statusCode = 503; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, disabled: true, error: 'AI disabled — billing stopped per operator' })); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  }

  const auth = checkAuth(req);
  if (!auth.ok) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    res.setHeader('WWW-Authenticate', 'Bearer realm="limen-reciprocity-prose-rewrite"');
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
  }

  let body = req.body;
  try {
    if (!body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } else if (typeof body === 'string') {
      body = JSON.parse(body);
    }
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'invalid-json-body', detail: e.message }));
  }

  if (!body || !body.hostPortal || !Array.isArray(body.stubs) || body.stubs.length === 0) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'invalid-request',
      expected: 'body = { hostPortal, stubs:[...non-empty], partnerSummaries }' }));
  }
  if (body.stubs.length > 30) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'too-many-stubs',
      message: 'maximum 30 stubs per call; split into multiple requests' }));
  }

  const t0 = Date.now();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(body);
  const claudeResp = await callAnthropic(systemPrompt, userPrompt);

  if (!claudeResp.ok) {
    res.statusCode = claudeResp.status && claudeResp.status >= 400 && claudeResp.status < 600
      ? claudeResp.status : 502;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: false,
      error: claudeResp.error,
      detail: claudeResp.detail,
      body: claudeResp.body,
      model: ANTHROPIC_MODEL,
      elapsedMs: Date.now() - t0
    }));
  }

  const validated = parseAndValidate(claudeResp.text, body.stubs);
  if (!validated.ok) {
    res.statusCode = 422;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: false,
      error: 'output-validation-failed',
      parseError: validated.parseError,
      errors: validated.errors,
      rawTextHead: validated.rawTextHead,
      rawTextLength: claudeResp.text.length,
      model: ANTHROPIC_MODEL,
      elapsedMs: Date.now() - t0
    }));
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  return res.end(JSON.stringify({
    ok: true,
    rewrites: validated.rewrites,
    errors: validated.errors,
    missing: validated.missing,
    model: ANTHROPIC_MODEL,
    usage: claudeResp.usage,
    elapsedMs: Date.now() - t0
  }));
};
