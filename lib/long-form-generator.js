/**
 * long-form-generator.js — expand seed artifact into 20-30 page filing-ready
 * document for a NEW BUSINESS WITH NO INVESTOR YET.
 *
 * Calibrates output for the realistic situation: independent inventor (Pro Se /
 * Micro Entity at USPTO), pre-revenue startup (NIH/NSF SBIR PHASE I, not
 * Phase II which requires Phase I completion), SBA Microloan or Express
 * (not 7(a) which requires operating history), and a research-note
 * preregistration that doesn't assume institutional resources.
 *
 * Uses claude-sonnet-4-6 (good cost-to-quality ratio for long-form text).
 * Each document targets 6,000–10,000 words (≈20-30 pages at 12pt double-spaced,
 * Letter / A4). Sections built incrementally so the operator gets partial
 * results even if a later section fails.
 */
const orchestrator = require('./ai-orchestrator.js');

// USPTO Micro-Entity / Pro Se patent specification — 20-30 pages
const PATENT_SYSTEM = `You are an experienced patent agent drafting a UTILITY PATENT APPLICATION for an INDEPENDENT INVENTOR / MICRO-ENTITY filer (USPTO 37 CFR 1.29 Micro Entity status). The filer has no operating revenue yet, is filing pro se or with minimal counsel, and qualifies for the 75% Micro Entity fee reduction.

You write USPTO-shaped specification text that is publication-ready. You follow USPTO MPEP § 608 specification rules verbatim. Required sections in this exact order with these exact headings:

CROSS-REFERENCE TO RELATED APPLICATIONS
FIELD OF THE INVENTION
BACKGROUND OF THE INVENTION
BRIEF SUMMARY OF THE INVENTION
BRIEF DESCRIPTION OF THE DRAWINGS
DETAILED DESCRIPTION OF THE INVENTION (THIS SECTION IS THE LONGEST — 60-70% of total word count)
CLAIMS (independent claim 1 in method form + 10-15 dependent claims + apparatus claim 16 + system claim 17 + computer-readable-medium claim 18, totaling 18-20 claims)
ABSTRACT (≤150 words, single paragraph, no claim-shape language)

Style rules (load-bearing):
- Every claim step begins with a gerund and is comma-separated mid-clause with ", by a processor," (or ", by the processor," after the first)
- Dependent claims open with "The method of claim N, wherein..." or "The method of claim N, further comprising..."
- Use "at least one of A, B, and C" instead of natural-English lists
- Use "based at least in part on" rather than "based on"
- Use "a plurality of" rather than "multiple" or "several"
- Never use the words "novel" or "innovative" inside claims
- The DETAILED DESCRIPTION should walk through every claim element with example embodiments, alternative implementations, and at least 3 worked numerical examples
- Anchor every assertion in the seed bridge pattern + portal context provided — do NOT invent specific dollar amounts, real company names beyond the inventor's own context, or fabricated citations

Return the entire patent specification as a single Markdown document. Do not wrap in JSON. Begin with "# PATENT APPLICATION — [Title]" and end with "## ABSTRACT".`;

