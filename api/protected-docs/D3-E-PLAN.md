# D3-E PLAN — NSF SBIR Project Pitch lane

**Status:** read-only planning document. No code changes proposed for execution
in this artifact. Patent lane invariants documented; first patch authorization
deferred to user.

**Audit anchor:** HEAD `9de16cf5f2b` (D3-C.1). Patent council pipeline is RUNS:
D3-A4.5 readiness gates → D3-B/B.1 GPT draft → D3-C.0 Grok critique → D3-C.1
deterministic objection ledger.

**User-confirmed assumptions:**
- Preferred first target: **NSF SBIR Project Pitch**.
- Preferred lane string: **`nsf-project-pitch`** (specific-lane separation).
- Existing `research-grants` lane should be inspected for ready packets but
  NOT assumed to be the correct public artifact lane.

---

## A. AUDIT FINDINGS

### A.1 Lane registry (artifact-packet-builder.js, lines 118-126)

```js
var LANE_TO_PATH = {
  'patents':         'PATENTABLE',
  'copyrights':      'PATENTABLE',
  'business-grants': 'GRANT-ELIGIBLE',
  'research-grants': 'GRANT-ELIGIBLE',
  'sba-loans':       'INVESTABLE',
  'investments':     'INVESTABLE',
  'research-papers': null
};
```

`'nsf-project-pitch'` is **NOT** in this map — the builder would emit
`UNKNOWN_LANE_FOR_PATH_MAP` warn for any HandoffPacket bearing it.

`FORBIDDEN_FOR_LANE` (line 132+) covers the same 7 lanes plus three with
forbidden-field overrides:
```js
'patents':         ['valueRange', 'companies', 'whyPays', 'compensation'],
'business-grants': ['valueRange', 'compensation.base'],
'research-grants': ['valueRange', 'compensation.base'],
```

### A.2 Brain-side lane emission

`research-grants` is **REAL**, not scaffolding. Three independent code paths
prove it:

1. **`handoff-contract.js`** lines 49 (LANES list) + 61 (LANE_GATES):
   ```js
   'research-grants': { minEvidence: 0.55, minConfidence: 0.55,
     anyDomain: ['research','education','medicine','health','science','environment'] }
   ```
   Lane description (line 115): *"research-funding opportunity (NSF/NIH/foundation tracks)"*.

2. **`cross-node-opportunity.js`** maps research-grants to 6 domains
   (lines 75-93): research, medicine, health, education, science, environment.

3. **Runtime browser verification (prior session)**: 36 ready research-grants
   packets across the 13 brains. The lane has live data flow.

`'business-grants'` is also REAL (handoff-contract gate at line 60, mapped to
agriculture/industry/infrastructure/supplyChain/education/energy domains).

`'research-papers'` is recognized but has `null` path → builder emits
`NO_ENRICHMENT_PATH` info (D3-A3.7 sentinel behavior).

### A.3 Conceptual buildAll() per-lane packet count

From code reading (no runtime execution):

| Lane | Brain emission path | Approx ready packet count* |
|---|---|---|
| `patents` | 6 domains × 2-4 nodes | ~22 (browser-confirmed) |
| `research-grants` | 6 domains × 4-6 nodes | ~36 (browser-confirmed) |
| `business-grants` | 6 domains × 2-3 nodes | ~18 (estimated) |
| `sba-loans` | 6 domains × 1-2 nodes | ~12 (estimated) |
| `investments` | 4 domains × 1 node | ~4 (browser-confirmed) |
| `research-papers` | 7 domains, varied | ~5 (browser-confirmed, all NO_ENRICHMENT_PATH) |
| `copyrights` | 6 domains, sparse | UNKNOWN |

*estimates from code paths; runtime numbers from prior session audit.

### A.4 Endpoint allowed-lane gates

Both endpoints use a single string constant — strict patents-only:

**`api/expand-artifact.js`:**
```js
// line 43
var SUPPORTED_LANE = 'patents';
```
```js
// lines 197-203
if (packetLane !== SUPPORTED_LANE && requestLane !== SUPPORTED_LANE) {
  return { code: 'UNSUPPORTED_LANE', http: 400,
    message: 'D3-B supports patents lane only.' };
}
if (packetLane !== SUPPORTED_LANE) {
  return { code: 'UNSUPPORTED_LANE', http: 400,
    message: 'artifactPacket.identity.lane must be "patents".' };
}
```

**`api/critique-artifact.js`:**
```js
// line 53
var SUPPORTED_LANE = 'patents';
```
```js
// lines 236-242 — identical gate shape to expand-artifact
if (packetLane !== SUPPORTED_LANE && requestLane !== SUPPORTED_LANE) {
  return { code: 'UNSUPPORTED_LANE', http: 400,
    message: 'D3-C.0 supports patents lane only.' };
}
```

### A.5 Existing patent system prompt + schema (expand-artifact.js)

