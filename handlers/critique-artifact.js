/**
 * api/critique-artifact.js
 *
 * D3-C.0 — Server-side ArtifactPacket adversarial critique endpoint
 *          (Grok / xAI). Patents lane.
 *
 * D3-E.2 — Adds nsf-project-pitch lane via a LANE_HANDLERS dispatch
 *          table. Patents prompt, draft extractor, anti-overclaim flag
 *          set, prohibited-language patterns, and blocking regex set
 *          are all preserved as PATENTS_* constants. NSF lane uses
 *          parallel NSF_* constants. The objection-ledger normalization
 *          rules (severity, dedup, sort, cap, allowedResolutions) are
 *          the same for both lanes — only the lane-specific blocking
 *          regex is swapped in via the lane handler at derivation time.
 *
 * POST /api/critique-artifact
 *   body: {
 *     artifactPacket: { ... },
 *     draft:          { ... optional patents D3-B expansion / required NSF D3-E.nsf.v1 expansion ... },
 *     lane:           "patents" | "nsf-project-pitch",
 *     mode:           "critique",
 *     options:        { temperature: 0.0..0.4 }
 *   }
 *
 * Behavior:
 *   - Mirrors api/expand-artifact.js (D3-B / D3-B.1 / D3-E.1) structure:
 *     same CORS, body-size guard, validation gate sequence, provider
 *     env fail-safe, response shape conventions, Cache-Control.
 *   - Calls xAI Chat Completions (OpenAI-compatible) via native fetch.
 *   - Returns a Grok adversarial-critique memo. Critique only — no
 *     draft, no endorsement, no patentability/novelty/filing-ready
 *     claims for patents, no award/eligibility/submission-readiness
 *     /intellectual-merit-established/broader-impacts-achieved
 *     /reviewer-consensus/prior-award-success claims for NSF.
 *   - Does NOT persist, file, submit, email, or enqueue anything.
 *   - Does NOT replace, override, or rewrite the artifact draft.
 *   - Does NOT decide. Critique is not approval. Draft is not
 *     submission. Objection ledger is not validation.
 *
 * Required env vars:
 *   - XAI_API_KEY_D3C (preferred) OR XAI_API_KEY (fallback)
 *   - XAI_MODEL (no default; endpoint returns 501 if absent)
 *   - No new env vars added in D3-E.2.
 *
 * Schema versions:
 *   - API request/response: D3-C.api.v1
 *   - Grok critique JSON:   D3-C.grok.v1 (shared shape with lane-specific
 *                           antiOverclaim flag set + NSF-only fields
 *                           characterLimitCompliance + unknownFieldsAssessment)
 *
 * Scope:
 *   - Lanes: patents, nsf-project-pitch.
 *   - All other lanes → 400 UNSUPPORTED_LANE.
 *   - Grok critique standalone — no orchestration, no Claude, no GPT
 *     finalizer, no council state, no UI surface here. Future stages
 *     (D3-H finalizer, D3-I deterministic verifier, Master Brain)
 *     live in separate endpoints; this file is independent of all
 *     of them.
 *   - No persistence layer.
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────

var MAX_BODY_BYTES = 256 * 1024;       // 256KB cap on artifactPacket+draft payload
var DEFAULT_TEMPERATURE = 0.1;         // critique benefits from low randomness
var MAX_TEMPERATURE = 0.4;             // safe upper bound; clamps requested values
// D3-F.1: per-attempt timeout bumped from 60s → 90s. Combined with the
// per-route maxDuration export at the bottom of this file (300s, Pro
// tier max) and a single retry on AbortError only, total wall-clock
// budget is ~180s. 90s leaves 30s headroom over historic p95 critique
// latency without crowding the function ceiling.
var AI_TIMEOUT_MS = 90 * 1000;
var MAX_ATTEMPTS = 2;                  // initial + 1 retry on AbortError only
var XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
var CRITIQUE_SCHEMA_VERSION = 'D3-C.grok.v1';
var API_SCHEMA_VERSION = 'D3-C.api.v1';

var PATENTS_LANE = 'patents';
var NSF_LANE     = 'nsf-project-pitch';

// ─── Internal-system-language patterns (lane-agnostic) ─────────────────
//
// Mirror D3-B.1. Grok IS allowed to name internal terms in its critique
// (e.g., naming GRID_COLLAPSE in internalLanguageLeaks[].term as the very
// thing it's flagging in the original draft). The scanner runs across all
// critique strings; any hit flips guards.externalLanguageClean to false
// but never blocks. Reviewer triages whether each hit is a genuine leak
// or an explicit critique finding.

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

// ─── PATENTS lane assets ───────────────────────────────────────────────

var PATENTS_FLAGS = {
  didNotEndorse:              true,
  didNotConfirmPatentability: true,
  didNotClaimNovelty:         true,
  didNotClaimFilingReady:     true
};

// Patents prohibited-language patterns. ANY hit blocks the response.
var PATENTS_PROHIBITED = [
  { pattern: /\bnovel(ty)?\b/i,           reason: 'novelty language' },
  { pattern: /\bpatentab(le|ility)\b/i,   reason: 'patentability language' },
  { pattern: /\bready\s+to\s+file\b/i,    reason: 'filing-ready language' },
  { pattern: /\bready\s+for\s+filing\b/i, reason: 'filing-ready language' },
  { pattern: /\bis\s+approved\b/i,        reason: 'approval language' },
  { pattern: /\bguarante(e|es|ed|s)\b/i,  reason: 'guarantee language' },
  { pattern: /\bwill\s+achieve\b/i,       reason: 'unconditional achievement language' }
];

// Patents blocking-severity regex (used by the objection-ledger normalizer
// to escalate `overclaim_risk` entries from major → blocking when they
// reference patents-specific overclaim categories). Lane-aware.
var PATENTS_BLOCKING_RX = [
  /\bnovelty\b/i,
  /\bpatentab(le|ility)\b/i,
  /\bfil(e|ing)\b/i,
  /\bguarante(e|es|ed|s)\b/i,
  /\bwill\s+achieve\b/i,
  /\bapproved\b/i
];

// ─── NSF lane assets (D3-E.2) ──────────────────────────────────────────

var NSF_FLAGS = {
  didNotEndorse:                          true,
  didNotClaimAward:                       true,
  didNotClaimAgencyEndorsement:           true,
  didNotClaimEligibilityApproval:         true,
  didNotClaimSubmissionReadiness:         true,
  didNotClaimIntellectualMeritEstablished:true,
  didNotClaimBroaderImpactsAchieved:      true,
  didNotClaimReviewerConsensus:           true,
  didNotClaimPriorAwardSuccess:           true
};

// NSF prohibited-language patterns. ANY hit blocks the response.
// Sourced from api/protected-docs/D3-E-NSF-RESEARCH.md (captured 2026-04-30)
// + D3-E.2 design-lock hardening (NSF has indicated, program officer
// confirmed, consistent with funded portfolio, meets NSF priorities,
// track record of NSF support, letter of intent accepted, concept paper
// approved). Bad wording must NOT appear in the critique.
var NSF_PROHIBITED = [
  { pattern: /\bpre[-\s]?approv(ed|al)\b/i,                            reason: 'pre-approval language' },
  { pattern: /\bNSF\s+will\s+fund\b/i,                                 reason: 'NSF funding guarantee language' },
  { pattern: /\bguaranteed\s+(award|funding|support)\b/i,              reason: 'guaranteed-award/funding language' },
  { pattern: /\binvited\s+by\s+NSF\b/i,                                reason: 'NSF invitation claim' },
  { pattern: /\bagency\s+endorsement\b/i,                              reason: 'agency endorsement language' },
  { pattern: /\beligibility\s+approv(ed|al)\b/i,                       reason: 'eligibility approval language' },
  { pattern: /\bsubmission[-\s]?ready\b/i,                             reason: 'submission readiness language' },
  { pattern: /\bNSF\s+has\s+indicated\b/i,                             reason: 'NSF indication claim' },
  { pattern: /\bprogram\s+officer\s+has\s+confirmed\b/i,               reason: 'program officer confirmation claim' },
  { pattern: /\bconsistent\s+with\s+(the\s+)?funded\s+portfolio\b/i,   reason: 'funded-portfolio alignment claim' },
  { pattern: /\bmeets\s+NSF\s+priorities\b/i,                          reason: 'meets-NSF-priorities claim' },
  { pattern: /\btrack\s+record\s+of\s+NSF\s+support\b/i,               reason: 'NSF track record claim' },
  { pattern: /\bletter\s+of\s+intent\s+(was\s+)?accepted\b/i,          reason: 'LOI accepted claim' },
  { pattern: /\bconcept\s+paper\s+(was\s+)?approved\b/i,               reason: 'concept paper approved claim' }
];

// NSF blocking-severity regex set. Used by the objection-ledger normalizer
// to escalate findings to blocking severity when they reference NSF
// approval/funding/endorsement/reviewer-consensus claim families.
//
// Two funding-claim patterns: one for each ordering ("funding ... will be
// approved" and "will receive ... funding"). Both must be caught.
var NSF_BLOCKING_RX = [
  /\b(funded|funding)\b.{0,80}\b(guaranteed|assured|secured|approved|will be|will receive)\b/i,
  /\b(will\s+receive|will\s+be|guaranteed|assured|secured|approved)\b.{0,80}\b(funded|funding|award|support)\b/i,
  /\breviewer(s)?\b.{0,80}\b(will|must|are expected to)\b/i,
  /\bendorse(d|ment|s)?\b/i,
  /\bagency\s+endorse(d|ment)?\b/i,
  /\bNSF\s+endorse(d|ment|s)?\b/i,
  /\bintellectual\s+merit\b.{0,80}\b(established|proven|demonstrated|confirmed)\b/i,
  /\bbroader\s+impacts?\b.{0,80}\b(achieved|proven|demonstrated|confirmed)\b/i,
  /\bNSF\s+has\s+indicated\b/i,
  /\bprogram\s+officer\s+has\s+confirmed\b/i,
  /\bconsistent\s+with\s+(the\s+)?funded\s+portfolio\b/i,
  /\bmeets\s+NSF\s+priorities\b/i,
  /\btrack\s+record\s+of\s+NSF\s+support\b/i,
  /\bletter\s+of\s+intent\s+(was\s+)?accepted\b/i,
  /\bconcept\s+paper\s+(was\s+)?approved\b/i
];

// ─── Safe input extraction (lane-agnostic) ─────────────────────────────

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
    warningCodes: _extractWarningCodes(p)
  };
}

// ─── Lane-specific draft extractors ────────────────────────────────────
//
// Each extractor returns either the normalized safe-extract object, or
// null if the draft does not have enough detail to critique. The handler
// translates a null return into 422 INSUFFICIENT_DRAFT_DETAIL when the
// lane requires a draft (NSF). For patents, draft remains optional —
// null + null draft just means no draft is sent to Grok.

function _extractPatentsDraftSafeInput(d) {
  if (!d || typeof d !== 'object') return null;
  var draft = (d.draft && typeof d.draft === 'object') ? d.draft : {};
  var ao    = (d.antiOverclaim && typeof d.antiOverclaim === 'object') ? d.antiOverclaim : {};
  return {
    status: d.status || null,
    antiOverclaim: {
      noveltyClaimed:            ao.noveltyClaimed === true,
      patentabilityClaimed:      ao.patentabilityClaimed === true,
      filingReady:               ao.filingReady === true,
      requiresHumanPatentReview: ao.requiresHumanPatentReview === true,
      unsupportedClaims:         Array.isArray(ao.unsupportedClaims) ? ao.unsupportedClaims : []
    },
    draft: {
      inventionTitle:           draft.inventionTitle || '',
      field:                    draft.field || '',
      background:               draft.background || '',
      problemStatement:         draft.problemStatement || '',
      technicalSolution:        draft.technicalSolution || '',
      systemComponents:         Array.isArray(draft.systemComponents) ? draft.systemComponents : [],
      methodSteps:              Array.isArray(draft.methodSteps) ? draft.methodSteps : [],
      dataInputs:               Array.isArray(draft.dataInputs) ? draft.dataInputs : [],
      outputs:                  Array.isArray(draft.outputs) ? draft.outputs : [],
      potentialEmbodiments:     Array.isArray(draft.potentialEmbodiments) ? draft.potentialEmbodiments : [],
      provisionalClaimSketches: Array.isArray(draft.provisionalClaimSketches) ? draft.provisionalClaimSketches : [],
      priorArtSearchPlan:       draft.priorArtSearchPlan || null,
      evidenceLedger:           Array.isArray(draft.evidenceLedger) ? draft.evidenceLedger : [],
      missingInformation:       Array.isArray(draft.missingInformation) ? draft.missingInformation : [],
      humanReviewChecklist:     Array.isArray(draft.humanReviewChecklist) ? draft.humanReviewChecklist : []
    },
    guards: (d.guards && typeof d.guards === 'object') ? d.guards : null
  };
}

function _extractNsfDraftSafeInput(d) {
  if (!d || typeof d !== 'object') return null;
  var draft = (d.draft && typeof d.draft === 'object') ? d.draft : null;
  if (!draft) return null;

  function _section(s) {
    if (!s || typeof s !== 'object') return { content: '', charCount: 0, charLimit: 0 };
    return {
      content:   typeof s.content === 'string' ? s.content : '',
      charCount: (typeof s.charCount === 'number') ? s.charCount : 0,
      charLimit: (typeof s.charLimit === 'number') ? s.charLimit : 0
    };
  }

  var s1 = _section(draft.section1_innovation);
  var s2 = _section(draft.section2_technicalObjectives);
  var s3 = _section(draft.section3_marketOpportunity);
  var s4 = _section(draft.section4_companyTeam);

  // Fail-closed insufficient-detail check: at least one section must have
  // non-empty content. Empty NSF expansions cannot be critiqued; the
  // handler converts a null return into 422 INSUFFICIENT_DRAFT_DETAIL.
  var hasAnyContent = (s1.content.trim().length > 0) ||
                      (s2.content.trim().length > 0) ||
                      (s3.content.trim().length > 0) ||
                      (s4.content.trim().length > 0);
  if (!hasAnyContent) return null;

  return {
    status:         d.status || null,
    unknownFields:  Array.isArray(d.unknownFields) ? d.unknownFields.slice() : [],
    sourceContract: (d.sourceContract && typeof d.sourceContract === 'object')
      ? {
          docPath:      d.sourceContract.docPath      || '',
          capturedDate: d.sourceContract.capturedDate || ''
        }
      : null,
    draft: {
      title:                        draft.title || '',
      section1_innovation:          s1,
      section2_technicalObjectives: s2,
      section3_marketOpportunity:   s3,
      section4_companyTeam:         s4
    }
  };
}

// ─── Lane-specific system prompts ──────────────────────────────────────

var PATENTS_SYSTEM_PROMPT =
  'You are performing adversarial critique only. You are not drafting an artifact, ' +
  'not approving an artifact, not validating novelty, not validating patentability, ' +
  'not providing legal advice, not filing, and not endorsing.\n\n' +
  'Your job is to identify weaknesses, unsupported claims, missing evidence, freshness ' +
  'problems, internal-system-language leakage, public-facing wording problems, and ' +
  'real-world reviewer objections (patent examiner, patent attorney, technical ' +
  'reviewer, grant reviewer, investor, operator). Use only the supplied packet, ' +
  'optional draft, and provenance. Return structured JSON only matching the schema ' +
  'D3-C.grok.v1 documented below.\n\n' +
  'Hard rules:\n' +
  '- Do not write a patent draft. Do not rewrite the artifact.\n' +
  '- Do not endorse the artifact. Do not say it is novel. Do not say it is patentable. ' +
  'Do not say it is ready to file. Do not approve. Do not guarantee outcomes.\n' +
  '- Do not treat multi-AI agreement as validity. Multiple critiques agreeing on a ' +
  'point still requires human and deterministic verification.\n' +
  '- Translate internal packet/domain/node/diagnosis language into real-world ' +
  'critique terms. When you must reference an internal term (e.g., to flag it as a ' +
  'leak), do so only inside critique.internalLanguageLeaks[].term so the public-facing ' +
  'recommendation fields stay in real-world language.\n' +
  '- Cite the supplied provenance.primarySource and feedSources entries when ' +
  'identifying weakest links and missing evidence. Do not invent sources.\n' +
  '- If the packet is sound, say so honestly via critique.goNoGo = "acceptable_for_human_review", ' +
  'but do not soften the critique to please anyone.\n\n' +
  'Required output JSON shape:\n' +
  '{\n' +
  '  "ok": true,\n' +
  '  "schemaVersion": "D3-C.grok.v1",\n' +
  '  "lane": "patents",\n' +
  '  "artifactPacketId": "<from input.identity.id>",\n' +
  '  "sourceOpportunityId": "<from input.identity.sourceOpportunityId>",\n' +
  '  "status": "critique_only",\n' +
  '  "notDraft": true,\n' +
  '  "antiOverclaim": {\n' +
  '    "didNotEndorse": true,\n' +
  '    "didNotConfirmPatentability": true,\n' +
  '    "didNotClaimNovelty": true,\n' +
  '    "didNotClaimFilingReady": true,\n' +
  '    "unsupportedClaims": []\n' +
  '  },\n' +
  '  "critique": {\n' +
  '    "summary": "...",\n' +
  '    "realWorldFraming": "...",\n' +
  '    "strongestEvidence": [\n' +
  '      { "source": "...", "whyItMatters": "...", "limitation": "..." }\n' +
  '    ],\n' +
  '    "weakestLinks": [\n' +
  '      { "issue": "...", "whyItMatters": "...", "neededEvidence": "..." }\n' +
  '    ],\n' +
  '    "overclaimRisks": [\n' +
  '      { "claim": "...", "risk": "...", "recommendedFix": "..." }\n' +
  '    ],\n' +
  '    "internalLanguageLeaks": [\n' +
  '      { "term": "...", "where": "...", "recommendedReplacement": "..." }\n' +
  '    ],\n' +
  '    "sourceFreshnessConcerns": [\n' +
  '      { "source": "...", "concern": "...", "recommendedCheck": "..." }\n' +
  '    ],\n' +
  '    "reviewerObjections": [\n' +
  '      { "reviewerType": "patent_examiner|patent_attorney|technical_reviewer|grant_reviewer|investor|operator", ' +
  '"objection": "...", "recommendedResponse": "..." }\n' +
  '    ],\n' +
  '    "missingEvidence": ["..."],\n' +
  '    "recommendedEdits": ["..."],\n' +
  '    "goNoGo": "revise|acceptable_for_human_review|blocked"\n' +
  '  }\n' +
  '}\n\n' +
  'Anti-overclaim invariants you MUST satisfy in your output:\n' +
  '- status === "critique_only".\n' +
  '- notDraft === true.\n' +
  '- antiOverclaim.didNotEndorse === true.\n' +
  '- antiOverclaim.didNotConfirmPatentability === true.\n' +
  '- antiOverclaim.didNotClaimNovelty === true.\n' +
  '- antiOverclaim.didNotClaimFilingReady === true.\n' +
  '- Avoid in critique prose: novel, novelty, patentable, patentability, "ready to file", ' +
  '"is approved", guarantee, "will achieve" without conditional language.';

var NSF_SYSTEM_PROMPT = [
  'You are performing adversarial critique only on an NSF SBIR/STTR Project Pitch draft.',
  'You are not drafting, rewriting, approving, validating, endorsing, or submitting.',
  'You are not a grant writer, not an NSF reviewer, not an NSF program officer, and',
  'not an attorney. You are not determining eligibility. You are not predicting awards.',
  '',
  'Your job is to identify weaknesses, unsupported claims, missing evidence, freshness',
  'problems, internal-system-language leakage, public-facing wording problems, and',
  'real-world reviewer objections (NSF program officer, NSF SBIR/STTR reviewer,',
  'technical reviewer, commercial reviewer, operator). Use only the supplied packet,',
  'draft, and provenance. Return structured JSON only matching the schema D3-C.grok.v1',
  '(NSF lane variant) documented below.',
  '',
  'NSF SOURCE CONTRACT — VERIFIED FACTS (from api/protected-docs/D3-E-NSF-RESEARCH.md, captured 2026-04-30):',
  '- Project Pitch is 4 sections with character limits: 3500 / 3500 / 1750 / 1750',
  '- Phase I: up to $305K, average $295,822, range $154,646-$305K, 6-18 months',
  '- Phase II: up to $1.25M, 24 months',
  '- Eligibility: <500 employees; >=50% US-citizen/permanent-resident equity;',
  '  no VC/PE/hedge-fund coalition majority',
  '- PI commits >=20 hours/week to the company and >=1 month per 6-month period',
  '- 0% equity taken (non-dilutive grant)',
  '- 26 topic areas exist (count only — do not enumerate)',
  '- Evaluation language is directional only: "innovativeness, commercial potential,',
  '  possible societal impact" — NO weights, NO rubric structure, NO scoring scheme',
  '- Submissions paused as of 2026-04-16',
  '',
  'NSF UNKNOWN FIELDS (from source contract). The draft may legitimately list any of',
  'these in unknownFields[]; do NOT penalize the draft for honestly listing unknowns.',
  'DO penalize the draft if it fills any of these with fabricated content:',
  '- evaluationRubric (specific scoring weights)',
  '- FY2026SolicitationNumber',
  '- STTRRDSplit (small-business / research-institution split percentages)',
  '- topicToDirectorate (which topic routes to which directorate)',
  '- declineReasons (decline-reason taxonomy)',
  '- exclusionLanguage (full "we do not fund X" list)',
  '',
  'INTELLECTUAL MERIT and BROADER IMPACTS are review CRITERIA the pitch should',
  'STRENGTHEN, not OUTCOMES the pitch can claim are ESTABLISHED, ACHIEVED, PROVEN, or',
  'CONFIRMED. Critique should call out any draft prose that conflates the two.',
  '',
  'NSF FORBIDDEN CLAIMS — flag in critique under unsupportedClaims, overclaimRisks,',
  'or reviewerObjections if the draft asserts any of:',
  '- guaranteed award; pre-approved; NSF will fund; invited by NSF (without invitation evidence)',
  '- agency endorsement; eligibility approval; submission readiness',
  '- "NSF has indicated"; "program officer has confirmed"',
  '- "consistent with the funded portfolio"; "meets NSF priorities"',
  '- "track record of NSF support"; "letter of intent accepted"; "concept paper approved"',
  '- "intellectual merit established/proven/demonstrated/confirmed"',
  '- "broader impacts achieved/proven/demonstrated/confirmed"',
  '- "reviewer consensus"; "reviewers will find this..." (or any prediction of reviewer response)',
  '- "prior award success" used as proof of future success',
  '- "proven commercial success" without supporting evidence',
  '- no technical risk; guaranteed outcomes',
  '- unsupported market size; unsupported customer demand',
  '- specific evaluation rubric weights, FY2026 solicitation number, STTR R&D split,',
  '  topic-to-directorate routing — UNLESS those facts appear in the source contract above',
  '',
  'PREFERRED SAFE WORDING (use these phrasings in your critique recommendations):',
  '- "addresses NSF priorities" (instead of "meets NSF priorities")',
  '- "responds to NSF priorities"',
  '- "appears aligned with solicitation criteria subject to human review"',
  '- "strengthen the intellectual merit section"',
  '- "clarify broader impacts metrics"',
  '- "human review is required before submission"',
  '',
  'CRITIQUE FOCUS for NSF Project Pitch drafts:',
  '- Whether each section respects the verified character limits (over-limit = blocking)',
  '- Whether status and unknownFields are consistent (status="draft-with-gaps" iff unknownFields non-empty)',
  '- Whether unknown NSF fields stay unknown (not invented)',
  '- Whether technical innovation is specific (not generic)',
  '- Whether commercial opportunity is supported (not inflated)',
  '- Whether customer pain / use case is concrete',
  '- Whether R&D risk is acknowledged',
  '- Whether broader/societal impact is grounded (not aspirational, not "achieved")',
  '- Whether team capability is supported by the packet (or properly marked missing)',
  '- Whether internal LIMEN/domain/node/diagnosis vocabulary leaks into public-facing prose',
  '- Whether evidence cites real-world sources from provenance (not internal stress labels)',
  '- Whether the draft makes any forbidden claims',
  '',
  'Hard rules:',
  '- Do not write or rewrite the pitch. Critique only.',
  '- Do not endorse the pitch. Do not call it competitive, fundable, or likely to win.',
  '- Do not predict reviewer response or claim reviewer consensus.',
  '- Do not claim NSF will fund, has invited, has approved, or has endorsed.',
  '- Do not claim eligibility approval. Eligibility is determined by NSF, not by you.',
  '- Do not claim submission readiness. Final readiness requires human review.',
  '- Do not say intellectual merit is established / proven / demonstrated / confirmed.',
  '  Intellectual merit is a review criterion to strengthen, not an outcome to claim.',
  '- Do not say broader impacts are achieved / proven / demonstrated / confirmed.',
  '  Broader impacts are a review criterion to strengthen, not an outcome to claim.',
  '- Do not invent rubric weights, solicitation numbers, R&D splits, or directorate routing.',
  '- Translate internal packet/domain/node/diagnosis language into real-world critique terms.',
  '  When you must reference an internal term to flag it as a leak, place it in',
  '  critique.internalLanguageLeaks[].term so public-facing recommendation fields stay clean.',
  '- Cite provenance.primarySource and feedSources[] when identifying weakest links',
  '  and missing evidence. Do not invent sources.',
  '- If the packet is sound, set critique.goNoGo = "acceptable_for_human_review",',
  '  but do not soften the critique to please anyone.',
  '- Preserve unresolved objections. If you cannot answer an objection from the supplied',
  '  evidence, carry it forward in reviewerObjections / weakestLinks / missingEvidence.',
  '',
  'Required output JSON shape:',
  '{',
  '  "ok": true,',
  '  "schemaVersion": "D3-C.grok.v1",',
  '  "lane": "nsf-project-pitch",',
  '  "artifactPacketId": "<from input.identity.id>",',
  '  "sourceOpportunityId": "<from input.identity.sourceOpportunityId>",',
  '  "status": "critique_only",',
  '  "notDraft": true,',
  '  "antiOverclaim": {',
  '    "didNotEndorse": true,',
  '    "didNotClaimAward": true,',
  '    "didNotClaimAgencyEndorsement": true,',
  '    "didNotClaimEligibilityApproval": true,',
  '    "didNotClaimSubmissionReadiness": true,',
  '    "didNotClaimIntellectualMeritEstablished": true,',
  '    "didNotClaimBroaderImpactsAchieved": true,',
  '    "didNotClaimReviewerConsensus": true,',
  '    "didNotClaimPriorAwardSuccess": true,',
  '    "unsupportedClaims": []',
  '  },',
  '  "critique": {',
  '    "summary": "...",',
  '    "realWorldFraming": "...",',
  '    "strongestEvidence": [{"source":"...","whyItMatters":"...","limitation":"..."}],',
  '    "weakestLinks": [{"issue":"...","whyItMatters":"...","neededEvidence":"..."}],',
  '    "overclaimRisks": [{"claim":"...","risk":"...","recommendedFix":"..."}],',
  '    "internalLanguageLeaks": [{"term":"...","where":"...","recommendedReplacement":"..."}],',
  '    "sourceFreshnessConcerns": [{"source":"...","concern":"...","recommendedCheck":"..."}],',
  '    "reviewerObjections": [{"reviewerType":"nsf_program_officer|nsf_reviewer|technical_reviewer|commercial_reviewer|operator","objection":"...","recommendedResponse":"..."}],',
  '    "missingEvidence": ["..."],',
  '    "recommendedEdits": ["..."],',
  '    "goNoGo": "revise|acceptable_for_human_review|blocked",',
  '    "characterLimitCompliance": [',
  '      { "section": "section1_innovation",          "withinLimit": true, "charCount": 0, "charLimit": 3500 },',
  '      { "section": "section2_technicalObjectives", "withinLimit": true, "charCount": 0, "charLimit": 3500 },',
  '      { "section": "section3_marketOpportunity",   "withinLimit": true, "charCount": 0, "charLimit": 1750 },',
  '      { "section": "section4_companyTeam",         "withinLimit": true, "charCount": 0, "charLimit": 1750 }',
  '    ],',
  '    "unknownFieldsAssessment": {',
  '      "claimedUnknowns":     ["..."],',
  '      "fabricatedUnknowns":  ["..."],',
  '      "unaddressedUnknowns": ["..."]',
  '    }',
  '  }',
  '}',
  '',
  'Anti-overclaim invariants you MUST satisfy in your output:',
  '- status === "critique_only".',
  '- notDraft === true.',
  '- antiOverclaim.didNotEndorse === true.',
  '- antiOverclaim.didNotClaimAward === true.',
  '- antiOverclaim.didNotClaimAgencyEndorsement === true.',
  '- antiOverclaim.didNotClaimEligibilityApproval === true.',
  '- antiOverclaim.didNotClaimSubmissionReadiness === true.',
  '- antiOverclaim.didNotClaimIntellectualMeritEstablished === true.',
  '- antiOverclaim.didNotClaimBroaderImpactsAchieved === true.',
  '- antiOverclaim.didNotClaimReviewerConsensus === true.',
  '- antiOverclaim.didNotClaimPriorAwardSuccess === true.',
  '- Avoid in critique prose: "guaranteed award", "pre-approved", "NSF will fund",',
  '  "invited by NSF", "agency endorse...", "eligibility approval", "submission-ready",',
  '  "NSF has indicated", "program officer has confirmed", "consistent with funded portfolio",',
  '  "meets NSF priorities", "track record of NSF support", "letter of intent accepted",',
  '  "concept paper approved", "intellectual merit established/proven/demonstrated/confirmed",',
  '  "broader impacts achieved/proven/demonstrated/confirmed", "reviewer consensus",',
  '  guarantee, "will achieve", "is approved", endorse/endorsed/endorsement.'
].join('\n');

// ─── LANE_HANDLERS dispatch table ──────────────────────────────────────
//
// Single source of truth for lane-specific assets. Adding a new lane
// requires only a new row here (+ the corresponding constants); no
// control-flow edits in _validatePacket, _verifyCritique, _scanProhibitedLanguage,
// _isBlockingPhrase, or the handler.
//
// Each handler row carries:
//   lane:               canonical lane string used for routing/identity
//   systemPrompt:       Grok system prompt for this lane
//   extractDraft:       lane-specific draft safe-extract fn (returns null
//                       on insufficient detail)
//   requireDraft:       boolean — if true, missing/empty draft is 422
//                       INSUFFICIENT_DRAFT_DETAIL
//   readinessKey:       lane_hints.readyForGeneration key to check
//   flags:              expected antiOverclaim flags (key→true) — verifier
//                       requires each to be === true on Grok output
//   prohibitedPatterns: lane-specific prohibited-language patterns scanned
//                       across all critique strings; ANY hit blocks
//   blockingRx:         lane-specific blocking-severity regex array used
//                       by the objection-ledger normalizer to escalate
//                       overclaim_risk severity from major → blocking

var LANE_HANDLERS = {};
LANE_HANDLERS[PATENTS_LANE] = {
  lane:               PATENTS_LANE,
  systemPrompt:       PATENTS_SYSTEM_PROMPT,
  extractDraft:       _extractPatentsDraftSafeInput,
  requireDraft:       false,                   // patents draft is optional
  readinessKey:       'patents',
  flags:              PATENTS_FLAGS,
  prohibitedPatterns: PATENTS_PROHIBITED,
  blockingRx:         PATENTS_BLOCKING_RX
};
LANE_HANDLERS[NSF_LANE] = {
  lane:               NSF_LANE,
  systemPrompt:       NSF_SYSTEM_PROMPT,
  extractDraft:       _extractNsfDraftSafeInput,
  requireDraft:       true,                    // NSF requires a draft to critique
  readinessKey:       'nsf-project-pitch',
  flags:              NSF_FLAGS,
  prohibitedPatterns: NSF_PROHIBITED,
  blockingRx:         NSF_BLOCKING_RX
};

function _isAllowedLane(lane) {
  return Object.prototype.hasOwnProperty.call(LANE_HANDLERS, lane);
}

function _allowedLanesList() {
  return Object.keys(LANE_HANDLERS);
}

// ─── Validation gates ──────────────────────────────────────────────────

function _validatePacket(p, requestLane) {
  if (!p || typeof p !== 'object') {
    return { code: 'MISSING_ARTIFACT_PACKET', http: 400,
      message: 'Request body must include an artifactPacket object.' };
  }
  var id   = p.identity || {};
  var lh   = p.lane_hints || {};
  var ao   = p.anti_overclaim || {};
  var prov = p.provenance || {};

  var packetLane = id.lane;
  var allowed    = _allowedLanesList();

  // D3-E.0.1: explicit request-lane gate. If the request body specifies a
  // lane, it must be in LANE_HANDLERS. Mismatch fires before any provider
  // config check so unsupported lanes never reach 501s.
  if (typeof requestLane === 'string' && !_isAllowedLane(requestLane)) {
    return {
      code: 'UNSUPPORTED_LANE',
      http: 400,
      message: 'request body lane must be one of [' + allowed.join(', ') +
               ']; received "' + requestLane + '".'
    };
  }

  // Packet lane must be supported.
  if (!_isAllowedLane(packetLane)) {
    return { code: 'UNSUPPORTED_LANE', http: 400,
      message: 'artifactPacket.identity.lane must be one of [' + allowed.join(', ') + '].' };
  }

  // If both are present, they must match — prevents a real patents packet
  // from being routed under an NSF request body and vice versa.
  if (typeof requestLane === 'string' && requestLane !== packetLane) {
    return { code: 'UNSUPPORTED_LANE', http: 400,
      message: 'request body lane "' + requestLane +
               '" does not match artifactPacket.identity.lane "' + packetLane + '".' };
  }

  // Lane-aware readiness gate via the lane handler.
  var handler = LANE_HANDLERS[packetLane];
  var ready = lh.readyForGeneration && lh.readyForGeneration[handler.readinessKey] === true;
  if (!ready) {
    return { code: 'PACKET_NOT_READY', http: 422,
      message: 'lane_hints.readyForGeneration.' + handler.readinessKey + ' is not true.' };
  }

  // Hard anti-overclaim gates (lane-agnostic data-quality).
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

  if (!prov.primarySource || !Array.isArray(prov.feedSources) || prov.feedSources.length === 0) {
    return { code: 'MISSING_PROVENANCE', http: 422,
      message: 'provenance.primarySource and non-empty feedSources are required.' };
  }

  var impl = p.implementation || {};
  var ev   = p.evidence       || {};
  var hasImpl = !!(impl.action || impl.doThis || impl.nextStep);
  var hasEvidence = !!(ev.trigger || ev.validation || ev.outcome);
  if (!hasImpl || !hasEvidence) {
    return { code: 'INSUFFICIENT_PACKET_DETAIL', http: 422,
      message: 'Packet missing implementation actions or evidence required for critique.' };
  }

  return null;
}

// ─── AI provider configuration ─────────────────────────────────────────

function _resolveApiKey() {
  if (typeof process.env.XAI_API_KEY_D3C === 'string' && process.env.XAI_API_KEY_D3C.length > 0) {
    return process.env.XAI_API_KEY_D3C;
  }
  if (typeof process.env.XAI_API_KEY === 'string' && process.env.XAI_API_KEY.length > 0) {
    return process.env.XAI_API_KEY;
  }
  return null;
}

function _resolveModel() {
  var m = process.env.XAI_MODEL;
  if (typeof m === 'string' && m.length > 0) return m;
  return null;
}

// ─── User message assembly ─────────────────────────────────────────────

function _buildUserMessage(safeInput, draftSafeInput, lane) {
  var laneLabel = (lane === NSF_LANE) ? 'NSF Project Pitch (D3-E.nsf.v1)' : 'GPT D3-B patents';
  var msg = 'ArtifactPacket safe-extract input (D3-A3.v3 schema):\n\n' +
    JSON.stringify(safeInput, null, 2);
  if (draftSafeInput) {
    msg += '\n\n' + laneLabel + ' draft to critique (safe-extract):\n\n' +
      JSON.stringify(draftSafeInput, null, 2);
  }
  msg += '\n\nProduce the D3-C.grok.v1 JSON object now. Output JSON only — no surrounding prose.';
  return msg;
}

// ─── xAI invocation (OpenAI-compatible) ────────────────────────────────

async function _callXAI(apiKey, model, systemPrompt, userMessage, temperature) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);
  var startMs = Date.now();

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
    var resp = await fetch(XAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    var elapsedOk = Date.now() - startMs;

    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (e) { errText = '(no body)'; }
      return { ok: false, status: resp.status, timedOut: false, elapsedMs: elapsedOk,
        error: 'AI_UPSTREAM_ERROR', upstreamMessage: errText.slice(0, 500) };
    }

    var data = await resp.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : null;
    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, status: 502, timedOut: false, elapsedMs: elapsedOk,
        error: 'AI_EMPTY_RESPONSE', upstreamMessage: 'No content in choices[0].message.' };
    }
    return { ok: true, content: content, elapsedMs: elapsedOk };
  } catch (err) {
    clearTimeout(timer);
    var elapsedErr = Date.now() - startMs;
    var isTimeout = !!(err && err.name === 'AbortError');
    var msg = isTimeout
      ? 'Upstream timeout (' + AI_TIMEOUT_MS + 'ms)'
      : (err && err.message) ? String(err.message) : 'Unknown fetch error';
    return { ok: false, status: 502, timedOut: isTimeout, elapsedMs: elapsedErr,
      error: isTimeout ? 'AI_UPSTREAM_TIMEOUT' : 'AI_UPSTREAM_ERROR',
      upstreamMessage: msg.slice(0, 500) };
  }
}

// D3-F.1 — Retry wrapper. ONE retry on AbortError (timeout) only.
// Non-timeout failures (HTTP 4xx/5xx, network DNS errors, parse errors)
// are returned on first attempt — those are typically deterministic and
// retrying would just burn the function-duration budget.
async function _callXAIWithRetry(apiKey, model, systemPrompt, userMessage, temperature) {
  var attempts = 0;
  var totalElapsed = 0;
  var lastResult = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    lastResult = await _callXAI(apiKey, model, systemPrompt, userMessage, temperature);
    totalElapsed += (typeof lastResult.elapsedMs === 'number') ? lastResult.elapsedMs : 0;
    if (lastResult.ok) {
      lastResult.attempts = attempts;
      lastResult.totalElapsedMs = totalElapsed;
      return lastResult;
    }
    // Only retry on timeout. Anything else: return immediately.
    if (!lastResult.timedOut) break;
    if (attempts >= MAX_ATTEMPTS) break;
  }

  lastResult.attempts = attempts;
  lastResult.totalElapsedMs = totalElapsed;
  return lastResult;
}

// ─── Post-AI verification ──────────────────────────────────────────────

function _scanProhibitedLanguage(text, prohibitedPatterns) {
  if (typeof text !== 'string' || text.length === 0) return [];
  var hits = [];
  for (var i = 0; i < prohibitedPatterns.length; i++) {
    var p = prohibitedPatterns[i];
    if (p.pattern.test(text)) hits.push(p.reason);
  }
  return hits;
}

function _scanInternalLanguage(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  var hits = [];
  for (var i = 0; i < INTERNAL_LANGUAGE_PATTERNS.length; i++) {
    var p = INTERNAL_LANGUAGE_PATTERNS[i];
    if (p.pattern.test(text)) hits.push(p.reason);
  }
  return hits;
}

// Walk every string field in a critique tree (recursive across nested
// objects and arrays) and call visit(path, text) for each. Mirrors the
// _walkDraftStrings helper in api/expand-artifact.js.
function _walkCritiqueStrings(root, visit, prefix) {
  if (!root || typeof root !== 'object') return;
  var keys = Object.keys(root);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = root[k];
    var path = prefix ? (prefix + '.' + k) : k;
    if (typeof v === 'string') {
      visit(path, v);
    } else if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) {
        var item = v[j];
        if (typeof item === 'string') visit(path + '[' + j + ']', item);
        else if (item && typeof item === 'object') _walkCritiqueStrings(item, visit, path + '[' + j + ']');
      }
    } else if (v && typeof v === 'object') {
      _walkCritiqueStrings(v, visit, path);
    }
  }
}

function _verifyCritique(critiqueObj, lane) {
  if (!critiqueObj || typeof critiqueObj !== 'object') {
    return { ok: false, code: 'AI_RESPONSE_PARSE_FAILED',
      reason: 'Critique is not an object.' };
  }

  if (critiqueObj.status !== 'critique_only') {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'Grok escalated beyond critique' };
  }
  if (critiqueObj.notDraft !== true) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'Grok produced or implied draft output' };
  }

  var ao = critiqueObj.antiOverclaim || {};
  var handler = LANE_HANDLERS[lane];
  if (!handler) {
    // Should be unreachable — _validatePacket prevents arrival here for unsupported lanes.
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'Unknown lane during verify: ' + lane };
  }

  // Lane-specific anti-overclaim flag check via LANE_HANDLERS.
  var flagKeys = Object.keys(handler.flags);
  for (var fi = 0; fi < flagKeys.length; fi++) {
    var fk = flagKeys[fi];
    if (ao[fk] !== true) {
      return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
        reason: 'Grok antiOverclaim.' + fk + ' is not true' };
    }
  }

  // Ensure unsupportedClaims array exists for soft-warning appends.
  if (!Array.isArray(critiqueObj.antiOverclaim.unsupportedClaims)) {
    critiqueObj.antiOverclaim.unsupportedClaims = [];
  }

  // Hard prose scan: lane-specific prohibited language anywhere in the
  // critique tree (other than antiOverclaim itself, which has structural
  // booleans). ANY hit blocks the response.
  var prohibitedHit = null;
  _walkCritiqueStrings(critiqueObj.critique, function (path, text) {
    if (prohibitedHit) return;
    var hits = _scanProhibitedLanguage(text, handler.prohibitedPatterns);
    if (hits.length > 0) prohibitedHit = { path: path, reasons: hits, excerpt: text.slice(0, 240) };
  });
  if (prohibitedHit) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'Prohibited claim-language in critique: ' + prohibitedHit.reasons.join(', ') +
              ' at ' + prohibitedHit.path };
  }

  // Soft prose scan: internal-system-language. Lane-agnostic. Hits append
  // to unsupportedClaims with kind 'internal-system-language-leaked' and
  // flip guards.externalLanguageClean to false. Never blocks.
  var internalLanguageLeaked = false;
  _walkCritiqueStrings(critiqueObj.critique, function (path, text) {
    var hits = _scanInternalLanguage(text);
    if (hits.length > 0) {
      critiqueObj.antiOverclaim.unsupportedClaims.push({
        path: path,
        reasons: hits,
        excerpt: text.slice(0, 240),
        kind: 'internal-system-language-leaked'
      });
      internalLanguageLeaked = true;
    }
  });

  return { ok: true, internalLanguageLeaked: internalLanguageLeaked };
}

// ─── D3-C.1 — Deterministic objection ledger derivation ────────────────
//
// Server-side authority: derives a normalized, machine-actionable objection
// ledger from the verified Grok critique. This is the contract the next
// drafting stage (GPT D3-B revision pass / D3-H finalizer) will consume —
// Grok's free-form critique fields become numbered, typed, severity-tagged
// objections.
//
// If Grok happens to return its own `objectionLedger` field, the value is
// IGNORED. Only the server-derived ledger ships in the response. Grok's
// schema does NOT request this field — derivation is purely server-side.
//
// D3-E.2: The normalization rules (rule 0 through rule 6, dedup by
// type+issue-prefix-60, stable sort by severity, cap at LEDGER_CAP, assign
// sequential IDs and allowedResolutions) are the SAME for both lanes. Only
// the lane-specific blocking regex set is swapped in via the lane handler
// to decide whether an overclaim_risk is `blocking` vs `major`.

var CAUSAL_RX     = /causal|linkage|correlation|connection|direct evidence|indirect evidence/i;
var SEVERITY_RANK = { blocking: 4, major: 3, minor: 2, info: 1 };
var ALLOWED_RESOLUTIONS = [
  'answer_with_cited_evidence',
  'narrow_claim',
  'remove_claim',
  'carry_forward_as_unresolved'
];
var LEDGER_CAP = 20;

function _padId(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return 'OBJ-' + s;
}

function _normalizeIssueKey(type, issue) {
  var norm = String(issue == null ? '' : issue).toLowerCase().replace(/\s+/g, ' ').trim();
  if (norm.length > 60) norm = norm.slice(0, 60);
  return type + '|' + norm;
}

function _isBlockingPhrase(text, blockingRxList) {
  if (typeof text !== 'string' || text.length === 0) return false;
  if (!Array.isArray(blockingRxList)) return false;
  for (var i = 0; i < blockingRxList.length; i++) {
    if (blockingRxList[i].test(text)) return true;
  }
  return false;
}

function _deriveObjectionLedger(critiqueObj, lane) {
  var entries = [];
  var c  = (critiqueObj && critiqueObj.critique) ? critiqueObj.critique : {};
  var ao = (critiqueObj && critiqueObj.antiOverclaim) ? critiqueObj.antiOverclaim : {};
  var blockingRx = (LANE_HANDLERS[lane] && LANE_HANDLERS[lane].blockingRx) || [];

  // Rule 0 — antiOverclaim.unsupportedClaims (highest priority).
  if (Array.isArray(ao.unsupportedClaims)) {
    for (var i0 = 0; i0 < ao.unsupportedClaims.length; i0++) {
      var item0 = ao.unsupportedClaims[i0];
      if (typeof item0 === 'string') {
        var sev0 = _isBlockingPhrase(item0, blockingRx) ? 'blocking' : 'major';
        entries.push({
          type: 'overclaim_risk',
          severity: sev0,
          issue: item0,
          whyItMatters: '',
          requiredResponse: 'Remove or qualify the unsupported claim; do not assert in draft.',
          sourceField: 'antiOverclaim.unsupportedClaims[' + i0 + ']',
          mustAddressInDraft: true
        });
      } else if (item0 && typeof item0 === 'object' && item0.kind === 'internal-system-language-leaked') {
        entries.push({
          type: 'internal_language',
          severity: 'major',
          issue: item0.excerpt || 'internal LIMEN terminology leaked',
          whyItMatters: 'Public-facing artifacts cannot use internal system terminology',
          requiredResponse: 'Replace with feed-grounded real-world language.',
          sourceField: 'antiOverclaim.unsupportedClaims[' + i0 + ']',
          mustAddressInDraft: true
        });
      }
    }
  }

  // Rule 1 — critique.weakestLinks.
  if (Array.isArray(c.weakestLinks)) {
    for (var i1 = 0; i1 < c.weakestLinks.length; i1++) {
      var item1 = c.weakestLinks[i1];
      if (!item1 || typeof item1 !== 'object') continue;
      var combined1 = (item1.issue || '') + ' ' + (item1.whyItMatters || '');
      var t1 = CAUSAL_RX.test(combined1) ? 'causal_gap' : 'source_gap';
      entries.push({
        type: t1,
        severity: 'major',
        issue: item1.issue || '',
        whyItMatters: item1.whyItMatters || '',
        requiredResponse: 'Answer with cited evidence or narrow/remove the claim.',
        sourceField: 'weakestLinks[' + i1 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Rule 2 — critique.overclaimRisks. Lane-aware blocking severity.
  if (Array.isArray(c.overclaimRisks)) {
    for (var i2 = 0; i2 < c.overclaimRisks.length; i2++) {
      var item2 = c.overclaimRisks[i2];
      if (!item2 || typeof item2 !== 'object') continue;
      var combined2 = (item2.claim || '') + ' ' + (item2.risk || '');
      var sev2 = _isBlockingPhrase(combined2, blockingRx) ? 'blocking' : 'major';
      entries.push({
        type: 'overclaim_risk',
        severity: sev2,
        issue: item2.claim || item2.risk || '',
        whyItMatters: item2.risk || '',
        requiredResponse: item2.recommendedFix || 'Remove or qualify the overclaim.',
        sourceField: 'overclaimRisks[' + i2 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Rule 3 — critique.sourceFreshnessConcerns.
  if (Array.isArray(c.sourceFreshnessConcerns)) {
    for (var i3 = 0; i3 < c.sourceFreshnessConcerns.length; i3++) {
      var item3 = c.sourceFreshnessConcerns[i3];
      if (!item3 || typeof item3 !== 'object') continue;
      entries.push({
        type: 'freshness_gap',
        severity: 'major',
        issue: item3.concern || '',
        whyItMatters: 'Source: ' + (item3.source || 'unknown'),
        requiredResponse: item3.recommendedCheck || 'Update source, cite timestamp, or mark freshness limitation.',
        sourceField: 'sourceFreshnessConcerns[' + i3 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Rule 4 — critique.internalLanguageLeaks.
  if (Array.isArray(c.internalLanguageLeaks)) {
    for (var i4 = 0; i4 < c.internalLanguageLeaks.length; i4++) {
      var item4 = c.internalLanguageLeaks[i4];
      if (!item4 || typeof item4 !== 'object') continue;
      var term4 = item4.term || '';
      var where4 = item4.where || 'unknown';
      var rec4 = item4.recommendedReplacement
        ? ('Replace with: ' + item4.recommendedReplacement)
        : 'Replace internal LIMEN/domain/node/diagnosis terminology with feed-grounded language.';
      entries.push({
        type: 'internal_language',
        severity: 'major',
        issue: 'Term "' + term4 + '" appears in ' + where4,
        whyItMatters: 'Public-facing artifacts cannot use internal system terminology',
        requiredResponse: rec4,
        sourceField: 'internalLanguageLeaks[' + i4 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Rule 5 — critique.reviewerObjections.
  if (Array.isArray(c.reviewerObjections)) {
    for (var i5 = 0; i5 < c.reviewerObjections.length; i5++) {
      var item5 = c.reviewerObjections[i5];
      if (!item5 || typeof item5 !== 'object') continue;
      entries.push({
        type: 'reviewer_objection',
        severity: 'major',
        issue: item5.objection || '',
        whyItMatters: 'Reviewer type: ' + (item5.reviewerType || 'unspecified'),
        requiredResponse: item5.recommendedResponse || 'Address reviewer objection or carry forward as unresolved.',
        sourceField: 'reviewerObjections[' + i5 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Rule 6 — critique.missingEvidence (string array).
  if (Array.isArray(c.missingEvidence)) {
    for (var i6 = 0; i6 < c.missingEvidence.length; i6++) {
      var item6 = c.missingEvidence[i6];
      if (typeof item6 !== 'string' || item6.length === 0) continue;
      entries.push({
        type: 'missing_evidence',
        severity: 'major',
        issue: item6,
        whyItMatters: '',
        requiredResponse: 'Add evidence or mark missing information explicitly.',
        sourceField: 'missingEvidence[' + i6 + ']',
        mustAddressInDraft: true
      });
    }
  }

  // Step 7 — deduplicate by (type + first 60 normalized chars of issue).
  // Keep first sourceField encountered. If duplicates have different
  // severity, keep the more severe. Preserve original ordering.
  var seen = {};
  var deduped = [];
  for (var di = 0; di < entries.length; di++) {
    var e = entries[di];
    var key = _normalizeIssueKey(e.type, e.issue);
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      var existing = deduped[seen[key]];
      var aRank = SEVERITY_RANK[e.severity] || 0;
      var bRank = SEVERITY_RANK[existing.severity] || 0;
      if (aRank > bRank) existing.severity = e.severity;
    } else {
      seen[key] = deduped.length;
      deduped.push(e);
    }
  }

  // Step 8 — stable sort by severity (blocking > major > minor > info).
  for (var oi = 0; oi < deduped.length; oi++) deduped[oi]._origIdx = oi;
  deduped.sort(function (a, b) {
    var diff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (diff !== 0) return diff;
    return a._origIdx - b._origIdx;
  });
  for (var oj = 0; oj < deduped.length; oj++) delete deduped[oj]._origIdx;

  // Step 9 — cap at LEDGER_CAP. Excess silently dropped (priority-ordered).
  if (deduped.length > LEDGER_CAP) deduped = deduped.slice(0, LEDGER_CAP);

  // Steps 10-11 — assign sequential IDs and allowedResolutions AFTER
  // sort/cap. Rebuild each entry so id appears first in the JSON output.
  var ledger = [];
  for (var fi = 0; fi < deduped.length; fi++) {
    var src = deduped[fi];
    ledger.push({
      id:                 _padId(fi + 1),
      type:               src.type,
      severity:           src.severity,
      issue:              src.issue,
      whyItMatters:       src.whyItMatters,
      requiredResponse:   src.requiredResponse,
      sourceField:        src.sourceField,
      mustAddressInDraft: src.mustAddressInDraft === true,
      allowedResolutions: ALLOWED_RESOLUTIONS.slice()
    });
  }
  return ledger;
}

function _buildObjectionSummary(ledger) {
  var summary = {
    total:       Array.isArray(ledger) ? ledger.length : 0,
    blocking:    0,
    major:       0,
    minor:       0,
    info:        0,
    mustAddress: 0
  };
  if (!Array.isArray(ledger)) return summary;
  for (var i = 0; i < ledger.length; i++) {
    var e = ledger[i];
    if (!e) continue;
    if (e.severity === 'blocking')   summary.blocking++;
    else if (e.severity === 'major') summary.major++;
    else if (e.severity === 'minor') summary.minor++;
    else if (e.severity === 'info')  summary.info++;
    if (e.mustAddressInDraft === true) summary.mustAddress++;
  }
  return summary;
}

// ─── Handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

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
  } catch (e) { /* ignore */ }

  var artifactPacket = body.artifactPacket;
  var requestLane    = body.lane;
  var requestDraft   = body.draft;
  var requestOptions = body.options || {};

  // Validate packet (lane gate + readiness + hard gates + provenance + detail).
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

  // Resolve effective lane and lane handler. Both are guaranteed to exist
  // because _validatePacket would have returned UNSUPPORTED_LANE otherwise.
  var effectiveLane = artifactPacket.identity.lane;
  var laneHandler   = LANE_HANDLERS[effectiveLane];

  // Lane-aware draft requirement check via LANE_HANDLERS[lane].requireDraft
  // and LANE_HANDLERS[lane].extractDraft. Patents lane allows null draft;
  // NSF lane fails closed with 422 INSUFFICIENT_DRAFT_DETAIL when missing
  // or empty.
  var draftSafeInput = null;
  if (requestDraft && typeof requestDraft === 'object') {
    draftSafeInput = laneHandler.extractDraft(requestDraft);
  }
  if (laneHandler.requireDraft && !draftSafeInput) {
    res.status(422).json({
      ok: false,
      error: 'INSUFFICIENT_DRAFT_DETAIL',
      message: 'Lane "' + effectiveLane + '" requires a non-empty draft to critique. ' +
               'Provide expansion output as body.draft with at least one populated section.'
    });
    return;
  }

  // Resolve provider config — fail-safe BEFORE any network call.
  var apiKey = _resolveApiKey();
  if (!apiKey) {
    res.status(501).json({ ok: false, error: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'XAI_API_KEY_D3C (preferred) or XAI_API_KEY env var is required.' });
    return;
  }
  var model = _resolveModel();
  if (!model) {
    res.status(501).json({ ok: false, error: 'XAI_MODEL_NOT_CONFIGURED',
      message: 'XAI_MODEL env var must be set; no default model is hardcoded.' });
    return;
  }

  // Build prompt input via the lane handler.
  var safeInput   = _extractSafeInput(artifactPacket);
  var systemPrompt = laneHandler.systemPrompt;
  var userMessage  = _buildUserMessage(safeInput, draftSafeInput, effectiveLane);
  var requestedTemp = requestOptions.temperature;
  var temperature = (typeof requestedTemp === 'number'
    && requestedTemp >= 0 && requestedTemp <= MAX_TEMPERATURE)
    ? requestedTemp : DEFAULT_TEMPERATURE;

  // Approximate payload size sent to Grok (system prompt + user message).
  // Used only as a diagnostic field on the structured error response.
  var approxPayloadBytes = (typeof systemPrompt === 'string' ? systemPrompt.length : 0) +
                           (typeof userMessage === 'string' ? userMessage.length : 0);

  // Call Grok via xAI's OpenAI-compatible Chat Completions endpoint with
  // ONE retry on AbortError (timeout) only. Non-timeout failures are not
  // retried — those are typically deterministic.
  var aiResult = await _callXAIWithRetry(apiKey, model, systemPrompt, userMessage, temperature);
  if (!aiResult.ok) {
    // D3-F.1 — Structured error envelope. Timeout is classified as
    // retryable (the operator can hit "Retry critique" without rerunning
    // the OpenAI expansion); other failures are not retryable.
    var isTimeout = aiResult.error === 'AI_UPSTREAM_TIMEOUT' || aiResult.timedOut === true;
    var httpStatus = isTimeout ? 504 : (aiResult.status || 502);
    var payload = {
      ok: false,
      error: isTimeout ? 'AI_UPSTREAM_TIMEOUT' : (aiResult.error || 'AI_UPSTREAM_ERROR'),
      message: aiResult.upstreamMessage || 'AI upstream failed.',
      retryable: isTimeout,
      lane: effectiveLane,
      stage: 'grok_critique',
      attempts: aiResult.attempts || 1,
      perAttemptTimeoutMs: AI_TIMEOUT_MS,
      totalElapsedMs: aiResult.totalElapsedMs || aiResult.elapsedMs || 0,
      approxPayloadBytes: approxPayloadBytes,
      fallbackAttempted: false
    };
    res.status(httpStatus).json(payload);
    return;
  }

  // Parse Grok JSON.
  var critiqueObj;
  try {
    critiqueObj = JSON.parse(aiResult.content);
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: 'AI_RESPONSE_PARSE_FAILED',
      message: (e && e.message) ? String(e.message).slice(0, 500) : 'JSON.parse failed.',
      rawTruncated: typeof aiResult.content === 'string' ? aiResult.content.slice(0, 500) : null
    });
    return;
  }

  // Post-AI verification — lane-aware anti-overclaim flags + lane-aware
  // prohibited-language scan + lane-agnostic internal-language scan.
  var verify = _verifyCritique(critiqueObj, effectiveLane);
  if (!verify.ok) {
    res.status(502).json({
      ok: false,
      error: verify.code,
      message: verify.reason,
      rejectedCritique: critiqueObj
    });
    return;
  }

  // D3-C.1 — Deterministic objection-ledger derivation. Server-side only;
  // any objectionLedger field returned by Grok is unconditionally
  // overwritten here. Same normalization rules for both lanes; lane only
  // affects severity escalation via LANE_HANDLERS[lane].blockingRx.
  try {
    critiqueObj.objectionLedger  = _deriveObjectionLedger(critiqueObj, effectiveLane);
    critiqueObj.objectionSummary = _buildObjectionSummary(critiqueObj.objectionLedger);
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: 'OBJECTION_LEDGER_FAILED',
      message: 'Failed to derive deterministic objection ledger.'
    });
    return;
  }

  var packetId = (artifactPacket.identity && artifactPacket.identity.id) || null;
  var srcOpp   = (artifactPacket.identity && artifactPacket.identity.sourceOpportunityId) || null;

  // Server-side identity override — Grok cannot self-report a different
  // artifactPacketId / sourceOpportunityId / lane than the validated request.
  if (critiqueObj.artifactPacketId !== packetId)    critiqueObj.artifactPacketId = packetId;
  if (critiqueObj.sourceOpportunityId !== srcOpp)   critiqueObj.sourceOpportunityId = srcOpp;
  if (critiqueObj.lane !== effectiveLane)           critiqueObj.lane = effectiveLane;

  // Lane-aware guards block. Common guards first; then spread the lane's
  // antiOverclaim flag set so the response surfaces exactly what was
  // verified for this lane.
  var guards = {
    packetReady:            true,
    hardGatesPassed:        true,
    critiqueOnly:           true
  };
  var flagKeys = Object.keys(laneHandler.flags);
  for (var gi = 0; gi < flagKeys.length; gi++) {
    guards[flagKeys[gi]] = true;
  }
  guards.externalLanguageClean  = !verify.internalLanguageLeaked;
  guards.objectionLedgerPresent = Array.isArray(critiqueObj.objectionLedger);
  guards.blockingObjections     = (critiqueObj.objectionSummary &&
                                   typeof critiqueObj.objectionSummary.blocking === 'number')
                                    ? critiqueObj.objectionSummary.blocking : 0;
  guards.mustAddressObjections  = (critiqueObj.objectionSummary &&
                                   typeof critiqueObj.objectionSummary.mustAddress === 'number')
                                    ? critiqueObj.objectionSummary.mustAddress : 0;

  res.status(200).json({
    ok: true,
    schemaVersion: API_SCHEMA_VERSION,
    artifactPacketId: packetId,
    lane: effectiveLane,
    provider: 'xai',
    model: model,
    createdAt: new Date().toISOString(),
    critique: critiqueObj,
    guards: guards,
    // D3-F.1 — diagnostics; do NOT participate in anti-overclaim semantics.
    diagnostics: {
      attempts:            aiResult.attempts || 1,
      perAttemptTimeoutMs: AI_TIMEOUT_MS,
      totalElapsedMs:      aiResult.totalElapsedMs || aiResult.elapsedMs || 0,
      approxPayloadBytes:  approxPayloadBytes
    }
  });
};

// D3-F.1 — Vercel function-level config. Lifts the per-route maxDuration
// to 300s (Pro tier maximum) so that one Grok retry on timeout has room
// to complete. Without this, the function ceiling defaults to plan limit
// (Pro = 60s) and would kill the second attempt mid-flight.
//
// This config lives in this file (authorized) rather than in vercel.json
// (forbidden for D3-F.1 scope). Per-route config takes precedence over
// vercel.json defaults for this route only; other endpoints unaffected.
module.exports.config = {
  maxDuration: 300
};
