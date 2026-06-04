/**
 * pattern-author.js — Claude proposes new bridge patterns for portals the
 * existing library can't reach.
 *
 * Input: a portal whose bridgeReadings.matched is empty AND has kernel signal
 * Process:
 *   1. Extract portal signature (sector, kernel phase, functional-network shape,
 *      sample suppliers/customers, distress signals)
 *   2. Send to Claude with: existing bridge patterns + instruction to propose
 *      a NEW pattern with the same schema, anchored in real neuroscience
 *   3. Validate the response (required schema fields, no fabricated citations)
 *   4. Return proposal — operator reviews before merge into bridge-patterns.json
 *
 * Cross-domain support: target_domain isn't limited to "business signature."
 * Patterns may map neural mechanism → environmental / population / supply-chain /
 * life-expectancy phenomena. The author tool accepts a `targetDomain` hint
 * (default 'business') and adjusts the prompt accordingly.
 */
const fs = require('node:fs');
const path = require('node:path');
const orchestrator = require('./ai-orchestrator.js');
const { scorePattern, MATCH_THRESHOLD } = require('./bridge-engine.js');

const PATTERNS_PATH = path.join(__dirname, '..', '..', 'assets', 'data', 'bridge-patterns.json');
const PROPOSALS_PATH = path.join(__dirname, '..', '..', 'assets', 'data', '_pattern-proposals.json');
const REDIS_KEY = 'limen:pattern-proposals';