**Patent-specific framing in SYSTEM_PROMPT** (lines 271-326):
- *"drafting a preliminary invention disclosure and provisional-patent-style outline"*
- *"Do not claim novelty, patentability, freedom to operate, legal validity"*
- `requiresHumanPatentReview: true` (anti-overclaim flag)
- `provisionalClaimSketches[]` schema field (patent-specific)
- `priorArtSearchPlan` with USPTO, Google Patents, WIPO Patentscope databases

**Lane-agnostic framing in SYSTEM_PROMPT** (lines 327-334):
- Internal-language guard: *"Do not mention LIMEN, internal domain states, stress bands, diagnoses, brain nodes, phase language, ArtifactPacket IDs, or readiness gates"*
- Provenance citation requirement
- Missing-information marker requirement

**Patent JSON schema fields** (lines 294-318):
- Patent-specific: `inventionTitle`, `field`, `background` (USPTO style),
  `provisionalClaimSketches[]`, `priorArtSearchPlan{}`
- Lane-agnostic: `problemStatement`, `technicalSolution`, `systemComponents`,
  `methodSteps`, `dataInputs`, `outputs`, `potentialEmbodiments`,
  `evidenceLedger[]`, `missingInformation[]`, `humanReviewChecklist[]`

### A.6 INTERNAL_LANGUAGE_PATTERNS — fully lane-agnostic

(line 70 in expand-artifact.js, identical 13 patterns in critique-artifact.js)

```
LIMEN, ArtifactPacket, stressBand, domain stress, diagnosis, GRID_COLLAPSE,
OFC, node, phase, recursive, anti_overclaim, readyForGeneration,
sourceOpportunityId
```

**Apply to ANY public-facing artifact** — patent prose AND grant prose AND
loan prose AND research-paper prose. **No D3-E modification needed**.

### A.7 `_verifyExpansion` lane-specificity (expand-artifact.js)

| Check | Lane-specificity |
|---|---|
| `expansion.antiOverclaim.noveltyClaimed === true` → reject | **PATENT-SPECIFIC** (concept of "novelty" is patent law) |
| `expansion.antiOverclaim.patentabilityClaimed === true` → reject | **PATENT-SPECIFIC** |
| `expansion.antiOverclaim.filingReady === true` → reject | Patent-leaning but maps to "submission-ready" for grants too |
| `expansion.status !== 'draft_only'` → reject | LANE-AGNOSTIC |
| Prohibited-language scan (PROHIBITED_PATTERNS, 7 entries) | Mixed: novelty/patentable patent-specific; guarantee/will achieve/approved lane-agnostic |
| `_verifyFeedGroundedLanguage(expansion, packet)` | Field names patent-leaning (`background`, `problemStatement`, `technicalSolution`) but conceptually lane-agnostic |
| Identity override (artifactPacketId, sourceOpportunityId, lane) | LANE-AGNOSTIC |

### A.8 Critique endpoint similarity (critique-artifact.js)

`_verifyCritique` (line 491-561):
- Lane-agnostic: status='critique_only', notDraft=true, didNotEndorse,
  didNotConfirmPatentability, didNotClaimNovelty, didNotClaimFilingReady
  — these "didNot" flags ARE patent-flavored but the *concept* of
  "Grok did not endorse the artifact" applies to all lanes equally.
- `_walkCritiqueStrings` recursive walker: LANE-AGNOSTIC.
- `_scanProhibitedLanguage`: mixed, see A.6.
- `_scanInternalLanguage`: LANE-AGNOSTIC.

`_deriveObjectionLedger` (D3-C.1, line 607+):
- 7 derivation rules across `weakestLinks`, `overclaimRisks`,
  `sourceFreshnessConcerns`, `internalLanguageLeaks`, `reviewerObjections`,
  `missingEvidence`, `antiOverclaim.unsupportedClaims`.
- **All 7 source field names are LANE-AGNOSTIC.** A grant artifact
  critique will populate the same arrays. `reviewerObjections[].reviewerType`
  schema already includes `'grant_reviewer'` per the prompt
  (critique-artifact.js line 365).

**D3-C.1 ledger is reusable as-is for grants.** No modification needed.

`critique` schema fields (critique-artifact.js prompt lines 346-371):
- All lane-agnostic. `strongestEvidence[]`, `weakestLinks[]`,
  `overclaimRisks[]`, `internalLanguageLeaks[]`, `sourceFreshnessConcerns[]`,
  `reviewerObjections[]`, `missingEvidence[]`, `recommendedEdits[]`, `goNoGo`
  apply equally to NSF Project Pitch critique.

### A.9 NSF Project Pitch references in repo

Searched repo for "NSF", "SBIR", "Project Pitch", "Phase I", "broader impacts",
"technical merit", "specific aims", "grants.gov":

**Found mentions (categorized):**
- **Funding-recommendation strings** in domain `*-business-build.js` and
  `*-directive-translator.js` files (e.g., "Apply for SBIR Phase I (NIH or NSF)").
  These are *narrative recommendations*, not schema definitions.
