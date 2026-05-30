/**
 * MB-D — Master Brain Artifact Finalizer (deterministic, template-based).
 *
 * STATUS: SCAFFOLD. Renders MB-C draft packages into long, readable
 * lane-specific documents (Markdown + optional HTML). NO LLM. NO
 * NETWORK. NO PERSISTENCE BEYOND CALLER. NO EXTERNAL ACTION. NO FILING.
 * NO TRADING. NO SUBMISSION. Output is a plain JS object the caller
 * may render, copy, or download client-side.
 *
 * Anti-overclaim invariants — every finalized doc returned by this module:
 *   status:                'final_draft_only'
 *   notSubmission:         true
 *   notApproval:           true
 *   humanReviewRequired:   true
 *   executionAllowed:      false
 *
 * Dispatch:
 *   finalizePackage(pkg, options) -> { ok, finalized | error, errors[] }
 *
 *   pkg.lane drives the dispatch:
 *     'patents'                                  -> finalizePatent
 *     'business-grants' | 'research-grants' |
 *       'nsf-project-pitch'                      -> finalizeGrant
 *     'sba-loans'                                -> finalizeSba
 *     'investments'                              -> finalizeInvestment
 *     anything else                              -> { ok:false, error:'UNSUPPORTED_LANE' }
 *
 * Hard-coded disclaimers in every document:
 *   - Patent: NOT filing-ready. NOT legal advice. Attorney review required.
 *   - Grant: NO funding decision. NO agency endorsement. Eligibility unverified.
 *   - SBA:   NO loan approval. NO eligibility determination. Lender review required.
 *   - Investment: NOT investment advice. NOT trade execution. Human approval required.
 *
 * Forbidden output language (validated by validateFinalized()):
 *   "submission-ready", "filing-ready", "is approved", "guaranteed
 *   funding/award/return/...", "buy now", "sell now", "executed trade",
 *   "agency endorsement", "eligibility approval", "submitted/filed/
 *   funded" without negation, etc. The narrowed regex set requires a
 *   claim CONTEXT so legitimate vocabulary ("personal guarantee" on
 *   SBA, "approved trading system" referring to operator's external
 *   broker) is not flagged.
 *
 * Exposes: window.LIMENMasterBrain.artifactFinalizer
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 'MB-D.v1';

  var GRANT_LANES = {
    'business-grants':   1,
    'research-grants':   1,
    'nsf-project-pitch': 1
  };

  // Same forbidden-language rules as the factory. Narrowed to claim
  // contexts so legitimate vocabulary survives. validateFinalized()
  // walks the rendered markdown and rejects on any hit.
  var FORBIDDEN_RX = [
    /\bsubmission[-\s]?ready\b/i,
    /\bfiling[-\s]?ready\b/i,
    /\bis\s+approved\b/i,
    /\bguarante(e|ed|es|s)\s+(award|funding|approval|outcome|outcomes|eligibility|return|returns|profit|profits|gains|trade|trades|filing|patent|grant)\b/i,
    /\bbuy\s+now\b/i,
    /\bsell\s+now\b/i,
    /\bexecute(d)?\s+trade\b/i,
    /\bagency\s+endorsement\b/i,
    /\beligibility\s+approv(ed|al)\b/i
  ];

  function _isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function _isStr(v) { return typeof v === 'string' && v.length > 0; }
  function _str(v)   { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  // ── Markdown helpers ──────────────────────────────────────────────
  function _h1(t) { return '# '   + _str(t).trim() + '\n\n'; }
  function _h2(t) { return '## '  + _str(t).trim() + '\n\n'; }
  function _h3(t) { return '### ' + _str(t).trim() + '\n\n'; }
  function _p(t)  { return _str(t).trim() + '\n\n'; }
  function _bullets(arr) {
    if (!Array.isArray(arr) || !arr.length) return '';
    var out = '';
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v == null) continue;
      var line = (typeof v === 'string') ? v : (v.issue || v.text || JSON.stringify(v));
      out += '- ' + _str(line).trim() + '\n';
    }
    return out + '\n';
  }
  function _kv(label, val) {
    if (val == null || val === '') return '';
    return '- **' + _str(label) + ':** ' + _str(val) + '\n';
  }
  function _codeBlock(label, obj) {
    if (obj == null) return '';
    var json = '';
    try { json = JSON.stringify(obj, null, 2); } catch (_) { json = String(obj); }
    return '### ' + label + '\n\n```json\n' + json + '\n```\n\n';
  }

  // ── Cover / disclaimer block (shared) ─────────────────────────────
  function _coverBlock(pkg, laneLabel, title, extraDisclaimers) {
    var out = '';
    out += _h1(title);
    out += '> **STATUS: FINAL DRAFT ONLY — HUMAN REVIEW REQUIRED — NOT SUBMITTED**\n\n';
    out += '> This document is a deterministic template-rendered draft. It is\n';
    out += '> NOT submitted, NOT filed, NOT funded, NOT approved, NOT\n';
    out += '> validated, NOT externally endorsed, and NOT routed to any\n';
    out += '> agency, lender, broker, or counsel. Any further step requires\n';
    out += '> a human in the loop.\n\n';
    out += _kv('Lane', laneLabel);
    out += _kv('Source package schema', pkg.packageSchemaVersion || '');
    out += _kv('Finalizer schema', SCHEMA_VERSION);
    out += _kv('Source intake id', pkg.sourceIntakeId || '');
    out += _kv('Source artifact packet id', pkg.sourceArtifactPacketId || '');
    out += _kv('Generated at', new Date().toISOString());
    out += _kv('executionAllowed', 'false');
    out += '\n';
    if (Array.isArray(pkg.disclaimers) && pkg.disclaimers.length) {
      out += _h2('Disclaimers');
      for (var i = 0; i < pkg.disclaimers.length; i++) {
        out += '> ' + _str(pkg.disclaimers[i]).replace(/\n/g, '\n> ') + '\n\n';
      }
    }
    if (Array.isArray(extraDisclaimers)) {
      for (var j = 0; j < extraDisclaimers.length; j++) {
        out += '> ' + _str(extraDisclaimers[j]) + '\n\n';
      }
    }
    return out;
  }

  function _missingEvidenceBlock(pkg) {
    if (!Array.isArray(pkg.missingEvidence) || !pkg.missingEvidence.length) return '';
    var out = _h2('Missing evidence (must be addressed before any further step)');
    out += _bullets(pkg.missingEvidence);
    return out;
  }

  function _appendixBlock(pkg) {
    var out = _h2('Appendix — source packet evidence (read-only)');
    out += _codeBlock('Source MB-C package (full)', pkg);
    return out;
  }

  function _envelope(pkg, lane, title, markdown, sectionIndex, warnings, extraMissing) {
    var missing = (pkg.missingEvidence || []).slice();
    if (Array.isArray(extraMissing) && extraMissing.length) {
      for (var i = 0; i < extraMissing.length; i++) missing.push(extraMissing[i]);
    }
    return {
      finalizerSchemaVersion:   SCHEMA_VERSION,
      sourcePackageSchemaVersion: pkg.packageSchemaVersion || null,
      lane:                     lane,
      generatedAt:              new Date().toISOString(),
      status:                   'final_draft_only',
      notSubmission:            true,
      notApproval:              true,
      humanReviewRequired:      true,
      executionAllowed:         false,
      title:                    title,
      markdown:                 markdown,
      html:                     null,        // populated by renderHtml() if requested
      sectionIndex:             sectionIndex || [],
      warnings:                 (warnings || []).slice(),
      missingEvidence:          missing,
      sourceArtifactPacketId:   pkg.sourceArtifactPacketId || null,
      sourceIntakeId:           pkg.sourceIntakeId || null
    };
  }

  // ── Patent finalizer ──────────────────────────────────────────────
  function finalizePatent(pkg, options) {
    if (!_isObj(pkg) || pkg.lane !== 'patents') {
      return { ok: false, error: 'WRONG_LANE', errors: ['Expected lane "patents"'] };
    }
    var s = pkg.sections || {};
    var title = (s.inventionDisclosureSummary && s.inventionDisclosureSummary.title) || 'Patent disclosure draft (FINAL DRAFT ONLY)';
    var sections = [];
    var md = '';

    md += _coverBlock(pkg, 'patents', title, [
      'NOT filing-ready. NOT legal advice. NOT a patentability determination. ' +
      'No opinion is offered on novelty, non-obviousness, written description, ' +
      'enablement, or freedom to operate. Attorney review is required before any filing.'
    ]);

    function add(name, body) {
      if (!body) return;
      md += _h2(name);
      md += body + '\n';
      sections.push(name);
    }

    add('Invention disclosure', _bullets([
      'Title: ' + _str(s.inventionDisclosureSummary && s.inventionDisclosureSummary.title || ''),
      'Domain: ' + _str(s.inventionDisclosureSummary && s.inventionDisclosureSummary.domain || ''),
      'Why now: ' + _str(s.inventionDisclosureSummary && s.inventionDisclosureSummary.whyNow || ''),
      _str((s.inventionDisclosureSummary && s.inventionDisclosureSummary.sourceNote) || '')
    ].filter(Boolean)));

    add('Technical field',
      _kv('Domain', (s.technicalField && s.technicalField.domain) || '') +
      _kv('Node',   (s.technicalField && s.technicalField.node)   || '') +
      _bullets((s.technicalField && s.technicalField.diagnoses) || []));

    add('Background',
      _kv('Trigger evidence', s.background && s.background.triggerEvidence) +
      _kv('Validation',       s.background && s.background.validation) +
      (s.background && Array.isArray(s.background.sources) && s.background.sources.length
        ? '\n**Cited provenance sources:**\n\n' + _bullets(s.background.sources.map(function (sr) { return (sr.name || '?') + (sr.live ? ' (live)' : '') + (sr.classification ? ' [' + sr.classification + ']' : ''); }))
        : ''));

    add('Summary',
      _p('Problem: ' + _str(s.problem && s.problem.statement || '')) +
      _p('Approach: ' + _str(s.systemOverview && s.systemOverview.action || '')) +
      _p('Next operational step: ' + _str(s.systemOverview && s.systemOverview.nextStep || '')));

    add('Brief description of drawings',
      _p((s.drawingsFigureList && s.drawingsFigureList.sourceNote) || '') +
      (Array.isArray(s.drawingsFigureList && s.drawingsFigureList.figures) && s.drawingsFigureList.figures.length
        ? _bullets(s.drawingsFigureList.figures)
        : '_(No figures specified yet — placeholder.)_\n\n'));

    add('Detailed description',
      _h3('Problem statement') +
      _p(s.problem && s.problem.statement || '_(Missing — see missingEvidence.)_') +
      _h3('Evidence') +
      _p(s.problem && s.problem.evidence || '_(Missing — see missingEvidence.)_'));

    add('System architecture',
      _kv('Action',     s.systemOverview && s.systemOverview.action) +
      _kv('Next step',  s.systemOverview && s.systemOverview.nextStep) +
      _kv('Target',     s.systemOverview && s.systemOverview.target));

    add('Method flow',
      _p((s.methodSteps && s.methodSteps.sourceNote) || '') +
      (Array.isArray(s.methodSteps && s.methodSteps.steps) && s.methodSteps.steps.length
        ? _bullets(s.methodSteps.steps)
        : '_(No method steps specified yet — placeholder.)_\n\n'));

    add('Example embodiments',
      _p((s.possibleEmbodiments && s.possibleEmbodiments.sourceNote) || '') +
      (Array.isArray(s.possibleEmbodiments && s.possibleEmbodiments.embodiments) && s.possibleEmbodiments.embodiments.length
        ? _bullets(s.possibleEmbodiments.embodiments)
        : '_(Embodiments require inventor input.)_\n\n'));

    add('Variations and alternatives',
      '_(Document alternative implementations here once inventor walkthrough is complete. Placeholder.)_\n\n');

    add('Industrial applicability',
      _p('Industrial applicability is determined by attorney review and prior-art search. NOT asserted here.'));

    add('Claim drafting workspace',
      _p((s.claimDraftPlaceholders && s.claimDraftPlaceholders.sourceNote) || '') +
      _h3('Independent claim placeholders') +
      _bullets((s.claimDraftPlaceholders && s.claimDraftPlaceholders.independentClaims) || []) +
      _h3('Dependent claim placeholders') +
      _bullets((s.claimDraftPlaceholders && s.claimDraftPlaceholders.dependentClaims) || []));

    add('Prior-art search checklist',
      _bullets(s.priorArtSearchChecklist || []));

    add('Inventor / counsel questions', _bullets([
      'Walkthrough recorded? Date and participants?',
      'Prior-art references reviewed by counsel?',
      'Alternative implementations identified?',
      'Inventorship and assignment confirmed in writing?'
    ]));

    add('Attorney review checklist',
      _bullets(s.attorneyReviewChecklist || []));

    if (s.councilCritiqueSummary) {
      add('Council critique summary (read-only)',
        _kv('Draft status',           s.councilCritiqueSummary.draftStatus) +
        _kv('Critique status',        s.councilCritiqueSummary.critiqueStatus) +
        _kv('Objection ledger length', s.councilCritiqueSummary.objectionLedgerLength) +
        _kv('Reviewed at',            s.councilCritiqueSummary.reviewedAt));
    }

    md += _missingEvidenceBlock(pkg);
    md += _appendixBlock(pkg);

    return { ok: true, finalized: _envelope(pkg, 'patents', title, md, sections, []) };
  }

  // ── Grant finalizer (business / research / NSF) ───────────────────
  function finalizeGrant(pkg, options) {
    if (!_isObj(pkg) || !Object.prototype.hasOwnProperty.call(GRANT_LANES, pkg.lane)) {
      return { ok: false, error: 'WRONG_LANE', errors: ['Expected one of [business-grants, research-grants, nsf-project-pitch]'] };
    }
    var s = pkg.sections || {};
    var isNsf = pkg.lane === 'nsf-project-pitch';
    var title = (s.projectTitle) || 'Grant project draft (FINAL DRAFT ONLY)';
    var sections = [];
    var md = '';

    var laneLabel = pkg.lane;
    var coverDisclaimers = [
      'NO funding decision. NO agency endorsement. NO eligibility determination. ' +
      'Eligibility is set by the sponsoring agency. Submission readiness requires ' +
      'human PI + sponsored-research-office review.'
    ];
    if (isNsf) {
      coverDisclaimers.push(
        'NSF SBIR/STTR Project Pitch is a pre-application; if invited, a full proposal would be requested. ' +
        'NSF has not been contacted by this document. No claim of "NSF will fund", "invited by NSF", ' +
        '"intellectual merit established", "broader impacts achieved", "reviewer consensus", or "prior award success".'
      );
    }
    md += _coverBlock(pkg, laneLabel, title, coverDisclaimers);

    function add(name, body) {
      if (!body) return;
      md += _h2(name);
      md += body + '\n';
      sections.push(name);
    }

    add('Project title', _p(_str(title)));

    add('Executive summary',
      _p('Problem: ' + _str(s.problemNeed && s.problemNeed.statement || '')) +
      _p('Why now: ' + _str(s.problemNeed && s.problemNeed.whyNow || '')) +
      _p('Innovation summary: ' + _str(s.innovation && s.innovation.action || '')));

    add('Problem / need',
      _p(s.problemNeed && s.problemNeed.statement) +
      (s.problemNeed && Array.isArray(s.problemNeed.evidenceSources) && s.problemNeed.evidenceSources.length
        ? '\n**Cited evidence sources:**\n\n' + _bullets(s.problemNeed.evidenceSources.map(function (sr) { return (sr.name || '?') + (sr.live ? ' (live)' : ''); }))
        : ''));

    add('Innovation',
      _kv('Action',  s.innovation && s.innovation.action) +
      _kv('Do this', s.innovation && s.innovation.doThis));

    add('Objectives',
      _p((s.objectives && s.objectives.sourceNote) || '') +
      (Array.isArray(s.objectives && s.objectives.objectives) && s.objectives.objectives.length
        ? _bullets(s.objectives.objectives)
        : '_(Objectives require PI authorship — placeholder.)_\n\n'));

    add('Technical approach',
      _kv('Next step', s.approach && s.approach.nextStep) +
      _kv('Timing',    s.approach && s.approach.timing));

    add('Work plan / milestones',
      '_(Milestones must be authored by PI. Map each objective to a measurable indicator and target date. Placeholder.)_\n\n');

    add('Expected outcomes',
      _p((s.expectedOutcomes && s.expectedOutcomes.sourceNote) || '') +
      (Array.isArray(s.expectedOutcomes && s.expectedOutcomes.outcomes) && s.expectedOutcomes.outcomes.length
        ? _bullets(s.expectedOutcomes.outcomes)
        : '_(Outcomes must be authored by PI; not asserted from packet.)_\n\n'));

    add(isNsf ? 'Broader impacts (review criterion to strengthen — NOT outcomes claimed as proven)' : 'Broader impacts / public benefit',
      _p((s.broaderImpactsPublicBenefit && s.broaderImpactsPublicBenefit.sourceNote) || '') +
      (Array.isArray(s.broaderImpactsPublicBenefit && s.broaderImpactsPublicBenefit.impacts) && s.broaderImpactsPublicBenefit.impacts.length
        ? _bullets(s.broaderImpactsPublicBenefit.impacts)
        : '_(Planned broader impacts must be authored with PI. NOT claimed as achieved.)_\n\n'));

    add('Budget assumptions placeholder',
      _p((s.budgetAssumptionsPlaceholder && s.budgetAssumptionsPlaceholder.sourceNote) || '') +
      _bullets((s.budgetAssumptionsPlaceholder && s.budgetAssumptionsPlaceholder.budgetCategoryHints) || []));

    add('Team / capability',
      '_(Team members, qualifications, and roles must be authored by PI. Placeholder.)_\n\n');

    add('Risks and mitigation',
      '_(Risks must be enumerated honestly with mitigations and gaps. Placeholder.)_\n\n');

    add('Missing evidence / eligibility questions',
      _p((s.eligibilityMissingEvidence && s.eligibilityMissingEvidence.sourceNote) || '') +
      _bullets((s.eligibilityMissingEvidence && s.eligibilityMissingEvidence.items) || []));

    add('Reviewer-risk checklist',
      _bullets(s.reviewerRiskChecklist || []));

    if (s.councilCritiqueSummary) {
      add('Council critique summary (read-only)',
        _kv('Draft status',           s.councilCritiqueSummary.draftStatus) +
        _kv('Critique status',        s.councilCritiqueSummary.critiqueStatus) +
        _kv('Objection ledger length', s.councilCritiqueSummary.objectionLedgerLength) +
        _kv('Reviewed at',            s.councilCritiqueSummary.reviewedAt));
    }

    md += _missingEvidenceBlock(pkg);
    md += _appendixBlock(pkg);

    return { ok: true, finalized: _envelope(pkg, pkg.lane, title, md, sections, []) };
  }

  // ── SBA finalizer ─────────────────────────────────────────────────
  function finalizeSba(pkg, options) {
    if (!_isObj(pkg) || pkg.lane !== 'sba-loans') {
      return { ok: false, error: 'WRONG_LANE', errors: ['Expected lane "sba-loans"'] };
    }
    var s = pkg.sections || {};
    var title = (s.businessConcept && s.businessConcept.title) || 'SBA borrower draft (FINAL DRAFT ONLY)';
    var sections = [];
    var md = '';

    md += _coverBlock(pkg, 'sba-loans', title, [
      'NO loan approval. NO eligibility determination. NO underwriting opinion. ' +
      'SBA programs require borrower documentation review and lender underwriting. ' +
      'No claim is made that the borrower is approved, qualified, or able to close.'
    ]);

    function add(name, body) {
      if (!body) return;
      md += _h2(name);
      md += body + '\n';
      sections.push(name);
    }

    add('Business concept',
      _kv('Title',  s.businessConcept && s.businessConcept.title) +
      _kv('Domain', s.businessConcept && s.businessConcept.domain) +
      _kv('Why now', s.businessConcept && s.businessConcept.whyNow) +
      _p((s.businessConcept && s.businessConcept.sourceNote) || ''));

    add('Use of funds',
      _p((s.useOfFunds && s.useOfFunds.sourceNote) || '') +
      (Array.isArray(s.useOfFunds && s.useOfFunds.items) && s.useOfFunds.items.length
        ? _bullets(s.useOfFunds.items)
        : '_(Use of funds must be itemized by operator. Placeholder.)_\n\n'));

    add('Market need',
      _kv('Trigger evidence', s.marketNeed && s.marketNeed.triggerEvidence) +
      _kv('Validation',       s.marketNeed && s.marketNeed.validation));

    add('Customer / revenue model',
      _p((s.revenueModel && s.revenueModel.sourceNote) || '') +
      _kv('Money-chain evidence', s.revenueModel && s.revenueModel.moneyChainEvidence));

    add('Operating plan',
      _kv('Action',    s.operatingPlan && s.operatingPlan.action) +
      _kv('Next step', s.operatingPlan && s.operatingPlan.nextStep) +
      _kv('Timing',    s.operatingPlan && s.operatingPlan.timing));

    add('Staffing / operator plan',
      _p((s.staffingOperatorPlan && s.staffingOperatorPlan.sourceNote) || '') +
      _bullets((s.staffingOperatorPlan && s.staffingOperatorPlan.roles) || []));

    add('Financial assumptions placeholder',
      '_(Pro-forma financials must be authored by operator. Three-year projections + assumptions document required. Placeholder.)_\n\n');

    add('Collateral / borrower documentation checklist',
      _bullets(s.documentsNeeded || []));

    add('Risk factors',
      _kv('Market risk',     s.riskFactors && s.riskFactors.marketRisk) +
      _kv('Regulatory risk', s.riskFactors && s.riskFactors.regulatoryRisk) +
      _kv('Execution risk',  s.riskFactors && s.riskFactors.executionRisk) +
      _kv('Capital risk',    s.riskFactors && s.riskFactors.capitalRisk) +
      _p((s.riskFactors && s.riskFactors.sourceNote) || ''));

    add('Lender questions', _bullets([
      'Which SBA program is being targeted (7(a), 504, microloan)?',
      'Does the borrower meet the size standard / industry NAICS?',
      'Does the borrower meet the credit-elsewhere test?',
      'Is collateral coverage and personal guarantee acceptable?',
      'Which lender is underwriting and on what timeline?'
    ]));

    add('SBA / lender review checklist',
      _bullets(s.lenderReviewChecklist || []));

    if (s.councilCritiqueSummary) {
      add('Council critique summary (read-only)',
        _kv('Draft status',           s.councilCritiqueSummary.draftStatus) +
        _kv('Critique status',        s.councilCritiqueSummary.critiqueStatus) +
        _kv('Objection ledger length', s.councilCritiqueSummary.objectionLedgerLength) +
        _kv('Reviewed at',            s.councilCritiqueSummary.reviewedAt));
    }

    md += _missingEvidenceBlock(pkg);
    md += _appendixBlock(pkg);

    return { ok: true, finalized: _envelope(pkg, 'sba-loans', title, md, sections, []) };
  }

  // ── Investment finalizer ──────────────────────────────────────────
  function finalizeInvestment(pkg, options) {
    if (!_isObj(pkg) || pkg.lane !== 'investments') {
      return { ok: false, error: 'WRONG_LANE', errors: ['Expected lane "investments"'] };
    }
    var s = pkg.sections || {};
    var title = (s.thesis && s.thesis.statement) || 'Investment thesis draft (FINAL DRAFT ONLY)';
    var sections = [];
    var md = '';
    var extraMissing = [];

    md += _coverBlock(pkg, 'investments', title, [
      'NOT investment advice. NOT a recommendation regarding any security. ' +
      'NO order is staged or placed by this document. NO automation is wired. ' +
      'Kernel output is decision support; trading decisions are made by human ' +
      'analysts under their existing risk and compliance frameworks.'
    ]);

    function add(name, body) {
      if (!body) return;
      md += _h2(name);
      md += body + '\n';
      sections.push(name);
    }

    add('Thesis',
      _p('Statement: ' + _str(s.thesis && s.thesis.statement || '_(Missing — see missingEvidence.)_')) +
      _kv('Why now',          s.thesis && s.thesis.whyNow) +
      _kv('Trigger evidence', s.thesis && s.thesis.triggerEvidence));

    var t = s.targetCompanyTicker || {};
    add('Target / company / ticker',
      _kv('Ticker',  t.ticker) +
      _kv('CIK',     t.cik) +
      _kv('Name',    t.name) +
      _kv('Slug',    t.slug) +
      _p(t.sourceNote || ''));
    if (!t.ticker && !t.cik) extraMissing.push('targetCompanyTicker resolution failed');

    var k = s.kernelCommandBoardContext || {};
    add('Kernel / Command Board context (read-only — decision support, NOT trading authority)',
      (k.phase != null         ? _kv('Phase',          k.phase) : '') +
      (k.trajectory != null    ? _kv('Trajectory',     k.trajectory) : '') +
      (k.composite != null     ? _kv('Composite',      k.composite) : '') +
      (k.domain != null        ? _kv('Domain',         k.domain) : '') +
      (k.domainStress != null  ? _kv('Domain stress',  k.domainStress) : '') +
      (k.active != null        ? _kv('Active',         k.active) : '') +
      _p(k.sourceNote || ''));

    var ds = s.domainStressContext || {};
    add('Domain stress context',
      _kv('ArtifactPacket stress band', ds.artifactPacketStressBand) +
      _kv('ArtifactPacket stress',      ds.artifactPacketStress) +
      _kv('Command-Board domain stress', ds.commandBoardDomainStress));

    add('Catalysts',
      _p((s.catalysts && s.catalysts.sourceNote) || '') +
      (Array.isArray(s.catalysts && s.catalysts.catalysts) && s.catalysts.catalysts.length
        ? _bullets(s.catalysts.catalysts)
        : '_(Catalysts must be authored by analyst — placeholder.)_\n\n'));

    add('Bull case',
      _p((s.bullCase && s.bullCase.statement) || '_(Missing — see missingEvidence.)_') +
      _p((s.bullCase && s.bullCase.sourceNote) || ''));

    add('Bear case',
      _p((s.bearCase && s.bearCase.statement) || '_(Missing — see missingEvidence.)_') +
      _p((s.bearCase && s.bearCase.sourceNote) || ''));

    add('Invalidation conditions',
      _p((s.invalidationConditions && s.invalidationConditions.sourceNote) || '') +
      (Array.isArray(s.invalidationConditions && s.invalidationConditions.conditions) && s.invalidationConditions.conditions.length
        ? _bullets(s.invalidationConditions.conditions)
        : '_(Invalidation conditions must be authored before any position is opened — placeholder.)_\n\n'));

    add('Risk limits placeholder',
      _kv('Stop-loss',            s.riskLimitsPlaceholder && s.riskLimitsPlaceholder.stopLoss) +
      _kv('Max adverse excursion', s.riskLimitsPlaceholder && s.riskLimitsPlaceholder.maxAdverseExcursion) +
      _kv('Time stop',            s.riskLimitsPlaceholder && s.riskLimitsPlaceholder.timeStop) +
      _p((s.riskLimitsPlaceholder && s.riskLimitsPlaceholder.sourceNote) || ''));

    add('Position sizing placeholder',
      _kv('Sizing', s.positionSizingPlaceholder && s.positionSizingPlaceholder.sizing) +
      _p((s.positionSizingPlaceholder && s.positionSizingPlaceholder.sourceNote) || ''));

    add('Missing evidence', _bullets(s.missingEvidenceFlags || []));

    add('Human approval checkpoint', _bullets(s.humanApprovalCheckpoint || []));

    if (s.councilCritiqueSummary) {
      add('Council critique summary (read-only)',
        _kv('Draft status',           s.councilCritiqueSummary.draftStatus) +
        _kv('Critique status',        s.councilCritiqueSummary.critiqueStatus) +
        _kv('Objection ledger length', s.councilCritiqueSummary.objectionLedgerLength) +
        _kv('Reviewed at',            s.councilCritiqueSummary.reviewedAt));
    }

    md += _missingEvidenceBlock(pkg);
    md += _appendixBlock(pkg);

    return { ok: true, finalized: _envelope(pkg, 'investments', title, md, sections, [], extraMissing) };
  }

  // ── Renderers ─────────────────────────────────────────────────────
  function _escHtml(s) {
    return _str(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function renderMarkdown(finalized) {
    if (!_isObj(finalized) || typeof finalized.markdown !== 'string') return '';
    return finalized.markdown;
  }

  // Minimal, conservative Markdown → HTML renderer for the finalized
  // document. HTML escaping is applied to every text node FIRST, before
  // any markdown formatting transforms; raw HTML in markdown is treated
  // as plain text. Code blocks are rendered as <pre><code>. No inline
  // HTML, no script, no style. This is a UI convenience renderer, not a
  // full Markdown engine.
  function renderHtml(finalized) {
    if (!_isObj(finalized) || typeof finalized.markdown !== 'string') return '';
    var md = finalized.markdown;

    // Split out fenced code blocks first; render those separately.
    var parts = md.split(/```(\w*)\n([\s\S]*?)```/);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        // Plain-text segment
        html += _renderPlainMd(parts[i]);
      } else if (i % 3 === 1) {
        // Language tag — handled with the next segment
        var lang = parts[i] || '';
        var code = parts[i + 1] || '';
        html += '<pre><code' + (lang ? ' class="lang-' + _escHtml(lang) + '"' : '') + '>' +
                _escHtml(code) + '</code></pre>\n';
        i++; // skip code segment
      }
    }
    return html;
  }

  function _renderPlainMd(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var out = '';
    var inUl = false;
    var blockBuf = '';
    function flushPara() {
      if (blockBuf.trim().length) {
        out += '<p>' + _renderInlineMd(blockBuf.trim()) + '</p>\n';
      }
      blockBuf = '';
    }
    function flushUl() {
      if (inUl) { out += '</ul>\n'; inUl = false; }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h1 = line.match(/^# (.*)$/);
      var h2 = line.match(/^## (.*)$/);
      var h3 = line.match(/^### (.*)$/);
      var bq = line.match(/^> ?(.*)$/);
      var li = line.match(/^- (.*)$/);
      if (h1) { flushPara(); flushUl(); out += '<h1>' + _renderInlineMd(h1[1]) + '</h1>\n'; continue; }
      if (h2) { flushPara(); flushUl(); out += '<h2>' + _renderInlineMd(h2[1]) + '</h2>\n'; continue; }
      if (h3) { flushPara(); flushUl(); out += '<h3>' + _renderInlineMd(h3[1]) + '</h3>\n'; continue; }
      if (bq) { flushPara(); flushUl(); out += '<blockquote>' + _renderInlineMd(bq[1]) + '</blockquote>\n'; continue; }
      if (li) {
        flushPara();
        if (!inUl) { out += '<ul>\n'; inUl = true; }
        out += '  <li>' + _renderInlineMd(li[1]) + '</li>\n';
        continue;
      }
      if (line.trim() === '') {
        flushPara();
        flushUl();
        continue;
      }
      blockBuf += (blockBuf ? '\n' : '') + line;
    }
    flushPara();
    flushUl();
    return out;
  }

  function _renderInlineMd(text) {
    var safe = _escHtml(text);
    // **bold**
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // _italic_
    safe = safe.replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
    // `code`
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    return safe;
  }

  // ── Validators ────────────────────────────────────────────────────
  //
  // Scan strategy: forbidden-language patterns must NOT fire inside
  // (a) blockquote lines (which the finalizer uses exclusively for
  // cover/disclaimer negation text — "NOT filing-ready", "NO agency
  // endorsement", "no claim of approved/eligible/...", etc.), or
  // (b) fenced code blocks (which contain raw appendix JSON the
  // operator is supposed to inspect). Forbidden language anywhere
  // ELSE in the markdown is a real authoring failure and must hit.
  function _stripQuotesAndCode(text) {
    if (typeof text !== 'string' || !text.length) return '';
    // Remove fenced code blocks first (greedy match between ``` ... ```).
    var noCode = text.replace(/```[\s\S]*?```/g, '\n');
    // Then drop blockquote lines (those starting with optional spaces
    // and a `>` character).
    var lines = noCode.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*>/.test(lines[i])) continue;
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  function _scanForbiddenLanguage(text) {
    if (typeof text !== 'string' || !text.length) return [];
    var scannable = _stripQuotesAndCode(text);
    var hits = [];
    for (var i = 0; i < FORBIDDEN_RX.length; i++) {
      if (FORBIDDEN_RX[i].test(scannable)) hits.push(FORBIDDEN_RX[i].source);
    }
    return hits;
  }

  function validateFinalized(finalized) {
    var errors = [];
    if (!_isObj(finalized)) return { ok: false, errors: ['finalized: not an object'] };
    if (finalized.finalizerSchemaVersion !== SCHEMA_VERSION) errors.push('finalizerSchemaVersion mismatch');
    if (finalized.status !== 'final_draft_only')             errors.push('status must be final_draft_only');
    if (finalized.notSubmission       !== true)              errors.push('notSubmission must be true');
    if (finalized.notApproval         !== true)              errors.push('notApproval must be true');
    if (finalized.humanReviewRequired !== true)              errors.push('humanReviewRequired must be true');
    if (finalized.executionAllowed    !== false)             errors.push('executionAllowed must be false');
    if (typeof finalized.markdown !== 'string' || !finalized.markdown.length) errors.push('markdown missing');
    if (!_isStr(finalized.lane))                             errors.push('lane missing');
    if (!Array.isArray(finalized.warnings))                  errors.push('warnings must be array');
    if (!Array.isArray(finalized.missingEvidence))           errors.push('missingEvidence must be array');
    if (!listSupportedLanes().some(function (l) { return l === finalized.lane; })) {
      errors.push('lane "' + finalized.lane + '" not supported');
    }
    var hits = _scanForbiddenLanguage(finalized.markdown || '');
    if (hits.length) errors.push({ forbiddenLanguageInMarkdown: hits });
    return errors.length ? { ok: false, errors: errors } : { ok: true };
  }

  // ── Dispatcher ────────────────────────────────────────────────────
  function finalizePackage(pkg, options) {
    if (!_isObj(pkg)) return { ok: false, error: 'INVALID_PACKAGE', errors: ['pkg must be an object'] };
    if (pkg.executionAllowed === true) return { ok: false, error: 'EXECUTION_NOT_ALLOWED', errors: ['pkg.executionAllowed must be false'] };
    if (pkg.status !== 'draft_package_only') return { ok: false, error: 'WRONG_STATUS', errors: ['pkg.status must be draft_package_only'] };
    var lane = pkg.lane;
    if (!_isStr(lane)) return { ok: false, error: 'LANE_MISSING', errors: ['pkg.lane required'] };

    if (lane === 'patents')                                                  return finalizePatent(pkg, options);
    if (Object.prototype.hasOwnProperty.call(GRANT_LANES, lane))             return finalizeGrant(pkg, options);
    if (lane === 'sba-loans')                                                return finalizeSba(pkg, options);
    if (lane === 'investments')                                              return finalizeInvestment(pkg, options);

    return {
      ok: false,
      error: 'UNSUPPORTED_LANE',
      errors: ['Lane "' + lane + '" not supported by MB-D finalizer. Supported: ' + listSupportedLanes().join(', ')]
    };
  }

  function listSupportedLanes() {
    return ['patents', 'business-grants', 'research-grants', 'nsf-project-pitch', 'sba-loans', 'investments'];
  }

  // ── Public attachment (extension, not replacement) ────────────────
  if (typeof window !== 'undefined') {
    try {
      window.LIMENMasterBrain = window.LIMENMasterBrain || {};
      window.LIMENMasterBrain.artifactFinalizer = {
        schemaVersion:       SCHEMA_VERSION,
        finalizePackage:     finalizePackage,
        finalizePatent:      finalizePatent,
        finalizeGrant:       finalizeGrant,
        finalizeSba:         finalizeSba,
        finalizeInvestment:  finalizeInvestment,
        renderMarkdown:      renderMarkdown,
        renderHtml:          renderHtml,
        validateFinalized:   validateFinalized,
        listSupportedLanes:  listSupportedLanes
      };
      try { console.info('[MB-D] artifactFinalizer attached (' + SCHEMA_VERSION + ')'); } catch (_) {}
      try {
        if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('limen:artifact-finalizer-ready', {
            detail: { schemaVersion: SCHEMA_VERSION }
          }));
        }
      } catch (_) {}
    } catch (attachErr) {
      try { console.error('[MB-D] artifactFinalizer attach FAILED:', attachErr); } catch (_) {}
    }
  }
})();