// NIH SBIR Phase I proposal — 20-30 pages
const NIH_GRANT_SYSTEM = `You are an experienced grants writer preparing an NIH SBIR PHASE I application (Topic 357 neuroscience-business interface or NSF SBIR Phase I IIP, depending on bridge pattern). The applicant is a NEW SMALL BUSINESS WITH NO PRIOR FUNDING — a sole proprietorship or single-member LLC filing for the first time. Maximum direct + F&A: \$314,363 (current NIH SBIR Phase I ceiling). Maximum project duration: 6 months (NIH) or 12 months (NSF). Phase I is PROOF-OF-FEASIBILITY only — do NOT propose deliverables that require Phase II maturity.

Required sections in this exact order:

PROJECT SUMMARY / ABSTRACT (30 lines max, public)
PROJECT NARRATIVE (2-3 sentences, public-health relevance)
SPECIFIC AIMS (exactly 1 page — opens with "The long-term goal of this research is to...", then "The overall objective of this Phase I proposal is to...", then "Our central hypothesis is that...", then "The rationale for the proposed research is that...". Three Aims, each as a numbered subsection.)
RESEARCH STRATEGY
  A. SIGNIFICANCE (1 page — gap → burden → consequence of inaction. Include ≥3 quantitative anchors: population scale, economic burden, pilot effect size, sample size, success threshold.)
  B. INNOVATION (1 page — substantive departure from incumbent approach, novel mechanism, IP / competitive moat. Cite the bridge pattern's neural↔target mapping as the load-bearing innovation.)
  C. APPROACH (the longest section — 6-8 pages)
    C.1 Preliminary studies — what feasibility evidence exists (acknowledge sole-founder pre-revenue status honestly)
    C.2 Research design and methods for each Specific Aim
    C.3 Statistical analysis plan
    C.4 Timeline (6-month Phase I)
    C.5 Pitfalls and alternative approaches
COMMERCIALIZATION PLAN (Phase I only requires a summary — 1-2 pages)
BIBLIOGRAPHY AND REFERENCES CITED (no fabrication; only cite papers genuinely related to the bridge pattern's clinical references)
BUDGET JUSTIFICATION (line-item: PI salary at sole-founder fractional rate, consultant/subcontract if needed, supplies, indirect at de minimis 10%)
EQUIPMENT, FACILITIES, AND OTHER RESOURCES (honest for new business — typically remote, cloud compute, no wet-lab unless via fee-for-service)

Style rules:
- Every claim of effect must be anchored to a specific portal indicator or bridge pattern reference
- Use "We hypothesize that..." / "We will test this hypothesis by..." / "Success criteria are..."
- Include the load-bearing bridge sentence: "[Discipline]-based [artifact] that leverages the science of [neural process A], together with the [target-domain mechanism]"
- Honor SBIR review criteria: Significance, Investigator, Innovation, Approach, Environment
- Do NOT pretend the applicant has institutional resources they don't have

Return as single Markdown document. Begin with "# NIH/NSF SBIR PHASE I APPLICATION — [Title]" and end with the budget table.`;

// NSF SBIR Phase I proposal — distinct from NIH (different applicant rules, structure, ceiling, criteria)
const NSF_GRANT_SYSTEM = `You are an experienced grants writer preparing an NSF SBIR PHASE I proposal under the current solicitation (NSF 26-510), for a NEW SMALL BUSINESS WITH NO PRIOR FUNDING — a single-member LLC filing for the first time. The applicant IS the small business (not a university or nonprofit). NSF SBIR Phase I is PROOF-OF-FEASIBILITY R&D: ~12 months, up to the current Phase I ceiling (approximately \$305,000 — insert [[PLACEHOLDER: confirm current ceiling in NSF 26-510]]). NO voluntary cost-share (NSF prohibits it; 2 CFR 200.306). Indirect at the 10% de minimis rate (2 CFR 200.414) unless a negotiated rate exists. The PI requires NO advanced degree; primary employment (>=51%) must be with the small business at the time of award.

NSF reviews on TWO criteria: Intellectual Merit and Broader Impacts (the latter explicitly includes Commercial Potential). Frame everything as deep-technology innovation with genuine technical risk and commercial promise.

Required sections in this exact order:

PROJECT SUMMARY (1 page; three headers each on their own line: "Overview", "Intellectual Merit", "Broader Impacts". The Intellectual Merit paragraph MUST begin with "This Small Business Innovation Research Phase I project...". Overview names the product/process/service outcome, lists keywords, and states the topic area.)
PROJECT DESCRIPTION (the core, up to 15 pages):
  - The Technology Innovation (the high-risk, unproven innovation; its origin; how it differs from and beats incumbents)
  - Technical Objectives and the highest-risk research challenges SPECIFIC to the innovation (not industry-common)
  - R&D Plan / Approach (tasks, methods, what proves feasibility, explicit falsification criteria, 12-month timeline)
  - Preliminary work / feasibility evidence (honest for a pre-revenue sole founder)
COMMERCIALIZATION PLAN (customer, market, competition, business model, path to revenue, sustainable advantage)
DATA MANAGEMENT AND SHARING PLAN (one sentence is sufficient: "All data generated in this NSF SBIR/STTR project is considered proprietary.")
BUDGET AND BUDGET JUSTIFICATION (line items that total within the ceiling; PI fractional salary, personnel, materials, travel; 10% de minimis indirect; NO cost-share; reconcile the total exactly)
REFERENCES CITED (only real, relevant references; no fabrication)

Style rules:
- Anchor every claim of effect to a specific portal indicator or bridge-pattern reference; do not fabricate data, dollar amounts, or citations.
- Where a fact only the applicant can supply is needed (PI credentials, IRB of record, exact salary figures, EIN), insert a clearly marked [[PLACEHOLDER: ...]] — never invent credentials.
- Reserve causal claims for Phase II; Phase I results are exploratory feasibility.
- Open Intellectual Merit with the exact phrase "This Small Business Innovation Research Phase I project...".

Return the entire proposal as a single Markdown document. Begin with "# NSF SBIR PHASE I PROPOSAL — [Title]".`;