- **Funder lists** in `agriculture-opportunities.html` and similar HTML pages
  (e.g., "NSF SBIR Phase I ($275K)") — UI text, not structural data.
- **NSF/NIH framing in `handoff-contract.js`** line 115: lane description
  comment only, no schema.
- **Default funder lists** in `expand-artifact.js` `DOMAIN_BASE` map
  references (e.g., medicine: "NIH, AHRQ, HRSA, private health foundations").

**NO NSF Project Pitch schema, NO NSF reviewer-criteria schema, NO Phase I
proposal field definitions exist anywhere in the repo.**

The NSF Project Pitch is a separate, well-known artifact format published by
NSF (4-section structure: Technology Innovation, Technical Objectives and
Challenges, Market Opportunity, Company and Team). The schema must be
authored either:
- (a) from operator knowledge (no outbound research, AI uses general training data
  knowledge of NSF Project Pitch — risky if outdated), OR
- (b) with explicit user authorization for outbound research to NSF.gov to
  verify current Project Pitch requirements.

**Recommendation: option (b) before D3-E.1 patch authorization.** NSF SBIR
guidance is updated periodically; outdated schema = operator risk.

---

## B. PROPOSED LANE STRING

**Confirmed: `nsf-project-pitch`.**

### Rationale

1. **Specificity over genericity.** NSF Project Pitch is structurally
   distinct from:
   - NIH SBIR Specific Aims (1-page narrative, different sections, different
     reviewer rubric)
   - DOE SBIR Letter of Intent (technical concept paper, different format)
   - Templeton concept paper (mission-driven framing, no commercial pathway)
   - SAM.gov sole-source capability statement (procurement, not grant)

2. **Future expansion path.** Sibling lanes can grow naturally:
   - `nih-sbir-specific-aims`
   - `doe-sbir-loi`
   - `templeton-concept-paper`
   - `sam-capability-statement`
   - `arpa-h-pitch`
   - `darpa-saton-bid`

3. **Existing `research-grants` disposition:**
   - **DO NOT deprecate.** It's the upstream source category that 36 packets
     already match (browser-confirmed).
   - **DO NOT modify brain emission.** The 13 domain brains and
     `handoff-contract.js` continue emitting `research-grants` packets as the
     general-research-funding-shaped opportunity category.
   - **Treat `research-grants` as upstream source, `nsf-project-pitch` as
     downstream artifact lane.** D3-E.1 endpoint translation: when the request
     specifies `lane: 'nsf-project-pitch'`, accept packets bearing
     `identity.lane === 'research-grants'` AND/OR
     `identity.lane === 'nsf-project-pitch'`.

   This preserves a clean future where one upstream `research-grants` packet
   can fan out to NSF, NIH, DOE artifact drafts on demand without re-running
   the brain layer for each agency.

---

## C. PROPOSED OUTPUT SCHEMA FOR NSF PROJECT PITCH

**Recommended schema name: `D3-E.nsf-project-pitch.v1`**

Mirrors D3-B patent schema structure (status, notLegalAdvice, antiOverclaim,
draft, evidenceLedger, missingInformation, humanReviewChecklist) but
substitutes patent-specific fields with NSF Project Pitch fields.

```json
{
  "ok": true,
  "schemaVersion": "D3-E.nsf-project-pitch.v1",
  "lane": "nsf-project-pitch",
  "artifactPacketId": "<from input.identity.id>",
  "sourceOpportunityId": "<from input.identity.sourceOpportunityId>",
  "status": "draft_only",
  "notLegalAdvice": true,
  "notSubmissionReady": true,
  "antiOverclaim": {
    "awardGuaranteed": false,
    "preApproved": false,
    "submissionReady": false,
    "requiresHumanGrantReview": true,
    "agencyRequirementsCurrentAsOf": null,
    "unsupportedClaims": []
  },
  "draft": {
    "pitchTitle": "...",
    "companyOverview": "...",
    "technicalProblem": "...",
    "proposedInnovation": "...",
    "technicalMerit": "...",
    "preliminaryEvidence": "...",
    "marketOpportunity": "...",
    "commercialPathway": "...",
    "teamCapability": "...",
    "broaderImpacts": "...",
    "researchPlan": "...",
    "milestones": ["..."],
    "budgetRationale": "...",
    "evidenceLedger": [
      { "source": "...", "value": "...", "howUsed": "...", "limitation": "..." }
    ],
    "missingInformation": ["..."],
    "humanReviewChecklist": ["..."]
  }
}
```

### Field-level reuse vs new

**Reused from D3-B patent schema (lane-agnostic):**
- `evidenceLedger[]` — same shape
- `missingInformation[]` — same shape
- `humanReviewChecklist[]` — same shape
- `antiOverclaim.unsupportedClaims[]` — same shape (server-populated by
  prose scanner)

