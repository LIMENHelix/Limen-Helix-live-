/**
 * api/lanes/nsf-project-pitch.js
 *
 * D3-E.1 — NSF SBIR/STTR Project Pitch lane handler.
 *
 * Source contract: docs/D3-E-NSF-RESEARCH.md (captured 2026-04-30).
 * Only VERIFIED facts from that document may appear as factual claims in the
 * system prompt. UNKNOWN fields (rubric weights, FY2026 solicitation number,
 * STTR R&D split, topic-to-directorate routing, decline reasons, full
 * exclusion language, per-section content requirements beyond character
 * limits) are forbidden as factual assertions and must surface in the
 * `unknownFields` array of the model output instead.
 *
 * Public API:
 *   generateNsfProjectPitchDraft(artifactPacket, openaiClient)
 *
 * openaiClient shape:
 *   {
 *     model: string,
 *     callChatCompletion: async (systemPrompt, userMessage, temperature) =>
 *       { ok: true, content: string } | { ok: false, status, error, upstreamMessage }
 *   }
 *
 * Returns on success:
 *   {
 *     ok: true,
 *     provider: 'openai',
 *     model: <openaiClient.model>,
 *     schemaVersion: 'D3-E.nsf.v1',
 *     retried: boolean,
 *     expansion: {
 *       status: 'draft' | 'draft-with-gaps',
 *       unknownFields: string[],
 *       sourceContract: { docPath, capturedDate },
 *       draft: {
 *         title: string,
 *         section1_innovation:          { content, charCount, charLimit: 3500 },
 *         section2_technicalObjectives: { content, charCount, charLimit: 3500 },
 *         section3_marketOpportunity:   { content, charCount, charLimit: 1750 },
 *         section4_companyTeam:         { content, charCount, charLimit: 1750 }
 *       }
 *     }
 *   }
 *
 * Returns on failure:
 *   { ok: false, code, message, status?, rawAttempt1?, rawAttempt2? }
 *
 * Validation policy:
 *   - Section content.length must not exceed its charLimit. Reject and retry once.
 *   - status must be consistent with unknownFields. Reject and retry once.
 *   - If second attempt fails validation, return code 'NSF_DRAFT_VALIDATION_FAILED'
 *     with rawAttempt1/rawAttempt2 included for inspection.
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────

var SCHEMA_VERSION = 'D3-E.nsf.v1';

var SOURCE_CONTRACT = {
  docPath: 'docs/D3-E-NSF-RESEARCH.md',
  capturedDate: '2026-04-30'
};

var SECTION_LIMITS = {
  section1_innovation:          3500,
  section2_technicalObjectives: 3500,
  section3_marketOpportunity:   1750,
  section4_companyTeam:         1750
};

var DEFAULT_TEMPERATURE = 0.2;

// ─── System prompt ─────────────────────────────────────────────────────

var SYSTEM_PROMPT = [
  'You are drafting an NSF SBIR/STTR Project Pitch from a machine-generated',
  'ArtifactPacket. The pitch is a pre-application; if invited, the small',
  'business is invited to submit a full proposal.',
  '',
  'SOURCE CONTRACT — VERIFIED FACTS (from docs/D3-E-NSF-RESEARCH.md, captured 2026-04-30):',
  '- Project Pitch is 4 sections: 3500 / 3500 / 1750 / 1750 chars',
  '- Phase I: up to $305K, average $295,822, range $154,646-$305K, 6-18 months',
  '- Phase II: up to $1.25M, 24 months',
  '- Eligibility: <500 employees; >=50% US-citizen/permanent-resident equity;',
  '  no VC/PE/hedge-fund coalition majority',
  '- PI commits >=20 hours/week to the company and >=1 month (173 hours) per',
  '  6-month period to the project',
  '- 0% equity taken (non-dilutive grant)',
  '- ~400 startups funded per year, $200M+ deployed annually',
  '- 26 topic areas exist (count only — do not enumerate)',
  '- Evaluation language is directional only: "innovativeness, commercial',
  '  potential, possible societal impact" — do NOT assign weights or rubric',
  '- Submissions paused as of 2026-04-16; expected to resume "in coming weeks"',
  '',
  'FORBIDDEN CLAIMS — you MUST NOT assert any of the following:',
  '- A specific evaluation rubric, scoring scheme, or weights',
  '- The FY2026 solicitation number',
  '- STTR R&D split percentages (small business vs research institution)',
  '- Topic-to-directorate routing',
  '- Per-section content requirements beyond the verified character limits',
  '- Specific decline reasons or rejection patterns',
  '- The full exclusion language for what NSF does not fund',
  '- Any topic-list enumeration beyond confirming "26 topic areas"',
  'If a section requires any of the above to be complete, append the field name',
  'to the `unknownFields` array and write the section using only verified facts',
  'plus the artifact packet content. Do not fabricate. Do not pull from training',
  'data. Do not infer. State the gap explicitly.',
  '',
  'Required output JSON shape (strict):',
  '{',
  '  "status": "draft" | "draft-with-gaps",',
  '  "unknownFields": ["..."],',
  '  "sourceContract": { "docPath": "docs/D3-E-NSF-RESEARCH.md", "capturedDate": "2026-04-30" },',
  '  "draft": {',
  '    "title": "...",',
  '    "section1_innovation":          { "content": "...", "charCount": 0, "charLimit": 3500 },',
  '    "section2_technicalObjectives": { "content": "...", "charCount": 0, "charLimit": 3500 },',
  '    "section3_marketOpportunity":   { "content": "...", "charCount": 0, "charLimit": 1750 },',
  '    "section4_companyTeam":         { "content": "...", "charCount": 0, "charLimit": 1750 }',
  '  }',
  '}',
  '',
  'Rules:',
  '- charCount must equal content.length for each section.',
  '- charLimit must equal the verified per-section limit (3500/3500/1750/1750).',
  '- Each section content.length MUST NOT exceed its charLimit. Server will reject.',
  '- status="draft-with-gaps" iff unknownFields is non-empty; otherwise status="draft".',
  '- Use ONLY the artifact packet evidence and the SOURCE CONTRACT above. No external facts.',
  '- Do not mention LIMEN, internal domain states, stress bands, diagnoses, brain nodes,',
  '  phase language, ArtifactPacket IDs, or readiness gates in public-facing draft prose.',
  '- Translate internal-system observations into real-world problems supported by the',
  '  artifact packet provenance and feed sources.',
  '- If you cannot complete a section without violating the FORBIDDEN CLAIMS list,',
  '  append the relevant field name (e.g. "evaluationRubric", "FY2026SolicitationNumber",',
  '  "STTRRDSplit", "topicToDirectorate", "declineReasons", "exclusionLanguage") to',
  '  unknownFields and write the section using verified facts only.',
  '- Output JSON only — no surrounding prose, no markdown fences.'
].join('\n');

// ─── Safe input extraction ─────────────────────────────────────────────

function _safeExtractPacket(p) {
  if (!p || typeof p !== 'object') return null;
  var id   = p.identity   || {};
  var sig  = p.signal     || {};
  var ev   = p.evidence   || {};
  var impl = p.implementation || {};
  var prov = p.provenance || {};

  var feedSources = [];
  if (Array.isArray(prov.feedSources)) {
    var capped = prov.feedSources.slice(0, 12);
    for (var i = 0; i < capped.length; i++) {
      var s = capped[i];
      if (!s) continue;
      feedSources.push({
        name:            s.name  || '',
        label:           s.label || '',
        classification:  s.classification || null,
        live:            s.live === true,
        sourceUpdatedAt: s.sourceUpdatedAt || null
      });
    }
  }

  return {
    identity: {
      id:                  id.id || null,
      sourceOpportunityId: id.sourceOpportunityId || null,
      domain:              id.domain || '',
      title:               id.title  || ''
    },
    signal: {
      whyNow:  sig.whyNow  || '',
      urgency: sig.urgency || ''
    },
    evidence: {
      trigger:            ev.trigger    || '',
      validation:         ev.validation || '',
      outcome:            ev.outcome    || '',
      moneyChainEvidence: ev.moneyChainEvidence || ''
    },
    implementation: {
      action:   impl.action   || '',
      doThis:   impl.doThis   || '',
      nextStep: impl.nextStep || '',
      target:   impl.target   || '',
      timing:   impl.timing   || ''
    },
    provenance: {
      primarySource: prov.primarySource || null,
      primaryValue:  (typeof prov.primaryValue === 'number') ? prov.primaryValue : null,
      primaryUnit:   prov.primaryUnit || '',
      feedSources:   feedSources
    }
  };
}

function _buildUserMessage(safe) {
  return [
    'ArtifactPacket safe-extract input:',
    '',
    JSON.stringify(safe, null, 2),
    '',
    'Produce the NSF Project Pitch JSON object now per the schema above.',
    'Output JSON only — no surrounding prose.'
  ].join('\n');
}

// ─── Validation ────────────────────────────────────────────────────────

function _validateExpansion(expansion) {
  if (!expansion || typeof expansion !== 'object') {
    return { ok: false, reason: 'Expansion is not an object.' };
  }
  if (!expansion.draft || typeof expansion.draft !== 'object') {
    return { ok: false, reason: 'expansion.draft missing or not an object.' };
  }
  if (!Array.isArray(expansion.unknownFields)) {
    return { ok: false, reason: 'expansion.unknownFields must be an array.' };
  }
  if (typeof expansion.status !== 'string') {
    return { ok: false, reason: 'expansion.status must be a string.' };
  }
  if (expansion.status !== 'draft' && expansion.status !== 'draft-with-gaps') {
    return { ok: false, reason: 'expansion.status must be "draft" or "draft-with-gaps".' };
  }

  var sectionKeys = Object.keys(SECTION_LIMITS);
  for (var i = 0; i < sectionKeys.length; i++) {
    var key = sectionKeys[i];
    var sec = expansion.draft[key];
    var limit = SECTION_LIMITS[key];
    if (!sec || typeof sec !== 'object') {
      return { ok: false, reason: 'Missing draft section: ' + key };
    }
    if (typeof sec.content !== 'string') {
      return { ok: false, reason: 'Section ' + key + ' content is not a string.' };
    }
    if (sec.content.length > limit) {
      return {
        ok: false,
        reason: 'Section ' + key + ' exceeds charLimit (' +
                sec.content.length + '/' + limit + ').'
      };
    }
  }

  // Status–unknownFields consistency: if status is non-"draft" but unknownFields
  // is empty, the model claimed gaps without listing any.
  if (expansion.status !== 'draft' && expansion.unknownFields.length === 0) {
    return {
      ok: false,
      reason: 'status="' + expansion.status + '" but unknownFields is empty; status must reflect gaps.'
    };
  }

  return { ok: true };
}

function _normalizeExpansion(expansion) {
  // Force charLimit to verified values, recompute charCount, force sourceContract,
  // reconcile status with unknownFields.
  var sectionKeys = Object.keys(SECTION_LIMITS);
  for (var i = 0; i < sectionKeys.length; i++) {
    var key = sectionKeys[i];
    var sec = expansion.draft[key];
    if (sec && typeof sec === 'object') {
      sec.charLimit = SECTION_LIMITS[key];
      if (typeof sec.content === 'string') {
        sec.charCount = sec.content.length;
      }
    }
  }
  expansion.sourceContract = {
    docPath: SOURCE_CONTRACT.docPath,
    capturedDate: SOURCE_CONTRACT.capturedDate
  };
  expansion.status = (expansion.unknownFields.length > 0)
    ? 'draft-with-gaps'
    : 'draft';
  return expansion;
}

// ─── Main entrypoint ───────────────────────────────────────────────────

async function generateNsfProjectPitchDraft(artifactPacket, openaiClient) {
  if (!openaiClient || typeof openaiClient.callChatCompletion !== 'function') {
    return {
      ok: false,
      code: 'NSF_CLIENT_MISCONFIGURED',
      message: 'openaiClient.callChatCompletion is required.'
    };
  }

  var safe = _safeExtractPacket(artifactPacket);
  if (!safe) {
    return {
      ok: false,
      code: 'NSF_PACKET_INVALID',
      message: 'artifactPacket is not a valid object.'
    };
  }

  var userMessage = _buildUserMessage(safe);

  // Attempt 1
  var attempt1 = await openaiClient.callChatCompletion(SYSTEM_PROMPT, userMessage, DEFAULT_TEMPERATURE);
  if (!attempt1 || !attempt1.ok) {
    return {
      ok: false,
      code: (attempt1 && attempt1.error) || 'NSF_AI_UPSTREAM_ERROR',
      message: (attempt1 && attempt1.upstreamMessage) || 'Upstream AI call failed.',
      status: (attempt1 && attempt1.status) || 502
    };
  }

  var expansion1 = null;
  try { expansion1 = JSON.parse(attempt1.content); } catch (e) { expansion1 = null; }
  var validation1 = expansion1
    ? _validateExpansion(expansion1)
    : { ok: false, reason: 'Could not parse model output as JSON.' };

  if (validation1.ok) {
    return {
      ok: true,
      provider: 'openai',
      model: openaiClient.model || null,
      schemaVersion: SCHEMA_VERSION,
      retried: false,
      expansion: _normalizeExpansion(expansion1)
    };
  }

  // Attempt 2 — corrective notice appended.
  var retryNotice = '\n\n' +
    'CORRECTION: The previous attempt failed validation: ' + validation1.reason + '\n' +
    'Re-emit the JSON object strictly per the schema. Each section\'s content.length ' +
    'MUST NOT exceed its charLimit (3500/3500/1750/1750). Set status="draft-with-gaps" ' +
    'only when unknownFields is non-empty. Output JSON only.';

  var attempt2 = await openaiClient.callChatCompletion(SYSTEM_PROMPT, userMessage + retryNotice, DEFAULT_TEMPERATURE);
  if (!attempt2 || !attempt2.ok) {
    return {
      ok: false,
      code: (attempt2 && attempt2.error) || 'NSF_AI_UPSTREAM_ERROR',
      message: (attempt2 && attempt2.upstreamMessage) || 'Upstream AI call failed on retry.',
      status: (attempt2 && attempt2.status) || 502,
      rawAttempt1: typeof attempt1.content === 'string' ? attempt1.content.slice(0, 2000) : null
    };
  }

  var expansion2 = null;
  try { expansion2 = JSON.parse(attempt2.content); } catch (e) { expansion2 = null; }
  var validation2 = expansion2
    ? _validateExpansion(expansion2)
    : { ok: false, reason: 'Could not parse retry model output as JSON.' };

  if (validation2.ok) {
    return {
      ok: true,
      provider: 'openai',
      model: openaiClient.model || null,
      schemaVersion: SCHEMA_VERSION,
      retried: true,
      expansion: _normalizeExpansion(expansion2)
    };
  }

  return {
    ok: false,
    code: 'NSF_DRAFT_VALIDATION_FAILED',
    message: 'Validation failed twice: attempt1=' + validation1.reason +
             ' attempt2=' + validation2.reason,
    rawAttempt1: typeof attempt1.content === 'string' ? attempt1.content.slice(0, 2000) : null,
    rawAttempt2: typeof attempt2.content === 'string' ? attempt2.content.slice(0, 2000) : null
  };
}

module.exports = {
  generateNsfProjectPitchDraft: generateNsfProjectPitchDraft,
  // Internal exposure for unit testing only — not part of public API.
  _internal: {
    _validateExpansion:  _validateExpansion,
    _normalizeExpansion: _normalizeExpansion,
    _safeExtractPacket:  _safeExtractPacket,
    _buildUserMessage:   _buildUserMessage,
    SECTION_LIMITS:      SECTION_LIMITS,
    SOURCE_CONTRACT:     SOURCE_CONTRACT,
    SCHEMA_VERSION:      SCHEMA_VERSION,
    SYSTEM_PROMPT:       SYSTEM_PROMPT
  }
};
