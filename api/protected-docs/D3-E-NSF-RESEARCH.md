# D3-E NSF Project Pitch — Outbound Research

**Research date:** 2026-04-30
**Researcher:** Claude (Opus 4.7, 1M context) under operator authorization
**Scope:** Outbound calls to NSF official sources (`seedfund.nsf.gov` and `www.nsf.gov`) only
**Authorization:** Operator (chrishubbel72@gmail.com) explicitly authorized this research session
**Background:** NSF was reauthorized 2026-04-13 (17 days prior to this research). Site structure changed materially post-reauth. Training-data fallback is forbidden — every fact below is either VERIFIED-BY-CURRENT-NSF-SOURCE (with URL + access timestamp) or marked UNKNOWN.

---

## 1. Executive Summary

NSF Seed Fund (SBIR/STTR Phase I "Project Pitch") is a non-dilutive grant program. Phase I awards average $295,822 (range ~$154,646 to $305,000) for 6–18 months of R&D. Phase II awards are up to $1,250,000 over 24 months, with potential supplements. NSF funds approximately 400 startups per year totalling $200M+. The program is currently **paused for new Project Pitch submissions** — homepage banner (last updated 4/16/2026) states submissions will resume "in the coming weeks."

A Project Pitch is a 4-section, ~10,500-character pre-application. NSF responds in 1–2 months with either an invitation to submit a full proposal or a decline-with-reason. Eligibility excludes companies majority-owned by VC/PE/hedge fund coalitions and companies with <50% US-citizen/permanent-resident equity. The PI must be employed ≥20 hours/week by the submitting company and devote ≥1 month (173 hours) per 6-month period to the project.

For LIMEN's purposes: **NSF Project Pitch is materially different from the SBA / business-grant lanes already wired**. Section structure is fixed and tight (3500/3500/1750/1750), evaluation is technical-merit-and-commercial-potential weighted, and the "Technology Innovation" + "Technical Objectives and Challenges" sections demand engineering-grade specificity that the patent lane already produces. Reusing patent-lane evidence as the substrate is plausible.

---

## 2. Source Verification Log

| URL | Status | Access timestamp | Page title | Page-level "last updated" |
|---|---|---|---|---|
| `https://seedfund.nsf.gov/` | 200 | 2026-04-30 | "America's Seed Fund – NSF SBIR/STTR" | 4/16/2026 (alert banner) |
| `https://seedfund.nsf.gov/project-pitch/` | 200 | 2026-04-30 | "Project Pitch \| NSF SBIR" | not stated |
| `https://seedfund.nsf.gov/apply/get-started/` | 200 | 2026-04-30 | "How It Works - Get Started \| NSF SBIR" | not stated |
| `https://seedfund.nsf.gov/our-program/` | 200 | 2026-04-30 | "About NSF SBIR/STTR – Startup Funding \| NSF SBIR" | not stated |
| `https://seedfund.nsf.gov/awardees/phase-1/` | 200 | 2026-04-30 | "Awardees phase 1 \| NSF SBIR" | 4/16/2026 (alert banner) |
| `https://seedfund.nsf.gov/our-program/sttr/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/our-program/sbir/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/our-program/eligibility/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/our-program/what-we-fund/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/eligibility/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/sbir-vs-sttr/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/how-it-works/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/awards/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/awards/phase-i/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/faqs/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/faq/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/assess/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/topics/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/apply/proposal/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/apply/project-pitch/eval-criteria/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/apply/project-pitch/template/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/apply/project-pitch/instructions/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/resources/` | 404 | 2026-04-30 | — | — |
| `https://seedfund.nsf.gov/awardees/` | 302 → `/awardees/phase-1/` | 2026-04-30 | "Redirecting…" | — |
| `https://www.nsf.gov/funding/sbir.jsp` | 404 | 2026-04-30 | — | — |