**New for NSF Project Pitch:**
- `pitchTitle` — short title; NOT a patent invention title
- `companyOverview` — brief entity context (the user explicitly noted: NOT
  marketing copy; cite verifiable entity facts only)
- `technicalProblem` / `proposedInnovation` — NSF Project Pitch core sections
- `technicalMerit` — feasibility + approach soundness, NOT
  novelty/patentability claims
- `preliminaryEvidence` — must cite `provenance.feedSources[]` per
  internal-language scanner
- `marketOpportunity` — addressable market sizing (with anti-overclaim:
  cite published market reports only, no fabricated TAM)
- `commercialPathway` — go-to-market + revenue model
- `teamCapability` — operator credentials (NOT in current packet — would
  pull from a future `team` field on the packet OR explicitly mark as
  `humanReviewChecklist` to-add)
- `broaderImpacts` — NSF-specific reviewer criterion
- `researchPlan` — Phase I work plan
- `milestones` — 6-12 month deliverable milestones
- `budgetRationale` — high-level scope only, NOT line-item dollar amounts

**Field NOT included** (patent-only): `inventionTitle`, `field`,
`technicalSolution`, `systemComponents`, `methodSteps`, `dataInputs`,
`outputs`, `potentialEmbodiments`, `provisionalClaimSketches[]`,
`priorArtSearchPlan{}`. These are kept exclusively in the patent lane.

### Anti-overclaim flag rationale (NSF-specific)

| Flag | Default | Justification |
|---|---|---|
| `awardGuaranteed: false` | always | NSF SBIR is competitive (~10-15% award rate); grants are not guaranteed. |
| `preApproved: false` | always | Project Pitch is a pre-screening step — passing means *invited to submit Phase I full proposal*, not "approved for award". |
| `submissionReady: false` | always | Drafts require human review for NSF FastLane / Research.gov compliance, formatting, eligibility certification. |
| `requiresHumanGrantReview: true` | always | Equivalent to patent's `requiresHumanPatentReview`. |
| `agencyRequirementsCurrentAsOf: null` | manual | Operator must populate with date of last NSF guidance check. Prevents drift from outdated training data. |

---

## D. PROPOSED PATCH SEQUENCE (descriptive only, NOT for execution)

### D3-E.0 — Lane registry expansion (smallest first patch)

**Scope:** `assets/js/civilization/artifact-packet-builder.js` only.

**Changes:**
1. Add `'nsf-project-pitch': 'GRANT-ELIGIBLE'` to `LANE_TO_PATH`
   (or alternatively `null` if we decide NSF artifacts derive purely from
   handoff state without Observatory enrichment — recommend `'GRANT-ELIGIBLE'`
   to preserve enrichment fan-in from research-grants-aligned Observatory
   packets).
2. Add `'nsf-project-pitch': ['valueRange', 'compensation.base']` to
   `FORBIDDEN_FOR_LANE` (mirrors business-grants/research-grants).

**No brain changes needed.** The ArtifactPacket builder will accept the lane
string but no HandoffPackets currently bear it — `buildAll()` will produce
zero `nsf-project-pitch` packets until either:
- (a) `handoff-contract.js` adds the lane, OR
- (b) D3-E.1 endpoint accepts `research-grants` packets when caller specifies
  `lane: 'nsf-project-pitch'` in request body.

**Recommendation:** path (b) — endpoint-level translation, no brain change.

**Files modified:** 1 (`artifact-packet-builder.js`)
**Lines changed estimate:** ~4
**Anti-overclaim implications:** None at this layer.
**Patent lane blast radius:** **ZERO.** Adding a key to LANE_TO_PATH does not
change the lookup behavior for `'patents'`.
**Risk:** Negligible.
**Authorization:** can proceed without outbound research.

### D3-E.1 — `/api/expand-artifact` adds NSF lane

**Scope:** `api/expand-artifact.js` only.

**Changes:**
1. Replace single `SUPPORTED_LANE = 'patents'` constant with a set:
   ```js
   var SUPPORTED_LANES = ['patents', 'nsf-project-pitch'];
   ```
2. Lane gate: accept request `lane` in the set; accept packet
   `identity.lane` in the set OR `'research-grants'` (upstream source for NSF).
3. Lane-branched `SYSTEM_PROMPT`:
   - `_systemPromptForLane(lane)` returns patent prompt for `'patents'`,
     NEW NSF prompt for `'nsf-project-pitch'`.
   - Patent prompt unchanged byte-for-byte. New NSF prompt authored from
     verified NSF Project Pitch guidance (requires outbound research step
     before authorization).
4. Lane-branched output schema documentation in the prompt.
5. Lane-branched `_verifyExpansion`:
   - Patent path unchanged.
   - NSF path checks `awardGuaranteed === false`, `preApproved === false`,
     `submissionReady === false`, `requiresHumanGrantReview === true`.
6. Identity override unchanged.
7. Response shape: same envelope, lane-specific `expansion` content.