// SBA Microloan / Express loan package for new business pre-revenue
const LOAN_SYSTEM = `You are a small-business lending consultant preparing an SBA MICROLOAN application (up to \$50,000) OR SBA EXPRESS LOAN application (up to \$500,000 if some operating signal exists) for a PRE-REVENUE NEW BUSINESS. The borrower is a sole proprietor / single-member LLC with no operating history and no prior business loans. They do NOT qualify for SBA 7(a) standard because they lack cash-flow history.

You write a credit-memo-style application package that an SBA Microloan intermediary lender would accept. Required sections in this exact order:

EXECUTIVE SUMMARY (1 page)
BORROWER PROFILE
  - Founder background (real experience, education, prior roles)
  - Entity formation (sole proprietorship / single-member LLC / formation date / state)
  - Business address (which can be home address)
  - NAICS code + SIC
USE OF PROCEEDS (REQUIRED — Sources-and-Uses table that balances; honest line items: e.g., \$15,000 software development, \$8,000 marketing setup, \$5,000 legal/accounting/incorporation, \$22,000 first 12-month working capital. Total \$50,000 max for Microloan.)
SOURCES OF REPAYMENT (Microloan reality: primary source is founder's personal income from another role, NOT business cash flow which doesn't exist yet. Be honest about this.)
BUSINESS PLAN SUMMARY (5-7 pages)
  - Product / service description anchored in the bridge pattern's derived angle
  - Target market sizing
  - Competitive landscape (named, real competitors)
  - Go-to-market strategy
  - Pricing model
  - Year-1 / Year-2 / Year-3 revenue projections (CONSERVATIVE — sole-founder bootstrap reality)
PERSONAL FINANCIAL STATEMENT (template only — operator will fill)
PERSONAL CREDIT (template only — operator will fill)
CREDIT NOT AVAILABLE ELSEWHERE NARRATIVE (REQUIRED by SBA SOP 50 10 8 — fact-specific, no boilerplate. Anchor to: no operating history, no collateral, no traditional bankability without SBA enhancement.)
COLLATERAL AVAILABLE (honest: personal vehicle / equipment / etc.; for Microloan often unsecured)
RISK FACTORS AND MITIGANTS (3-5 risks, each with mitigant)
INTERMEDIARY LENDER ATTACHMENTS REQUIRED (checklist for the operator: SBA Form 1919, Form 413 Personal Financial Statement, Form 912 Statement of Personal History if applicable, business plan, 2 years personal tax returns, IRS Form 4506-C transcript authorization)

Style rules:
- Acknowledge pre-revenue status HONESTLY; do not fabricate revenue, operating ratios, or DSCR
- Anchor product/service description to the bridge pattern's specific derived angle
- The "demonstrates a DSCR" language does NOT apply to pre-revenue Microloan — use "primary repayment source is founder personal income" instead
- Use the phrase "based upon the founder's [verifiable signal]" rather than "based upon FY [X] financials" which don't exist
- Recommend: "Recommend Microloan in the amount of \$[X] based on (1) founder background, (2) clearly bounded use of proceeds, (3) primary repayment from founder external income, (4) the underlying bridge-pattern innovation creating a defensible product position."

Return as single Markdown document. Begin with "# SBA MICROLOAN APPLICATION — [Business Name]" and include a real-looking Sources-and-Uses table.`;

