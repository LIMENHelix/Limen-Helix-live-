/**
 * api/expand-artifact.js
 *
 * D3-B — Server-side ArtifactPacket AI expansion endpoint (patents lane only).
 *
 * POST /api/expand-artifact
 *   body: { artifactPacket, lane: "patents", mode: "draft", options: { temperature } }
 *
 * Behavior:
 *   - Validates the ArtifactPacket against D3-A4.5 readiness contract.
 *   - Calls OpenAI Chat Completions via native fetch (no SDK dependency).
 *   - Returns a structured AI-generated patent draft.
 *   - Enforces post-AI anti-overclaim verification before responding.
 *   - Does NOT persist, file, submit, email, or enqueue anything.
 *   - Does NOT issue legal advice. The draft is a preliminary disclosure
 *     outline that requires human patent-counsel review before any filing.
 *
 * Required env vars:
 *   - OPENAI_API_KEY_D3B (preferred) OR OPENAI_API_KEY (fallback)
 *   - OPENAI_MODEL (no default; endpoint returns 501 if absent)
 *
 * Schema versions:
 *   - API request/response: D3-B.api.v1
 *   - AI expansion JSON:    D3-B.patent.v1
 *
 * D3-B scope:
 *   - patents lane only (other lanes → 400 UNSUPPORTED_LANE).
 *   - No Grok / Anthropic / multi-provider routing.
 *   - No persistence layer.
 *   - No auto-filing, auto-email, auto-submission.
 *
 * D3-E.1 amendment:
 *   - 'nsf-project-pitch' lane now routed to api/lanes/nsf-project-pitch.js.
 *   - Patents lane code path is unchanged. The NSF branch sits ahead of the
 *     patents validator so the patents `_validatePacket` is never invoked
 *     for NSF traffic and patents output is byte-identical to D3-C.1.
 *   - Response schema for NSF: D3-E.api.v1 (new). Patents response remains D3-B.api.v1.
 *   - No new env vars: NSF lane reuses OPENAI_API_KEY/OPENAI_MODEL.
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────

var MAX_BODY_BYTES = 256 * 1024;       // 256KB cap on artifactPacket payload
var DEFAULT_TEMPERATURE = 0.2;         // deterministic
var AI_TIMEOUT_MS = 60 * 1000;         // 60s — Vercel Pro tier limit
var OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
var EXPANSION_SCHEMA_VERSION = 'D3-B.patent.v1';
var API_SCHEMA_VERSION = 'D3-B.api.v1';
var SUPPORTED_LANE = 'patents';

// Prohibited language patterns scanned in AI draft.* string fields.
// Match-case-insensitive substrings inside generated prose. Bare words
// like "approved" / "guarantees" only fire when adjacent to a packet-
// truth claim; the regex form intentionally fires on plausible cases
// and is reviewed by the human patent attorney downstream.
var PROHIBITED_PATTERNS = [
  { pattern: /\bnovel(ty)?\b/i,           reason: 'novelty language' },
  { pattern: /\bpatentab(le|ility)\b/i,   reason: 'patentability language' },
  { pattern: /\bready\s+to\s+file\b/i,    reason: 'filing-ready language' },
  { pattern: /\bready\s+for\s+filing\b/i, reason: 'filing-ready language' },
  { pattern: /\bis\s+approved\b/i,        reason: 'approval language' },
  { pattern: /\bguarante(e|es|ed|s)\b/i,  reason: 'guarantee language' },
  { pattern: /\bwill\s+achieve\b/i,       reason: 'unconditional achievement language' }
];

// D3-B.1 — Internal-system-language patterns scanned in draft.* string fields.
// External-facing patent prose must be grounded in real-world feed/provenance
// facts, not LIMEN internal states. Hits demote status to
// 'draft_with_internal_language_warnings' and append unsupportedClaims with
// kind: 'internal-system-language-leaked'. The draft text is NOT modified;
// the warning surfaces to the human reviewer for fix-up.
//
// Some patterns (node, phase, recursive, diagnosis) are common English words
// and will produce false positives in legitimate technical prose. The scanner
// is soft-warning only — it never blocks. Reviewers may dismiss false hits.
var INTERNAL_LANGUAGE_PATTERNS = [
  { pattern: /\bLIMEN\b/,                reason: 'LIMEN brand reference' },
  { pattern: /\bArtifactPacket\b/,       reason: 'ArtifactPacket identifier' },
  { pattern: /\bstressBand\b/,           reason: 'stressBand identifier' },
  { pattern: /\bdomain\s+stress\b/i,     reason: 'domain-stress phrase' },
  { pattern: /\bdiagnosis\b/i,           reason: 'diagnosis terminology' },
  { pattern: /\bGRID_COLLAPSE\b/,        reason: 'literal diagnosis label' },
  { pattern: /\bOFC\b/,                  reason: 'brain-node label' },
  { pattern: /\bnode\b/i,                reason: 'brain-node terminology' },
  { pattern: /\bphase\b/i,               reason: 'phase terminology' },
  { pattern: /\brecursive\b/i,           reason: 'recursive terminology' },
  { pattern: /\banti_overclaim\b/,       reason: 'anti_overclaim identifier' },
  { pattern: /\breadyForGeneration\b/,   reason: 'readyForGeneration identifier' },
  { pattern: /\bsourceOpportunityId\b/,  reason: 'sourceOpportunityId identifier' }
];

// ─── Safe input extraction ─────────────────────────────────────────────

function _summarizeFeedSources(sources) {
  if (!Array.isArray(sources)) return [];
  var capped = sources.slice(0, 12);
  var out = [];
  for (var i = 0; i < capped.length; i++) {
    var s = capped[i];
    if (!s) continue;
    var entry = {
      name:            s.name || '',
      label:           s.label || '',
      classification:  s.classification || null,
      signalType:      s.signalType || null,
      live:            s.live === true,
      quality:         (typeof s.quality === 'number') ? s.quality : null,
      sourceUpdatedAt: s.sourceUpdatedAt || null
    };
    if (s.failReason) entry.failReason = s.failReason;
    out.push(entry);
  }
  return out;
}

function _extractWarningCodes(packet) {
  var ws = packet && packet.anti_overclaim && Array.isArray(packet.anti_overclaim.warnings)
    ? packet.anti_overclaim.warnings : [];
  var codes = [];
  for (var i = 0; i < ws.length; i++) {
    if (ws[i] && typeof ws[i].code === 'string') codes.push(ws[i].code);
  }
  return codes;
}

function _extractSafeInput(p) {
  var id   = p.identity   || {};
  var sig  = p.signal     || {};
  var ev   = p.evidence   || {};
  var impl = p.implementation || {};
  var conf = p.confidence || {};
  var prov = p.provenance || {};
  var ao   = p.anti_overclaim || {};
  return {
    identity: {
      id:                  id.id,
      sourceOpportunityId: id.sourceOpportunityId,
      domain:              id.domain,
      node:                id.node,
      diagnoses:           Array.isArray(id.diagnoses) ? id.diagnoses : [],
      title:               id.title
    },
    signal: {
      stress:      (typeof sig.stress === 'number') ? sig.stress : null,
      stressBand:  sig.stressBand || null,
      urgency:     sig.urgency || '',
      whyNow:      sig.whyNow  || ''
    },
    evidence: {
      trigger:            ev.trigger    || '',
      validation:         ev.validation || '',
      outcome:            ev.outcome    || '',
      failure:            ev.failure    || '',
      moneyChainEvidence: ev.moneyChainEvidence || ''
    },
    implementation: {
      action:   impl.action   || '',
      doThis:   impl.doThis   || '',
      nextStep: impl.nextStep || '',
      target:   impl.target   || '',
      timing:   impl.timing   || ''
    },
    confidence: {
      confidencePercent: (typeof conf.confidencePercent === 'number') ? conf.confidencePercent : null,
      evidenceQuality:   (typeof conf.evidenceQuality   === 'number') ? conf.evidenceQuality   : null
    },
    provenance: {
      primarySource:  prov.primarySource || null,
      primaryValue:   (typeof prov.primaryValue === 'number') ? prov.primaryValue : null,
      primaryUnit:    prov.primaryUnit || '',
      feedSources:    _summarizeFeedSources(prov.feedSources),
      citationHints:  Array.isArray(prov.citationHints) ? prov.citationHints : []
    },
    antiOverclaimFlags: {
      confidenceClamped:         ao.confidenceClamped === true,
      evidenceSourceVerified:    ao.evidenceSourceVerified === true,
      noUnsupportedCausalClaims: ao.noUnsupportedCausalClaims === true,
      feedClassification:        ao.feedClassification || null,
      diagnosisActive:           ao.diagnosisActive === true,
      rankInBounds:              ao.rankInBounds === true,
      snapshotFresh:             ao.snapshotFresh === true,
      nodeResolved:              ao.nodeResolved === true
    },
    warningCodes: _extractWarningCodes(p),
    // F0 survival shim: expose the source domain's recurrent brain model to the AI
    // prompt (energy carries it; null for domains without one). Flows into the prompt
    // automatically via _buildUserMessage's JSON.stringify(safeInput).
    deepBrain: (function () {
      var db = p.deepBrain || (p.raw && p.raw.handoffPacket && p.raw.handoffPacket.deepBrain) || null;
      if (!db) return null;
      var pe = (db.predictionError && typeof db.predictionError.total === 'number') ? Math.round(db.predictionError.total * 1000) / 1000 : null;
      return {
        cycle:           (typeof db.cycle === 'number') ? db.cycle : null,
        predictionError: pe,
        regulationState: db.regulationState || null,
        readyForHandoff: db.readyForHandoff === true,
        predictedStress: (typeof db.predictedStress === 'number') ? Math.round(db.predictedStress * 1000) / 1000 : null
      };
    })(),
    // F1/G2: the Energy DomainDiagnosisPacket — COMPACT prompt-safe view (bounded arrays via
    // promptView caps) + must-keep scalars/warnings. Full data stays in the stored bundle + DDP.
    energyDomainDiagnosisPacket: (function () {
      var db = p.deepBrain || (p.raw && p.raw.handoffPacket && p.raw.handoffPacket.deepBrain) || null;
      var ddp = db && db.domainDiagnosisPacket;
      if (!ddp) return null;
      var id = ddp.identity || {}, ev = ddp.evidence || {}, bs = ddp.brainState || {};
      return {
        schemaVersion: ddp.schemaVersion || null,
        compact: true,
        identity: {
          diagnosisId: id.diagnosisId || null,
          canonicalDiagnosisId: id.canonicalDiagnosisId || null,
          aliasUsed: id.aliasUsed === true,
          aliasReviewStatus: id.aliasReviewStatus || null,
          aliasRisk: id.aliasRisk || null,
          aliasNote: id.aliasNote || null,
          label: id.label || null,
          phase: id.phase || null,
          confidence: (typeof id.confidence === 'number') ? id.confidence : null
        },
        bundle: {
          bundleStatus: ev.bundleStatus || null,
          bundleResolution: ev.bundleResolution || null,
          buildMethod: (ev.bundle && ev.bundle.buildMethod) || null,
          humanVerificationRequired: (ev.bundle && ev.bundle.humanVerification) || null
        },
        brainState: {
          predictionError: (bs.predictionError && typeof bs.predictionError.total === 'number') ? Math.round(bs.predictionError.total * 1000) / 1000 : null,
          regulationState: bs.regulationState || null,
          readyForHandoff: bs.readyForHandoff === true
        },
        promptView: ddp.promptView || null
      };
    })()
  };
}

// ─── Validation gates ──────────────────────────────────────────────────

function _validatePacket(p, requestLane) {
  // Gate 2: artifactPacket exists and is an object
  if (!p || typeof p !== 'object') {
    return { code: 'MISSING_ARTIFACT_PACKET', http: 400,
      message: 'Request body must include an artifactPacket object.' };
  }
  var id   = p.identity || {};
  var lh   = p.lane_hints || {};
  var ao   = p.anti_overclaim || {};
  var prov = p.provenance || {};

  // Gate 3: lane is patents
  var packetLane = id.lane;
  // D3-E.0.1: explicit request-lane gate. Closes the bug where a real
  // patents packet posted with request body lane === 'nsf-project-pitch'
  // (or any other non-patents string) would slip past the combined gate
  // below — that gate uses && so it only fires when BOTH packet and
  // request are wrong. This gate fires when ONLY the request is wrong,
  // returning 400 UNSUPPORTED_LANE before validation reaches the
  // provider-config 501s and shadows the real cause.
  if (typeof requestLane === 'string' && requestLane !== SUPPORTED_LANE) {
    return {
      code: 'UNSUPPORTED_LANE',
      http: 400,
      message: 'request body lane must be "' + SUPPORTED_LANE + '"; received "' + requestLane + '".'
    };
  }
  if (packetLane !== SUPPORTED_LANE && requestLane !== SUPPORTED_LANE) {
    return { code: 'UNSUPPORTED_LANE', http: 400,
      message: 'D3-B supports patents lane only.' };
  }
  if (packetLane !== SUPPORTED_LANE) {
    return { code: 'UNSUPPORTED_LANE', http: 400,
      message: 'artifactPacket.identity.lane must be "patents".' };
  }

  // Gate 4: readiness for patents lane
  var ready = lh.readyForGeneration && lh.readyForGeneration.patents === true;
  if (!ready) {
    return { code: 'PACKET_NOT_READY', http: 422,
      message: 'lane_hints.readyForGeneration.patents is not true.' };
  }

  // Gate 5: hard anti-overclaim gates
  var failedGates = [];
  if (ao.feedClassification !== 'real') failedGates.push('feedClassificationReal');
  if (ao.diagnosisActive   !== true)    failedGates.push('diagnosisActive');
  if (ao.snapshotFresh     !== true)    failedGates.push('snapshotFresh');
  if (ao.nodeResolved      !== true)    failedGates.push('nodeResolved');
  var hasLive = false;
  if (Array.isArray(prov.feedSources)) {
    for (var i = 0; i < prov.feedSources.length; i++) {
      if (prov.feedSources[i] && prov.feedSources[i].live === true) { hasLive = true; break; }
    }
  }
  if (!hasLive) failedGates.push('hasLiveSource');
  if (failedGates.length > 0) {
    return { code: 'HARD_GATE_FAILED', http: 422,
      message: 'One or more hard anti-overclaim gates failed.',
      failedGates: failedGates };
  }

  // Gate 6: provenance presence
  if (!prov.primarySource || !Array.isArray(prov.feedSources) || prov.feedSources.length === 0) {
    return { code: 'MISSING_PROVENANCE', http: 422,
      message: 'provenance.primarySource and non-empty feedSources are required.' };
  }

  // Gate 7: minimum packet detail for a patent draft
  var impl = p.implementation || {};
  var ev   = p.evidence       || {};
  var hasImpl = !!(impl.action || impl.doThis || impl.nextStep);
  var hasEvidence = !!(ev.trigger || ev.validation || ev.outcome);
  if (!hasImpl || !hasEvidence) {
    return { code: 'INSUFFICIENT_PACKET_DETAIL', http: 422,
      message: 'Packet missing implementation actions or evidence required for patent draft.' };
  }

  return null;
}

// ─── AI provider configuration ─────────────────────────────────────────

function _resolveApiKey() {
  if (typeof process.env.OPENAI_API_KEY_D3B === 'string' && process.env.OPENAI_API_KEY_D3B.length > 0) {
    return process.env.OPENAI_API_KEY_D3B;
  }
  if (typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0) {
    return process.env.OPENAI_API_KEY;
  }
  return null;
}

function _resolveModel() {
  var m = process.env.OPENAI_MODEL;
  if (typeof m === 'string' && m.length > 0) return m;
  return null;
}

// ─── Prompt assembly ───────────────────────────────────────────────────

var SYSTEM_PROMPT =
  'You are drafting a preliminary invention disclosure and provisional-patent-style outline ' +
  'from a machine-generated ArtifactPacket. ' +
  'Do not claim novelty, patentability, freedom to operate, legal validity, commercial value, ' +
  'or regulatory approval. Use only the packet evidence and cited provenance. ' +
  'Mark missing information explicitly. Produce structured JSON only matching the schema ' +
  'D3-B.patent.v1 documented below.\n\n' +
  'Required output JSON shape:\n' +
  '{\n' +
  '  "ok": true,\n' +
  '  "schemaVersion": "D3-B.patent.v1",\n' +
  '  "lane": "patents",\n' +
  '  "artifactPacketId": "<from input.identity.id>",\n' +
  '  "sourceOpportunityId": "<from input.identity.sourceOpportunityId>",\n' +
  '  "status": "draft_only",\n' +
  '  "notLegalAdvice": true,\n' +
  '  "antiOverclaim": {\n' +
  '    "noveltyClaimed": false,\n' +
  '    "patentabilityClaimed": false,\n' +
  '    "filingReady": false,\n' +
  '    "requiresHumanPatentReview": true,\n' +
  '    "unsupportedClaims": []\n' +
  '  },\n' +
  '  "draft": {\n' +
  '    "inventionTitle": "...",\n' +
  '    "field": "...",\n' +
  '    "background": "...",\n' +
  '    "problemStatement": "...",\n' +
  '    "technicalSolution": "...",\n' +
  '    "systemComponents": ["..."],\n' +
  '    "methodSteps": ["..."],\n' +
  '    "dataInputs": ["..."],\n' +
  '    "outputs": ["..."],\n' +
  '    "potentialEmbodiments": ["..."],\n' +
  '    "provisionalClaimSketches": [\n' +
  '      { "type": "system|method|computer-readable-medium", "text": "...", ' +
  '"confidence": "low|medium|high", "missingSupport": ["..."] }\n' +
  '    ],\n' +
  '    "priorArtSearchPlan": {\n' +
  '      "searchQueries": ["..."],\n' +
  '      "databases": ["Google Patents", "USPTO", "WIPO Patentscope"],\n' +
  '      "classificationHints": ["..."]\n' +
  '    },\n' +
  '    "evidenceLedger": [\n' +
  '      { "source": "...", "value": "...", "howUsed": "...", "limitation": "..." }\n' +
  '    ],\n' +
  '    "missingInformation": ["..."],\n' +
  '    "humanReviewChecklist": ["..."]\n' +
  '  }\n' +
  '}\n\n' +
  'Rules:\n' +
  '- antiOverclaim.noveltyClaimed, patentabilityClaimed, filingReady MUST remain false.\n' +
  '- antiOverclaim.requiresHumanPatentReview MUST be true.\n' +
  '- status MUST be "draft_only".\n' +
  '- Avoid these words in draft prose: novel, novelty, patentable, patentability, ' +
  '"ready to file", "is approved", guarantee, "will achieve" without conditional language.\n' +
  '- Cite provenance.primarySource and feedSources entries where the packet supports a claim.\n' +
  '- Mark gaps explicitly in missingInformation[] rather than inventing facts.\n' +
  '- Use LIMEN/domain/node/diagnosis fields only as internal routing context. ' +
  'Do not mention LIMEN, internal domain states, stress bands, diagnoses, brain nodes, ' +
  'phase language, ArtifactPacket IDs, or readiness gates in public-facing draft prose. ' +
  'Translate them into real-world problems supported by feed provenance. Public-facing sections ' +
  'must reference real-world sources, observed conditions, market/regulatory/technical problems, ' +
  'and cited feed evidence.';

function _buildUserMessage(safeInput) {
  return 'ArtifactPacket safe-extract input (D3-A3.v3 schema):\n\n' +
    JSON.stringify(safeInput, null, 2) +
    '\n\nProduce the D3-B.patent.v1 JSON object now. Output JSON only — no surrounding prose.';
}

// ─── OpenAI invocation ─────────────────────────────────────────────────

async function _callOpenAI(apiKey, model, systemPrompt, userMessage, temperature) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);

  var body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage }
    ],
    temperature: typeof temperature === 'number' ? temperature : DEFAULT_TEMPERATURE,
    response_format: { type: 'json_object' }
  };

  try {
    var resp = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (e) { errText = '(no body)'; }
      return { ok: false, status: resp.status,
        error: 'AI_UPSTREAM_ERROR', upstreamMessage: errText.slice(0, 500) };
    }

    var data = await resp.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, status: 502,
        error: 'AI_EMPTY_RESPONSE', upstreamMessage: 'No content in choices[0].message.' };
    }
    return { ok: true, content: content };
  } catch (err) {
    clearTimeout(timer);
    var msg = (err && err.name === 'AbortError') ? 'Upstream timeout (' + AI_TIMEOUT_MS + 'ms)'
            : (err && err.message) ? String(err.message) : 'Unknown fetch error';
    return { ok: false, status: 502, error: 'AI_UPSTREAM_ERROR', upstreamMessage: msg.slice(0, 500) };
  }
}

// ─── Post-AI verification ──────────────────────────────────────────────

function _scanProhibitedLanguage(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  var hits = [];
  for (var i = 0; i < PROHIBITED_PATTERNS.length; i++) {
    var p = PROHIBITED_PATTERNS[i];
    if (p.pattern.test(text)) hits.push(p.reason);
  }
  return hits;
}

// D3-B.1 — internal-system-language scanner. Same shape as
// _scanProhibitedLanguage; emits an array of human-readable reason strings
// for any matching pattern.
function _scanInternalLanguage(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  var hits = [];
  for (var i = 0; i < INTERNAL_LANGUAGE_PATTERNS.length; i++) {
    var p = INTERNAL_LANGUAGE_PATTERNS[i];
    if (p.pattern.test(text)) hits.push(p.reason);
  }
  return hits;
}

// D3-B.1 — feed-grounded language check. Returns true ONLY when:
//   1. expansion.draft.evidenceLedger has at least one entry whose source
//      string contains a name from the artifactPacket's provenance.feedSources[]
//      OR matches provenance.primarySource.
//   2. expansion.draft.background, problemStatement, and technicalSolution
//      contain no internal-system-language hits.
// Fails silently (returns false) on any structural deviation; never throws.
function _verifyFeedGroundedLanguage(expansion, artifactPacket) {
  if (!expansion || !expansion.draft || typeof expansion.draft !== 'object') return false;
  if (!artifactPacket || !artifactPacket.provenance) return false;

  var prov = artifactPacket.provenance;
  var primarySource = (typeof prov.primarySource === 'string') ? prov.primarySource : '';
  var feedNames = [];
  if (Array.isArray(prov.feedSources)) {
    for (var i = 0; i < prov.feedSources.length; i++) {
      var s = prov.feedSources[i];
      if (s && typeof s.name === 'string' && s.name.length > 0) feedNames.push(s.name);
    }
  }
  if (primarySource) feedNames.push(primarySource);
  if (feedNames.length === 0) return false;

  // (1) evidenceLedger references at least one provenance source.
  var ledger = Array.isArray(expansion.draft.evidenceLedger) ? expansion.draft.evidenceLedger : [];
  var ledgerCitesProvenance = false;
  for (var li = 0; li < ledger.length && !ledgerCitesProvenance; li++) {
    var entry = ledger[li];
    if (!entry || typeof entry.source !== 'string' || entry.source.length === 0) continue;
    for (var fi = 0; fi < feedNames.length; fi++) {
      if (entry.source.indexOf(feedNames[fi]) !== -1) { ledgerCitesProvenance = true; break; }
    }
  }
  if (!ledgerCitesProvenance) return false;

  // (2) background / problemStatement / technicalSolution clean of internal language.
  var checkedFields = ['background', 'problemStatement', 'technicalSolution'];
  for (var fi2 = 0; fi2 < checkedFields.length; fi2++) {
    var text = expansion.draft[checkedFields[fi2]];
    if (typeof text === 'string' && _scanInternalLanguage(text).length > 0) return false;
  }

  return true;
}

function _walkDraftStrings(draft, visit) {
  if (!draft || typeof draft !== 'object') return;
  var keys = Object.keys(draft);
  for (var i = 0; i < keys.length; i++) {
    var v = draft[keys[i]];
    if (typeof v === 'string') {
      visit(keys[i], v);
    } else if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) {
        var item = v[j];
        if (typeof item === 'string') visit(keys[i] + '[' + j + ']', item);
        else if (item && typeof item === 'object') _walkDraftStrings(item, visit);
      }
    } else if (v && typeof v === 'object') {
      _walkDraftStrings(v, visit);
    }
  }
}

function _verifyExpansion(expansion, artifactPacket) {
  // Hard structural checks first — these block the response.
  if (!expansion || typeof expansion !== 'object') {
    return { ok: false, code: 'AI_RESPONSE_PARSE_FAILED',
      reason: 'Expansion is not an object.' };
  }
  var ao = expansion.antiOverclaim || {};
  if (ao.noveltyClaimed === true) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'AI claimed novelty' };
  }
  if (ao.patentabilityClaimed === true) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'AI claimed patentability' };
  }
  if (ao.filingReady === true) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'AI claimed filing-ready' };
  }
  if (expansion.status !== 'draft_only') {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'AI escalated status' };
  }

  // Soft prose scans — append warnings, may demote status, never block.
  if (!Array.isArray(expansion.antiOverclaim.unsupportedClaims)) {
    expansion.antiOverclaim.unsupportedClaims = [];
  }
  var overclaimDemoted = false;
  var internalLanguageLeaked = false;

  _walkDraftStrings(expansion.draft, function (path, text) {
    // Existing prohibited-claim-language scan.
    var prohHits = _scanProhibitedLanguage(text);
    if (prohHits.length > 0) {
      expansion.antiOverclaim.unsupportedClaims.push({
        path: path,
        reasons: prohHits,
        excerpt: text.slice(0, 240),
        kind: 'prohibited-claim-language'
      });
      overclaimDemoted = true;
    }
    // D3-B.1 internal-system-language scan.
    var intHits = _scanInternalLanguage(text);
    if (intHits.length > 0) {
      expansion.antiOverclaim.unsupportedClaims.push({
        path: path,
        reasons: intHits,
        excerpt: text.slice(0, 240),
        kind: 'internal-system-language-leaked'
      });
      internalLanguageLeaked = true;
    }
  });

  // Status demotion priority (D3-B.1):
  //   - internal-language hit → 'draft_with_internal_language_warnings'
  //   - else overclaim hit    → 'draft_with_overclaim_warnings'
  //   - else                  → keep 'draft_only'
  // unsupportedClaims[] always retains both kinds for reviewer inspection.
  if (internalLanguageLeaked) {
    expansion.status = 'draft_with_internal_language_warnings';
  } else if (overclaimDemoted) {
    expansion.status = 'draft_with_overclaim_warnings';
  }

  // D3-B.1 — feed-grounded language check (informational; does not affect status).
  var feedGroundedLanguage = _verifyFeedGroundedLanguage(expansion, artifactPacket);

  return {
    ok: true,
    demoted: overclaimDemoted,
    internalLanguageLeaked: internalLanguageLeaked,
    feedGroundedLanguage: feedGroundedLanguage
  };
}

// ─── D3-E.1 — NSF Project Pitch lane dispatcher ────────────────────────
//
// This branch is invoked from the main handler BEFORE the patents validator
// runs, so patents lane behavior is byte-identical to D3-C.1. NSF lane has
// its own validation, its own draft module, and its own response schema.
// Validation gates here are universal data-quality checks (lane-agnostic
// hard gates, provenance presence) shared in spirit with the patents path.

async function _handleNsfProjectPitch(artifactPacket, requestLane, requestOptions, res) {
  var NSF_LANE = 'nsf-project-pitch';

  // Lane consistency.
  var packetLane = (artifactPacket && artifactPacket.identity &&
                    typeof artifactPacket.identity.lane === 'string')
    ? artifactPacket.identity.lane : null;
  if (typeof requestLane === 'string' && requestLane !== NSF_LANE) {
    res.status(400).json({
      ok: false,
      error: 'UNSUPPORTED_LANE',
      message: 'request body lane must be "' + NSF_LANE + '"; received "' + requestLane + '".'
    });
    return;
  }
  if (packetLane && packetLane !== NSF_LANE) {
    res.status(400).json({
      ok: false,
      error: 'UNSUPPORTED_LANE',
      message: 'artifactPacket.identity.lane must be "' + NSF_LANE +
               '"; received "' + packetLane + '".'
    });
    return;
  }

  // Hard anti-overclaim gates (universal data-quality).
  var ao   = (artifactPacket && artifactPacket.anti_overclaim) || {};
  var prov = (artifactPacket && artifactPacket.provenance)     || {};
  var failedGates = [];
  if (ao.feedClassification !== 'real') failedGates.push('feedClassificationReal');
  if (ao.diagnosisActive   !== true)    failedGates.push('diagnosisActive');
  if (ao.snapshotFresh     !== true)    failedGates.push('snapshotFresh');
  if (ao.nodeResolved      !== true)    failedGates.push('nodeResolved');
  var hasLive = false;
  if (Array.isArray(prov.feedSources)) {
    for (var i = 0; i < prov.feedSources.length; i++) {
      if (prov.feedSources[i] && prov.feedSources[i].live === true) { hasLive = true; break; }
    }
  }
  if (!hasLive) failedGates.push('hasLiveSource');
  if (failedGates.length > 0) {
    res.status(422).json({
      ok: false,
      error: 'HARD_GATE_FAILED',
      message: 'One or more hard anti-overclaim gates failed.',
      failedGates: failedGates
    });
    return;
  }
  if (!prov.primarySource || !Array.isArray(prov.feedSources) || prov.feedSources.length === 0) {
    res.status(422).json({
      ok: false,
      error: 'MISSING_PROVENANCE',
      message: 'provenance.primarySource and non-empty feedSources are required.'
    });
    return;
  }

  // Minimum packet detail.
  var impl = (artifactPacket && artifactPacket.implementation) || {};
  var ev   = (artifactPacket && artifactPacket.evidence)       || {};
  var hasImpl     = !!(impl.action  || impl.doThis     || impl.nextStep);
  var hasEvidence = !!(ev.trigger   || ev.validation   || ev.outcome);
  if (!hasImpl || !hasEvidence) {
    res.status(422).json({
      ok: false,
      error: 'INSUFFICIENT_PACKET_DETAIL',
      message: 'Packet missing implementation actions or evidence required for NSF Project Pitch draft.'
    });
    return;
  }

  // Provider config (reuse OPENAI_API_KEY / OPENAI_MODEL — no new env vars).
  var apiKey = _resolveApiKey();
  if (!apiKey) {
    res.status(501).json({
      ok: false,
      error: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'OPENAI_API_KEY_D3B (preferred) or OPENAI_API_KEY env var is required.'
    });
    return;
  }
  var model = _resolveModel();
  if (!model) {
    res.status(501).json({
      ok: false,
      error: 'OPENAI_MODEL_NOT_CONFIGURED',
      message: 'OPENAI_MODEL env var must be set; no default model is hardcoded.'
    });
    return;
  }

  // Closure binds the existing _callOpenAI to the resolved key/model.
  var temperature = (typeof requestOptions.temperature === 'number')
    ? requestOptions.temperature : DEFAULT_TEMPERATURE;
  var openaiClient = {
    model: model,
    callChatCompletion: function (systemPrompt, userMessage, temp) {
      return _callOpenAI(
        apiKey, model, systemPrompt, userMessage,
        typeof temp === 'number' ? temp : temperature
      );
    }
  };

  // Delegate to the lane module.
  var nsfModule = require('../lanes/nsf-project-pitch');
  var result;
  try {
    result = await nsfModule.generateNsfProjectPitchDraft(artifactPacket, openaiClient);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: 'NSF_HANDLER_THREW',
      message: (e && e.message) ? String(e.message).slice(0, 500) : 'Handler threw.'
    });
    return;
  }

  if (!result || !result.ok) {
    var httpStatus = (result && result.code === 'NSF_DRAFT_VALIDATION_FAILED') ? 502
                   : (result && result.status) ? result.status
                   : 502;
    res.status(httpStatus).json({
      ok: false,
      error: (result && result.code) || 'NSF_DRAFT_GENERATION_FAILED',
      message: (result && result.message) || 'NSF draft generation failed.',
      rawAttempt1: result && result.rawAttempt1,
      rawAttempt2: result && result.rawAttempt2
    });
    return;
  }

  var packetId = (artifactPacket.identity && artifactPacket.identity.id) || null;
  var srcOpp   = (artifactPacket.identity && artifactPacket.identity.sourceOpportunityId) || null;

  res.status(200).json({
    ok: true,
    schemaVersion: 'D3-E.api.v1',
    artifactPacketId: packetId,
    sourceOpportunityId: srcOpp,
    lane: NSF_LANE,
    provider: result.provider,
    model: result.model,
    expansionSchemaVersion: result.schemaVersion,
    retried: result.retried === true,
    createdAt: new Date().toISOString(),
    expansion: result.expansion,
    guards: {
      packetReady:         true,
      hardGatesPassed:     true,
      noAutoSubmission:    true,
      requiresHumanReview: true,
      sourceContractBound: true
    }
  });
}

// ─── Handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Gate 1: method
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED',
      message: 'POST only.' });
    return;
  }

  var body = req.body;
  if (typeof body !== 'object' || body === null) {
    res.status(400).json({ ok: false, error: 'MISSING_ARTIFACT_PACKET',
      message: 'Request body must be a JSON object with artifactPacket.' });
    return;
  }

  // Soft body-size guard.
  try {
    var serialized = JSON.stringify(body);
    if (typeof serialized === 'string' && serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({ ok: false, error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds ' + MAX_BODY_BYTES + ' bytes.' });
      return;
    }
  } catch (e) { /* JSON.stringify of req.body should never fail; ignore */ }

  var artifactPacket = body.artifactPacket;
  var requestLane    = body.lane;
  var requestMode    = body.mode;
  var requestOptions = body.options || {};

  // D3-E.1 — lane router. NSF Project Pitch traffic is routed to its dedicated
  // module BEFORE the patents validator runs, so the patents code path below
  // is byte-identical to D3-C.1. Any lane other than 'nsf-project-pitch'
  // (including 'patents' or unspecified) falls through to the patents flow,
  // which then re-asserts patents-only via _validatePacket.
  var packetLaneForRouter = (artifactPacket && artifactPacket.identity &&
                             typeof artifactPacket.identity.lane === 'string')
    ? artifactPacket.identity.lane : null;
  var effectiveLaneForRouter = (typeof requestLane === 'string' && requestLane.length > 0)
    ? requestLane
    : packetLaneForRouter;
  if (effectiveLaneForRouter === 'nsf-project-pitch') {
    if (!artifactPacket || typeof artifactPacket !== 'object') {
      res.status(400).json({
        ok: false,
        error: 'MISSING_ARTIFACT_PACKET',
        message: 'Request body must include an artifactPacket object.'
      });
      return;
    }
    await _handleNsfProjectPitch(artifactPacket, requestLane, requestOptions, res);
    return;
  }

  // Validate packet (gates 2-7)
  var validationError = _validatePacket(artifactPacket, requestLane);
  if (validationError) {
    var out = {
      ok: false,
      error: validationError.code,
      message: validationError.message
    };
    if (validationError.failedGates) out.failedGates = validationError.failedGates;
    res.status(validationError.http).json(out);
    return;
  }

  // Resolve provider config
  var apiKey = _resolveApiKey();
  if (!apiKey) {
    res.status(501).json({ ok: false, error: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'OPENAI_API_KEY_D3B (preferred) or OPENAI_API_KEY env var is required.' });
    return;
  }
  var model = _resolveModel();
  if (!model) {
    res.status(501).json({ ok: false, error: 'OPENAI_MODEL_NOT_CONFIGURED',
      message: 'OPENAI_MODEL env var must be set; no default model is hardcoded.' });
    return;
  }

  // Build prompt
  var safeInput = _extractSafeInput(artifactPacket);
  var userMessage = _buildUserMessage(safeInput);
  var temperature = (typeof requestOptions.temperature === 'number')
    ? requestOptions.temperature : DEFAULT_TEMPERATURE;

  // Call OpenAI
  var aiResult = await _callOpenAI(apiKey, model, SYSTEM_PROMPT, userMessage, temperature);
  if (!aiResult.ok) {
    res.status(aiResult.status || 502).json({
      ok: false,
      error: aiResult.error || 'AI_UPSTREAM_ERROR',
      message: aiResult.upstreamMessage || 'AI upstream failed.'
    });
    return;
  }

  // Parse AI JSON
  var expansion;
  try {
    expansion = JSON.parse(aiResult.content);
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: 'AI_RESPONSE_PARSE_FAILED',
      message: (e && e.message) ? String(e.message).slice(0, 500) : 'JSON.parse failed.',
      rawTruncated: typeof aiResult.content === 'string' ? aiResult.content.slice(0, 500) : null
    });
    return;
  }

  // Post-AI verification (anti-overclaim + prose scan + internal-language scan)
  var verify = _verifyExpansion(expansion, artifactPacket);
  if (!verify.ok) {
    res.status(502).json({
      ok: false,
      error: verify.code,
      message: verify.reason,
      // Include the raw expansion so the human reviewer can inspect what the
      // AI produced without silent loss. The expansion is NOT shipped through
      // any persistence layer.
      rejectedExpansion: expansion
    });
    return;
  }

  var packetId = (artifactPacket.identity && artifactPacket.identity.id) || null;
  var srcOpp   = (artifactPacket.identity && artifactPacket.identity.sourceOpportunityId) || null;

  // Mirror the safe-extract identity onto the response so the AI's
  // self-reported artifactPacketId/sourceOpportunityId is independently
  // verifiable against the request.
  if (expansion.artifactPacketId !== packetId)        expansion.artifactPacketId = packetId;
  if (expansion.sourceOpportunityId !== srcOpp)       expansion.sourceOpportunityId = srcOpp;
  if (expansion.lane !== SUPPORTED_LANE)              expansion.lane = SUPPORTED_LANE;
  if (expansion.notLegalAdvice !== true)              expansion.notLegalAdvice = true;

  res.status(200).json({
    ok: true,
    schemaVersion: API_SCHEMA_VERSION,
    artifactPacketId: packetId,
    lane: SUPPORTED_LANE,
    provider: 'openai',
    model: model,
    createdAt: new Date().toISOString(),
    expansion: expansion,
    guards: {
      packetReady:                true,
      hardGatesPassed:            true,
      noAutoFiling:               true,
      patentabilityNotClaimed:    !verify.demoted,
      proseScanFlaggedOverclaim:  !!verify.demoted,
      externalLanguageClean:      !verify.internalLanguageLeaked,
      feedGroundedLanguage:       !!verify.feedGroundedLanguage
    }
  });
};

// F0 test hook (additive, no runtime effect): expose the pure safe-extractor so the
// survival probe can prove the finalizer now reads the Energy recurrent brain model.
module.exports._extractSafeInput = _extractSafeInput;