**Files modified:** 1 (`expand-artifact.js`)
**Lines changed estimate:** ~250 (mostly NSF prompt block + new verifier branch)
**Anti-overclaim implications:** New flag set per §E below; new prohibited
patterns added per §E (carefully — must not match patent prose).
**Patent lane blast radius:** must remain **byte-identical**. Tests in §F.
**Risk:** Medium — refactor touches shared verifier.
**Authorization:** **REQUIRES outbound research first** for NSF schema verification.

### D3-E.2 — `/api/critique-artifact` adds NSF lane

**Scope:** `api/critique-artifact.js` only.

**Changes:**
1. Same lane-gate refactor: `SUPPORTED_LANES = ['patents', 'nsf-project-pitch']`.
2. Lane-branched system prompt with grant-reviewer-aware critique focus
   (technical merit, broader impacts, market opportunity, team capability).
3. NSF-specific critique focus: NSF reviewer rubric items, Phase I scope
   feasibility, broader impacts strength, commercialization realism.
4. `_verifyCritique` — patent invariants preserved; new lane-agnostic checks
   already cover the new lane (status/notDraft/didNot* flags).
5. `_deriveObjectionLedger` — **NO CHANGE.** D3-C.1 ledger derivation is
   already lane-agnostic (audit §A.8).

**Files modified:** 1 (`critique-artifact.js`)
**Lines changed estimate:** ~150
**Patent lane blast radius:** must remain byte-identical.
**Risk:** Low — D3-C.1 ledger reuses cleanly.
**Authorization:** REQUIRES outbound research first (NSF reviewer criteria).

### D3-E.3 — Optional: lane-specific helpers

If D3-E.1 / D3-E.2 reveal that helper functions (`_extractSafeInput`,
`_verifyFeedGroundedLanguage`, `_walkDraftStrings`, etc.) need lane-aware
field-name lists, add them in this patch. **Most likely not needed** —
audit shows these helpers are largely lane-agnostic.

**Authorization:** can defer until D3-E.1/E.2 patches surface concrete needs.

---

## E. ANTI-OVERCLAIM REQUIREMENTS FOR GRANT ARTIFACTS

### E.1 NEW prohibited language patterns

Add to `PROHIBITED_PATTERNS` in `expand-artifact.js` (and mirror in
`critique-artifact.js`):

| Pattern | Reason |
|---|---|
| `/\bguaranteed\b/i` | guarantee language (already partial via `\bguarante(e\|es\|ed\|s)\b`; verify coverage) |
| `/\bpre-?approved\b/i` | pre-approval language |
| `/\bpromised\b/i` | promise language |
| `/\bcertain\s+to\s+(win\|fund\|receive\|qualify)\b/i` | certainty-of-outcome language |
| `/\bensures?\s+(funding\|award\|approval)\b/i` | ensure-outcome language |
| `/\b(definitely\|absolutely)\s+(qualify\|qualifies\|funded)\b/i` | absolute-qualification language |
| `/\bwill\s+(receive\|win)\s+(funding\|award\|grant)\b/i` | future-funding-as-fact language |
| `/\bcompetitive\s+process\b/i` | **DO NOT MATCH** — this is allowed, intentionally honest |
| `/\bnon-dilutive\s+(guaranteed\|certain)\b/i` | mixed-language safeguard |

Suggested additions worth considering:
- `/\bsole-source\s+award\b/i` (procurement claim, requires authority)
- `/\bdefinitely\s+meets\s+criteria\b/i`
- `/\bcompliant\s+with\s+all\s+NSF\b/i` (overclaiming compliance)

### E.2 EXISTING patterns that still apply

Keep verbatim — relevant if the pitch discusses prior IP:
- `/\bnovel(ty)?\b/i` — novelty
- `/\bpatentab(le|ility)\b/i` — patentability
- `/\bready\s+to\s+file\b/i` — filing-ready (could leak from patent-side
  thinking)
- `/\bis\s+approved\b/i` — approval
- `/\bguarante(e|es|ed|s)\b/i` — guarantee
- `/\bwill\s+achieve\b/i` — unconditional achievement

### E.3 NEW required disclaimers in NSF output

NSF-specific draft-level disclaimers, enforced by post-AI verification:
- Status MUST include `notSubmissionReady: true`
- Anti-overclaim MUST include `awardGuaranteed: false`
- Anti-overclaim MUST include `preApproved: false`
- Anti-overclaim MUST include `requiresHumanGrantReview: true`
- Output prose SHOULD reference: *"submission does not guarantee award"*,
  *"draft for human review only"*, *"agency requirements subject to change"*,
  *"competitive process; outcomes uncertain"*

These can be enforced via:
- System prompt instructions (soft, model-honored)
- Post-AI verification flag checks (hard, block at 502)
- Server-side identity override that backfills disclaimers if AI omits them

Recommend a hybrid: prompt sets the floor; verifier blocks omission.

### E.4 NEW verification rules