// Match existing api/limen-engine-output.js Redis pattern:
//   - env vars: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   - call style: POST JSON command array to base URL (not path-encoded)
function _redisEnabled() { return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN); }
async function _redisCmd(cmd) {
  if (!_redisEnabled()) throw new Error('redis env vars not set');
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (!r.ok) throw new Error('redis ' + cmd[0] + ' status ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
  return j && j.result;
}

const SYSTEM_PROMPT = `You are an expert in clinical neuroscience, polyvagal theory, dynamical-systems pathology, and cross-domain pattern transfer. You author bridge patterns that map a specific neural mechanism (with its clinical pathology, known treatments, and primary literature) to an isomorphic pattern in a target domain (business, environment, population, supply-chain, life-expectancy, public-health, ecology). Each pattern is a TESTABLE CLAIM that two domains describe the same underlying dynamical pathology.

You return ONE pattern object as JSON, matching this exact shape:
{
  "id": "<neuralRegion>_<mechanism_short>_x_<target_signature>",
  "neural": {
    "region": "<short abbreviation>",
    "regionLabel": "<full name>",
    "state": "<pathological state, e.g. tonic_hyperactivation>",
    "mechanism": "<2-3 sentence mechanism description, citation-grade>",
    "knownTreatments": ["<treatment 1 with parenthetical mechanism>", ...],
    "clinicalReferences": ["<author year journal>", ...]
  },
  "business": {
    "signature": "<short_snake_case_label>",
    "description": "<2-3 sentence description of the pathology in the target domain>",
    "indicators": [
      { "id": "<snake_case>", "description": "<what to detect>", "detector": { "type": "<kernel_phase|fn_phase_share|fn_text_match|text_match>", "...": "..." } }
    ],
    "phaseAffinity": ["p3", "p7b"],
    "examples": ["<named real case 1>", ...],
    "businessReferences": ["<author year>", ...]
  },
  "bridge": {
    "mappingType": "<isomorphic_pathology|analogous_mechanism|inverse_mapping>",
    "confidence": 0.65,
    "rationale": "<1-2 sentence explanation of why the two domains share underlying mechanism>"
  },
  "derivedAngles": {
    "patent": { "claimDirection": "...", "noveltyAnchor": "..." },
    "grant": { "programMatch": ["..."], "angle": "..." },
    "investment": { "thesis": "...", "horizon": "...", "instruments": ["..."] },
    "research": { "hypothesis": "...", "methodology": "..." },
    "sba": null,
    "franchise": null
  }
}

CRITICAL RULES:
- Do NOT invent citations. If you don't have a real reference, leave the array empty.
- Do NOT use generic indicators. Each indicator must have a concrete detector and be testable against portal data.
- The mappingType must be honest: 'isomorphic_pathology' means same mechanism, 'analogous_mechanism' means structural parallel, 'inverse_mapping' means the neural treatment becomes the business intervention.
- confidence must reflect how strong the cross-domain mapping is, not how exciting it sounds. 0.5-0.7 is normal for analogous; 0.8+ requires explicit literature in BOTH domains.
- The pattern must be DISTINCT from every entry in alreadyConsideredPatterns. The pattern.id you create AND the (neural.region × business.signature) combination both must be NEW.
- REJECTED patterns are an especially hard signal: the operator has already decided that mapping is not useful. Do NOT propose a thinly-disguised re-skin of any REJECTED pattern (e.g., same neural region with a synonym for the same business signature, or vice versa).
- APPROVED patterns are already in production. Do NOT propose a duplicate via a different angle.
- If after considering the full alreadyConsideredPatterns list you cannot find a genuinely new, well-grounded mapping, return {"refused": true, "reason": "..."} instead of repeating one.
- Return ONLY the JSON object. No preamble, no markdown wrapper, no commentary.`;

// System prompt for the self-correction pass: when authored indicators don't
// fire on the source portal, re-author ONLY the indicators against the portal's
// real, detectable signals so they actually detect something present in THIS
// portal. The neural mechanism, signature, and bridge stay fixed — we're fixing
// the *encoding*, not changing the claim.
const REPAIR_SYSTEM_PROMPT = `You are repairing the business.indicators of a bridge pattern so they actually FIRE against a specific portal's REAL data. You are given (1) the existing pattern and (2) the portal's actual detectable signals. Rewrite business.indicators so at least one detector matches the provided signals at meaningful confidence. Keep neural, business.signature, business.description, bridge, and derivedAngles UNCHANGED — change only business.indicators.

Detector types and exactly what each reads:
- kernel_phase: { "type":"kernel_phase", "kernels":["k1"|"k2"], "phases":[...] } — fires if the portal's kernel phase is in phases. Use the portal's ACTUAL kernel phases from portalDetectableSignals.kernelPhases.
- fn_phase_share: { "type":"fn_phase_share", "category":"<fn category>", "stressPhases":[...], "minShare":0.3 } — fires if >= minShare of that category's entries are in stressPhases. Use categories that EXIST in portalDetectableSignals.functionalNetwork and phases present in that category's phaseDistribution.
- fn_text_match: { "type":"fn_text_match", "category":"<fn category>", "patterns":[...] } — fires if any entry's note/role/name contains a pattern substring. Use words ACTUALLY PRESENT in that category's sampleNotes/sampleRoles/sampleNames.
- text_match: { "type":"text_match", "fields":[...], "patterns":[...] } — fires if the listed portal text fields contain a pattern substring. Use fields and words ACTUALLY PRESENT in portalDetectableSignals.textFields.

Return the COMPLETE pattern object as JSON (same schema, same id), with only business.indicators changed. Return ONLY the JSON object — no preamble, no markdown.`;

// Extract exactly the signals the detectors can read, so the repair pass can
// author indicators that actually fire (rather than guessing blind).
function _portalDetectableSignals(portal) {
  const out = { kernelPhases: {}, functionalNetwork: {}, textFields: {}, presentFields: [] };
  const kr = portal.kernelReadings || {};
  if (kr.k1 && kr.k1.phase) out.kernelPhases.k1 = String(kr.k1.phase).toLowerCase();
  if (kr.k2 && kr.k2.phase) out.kernelPhases.k2 = String(kr.k2.phase).toLowerCase();
  if (portal.financialHealth && portal.financialHealth.dominantPhase) out.kernelPhases.financialHealth = String(portal.financialHealth.dominantPhase).toLowerCase();
  const fn = portal.functionalNetwork || {};
  for (const cat of Object.keys(fn)) {
    const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] ? [fn[cat]] : []);
    if (!arr.length) continue;
    const phaseDistribution = {}; const sampleNotes = [], sampleRoles = [], sampleNames = [];
    for (const e of arr) {
      if (e && e.phase) { const ph = String(e.phase).toLowerCase(); phaseDistribution[ph] = (phaseDistribution[ph] || 0) + 1; }
      if (e && e.relationshipNote && sampleNotes.length < 5) sampleNotes.push(e.relationshipNote);
      if (e && e.brainNodeRole && sampleRoles.length < 5) sampleRoles.push(e.brainNodeRole);
      if (e && e.name && sampleNames.length < 5) sampleNames.push(e.name);
    }
    out.functionalNetwork[cat] = { count: arr.length, phaseDistribution, sampleNotes, sampleRoles, sampleNames };
  }
  for (const f of ['description', 'businessSummary', 'summary', 'sector', 'industry', 'name', 'tags', 'keywords', 'sic']) {
    const v = portal[f];
    if (typeof v === 'string' && v.trim()) out.textFields[f] = v.slice(0, 400);
    else if (Array.isArray(v) && v.length) out.textFields[f] = v.filter(x => typeof x === 'string').slice(0, 10).join(', ').slice(0, 400);
  }
  for (const f of Object.keys(portal)) { const v = portal[f]; if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) out.presentFields.push(f); }
  return out;
}