**Observation:** The site has been substantially restructured since reauthorization. Many canonical paths (eligibility, FAQ, evaluation criteria, topics, STTR-specific page) returned 404 during this research. Five core pages were captured.

---

## 3. Program Overview — VERIFIED

### 3.1 Award amounts and durations

> "Up to $305,000 in non-dilutive funding for research and development (R&D)" for Phase I, "six to 18 months."
> — `seedfund.nsf.gov/our-program/` (accessed 2026-04-30)

> "Up to $1,250,000 over the course of 24 months" for Phase II, with "potential supplements" of "up to more than $500,000."
> — `seedfund.nsf.gov/our-program/` (accessed 2026-04-30)

> "Up to $2M / 42+ months" total Phase I + Phase II + supplements.
> — `seedfund.nsf.gov/our-program/` (accessed 2026-04-30)

### 3.2 Phase I distribution (empirical)

> "$295,822 Average amount of funding awarded for each company"
> Individual awards range "approximately $154,646 to $305,000."
> — `seedfund.nsf.gov/awardees/phase-1/` (accessed 2026-04-30)

**Implication:** The headline "$305K" is a **ceiling**, not the typical award. Median company can plan for ~$295K.

### 3.3 Annual program scale

> "$200+ million in research and development (R&D) funding to about 400 startups" annually.
> — `seedfund.nsf.gov/our-program/` (accessed 2026-04-30)

### 3.4 Equity and IP terms

> "0% equity" is taken in awards (non-dilutive grant).
> — `seedfund.nsf.gov/our-program/` (accessed 2026-04-30)

### 3.5 Submission status (current)

> "NSF will resume the submission of new Project Pitches to the SBIR/STTR programs in the coming weeks."
> — `seedfund.nsf.gov/` alert banner, last updated 4/16/2026 (accessed 2026-04-30)

**Implication:** As of 2026-04-30, NSF Project Pitch is **paused for new submissions**. LIMEN cannot submit today; the lane should be built but generation should be gated until NSF reopens. Suggest a runtime check for the banner or operator confirmation.

---

## 4. Eligibility Requirements — VERIFIED

From `seedfund.nsf.gov/apply/get-started/` (accessed 2026-04-30):

### 4.1 Company-level

- "<500 employees"
- "US-based"
- "All funded work in the US"
- "≥50% equity owned by US citizens/permanent residents"
- "NSF doesn't fund companies majority-owned by multiple VC/PE/hedge funds"

### 4.2 Principal Investigator (PI)

- "Legally employed ≥20 hr/week by company"
- "No advanced degree required"
- "≥1 month (173 hours) per 6 months on project"

### 4.3 Application steps

> Pitch Assessment → Submit Pitch → Submit Proposal → Review.
> — `seedfund.nsf.gov/apply/get-started/` (accessed 2026-04-30)

### 4.4 Decision turnaround

- "Pitch decision 1-2 months"
- "Full proposal review ~6 months"

---

## 5. Project Pitch Structure — VERIFIED

From `seedfund.nsf.gov/project-pitch/` (accessed 2026-04-30):