1. **Required-section rule:** NSF draft MUST contain non-empty
   `technicalMerit` AND `broaderImpacts` (NSF dual-criterion). If either is
   empty/missing → 502 `NSF_REQUIRED_SECTION_MISSING`.

2. **Provenance citation rule:** Any quantitative claim in `technicalMerit`,
   `marketOpportunity`, or `preliminaryEvidence` must have a corresponding
   entry in `evidenceLedger` whose `source` field appears in the input
   packet's `provenance.feedSources[]`. If a number appears in prose without
   a ledger backing → soft warning, append to `unsupportedClaims`.

3. **Phase Kernel non-citation rule:** Pitch MUST NOT cite metrics from
   internal Phase Kernel (e.g., "phase score 0.83") as proven without
   external validation. The existing `INTERNAL_LANGUAGE_PATTERNS` scanner
   already covers `phase` and `recursive` terms — confirm this is sufficient.

4. **Agency-current rule (informational):**
   `antiOverclaim.agencyRequirementsCurrentAsOf` is operator-provided. If
   `null`, response includes `guards.agencyGuidanceVerified: false`.

---

## F. PATENT LANE INVARIANTS

### F.1 What MUST NOT change in expand-artifact.js for patents

| Element | Invariant |
|---|---|
| `SYSTEM_PROMPT` (current single string) | When refactored to `_systemPromptForLane('patents')`, the returned string MUST be byte-identical to the current SYSTEM_PROMPT. |
| Patent JSON schema structure | `inventionTitle`, `field`, `background`, `problemStatement`, `technicalSolution`, `systemComponents`, `methodSteps`, `dataInputs`, `outputs`, `potentialEmbodiments`, `provisionalClaimSketches`, `priorArtSearchPlan`, `evidenceLedger`, `missingInformation`, `humanReviewChecklist` — all preserved verbatim. |
| `_verifyExpansion` patent path | `noveltyClaimed`, `patentabilityClaimed`, `filingReady`, `requiresHumanPatentReview` flag checks unchanged. |
| `_verifyFeedGroundedLanguage` | Reused for patent lane unchanged. |
| `PROHIBITED_PATTERNS` array | Existing 7 patterns preserved. New grant patterns added; must be regex-tested to confirm zero unintended matches in canonical patent prose. |
| `INTERNAL_LANGUAGE_PATTERNS` array | Unchanged. |
| Identity override | Unchanged. |
| Response envelope | Unchanged (`ok`, `schemaVersion: 'D3-B.api.v1'`, `lane`, etc.). |

### F.2 What MUST NOT change in critique-artifact.js for patents

| Element | Invariant |
|---|---|
| `SYSTEM_PROMPT` patent path | Byte-identical when accessed via `_systemPromptForLane('patents')`. |
| `_verifyCritique` patent invariants | All 6 hard checks (status/notDraft/didNot*) unchanged. |
| `_deriveObjectionLedger` | **No modification at all** — D3-C.1 already lane-agnostic. |
| `_buildObjectionSummary` | Unchanged. |
| Critique schema fields | Unchanged. |

### F.3 Patent-lane RUNS regression test plan

Run BEFORE each D3-E commit (manual via DevTools or curl):

1. **Reachability:** `GET /api/expand-artifact` → 405. `GET /api/critique-artifact` → 405.
2. **Validation gates:** POST empty body → 400 MISSING_ARTIFACT_PACKET.
   POST with `lane: 'business-grants'` → 400 UNSUPPORTED_LANE (was strict
   patents-only; after D3-E.0 it should still be 400 since
   `'business-grants'` is not in the new SUPPORTED_LANES set).
3. **Patent expansion regression:** POST same Energy patent packet used in
   prior browser tests, confirm:
   - 200 response (or 501 if env unconfigured — same fail-safe behavior)
   - `expansion.lane === 'patents'`
   - `expansion.schemaVersion === 'D3-B.patent.v1'`
   - `expansion.draft.inventionTitle` exists
   - `expansion.draft.priorArtSearchPlan` exists
   - `expansion.antiOverclaim.requiresHumanPatentReview === true`
   - `guards.patentabilityNotClaimed === true`
4. **Patent critique regression:** POST same Energy patent packet to
   critique endpoint:
   - 200 response (or 501)
   - `critique.objectionLedger` has entries with same shape
   - `critique.objectionSummary` has 6 fields
   - `guards.objectionLedgerPresent === true`
5. **D3-C.1 ledger regression:** confirm OBJ-001 still bears the highest
   severity, ledger length ≤ 20, all entries have all 9 required fields.

If any of these regressions fail → revert D3-E patch immediately.

---

## G. RISK ASSESSMENT

### G.1 What could break the patents lane

