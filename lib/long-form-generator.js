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
  research:   { 1: 'Title, Hypotheses, Rationale, Data Collection, Study Design Overview, and Study 1', 2: 'the remaining Studies (2, 3, ...), Analysis Plan, Sample Size Justification, Confounds, A Priori Exclusions, Open Materials/Data, and Timeline & Commitments' },
  investment: { 1: 'Thesis, The Pattern, and Signals / Evidence', 2: 'Direction & Structure, Catalyst, Risks & Disconfirmation (incl. steelman), and Position Sizing & Horizon' }
};

const SYSTEMS = { research: RESEARCH_SYSTEM, investment: INVESTMENT_SYSTEM };

// Per-lane render intensity — the tunable "settings" knob (one line per lane).
// maxTokens = synchronous-safe budget (a single render caps ~6000 tokens / ~60s before
// the HTTP-gateway 504). fullTokens = the intended depth, reachable via the SECTIONED
// render (generate section-by-section, assemble) — the way to make patent genuinely
// more intensive than grant without timing out.
const LANE_CONFIG = {
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
      + (lane === 'investment' ? 'an investment thesis memo' : 'a preregistration')
      + ' document. The applicant/assignee entity is ' + APPLICANT.legalName + ' (' + APPLICANT.entityType + ', ' + APPLICANT.state + ') — use this EXACT legal name throughout; NEVER invent another company name. Leave EIN/UEI/PI-name/salary as [[PLACEHOLDER: ...]]. '
      + (part
          ? ('Generate ONLY PART ' + part + ' of 2: ' + ((PART_SPLIT[lane] && PART_SPLIT[lane][part]) || 'this half') + '. Do NOT repeat sections belonging to the other part. Produce a complete, self-contained file segment'
             + (Number(part) === 2 ? ', beginning directly with the first section listed (it continues a Part 1 that already covered the earlier sections; do not re-emit the title page or earlier sections).' : '.'))
          : 'Target a complete, well-structured document.')
  };
  return JSON.stringify(ctx);
}

async function generate({ lane, seedArtifact, bridge, portal, maxTokens, agency, part }) {
  if (lane === 'patent' || lane === 'grant' || lane === 'sba' || lane === 'franchise') return { ok: false, error: 'lane retired: ' + lane + ' (active lanes: investment, research)' };
  const system = SYSTEMS[lane];
  if (!system) return { ok: false, error: 'no long-form system prompt for lane: ' + lane + ' (supported: research, investment)' };
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