function _existingPatternsCompactList() {
  try {
    const lib = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8'));
    return (lib.patterns || []).map(p => ({
      id: p.id,
      neural: { region: p.neural && p.neural.region, state: p.neural && p.neural.state },
      target: p.business && p.business.signature,
      origin: 'bridge-patterns.json'
    }));
  } catch (e) { return []; }
}

// Pull every pattern that has EVER been seen — from the live library AND from
// every Redis proposal (pending + approved + rejected). Latest-status-wins on
// dedup since LPUSH appends without removing. Claude sees this entire list
// with statuses so it never re-proposes anything we've already decided on.
async function _allKnownPatternsForPrompt() {
  const fromLib = _existingPatternsCompactList();
  const fromRedis = [];
  if (_redisEnabled()) {
    try {
      const raw = await _redisCmd(['LRANGE', REDIS_KEY, '0', '500']);
      const proposals = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      // latest-wins by pattern.id
      const seen = new Set();
      for (const p of proposals) {
        const id = p.pattern && p.pattern.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        fromRedis.push({
          id,
          neural: { region: p.pattern.neural && p.pattern.neural.region, state: p.pattern.neural && p.pattern.neural.state },
          target: p.pattern.business && p.pattern.business.signature,
          origin: 'redis (status: ' + (p.status || 'PENDING_REVIEW') + ')',
          status: p.status || 'PENDING_REVIEW',
          sourcePortal: p.sourcePortal
        });
      }
    } catch (e) { console.warn('[pattern-author] redis history read failed:', e.message); }
  }
  // Combine; library entries win over redis duplicates (already synced)
  const libIds = new Set(fromLib.map(p => p.id));
  return [...fromLib, ...fromRedis.filter(r => !libIds.has(r.id))];
}