| Risk | Mitigation |
|---|---|
| Shared helpers (e.g., `_verifyExpansion`) accidentally lane-coupled | Lane-branch via `if (lane === 'patents')` / `else if (lane === 'nsf-project-pitch')`; never delete or modify the patent branch. |
| New anti-overclaim regex accidentally matches patent prose | Run new patterns against historical patent draft outputs (browser-confirmed) before deploy; if match, refine or scope by lane. |
| Conflating `research-grants` and `nsf-project-pitch` packets at endpoint | Explicit decision documented above: endpoint accepts `research-grants` as upstream when caller explicitly requests `lane: 'nsf-project-pitch'`; otherwise lanes are distinct. |
| `INTERNAL_LANGUAGE_PATTERNS` over-triggering on legitimate grant terminology | Audit shows these patterns are LIMEN-internal, not grant-domain. Low risk; verify by running a sample NSF prose through the scanner. |
| Future Vercel deployment auto-redeploys partial state | The deploy is per-commit, atomic per file. Splitting D3-E into D3-E.0 (registry only), D3-E.1 (expand), D3-E.2 (critique) limits per-deploy blast radius. |

### G.2 Recommended deterministic tests before each D3-E commit

For D3-E.0:
- `node --check assets/js/civilization/artifact-packet-builder.js`
- Synthetic in-browser test: `LIMENArtifactPacketBuilder.buildAll().filter(p => p.identity.lane === 'patents').length` matches pre-patch number.

For D3-E.1:
- `node --check api/expand-artifact.js`
- Run regression suite §F.3 items 1-3 against deployed endpoint.
- Add: POST with `lane: 'nsf-project-pitch'` and a research-grants packet
  → 501 if env unconfigured, 200 with NSF schema if configured.

For D3-E.2:
- `node --check api/critique-artifact.js`
- Run regression suite §F.3 items 1, 4, 5.
- Add: POST critique with `lane: 'nsf-project-pitch'` → critique schema
  shape unchanged but lane-tag differs.

### G.3 Patent vs grant schema divergence map

| Schema element | Patent | NSF Project Pitch |
|---|---|---|
| Title field | `inventionTitle` | `pitchTitle` |
| Domain context | `field` | `companyOverview` |
| Problem | `problemStatement` | `technicalProblem` |
| Solution | `technicalSolution` | `proposedInnovation` + `technicalMerit` |
| System decomposition | `systemComponents`, `methodSteps`, `dataInputs`, `outputs`, `potentialEmbodiments` | `researchPlan`, `milestones` |
| IP-specific | `provisionalClaimSketches`, `priorArtSearchPlan` | (none) |
| Grant-specific | (none) | `marketOpportunity`, `commercialPathway`, `teamCapability`, `broaderImpacts`, `budgetRationale` |
| Anti-overclaim flags | `noveltyClaimed`, `patentabilityClaimed`, `filingReady`, `requiresHumanPatentReview` | `awardGuaranteed`, `preApproved`, `submissionReady`, `requiresHumanGrantReview`, `agencyRequirementsCurrentAsOf` |
| Reused | `evidenceLedger`, `missingInformation`, `humanReviewChecklist`, `unsupportedClaims` | (same) |

### G.4 Branching strategy recommendation

**Recommend: in-place edits with lane-branched logic.** Reasons:
- D3-B/B.1/C.0/C.1 history shows the project favors single-file endpoints
  with internal branching over shared-helper extraction.
- Helpers are already lane-agnostic where possible; lane-specific differences
  are localized to system prompts and `_verifyExpansion`/`_verifyCritique`
  flag-name lists.
- Extracting a shared `expand-helpers.js` module is a separate refactor
  patch (D3-E.4 if ever needed), should not block D3-E.1.

**Avoid:** copying expand-artifact.js to expand-nsf-artifact.js. That doubles
maintenance and fragments the council pipeline.

---

## H. NOT-IN-SCOPE FOR D3-E

| Out-of-scope item | Reason | Future patch |
|---|---|---|
| NIH SBIR Phase I Specific Aims | Different agency, different schema, different reviewer rubric | D3-F |
| DOE SBIR Letter of Intent | Different format, different agency | D3-G |
| Templeton concept papers | Different audience, mission-driven framing | D3-H |
| ARPA-H pitch | Health-specific, different format | D3-I |
| DARPA SaToN bid | Defense procurement, different process | D3-J |
| SAM.gov sole-source capability statements | Procurement, not grant | D3-K |
| Auto-submission to grants.gov / NSF FastLane / Research.gov | Operator-decision boundary | NEVER (auto-action ban) |
| Auto-submission to NIH ASSIST | Same as above | NEVER |
| Persistence layer (council state in Redis) | Vertical complexity not yet warranted | D3-L (orchestrator) |
| UI changes (modal, tabs, dots) | D3-E is endpoint-only | D3-M |
| Orchestration layer (D3-B → D3-C → D3-E iteration loops) | Each lane should ship independently first | D3-N |
| Multi-AI council for grants | Patent council is the reference; replicate AFTER patents fully RUNS | D3-O |
| Cost dashboards | Premature optimization | D3-P |
| Multi-provider fallback (e.g., Anthropic for grants) | Architectural drift | NEVER |

