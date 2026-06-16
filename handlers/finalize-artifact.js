/**
 * api/finalize-artifact.js
 *
 * MB-D.1 — OpenAI-powered artifact finalizer.
 *
 * Expands an MB-C draft package + optional MB-D deterministic finalized
 * document + optional Council critique/objectionLedger into a longer,
 * polished, lane-specific FINAL DRAFT ONLY document. NO LLM authority
 * to submit, file, fund, trade, approve, validate, or route anything.
 *
 * POST /api/finalize-artifact
 *   body: {
 *     lane:                  string,                // required
 *     intakeItem:            object | null,         // MB-A intake (optional, for traceability)
 *     package:               object,                // MB-C draft_package_only (required)
 *     deterministicFinalized: object | null,        // MB-D final_draft_only (optional, used as scaffold)
 *     critique:              object | null,         // Grok critique structure (optional)
 *     objectionLedger:       array  | null,         // server-derived ledger entries (optional)
 *     options:               { temperature }        // optional
 *   }
 *
 * Behavior:
 *   - Mirrors api/expand-artifact.js + api/critique-artifact.js D3-F.1
 *     hardening: 90s per-attempt timeout, ONE retry on AbortError only,
 *     structured AI_UPSTREAM_TIMEOUT on final timeout, per-route
 *     module.exports.config.maxDuration = 300.
 *   - Calls OpenAI Chat Completions via native fetch (no SDK).
 *   - Returns a strict-JSON expanded final-draft object. Plain-text
 *     responses are rejected with AI_PARSE_ERROR.
 *   - Server-side anti-overclaim verification on every successful
 *     response: lane-specific antiOverclaim flags, prohibited-language
 *     scan over generated markdown (excluding negation blockquotes
 *     and source-evidence appendix code blocks), required-section
 *     presence check.
 *   - NO persistence layer. NO durable storage. The response is
 *     returned to the caller; whether it is downloaded, copied, or
 *     discarded is the operator's choice. MB-E will add durable
 *     workspace/version ledger; MB-D.1 does not.
 *   - executionAllowed === false on every successful response. Any
 *     attempt to set true is overridden.
 *
 * Required env vars:
 *   - OPENAI_API_KEY_D3B (preferred) OR OPENAI_API_KEY (fallback)
 *   - OPENAI_MODEL (no default; endpoint returns 501 if absent)
 *
 * Schema versions:
 *   - API request/response:   MB-D.1.api.v1
 *   - OpenAI expansion JSON:  MB-D.1.openai.v1
 *
 * Supported lanes:
 *   patents, business-grants, research-grants, nsf-project-pitch,
 *   sba-loans, investments. Anything else → 400 UNSUPPORTED_LANE.
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────

var MAX_BODY_BYTES        = 512 * 1024;       // 512KB cap (input includes pkg + finalized + ledger)
var DEFAULT_TEMPERATURE   = 0.2;              // long-form draft benefits from low randomness
var MAX_TEMPERATURE       = 0.5;
var AI_TIMEOUT_MS         = 90 * 1000;        // 90s per attempt (mirrors D3-F.1)
var MAX_ATTEMPTS          = 2;                // initial + 1 retry on AbortError only
var OPENAI_ENDPOINT       = 'https://api.openai.com/v1/chat/completions';
var EXPANSION_SCHEMA_VERSION = 'MB-D.1.openai.v1';
var API_SCHEMA_VERSION    = 'MB-D.1.api.v1';
var MIN_MARKDOWN_BYTES    = 1500;             // absolute sanity floor — below this is hard-rejected
var SUBSTANTIAL_MD_BYTES  = 4000;             // legacy lane-agnostic floor (kept for back-compat warnings)

// MB-D.1.1 — lane-agnostic OpenAI completion-token ceiling. Without
// this, OpenAI's model default (~4096 on legacy chat models) caps the
// output at ~650 words even when the prompt asks for long-form. Setting
// max_completion_tokens to 16000 lets a typical patent-style draft
// reach 10–12k words while still leaving headroom under modern model
// context windows. This is a CEILING, not a target — the model will
// stop early if the JSON object is complete.
var MAX_COMPLETION_TOKENS = 16000;

var PATENTS_LANE   = 'patents';
var BUSINESS_GRANT = 'business-grants';
var RESEARCH_GRANT = 'research-grants';
var NSF_LANE       = 'nsf-project-pitch';
var SBA_LANE       = 'sba-loans';
var INVEST_LANE    = 'investments';

// ─── Internal-system-language patterns (lane-agnostic) ────────────────
// Same set as critique-artifact.js. Hits on these are soft-warned —
// they flip guards.externalLanguageClean to false but never block.
var INTERNAL_LANGUAGE_PATTERNS = [
  { pattern: /\bLIMEN\b/,                reason: 'LIMEN brand reference' },
  { pattern: /\bArtifactPacket\b/,       reason: 'ArtifactPacket identifier' },
  { pattern: /\bstressBand\b/,           reason: 'stressBand identifier' },
  { pattern: /\bdomain\s+stress\b/i,     reason: 'domain-stress phrase' },
  { pattern: /\bdiagnosis\b/i,           reason: 'diagnosis terminology' },
  { pattern: /\bGRID_COLLAPSE\b/,        reason: 'literal diagnosis label' },
  { pattern: /\bOFC\b/,                  reason: 'brain-node label' },
  { pattern: /\banti_overclaim\b/,       reason: 'anti_overclaim identifier' },
  { pattern: /\breadyForGeneration\b/,   reason: 'readyForGeneration identifier' },
  { pattern: /\bsourceOpportunityId\b/,  reason: 'sourceOpportunityId identifier' }
];

// ─── Lane antiOverclaim flag specs ───────────────────────────────────
// These are the flag names the lane handler requires the model to
// emit, all === true, in its antiOverclaim object. Server verifier
// rejects on any missing or non-true.
var PATENTS_FLAGS = {
  didNotClaimPatentability:           true,
  didNotClaimNoveltyEstablished:      true,
  didNotClaimNonObviousnessEstablished: true,
  didNotClaimEnablementSufficient:    true,
  didNotClaimFtoClearance:            true,
  didNotClaimFilingReadiness:         true,
  didNotClaimLegalAdvice:             true,
  didNotClaimSubmission:              true
};

var GRANT_FLAGS = {
  didNotClaimAward:                          true,
  didNotClaimAgencyEndorsement:              true,
  didNotClaimEligibilityApproval:            true,
  didNotClaimSubmissionReadiness:            true,
  didNotClaimIntellectualMeritEstablished:   true,
  didNotClaimBroaderImpactsAchieved:         true,
  didNotClaimReviewerConsensus:              true,
  didNotClaimPriorAwardSuccess:              true,
  didNotClaimFundingGuaranteed:              true
};

var SBA_FLAGS = {
  didNotClaimLoanApproval:        true,
  didNotClaimEligibilityApproval: true,
  didNotClaimUnderwritingApproval: true,
  didNotClaimGuaranteedFunding:   true,
  didNotClaimReadyToClose:        true,
  didNotClaimSbaEndorsement:      true
};

var INVESTMENT_FLAGS = {
  didNotGiveBuySellInstruction: true,
  didNotStageOrder:             true,
  didNotExecuteTrade:           true,
  didNotGuaranteeReturn:        true,
  didNotClaimKernelAuthority:   true,
  didNotClaimInvestmentAdvice:  true,
  didNotClaimRiskFree:          true
};

// ─── Forbidden-language patterns per lane ─────────────────────────────
// Narrowed to claim contexts so legitimate vocabulary survives
// (e.g. "personal guarantee" on SBA, "approved trading system"
// referring to operator's external broker). Walked over generated
// markdown EXCLUDING negation blockquotes and fenced code blocks.

var SHARED_FORBIDDEN = [
  { pattern: /\bsubmission[-\s]?ready\b/i,        reason: 'submission readiness' },
  { pattern: /\bfiling[-\s]?ready\b/i,            reason: 'filing readiness' },
  { pattern: /\bis\s+approved\b/i,                reason: 'approval claim' },
  { pattern: /\bguarante(e|ed|es|s)\s+(award|funding|approval|outcome|outcomes|eligibility|return|returns|profit|profits|gains|trade|trades|filing|patent|grant)\b/i, reason: 'guarantee claim' },
  { pattern: /\bbuy\s+now\b/i,                    reason: 'buy now instruction' },
  { pattern: /\bsell\s+now\b/i,                   reason: 'sell now instruction' },
  { pattern: /\bexecute(d)?\s+trade\b/i,          reason: 'trade execution' },
  { pattern: /\bagency\s+endorsement\b/i,         reason: 'agency endorsement' },
  { pattern: /\beligibility\s+approv(ed|al)\b/i,  reason: 'eligibility approval' }
];

var PATENTS_FORBIDDEN = SHARED_FORBIDDEN.concat([
  { pattern: /\bnovel(ty)?\s+(established|proven|confirmed|demonstrated)\b/i, reason: 'novelty established' },
  { pattern: /\bpatentab(le|ility)\s+(established|proven|confirmed|demonstrated|determined)\b/i, reason: 'patentability established' },
  { pattern: /\bready\s+to\s+file\b/i,            reason: 'ready to file' },
  { pattern: /\bfreedom[-\s]to[-\s]operate\s+(cleared|confirmed|established)\b/i, reason: 'FTO cleared' }
]);

var NSF_FORBIDDEN = SHARED_FORBIDDEN.concat([
  { pattern: /\bNSF\s+will\s+fund\b/i,                                 reason: 'NSF funding guarantee' },
  { pattern: /\binvited\s+by\s+NSF\b/i,                                reason: 'NSF invitation claim' },
  { pattern: /\bNSF\s+has\s+indicated\b/i,                             reason: 'NSF indication claim' },
  { pattern: /\bprogram\s+officer\s+has\s+confirmed\b/i,               reason: 'program officer confirmation' },
  { pattern: /\bconsistent\s+with\s+(the\s+)?funded\s+portfolio\b/i,   reason: 'funded-portfolio alignment' },
  { pattern: /\bmeets\s+NSF\s+priorities\b/i,                          reason: 'meets NSF priorities' },
  { pattern: /\btrack\s+record\s+of\s+NSF\s+support\b/i,               reason: 'NSF track record' },
  { pattern: /\bletter\s+of\s+intent\s+(was\s+)?accepted\b/i,          reason: 'LOI accepted' },
  { pattern: /\bconcept\s+paper\s+(was\s+)?approved\b/i,               reason: 'concept paper approved' },
  { pattern: /\bintellectual\s+merit\s+(established|proven|demonstrated|confirmed)\b/i, reason: 'IM established' },
  { pattern: /\bbroader\s+impacts?\s+(achieved|proven|demonstrated|confirmed)\b/i,      reason: 'BI achieved' },
  { pattern: /\breviewer(s)?\s+(will|consensus)\b/i,                                    reason: 'reviewer consensus' }
]);

var GRANT_FORBIDDEN = SHARED_FORBIDDEN; // generic grant lane shares the shared set

var SBA_FORBIDDEN = SHARED_FORBIDDEN.concat([
  { pattern: /\bloan\s+(is\s+)?approved\b/i,                  reason: 'loan approved' },
  { pattern: /\bunderwrit(ing|ten)\s+(approved|complete)\b/i, reason: 'underwriting approved' },
  { pattern: /\bready\s+to\s+close\b/i,                       reason: 'ready to close' },
  { pattern: /\bSBA\s+endorse(d|ment|s)?\b/i,                 reason: 'SBA endorsement' }
]);

var INVESTMENT_FORBIDDEN = SHARED_FORBIDDEN.concat([
  { pattern: /\bplace\s+(an?\s+)?order\b/i,                   reason: 'place order' },
  { pattern: /\bstaging\s+(an?\s+)?order\b/i,                 reason: 'staging order' },
  { pattern: /\brisk[-\s]free\b/i,                            reason: 'risk-free claim' },
  { pattern: /\bguaranteed\s+performance\b/i,                 reason: 'guaranteed performance' },
  { pattern: /\bautomated\s+trading\b/i,                      reason: 'automated trading' }
]);

// ─── Required sections per lane (model must include these or list in missingEvidence/humanReviewItems) ─

// MB-D.1.1 — patents required sections expanded for long-form depth.
// Adds component_descriptions, dependent_claim_idea_bank, implementation_examples,
// data_input_output_examples, figure_descriptions. detailed_description is the
// largest single block; the model is instructed to produce sub-sections under it.
var PATENTS_REQUIRED_SECTIONS = [
  'cover_disclaimer', 'invention_disclosure', 'technical_field', 'background',
  'summary', 'brief_description_of_drawings', 'detailed_description',
  'system_architecture', 'method_flow', 'component_descriptions',
  'example_embodiments', 'variations', 'implementation_examples',
  'data_input_output_examples', 'figure_descriptions',
  'industrial_applicability', 'claim_drafting_workspace',
  'dependent_claim_idea_bank', 'prior_art_search_checklist',
  'inventor_counsel_questions', 'attorney_review_checklist', 'appendix_source_evidence'
];

var GRANT_REQUIRED_SECTIONS = [
  'cover_disclaimer', 'executive_summary', 'problem_need', 'innovation',
  'objectives', 'approach', 'work_plan_milestones', 'expected_outcomes',
  'broader_impacts_public_benefit', 'budget_assumptions_placeholder',
  'team_capability', 'risks_mitigation', 'missing_evidence_eligibility_questions',
  'reviewer_risk_checklist', 'appendix_source_evidence'
];

var SBA_REQUIRED_SECTIONS = [
  'cover_disclaimer', 'business_concept', 'use_of_funds', 'market_need',
  'revenue_model', 'operating_plan', 'staffing_operator_plan',
  'financial_assumptions_placeholder', 'borrower_documentation_checklist',
  'collateral_questions', 'risk_factors', 'lender_questions',
  'sba_lender_review_checklist', 'appendix_source_evidence'
];

var INVESTMENT_REQUIRED_SECTIONS = [
  'cover_disclaimer', 'thesis', 'target_company_ticker', 'kernel_command_board_context',
  'domain_stress_context', 'catalysts', 'bull_case', 'bear_case',
  'invalidation_conditions', 'risk_limits_placeholder', 'position_sizing_placeholder',
  'missing_evidence', 'human_approval_checkpoint', 'appendix_source_evidence'
];

// ─── Lane system prompts ──────────────────────────────────────────────

var PATENTS_SYSTEM_PROMPT = [
  'You are producing a LONG-FORM, STRUCTURED, provisional-patent-style FINAL DRAFT',
  'ONLY document. The output should read like a complete provisional-patent-style',
  'specification, not a brief memo. Aim for 12,000–20,000 words; do not fall below',
  '8,000 words. Each required section must be substantively expanded with sub-',
  'sections, paragraphs, examples, and cross-references. DO NOT summarize. DO NOT',
  'collapse the output into a brief executive memo.',
  '',
  'You are NOT drafting a filing. You are NOT providing legal advice. You are NOT',
  'asserting novelty, patentability, non-obviousness, written-description sufficiency,',
  'enablement, or freedom-to-operate. You are NOT confirming attorney review has',
  'happened. You are NOT staging a submission.',
  '',
  'Hard rules:',
  '- Output strict JSON only. No prose outside JSON. No markdown fences around JSON.',
  '- markdown field carries the document body in Markdown.',
  '- Use blockquotes (>) ONLY for cover/disclaimer text. Negation phrases like',
  '  "NOT filing-ready" / "NOT legal advice" must live inside blockquotes.',
  '- Do NOT use claim-context phrases anywhere outside blockquotes:',
  '  "filing-ready", "ready to file", "is approved", "novel/patentable established",',
  '  "freedom-to-operate cleared", "submission-ready", "guaranteed".',
  '- Carry forward unresolved Council/Grok objections in objectionsUnresolved with',
  '  why they remain unresolved. List addressed objections in objectionsAddressed.',
  '- Mark anything you cannot derive from the source package as missingEvidence or',
  '  humanReviewItems. Never fabricate inventor walkthrough content, prior-art',
  '  references, drawings, or claim text.',
  '- IF detail is missing for a section, DO NOT shorten the section to hide the gap.',
  '  Instead expand the section with explicit inventor/counsel questions, lay out',
  '  the structural skeleton in detail, and list every unknown in missingEvidence',
  '  or humanReviewItems.',
  '- Method steps, embodiments, and claims must be placeholder/scaffold text with',
  '  explicit "(to be completed by inventor + counsel)" notes — but the surrounding',
  '  prose, sub-section headings, and questions should still be fully developed.',
  '- detailed_description should contain multiple sub-sections (### headings) per',
  '  major component or method aspect.',
  '- claim_drafting_workspace must include skeleton independent and dependent',
  '  claim placeholders with explicit "(to be drafted by counsel)" markers.',
  '- dependent_claim_idea_bank should enumerate at least 8–15 hypothetical',
  '  dependent-claim ideas as scaffolding (each with "(to be drafted by counsel)").',
  '- prior_art_search_checklist must list at least 10 concrete search queries,',
  '  databases, and classification hints.',
  '- inventor_counsel_questions must list at least 12 specific open questions for',
  '  the inventor/counsel walkthrough.',
  '',
  'Required JSON shape:',
  '{',
  '  "title": "...",',
  '  "markdown": "...long Markdown body...",',
  '  "sectionIndex": [{"id":"cover_disclaimer","title":"Cover / disclaimer"}, ...],',
  '  "warnings": ["..."],',
  '  "missingEvidence": ["..."],',
  '  "humanReviewItems": ["..."],',
  '  "changesMade": ["..."],',
  '  "objectionsAddressed": [{"objectionId":"...", "addressedHow":"..."}],',
  '  "objectionsUnresolved": [{"objectionId":"...", "reason":"..."}],',
  '  "antiOverclaim": {',
  '    "didNotClaimPatentability": true,',
  '    "didNotClaimNoveltyEstablished": true,',
  '    "didNotClaimNonObviousnessEstablished": true,',
  '    "didNotClaimEnablementSufficient": true,',
  '    "didNotClaimFtoClearance": true,',
  '    "didNotClaimFilingReadiness": true,',
  '    "didNotClaimLegalAdvice": true,',
  '    "didNotClaimSubmission": true',
  '  }',
  '}',
  '',
  'Required Markdown sections (use these exact section IDs in sectionIndex):',
  PATENTS_REQUIRED_SECTIONS.map(function (s) { return '- ' + s; }).join('\n')
].join('\n');

var GRANT_BASE_SYSTEM_PROMPT = [
  'You are producing a LONG-FORM polished grant/project FINAL DRAFT ONLY document.',
  'Aim for 5,000–10,000 words; do not fall below 5,000 words. Expand each required',
  'section with sub-sections (### headings), paragraphs, and concrete examples drawn',
  'only from the supplied source package. DO NOT summarize. DO NOT collapse into a',
  'brief memo.',
  '',
  'You are NOT submitting. You are NOT a sponsoring agency. You are NOT determining',
  'eligibility, awarding funding, endorsing, or predicting reviewer behavior.',
  '',
  'Hard rules:',
  '- Output strict JSON only.',
  '- Use blockquotes (>) ONLY for cover/disclaimer text.',
  '- Do NOT claim funding, endorsement, eligibility approval, submission readiness,',
  '  reviewer consensus, prior-award success, or guaranteed funding anywhere outside',
  '  negation blockquotes.',
  '- Broader impacts and (for NSF) intellectual merit are review CRITERIA TO',
  '  STRENGTHEN, not outcomes that can be claimed established/proven/achieved.',
  '- Mark unknowns explicitly. Never fabricate eligibility, agency contact, LOI/concept-',
  '  paper status, or solicitation specifics.',
  '- IF detail is missing for a section, DO NOT shorten the section to hide the gap.',
  '  Expand with explicit PI/sponsor questions and list every unknown in',
  '  missingEvidence or humanReviewItems.',
  '- work_plan_milestones must include a milestone table or list with measurable',
  '  indicators and target windows; risks_mitigation must enumerate at least 5 risks',
  '  with mitigations; reviewer_risk_checklist must list at least 8 reviewer-side',
  '  concerns.',
  '- Carry forward unresolved Council/Grok objections; do not silently drop them.',
  '',
  'Required JSON shape (same as patents lane but with grant antiOverclaim flags):',
  '{',
  '  "title": "...",',
  '  "markdown": "...",',
  '  "sectionIndex": [{"id":"cover_disclaimer","title":"Cover / disclaimer"}, ...],',
  '  "warnings": [], "missingEvidence": [], "humanReviewItems": [],',
  '  "changesMade": [], "objectionsAddressed": [], "objectionsUnresolved": [],',
  '  "antiOverclaim": {',
  '    "didNotClaimAward": true,',
  '    "didNotClaimAgencyEndorsement": true,',
  '    "didNotClaimEligibilityApproval": true,',
  '    "didNotClaimSubmissionReadiness": true,',
  '    "didNotClaimIntellectualMeritEstablished": true,',
  '    "didNotClaimBroaderImpactsAchieved": true,',
  '    "didNotClaimReviewerConsensus": true,',
  '    "didNotClaimPriorAwardSuccess": true,',
  '    "didNotClaimFundingGuaranteed": true',
  '  }',
  '}',
  '',
  'Required Markdown sections (use these exact section IDs):',
  GRANT_REQUIRED_SECTIONS.map(function (s) { return '- ' + s; }).join('\n')
].join('\n');

var NSF_SYSTEM_PROMPT = GRANT_BASE_SYSTEM_PROMPT + '\n\n' + [
  'NSF SBIR/STTR specifics:',
  '- The Project Pitch is a pre-application; if invited, NSF requests a full proposal.',
  '- Section limits (per published research): 3500 / 3500 / 1750 / 1750 chars on the',
  '  four standard sections of an NSF Project Pitch.',
  '- Do NOT claim "NSF will fund", "invited by NSF", "intellectual merit established",',
  '  "broader impacts achieved", "reviewer consensus", or "prior NSF award success".',
  '- Do NOT invent rubric weights, FY solicitation numbers, R&D split, or topic-to-',
  '  directorate routing.'
].join('\n');

var SBA_SYSTEM_PROMPT = [
  'You are producing a LONG-FORM business/SBA borrower draft FINAL DRAFT ONLY',
  'document. Aim for 5,000–10,000 words; do not fall below 5,000 words. Expand each',
  'required section with sub-sections (### headings), paragraphs, and concrete',
  'examples drawn only from the supplied source package. DO NOT summarize. DO NOT',
  'collapse into a brief memo.',
  '',
  'You are NOT a lender, NOT an underwriter, NOT SBA. You are NOT approving the loan,',
  'determining eligibility, completing underwriting, or guaranteeing funding.',
  '',
  'Hard rules:',
  '- Output strict JSON only.',
  '- Use blockquotes (>) ONLY for cover/disclaimer text.',
  '- Do NOT claim "loan approved", "underwriting complete", "ready to close", "SBA',
  '  endorsement", "guaranteed funding", or "eligibility approved" outside negation',
  '  blockquotes.',
  '- "Personal guarantee" is a banking term and is allowed in operating prose; do not',
  '  paraphrase it as "guarantees" or claim outcomes.',
  '- Pro-forma financials, collateral schedules, and credit decisions belong to the',
  '  borrower\'s accountant and the underwriting lender. Mark these as placeholders.',
  '- IF detail is missing for a section, DO NOT shorten the section to hide the gap.',
  '  Expand with explicit operator/lender questions and list every unknown in',
  '  missingEvidence or humanReviewItems.',
  '- operating_plan should expand into multiple sub-sections (e.g. site/operations,',
  '  hours, customer journey, supplier relationships, key processes, milestones).',
  '- risk_factors must enumerate at least 6 risks with mitigations and contingencies.',
  '- borrower_documentation_checklist must list every category SBA underwriters',
  '  routinely require.',
  '- Carry forward unresolved Council objections; do not silently drop them.',
  '',
  'Required JSON shape (same as patents lane but with SBA antiOverclaim flags):',
  '{',
  '  "title": "...",',
  '  "markdown": "...",',
  '  "sectionIndex": [...],',
  '  "warnings": [], "missingEvidence": [], "humanReviewItems": [],',
  '  "changesMade": [], "objectionsAddressed": [], "objectionsUnresolved": [],',
  '  "antiOverclaim": {',
  '    "didNotClaimLoanApproval": true,',
  '    "didNotClaimEligibilityApproval": true,',
  '    "didNotClaimUnderwritingApproval": true,',
  '    "didNotClaimGuaranteedFunding": true,',
  '    "didNotClaimReadyToClose": true,',
  '    "didNotClaimSbaEndorsement": true',
  '  }',
  '}',
  '',
  'Required Markdown sections (use these exact section IDs):',
  SBA_REQUIRED_SECTIONS.map(function (s) { return '- ' + s; }).join('\n')
].join('\n');

var INVESTMENT_SYSTEM_PROMPT = [
  'You are producing a LONG-FORM INVESTMENT MEMO + risk ledger as FINAL DRAFT ONLY.',
  'Aim for 3,000–6,000 words; do not fall below 3,000 words. Expand thesis,',
  'catalysts, bull case, bear case, invalidation, and risk sections with sub-sections',
  '(### headings), concrete reasoning, and explicit citations to the supplied source',
  'package. DO NOT summarize. DO NOT collapse into a brief memo.',
  '',
  'You are NOT investment advice. You are NOT a registered investment adviser. You',
  'are NOT staging or executing trades. You are NOT recommending purchase or sale of',
  'any security. You are NOT guaranteeing returns. You are NOT treating kernel /',
  'Command Board output as autonomous trading authority.',
  '',
  'Hard rules:',
  '- Output strict JSON only.',
  '- Use blockquotes (>) ONLY for cover/disclaimer text.',
  '- Do NOT use the phrases "buy now", "sell now", "place order", "execute trade",',
  '  "automated trading", "risk-free", "guaranteed return", "guaranteed performance"',
  '  outside negation blockquotes.',
  '- Position sizing and risk limits are PLACEHOLDERS. The analyst, risk officer, and',
  '  compliance must set real values inside an external trading/risk framework.',
  '- Kernel/Command-Board fields are decision support, NOT directives.',
  '- IF detail is missing for a section, DO NOT shorten the section to hide the gap.',
  '  Expand with explicit analyst/risk-officer questions and list every unknown in',
  '  missingEvidence or humanReviewItems.',
  '- catalysts must enumerate at least 4 distinct catalysts with timing windows and',
  '  the source-of-evidence for each.',
  '- bull_case and bear_case must each expand into multiple sub-sections covering',
  '  fundamental, technical-context (read-only), and structural factors.',
  '- invalidation_conditions must list at least 5 specific, falsifiable conditions',
  '  under which the thesis is invalidated.',
  '- Carry forward unresolved Council objections; do not silently drop them.',
  '- Mark unknowns explicitly. Never fabricate ticker, CIK, kernel phase, or',
  '  Command Board fields.',
  '',
  'Required JSON shape (same as patents lane but with investment antiOverclaim flags):',
  '{',
  '  "title": "...",',
  '  "markdown": "...",',
  '  "sectionIndex": [...],',
  '  "warnings": [], "missingEvidence": [], "humanReviewItems": [],',
  '  "changesMade": [], "objectionsAddressed": [], "objectionsUnresolved": [],',
  '  "antiOverclaim": {',
  '    "didNotGiveBuySellInstruction": true,',
  '    "didNotStageOrder": true,',
  '    "didNotExecuteTrade": true,',
  '    "didNotGuaranteeReturn": true,',
  '    "didNotClaimKernelAuthority": true,',
  '    "didNotClaimInvestmentAdvice": true,',
  '    "didNotClaimRiskFree": true',
  '  }',
  '}',
  '',
  'Required Markdown sections (use these exact section IDs):',
  INVESTMENT_REQUIRED_SECTIONS.map(function (s) { return '- ' + s; }).join('\n')
].join('\n');

// ─── LANE_HANDLERS dispatch table ─────────────────────────────────────

// MB-D.1.1 — depthTargetWords / depthMinimumWords drive the
// post-generation depth diagnostic + DEPTH_WARNING. Below the target:
// soft warning. Below the minimum: hard warning (still 200 OK so the
// operator can inspect the output, per task: "Prefer warning first").
// MIN_MARKDOWN_BYTES (1500) remains the absolute hard-reject floor.
var LANE_HANDLERS = {};
LANE_HANDLERS[PATENTS_LANE] = {
  lane:               PATENTS_LANE,
  systemPrompt:       PATENTS_SYSTEM_PROMPT,
  flags:              PATENTS_FLAGS,
  prohibitedPatterns: PATENTS_FORBIDDEN,
  requiredSections:   PATENTS_REQUIRED_SECTIONS,
  depthTargetWords:   12000,
  depthMinimumWords:  8000
};
LANE_HANDLERS[BUSINESS_GRANT] = {
  lane:               BUSINESS_GRANT,
  systemPrompt:       GRANT_BASE_SYSTEM_PROMPT,
  flags:              GRANT_FLAGS,
  prohibitedPatterns: GRANT_FORBIDDEN,
  requiredSections:   GRANT_REQUIRED_SECTIONS,
  depthTargetWords:   7500,
  depthMinimumWords:  5000
};
LANE_HANDLERS[RESEARCH_GRANT] = {
  lane:               RESEARCH_GRANT,
  systemPrompt:       GRANT_BASE_SYSTEM_PROMPT,
  flags:              GRANT_FLAGS,
  prohibitedPatterns: GRANT_FORBIDDEN,
  requiredSections:   GRANT_REQUIRED_SECTIONS,
  depthTargetWords:   7500,
  depthMinimumWords:  5000
};
LANE_HANDLERS[NSF_LANE] = {
  lane:               NSF_LANE,
  systemPrompt:       NSF_SYSTEM_PROMPT,
  flags:              GRANT_FLAGS,
  prohibitedPatterns: NSF_FORBIDDEN,
  requiredSections:   GRANT_REQUIRED_SECTIONS,
  depthTargetWords:   7500,
  depthMinimumWords:  5000
};
LANE_HANDLERS[SBA_LANE] = {
  lane:               SBA_LANE,
  systemPrompt:       SBA_SYSTEM_PROMPT,
  flags:              SBA_FLAGS,
  prohibitedPatterns: SBA_FORBIDDEN,
  requiredSections:   SBA_REQUIRED_SECTIONS,
  depthTargetWords:   7500,
  depthMinimumWords:  5000
};
LANE_HANDLERS[INVEST_LANE] = {
  lane:               INVEST_LANE,
  systemPrompt:       INVESTMENT_SYSTEM_PROMPT,
  flags:              INVESTMENT_FLAGS,
  prohibitedPatterns: INVESTMENT_FORBIDDEN,
  requiredSections:   INVESTMENT_REQUIRED_SECTIONS,
  depthTargetWords:   4500,
  depthMinimumWords:  3000
};

function _isAllowedLane(lane)  { return Object.prototype.hasOwnProperty.call(LANE_HANDLERS, lane); }
function _allowedLanesList()   { return Object.keys(LANE_HANDLERS); }

// ─── Validation gates ─────────────────────────────────────────────────

function _validateInput(body) {
  if (!body || typeof body !== 'object') {
    return { code: 'MALFORMED_REQUEST', http: 400, message: 'Request body must be a JSON object.' };
  }
  var lane = body.lane;
  if (typeof lane !== 'string' || !_isAllowedLane(lane)) {
    return { code: 'UNSUPPORTED_LANE', http: 400,
      message: 'lane must be one of [' + _allowedLanesList().join(', ') + ']; received "' + String(lane) + '".' };
  }
  var pkg = body.package;
  if (!pkg || typeof pkg !== 'object') {
    return { code: 'INSUFFICIENT_PACKAGE', http: 422,
      message: 'package (MB-C draft_package_only) is required.' };
  }
  if (pkg.executionAllowed === true) {
    return { code: 'EXECUTION_NOT_ALLOWED', http: 400,
      message: 'package.executionAllowed must be false.' };
  }
  if (pkg.status !== 'draft_package_only') {
    return { code: 'WRONG_PACKAGE_STATUS', http: 422,
      message: 'package.status must be "draft_package_only" (got "' + String(pkg.status) + '").' };
  }
  if (pkg.lane && pkg.lane !== lane) {
    return { code: 'LANE_PACKAGE_MISMATCH', http: 400,
      message: 'request lane "' + lane + '" does not match package.lane "' + String(pkg.lane) + '".' };
  }
  if (!pkg.sections || typeof pkg.sections !== 'object') {
    return { code: 'INSUFFICIENT_PACKAGE', http: 422,
      message: 'package.sections required.' };
  }
  return null;
}

// ─── Provider config ──────────────────────────────────────────────────

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

// ─── Safe-input projection ────────────────────────────────────────────
// Strip raw evidence to a bounded summary the model can consume without
// blowing the prompt. Carry through MB-D deterministic finalized doc as
// scaffold, and Council critique/objectionLedger if present so the model
// has every objection it must address or carry forward.

// MB-D.1.3 — _buildSourceContext: pulls and organizes all available
// deep source detail from the request body into a single structured
// object the model can consult directly. NO fabrication: missing
// fields are recorded in missingDeepSource[] so the model is told to
// ask inventor/operator questions instead of inventing.
function _buildSourceContext(body) {
  var intk = (body && body.intakeItem)             || {};
  var pkg  = (body && body.package)                || {};
  var det  = (body && body.deterministicFinalized) || null;
  var crit = (body && body.critique)               || null;
  var lgr  = Array.isArray(body && body.objectionLedger) ? body.objectionLedger : [];

  var ap   = (intk && intk.artifactPacket)         || {};
  var idy  = ap.identity                           || {};
  var sig  = ap.signal                             || {};
  var ev   = ap.evidence                           || {};
  var imp  = ap.implementation                     || {};
  var prov = ap.provenance                         || {};
  var lh   = ap.lane_hints                         || {};
  var rawHandoff = (ap.raw && ap.raw.handoffPacket) || null;
  var council = (intk && intk.councilArtifacts)    || null;

  // Identity (de-internalized for prompt — preserve raw in private appendix only).
  var identity = {
    id:                  idy.id || null,
    sourceOpportunityId: idy.sourceOpportunityId || null,
    domain:              idy.domain || null,
    title:               idy.title  || null,
    node:                idy.node   || null,
    diagnoses:           Array.isArray(idy.diagnoses) ? idy.diagnoses.slice(0, 16) : []
  };

  var diagnoses = identity.diagnoses.map(function (d) {
    // Diagnosis labels are internal identifiers (e.g. GRID_COLLAPSE).
    // Render plain-English equivalent by dropping underscores.
    var raw = String(d || '');
    var plain = raw.replace(/_/g, ' ').toLowerCase();
    return { id: raw, plain: plain };
  });

  var domainContext = {
    domain:        identity.domain,
    stress:        (typeof sig.stress === 'number') ? sig.stress : null,
    stressBand:    sig.stressBand || null,
    urgency:       sig.urgency    || null,
    whyNow:        sig.whyNow     || null,
    activeConditions: Array.isArray(sig.activeConditions) ? sig.activeConditions.slice(0, 16) : [],
    valueRange:    sig.valueRange || null,
    window:        sig.window     || null
  };

  var evidence = {
    trigger:            ev.trigger            || null,
    validation:         ev.validation         || null,
    outcome:            ev.outcome            || null,
    failure:            ev.failure            || null,
    moneyChainEvidence: ev.moneyChainEvidence || null,
    whyPays:            ev.whyPays            || null,
    explain:            ev.explain            || null
  };

  var implementation = {
    action:    imp.action    || null,
    doThis:    imp.doThis    || null,
    nextStep:  imp.nextStep  || null,
    target:    imp.target    || null,
    timing:    imp.timing    || null,
    invalidIf: imp.invalidIf || null,
    implementationsList: Array.isArray(imp.implementationsList)
      ? imp.implementationsList.slice(0, 32) : []
  };

  // Treatments / method-candidates / embodiments — pulled from raw
  // handoff packet when builder retained it. handoff-contract.js carries
  // mechanism_candidates, claim_type_candidates, embodiments_outline,
  // operator_targets when present (patents lane). These are NOT always
  // present; absence is reported via missingDeepSource.
  var treatments = [];
  var methodCandidates = [];
  var embodimentCandidates = [];
  var figureCandidates = [];
  if (rawHandoff && typeof rawHandoff === 'object') {
    var rh = rawHandoff;
    if (Array.isArray(rh.treatments))             treatments           = rh.treatments.slice(0, 32);
    if (Array.isArray(rh.mechanism_candidates))   methodCandidates     = rh.mechanism_candidates.slice(0, 32);
    if (Array.isArray(rh.claim_type_candidates))  methodCandidates     = methodCandidates.concat(rh.claim_type_candidates.slice(0, 16));
    if (Array.isArray(rh.embodiments_outline))    embodimentCandidates = rh.embodiments_outline.slice(0, 32);
    if (Array.isArray(rh.figure_placeholders))    figureCandidates     = rh.figure_placeholders.slice(0, 32);
  }

  var sourceFeeds = [];
  if (Array.isArray(prov.feedSources)) {
    for (var i = 0; i < prov.feedSources.length && i < 12; i++) {
      var s = prov.feedSources[i];
      if (!s) continue;
      sourceFeeds.push({
        name:           s.name           || '',
        label:          s.label          || '',
        classification: s.classification || null,
        live:           s.live === true,
        sourceUpdatedAt: s.sourceUpdatedAt || null
      });
    }
  }

  var citationHints = Array.isArray(prov.citationHints) ? prov.citationHints.slice(0, 16) : [];

  var councilOut = null;
  if (council && typeof council === 'object') {
    councilOut = {
      draftStatus:           council.draftStatus    || null,
      critiqueStatus:        council.critiqueStatus || null,
      critiquePresent:       council.critiquePresent === true,
      objectionLedgerLength: (typeof council.objectionLedgerLength === 'number') ? council.objectionLedgerLength : 0,
      objectionSummary:      council.objectionSummary || null,
      reviewedAt:            council.reviewedAt     || null
    };
  }

  var ledgerOut = lgr.slice(0, 32).map(function (e) {
    if (!e || typeof e !== 'object') return null;
    return {
      id:                 e.id || null,
      type:               e.type || null,
      severity:           e.severity || null,
      issue:              typeof e.issue === 'string' ? e.issue.slice(0, 320) : '',
      whyItMatters:       typeof e.whyItMatters === 'string' ? e.whyItMatters.slice(0, 240) : '',
      requiredResponse:   typeof e.requiredResponse === 'string' ? e.requiredResponse.slice(0, 240) : '',
      mustAddressInDraft: e.mustAddressInDraft === true
    };
  }).filter(Boolean);

  // Detect deep-portal fields. handoff-contract.js + downstream
  // brains routinely carry portalDomain/portalTitle/depth/ancestryPath
  // when treatment-grade detail is present. Their absence indicates
  // shallow source.
  var hasDeepPortalFields = false;
  var deepProbe = rawHandoff || ap;
  if (deepProbe && typeof deepProbe === 'object') {
    if (deepProbe.portalDomain || deepProbe.portalTitle ||
        deepProbe.ancestryPath || (typeof deepProbe.depth === 'number' && deepProbe.depth >= 2)) {
      hasDeepPortalFields = true;
    }
  }

  // Missing-source diagnostics — what the model should NOT fabricate.
  var missingDeepSource = [];
  if (!hasDeepPortalFields)              missingDeepSource.push('DEEP_PORTAL_FIELDS_MISSING: portalDomain/portalTitle/ancestryPath/depth not present on packet');
  if (!treatments.length)                missingDeepSource.push('TREATMENTS_MISSING: no L2-L6 treatments carried forward');
  if (!methodCandidates.length)          missingDeepSource.push('METHOD_DETAIL_MISSING: mechanism/claim-type candidates not present; method steps require inventor walkthrough');
  if (!embodimentCandidates.length)      missingDeepSource.push('EMBODIMENT_DETAIL_MISSING: embodiments_outline not present; embodiments require inventor input');
  if (!figureCandidates.length)          missingDeepSource.push('FIGURE_DETAIL_MISSING: figure_placeholders not present; figures must be prepared post-walkthrough');
  if (!implementation.implementationsList.length) missingDeepSource.push('IMPLEMENTATION_STEPS_MISSING: implementationsList empty');
  if (!evidence.moneyChainEvidence)      missingDeepSource.push('MONEY_CHAIN_EVIDENCE_MISSING: evidence.moneyChainEvidence not present');
  if (!sourceFeeds.length)               missingDeepSource.push('SOURCE_FEEDS_MISSING: no provenance.feedSources');
  if (!councilOut || !councilOut.critiquePresent) missingDeepSource.push('COUNCIL_CRITIQUE_MISSING: no Civilization Artifact Council critique summary');

  // Internal-system-language risk hints — what the model should sanitize
  // before public-facing prose.
  var internalLanguageRisk = [];
  if (identity.id && /::/.test(identity.id))                   internalLanguageRisk.push('Composite identity.id contains "::" separator — do not expose in public prose.');
  if (identity.diagnoses.some(function (d) { return /[A-Z_]{4,}/.test(String(d)); })) internalLanguageRisk.push('diagnoses[] contains internal upper_snake labels — translate to plain English.');
  if (deepProbe && (deepProbe.pathway_ref || deepProbe.density)) internalLanguageRisk.push('raw handoff carries pathway_ref/density tokens — do not expose in public prose.');

  // Section snapshot from MB-C package — preserved (not stripped) so
  // the model has the deterministic skeleton alongside the raw source.
  var sectionsOut = {};
  if (pkg && pkg.sections && typeof pkg.sections === 'object') {
    var keys = Object.keys(pkg.sections);
    for (var k = 0; k < keys.length; k++) {
      var v = pkg.sections[keys[k]];
      if (typeof v === 'string' && v.length > 4000) {
        sectionsOut[keys[k]] = v.slice(0, 4000) + ' …[truncated]';
      } else if (v && typeof v === 'object') {
        try { sectionsOut[keys[k]] = JSON.parse(JSON.stringify(v)); } catch (_) {
          sectionsOut[keys[k]] = String(v).slice(0, 4000);
        }
      } else {
        sectionsOut[keys[k]] = v == null ? null : v;
      }
    }
  }

  var detSummary = null;
  if (det && typeof det === 'object') {
    detSummary = {
      title:           det.title || null,
      sectionIndex:    Array.isArray(det.sectionIndex) ? det.sectionIndex.slice(0, 32) : [],
      missingEvidence: Array.isArray(det.missingEvidence) ? det.missingEvidence.slice(0, 32) : [],
      markdownHead:    typeof det.markdown === 'string' ? det.markdown.slice(0, 6000) : null
    };
  }

  var critSummary = null;
  if (crit && typeof crit === 'object') {
    critSummary = {
      status:                crit.status || null,
      notDraft:              crit.notDraft === true,
      antiOverclaim:         crit.antiOverclaim || null,
      summary:               crit.critique && crit.critique.summary || null,
      objectionLedgerLength: Array.isArray(crit.objectionLedger) ? crit.objectionLedger.length : 0,
      objectionSummary:      crit.objectionSummary || null
    };
  }

  // sourceDepthDiagnostics — used by both prompt and response diagnostics.
  var sourceDepthDiagnostics = {
    treatmentCount:           treatments.length,
    implementationStepCount:  implementation.implementationsList.length,
    evidenceAnchorCount:      sourceFeeds.length + citationHints.length,
    sourceFeedCount:          sourceFeeds.length,
    citationHintCount:        citationHints.length,
    objectionCount:           ledgerOut.length,
    methodCandidateCount:     methodCandidates.length,
    embodimentCandidateCount: embodimentCandidates.length,
    figureCandidateCount:     figureCandidates.length,
    hasDeepPortalFields:      hasDeepPortalFields,
    hasMoneyChainEvidence:    !!evidence.moneyChainEvidence,
    hasCouncilCritique:       !!(councilOut && councilOut.critiquePresent)
  };

  return {
    identity:                identity,
    diagnoses:               diagnoses,
    domainContext:           domainContext,
    evidence:                evidence,
    implementation:          implementation,
    treatments:              treatments,
    methodCandidates:        methodCandidates,
    embodimentCandidates:    embodimentCandidates,
    figureCandidates:        figureCandidates,
    sourceFeeds:             sourceFeeds,
    citationHints:           citationHints,
    councilArtifacts:        councilOut,
    objectionLedger:         ledgerOut,
    packageSections:         sectionsOut,
    packageDisclaimers:      Array.isArray(pkg.disclaimers) ? pkg.disclaimers.slice(0, 16) : [],
    packageMissingEvidence:  Array.isArray(pkg.missingEvidence) ? pkg.missingEvidence.slice(0, 32) : [],
    deterministicFinalized:  detSummary,
    councilCritique:         critSummary,
    missingDeepSource:       missingDeepSource,
    internalLanguageRisk:    internalLanguageRisk,
    sourceDepthDiagnostics:  sourceDepthDiagnostics
  };
}

function _projectInput(body) {
  var lane = body.lane;
  var pkg  = body.package || {};
  var det  = body.deterministicFinalized || null;
  var crit = body.critique || null;
  var lgr  = Array.isArray(body.objectionLedger) ? body.objectionLedger : [];
  var intk = body.intakeItem || null;

  var sectionsOut = {};
  if (pkg.sections && typeof pkg.sections === 'object') {
    var keys = Object.keys(pkg.sections);
    for (var i = 0; i < keys.length; i++) {
      var v = pkg.sections[keys[i]];
      if (typeof v === 'string' && v.length > 4000) {
        sectionsOut[keys[i]] = v.slice(0, 4000) + ' …[truncated]';
      } else if (v && typeof v === 'object') {
        try { sectionsOut[keys[i]] = JSON.parse(JSON.stringify(v)); } catch (_) {
          sectionsOut[keys[i]] = String(v).slice(0, 4000);
        }
      } else {
        sectionsOut[keys[i]] = v == null ? null : v;
      }
    }
  }

  var detSummary = null;
  if (det && typeof det === 'object') {
    detSummary = {
      title:         det.title || null,
      sectionIndex:  Array.isArray(det.sectionIndex) ? det.sectionIndex.slice(0, 32) : [],
      missingEvidence: Array.isArray(det.missingEvidence) ? det.missingEvidence.slice(0, 32) : [],
      markdownHead: typeof det.markdown === 'string' ? det.markdown.slice(0, 6000) : null
    };
  }

  var critSummary = null;
  if (crit && typeof crit === 'object') {
    critSummary = {
      status:           crit.status || null,
      notDraft:         crit.notDraft === true,
      antiOverclaim:    crit.antiOverclaim || null,
      summary:          crit.critique && crit.critique.summary || null,
      objectionLedgerLength: Array.isArray(crit.objectionLedger) ? crit.objectionLedger.length : 0,
      objectionSummary: crit.objectionSummary || null
    };
  }

  var ledgerOut = lgr.slice(0, 32).map(function (e) {
    if (!e || typeof e !== 'object') return null;
    return {
      id:                 e.id || null,
      type:               e.type || null,
      severity:           e.severity || null,
      issue:              typeof e.issue === 'string' ? e.issue.slice(0, 320) : '',
      whyItMatters:       typeof e.whyItMatters === 'string' ? e.whyItMatters.slice(0, 240) : '',
      requiredResponse:   typeof e.requiredResponse === 'string' ? e.requiredResponse.slice(0, 240) : '',
      mustAddressInDraft: e.mustAddressInDraft === true
    };
  }).filter(Boolean);

  var intakeOut = null;
  if (intk && typeof intk === 'object') {
    intakeOut = {
      id:                    intk.id || null,
      lane:                  intk.lane || null,
      artifactCouncilStatus: intk.artifactCouncilStatus || null,
      humanReviewStatus:     intk.humanReviewStatus || null,
      source:                intk.source || null,
      createdAt:             intk.createdAt || null,
      notes:                 typeof intk.notes === 'string' ? intk.notes.slice(0, 320) : null
    };
  }

  // MB-D.1.3 — fold sourceContext into the projected input. The deep
  // source fields (raw artifactPacket, councilArtifacts, treatments,
  // method/embodiment/figure candidates, feed sources) are now first-
  // class on the prompt input rather than discarded.
  var sourceCtx = _buildSourceContext(body);

  return {
    lane:                  lane,
    packageSchemaVersion:  pkg.packageSchemaVersion || null,
    sourceIntakeId:        pkg.sourceIntakeId || (intakeOut && intakeOut.id) || null,
    sourceArtifactPacketId: pkg.sourceArtifactPacketId || null,
    intake:                intakeOut,
    sourceContext:         sourceCtx,
    packageSections:       sectionsOut,
    packageDisclaimers:    Array.isArray(pkg.disclaimers) ? pkg.disclaimers.slice(0, 16) : [],
    packageMissingEvidence: Array.isArray(pkg.missingEvidence) ? pkg.missingEvidence.slice(0, 32) : [],
    deterministicFinalized: detSummary,
    councilCritique:       critSummary,
    objectionLedger:       ledgerOut
  };
}

// MB-D.1.4 — sourceMode addendum appended to the lane system prompt.
// Tells the model how to draft when source coverage is grounded vs.
// partial vs. fallback. Anti-overclaim invariants (status:
// 'final_draft_only', notSubmission/notApproval/humanReviewRequired:
// true, executionAllowed: false, lane antiOverclaim flags, prohibited-
// language scan) are enforced server-side regardless of mode.
function _sourceModeAddendum(mode, lane) {
  if (mode === 'source_grounded') {
    return [
      'SOURCE MODE: source_grounded.',
      'Deep source is rich. Expand each required section from sourceContext FIRST.',
      'Use the supplied treatments, mechanism/method/embodiment candidates, figure',
      'placeholders, evidence anchors, and council critique directly. Quote',
      'provenance feed names where applicable. Mark genuine gaps in missingEvidence.'
    ].join('\n');
  }
  if (mode === 'source_partial') {
    return [
      'SOURCE MODE: source_partial.',
      'Some source evidence is present but major method / embodiment / figure / claim',
      'detail is missing. For SECTIONS WITH GROUND TRUTH in sourceContext, expand',
      'directly from that source. For SECTIONS WITHOUT GROUND TRUTH, generate a',
      'professional drafting scaffold using artifact-type conventions and label each',
      'such section with the marker "DRAFTING SCAFFOLD — requires inventor/operator',
      'completion." Place explicit, structured inventor / operator / PI / analyst',
      'questions inside each scaffolded section. Every fabricated specific (figure',
      'caption, claim text, embodiment detail, budget number, eligibility item)',
      'must be a placeholder marked "(to be completed by ...)" — never asserted.',
      'Add the unscaffolded gaps verbatim to missingEvidence and humanReviewItems.',
      'DO NOT collapse the document. Each required section should still expand to',
      'meaningful length even if its content is mostly questions and scaffolding.'
    ].join('\n');
  }
  // scaffold_fallback
  return [
    'SOURCE MODE: scaffold_fallback.',
    'No deep source bundle was available. Only the top-level ArtifactPacket facts',
    '(identity, signal, evidence, implementation, provenance) are reliable. Generate',
    'a long professional artifact scaffold using artifact-type conventions for the ' + lane,
    'lane. Use available top-level packet facts AS facts. EVERYTHING ELSE — technical',
    'mechanisms, embodiments, claim text, figure captions, prior-art references,',
    'budget numbers, eligibility determinations, underwriting opinions, position',
    'sizing, risk limits, market estimates — MUST be placeholders or questions',
    'unless visibly present in the supplied packet. Never assert a specific that the',
    'packet does not provide.',
    '',
    'Open the document with a prominent warning, BEFORE the first content section,',
    'as a Markdown blockquote:',
    '  "> GENERAL AI DRAFTING SCAFFOLD — source depth was not available for this',
    '  > diagnosis. Replace placeholders with verified LIMEN source and human evidence',
    '  > before review. This document is NOT source-complete. NOT filing-ready. NOT',
    '  > legal/financial advice. Human review is required."',
    '',
    'Each scaffolded section must include the marker "DRAFTING SCAFFOLD — requires',
    'inventor/operator/PI/analyst completion." inline (in the section body), and an',
    'explicit list of the questions a human must answer to complete it. Add every',
    'unanswered question verbatim to missingEvidence or humanReviewItems.',
    'Place every unsupported placeholder inside the section text rather than skipping',
    'the section. Length budget remains the lane target — do not collapse to a memo.',
    'Do not invent organization names, dates, dollar amounts, ticker symbols, CIKs,',
    'patent numbers, FOA/NOFO numbers, or any other specific the packet does not',
    'expose.'
  ].join('\n');
}

function _buildUserMessage(safeInput, sourceCtxStats) {
  // MB-D.1.3 — explicit instructions to use sourceContext FIRST and
  // expand from real packet detail rather than the deterministic
  // skeleton. Tells the model what to do when source detail is missing
  // (ask questions; never invent).
  // MB-D.1.4 — also tell the model the active sourceMode so the prompt
  // text and the system prompt addendum stay consistent.
  var depth = (safeInput.sourceContext && safeInput.sourceContext.sourceDepthDiagnostics) || {};
  var missing = (safeInput.sourceContext && safeInput.sourceContext.missingDeepSource) || [];
  var laneName = safeInput.lane;
  var mode = (sourceCtxStats && sourceCtxStats.sourceMode) || 'source_grounded';
  return [
    'Source data for FINAL DRAFT ONLY expansion (lane: ' + laneName + ') · sourceMode=' + mode + ':',
    '',
    'IMPORTANT — read sourceContext FIRST. Expand each required section by drawing',
    'directly from sourceContext.evidence, sourceContext.implementation,',
    'sourceContext.treatments, sourceContext.methodCandidates,',
    'sourceContext.embodimentCandidates, sourceContext.figureCandidates,',
    'sourceContext.sourceFeeds, sourceContext.citationHints,',
    'sourceContext.councilArtifacts, and sourceContext.objectionLedger.',
    '',
    'When sourceContext.missingDeepSource lists a missing field, DO NOT FABRICATE',
    'specifics. The sourceMode addendum in the system prompt explains how to handle',
    'gaps for this mode (questions + DRAFTING SCAFFOLD labels in source_partial /',
    'scaffold_fallback; expansion-with-questions in source_grounded).',
    '',
    'Sanitize internal-system labels before any public-facing prose:',
    '- Replace LIMEN, ArtifactPacket, sourceOpportunityId, readyForGeneration, anti_overclaim,',
    '  pathway_ref, density, stressBand, and node identifiers with plain-English equivalents',
    '  (e.g. "internal pathway reference" rather than "pathway_ref").',
    '- Convert diagnosis identifiers (e.g. GRID_COLLAPSE) into plain-English descriptions of',
    '  the underlying condition (e.g. "grid-stability collapse").',
    '- The raw identity.id (containing "::") may appear ONLY in appendix_source_evidence.',
    '',
    'Source-depth diagnostics (informational only — do not echo back):',
    '  sourceMode=' + mode +
      ' treatmentCount=' + (depth.treatmentCount || 0) +
      ' implementationStepCount=' + (depth.implementationStepCount || 0) +
      ' evidenceAnchorCount=' + (depth.evidenceAnchorCount || 0) +
      ' sourceFeedCount=' + (depth.sourceFeedCount || 0) +
      ' methodCandidateCount=' + (depth.methodCandidateCount || 0) +
      ' embodimentCandidateCount=' + (depth.embodimentCandidateCount || 0) +
      ' figureCandidateCount=' + (depth.figureCandidateCount || 0) +
      ' hasDeepPortalFields=' + !!depth.hasDeepPortalFields,
    'missingDeepSource (' + missing.length + '): ' + (missing.length ? missing.join(' | ') : 'none'),
    '',
    JSON.stringify(safeInput, null, 2),
    '',
    'Produce the strict-JSON expanded final draft now per the schema in the system',
    'prompt. Output JSON only — no surrounding prose, no markdown fences around the',
    'JSON, no leading/trailing whitespace beyond a single newline.'
  ].join('\n');
}

// ─── OpenAI invocation ────────────────────────────────────────────────

async function _callOpenAI(apiKey, model, systemPrompt, userMessage, temperature) {
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
    response_format: { type: 'json_object' },
    // MB-D.1.1 — lift the output-token ceiling so long-form drafts have
    // room. Without this, OpenAI's model default caps the reply at
    // ~4096 tokens (~650 words) and patent-style drafts truncate.
    //
    // MB-D.1.2 — Do not also send max_tokens; current OpenAI models
    // reject both fields together with invalid_parameter_combination
    // ("Setting 'max_tokens' and 'max_completion_tokens' at the same
    // time is not supported."). Keep max_completion_tokens only.
    max_completion_tokens: MAX_COMPLETION_TOKENS
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

async function _callOpenAIWithRetry(apiKey, model, systemPrompt, userMessage, temperature) {
  var attempts = 0;
  var totalElapsed = 0;
  var lastResult = null;
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    lastResult = await _callOpenAI(apiKey, model, systemPrompt, userMessage, temperature);
    totalElapsed += (typeof lastResult.elapsedMs === 'number') ? lastResult.elapsedMs : 0;
    if (lastResult.ok) {
      lastResult.attempts = attempts;
      lastResult.totalElapsedMs = totalElapsed;
      return lastResult;
    }
    if (!lastResult.timedOut) break;
    if (attempts >= MAX_ATTEMPTS) break;
  }
  lastResult.attempts = attempts;
  lastResult.totalElapsedMs = totalElapsed;
  return lastResult;
}

// ─── Output validation ────────────────────────────────────────────────

function _stripQuotesAndCode(text) {
  if (typeof text !== 'string' || !text.length) return '';
  var noCode = text.replace(/```[\s\S]*?```/g, '\n');
  var lines = noCode.split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*>/.test(lines[i])) continue;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function _scanProhibited(text, patterns) {
  if (typeof text !== 'string' || !text.length) return [];
  var scannable = _stripQuotesAndCode(text);
  var hits = [];
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].pattern.test(scannable)) hits.push(patterns[i].reason);
  }
  return hits;
}

function _scanInternalLanguage(text) {
  if (typeof text !== 'string' || !text.length) return [];
  var hits = [];
  for (var i = 0; i < INTERNAL_LANGUAGE_PATTERNS.length; i++) {
    if (INTERNAL_LANGUAGE_PATTERNS[i].pattern.test(text)) hits.push(INTERNAL_LANGUAGE_PATTERNS[i].reason);
  }
  return hits;
}

function _verifyOutput(parsed, lane) {
  var handler = LANE_HANDLERS[lane];
  if (!handler) return { ok: false, code: 'UNSUPPORTED_LANE', reason: 'Unknown lane: ' + lane };

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, code: 'AI_PARSE_ERROR', reason: 'Output is not an object.' };
  }
  if (typeof parsed.title !== 'string' || !parsed.title.length) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'title missing' };
  }
  if (typeof parsed.markdown !== 'string' || parsed.markdown.length < MIN_MARKDOWN_BYTES) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'markdown missing or too short (' + (typeof parsed.markdown === 'string' ? parsed.markdown.length : 0) +
              ' < ' + MIN_MARKDOWN_BYTES + ')' };
  }
  if (!Array.isArray(parsed.sectionIndex)) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED', reason: 'sectionIndex must be an array' };
  }

  // antiOverclaim flag check
  var ao = parsed.antiOverclaim || {};
  var flagKeys = Object.keys(handler.flags);
  for (var fi = 0; fi < flagKeys.length; fi++) {
    if (ao[flagKeys[fi]] !== true) {
      return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
        reason: 'antiOverclaim.' + flagKeys[fi] + ' is not true' };
    }
  }

  // Required sections — model must reference each id in sectionIndex
  // OR carry the gap forward in missingEvidence/humanReviewItems.
  var idsPresent = {};
  for (var si = 0; si < parsed.sectionIndex.length; si++) {
    var entry = parsed.sectionIndex[si];
    if (entry && typeof entry === 'object' && typeof entry.id === 'string') idsPresent[entry.id] = true;
  }
  var missingFromIndex = [];
  for (var ri = 0; ri < handler.requiredSections.length; ri++) {
    if (!idsPresent[handler.requiredSections[ri]]) missingFromIndex.push(handler.requiredSections[ri]);
  }
  // If sections are missing, they MUST appear (by id or rough name) in
  // missingEvidence or humanReviewItems. Otherwise reject.
  if (missingFromIndex.length) {
    var coverage = (Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence : []).concat(
                    Array.isArray(parsed.humanReviewItems) ? parsed.humanReviewItems : []);
    var coverageBlob = coverage.join(' | ').toLowerCase();
    var notMentioned = [];
    for (var mi = 0; mi < missingFromIndex.length; mi++) {
      var key = missingFromIndex[mi].replace(/_/g, ' ').toLowerCase();
      if (coverageBlob.indexOf(key) === -1) notMentioned.push(missingFromIndex[mi]);
    }
    if (notMentioned.length) {
      return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
        reason: 'required sections missing without explanation: ' + notMentioned.join(', ') };
    }
  }

  // Prohibited-language scan over generated markdown (excluding
  // negation blockquotes and fenced code blocks).
  var prohibited = _scanProhibited(parsed.markdown, handler.prohibitedPatterns);
  if (prohibited.length) {
    return { ok: false, code: 'AI_OVERCLAIM_DETECTED',
      reason: 'prohibited claim-language in markdown: ' + prohibited.join(', ') };
  }

  // Soft warnings (not blocking) — internal-system-language leaks.
  var internalLeaks = _scanInternalLanguage(parsed.markdown);

  // Substantial-output warning — short outputs pass but get a warning.
  var subWarn = parsed.markdown.length < SUBSTANTIAL_MD_BYTES;

  // MB-D.1.1 — lane-specific depth diagnostic.
  var words = _countWords(parsed.markdown);
  var depthTarget  = handler.depthTargetWords  || SUBSTANTIAL_MD_BYTES / 6;
  var depthMinimum = handler.depthMinimumWords || MIN_MARKDOWN_BYTES   / 6;
  var depthStatus  = (words >= depthTarget)  ? 'sufficient'
                   : (words >= depthMinimum) ? 'below_target'
                   :                           'below_minimum';

  return {
    ok: true,
    internalLanguageLeaked: internalLeaks.length > 0,
    internalLeaks:          internalLeaks,
    substantialWarning:     subWarn,
    markdownWords:          words,
    markdownBytes:          parsed.markdown.length,
    depthTargetWords:       depthTarget,
    depthMinimumWords:      depthMinimum,
    depthStatus:            depthStatus,
    requiredSectionCount:   handler.requiredSections.length,
    generatedSectionCount:  Array.isArray(parsed.sectionIndex) ? parsed.sectionIndex.length : 0
  };
}

// MB-D.1.1 — markdown word counter. Strips fenced code blocks and HTML
// tags, then splits on whitespace, then counts non-empty tokens that
// contain at least one alphanumeric character. This is approximate;
// the goal is a depth signal, not a billing number.
function _countWords(text) {
  if (typeof text !== 'string' || !text.length) return 0;
  var noCode = text.replace(/```[\s\S]*?```/g, ' ');
  var noTags = noCode.replace(/<[^>]+>/g, ' ');
  var tokens = noTags.split(/\s+/);
  var n = 0;
  for (var i = 0; i < tokens.length; i++) {
    if (/[A-Za-z0-9]/.test(tokens[i])) n++;
  }
  return n;
}

// ─── Handler ──────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED', message: 'POST only.' });
    return;
  }

  var body = req.body;
  if (typeof body !== 'object' || body === null) {
    res.status(400).json({ ok: false, error: 'MALFORMED_REQUEST',
      message: 'Request body must be a JSON object.' });
    return;
  }

  // Body-size guard.
  try {
    var serialized = JSON.stringify(body);
    if (typeof serialized === 'string' && serialized.length > MAX_BODY_BYTES) {
      res.status(413).json({ ok: false, error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds ' + MAX_BODY_BYTES + ' bytes.' });
      return;
    }
  } catch (e) { /* ignore */ }

  var inputErr = _validateInput(body);
  if (inputErr) {
    res.status(inputErr.http).json({ ok: false, error: inputErr.code, message: inputErr.message });
    return;
  }

  var lane = body.lane;
  var handler_ = LANE_HANDLERS[lane];

  // Resolve provider config.
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

  // Build prompt input.
  var safeInput   = _projectInput(body);

  // MB-D.1.3 — capture source-context statistics for response diagnostics.
  // _countWords is hoisted via function declaration; safe to call here.
  var sourceCtx = safeInput.sourceContext || {};
  var ctxJson;
  try { ctxJson = JSON.stringify(sourceCtx); } catch (_) { ctxJson = ''; }
  var sourceCtxStats = {
    bytes:                ctxJson.length,
    words:                _countWords(ctxJson),
    depth:                sourceCtx.sourceDepthDiagnostics || {},
    missingDeepSource:    Array.isArray(sourceCtx.missingDeepSource)    ? sourceCtx.missingDeepSource.slice()    : [],
    internalLanguageRisk: Array.isArray(sourceCtx.internalLanguageRisk) ? sourceCtx.internalLanguageRisk.slice() : [],
    shallow:              false
  };
  // Heuristic for SOURCE_CONTEXT_SHALLOW: at least 3 missingDeepSource
  // entries OR no implementationStepCount AND no treatmentCount AND
  // no methodCandidateCount AND no embodimentCandidateCount.
  var d_ = sourceCtxStats.depth;
  if ((sourceCtxStats.missingDeepSource.length >= 3) ||
      ((d_.implementationStepCount  || 0) === 0 &&
       (d_.treatmentCount           || 0) === 0 &&
       (d_.methodCandidateCount     || 0) === 0 &&
       (d_.embodimentCandidateCount || 0) === 0)) {
    sourceCtxStats.shallow = true;
  }

  // MB-D.1.4 — sourceMode classification drives prompt fork.
  //
  //   source_grounded   — deepSource is rich enough to expand from
  //                       directly. The original MB-D.1.3 prompt
  //                       behavior (use sourceContext FIRST) applies.
  //
  //   source_partial    — some source evidence present but missing
  //                       major method/embodiment/figure detail. Use
  //                       sourceContext where available, scaffold the
  //                       remainder with explicit DRAFTING SCAFFOLD
  //                       labels and operator/inventor questions.
  //
  //   scaffold_fallback — no bundle / no deep source, but a packet
  //                       exists. Generate a long professional artifact
  //                       scaffold using artifact-type conventions.
  //                       Every technical mechanism / embodiment /
  //                       claim / figure / budget number / eligibility
  //                       fact must be a placeholder/question. Output
  //                       must carry a prominent GENERAL AI DRAFTING
  //                       SCAFFOLD warning.
  //
  // The classifier weighs source-grounded counts ahead of missing-
  // source codes — a packet with 4 treatments + 2 mechanisms is
  // partial, not fallback, even if 5 deep-portal codes are missing.
  function _classifySourceMode(stats) {
    var dpth = stats.depth || {};
    var t   = dpth.treatmentCount           || 0;
    var imp = dpth.implementationStepCount  || 0;
    var m   = dpth.methodCandidateCount     || 0;
    var emb = dpth.embodimentCandidateCount || 0;
    var fg  = dpth.figurePlaceholderCount   || 0;
    var ev  = dpth.evidenceAnchorCount      || 0;
    var mech= dpth.mechanismCandidateCount  || 0;

    // source_grounded: substantial breadth across multiple categories.
    if ((t + imp + mech) >= 8 && (m + emb + fg) >= 4) return 'source_grounded';
    // source_partial: any meaningful evidence but not breadth.
    if ((t + imp + mech + m + emb + fg + ev) >= 2)   return 'source_partial';
    // scaffold_fallback: nothing useful from source.
    return 'scaffold_fallback';
  }
  sourceCtxStats.sourceMode          = _classifySourceMode(sourceCtxStats);
  sourceCtxStats.scaffoldFallbackUsed = sourceCtxStats.sourceMode === 'scaffold_fallback';
  sourceCtxStats.groundedFactCount   = (sourceCtxStats.depth.treatmentCount || 0) +
                                       (sourceCtxStats.depth.implementationStepCount || 0) +
                                       (sourceCtxStats.depth.evidenceAnchorCount || 0) +
                                       (sourceCtxStats.depth.mechanismCandidateCount || 0) +
                                       (sourceCtxStats.depth.methodCandidateCount || 0) +
                                       (sourceCtxStats.depth.embodimentCandidateCount || 0) +
                                       (sourceCtxStats.depth.figurePlaceholderCount || 0);

  var systemPrompt = handler_.systemPrompt + '\n\n' +
                     _sourceModeAddendum(sourceCtxStats.sourceMode, lane);
  var userMessage  = _buildUserMessage(safeInput, sourceCtxStats);
  var requestedTemp = body.options && typeof body.options.temperature === 'number' ? body.options.temperature : null;
  var temperature = (requestedTemp !== null && requestedTemp >= 0 && requestedTemp <= MAX_TEMPERATURE)
    ? requestedTemp : DEFAULT_TEMPERATURE;
  var approxPayloadBytes = (typeof systemPrompt === 'string' ? systemPrompt.length : 0) +
                           (typeof userMessage === 'string' ? userMessage.length : 0);

  // Call OpenAI with one retry on AbortError only.
  var aiResult = await _callOpenAIWithRetry(apiKey, model, systemPrompt, userMessage, temperature);
  if (!aiResult.ok) {
    var isTimeout = aiResult.error === 'AI_UPSTREAM_TIMEOUT' || aiResult.timedOut === true;
    var httpStatus = isTimeout ? 504 : (aiResult.status || 502);
    res.status(httpStatus).json({
      ok:                  false,
      error:               isTimeout ? 'AI_UPSTREAM_TIMEOUT' : (aiResult.error || 'AI_UPSTREAM_ERROR'),
      message:             aiResult.upstreamMessage || 'AI upstream failed.',
      retryable:           !!isTimeout,
      lane:                lane,
      stage:               'openai_finalize',
      attempts:            aiResult.attempts || 1,
      perAttemptTimeoutMs: AI_TIMEOUT_MS,
      totalElapsedMs:      aiResult.totalElapsedMs || aiResult.elapsedMs || 0,
      approxPayloadBytes:  approxPayloadBytes,
      fallbackAttempted:   false
    });
    return;
  }

  // Parse OpenAI JSON.
  var parsed;
  try { parsed = JSON.parse(aiResult.content); }
  catch (e) {
    res.status(502).json({
      ok: false,
      error: 'AI_PARSE_ERROR',
      message: (e && e.message) ? String(e.message).slice(0, 500) : 'JSON.parse failed.',
      lane: lane,
      stage: 'openai_finalize',
      rawTruncated: typeof aiResult.content === 'string' ? aiResult.content.slice(0, 500) : null
    });
    return;
  }

  // Server-side anti-overclaim verification.
  var verify = _verifyOutput(parsed, lane);
  if (!verify.ok) {
    res.status(502).json({
      ok: false,
      error: verify.code,
      message: verify.reason,
      lane: lane,
      stage: 'openai_finalize',
      rejectedOutput: parsed
    });
    return;
  }

  // Server-side identity overrides — model cannot self-report a different
  // lane than the validated request.
  if (parsed.lane !== lane) parsed.lane = lane;

  // Sanitize warning arrays + ensure objection arrays are arrays.
  if (!Array.isArray(parsed.warnings))            parsed.warnings = [];
  if (!Array.isArray(parsed.missingEvidence))     parsed.missingEvidence = [];
  if (!Array.isArray(parsed.humanReviewItems))    parsed.humanReviewItems = [];
  if (!Array.isArray(parsed.changesMade))         parsed.changesMade = [];
  if (!Array.isArray(parsed.objectionsAddressed))  parsed.objectionsAddressed = [];
  if (!Array.isArray(parsed.objectionsUnresolved)) parsed.objectionsUnresolved = [];

  if (verify.substantialWarning) {
    parsed.warnings.push('SUBSTANTIAL_WARNING: markdown < ' + SUBSTANTIAL_MD_BYTES + ' bytes; longer expansion recommended.');
  }
  if (verify.internalLanguageLeaked) {
    parsed.warnings.push('INTERNAL_LANGUAGE_LEAKED: ' + verify.internalLeaks.join(', '));
  }
  // MB-D.1.1 — depth warnings. Below target → DEPTH_WARNING (soft).
  // Below minimum → DEPTH_BELOW_MINIMUM (still 200 OK so operator can
  // inspect; not a hard fail unless future policy decides otherwise).
  if (verify.depthStatus === 'below_target') {
    parsed.warnings.push('DEPTH_WARNING: ' + verify.markdownWords + ' words < target ' +
      verify.depthTargetWords + '. Document is shorter than target; rerun or revise with additional source detail.');
  } else if (verify.depthStatus === 'below_minimum') {
    parsed.warnings.push('DEPTH_BELOW_MINIMUM: ' + verify.markdownWords + ' words < minimum ' +
      verify.depthMinimumWords + '. Document is materially short of expected depth; rerun or revise with additional source detail.');
  }

  // MB-D.1.3 — source-depth warnings. Distinct from DEPTH_WARNING above:
  // these surface that the INPUT to OpenAI was thin, not that the model
  // produced too few words. When both fire, the operator knows depth is
  // limited because deep portal/treatment detail was not present in the
  // finalizer input — not because the model misbehaved.
  if (sourceCtxStats.shallow) {
    parsed.warnings.push('SOURCE_CONTEXT_SHALLOW: depth is limited because deep portal/treatment detail was not present in the finalizer input. ' +
      'Missing: ' + (sourceCtxStats.missingDeepSource.join('; ') || 'multiple deep-source fields'));
  }
  if (Array.isArray(sourceCtxStats.missingDeepSource)) {
    for (var ms = 0; ms < sourceCtxStats.missingDeepSource.length; ms++) {
      parsed.warnings.push(sourceCtxStats.missingDeepSource[ms]);
    }
  }
  if (Array.isArray(sourceCtxStats.internalLanguageRisk) && sourceCtxStats.internalLanguageRisk.length) {
    parsed.warnings.push('INTERNAL_LANGUAGE_RISK: ' + sourceCtxStats.internalLanguageRisk.join(' | '));
  }
  // MB-D.1.4 — source-mode warning. Always present so the document
  // never silently masquerades as source-grounded when it isn't.
  if (sourceCtxStats.sourceMode === 'scaffold_fallback') {
    parsed.warnings.push('SCAFFOLD_FALLBACK: source depth was not available for this diagnosis. ' +
      'Document is a professional drafting scaffold, NOT a source-grounded artifact. Replace ' +
      'placeholders with verified LIMEN source and human evidence before review. NOT filing-ready. ' +
      'NOT legal/financial advice. Human review required.');
  } else if (sourceCtxStats.sourceMode === 'source_partial') {
    parsed.warnings.push('SOURCE_PARTIAL: deep source covers some sections but missing major ' +
      'method/embodiment/figure/claim detail. Sections marked "DRAFTING SCAFFOLD" are general ' +
      'professional scaffolding, not source-grounded LIMEN content. Operator must complete them ' +
      'before review.');
  }

  // Wrap in the API envelope. status, notSubmission, notApproval,
  // humanReviewRequired, executionAllowed are server-stamped invariants
  // and override any model-emitted values.
  var expandedFinalDraft = {
    finalizerSchemaVersion: EXPANSION_SCHEMA_VERSION,
    lane:                   lane,
    title:                  parsed.title,
    markdown:               parsed.markdown,
    sectionIndex:           parsed.sectionIndex,
    warnings:               parsed.warnings,
    missingEvidence:        parsed.missingEvidence,
    humanReviewItems:       parsed.humanReviewItems,
    changesMade:            parsed.changesMade,
    objectionsAddressed:    parsed.objectionsAddressed,
    objectionsUnresolved:   parsed.objectionsUnresolved,
    antiOverclaim:          parsed.antiOverclaim
  };

  var guards = {
    laneMatched:              true,
    flagsVerified:            true,
    prohibitedLanguageClean:  true,
    externalLanguageClean:    !verify.internalLanguageLeaked,
    requiredSectionsCovered:  true,
    executionAllowed:         false
  };

  res.status(200).json({
    ok:                  true,
    schemaVersion:       API_SCHEMA_VERSION,
    lane:                lane,
    provider:            'openai',
    model:               model,
    createdAt:           new Date().toISOString(),
    status:              'final_draft_only',
    notSubmission:       true,
    notApproval:         true,
    humanReviewRequired: true,
    executionAllowed:    false,
    expandedFinalDraft:  expandedFinalDraft,
    guards:              guards,
    diagnostics: {
      attempts:               aiResult.attempts || 1,
      perAttemptTimeoutMs:    AI_TIMEOUT_MS,
      totalElapsedMs:         aiResult.totalElapsedMs || aiResult.elapsedMs || 0,
      approxPayloadBytes:     approxPayloadBytes,
      markdownBytes:          verify.markdownBytes,
      markdownWords:          verify.markdownWords,
      depthTargetWords:       verify.depthTargetWords,
      depthMinimumWords:      verify.depthMinimumWords,
      depthStatus:            verify.depthStatus,
      requiredSectionCount:   verify.requiredSectionCount,
      generatedSectionCount:  verify.generatedSectionCount,
      maxCompletionTokens:    MAX_COMPLETION_TOKENS,
      internalLanguageLeaked: !!verify.internalLanguageLeaked,
      substantialWarning:     !!verify.substantialWarning,
      // MB-D.1.3 — source-depth diagnostics carried through from the
      // input projection so the operator can see whether shallow output
      // was caused by missing source vs. model behavior.
      sourceContextBytes:     sourceCtxStats.bytes,
      sourceContextWords:     sourceCtxStats.words,
      treatmentCount:         sourceCtxStats.depth.treatmentCount,
      implementationStepCount: sourceCtxStats.depth.implementationStepCount,
      evidenceAnchorCount:    sourceCtxStats.depth.evidenceAnchorCount,
      sourceFeedCount:        sourceCtxStats.depth.sourceFeedCount,
      methodCandidateCount:   sourceCtxStats.depth.methodCandidateCount,
      embodimentCandidateCount: sourceCtxStats.depth.embodimentCandidateCount,
      figureCandidateCount:   sourceCtxStats.depth.figureCandidateCount,
      objectionCount:         sourceCtxStats.depth.objectionCount,
      hasDeepPortalFields:    sourceCtxStats.depth.hasDeepPortalFields,
      missingDeepSource:      sourceCtxStats.missingDeepSource,
      internalLanguageRisk:   sourceCtxStats.internalLanguageRisk,
      sourceContextShallow:   sourceCtxStats.shallow,
      // MB-D.1.4 — source-mode classification + scaffold-fallback flag
      // so the UI can label the document accordingly and operators can
      // see at a glance which prompt fork the model ran under.
      sourceMode:               sourceCtxStats.sourceMode,
      scaffoldFallbackUsed:     !!sourceCtxStats.scaffoldFallbackUsed,
      groundedFactCount:        sourceCtxStats.groundedFactCount,
      placeholderSectionCount:  Array.isArray(parsed.missingEvidence)
                                  ? parsed.missingEvidence.length
                                  : 0,
      missingEvidenceCount:     (Array.isArray(parsed.missingEvidence) ? parsed.missingEvidence.length : 0) +
                                (Array.isArray(parsed.humanReviewItems) ? parsed.humanReviewItems.length : 0)
    }
  });
};

// MB-D.1 — Per-route Vercel function maxDuration. Mirrors D3-F.1.
// Lifts to 300s (Pro tier max) so a long-form draft expansion has room
// to complete with one retry on timeout. Configured here to keep
// vercel.json untouched in this scope.
module.exports.config = {
  maxDuration: 300
};