async function _loadProposals() {
  // Prefer Redis when available — Vercel serverless filesystem is ephemeral.
  if (_redisEnabled()) {
    try {
      const raw = await _redisCmd(['LRANGE', REDIS_KEY, '0', '500']);
      const proposals = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      return { schemaVersion: 'pattern-proposals/1.0', proposals, storage: 'redis' };
    } catch (e) { console.warn('[pattern-author] redis read failed, falling back to file:', e.message); }
  }
  try { return { ...JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8')), storage: 'file' }; }
  catch (e) { return { schemaVersion: 'pattern-proposals/1.0', proposals: [], storage: 'file' }; }
}
async function _saveProposal(newProposal) {
  if (_redisEnabled()) {
    try {
      await _redisCmd(['LPUSH', REDIS_KEY, JSON.stringify(newProposal)]);
      await _redisCmd(['LTRIM', REDIS_KEY, '0', '499']);
      return { storage: 'redis' };
    } catch (e) { console.warn('[pattern-author] redis write failed, falling back to file:', e.message); }
  }
  let state; try { state = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8')); } catch (e) { state = { schemaVersion: 'pattern-proposals/1.0', proposals: [] }; }
  state.proposals.unshift(newProposal);
  state.proposals = state.proposals.slice(0, 500);
  state.lastUpdated = new Date().toISOString();
  try { fs.writeFileSync(PROPOSALS_PATH, JSON.stringify(state, null, 2)); return { storage: 'file' }; }
  catch (e) { console.warn('[pattern-author] file write failed (read-only fs?):', e.message); return { storage: 'none', error: e.message }; }
}
async function _updateProposalStatus(patternId, updates) {
  if (_redisEnabled()) {
    try {
      const raw = await _redisCmd(['LRANGE', REDIS_KEY, '0', '500']);
      const all = (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      const found = all.find(p => p.pattern && p.pattern.id === patternId);
      if (!found) return { ok: false, error: 'not found' };
      Object.assign(found, updates);
      await _redisCmd(['LPUSH', REDIS_KEY, JSON.stringify(found)]);
      return { ok: true, storage: 'redis' };
    } catch (e) { console.warn('[pattern-author] redis update failed:', e.message); }
  }
  try {
    const state = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8'));
    const p = state.proposals.find(x => x.pattern && x.pattern.id === patternId);
    if (!p) return { ok: false, error: 'not found' };
    Object.assign(p, updates);
    fs.writeFileSync(PROPOSALS_PATH, JSON.stringify(state, null, 2));
    return { ok: true, storage: 'file' };
  } catch (e) { return { ok: false, error: e.message }; }
}

/**
 * Propose a new pattern for a portal that doesn't match any existing bridge.
 * @param {object} portal - the portal JSON with kernelReadings + functionalNetwork
 * @param {object} opts - { targetDomain: 'business'|'environment'|'population'|..., reason?: string }
 */
async function proposePattern(portal, opts) {
  opts = opts || {};
  const targetDomain = opts.targetDomain || 'business';

  // Includes everything in bridge-patterns.json + every Redis proposal
  // (pending/approved/rejected) so Claude never re-invents one we've decided.
  const existing = await _allKnownPatternsForPrompt();
  const rejectedIds = existing.filter(p => p.status === 'REJECTED').map(p => p.id);
  const approvedIds = existing.filter(p => p.status === 'APPROVED').map(p => p.id);
  const fn = portal.functionalNetwork || {};
  const sample = {
    name: portal.name,
    ticker: portal.ticker,
    cik: portal.cik,
    sector: portal.sector || portal.industry,
    domain: portal.domainId,
    sic: portal.sic,
    kernelPhase: (portal.kernelReadings && portal.kernelReadings.k2 && portal.kernelReadings.k2.phase) || (portal.financialHealth && portal.financialHealth.dominantPhase),
    composite: (portal.kernelReadings && portal.kernelReadings.k1 && portal.kernelReadings.k1.composite) || (portal.financialHealth && portal.financialHealth.composite),
    alert: (portal.kernelReadings && portal.kernelReadings.k1 && portal.kernelReadings.k1.alert) || (portal.financialHealth && portal.financialHealth.alert),
    suppliers: (fn.suppliers || []).slice(0, 8).map(s => ({ name: s.name, phase: s.phase, role: s.brainNodeRole })),
    customers: (fn.customers || []).slice(0, 8).map(c => ({ name: c.name, phase: c.phase })),
    capitalProviders: (fn.capitalProviders || []).slice(0, 5).map(c => ({ name: c.name, phase: c.phase })),
    regulators: (fn.regulators || []).slice(0, 5).map(r => ({ name: r.name })),
    competitors: (fn.competitors || []).slice(0, 5).map(c => ({ name: c.name }))
  };

  const prompt = JSON.stringify({
    instruction: `Author ONE new bridge pattern that maps a clinical neural pathology to a ${targetDomain} signature this portal exhibits. The pattern must be GENUINELY NEW — both its pattern.id AND its (neural.region × business.signature) combination MUST be different from every entry in alreadyConsideredPatterns. Pay special attention to the REJECTED list (operator has already decided these mappings are not useful) and the APPROVED list (these already exist; don't duplicate from a different angle).`,
    targetDomain,
    portalSignature: sample,
    reasonForRequest: opts.reason || 'portal has kernel signal but no existing pattern matched',
    alreadyConsideredPatterns: existing,
    rejectedPatternIds: rejectedIds,
    approvedPatternIds: approvedIds,
    note: 'If after considering the alreadyConsideredPatterns list you cannot find a genuinely novel and well-grounded neural↔target mapping that is DIFFERENT from every entry there (including from the REJECTED list), return {"refused": true, "reason": "all reasonable mappings for this portal already considered"} instead of repeating one.'
  });

  const r = await orchestrator.call('AUTHOR_PATTERN', { system: SYSTEM_PROMPT, prompt, maxTokens: 8192 });
  if (!r.ok) return { ok: false, error: r.error };

  let parsed;
  try {
    let txt = r.text || '';
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start < 0) return { ok: false, error: 'no JSON object in response' };
    parsed = JSON.parse(txt.slice(start, end + 1));
  } catch (e) { return { ok: false, error: 'JSON parse: ' + e.message, raw: (r.text || '').slice(0, 500) }; }

  if (parsed.refused) return { ok: true, refused: true, reason: parsed.reason };

  // basic validation
  if (!parsed.id || !parsed.neural || !parsed.business || !parsed.bridge) {
    return { ok: false, error: 'missing required fields', proposal: parsed };
  }

  // ── Author-time dedup guard ──────────────────────────────────────────────
  // Claude is *instructed* to avoid dupes, but enforce it hard so the store
  // doesn't bloat with thinly-disguised duplicates. Reject before saving if the
  // candidate collides on pattern.id OR on (source-portal × business-signature)
  // — the "same portal + same signature, different neural region" case the
  // operator flagged. Returns ok:true so the caller treats it as a clean skip.
  const _candSig = String((parsed.business && parsed.business.signature) || '').toLowerCase();
  const _candPortal = (portal.slug || (portal.name || '').toLowerCase().replace(/\s+/g, '_'));
  const _dupe = existing.find(function (e) {
    if (e.id && parsed.id && String(e.id).toLowerCase() === String(parsed.id).toLowerCase()) return true;
    if (_candSig && e.target && String(e.target).toLowerCase() === _candSig && e.sourcePortal && e.sourcePortal === _candPortal) return true;
    return false;
  });
  if (_dupe) {
    return { ok: true, duplicate: true, reason: 'duplicate of ' + _dupe.id + ' (same pattern.id or same source-portal × business-signature)', candidate: parsed.id, tokensUsed: (r.tokensIn || 0) + (r.tokensOut || 0) };
  }

  // ── Author-time salience pre-filter (thalamic gate) ──────────────────────
  // Does this pattern's indicators actually FIRE on the very portal it was
  // authored from, at the production match threshold? This is NOT approval and
  // NOT a verdict on whether the scenario is true — it only routes WHAT reaches
  // the human operator, protecting scarce review attention from noise.
  //   fires      → PENDING_REVIEW  (active queue; the operator approves/rejects)
  //   does not   → HELD_UNMATCHED  (holding bucket; KEPT, never deleted)
  // A held pattern is re-checked on every rebuild tick and GRADUATES back to
  // PENDING_REVIEW automatically if it later starts firing (corpus drift or
  // re-encoded detectors) — buckets are revisable; the brain reconsolidates.
  let sourceMatch = null;
  try { sourceMatch = scorePattern(parsed, portal); } catch (e) { sourceMatch = null; }

  // Self-correction (ONE attempt): if the indicators don't fire on the source,
  // re-author them against the portal's REAL detectable signals before giving
  // up. This is what fills the active queue with patterns that actually match —
  // Claude authored the first pass blind to the portal's concrete data. We fix
  // the encoding, not the claim; if it still doesn't fire, it's held (not lost).
  let repairAttempted = false, repairSucceeded = false, repairTokens = 0;
  if (!sourceMatch) {
    repairAttempted = true;
    try {
      const signals = _portalDetectableSignals(portal);
      const repairPrompt = JSON.stringify({
        instruction: 'Rewrite business.indicators so at least one detector FIRES on these real signals. Keep neural, signature, description, bridge, derivedAngles unchanged.',
        pattern: parsed,
        portalDetectableSignals: signals
      });
      // AUTHOR_PATTERN intent = Anthropic (sonnet, schema-bound). The repair
      // system prompt is what makes this a re-encode rather than a fresh author.
      const rr = await orchestrator.call('AUTHOR_PATTERN', { system: REPAIR_SYSTEM_PROMPT, prompt: repairPrompt, maxTokens: 8192 });
      repairTokens = (rr.tokensIn || 0) + (rr.tokensOut || 0);
      if (rr.ok && rr.text) {
        const a = rr.text.indexOf('{'), b = rr.text.lastIndexOf('}');
        if (a >= 0 && b > a) {
          const repaired = JSON.parse(rr.text.slice(a, b + 1));
          if (repaired && repaired.id === parsed.id && repaired.business && Array.isArray(repaired.business.indicators)) {
            const reMatch = scorePattern(repaired, portal);
            if (reMatch) { parsed = repaired; sourceMatch = reMatch; repairSucceeded = true; }
          }
        }
      }
    } catch (e) { /* repair failed — fall through to HELD; nothing lost */ }
  }

  const firesOnSource = !!sourceMatch;
  const status = firesOnSource ? 'PENDING_REVIEW' : 'HELD_UNMATCHED';

  // Persist (Redis on Vercel, file locally). Status routes the bucket; nothing
  // is discarded either way.
  const persistResult = await _saveProposal({
    id: parsed.id,
    proposedAt: new Date().toISOString(),
    targetDomain,
    sourcePortal: portal.slug || (portal.name || '').toLowerCase().replace(/\s+/g, '_'),
    pattern: parsed,
    tokensUsed: (r.tokensIn || 0) + (r.tokensOut || 0) + repairTokens,
    provider: r.provider,
    model: r.model,
    status,
    prefilter: {
      firesOnSource,
      threshold: MATCH_THRESHOLD,
      confidence: firesOnSource ? sourceMatch.confidence : 0,
      matchRate: firesOnSource ? sourceMatch.matchRate : 0,
      matchedIndicators: firesOnSource ? sourceMatch.matchedIndicators : [],
      repairAttempted,
      repairSucceeded,
      evaluatedAt: new Date().toISOString()
    }
  });

  return {
    ok: true,
    proposal: parsed,
    status,
    firesOnSource,
    sourceConfidence: firesOnSource ? sourceMatch.confidence : 0,
    repairAttempted,
    repairSucceeded,
    tokensUsed: (r.tokensIn || 0) + (r.tokensOut || 0) + repairTokens,
    storage: persistResult.storage
  };
}

async function listProposals() { return await _loadProposals(); }

async function approveProposal(proposalId) {
  const state = await _loadProposals();
  const p = state.proposals.find(x => x.pattern && x.pattern.id === proposalId);
  if (!p) return { ok: false, error: 'proposal not found: ' + proposalId };
  if (p.status === 'APPROVED') return { ok: false, error: 'already approved' };

  // Read existing library. On Vercel the file may not be in the function
  // bundle (includeFiles glob not always applying); on local dev it IS
  // present. Either way, we don't fail — we just mark the proposal APPROVED
  // and let scripts/sync-approved-patterns.mjs merge into the JSON file
  // on next local pull.
  let lib = null, libReadError = null;
  try { lib = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8')); }
  catch (e) { libReadError = e.message; lib = { schemaVersion: 'bridge/1.0', patterns: [] }; }

  if ((lib.patterns || []).some(x => x.id === proposalId)) return { ok: false, error: 'pattern id already in library — already approved earlier?' };

  // Attempt the file write — on Vercel's read-only fs this throws and we
  // capture the failure; the proposal still moves to APPROVED in Redis.
  lib.patterns.push(p.pattern);
  lib.generatedAt = new Date().toISOString();
  let mergeWrote = true, writeError = null;
  try { fs.writeFileSync(PATTERNS_PATH, JSON.stringify(lib, null, 2)); }
  catch (e) { mergeWrote = false; writeError = e.message; }

  await _updateProposalStatus(proposalId, {
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    libraryWriteSucceeded: mergeWrote,
    libraryWriteError: writeError,
    libraryReadError: libReadError,
    awaitingLocalSync: !mergeWrote
  });

  return {
    ok: true,
    patternId: proposalId,
    libraryCount: lib.patterns.length,
    libraryWriteSucceeded: mergeWrote,
    awaitingLocalSync: !mergeWrote,
    note: mergeWrote
      ? 'Pattern merged into bridge-patterns.json on the server.'
      : 'Approved in Redis. The bridge-patterns.json file write was rejected by the runtime filesystem (expected on Vercel). Run `node scripts/sync-approved-patterns.mjs --apply` locally to merge into the repo file and commit.'
  };
}

async function rejectProposal(proposalId) {
  return await _updateProposalStatus(proposalId, { status: 'REJECTED', rejectedAt: new Date().toISOString() });
}

module.exports = { proposePattern, listProposals, approveProposal, rejectProposal };