---

## I. RECOMMENDED IMPLEMENTATION SEQUENCE

### I.1 Phase 1 — Outbound research (REQUIRES USER AUTHORIZATION)

**Before D3-E.1 patch:** verify NSF SBIR Project Pitch current schema from
NSF.gov authoritative source. Capture:
- Current 4-section structure (Technology Innovation, Technical Objectives
  and Challenges, Market Opportunity, Company and Team) or whatever the
  current structure is.
- Current word/character limits.
- Current submission portal (Research.gov vs FastLane vs ASSIST).
- Current evaluation criteria document.
- Any 2025-2026 schema changes from prior years.

Operator captures this in a new `docs/D3-E-NSF-RESEARCH.md` or similar.
Use that document as the authoritative source for the system prompt.

### I.2 Phase 2 — D3-E.0 lane registry expansion

**Smallest first patch.** Can ship before outbound research is complete
because it doesn't yet generate NSF artifacts — just registers the lane
string.

- Single file: `artifact-packet-builder.js`
- ~4 lines changed
- Patent lane unaffected
- Risk: negligible

After deploy: confirm via DevTools that `LIMENArtifactPacketBuilder.buildAll()`
runs cleanly. Lane registry doesn't change packet emission count (no brain
emits `nsf-project-pitch` yet).

### I.3 Phase 3 — D3-E.1 expand-artifact NSF support

**Requires Phase 1 complete.** Authors NSF system prompt from verified
schema.

- Single file: `expand-artifact.js`
- ~250 lines changed (mostly NSF prompt block)
- Patent lane regression-tested per §F.3
- Risk: medium

After deploy: POST research-grants packet with `lane: 'nsf-project-pitch'`,
verify 501 (if env unconfigured) or 200 with NSF schema (if configured).
Verify patent packet still returns patent schema unchanged.

### I.4 Phase 4 — D3-E.2 critique-artifact NSF support

**Can ship before or after D3-E.1.** D3-C.0/C.1 critique pipeline is
lane-agnostic; D3-E.2 adds NSF-flavored prompt focus.

- Single file: `critique-artifact.js`
- ~150 lines changed
- D3-C.1 ledger reused unchanged
- Risk: low

### I.5 Phase 5 — Browser verification suite

After all three patches deploy:
- Energy patents-lane regression (must be RUNS, byte-identical to pre-D3-E)
- Energy/medicine/research research-grants packet → NSF Project Pitch
  expansion (RUNS or CALLABLE depending on env)
- Critique of NSF expansion (RUNS or CALLABLE)
- D3-C.1 objection ledger derived from NSF critique (should be lane-agnostic,
  same shape as patent ledger)

### I.6 Suggested first concrete patch

**D3-E.0 — pure scaffolding to register the lane.**

```diff
   var LANE_TO_PATH = {
     'patents':         'PATENTABLE',
     'copyrights':      'PATENTABLE',
     'business-grants': 'GRANT-ELIGIBLE',
     'research-grants': 'GRANT-ELIGIBLE',
+    'nsf-project-pitch': 'GRANT-ELIGIBLE',
     'sba-loans':       'INVESTABLE',
     'investments':     'INVESTABLE',
     'research-papers': null
   };
```

```diff
   var FORBIDDEN_FOR_LANE = {
     'patents':         ['valueRange', 'companies', 'whyPays', 'compensation'],
     'business-grants': ['valueRange', 'compensation.base'],
     'research-grants': ['valueRange', 'compensation.base'],
+    'nsf-project-pitch': ['valueRange', 'compensation.base'],
     ...
   };
```

Two small additions. No brain code change. No endpoint change. No prompt
change. Lowest possible risk to patents lane (zero — patents lookup is
unaffected).

This patch is safe to author and commit without outbound research because
it doesn't yet generate NSF artifacts. It only registers the lane string so
that future patches have a stable target.

---

## Summary

- **Patent council pipeline RUNS.** D3-A4.5 → D3-B → D3-B.1 → D3-C.0 → D3-C.1
  all live; runtime verified.
- **D3-E adds NSF SBIR Project Pitch as a sibling lane**, structurally
  parallel to patents but with grant-specific schema and anti-overclaim
  flags.
- **`research-grants` lane is real** (36 ready packets) and serves as the
  upstream source category. `nsf-project-pitch` is the downstream artifact
  lane fed from research-grants packets via endpoint translation.
- **D3-C.1 objection ledger is lane-agnostic** — reused unchanged for grants.
- **Patent lane invariants documented** (§F). Regression tests defined
  before each D3-E commit.
- **NSF schema research is NEEDED-OUTBOUND** before D3-E.1 patch
  authorization.
- **D3-E.0 (smallest) can ship without outbound research** — pure lane
  registry expansion.

**No code changes have been made for D3-E.** This document is the deliverable.

**END OF D3-E PLAN**