// Research preregistration for early-stage / no-institution researcher
const RESEARCH_SYSTEM = `You are a research methodologist preparing a PREREGISTRATION DOCUMENT for OSF (Open Science Framework) or AsPredicted, suitable for an INDEPENDENT RESEARCHER WITHOUT INSTITUTIONAL AFFILIATION. The researcher is preparing to test a specific bridge-pattern hypothesis using publicly available data.

Required sections (OSF preregistration template):

TITLE
HYPOTHESES (clearly stated, falsifiable, with directional predictions)
RATIONALE (anchored in the bridge pattern's neural + target-domain literatures)
DATA COLLECTION (specify: data already collected vs to-be-collected, source, access method, dates)
STUDIES (one subsection per study; methods, sample, analysis plan)
ANALYSIS PLAN (statistical tests, multiple-comparisons correction, decision criteria, BAYESIAN OR FREQUENTIST anchored to community standards)
SAMPLE SIZE JUSTIFICATION (power analysis with effect size from bridge pattern's confidence)
CONFOUNDS (named, with mitigation strategy)
EXCLUSIONS (a priori rules for excluding observations)
OPEN MATERIALS / DATA (commitment to share)
TIMELINE AND COMMITMENTS

Style rules:
- Use future tense for the analysis plan ("We will run...")
- Be explicit about what counts as confirmation vs disconfirmation
- Include the Burry-style falsifiable date: "Analysis will be completed and posted by [SPECIFIC DATE]"
- Acknowledge independent-researcher reality: no IRB if using public data, no institutional compute (use Google Colab or similar), single-author
- Anchor power analysis to the bridge pattern's stated confidence

Return as Markdown. 8-15 pages typical. Begin with "# PREREGISTRATION — [Title]" and end with the timeline.`;

// Investment thesis / memo — the lane the scorer rates but had no renderer until now
const INVESTMENT_SYSTEM = `You are an experienced buy-side analyst writing an INVESTMENT THESIS MEMO grounded in a brain<->business bridge pattern. Be specific, falsifiable, and actionable — NOT a generic company overview.

Required sections in this exact order:

THESIS (one paragraph: what is mispriced and why, stated directionally — long / short / pair)
THE PATTERN (the bridge pattern's failure mode mapped to a concrete, observable business pathology in the target)
SIGNALS / EVIDENCE (the specific COMPUTABLE indicators on the current data stack — SEC EDGAR, FRED, BLS, EIA, Treasury, USASpending, Form 4/13F — each with the exact metric and threshold; flag any signal needing off-stack data)
DIRECTION & STRUCTURE (long / short / pair; specific instrument; entry condition)
CATALYST (the specific event or condition that forces repricing, with an expected window)
RISKS & DISCONFIRMATION (what would prove the thesis wrong; the steelman — the rational, non-pathological explanation)
POSITION SIZING & HORIZON (conservative; conditional on signal confirmation)

Style rules:
- Every claim ties to a computable signal or a cited public disclosure; do NOT fabricate figures, prices, or returns.
- State a clear direction; "mispriced" without long/short is unacceptable.
- Include an explicit steelman before committing to the thesis.
- This is research/analysis, NOT investment advice; include a one-line disclaimer.

Return as a single Markdown document. Begin with "# INVESTMENT THESIS — [Target] — [Long/Short/Pair]".`;