| Section | Character limit | Purpose (verbatim from NSF) |
|---|---|---|
| Technology Innovation | 3500 | (described on NSF page; full instruction text was not captured because `/apply/project-pitch/instructions/` 404'd) |
| Technical Objectives and Challenges | 3500 | (same as above) |
| Market Opportunity | 1750 | (same as above) |
| Company and Team | 1750 | (same as above) |

**Total:** 10,500 characters across 4 sections.

### 5.1 Submission constraint

> "Each small business can only submit one Project Pitch at a time."
> — `seedfund.nsf.gov/project-pitch/` (accessed 2026-04-30)

### 5.2 Outcome paths

> If invited: receives "official invitation to submit full proposal."
> If declined: told "why not appropriate."
> — `seedfund.nsf.gov/project-pitch/` (accessed 2026-04-30)

**Implication for LIMEN:** Section character budgets are tight. The Technology Innovation + Technical Objectives sections (7000 chars combined) are the engineering-evidence sections — these can be substrate-bound to patent-lane evidence. The Market Opportunity + Company and Team sections (3500 chars combined) are commercial / personnel sections — these need a separate evidence path that LIMEN's current engines do not produce.

---

## 6. Topic Areas — VERIFIED (26 topics)

From `seedfund.nsf.gov/awardees/phase-1/` (accessed 2026-04-30), Phase I awardees span the following 26 topic areas:

1. Advanced Manufacturing
2. Advanced Materials
3. Advanced Systems for Scalable Analytics
4. Artificial Intelligence
5. Augmented Virtual and Mixed Reality
6. Biological Technologies
7. Biomedical Technologies
8. Chemical Technologies
9. Cybersecurity and Authentication
10. Digital Health
11. Energy Technologies
12. Environmental Technologies
13. Human-Computer Interaction
14. Instrumentation and Hardware Systems
15. Internet of Things
16. Learning and Cognition Technologies
17. Medical Devices
18. Mobility
19. Pharmaceutical Technologies
20. Photonics
21. Power Management
22. Quantum Information Technologies
23. Robotics
24. Semiconductors
25. Space
26. Wireless Technologies

**LIMEN domain mapping (provisional, operator to confirm):** Civilization domains map plausibly into Topic 4 (AI), Topic 11 (Energy), Topic 12 (Environmental), Topic 16 (Learning and Cognition), and Topic 9 (Cybersecurity). Map-matrix extension required before generation.

**Recent awardee data point** (from awardees page):
> Companies including "Electroflow Technologies (awarded 08/22/2025), Fluent Metal Inc. (awarded 08/27/2025), and Leonine Technologies Inc. (awarded 09/11/2025)" appear in the listing.
> — `seedfund.nsf.gov/awardees/phase-1/` (accessed 2026-04-30)

---

## 7. Evaluation Criteria — PARTIAL

NSF homepage `seedfund.nsf.gov/` (accessed 2026-04-30) describes the program in terms of "innovativeness, commercial potential, and possible societal impact" — these surface in the program description, not in a dedicated evaluation-criteria page. The dedicated eval-criteria page (`/apply/project-pitch/eval-criteria/`) returned 404.

### Treat as PARTIAL signal, not a full rubric

- **Innovativeness** — verified mention, no rubric weight
- **Commercial potential** — verified mention, no rubric weight
- **Possible societal impact** — verified mention, no rubric weight

**UNKNOWN:** weighting between these three; rubric scoring; reviewer instructions; pass/fail thresholds; rejection-reason taxonomy.

---

## 8. STTR-Specific Considerations — UNKNOWN

The dedicated STTR pages (`/our-program/sttr/`, `/sbir-vs-sttr/`) returned 404. The FAQ page returned 404. No STTR-specific information was captured in this research session.

**UNKNOWN items needing further verification before LIMEN's STTR lane can ship:**

- Required research-institution partner type (university / nonprofit / federal lab / specific list)
- Required R&D split percentages between small business and research institution
- PI employment exception under STTR (if any — SBIR requires ≥20 hr/week at the small business; STTR is reportedly more permissive)
- Whether 501(c)(3) entities can be the **research institution** partner (relevant: LIMEN's chapel)
- Whether STTR Project Pitch uses the same 4-section structure or a variant

**Operator note:** D3-E.0 lane registration is named `nsf-project-pitch` (singular). If STTR-specific differences emerge, a parallel lane `nsf-sttr-project-pitch` may be warranted. For now, assume **SBIR-only** until STTR specifics are verified.

---

## 9. What NSF Will NOT Fund — UNKNOWN

The "what we fund" / "what we don't fund" pages (`/our-program/what-we-fund/`) returned 404. The FAQ page returned 404. No verbatim exclusion language was captured.

**UNKNOWN exclusions** (cannot list without source):
- Whether basic / theoretical research is excluded (or only "demonstration" projects are)
- Whether market research, business-plan development, or commercialization-only work is excluded
- Whether pre-clinical / regulatory work (FDA submissions, clinical trials) is excluded
- Whether duplicative-of-other-federal-funding work is excluded

**Implication for anti-overclaim:** The artifact builder's `FORBIDDEN_FOR_LANE` for `nsf-project-pitch` was set to `['valueRange', 'compensation.base']` in D3-E.0. That list may need expansion once exclusion rules are verified — for example, if NSF excludes "demonstration of existing technology," any LIMEN packet whose `evidence.priorArt` indicates the technology is fully demonstrated in production should be rejected from this lane.

---

## 10. Open Questions (Items still UNKNOWN after this research)

| # | Question | Why it matters | Suggested next step |
|---|---|---|---|
| 1 | STTR R&D split percentages | Determines whether LIMEN+chapel can partner under STTR | Operator outreach to NSF program officer; or wait for `/our-program/sttr/` to be republished |
| 2 | Detailed evaluation rubric / weights | Drives the AI council's `weakestLinks` and `overclaimRisks` heuristics for this lane | Check Solicitation document when FY2026 solicitation is posted |
| 3 | Out-of-scope language ("we do not fund X") | `FORBIDDEN_FOR_LANE` may need to expand | Re-attempt `/our-program/what-we-fund/` weekly; check FY2026 solicitation |
| 4 | Current FY2026 solicitation number | Required for any submitted packet to cite | Check NSF.gov solicitation database |
| 5 | When NSF reopens Project Pitch submissions | Determines when LIMEN can actually submit | Re-fetch `seedfund.nsf.gov/` alert banner weekly |
| 6 | Lab Notes / supplementary materials format | Optional supporting evidence channel | Attempt `/resources/` later; check submission portal once reopened |
| 7 | Whether 501(c)(3) chapel can partner under STTR | Determines whether religion / contemplative domain has a path | Same as #1 |
| 8 | Project Pitch instructions (per-section verbatim guidance) | Drives prompt construction for the AI council | Re-attempt `/apply/project-pitch/instructions/` later |
| 9 | Common decline reasons | Direct input to objection-ledger heuristics | FAQ page (currently 404); or pull from public reviewer commentary if available |
| 10 | Topic-to-directorate mapping | Some topics route to specific NSF directorates with different reviewers | Check FY2026 solicitation document |

---

## 11. Anti-Overclaim Classification

This section classifies every claim in this document by source-strength, so downstream consumers (including the LIMEN packet builder, the AI council, and any human reviewer) can apply the correct weight.

### 11.1 VERIFIED-BY-CURRENT-NSF-SOURCE (safe to cite in packets)

- Phase I award ceiling: **up to $305,000** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Phase I average: **$295,822** — `seedfund.nsf.gov/awardees/phase-1/` accessed 2026-04-30
- Phase I duration: **6–18 months** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Phase II ceiling: **up to $1,250,000** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Phase II duration: **24 months** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Annual investment: **$200+ million** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Annual awardee count: **~400 startups** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Equity terms: **0% equity** — `seedfund.nsf.gov/our-program/` accessed 2026-04-30
- Eligibility floor: **<500 employees, US-based, ≥50% US-citizen/permanent-resident equity** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- VC/PE/hedge fund exclusion: **applies to multiple-fund-coalition majority** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- PI employment minimum: **≥20 hr/week** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- PI project minimum: **≥1 month (173 hours) per 6 months** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- Project Pitch sections: **4 sections (3500/3500/1750/1750 chars)** — `seedfund.nsf.gov/project-pitch/` accessed 2026-04-30
- One-Pitch-at-a-time rule — `seedfund.nsf.gov/project-pitch/` accessed 2026-04-30
- Pitch decision: **1–2 months** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- Full proposal review: **~6 months** — `seedfund.nsf.gov/apply/get-started/` accessed 2026-04-30
- Submissions paused as of **2026-04-16** — `seedfund.nsf.gov/` alert banner accessed 2026-04-30
- 26-topic technology list — `seedfund.nsf.gov/awardees/phase-1/` accessed 2026-04-30

### 11.2 PARTIAL — verified mention, no rubric

- Evaluation criteria: "innovativeness, commercial potential, possible societal impact" — `seedfund.nsf.gov/` accessed 2026-04-30. **Source mentions these criteria but does not provide weights, scoring rubric, or reviewer guidance.** Use as **directional signal only** — do not synthesize a rubric from this.

### 11.3 UNKNOWN — DO NOT FILL FROM TRAINING DATA

The following NSF-related facts are **not verified** by any source captured in this research session. They must NOT be filled in from training data, must NOT be cited in any LIMEN packet, and must NOT be passed to the AI council as facts:

- STTR R&D split percentages
- STTR PI employment rules (if different from SBIR)
- STTR partnership-eligible institutions
- Detailed evaluation rubric and weights
- Out-of-scope language / explicit exclusions
- Current FY2026 solicitation number
- Project Pitch per-section verbatim instructions
- Submission portal mechanics
- Lab Notes / supplementary material format
- Topic-to-directorate routing
- Common decline-reason taxonomy

If the AI council attempts to reference any of these in generated output, the deterministic verifier in `_deriveObjectionLedger` should flag the claim under `unsupportedClaims` or `sourceFreshnessConcerns`.

### 11.4 Verifier-side recommendation

`api/critique-artifact.js`'s `_deriveObjectionLedger` (D3-C.1) currently produces lane-agnostic objections. For NSF, recommend an additional rule: **any output that asserts an evaluation rubric, scoring weight, exclusion category, STTR-specific rule, or solicitation number SHALL be flagged as `unsupportedClaims`** unless the assertion can be matched against a snippet whose `sourceUrl` host equals `seedfund.nsf.gov` or `www.nsf.gov` and whose access timestamp is ≤30 days old.

This rule is **derivable** from the 11.3 list above and is a candidate for a follow-on D3-E.x patch — out of scope for this research document.

---

## Appendix A — Lane Registration Status

D3-E.0 (committed) registered `nsf-project-pitch` in `assets/js/civilization/artifact-packet-builder.js`:

```js
'nsf-project-pitch': 'GRANT-ELIGIBLE'
```

D3-E.0 also added `['valueRange', 'compensation.base']` to `FORBIDDEN_FOR_LANE` for this lane. Per Section 9 of this document, that list may need expansion once NSF exclusion rules are verified.

D3-E.0.1 (committed) added explicit request-lane gates in both `api/expand-artifact.js` and `api/critique-artifact.js` (both lanes-of-record remain `'patents'`). No NSF-specific endpoint exists yet.

## Appendix B — Recommended Implementation Sequence (NOT for this PR)

The following sequence is implied by the research findings but is **out of scope for this document**. Operator decision required before any of these proceed:

1. **D3-E.1** — Add NSF anti-overclaim verifier rules (Section 11.4 above) to `_deriveObjectionLedger`. Lane-aware extension of the lane-agnostic helper.
2. **D3-E.2** — Define per-section character budgets and validate at packet-build time so generated output cannot exceed NSF section limits.
3. **D3-E.3** — Build `api/expand-artifact-nsf.js` (or extend the existing endpoint with lane routing). Fixed 4-section template. Substrate must come from patent-lane evidence + a new "company/team" evidence path.
4. **D3-E.4** — Build `api/critique-artifact-nsf.js` (or extend) with NSF-specific objection rules.
5. **D3-E.5** — Runtime gate: do not generate NSF artifacts while `seedfund.nsf.gov/` alert banner indicates submissions are paused.

Each of the above requires its own scope-clean patch with operator authorization.

---

**End of D3-E NSF Project Pitch outbound research document.**
**No code changes were made. No commits, no stages, no patches.**
