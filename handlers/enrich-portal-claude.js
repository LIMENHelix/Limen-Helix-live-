/**
 * LIMEN Helix — Portal Density Enricher (Claude)
 *
 * POST /api/enrich-portal-claude
 *
 * Takes a company identifier (cik / slug / name / ticker) and (optionally)
 * the current sparse portal JSON, asks Claude to produce a Walmart-grade
 * densified portal JSON matching schemaVersion 2.0.1, and returns it.
 *
 * The caller (or a separate script) then writes the JSON to
 * assets/data/companies/{slug}.json.
 *
 * Walmart is the exemplar:
 *   - 35-entry functionalNetwork (suppliers, customers, peers,
 *     auditors, regulators, capitalProviders, partners)
 *   - Every entry: name + ticker + cik + slug + neuralRole + brainNodeId
 *     + brainNodeRole + relationshipNote (named programs, dates, % share,
 *     historical pivots) + confidence + sourceType[]
 *   - 8 fredSeries (specific company drivers, not just macro)
 *   - 6 commodityExposure entries
 *   - financialHealth, opportunitySignals, intelligenceCycle stubs preserved
 *   - domainRelevance + portalRelevance prose
 *
 * Same hardening rules as expand-artifact-claude:
 *   - No internal LIMEN vocabulary in output
 *   - Citations only from contextPacket.evidence.citations[] when supplied;
 *     otherwise sourceType references generic categories (10-K, 8-K, 20-F,
 *     industry-report) without fabricating specific document references
 *   - DATA_NEEDED placeholders allowed for unknown specifics
 *
 * Env: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (default
 *      claude-sonnet-4-6), ANTHROPIC_TIMEOUT_MS (default 280000),
 *      ANTHROPIC_MAX_TOKENS (default 16000).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
// Enricher defaults to Haiku 4.5: 3-5x faster generation than Sonnet,
// ideal for structured-JSON output where the system prompt encodes
// the reasoning + the model just needs to fill the schema. Override
// via ENRICH_MODEL env var if a richer model is needed for hard
// companies (e.g., complex multi-segment conglomerates).
const ANTHROPIC_MODEL = process.env.ENRICH_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '16000', 10);
const ANTHROPIC_TIMEOUT_MS = parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '280000', 10);
const ANTHROPIC_VERSION = '2023-06-01';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Same banned-vocab rule as expand-artifact-claude. Internal LIMEN
// architecture terms must not appear in the portal JSON.
// Note: standalone 'helix' is intentionally NOT banned — collides with
// Perforce Helix (EA), Illumina's former Helix Genomics, helix-loop-helix
// motifs, alpha helix, double helix, etc. The brand is caught by
// 'limenhelix' / 'limenhelix.com' instead.
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
  'opportunity signal', 'cross-domain audit', 'handoff packet'
];

function buildSystemBlock() {
  return `You are a senior equity-research analyst, corporate counsel, and supply-chain analyst combined. You produce dense, accurate company-portal JSON documents in a fixed schema for a financial-intelligence system. The output reads as if produced by an MBA-trained analyst with sector expertise — never as if produced by an AI assistant.

═══════════════════════════════════════════════════════════════════
TARGET SCHEMA — schemaVersion "2.0.1"
═══════════════════════════════════════════════════════════════════

Every portal JSON must conform to this exact top-level shape (Walmart is the canonical exemplar):

{
  "schemaVersion": "2.0.1",
  "type": "company",
  "companyId": "<lowercase_slug>",
  "slug": "<lowercase_slug>",
  "name": "<Legal entity name with Inc./Corp./PLC>",
  "ticker": "<NYSE/NASDAQ/foreign ticker>",
  "cik": "<10-digit zero-padded SEC CIK or null if private/foreign-filer>",
  "sic": "<4-digit SIC code>",
  "industry": "<SIC label / industry descriptor>",
  "domainId": "<one of: agriculture, communication, culture, defense, economy, education, energy, environment, finance, governance, industry, infrastructure, intelligence, law, medicine, population, religion, science, supplyChain, technology>",
  "portalAttachment": "<{domain}-portal.html>",
  "kernelStatus": "<ELIGIBLE_NOW | INGESTION_SUSPECT | STALE | INSUFFICIENT_HISTORY | ERROR | PRIVATE | FOREIGN_FILER>",

  "fredSeries": [
    "<FRED series ID 1>", "<FRED series ID 2>", ...
  ],
  "feedSources": [],
  "marketDataTickers": ["<primary ticker>"],
  "commodityExposure": ["<commodity 1>", "<commodity 2>", ...],

  "helixReportMode": "validated_kernel" | "interpretive_only" | "stub",
  "helixReportUrl": "helix-report.html?cik=<cik>",

  "financialHealth": {
    "asOf": "<YYYY-MM-DD or DATA_NEEDED>",
    "lastKernelRun": "<ISO timestamp or DATA_NEEDED>",
    "kernelId": "limen_backtest.py",
    "validationStatus": "<validated | unavailable | DATA_NEEDED>",
    "envelopeStatus": "<ELIGIBLE_NOW | etc.>",
    "historyQuarters": <int or DATA_NEEDED>,
    "latestQuarter": "<YYYYQn or DATA_NEEDED>",
    "compositeScore": <0..1 or DATA_NEEDED>,
    "alert": <bool or DATA_NEEDED>,
    "distressBand": "<green | yellow | red | DATA_NEEDED>",
    "dominantPhase": "<p0 - p10 or DATA_NEEDED>",
    "financialState": {
      "cashLatest": <number USD or DATA_NEEDED>,
      "debtLatest": <number USD or DATA_NEEDED>,
      "cashRunwayQ": <int or null>
    }
  },

  "warningSignals": [],
  "opportunitySignals": [],
  "commercializationStatus": { "enginesRun": [], "engineOutputs": [] },
  "newsFeed": [],

  "domainRelevance": "<2-3 sentence prose: this company's role in its sector. Specific. Walmart-grade.>",
  "portalRelevance": "<2-3 sentence prose: why this company matters to a financial-intelligence model. Reference its tier (anchor / peer / specialty / supplier) and any unique structural role.>",

  "notes": {
    "cohortStatus": "<DATA_NEEDED or specific category>",
    "envelopeStatus": "<DATA_NEEDED or status>"
  },

  "intelligenceCycle": [
    {"layer": "signal",    "name": "Signal Capture",     "items": [<2-4 named signals this entity emits or receives>]},
    {"layer": "state",     "name": "State Estimation",   "items": [<2-4 state assessments — phase, financial health, trajectory>]},
    {"layer": "diagnosis", "name": "Diagnosis",          "items": [<2-4 pattern matches — distress signatures, growth inflections, sector failure modes>]},
    {"layer": "regulate",  "name": "Regulation",         "items": [<2-4 interventions — thesis, risk management, hedge positioning>]},
    {"layer": "action",    "name": "Action",             "items": [<2-4 execution paths — trades, portfolio moves, engagement strategy>]},
    {"layer": "feedback",  "name": "Feedback",           "items": [<2-4 post-action monitoring loops — earnings, price, filing changes>]},
    {"layer": "adapt",     "name": "Adaptation",         "items": [<2-4 model updates from realized outcomes>]}
  ],

  "functionalNetwork": {
    "model": "<one-paragraph statement framing the company as a mini-brain at neural granularity>",
    "suppliers":         [ ... ],
    "logisticsPartners": [ ... ],
    "customers":         [ ... ],
    "competitors":       [ ... ],
    "regulators":        [ ... ],
    "auditor":           { ... single object, not array ... },
    "capitalProviders":  [ ... ],
    "executiveTeam":     [ ... ],
    "marketSignals":     [ ... ]
  }
}

═══════════════════════════════════════════════════════════════════
FUNCTIONAL NETWORK — DENSITY REQUIREMENTS (Walmart-grade)
═══════════════════════════════════════════════════════════════════

Target: 25–30 total entries across categories. Walmart's exemplar is 30; that's the ceiling, not a floor. Per-category targets:

  suppliers          — 8–10 entries (anchor brands / commodity / packaging / raw materials)
  logisticsPartners  — 3–5 entries (carriers, freight, last-mile)
  customers          — 0 if pure-B2C, 2–4 if B2B (institutional / channel accounts)
  competitors        — 4–6 entries (direct competitors at scale + 1-2 adjacent-category)
  regulators         — 4–5 entries (SEC always; plus FDA / USDA / EPA / DOT / FCC / FTC by industry)
  auditor            — 1 object (Big-Four)
  capitalProviders   — 2–4 entries (anchor lenders, major equity holders >5%)
  executiveTeam      — 3–4 entries (CEO + CFO always; plus COO / chair / GC if relevant)
  marketSignals      — 2–3 for retail/consumer; 0 for B2B infrastructure

IMPORTANT: the JSON must fit within the response token budget. Prioritize DEPTH per entry over count. 25 entries with 70-word relationshipNotes beats 35 entries that get truncated mid-stream. If you must cut, drop adjacent-category competitors first, then secondary capitalProviders, then marketSignals.

Every entry must carry:

{
  "name": "<full legal entity name>",
  "ticker": "<ticker if public, null if private/government>",
  "cik": "<10-digit zero-padded SEC CIK if available, null otherwise>",
  "slug": "<lowercase_underscore_slug>",
  "neuralRole": "<DMN | Salience | PFC | Motor | Sensory | Limbic | Peer>",
  "brainNodeId": "<one of 124 LIMEN canonical node IDs — see default palette below>",
  "brainNodeRole": "<descriptive role label tied to the brain node's business binding>",
  "relationshipNote": "<2-4 sentences with: named programs / contract specifics / % market share / historical pivots / regulatory actions / distinguishing facts. NO GENERIC PROSE. Walmart-grade specificity. If the specific is unknown, mark inline [DATA_NEEDED: <field>].>",
  "confidence": "high | medium | low",
  "sourceType": [ "<10-K | 8-K | S-1 | DEF14A | 20-F | statutory | industry-report | news | inferred>", ... ]
}

DEFAULT NEURAL-ROLE PALETTE (override per pair when specifics warrant):

| Functional slot                              | neuralRole | brainNodeId | brainNodeRole |
|----------------------------------------------|------------|-------------|---------------|
| Anchor supplier (identity-defining CPG)      | DMN        | mPFC        | Brand & Identity |
| Commodity / raw-material supplier            | Sensory    | S1          | Raw Materials |
| Operations / production input                | Motor      | STRI        | Operations |
| Distribution / logistics partner             | Motor      | M1          | Production & Delivery |
| Information / data infrastructure            | Sensory    | THAL        | Information Flow |
| Anchor customer (institutional buyer)        | DMN        | NAcc        | Sales & Revenue |
| Retail channel customer                      | Motor      | M1          | Production & Delivery (downstream) |
| Direct competitor                            | Peer       | TPJ         | Perspective-Taking / Theory of Mind |
| Big-Four auditor                             | Salience   | BLA         | Risk Assessment + Compliance |
| Federal regulator (SEC, FTC, FCC)            | Salience   | dACC        | Compliance & Governance |
| Health-safety regulator (FDA, USDA, EPA)     | Salience   | AI          | Crisis Detection |
| Antitrust regulator                          | Salience   | dACC        | Compliance + Strategic |
| Anchor lender / bond underwriter             | Limbic     | OFC         | Market Intelligence + Capital |
| Major equity holder (>5%)                    | DMN        | mPFC        | Brand & Identity (governance) |
| Strategic JV partner                         | PFC        | dlPFC       | Strategic |
| Technology integrator                        | Sensory    | THAL        | Information Flow |
| CEO                                          | PFC        | FPN         | Executive Leadership |
| CFO                                          | PFC        | vmPFC       | Financial Management |
| COO                                          | Motor      | STRI        | Operations |
| Chairperson / major shareholder              | DMN        | mPFC        | Governance & Identity |
| General Counsel                              | PFC        | vlPFC       | Legal & Compliance |
| Market signal (comp sales, demand index)     | Limbic     | NAcc/OFC    | Sales & Revenue / Market Intel |

═══════════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════════

RULE 1 — NO FABRICATED SPECIFICS
You may use general industry knowledge (e.g., "Coca-Cola is a major supplier to Walmart") but you may NOT invent:
  - Specific contract values, percentages, share counts, deal terms unless you are highly confident from public filings
  - Specific patent numbers, NOFO numbers, case numbers, FAR clauses
  - Specific named programs or product line revenues unless commonly known
If specifics are not in your training and not supplied, use [DATA_NEEDED: <field>] inline.

RULE 2 — NO INTERNAL VOCABULARY
The following words MUST NOT appear anywhere in the output JSON: LIMEN, Helix, kernel (except in the literal "limen_backtest.py" kernelId reserved field), polyvagal, "Thing 1", "Thing 2", "civilization brain", "connectome brain", "master brain", "domain brain", "super-brain", "pattern envelope", "pattern broker", "pattern signature", "dominant phase" (except in the financialHealth.dominantPhase reserved field where it's just a value), "salience score", "opportunity signal", "handoff packet", "fractal brain", "limen.com" or "limenhelix.com" or any LIMEN URL.

RULE 3 — REAL CIKs ONLY
For any public company entry, use the actual 10-digit zero-padded SEC CIK. If you don't know it confidently, set cik: null and add sourceType to include "inferred". Do not fabricate a CIK.

RULE 4 — RELATIONSHIPNOTE MUST BE SPECIFIC, DENSE, AND BOUNDED
Every relationshipNote must be 50–90 words (target ~70). Word ceiling matters as much as floor — overshoot leads to truncated JSON. Each note must pass this test: an industry analyst reading it should learn at least one specific fact they didn't already know about this pair. Required prose elements (at minimum 3 of these 5 per entry):
  - Historical specificity (year of acquisition, contract milestone, founding date, program launch)
  - Quantitative anchor (% of revenue, market share, volume, capacity, employee count)
  - Competitive delta (vs named rival, unique advantage, threat vector)
  - Regulatory / 8-K event hook (if applicable)
  - Source disclosure pointer ("disclosed in 10-K Item 1A risk factors", "Q3 2024 earnings call")

HARD ANCHOR REQUIREMENT — every relationshipNote MUST contain at least ONE of:
  (a) a 4-digit year (e.g. "2021 acquisition")
  (b) a dollar figure ("$2.3B contract", "$48M settlement")
  (c) a percentage ("12% of revenue", "30% market share")
  (d) a named program / product / contract ("AWS GovCloud", "F-35 Lot 17", "NHS Test-and-Trace")
  (e) a specific statute / regulation / case code ("FTC matter 2023-xxxx", "16 CFR §436.5", "SEC Order 34-xxxxx")
  (f) a specific facility / plant location ("Foxconn Zhengzhou plant", "Pfizer Kalamazoo")
  (g) a named executive / signatory with title ("CEO Bob Iger", "USPTO Director Vidal")

Entries with ONLY generic prose like "supplier of various goods", "important regulator", "key technology partner", or "longstanding relationship" are FORBIDDEN and will be rejected by the post-generation check. If you don't know a specific anchor, write [DATA_NEEDED: <what's missing>] inline rather than producing generic prose.

RULE 6 — INTELLIGENCE CYCLE IS REQUIRED (restoring v1 procedural scaffolding)
You MUST populate the 7-layer intelligenceCycle with 2-4 specific items per layer. This is the decision-cycle structure that v1 portals had and v2 dropped. Items should be entity-specific, not generic. Example for a retailer:
  signal: ["weekly comp-store sales prints", "8-K cyber-incident filings", "supplier price-change notices via EDI"]
  state: ["HELIX phase classification each quarter", "rolling 4Q free-cash-flow trajectory"]
  diagnosis: ["pattern-match against prior P3 / P7 transitions in same SIC peer group"]
  regulate: ["inventory throughput hedge via futures on cotton/wheat", "pricing-power buffer rebuild plan"]
  action: ["board-approved buyback expansion", "dividend pause if pathway A trips"]
  feedback: ["Q+1 same-store sales validation", "share-price reaction to inventory disclosure"]
  adapt: ["seasonality reweighting in own kernel snapshot", "supplier-concentration sensitivity recalibration"]

RULE 5 — DOMAINID MUST BE CANONICAL
domainId is one of the 20 canonical values listed in the schema block. Do not invent new domain names.

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (CRITICAL)
═══════════════════════════════════════════════════════════════════

Reply with the raw JSON object ONLY. No code fences. No preamble. No closing remarks. No "Here is the JSON:" header. The first character of your response must be { and the last character must be }. The output must parse with JSON.parse() without ANY modification.

If you produce \`\`\`json fences or any text outside the JSON object, the response will be rejected.

The JSON must be COMPLETE — every opened { needs its closing }, every opened [ needs its closing ]. If you cannot fit a full WMT-grade portal in the token budget, REDUCE entry counts (e.g., 6 suppliers instead of 13) but ALWAYS close the JSON properly. A truncated 20-entry portal is useless; a complete 15-entry portal is shippable.

The JSON's top-level shape matches the schema above exactly. Preserve all reserved fields even if their values are null or [DATA_NEEDED].
`;
}

function buildUserPrompt(body) {
  const target = body.target || {};
  const existing = body.currentPortal || null;
  return `TARGET ENTITY:
${JSON.stringify(target, null, 2)}

EXISTING PORTAL (if you are densifying an existing sparse entry — preserve all reserved fields):
${existing ? JSON.stringify(existing, null, 2) : 'NONE — produce from scratch'}

INSTRUCTIONS:

Produce a Walmart-grade densified portal JSON for the target entity.

If the existing portal is provided:
  - Preserve all top-level reserved fields (schemaVersion, financialHealth, opportunitySignals, commercializationStatus, intelligenceCycle, kernelStatus values)
  - Replace/expand functionalNetwork to meet 25–40 entry density target
  - Replace/expand domainRelevance + portalRelevance prose to 2–3 sentences each with Walmart-grade specificity
  - Replace/expand fredSeries to include company-specific drivers in addition to macro
  - Replace/expand commodityExposure to actual commodity dependencies

If no existing portal:
  - Produce the full JSON from scratch using your knowledge of the entity
  - All reserved fields stay null / empty / DATA_NEEDED as specified in the schema

For functionalNetwork, prioritize entries you can describe with specificity. It is better to ship 25 entries with deep relationshipNote prose than 40 entries with shallow placeholders.

Cite sourceType conservatively: only "10-K" or "20-F" if the fact comes from the company's annual filing; "8-K" only for event-driven disclosures; "industry-report" for analyst/trade publication knowledge; "news" only for events you remember from training; "inferred" for industry-knowledge inference.

Reply with raw JSON only.`;
}

function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let h1 = 0x811c9dc5; let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c; h2 = (h2 * 0x100000001b3) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) +
         ('00000000' + h2.toString(16)).slice(-8);
}

function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body-not-object' };
  if (!body.target || typeof body.target !== 'object') return { ok: false, reason: 'missing-target' };
  const t = body.target;
  if (!t.name && !t.ticker && !t.cik) {
    return { ok: false, reason: 'target-must-have-name-ticker-or-cik' };
  }
  return { ok: true };
}

// Scan banned terms ONLY in human-prose value strings — relationshipNote,
// domainRelevance, portalRelevance, intelligenceCycle items, model, and
// the various 'name' / 'role' / 'note' fields. Reserved schema field
// names + values (kernelId="limen_backtest.py", helixReportMode,
// helixReportUrl, helix-report.html?...) are explicitly skipped.
function lintBannedTerms(textOrPortal) {
  // If a structured portal was passed, extract prose values only.
  let proseText = '';
  if (typeof textOrPortal === 'object' && textOrPortal !== null) {
    proseText = extractProseValues(textOrPortal);
  } else {
    proseText = String(textOrPortal || '');
  }
  const lower = proseText.toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'i');
    const m = lower.match(re);
    if (m) hits.push({ term: term, at: m.index });
  }
  return hits;
}

// Walk a portal and collect only the human-prose value strings into one
// blob for linting. Skips reserved-schema fields whose values are
// expected to contain LIMEN tokens (kernelId, helixReportMode,
// helixReportUrl) or whose contents are pure identifiers.
const PROSE_FIELDS = new Set([
  'relationshipNote', 'note', 'domainRelevance', 'portalRelevance',
  'descriptor', 'brainNodeRole', 'name', 'role', 'shortName',
  'industry', 'narrativeSafe', 'description', 'summary',
  'sectionName', 'cohortStatus', 'envelopeStatus', 'heading'
]);
const SKIP_KEYS = new Set([
  'kernelId', 'helixReportMode', 'helixReportUrl', 'helixReportUrlPattern',
  'schemaVersion', 'cik', 'ticker', 'slug', 'sic', 'doi',
  'kernelShaLock', 'pathway', 'phaseStateLabel', 'dominantPhase',
  'envelopeStatus'  // reserved schema enum value, not prose
]);
function extractProseValues(obj, out, currentKey) {
  if (out === undefined) out = { s: '' };
  if (obj == null) return out.s;
  if (typeof obj === 'string') {
    if (currentKey && SKIP_KEYS.has(currentKey)) return out.s;
    if (currentKey && PROSE_FIELDS.has(currentKey)) {
      out.s += '\n' + obj;
    }
    return out.s;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) extractProseValues(v, out, currentKey);
    return out.s;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      extractProseValues(obj[k], out, k);
    }
    return out.s;
  }
  return out.s;
}

async function callAnthropic(body, opts) {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, status: 501, reason: 'ANTHROPIC_API_KEY not configured' };
  }

  const systemBlocks = [
    {
      type: 'text',
      text: buildSystemBlock(),
      cache_control: { type: 'ephemeral' }
    }
  ];

  const messages = [{ role: 'user', content: buildUserPrompt(body) }];

  const maxTokens = Math.min(
    parseInt(body.maxTokens || ANTHROPIC_MAX_TOKENS, 10),
    16000
  );

  const requestBody = {
    model: opts.model || ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    temperature: 0.25,
    system: systemBlocks,
    messages: messages
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  let resp, json;
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    json = await resp.json();
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, reason: 'fetch-failed', detail: String(err && err.message || err) };
  }
  clearTimeout(timer);

  if (!resp.ok) {
    return { ok: false, status: resp.status, reason: 'anthropic-error', detail: json };
  }

  let text = '';
  if (Array.isArray(json.content)) {
    for (const part of json.content) {
      if (part && part.type === 'text' && part.text) text += part.text;
    }
  }

  // Parse JSON from model output. The model is told to reply with raw JSON
  // but sometimes wraps in code fences anyway — try multiple extraction
  // strategies.
  let portal = null;
  let parseError = null;
  const candidates = [];
  candidates.push(text.trim());
  // Strip code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());
  // Extract first { ... } block
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);

  for (const c of candidates) {
    try { portal = JSON.parse(c); break; }
    catch (e) { parseError = e.message; }
  }

  // Lint banned terms in the portal's PROSE-VALUE FIELDS only — skips
  // reserved schema enum values (kernelId='limen_backtest.py',
  // helixReportMode, helixReportUrl) that legitimately contain LIMEN
  // tokens but are not vocab leaks.
  let bannedHits = [];
  if (portal) {
    bannedHits = lintBannedTerms(portal);
  }

  return {
    ok: !!portal,
    status: resp.status,
    json: json,
    rawText: text,
    portal: portal,
    parseError: parseError,
    bannedHits: bannedHits,
    usage: json.usage || null,
    model: json.model || ANTHROPIC_MODEL
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (await require('../lib/ai-kill-switch').spendDisabled()) { res.statusCode = 503; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, disabled: true, error: 'AI disabled — billing stopped per operator' })); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET returns config (no secrets) — same pattern as expand-artifact-claude
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      config: {
        ANTHROPIC_MODEL: ANTHROPIC_MODEL,
        ANTHROPIC_MAX_TOKENS: ANTHROPIC_MAX_TOKENS,
        ANTHROPIC_TIMEOUT_MS: ANTHROPIC_TIMEOUT_MS,
        ANTHROPIC_VERSION: ANTHROPIC_VERSION,
        hasApiKey: !!ANTHROPIC_API_KEY,
        nodeVersion: process.version
      }
    }, null, 2));
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  }

  try {
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } else if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const v = validate(body);
    if (!v.ok) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: v.reason, detail: v }));
    }

    const r = await callAnthropic(body, {});
    if (!r.ok && r.reason) {
      res.statusCode = r.status || 502;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({
        ok: false,
        error: r.reason || 'upstream-error',
        detail: r.detail,
        rawText: r.rawText ? r.rawText.slice(0, 1500) : null,
        parseError: r.parseError || null
      }));
    }

    // If Claude returned text but it didn't parse as JSON, surface that
    // distinctly so the caller can see the raw output and adjust the
    // prompt instead of silently returning ok:true + portal:null.
    if (!r.portal) {
      res.statusCode = 422;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({
        ok: false,
        error: 'portal-parse-failed',
        parseError: r.parseError,
        rawTextLength: (r.rawText || '').length,
        rawTextHead: (r.rawText || '').slice(0, 1500),
        rawTextTail: (r.rawText || '').slice(-800),
        usage: r.usage,
        model: r.model
      }));
    }

    // ── Author-time inhibitory brake (lib/node-guard, motif M1) ─────────
    // Refuse to WRITE a business binding onto a non-node. The LLM palette
    // lists neuralRole names (DMN, Salience, ...) that resolve to non-node
    // ids (composite/tract/molecule/glia/construct/effector/ambiguous); if
    // one slips into a brainNodeId we STRIP it and flag the entry rather
    // than shipping a phantom node into the connectome. Empirical remap to
    // the correct real node is a human job, never an LLM guess — so the
    // brake refuses, it does not re-guess. Same brake the read-out layer
    // runs, moved upstream to author time. Additive, never throws.
    let nodeGuard = { checked: 0, blocked: 0, motifTagged: 0, blockedIds: [] };
    try {
      const guard = require('../lib/node-guard');
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const v of o) walk(v); return; }
        for (const k of Object.keys(o)) {
          if (k === 'brainNodeId' && typeof o[k] === 'string' && o[k]) {
            nodeGuard.checked++;
            const g = guard.guardBinding(o[k]);
            if (!g.ok) {
              nodeGuard.blocked++;
              if (nodeGuard.blockedIds.length < 40) nodeGuard.blockedIds.push({ id: o[k], class: g.class, remapTo: g.remapTo });
              o.brainNodeIdBlocked = { was: o[k], class: g.class, remapTo: g.remapTo, remapTarget: g.remapTarget, reason: g.reason };
              o[k] = null; // strip the aberrant binding — never ship a phantom node
            } else if (g.motif) {
              o.brainNodeMotif = g.motif; // stamp the confirmed motif for the derivation layer
              nodeGuard.motifTagged++;
            }
          } else { walk(o[k]); }
        }
      })(r.portal);
    } catch (e) { nodeGuard.error = String(e && e.message || e); }

    // Count functionalNetwork entries — use the FULL WMT-shape category
    // list. Includes both new (logisticsPartners, competitors,
    // executiveTeam, marketSignals) and legacy (peers, partners,
    // auditors) for cross-version compatibility.
    const fn = r.portal && r.portal.functionalNetwork || {};
    const fnCounts = {};
    let fnTotal = 0;
    const CATEGORIES = [
      'suppliers', 'logisticsPartners', 'customers', 'competitors',
      'regulators', 'capitalProviders', 'executiveTeam', 'marketSignals',
      'peers', 'partners', 'auditors'
    ];
    for (const cat of CATEGORIES) {
      const arr = fn[cat] || [];
      if (Array.isArray(arr) && arr.length > 0) {
        fnCounts[cat] = arr.length;
        fnTotal += arr.length;
      }
    }
    // auditor is a singular object, not an array
    if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) {
      fnCounts.auditor = 1;
      fnTotal += 1;
    }

    // Genericity check — scan each relationshipNote for at least one
    // hard anchor (year, dollar, percent, agency code, statute section).
    // Per feedback_in_depth_not_generic, entries without any anchor are
    // surface-level Wikipedia summaries and should be re-fired.
    const ANCHOR_PATTERNS = [
      /\b(19|20)\d{2}\b/,
      /\$\s*\d+(?:[.,]\d+)?\s*(?:[BMK]|billion|million|trillion|bn|mn)?/i,
      /\b\d+(?:\.\d+)?\s*%/,
      /\b(?:CFR|U\.S\.C|USC|FDA|EPA|FTC|SEC|USPTO|NHTSA|OFAC|CFTC|FERC|FAA|FCC|NMPA|MHRA|EMA|PMDA|GDPR|HIPAA|SOX|DORA|MiCA|REACH)\b/,
      /\bSection\s+\d/i,
      /\bPart\s+\d{2,}/i,
      /\b\d+\s*(?:basis points|bps)\b/i,
      /\bQ[1-4]\s*20\d{2}\b/i,
      /\b(?:Form|10-K|10-Q|8-K|13F|S-1|14A|20-F)\b/i
    ];
    function _hasAnchor(text) {
      if (!text || typeof text !== 'string') return false;
      for (const re of ANCHOR_PATTERNS) if (re.test(text)) return true;
      return false;
    }
    let anchoredCount = 0, genericCount = 0;
    const genericExamples = [];
    function _checkEntries(arr) {
      if (!Array.isArray(arr)) return;
      for (const e of arr) {
        if (!e || typeof e !== 'object') continue;
        const note = e.relationshipNote || e.note || '';
        if (_hasAnchor(note)) anchoredCount++;
        else {
          genericCount++;
          if (genericExamples.length < 5) {
            genericExamples.push({ name: e.name || '?', noteHead: String(note).slice(0, 100) });
          }
        }
      }
    }
    for (const cat of CATEGORIES) _checkEntries(fn[cat]);
    if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) {
      if (_hasAnchor(fn.auditor.relationshipNote || fn.auditor.note || '')) anchoredCount++;
      else genericCount++;
    }
    const anchoredRate = (anchoredCount + genericCount) > 0
      ? anchoredCount / (anchoredCount + genericCount) : 0;
    const genericityWarning = anchoredRate < 0.7;

    const contentHash = hash(JSON.stringify(r.portal || {}));

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      target: body.target,
      portal: r.portal,
      bannedHits: r.bannedHits,
      densityReport: {
        functionalNetworkTotal: fnTotal,
        functionalNetworkByCategory: fnCounts,
        hasSchemaVersion: r.portal && r.portal.schemaVersion === '2.0.1',
        hasFinancialHealth: r.portal && !!r.portal.financialHealth,
        fredSeriesCount: r.portal && (r.portal.fredSeries || []).length,
        commodityExposureCount: r.portal && (r.portal.commodityExposure || []).length,
        anchoredEntries: anchoredCount,
        genericEntries: genericCount,
        anchoredRate: Math.round(anchoredRate * 1000) / 1000,
        genericityWarning: genericityWarning,
        genericExamples: genericExamples
      },
      nodeGuard: nodeGuard,
      usage: r.usage,
      model: r.model,
      provenance: {
        generatedAt: Date.now(),
        generatedAtISO: new Date().toISOString(),
        contentHash: contentHash,
        llmModel: r.model,
        anthropicVersion: ANTHROPIC_VERSION
      }
    }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: false,
      error: 'internal',
      detail: String(err && err.message || err)
    }));
  }
};