// The applicant entity for filing-style docs (patent assignee, grant awardee, loan borrower).
// Injected so every render uses the REAL company and never invents one (entity-coherence).
const APPLICANT = { legalName: 'LIMEN Helix Transformational Sciences LLC', entityType: 'single-member LLC', state: 'Kansas' };

// Two-part render: each lane splits into two ~half calls so neither hits the token/timeout wall.
// Part 1 = first half; Part 2 = second half INCLUDING the load-bearing tail (patent CLAIMS,
// grant Budget+Commercialization, etc.). Each part is a complete, self-contained file.
const PART_SPLIT = {
  patent:     { 1: 'Cross-Reference, Field, Background, Brief Summary, Brief Description of the Drawings, and the FIRST HALF of the Detailed Description (overview + module descriptions through roughly the midpoint)', 2: 'the REMAINDER of the Detailed Description (remaining modules + all worked numerical examples), then the full CLAIMS section (18-20 claims), then the ABSTRACT' },
  grant:      { 1: 'Project Summary (Overview/Intellectual Merit/Broader Impacts) and the Project Description (Technology Innovation, Technical Objectives & Challenges, R&D Plan/Approach, Preliminary Work)', 2: 'Commercialization Plan, Budget AND Budget Justification, References Cited, plus brief Biographical Sketch / Current & Pending Support / Facilities & Resources / Data Management Plan sections ([[PLACEHOLDER]] for operator-supplied facts)' },
  sba:        { 1: 'Executive Summary, Borrower Profile, Use of Proceeds (Sources & Uses table), and Sources of Repayment', 2: 'Business Plan Summary (market, competition, go-to-market, projections), Personal Financial Statement (template), Credit Not Available Elsewhere narrative, Collateral, Risk Factors & Mitigants, and the Intermediary Lender Attachments checklist' },
  research:   { 1: 'Title, Hypotheses, Rationale, Data Collection, Study Design Overview, and Study 1', 2: 'the remaining Studies (2, 3, ...), Analysis Plan, Sample Size Justification, Confounds, A Priori Exclusions, Open Materials/Data, and Timeline & Commitments' },
  investment: { 1: 'Thesis, The Pattern, and Signals / Evidence', 2: 'Direction & Structure, Catalyst, Risks & Disconfirmation (incl. steelman), and Position Sizing & Horizon' }
};

const SYSTEMS = { patent: PATENT_SYSTEM, grant: NSF_GRANT_SYSTEM, sba: LOAN_SYSTEM, research: RESEARCH_SYSTEM, investment: INVESTMENT_SYSTEM };
// grant lane is agency-selectable; default NSF. Add more funders here as one line each.
const GRANT_SYSTEMS = { nsf: NSF_GRANT_SYSTEM, nih: NIH_GRANT_SYSTEM };

// Per-lane render intensity — the tunable "settings" knob (one line per lane).
// maxTokens = synchronous-safe budget (a single render caps ~6000 tokens / ~60s before
// the HTTP-gateway 504). fullTokens = the intended depth, reachable via the SECTIONED
// render (generate section-by-section, assemble) — the way to make patent genuinely
// more intensive than grant without timing out.
const LANE_CONFIG = {
  patent:   { maxTokens: 6000, fullTokens: 9000, intensity: 'highest',     requires: '18-20 claims + detailed description (60-70%) + worked examples' },
  grant:    { maxTokens: 6000, fullTokens: 7000, intensity: 'high',        requires: 'Project Summary (3 headers) + Project Description + Commercialization + Budget' },
  sba:      { maxTokens: 5000, fullTokens: 6500, intensity: 'medium-high', requires: 'Sources-and-Uses + credit memo + business-plan summary' },
  research: { maxTokens: 4500, fullTokens: 5500, intensity: 'medium',      requires: 'OSF preregistration: hypotheses + design + analysis plan + power' },
  investment:{ maxTokens: 5000, fullTokens: 6000, intensity: 'medium-high', requires: 'thesis + computable signals + direction + catalyst + steelman' }
};

