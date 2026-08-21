/**
 * LIMEN Helix — Claude artifact drafter (REAL-FORMAT, evidence-only)
 *
 * POST /api/expand-artifact-claude
 *
 * Drafts READY-TO-SIGN artifacts in real regulatory / financial format
 * for six lanes:
 *   - patent     (US utility patent application, 37 CFR 1.71–1.78)
 *   - grant      (NIH SF-424 R&R / NSF / USDA NIFA AFRI / DOE SC FOA)
 *   - sba        (SBA 7(a) borrower package per SOP 50 10 + Form 1919)
 *   - franchise  (FTC Franchise Rule FDD Items 1–23 + state registration)
 *   - investment (Investment thesis with risk envelope; Alpaca paper-first)
 *   - research   (NIH/NSF-shaped research paper draft + routability)
 *
 * Hard rules enforced via system prompt:
 *   1. NO internal LIMEN vocabulary in output (no "stress", "domain",
 *      "kernel", "civilization", "polyvagal", "limen", "helix", website
 *      URLs, or any module/operator name).
 *   2. Citations ONLY from contextPacket.evidence.citations[]. If none
 *      supplied for a claim, emit `[CITATION_NEEDED: <topic>]`.
 *   3. News references ONLY from contextPacket.evidence.news[] (each
 *      carries date + source + url + headline). Otherwise emit
 *      `[NEWS_NEEDED: <event>]`.
 *   4. No company-specific numbers unless supplied in contextPacket
 *      (revenue, EBITDA, headcount, etc.); use `[DATA_NEEDED: <field>]`.
 *   5. No hedging language ("may potentially", "various studies suggest",
 *      "experts agree"). Every claim points to specific evidence or
 *      a placeholder.
 *   6. No section repeats another section's content. Each section answers
 *      a different prosecutorial / reviewer question.
 *   7. Plain industry language only — no internal taxonomy leaks.
 *
 * Env: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (default claude-sonnet-4-6).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ANTHROPIC_MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '16000', 10);
// Dense 16K-token research/investment drafts have exceeded four minutes in
// production. The function budget is 800s; allow the provider up to 600s and
// leave the caller time to persist and audit the result.
const ANTHROPIC_TIMEOUT_MS = parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '600000', 10);
const ANTHROPIC_VERSION = '2023-06-01';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Internal vocabulary that must NEVER appear in artifact output.
// Used both in the system prompt and as a post-generation linter.
const BANNED_TERMS = [
  'limen', 'helix', 'limenhelix', 'limenhelix.com',
  'kernel', 'kernel phase', 'kernel state', 'kernel snapshot',
  'polyvagal', 'thing 1', 'thing 2', 'thing1', 'thing2',
  'civilization brain', 'connectome brain', 'master brain',
  'master living brain', 'super-brain', 'super brain',
  'domain brain', 'sub-brain', 'fractal brain', 'fractal recursive',
  'pattern envelope', 'pattern broker', 'pattern signature',
  'dominant phase', 'phase confidence', 'phase vector',
  'phase tracking', 'phase logic', 'salience score',
  'commercialization status', 'engine output endpoint',
  'opportunity signal', 'cross-domain audit', 'handoff packet',
  // generic hedge words that produce slop
  'various studies', 'many studies', 'numerous studies',
  'experts agree', 'industry leaders agree', 'growing body of',
  'recent research suggests', 'studies suggest',
  'a number of researchers'
];

// Per-lane MINIMUM word count targets based on empirical research of
// real practitioner-filed documents (sources: USPTO MPEP, 37 CFR 1.72,
// Crouch 2026 patent-document study (7.6M apps, ~13K-word spec mean),
// NIH Page Limits + SF424(R&R) Application Guide, NSF PAPPG 24-1 Ch.II,
// NIFA AFRI FY26 RFA, DOE-OS DE-FOA-0003432, SBA SOP 50 10 Version 8 (effective June 1, 2025),
// FTC 16 CFR 436.5 + NASAA 2008 UFOC Guidelines, Carta IC-memo guide).
// These are the LOWER bound of what an actual practitioner would file —
// not the median. Below these, the artifact is a sketch.
//
// IMPORTANT: lanes flagged multiPassRequired:true exceed what fits in
// a single 16K-token Claude call. The runner should chain passes
// (section-by-section) and stitch the results.
// Per-lane LANE_SECTIONS catalog — drives multi-pass generation.
// Each section is one Claude call. Target sums to the lane minimum.
// The client (multi-pass-runner.js) iterates sections in order and
// passes {sectionIndex, sectionId} to this endpoint.
const LANE_SECTIONS = {
  // Patent budgets bumped after first multi-pass test on Walmart came
  // in at 12,019 words (below 14K minimum). All sections came in over
  // target but the SUM trails because P3/P4 (detailed description) carry
  // the bulk of patent prose runway. Raised by ~30% on P1+P3+P4+P5.
  patent: [
    { id: 'P1_FRONT_MATTER',     name: 'Title + Cross-Reference + Federal R&D Statement + Joint Research + Sequence Listing + Background of the Invention (Field of Invention + extensive Description of Related Art with named prior art differentiated)',                              targetTokens: 4500 },
    { id: 'P2_SUMMARY_DRAWINGS', name: 'Brief Summary of the Invention + Brief Description of the Drawings (figure-by-figure annotation)',                                                                                                                                                  targetTokens: 1500 },
    { id: 'P3_DETAILED_DESC_A',  name: 'Detailed Description of the Invention — Part 1 (preferred embodiment, figures 1–3, primary structural and operational disclosure, reference numerals throughout, enabling teaching for person of ordinary skill)',                                   targetTokens: 7500 },
    { id: 'P4_DETAILED_DESC_B',  name: 'Detailed Description of the Invention — Part 2 (alternative embodiments, figures 4–N, variants, worked examples, edge cases, advantages over prior art)',                                                                                            targetTokens: 7500 },
    { id: 'P5_CLAIMS',           name: 'Claims (3 independent claims minimum + 15–20 dependent claims, 37 CFR 1.75 format, single-sentence per claim, "What is claimed is:" header, comprehensive coverage of inventive concept)',                                                          targetTokens: 3500 },
    { id: 'P6_ABSTRACT',         name: 'Abstract of the Disclosure (37 CFR 1.72(b), MAX 150 words, on separate page)',                                                                                                                                                                       targetTokens: 250  }
  ],
  // R01-style grant section catalog — for SCALING and MATURE applicants
  // with established programs of research. Sized to the NIH R01 ~18,000-
  // word floor + NSF PAPPG generic large-research format.
  grant: [
    { id: 'G1_SUMMARY_NARRATIVE', name: 'Project Title + Project Summary/Abstract (30 lines, plain text, NIH G.220) + Project Narrative (2–3 sentences public-health relevance, NIH G.220)',     targetTokens: 800   },
    { id: 'G2_SPECIFIC_AIMS',     name: 'Specific Aims (1 page hard limit, opens with long-term goal + objective + central hypothesis, lists 3 named aims with one-paragraph rationale each)',  targetTokens: 1200  },
    { id: 'G3_RS_SIGNIFICANCE',   name: 'Research Strategy — A. Significance (why this problem matters; cite specific evidence; quantify burden with numbers or [DATA_NEEDED] placeholders)',     targetTokens: 3000  },
    { id: 'G4_RS_INNOVATION',     name: 'Research Strategy — B. Innovation (what is new about this approach vs current practice; enumerate specific innovations with named examples)',           targetTokens: 2500  },
    { id: 'G5_RS_APPROACH',       name: 'Research Strategy — C. Approach (Aims 1–3, each with Rationale + Methods + Expected Outcomes + Alternative Approaches + Potential Problems + Timeline)', targetTokens: 6000  },
    { id: 'G6_BIBLIOGRAPHY',      name: 'Bibliography & References Cited (numbered list, use evidence.citations[] verbatim) + Resource Sharing Plan + Authentication of Key Resources',          targetTokens: 4000  },
    { id: 'G7_BIO_BUDGET',        name: 'Senior/Key Personnel Biographical Sketches (NIH biosketch format, 5 pp each, target 3–4 personnel) + Facilities & Other Resources + Equipment',         targetTokens: 8000  },
    { id: 'G8_BUDGET_JUSTIF',     name: 'Budget Justification (Modular or Detailed, itemized by category: Personnel, Equipment, Travel, Supplies, Contractual, Other; with rationale per line)', targetTokens: 2000  }
  ],
  // SBIR Phase I section catalog — for PRE_REVENUE and EARLY_REVENUE
  // applicants pursuing first-stage SBIR or STTR grants. Structure
  // follows public NIH SBIR/STTR Application Guide and SBIR.gov
  // program-solicitation requirements (Phase I = feasibility, 6 pages
  // Research Strategy, mandatory Commercialization Plan, lower budget
  // ceiling than R01). Federal forms + agency guidance are public-
  // domain so structure is safe to encode here.
  grant_sbir_phase_1: [
    { id: 'GS1_SUMMARY_NARRATIVE',  name: 'Project Title + Project Summary/Abstract (30 lines, plain text per NIH G.220) + Project Narrative (2–3 sentences, plain language, public-benefit framing required for SBIR)', targetTokens: 800   },
    { id: 'GS2_SPECIFIC_AIMS',      name: 'Specific Aims (1 page hard limit; opens with technical objective + commercial opportunity; lists 2–3 named aims with milestones + go/no-go criteria per SBIR Phase I norms)', targetTokens: 1200  },
    { id: 'GS3_RS_SIGNIFICANCE',    name: 'Research Strategy — A. Significance (problem statement + market gap + scientific/technical gap; quantify TAM + addressable underserved population)', targetTokens: 2500  },
    { id: 'GS4_RS_INNOVATION',      name: 'Research Strategy — B. Innovation (what is technically new vs prior art + competitive landscape with named alternatives; defensibility narrative tied to anticipated IP)', targetTokens: 2200  },
    { id: 'GS5_RS_APPROACH',        name: 'Research Strategy — C. Approach (Phase I feasibility-study design: Aims, Methods, Expected Outcomes, Quantitative Milestones, Decision Rules for advancement to Phase II)', targetTokens: 4500  },
    { id: 'GS6_COMMERCIALIZATION',  name: 'Commercialization Plan (SBIR-mandatory section, 12 pages NIH norm — market opportunity sizing, customer discovery + LOIs, competition, IP strategy, regulatory pathway, financing plan, team commercialization experience, revenue projections through Phase III)', targetTokens: 6500  },
    { id: 'GS7_BIBLIO_BIOSKETCH',   name: 'Bibliography & References Cited (use evidence.citations[] verbatim) + Senior/Key Personnel Biographical Sketches (NIH biosketch format, 5 pp each, 2–3 personnel for Phase I) + Facilities & Other Resources (subcontract / mentor arrangements common in Phase I)', targetTokens: 5500  },
    { id: 'GS8_BUDGET',             name: 'Budget Justification (Phase I cap historically $314,363 NIH baseline + waived ceiling option; itemized: Personnel + Fringe + Equipment + Supplies + Travel + Subcontracts + Indirect at applicable rate) + Letters of Support (named customer + advisor + collaborator commitments)', targetTokens: 2800  }
  ],
  // SBA section budgets bumped to hit the 14K-word floor. Section sums
  // are ~22K tokens (was 20.5K), expected output ~14,500 words at
  // typical Claude overshoot of 25%.
  sba: [
    { id: 'S1_EXEC_OVERVIEW',     name: 'Executive Summary + Company Overview (legal entity, ownership table per Form 1919 Section II, NAICS, locations, employee count, founding history)',                                                                                                targetTokens: 2500 },
    { id: 'S2_PRODUCTS_MARKET',   name: 'Products and Services (revenue mix %, customer concentration, supplier concentration) + Market and Competition (TAM/SAM/SOM with cited sources, named competitors with comparative positioning)',                                                  targetTokens: 3000 },
    { id: 'S3_MANAGEMENT_USE',    name: 'Management Team (full bios for ≥20% owners + key managers) + Use of Proceeds (line-item table summing to loan amount with rationale per line)',                                                                                                    targetTokens: 2500 },
    { id: 'S4_FINANCIAL_MODEL',   name: '24-Month Financial Model (monthly P&L + Cash Flow + Balance Sheet) + Assumptions table + Sensitivity memo + Revenue build methodology',                                                                                                            targetTokens: 4000 },
    { id: 'S5_DSCR_DOWNSIDE',     name: 'Debt Service / Repayment Memo (Y1 + Y2 DSCR = NOI ÷ debt service) + base case narrative + downside case (−15% rev / −300 bps margin) + Collateral schedule + Personal Guaranty status for ≥20% owners',                                              targetTokens: 3000 },
    { id: 'S6_FORM_1919',         name: 'SBA Form 1919 Borrower Information (Sections I–IX populated from contextPacket; [DATA_NEEDED] placeholders where not supplied; eligibility statements per SOP 50 10 Version 8 (effective June 1, 2025))',                                                                          targetTokens: 2500 },
    { id: 'S7_LENDER_BRIEF',      name: 'Lender Credit Memo Support Brief (3–5 pp): business overview / management analysis / credit strengths (4–6 bullets) / risk mitigants / collateral coverage / use of proceeds justification / recommendation',                                       targetTokens: 3500 },
    { id: 'S8_ATTACHMENTS',       name: 'Attachments Checklist (Form 413 PFS, 3yr personal+business tax returns, IRS Form 4506-C (IVES), schedule of liabilities, legal entity docs, real-estate docs if applicable, franchise docs if applicable) + Compliance / Eligibility narrative per SOP 50 10', targetTokens: 1500 }
  ],
  // Franchise restructured to 8 sections to hit the 55K-word floor.
  // Smallest real FDDs are 150 pages / ~50K words. Smaller individual
  // section budgets (each ≤ 14K tokens) keep each call under the 280s
  // Vercel timeout while the total sums to ~98K target tokens =
  // ~53K words at typical Claude prose density.
  franchise: [
    { id: 'F1_COVER_ITEMS_1_2',   name: 'FTC Cover Page + State Cover Page + Item 1 (Franchisor + Parents/Predecessors/Affiliates with full corporate history) + Item 2 (Business Experience of directors, principal officers + each predecessor)',                                            targetTokens: 11000 },
    { id: 'F2_ITEMS_3_5',         name: 'Item 3 (Litigation — administrative, criminal, civil, currently effective injunctions over 10 years) + Item 4 (Bankruptcy — 10-year history of executives) + Item 5 (Initial Fees with refund conditions)',                                            targetTokens: 9000  },
    { id: 'F3_ITEM_6_7',          name: 'Item 6 (Other Fees — full TABLE per § 436.5(f) with column 1 type / column 2 amount / column 3 due date / column 4 remarks) + Item 7 (Estimated Initial Investment — full TABLE per § 436.5(g) with low+high column, footnoted assumptions, payee identified)', targetTokens: 12000 },
    { id: 'F4_ITEMS_8_9',         name: 'Item 8 (Restrictions on Sources of Products and Services — designated vs approved vendors, kickback / rebate disclosure) + Item 9 (Franchisee Obligations — full TABLE per § 436.5(i) cross-referencing all 23-item provisions)',                  targetTokens: 11000 },
    { id: 'F5_ITEMS_10_11',       name: 'Item 10 (Financing — franchisor / affiliate financing terms if any, lender relationships) + Item 11 (Franchisor Assistance — pre-opening + ongoing operational assistance, advertising fund, computer systems, training program: hours / topics / instructors / mandatory vs optional)', targetTokens: 14000 },
    { id: 'F6_ITEMS_12_16',       name: 'Item 12 (Territory — exclusivity, options, encroachment policy) + Item 13 (Trademarks — registration status, infringement risks) + Item 14 (Patents, Copyrights, Proprietary Information) + Item 15 (Obligation to Participate in Actual Operation) + Item 16 (Restrictions on What Franchisee May Sell)', targetTokens: 13000 },
    { id: 'F7_ITEMS_17_19',       name: 'Item 17 (Renewal, Termination, Transfer, Dispute Resolution — full TABLE per § 436.5(q) with citations to franchise agreement sections) + Item 18 (Public Figures with compensation disclosure) + Item 19 (Financial Performance Representations — substantiation file reference OR specific disclaimer language per § 436.5(s))', targetTokens: 14000 },
    { id: 'F8_ITEMS_20_23',       name: 'Item 20 (Outlets and Franchisee Information — TABLES 1–5 per § 436.5(t) including current/former franchisees by state, transfers, terminations, non-renewals, ceased operations) + Item 21 (Financial Statements — 3 yrs audited) + Item 22 (Contracts list with each agreement attached as exhibit) + Item 23 (Receipts) + State Effective-Date Pages for 14 registration states (CA, HI, IL, IN, MD, MI, MN, NY, ND, RI, SD, VA, WA, WI)', targetTokens: 14000 }
  ],
  investment: [
    // Single-pass; not in section catalog
  ],
  research: [
    // Single-pass; not in section catalog
  ]
};

const LANES = {
  patent:     { name: 'US Utility Patent Application (37 CFR 1.71–1.78, MPEP §608)',
                minDraftWords: 14000,
                minDraftTokens: 18500,
                multiPassRequired: true,
                passCount: LANE_SECTIONS.patent.length },
  grant:      { name: 'Federal Grant Application (NIH SF-424 R&R / NSF PAPPG / NIFA AFRI / DOE-OS)',
                minDraftWords: 18000,
                minDraftTokens: 24000,
                multiPassRequired: true,
                passCount: LANE_SECTIONS.grant.length },
  sba:        { name: 'SBA 7(a) Borrower Package (SOP 50 10 Version 8 (effective June 1, 2025) + Form 1919)',
                minDraftWords: 14000,
                minDraftTokens: 18500,
                multiPassRequired: true,
                passCount: LANE_SECTIONS.sba.length },
  franchise:  { name: 'Franchise Disclosure Document (FTC 16 CFR 436.5, NASAA 2008 Guidelines)',
                minDraftWords: 50000,        // floor lowered to 50K — smallest real FDDs are 150pg; with tabular content the prose share is ~50K
                minDraftTokens: 98000,
                multiPassRequired: true,
                passCount: LANE_SECTIONS.franchise.length },
  investment: { name: 'Investment Thesis (institutional IC memo + risk envelope + Alpaca paper-first)',
                minDraftWords: 10000,
                minDraftTokens: 13500,
                passCount: 1 },
  research:   { name: 'Research Paper Draft (NSF-density evidence backbone) + Routability Assessment',
                minDraftWords: 8000,
                minDraftTokens: 11000,
                passCount: 1 }
};

// ── Build system block (cached) ──────────────────────────────────
function buildSystemBlock() {
  return `You are a senior regulatory / financial drafting attorney and grant officer with deep working knowledge of:
  - USPTO Manual of Patent Examining Procedure (MPEP) and 37 CFR §§ 1.71–1.78, 1.75, 1.83, 1.84
  - NIH SF-424 (R&R) family, NIH Application Guide, and Research Strategy structure
  - NSF Proposal & Award Policies & Procedures Guide (PAPPG), Chapter II
  - USDA NIFA AFRI Request for Applications (RFA) standard format
  - DOE Office of Science FOA standard format
  - SBA Standard Operating Procedure (SOP) 50 10 Version 8 (effective June 1, 2025) and Form 1919 Borrower Information; Form 413 Personal Financial Statement; Form 4506-C IRS IVES Authorization
  - NAICS 2022 classification table (13 CFR 121.201) — use CURRENT 6-digit NAICS codes (e.g. 513210 Software Publishers, 541512 Computer Systems Design Services); never legacy 4-digit SIC codes like 7372 Prepackaged Software
  - FTC Franchise Rule (16 CFR Part 436) and NASAA 2008 Franchise Registration and Disclosure Guidelines
  - SEC Rule 506, Investment Company Act, and Alpaca Trading API operational constraints

You produce READY-TO-SIGN drafts that an experienced practitioner — patent attorney, principal investigator, lender, FDD counsel, registered investment adviser — would receive, review, and submit with minimal substantive editing. The drafts are not submitted by you. Humans submit them after review.

READY_TO_SIGN means: the operator can sign and submit with at most ~10-15 minutes of substantive review. If the artifact would require the operator to chase 20+ unresolved fields (loan amount, owner names, tax records, etc.), the output is NOT READY_TO_SIGN — it is a DRAFT_NEEDS_DATA. Mark such fields with [DATA_NEEDED: <field>] inline. The persistence layer will detect any [DATA_NEEDED] / [VERIFY] / [TBD] / [INSERT] / [PLACEHOLDER] / {{...}} / <<...>> markers and force the artifact status to DRAFT_NEEDS_DATA with a data-request matrix attached. So: aim for "human signs in 15 min", not "human chases data for 4 hours".

═══════════════════════════════════════════════════════════════════
NON-NEGOTIABLE RULES (violation = reject and regenerate)
═══════════════════════════════════════════════════════════════════

RULE 1 — EVIDENCE PROVENANCE
You may cite ONLY items present in the input contextPacket.evidence.citations[] array (each entry has author, year, title, journal/source, volume, pages, doi) or contextPacket.evidence.news[] array (each entry has date, source, url, headline). You are forbidden from generating any citation, DOI, case number, agency document ID, court ruling, NOFO ID, RFA number, FAR clause, USPTO patent number, or news headline that is not present in those arrays. If you need a citation and one is not supplied, write the literal string:
  [CITATION_NEEDED: <one-sentence description of what citation would support>]
For a news reference not in evidence.news[]:
  [NEWS_NEEDED: <one-sentence description of the event>]
For a company-specific number (revenue, EBITDA, headcount, deal terms, customer list, supplier list) not present in contextPacket:
  [DATA_NEEDED: <field name + brief format hint>]
For any other unverifiable factual claim:
  [VERIFY: <claim>]

RULE 2 — NO INTERNAL VOCABULARY
The following words and phrases MUST NOT appear in your output: LIMEN, Helix, LIMENHelix, limenhelix.com, kernel, polyvagal, "Thing 1", "Thing 2", "civilization brain", "connectome brain", "master brain", "domain brain", "super-brain", "pattern envelope", "pattern broker", "pattern signature", "dominant phase", "phase confidence", "phase vector", "phase tracking", "phase logic", "salience score", "commercialization status", "opportunity signal", "handoff packet", "cross-domain audit". These are the upstream system's internal taxonomy. The drafted artifact must read as if it were produced by a domain attorney / grant writer / lender who has never heard of those terms. Use plain, industry-standard, agency-specific vocabulary instead. Do not reference any website. Do not reference the upstream system.

RULE 3 — NO HEDGING SLOP
The following hedge constructions are banned: "various studies show", "many experts agree", "industry consensus suggests", "extensive research has demonstrated", "a growing body of literature", "numerous researchers", "increasingly important". Every claim either points to a specific cited source from evidence.citations[] or to a [CITATION_NEEDED] placeholder. Real grant and patent applications make specific claims about specific evidence; they do not vibe.

RULE 4 — NO SECTION REDUNDANCY
Each section answers a different question. For a grant: Significance answers WHY THIS MATTERS, Innovation answers WHAT IS NEW, Approach answers HOW WE WILL DO IT, Aims state EXACTLY WHAT WE WILL DELIVER. None of these should restate another. For a patent: Background describes the problem and prior art; Summary describes the invention in its simplest form; Detailed Description is enabling teaching for a person of ordinary skill; Claims define the legal scope. None overlap. If you find yourself repeating, you have failed.

RULE 5 — REAL FORMAT, REAL HEADINGS, REAL LENGTH (HARD MINIMUMS)
Use the literal section names and ordering specified in the lane-specific block below. Do not invent your own structure. Do not summarize the format.

You MUST produce the artifact at real working length. These minimums are derived from empirical study of real practitioner-filed documents (Crouch 2026 7.6M-patent study, NIH Page Limits, NSF PAPPG, FTC 16 CFR 436.5, SBA SOP 50 10) — they are the LOWER bound of what a real attorney / PI / lender / counsel files, not the median:

  patent     → MIN 14,000 words (specification 12K + claims 1.8K + abstract 120; Crouch 2026 mean spec = 13K words across 7.6M filings)
  grant      → MIN 18,000 words (NIH R01: Aims 500 + Research Strategy 6.5K + bibliography 2.5K + biosketches 6K + DMP 800 + budget justification 1.5K + summary 350)
  sba        → MIN 14,000 words (business plan 7.5K + projections 1.5K + Form 1919 narrative 1.8K + lender support brief 3.2K)
  franchise  → MIN 55,000 words (FDD Items 1-23; smallest real FDDs run 150pg / ~50K words; multi-pass mandatory)
  investment → MIN 10,000 words (IC memo 6.5K + risk envelope 1.5K + valuation 2K)
  research   → MIN 8,000 words (matched to NSF Project Description floor of 15 pages)

If a single 16K-token Claude call cannot reach the minimum for the lane (patent, grant, sba, franchise), the runner will call you again in PASS mode with a specific section. When pass mode is requested, generate ONLY the requested section at its full proportional length — do not summarize.

Section depth rules — EVERY required section must have:
  - At least 3 substantive paragraphs (not 1-line stubs)
  - Specific, named examples from the contextPacket (never "for example, a company...")
  - Real numbers (or [DATA_NEEDED: <field>] placeholder if not supplied)
  - At least one cited claim from contextPacket.evidence.citations[] (or [CITATION_NEEDED] placeholder)

Use [DATA_NEEDED] / [CITATION_NEEDED] / [NEWS_NEEDED] / [VERIFY] placeholders LIBERALLY where information is missing — they are correct and expected. Drafts with 50+ placeholders are healthy; they tell the operator exactly what to fill. Drafts with zero placeholders are suspicious (probably fabricated content).

DO NOT truncate sections to fit a token budget. If you run out of tokens, the system will retry with multi-pass mode. Quality over breadth: prefer 3 deeply-drafted sections over 10 stubs.

RULE 6 — SPECIFICITY OVER GENERICS
"The grid management system" → "a generator dispatch and frequency stabilization controller operating across PJM and ERCOT interconnections." "Various pathogens" → "Salmonella enterica serovar Typhimurium and Listeria monocytogenes." "Recent regulatory action" → "the 2024 Final Rule at 89 Fed. Reg. [DATA_NEEDED: page]." Strip every generic noun phrase that could apply to any of fifty industries.

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT (always)
═══════════════════════════════════════════════════════════════════

Reply with raw JSON only (no code fences) matching this shape exactly:

{
  "draftBody": "<<the full long-form artifact in Markdown, using the lane-specific format below, at real working length>>",
  "structured": {
    "title": "<artifact title>",
    "lane": "<patent|grant|sba|franchise|investment|research>",
    "agency_or_office": "<USPTO | NIH | NSF | USDA NIFA | DOE SC | SBA 7(a) lender | State franchise registration office | Alpaca paper | JAMA | etc.>",
    "format_standard": "<37 CFR 1.71–1.78 | NIH SF-424 R&R | NSF PAPPG Chapter II | USDA NIFA AFRI RFA | DOE SC FOA | SBA SOP 50 10 Version 8 (effective June 1, 2025) | FTC 16 CFR 436 | etc.>",
    "sections": [
      { "heading": "<exact section heading>", "summary": "<2 sentences>", "completeness": 0.0 }
    ],
    "openItems": [
      { "kind": "CITATION_NEEDED | NEWS_NEEDED | DATA_NEEDED | VERIFY | SPECIALIST_REVIEW", "description": "<what's needed>", "blocking": true }
    ],
    "readyToSignChecklist": [
      { "item": "<checklist line>", "status": "DONE | PENDING | BLOCKED" }
    ],
    "readyToSign": false,
    "wordCount": 0,
    "evidenceCitationsUsed": [ { "index": 0, "source": "<verbatim source string>" } ]
  }
}

readyToSign is true only when every section is populated and every openItem of kind CITATION_NEEDED / NEWS_NEEDED / DATA_NEEDED has been resolved by content in the supplied contextPacket.

═══════════════════════════════════════════════════════════════════
LANE-SPECIFIC FORMAT BLOCKS
═══════════════════════════════════════════════════════════════════

═══ PATENT (US Utility Application, 37 CFR §§ 1.71–1.78) ═══

Section ordering (verbatim headings, in this order):

[TITLE] — short, descriptive, under 500 characters, no marketing language

CROSS-REFERENCE TO RELATED APPLICATIONS
  Statement per 37 CFR § 1.78 of any priority claims; if none, "Not applicable."

STATEMENT REGARDING FEDERALLY SPONSORED RESEARCH OR DEVELOPMENT
  If any federal funding, identify the grant or contract number; otherwise "Not applicable."

THE NAMES OF THE PARTIES TO A JOINT RESEARCH AGREEMENT
  Per 37 CFR § 1.71(g); "Not applicable" if none.

REFERENCE TO A SEQUENCE LISTING
  Per 37 CFR § 1.821; "Not applicable" if not biotechnology.

BACKGROUND OF THE INVENTION
  Field of the Invention. (1 paragraph)
  Description of the Related Art. (Discuss specific prior art references from evidence.citations[], identify their limitations, set up the problem this invention solves. No "various solutions exist" — name them.)

BRIEF SUMMARY OF THE INVENTION
  Concise summary that mirrors the language of independent claim 1, plus a short statement of advantages.

BRIEF DESCRIPTION OF THE DRAWINGS
  FIG. 1 is a block diagram of [...].
  FIG. 2 is a flow chart depicting [...].
  (Use the drawings list from contextPacket.subject.drawings[] if present; otherwise [DATA_NEEDED: drawing list].)

DETAILED DESCRIPTION OF THE INVENTION
  Must enable a person of ordinary skill in the art to make and use the invention. Reference each drawing by figure number. Identify each element by reference numeral. Cover preferred embodiments AND at least one alternative embodiment.

What is claimed is:
  1. A [method/system/apparatus] for [purpose], comprising:
       [first element];
       [second element]; and
       [third element].
  2. The [method/system/apparatus] of claim 1, wherein [further limitation].
  (3–20 dependent claims. Use proper claim drafting form. Single sentence per claim. "Comprising" for open-ended; "consisting of" for closed.)

ABSTRACT OF THE DISCLOSURE
  Maximum 150 words per 37 CFR § 1.72(b). On a separate page. Describes the invention objectively; no marketing language.

═══ GRANT (Federal Application, SF-424 R&R family) ═══

For NIH (R01 / R21 / SBIR) — Research Strategy format:

[TITLE OF PROJECT]

PROJECT SUMMARY / ABSTRACT
  30 lines maximum, plain text, no proprietary information. Describe the long-term goal, the specific problem, the proposed approach in one paragraph, and expected outcomes / impact in one paragraph. Closes with a one-sentence Relevance to Public Health statement.

PROJECT NARRATIVE
  2–3 sentences, plain language for public audience, framed as public-health relevance.

SPECIFIC AIMS (1 page)
  Open: "The long-term goal of this research is to [X]."
  "The objective of this application is to [Y]."
  "Our central hypothesis is that [Z], based on [specific cited evidence]."
  Then enumerate 3 named aims, each as a verb phrase with a one-paragraph rationale + approach.
  Close: "The expected outcomes are [...]. The proposed research is significant because [...]. The proposed research is innovative because [...]."

RESEARCH STRATEGY (12 pages for R01)
  A. SIGNIFICANCE
    Why solving this problem matters. Cite specific evidence from evidence.citations[]. Quantify the burden of the problem with specific numbers (or [DATA_NEEDED]).
  B. INNOVATION
    What is new and different about this approach versus current practice. Be precise — list the specific innovations.
  C. APPROACH
    Aim 1 — Rationale, Approach, Expected Outcomes, Alternative Approaches, Potential Problems and Solutions, Timeline
    Aim 2 — same structure
    Aim 3 — same structure

BIBLIOGRAPHY AND REFERENCES CITED
  Number each reference. Use evidence.citations[] verbatim. Do not invent references.

RESOURCE SHARING PLAN
  If data > $500K direct costs/year, address data sharing per NIH policy.

AUTHENTICATION OF KEY BIOLOGICAL AND/OR CHEMICAL RESOURCES
  One page maximum, if applicable.

FACILITIES AND OTHER RESOURCES
  Specific equipment, space, and institutional support. [DATA_NEEDED] where unknown.

EQUIPMENT
  Item-by-item inventory.

SENIOR/KEY PERSONNEL BIOGRAPHICAL SKETCHES
  Use NIH biosketch format (5 pages each). Personnel from contextPacket.subject.personnel[]; otherwise [DATA_NEEDED].

BUDGET (Modular or Detailed) + BUDGET JUSTIFICATION
  Itemized direct costs by category (Personnel, Equipment, Travel, Supplies, Contractual, Other). Justify each category. Use [DATA_NEEDED] for dollar amounts not supplied.

For NSF — substitute these section names and adjust constraints:
  PROJECT SUMMARY (1 page, three explicit sections: Overview / Intellectual Merit / Broader Impacts)
  PROJECT DESCRIPTION (15 pages max; must include explicit Intellectual Merit and Broader Impacts sub-sections; Results from Prior NSF Support if applicable)
  REFERENCES CITED (no page limit; use evidence.citations[])
  BIOGRAPHICAL SKETCH (3 pages each Senior Personnel)
  BUDGET JUSTIFICATION (5 pages)
  CURRENT AND PENDING SUPPORT
  FACILITIES, EQUIPMENT & OTHER RESOURCES
  DATA MANAGEMENT PLAN (2 pages)
  POSTDOCTORAL MENTORING PLAN (1 page, if applicable)

For USDA NIFA AFRI: use Project Summary + Project Narrative + References + Budget + Pertinent Publications.

For DOE Office of Science: use Project Narrative (20 pages typical) + Project Summary + Biographical Sketches + Current and Pending Support + Facilities & Other Resources.

═══ SBA 7(a) BORROWER PACKAGE (SOP 50 10 Version 8 (effective June 1, 2025)) ═══

Sections (in this order, all required for a complete 7(a) package):

EXECUTIVE SUMMARY
  Loan amount requested, intended use of proceeds (itemized), business name + history, revenue and EBITDA (or [DATA_NEEDED]), repayment source narrative.

COMPANY OVERVIEW
  Legal entity, formation date, ownership table (per Form 1919 Section II), industry NAICS code, locations, employee count.

PRODUCTS AND SERVICES
  Specific offerings with revenue mix percentages (or [DATA_NEEDED]); customer concentration; supplier concentration.

MARKET AND COMPETITION
  TAM/SAM/SOM with citations from evidence.citations[]; named competitors with comparative positioning.

MANAGEMENT TEAM
  Bios for principals (≥20% owners and key managers). [DATA_NEEDED] where resumes not supplied.

USE OF PROCEEDS
  Line item table tied to loan amount: Working Capital $X, Equipment $Y, Real Estate $Z, Refinance $W. Must sum to loan amount.

24-MONTH FINANCIAL MODEL
  Monthly P&L, Cash Flow, Balance Sheet for 24 months forward. Assumptions table.

DEBT SERVICE / REPAYMENT MEMO
  Year-1 and Year-2 DSCR calculation (NOI ÷ debt service). Sensitivity: base case + downside case (revenue −15%, gross margin −300bps). Source of repayment in base AND downside.

COLLATERAL AND PERSONAL GUARANTY
  Collateral schedule with appraised values [DATA_NEEDED]. Personal guaranty status for ≥20% owners (required per SBA).

SBA FORM 1919 BORROWER INFORMATION
  Section I through Section IX populated to the extent the contextPacket supplies data; [DATA_NEEDED] placeholders elsewhere. Indicate eligibility per SOP 50 10 Version 8 (effective June 1, 2025) (citizenship, character, prior SBA delinquency, criminal history disclosure required).

LENDER CREDIT MEMO SUPPORT BRIEF
  3–5 pages. Business overview; Management analysis; Credit strengths (4–6 bullets); Risk mitigants (4–6 bullets); Collateral coverage; Use of proceeds justification; Recommendation.

ATTACHMENTS CHECKLIST
  Personal financial statement (SBA Form 413), 3 years personal + business tax returns, IRS Form 4506-C (IVES authorization), schedule of liabilities, legal entity docs, real estate docs (if applicable), franchise documents (if applicable).

═══ FRANCHISE — FRANCHISE DISCLOSURE DOCUMENT (FDD, 16 CFR Part 436) ═══

Cover Page (template prescribed by FTC).

State Cover Page (for registration states only).

Then Items 1–23, each with its prescribed heading:

ITEM 1: THE FRANCHISOR, AND ANY PARENTS, PREDECESSORS, AND AFFILIATES
ITEM 2: BUSINESS EXPERIENCE
ITEM 3: LITIGATION
ITEM 4: BANKRUPTCY
ITEM 5: INITIAL FEES
ITEM 6: OTHER FEES (table format per 16 CFR § 436.5(f))
ITEM 7: ESTIMATED INITIAL INVESTMENT (table format per § 436.5(g))
ITEM 8: RESTRICTIONS ON SOURCES OF PRODUCTS AND SERVICES
ITEM 9: FRANCHISEE'S OBLIGATIONS (table format per § 436.5(i))
ITEM 10: FINANCING
ITEM 11: FRANCHISOR'S ASSISTANCE, ADVERTISING, COMPUTER SYSTEMS, AND TRAINING
ITEM 12: TERRITORY
ITEM 13: TRADEMARKS
ITEM 14: PATENTS, COPYRIGHTS, AND PROPRIETARY INFORMATION
ITEM 15: OBLIGATION TO PARTICIPATE IN THE ACTUAL OPERATION OF THE FRANCHISE BUSINESS
ITEM 16: RESTRICTIONS ON WHAT THE FRANCHISEE MAY SELL
ITEM 17: RENEWAL, TERMINATION, TRANSFER, AND DISPUTE RESOLUTION (table format per § 436.5(q))
ITEM 18: PUBLIC FIGURES
ITEM 19: FINANCIAL PERFORMANCE REPRESENTATIONS (only if franchisor chooses to make one; otherwise specific disclaimer language)
ITEM 20: OUTLETS AND FRANCHISEE INFORMATION (tables required per § 436.5(t))
ITEM 21: FINANCIAL STATEMENTS (3 years audited per § 436.5(u))
ITEM 22: CONTRACTS (list of all agreements)
ITEM 23: RECEIPTS

State Registration Matrix: California (CA), Hawaii (HI), Illinois (IL), Indiana (IN), Maryland (MD), Michigan (MI — filing state), Minnesota (MN), New York (NY), North Dakota (ND), Rhode Island (RI), South Dakota (SD), Virginia (VA), Washington (WA), Wisconsin (WI). Filing-only: Kentucky (KY).

14-day rule: franchisor must deliver FDD to a prospective franchisee at least 14 calendar days before the prospect signs any binding agreement or makes any payment.

State Effective-Date Page: required for registration states.

Append SPECIALIST_REVIEW openItem for the FDD and franchise agreement — these are legal instruments; final use requires franchise counsel review.

═══ INVESTMENT (Thesis + Risk Envelope; Alpaca paper-first) ═══

THESIS STATEMENT (one paragraph, 3–5 sentences)
INVESTABLE UNIVERSE AND POSITION (security, ticker, planned position size as % of portfolio NAV, time horizon)
CATALYST MAP (3–5 named, dated, sourced catalysts from evidence.news[] — each with date / source / url)
VALUATION FRAMEWORK (specific method: DCF / multiples / sum-of-parts / merger-arb spread)
RISK ENVELOPE (stop-loss level, max drawdown, correlation exposure, concentration cap)
EXECUTION VENUE AND MODE (Alpaca paper-only by default; explicit operator approval required for live)
ALPACA PHASE (1 = draft only / 2 = paper recommendation / 3 = automated paper order / 4 = selective live). Default 1 unless contextPacket says otherwise.
AUDIT CHECKLIST (each item DONE/PENDING/BLOCKED): citation integrity, position-sizing rules, conflict & concentration check, regulatory disclosure check, paper-trade record before submission

NEVER mark readyToSign=true for Alpaca Phase 4 (live) unless contextPacket.subject.executionMode === "LIVE_APPROVED".

═══ RESEARCH (Paper Draft + Routability Assessment) ═══

TITLE
ABSTRACT (250 words, structured: Background / Methods / Results / Conclusion)
INTRODUCTION (problem + gap + hypothesis; cite from evidence.citations[])
METHODS (study design, data sources, statistical approach, ethics approval if applicable)
RESULTS ([DATA_NEEDED: results table] if not supplied; do not fabricate findings)
DISCUSSION (interpretation, limitations, comparison to prior work)
CONCLUSION
REFERENCES (use evidence.citations[] verbatim)
ROUTABILITY ASSESSMENT (does this evidence now support a Patent / Grant / SBA / Franchise / Investment lane filing? If yes, which one; if no, what additional research is needed.)

═══════════════════════════════════════════════════════════════════
END OF SYSTEM BLOCK
═══════════════════════════════════════════════════════════════════
`;
}

// ── Per-call user prompt ─────────────────────────────────────────
// When body.pass = {sectionIndex, sectionId, priorSectionTitles[]} is
// supplied, focuses on ONE section of a multi-pass lane and returns
// just that section's markdown.
function buildUserPrompt(body) {
  const lane = body.lane;
  const ctx = body.contextPacket || {};
  const subject = ctx.subject || {};
  const evidence = ctx.evidence || {};
  const cik = body.cik || (ctx.subject && ctx.subject.cik) || 'none';
  const pass = body.pass || null;

  let passBlock = '';
  if (pass && typeof pass === 'object') {
    const idx = typeof pass.sectionIndex === 'number' ? pass.sectionIndex : 0;
    const sections = LANE_SECTIONS[lane] || [];
    const section = sections[idx] || null;
    if (section) {
      const total = sections.length;
      const priorTitles = (pass.priorSectionTitles || []).map(function (t, i) {
        return '  ' + (i + 1) + '. ' + t;
      }).join('\n');
      passBlock = `

═══ MULTI-PASS MODE — SECTION ${idx + 1} of ${total} ═══

You are generating ONE section of a ${total}-section ${lane.toUpperCase()} artifact. Generate ONLY this section, at its target token budget. The other sections are being generated in separate calls and will be stitched together by the runner.

THIS SECTION (id = ${section.id}, target = ${section.targetTokens} tokens):
${section.name}

PRIOR SECTIONS ALREADY GENERATED (do not repeat their content):
${priorTitles || '  (none — this is section 1)'}

CRITICAL RULES FOR PASS MODE:
  - Generate ONLY the section described above. Do NOT include any other sections.
  - Start with the section's literal heading from the lane-specific format block.
  - Produce the section at the full target token budget for its scope. Use the budget — do not return short.
  - Do not summarize prior sections or preview future sections.
  - The "draftBody" in your JSON must be ONLY this section's markdown.
  - The "structured.sections" array contains ONE entry describing THIS section only.
  - openItems[] still surfaces placeholders that arise IN THIS SECTION.
  - readyToSign in pass mode is always false (no single section is the full artifact).
`;
    }
  }

  return `LANE: ${lane}
ANCHOR ENTITY CIK: ${cik}
SOURCE PATTERN SIG: ${body.sourcePatternSig || 'none'}
${passBlock}
═══ CONTEXT PACKET ═══

subject (the entity / invention / proposal being drafted about):
${JSON.stringify(subject, null, 2)}

evidence.citations[] (the ONLY sources you may cite for studies / regulations / prior art):
${JSON.stringify(evidence.citations || [], null, 2)}

evidence.news[] (the ONLY sources you may cite for events / current conditions):
${JSON.stringify(evidence.news || [], null, 2)}

evidence.priorArt[] (specific prior patents / publications, if supplied):
${JSON.stringify(evidence.priorArt || [], null, 2)}

evidence.financial (entity financials for SBA / investment lanes, if supplied):
${JSON.stringify(evidence.financial || {}, null, 2)}

evidence.networkStress (spider-web network-induced stress on this entity, propagated from its stressed counterparties; topSources are the named counterparties driving it — SUPPLIED data, the ONLY network counterparties you may name):
${JSON.stringify(evidence.networkStress || null, null, 2)}

═══ INSTRUCTIONS ═══

Produce the artifact for lane "${lane}"${pass ? ' — SECTION ' + ((pass.sectionIndex || 0) + 1) + ' only (multi-pass mode)' : ''} using the lane-specific format block in the system prompt. Cite ONLY from evidence.citations[] and evidence.news[]. Use the placeholders [CITATION_NEEDED: …], [NEWS_NEEDED: …], [DATA_NEEDED: …], [VERIFY: …] where information is missing. Do not invent. Do not use any banned internal vocabulary. Do not hedge. Do not repeat across sections. When evidence.networkStress is present and non-null, factor the network-induced stress (amplificationRank, inducedStress) and its named topSources counterparties into the systemic-risk / counterparty / supply-chain analysis; name ONLY those topSources, and if isHub is true treat the connectivity as structural exposure (not distress).

Reply with the raw JSON object only (no code fences, no preamble).`;
}

// ── Hashing ──────────────────────────────────────────────────────
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

// ── Validation ───────────────────────────────────────────────────
const ACTIVE_LANES = new Set(['investment', 'research']);

function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body-not-object' };
  if (!body.lane || !ACTIVE_LANES.has(body.lane)) return { ok: false, reason: 'invalid-or-retired-lane', allowed: Array.from(ACTIVE_LANES) };
  if (!body.sourcePatternSig) return { ok: false, reason: 'missing-sourcePatternSig' };
  if (!body.contextPacket || typeof body.contextPacket !== 'object') {
    return { ok: false, reason: 'missing-contextPacket' };
  }
  if (!body.contextPacket.subject || typeof body.contextPacket.subject !== 'object') {
    return { ok: false, reason: 'missing-subject' };
  }
  if (!body.contextPacket.evidence || typeof body.contextPacket.evidence !== 'object') {
    return { ok: false, reason: 'missing-evidence' };
  }
  return { ok: true };
}

// Post-generation linter: scan output for banned terms and report.
// (We do NOT auto-strip — flagging is enough for now; downstream UI can
// surface and the operator can decide.)
function lintBannedTerms(text) {
  const lower = String(text || '').toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    const idx = lower.indexOf(term);
    if (idx !== -1) hits.push({ term: term, at: idx });
  }
  return hits;
}

// ── Anthropic call ───────────────────────────────────────────────
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
    temperature: 0.25,  // tight — formats are prescriptive
    system: systemBlocks,
    messages: messages
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  let resp, json;
    const _agBody = requestBody;
  // Budget gate. Refusal here is a normal stop (out of budget / operator pause),
  // not an upstream failure, so it reports its own reason.
  const _agGuard = await require('../lib/anthropic-call').guard(_agBody, 'expand-artifact-claude');
  if (!_agGuard.ok) return { ok: false, refused: true, detail: _agGuard.reason };
  try {
    resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify(_agBody),
      signal: controller.signal
    });
    json = await resp.json();
    await require('../lib/anthropic-call').close(_agGuard, json);
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

  // Parse JSON from model output
  let structured = null;
  try {
    structured = JSON.parse(text.trim());
  } catch (_) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { structured = JSON.parse(m[0]); } catch (_) { structured = null; }
    }
  }

  // Lint for banned terms in the draftBody specifically
  let bannedHits = [];
  if (structured && structured.draftBody) {
    bannedHits = lintBannedTerms(structured.draftBody);
    // If banned terms found, force readyToSign = false
    if (bannedHits.length && structured.readyToSign === true) {
      structured.readyToSign = false;
      if (!structured.openItems) structured.openItems = [];
      structured.openItems.push({
        kind: 'SPECIALIST_REVIEW',
        description: 'Internal-vocabulary leak detected: ' + bannedHits.map(h => h.term).join(', '),
        blocking: true
      });
    }
  }

  return {
    ok: true,
    status: resp.status,
    json: json,
    rawText: text,
    structured: structured,
    bannedHits: bannedHits,
    usage: json.usage || null,
    model: json.model || ANTHROPIC_MODEL
  };
}

// ── Handler ──────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (await require('../lib/ai-kill-switch').spendDisabled()) { res.statusCode = 503; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, disabled: true, error: 'AI disabled — billing stopped per operator' })); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  // ADMIN-ONLY: this endpoint spends paid AI. Without a gate it is a public denial-of-wallet
  // faucet the moment LIMEN_AI_ENABLED=1. Require the master key (auto-attached on gated pages).
  var _g = require('../lib/admin-gate');
  if (!_g.isMaster(_g.reqKey(req))) { res.statusCode = 403; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: 'admin only' })); }
  // GET returns runtime config + per-lane section catalog so the
  // client-side multi-pass runner knows how many passes per lane and
  // what each section's identifier + target budget is.
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
        ENDPOINT: ENDPOINT,
        hasApiKey: !!ANTHROPIC_API_KEY,
        apiKeyLength: (ANTHROPIC_API_KEY || '').length,
        nodeVersion: process.version,
        envHasTimeoutOverride: !!process.env.ANTHROPIC_TIMEOUT_MS,
        envTimeoutValue: process.env.ANTHROPIC_TIMEOUT_MS || null,
        envHasModelOverride: !!process.env.ANTHROPIC_MODEL,
        envHasMaxTokensOverride: !!process.env.ANTHROPIC_MAX_TOKENS
      },
      lanes: Object.fromEntries(Array.from(ACTIVE_LANES).map(lane => [lane, LANES[lane]])),
      sections: Object.fromEntries(Array.from(ACTIVE_LANES).map(lane => [lane, LANE_SECTIONS[lane]]))
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
    if (!r.ok) {
      res.statusCode = r.status || 502;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: r.reason || 'upstream-error', detail: r.detail }));
    }

    const contentHash = hash(r.rawText || '');

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      ok: true,
      lane: body.lane,
      cik: body.cik || null,
      sourcePatternSig: body.sourcePatternSig,
      model: r.model,
      usage: r.usage,
      draftBody: r.structured && r.structured.draftBody || r.rawText,
      structured: r.structured,
      bannedHits: r.bannedHits,
      provenance: {
        generatedAt: Date.now(),
        generatedAtISO: new Date().toISOString(),
        contentHash: contentHash,
        llmModel: r.model,
        anthropicVersion: ANTHROPIC_VERSION,
        endpoint: ENDPOINT,
        formatStandard: r.structured && r.structured.structured && r.structured.structured.format_standard || null
      }
    }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