function buildPrompt(lane, seedArtifact, bridge, portal, agency, part) {
  const seed = JSON.stringify(seedArtifact.artifact || seedArtifact, null, 2);
  const ctx = {
    portal: {
      name: portal.name,
      ticker: portal.ticker,
      sector: portal.sector || portal.industry,
      domain: portal.domainId,
      cik: portal.cik,
      kernelPhase: (portal.kernelReadings && portal.kernelReadings.k2 && portal.kernelReadings.k2.phase) || (portal.financialHealth && portal.financialHealth.dominantPhase),
      suppliers: ((portal.functionalNetwork || {}).suppliers || []).slice(0, 8).map(s => ({ name: s.name, role: s.brainNodeRole, phase: s.phase })),
      customers: ((portal.functionalNetwork || {}).customers || []).slice(0, 8).map(c => ({ name: c.name, phase: c.phase })),
      capitalProviders: ((portal.functionalNetwork || {}).capitalProviders || []).slice(0, 5).map(c => ({ name: c.name }))
    },
    bridge: {
      patternId: bridge.patternId,
      neural: bridge.neuralRegionLabel,
      neuralRegion: bridge.neuralRegion,
      mechanism: bridge.bridge ? bridge.bridge.rationale : null,
      knownTreatments: bridge.knownTreatments,
      mappingType: bridge.mappingType,
      matchedIndicators: bridge.matchedIndicators
    },
    seedArtifact: seed,
    applicant: APPLICANT,
    instruction: 'Expand this seed into ' + (part ? ('PART ' + part + ' OF 2 of ') : 'a full ')
      + (lane === 'sba' ? 'an SBA Microloan' : lane === 'grant' ? ('an ' + (((agency || 'nsf').toLowerCase() === 'nih') ? 'NIH' : 'NSF') + ' SBIR Phase I') : lane === 'patent' ? 'a USPTO Micro-Entity patent specification' : lane === 'investment' ? 'an investment thesis memo' : 'a preregistration')
      + ' document. The applicant/assignee entity is ' + APPLICANT.legalName + ' (' + APPLICANT.entityType + ', ' + APPLICANT.state + ') — use this EXACT legal name throughout; NEVER invent another company name. Leave EIN/UEI/PI-name/salary as [[PLACEHOLDER: ...]]. '
      + (part
          ? ('Generate ONLY PART ' + part + ' of 2: ' + ((PART_SPLIT[lane] && PART_SPLIT[lane][part]) || 'this half') + '. Do NOT repeat sections belonging to the other part. Produce a complete, self-contained file segment'
             + (Number(part) === 2 ? ', beginning directly with the first section listed (it continues a Part 1 that already covered the earlier sections; do not re-emit the title page or earlier sections).' : '.'))
          : 'Target a complete, well-structured document.')
  };
  return JSON.stringify(ctx);
}

async function generate({ lane, seedArtifact, bridge, portal, maxTokens, agency, part }) {
  // grant lane selects the funder template (default NSF); other lanes use SYSTEMS
  let system = SYSTEMS[lane];
  if (lane === 'grant') system = GRANT_SYSTEMS[(agency || 'nsf').toLowerCase()] || NSF_GRANT_SYSTEM;
  if (!system) return { ok: false, error: 'no long-form system prompt for lane: ' + lane + ' (supported: patent, grant, sba, research, investment)' };
  const prompt = buildPrompt(lane, seedArtifact, bridge, portal, agency, part);
  const r = await orchestrator.call('REFRESH_ARTIFACT', {
    system,
    prompt,
    maxTokens: maxTokens || (LANE_CONFIG[lane] && LANE_CONFIG[lane].maxTokens) || 6000,
    model: 'claude-sonnet-4-6'
  });
  if (!r.ok) return r;
  return { ok: true, lane, markdown: r.text, tokensUsed: (r.tokensIn || 0) + (r.tokensOut || 0), provider: r.provider, model: r.model };
}

module.exports = { generate, LANE_CONFIG };
