/**
 * MB-C — Master Brain Artifact Factory (deterministic skeleton).
 *
 * STATUS: SCAFFOLD. Builds template-shaped draft packages from MB-A intake
 * items by deterministic projection of the ArtifactPacket already on the
 * intake. NO LLM CALLS. NO NETWORK. NO PERSISTENCE BEYOND CALLER. NO
 * EXTERNAL ACTIONS. NO FILING. NO TRADING. NO SUBMISSION. Output is a
 * plain JS object the caller may render or pass to a future generator.
 *
 * Anti-overclaim invariants — every package returned by this module:
 *   status:                'draft_package_only'
 *   notSubmission:         true
 *   notApproval:           true
 *   humanReviewRequired:   true
 *   executionAllowed:      false
 *
 * Dispatch:
 *   buildDraftPackage(intakeItem) -> { ok, package | error, errors[] }
 *
 *   intakeItem.lane drives the dispatch:
 *     'patents'                                        -> buildPatentPackage
 *     'business-grants' | 'research-grants' |
 *       'nsf-project-pitch'                            -> buildGrantPackage
 *     'sba-loans'                                      -> buildSbaPackage
 *     'investments'                                    -> buildInvestmentMemo
 *     anything else                                    -> { ok:false, error:'UNSUPPORTED_LANE' }
 *
 * Investment memo extras:
 *   If window.LIMENCommandBoardData (or .companies) exists, the memo
 *   looks up the company by ticker / CIK / slug found in the artifact
 *   packet's identity / provenance. If nothing matches, the memo marks
 *   the relevant fields as 'missingEvidence' rather than fabricating.
 *
 * Hard rules (caller-visible disclaimers in every package):
 *   - Patent: NOT filing-ready. NOT legal advice. Attorney review required.
 *   - Grant: NO funding decision. NO agency endorsement. Eligibility unverified.
 *   - SBA:   NO loan approval. NO eligibility determination. Lender review required.
 *   - Investment: NOT investment advice. NOT trade execution. Human approval required.
 *
 * Forbidden output language (all sections + section bodies):
 *   "submission-ready", "approved", "funded", "eligible", "endorsed",
 *   "guaranteed", "buy now", "sell now", "executed trade", "filing-ready".
 *   The factory neither emits these phrases nor accepts them as input
 *   when validatePackage() runs over a returned package.
 *
 * Exposes: window.LIMENMasterBrain.artifactFactory
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 'MB-C.v1';

  var GRANT_LANES = {
    'business-grants':   1,
    'research-grants':   1,
    'nsf-project-pitch': 1
  };

  // Forbidden phrases the factory itself must never emit, and which
  // validatePackage() rejects on output.
  //
  // Note: bare "guarantee" / "guaranteed" / "guarantees" appears in
  // legitimate banking terminology ("personal guarantee" on SBA loans),
  // so the rule must require a CLAIM CONTEXT — guaranteed AWARD/funding/
  // approval/outcome/return — to fire. Same logic for "approved" and
  // "filing/submission/eligibility": only block when the surrounding
  // words assert a claim, not when the term appears as plain vocabulary.
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
  function _safe(v) {
    if (v === null || typeof v === 'undefined') return null;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }
  function _str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  // ── Common skeleton — every lane share this envelope ──────────────
  function _baseEnvelope(intakeItem, lane) {
    return {
      packageSchemaVersion: SCHEMA_VERSION,
      lane:                 lane,
      sourceIntakeId:       (intakeItem && intakeItem.id) || null,
      sourceArtifactPacketId:
        (intakeItem && intakeItem.artifactPacketSummary && intakeItem.artifactPacketSummary.identityId) ||
        (intakeItem && intakeItem.artifactPacket && intakeItem.artifactPacket.identity && intakeItem.artifactPacket.identity.id) ||
        null,
      generatedAt:          new Date().toISOString(),
      status:               'draft_package_only',
      notSubmission:        true,
      notApproval:          true,
      humanReviewRequired:  true,
      executionAllowed:     false,
      missingEvidence:      [],
      verifierWarnings:     [],
      disclaimers:          [],
      sections:             {}
    };
  }

  function _checkPacket(pkg, intakeItem) {
    var pkt = (intakeItem && intakeItem.artifactPacket) || {};
    if (!_isObj(pkt)) {
      pkg.missingEvidence.push('artifactPacket: object missing on intake');
      return null;
    }
    return pkt;
  }

  function _markMissing(pkg, fieldPath, reason) {
    pkg.missingEvidence.push(reason ? (fieldPath + ': ' + reason) : fieldPath);
  }

  function _addDisclaimer(pkg, txt) { pkg.disclaimers.push(txt); }

  // ── Patent package ────────────────────────────────────────────────
  function buildPatentPackage(intakeItem) {
    var pkg = _baseEnvelope(intakeItem, 'patents');
    var pkt = _checkPacket(pkg, intakeItem);
    if (!pkt) return { ok: false, error: 'PACKET_MISSING', package: pkg };

    var idy  = pkt.identity || {};
    var ev   = pkt.evidence || {};
    var imp  = pkt.implementation || {};
    var sig  = pkt.signal || {};
    var prov = pkt.provenance || {};
    var council = (intakeItem && intakeItem.councilArtifacts) || null;

    pkg.sections = {
      inventionDisclosureSummary: {
        title:        _str(idy.title) || null,
        domain:       _str(idy.domain) || null,
        whyNow:       _str(sig.whyNow) || null,
        sourceNote:   'Derived from ArtifactPacket identity + signal. Council critique status: ' +
                      ((council && council.critiqueStatus) || 'not present')
      },
      problem: {
        statement:  _str(ev.failure) || _str(ev.trigger) || null,
        evidence:   _str(ev.validation) || null
      },
      technicalField: {
        domain:     _str(idy.domain) || null,
        node:       _str(idy.node)   || null,
        diagnoses:  Array.isArray(idy.diagnoses) ? idy.diagnoses.slice(0, 16) : []
      },
      background: {
        triggerEvidence: _str(ev.trigger) || null,
        validation:      _str(ev.validation) || null,
        sources:         _summarizeProvenance(prov)
      },
      systemOverview: {
        action:       _str(imp.action) || null,
        nextStep:     _str(imp.nextStep) || null,
        target:       _str(imp.target) || null
      },
      methodSteps: {
        // Method steps are NOT extracted from prose. Marked missing —
        // attorney review must transcribe with the inventor.
        steps:       [],
        sourceNote:  'Method steps require inventor walkthrough; not derived from packet evidence.'
      },
      possibleEmbodiments: {
        embodiments: [],
        sourceNote:  'Embodiments require inventor input; placeholder.'
      },
      noveltyHypotheses: {
        hypotheses:  [],
        sourceNote:  'Novelty assessment is determined by prior-art search and patent counsel — NOT asserted here.'
      },
      priorArtSearchChecklist: [
        'Run Google Patents query on technical-field keywords',
        'Run USPTO Patent Public Search on best-fit CPC class',
        'Run WIPO PatentScope cross-jurisdiction search',
        'Capture top 10 candidate references with publication date + assignee',
        'Confirm or reject overlap with each reference in writing'
      ],
      claimDraftPlaceholders: {
        independentClaims: [],
        dependentClaims:   [],
        sourceNote:        'Claims must be drafted by counsel; placeholders only.'
      },
      drawingsFigureList: {
        figures:    [],
        sourceNote: 'Figures must be prepared post-walkthrough; placeholder.'
      },
      attorneyReviewChecklist: [
        'Inventor walkthrough completed and recorded',
        'Prior-art search results reviewed by counsel',
        'Claims drafted by counsel and reviewed with inventor',
        'Figures prepared and reviewed with counsel',
        'Specification reviewed for sufficient enablement and written description',
        'Inventorship and assignment confirmed in writing',
        'Decision to file (provisional or non-provisional) made BY HUMAN counsel'
      ],
      councilCritiqueSummary: council ? {
        draftStatus:           council.draftStatus || null,
        critiqueStatus:        council.critiqueStatus || null,
        objectionLedgerLength: council.objectionLedgerLength || 0,
        objectionSummary:      council.objectionSummary || null,
        reviewedAt:            council.reviewedAt || null
      } : null
    };

    _addDisclaimer(pkg,
      'NOT filing-ready. NOT legal advice. NOT a patentability determination. ' +
      'NO opinion is offered on novelty, non-obviousness, written description, ' +
      'enablement, or freedom to operate. Attorney review is required before any filing.');

    if (!pkg.sections.problem.statement && !pkg.sections.problem.evidence) {
      _markMissing(pkg, 'sections.problem', 'no failure/trigger/validation evidence on packet');
    }
    if (!pkg.sections.systemOverview.action) {
      _markMissing(pkg, 'sections.systemOverview.action', 'implementation.action missing');
    }
    if (!pkg.sections.background.sources.length) {
      _markMissing(pkg, 'sections.background.sources', 'provenance.feedSources missing');
    }
    return { ok: true, package: pkg };
  }

  // ── Grant package ─────────────────────────────────────────────────
  function buildGrantPackage(intakeItem) {
    var lane = (intakeItem && intakeItem.lane) || 'business-grants';
    var pkg  = _baseEnvelope(intakeItem, lane);
    var pkt  = _checkPacket(pkg, intakeItem);
    if (!pkt) return { ok: false, error: 'PACKET_MISSING', package: pkg };

    var idy  = pkt.identity || {};
    var ev   = pkt.evidence || {};
    var imp  = pkt.implementation || {};
    var sig  = pkt.signal || {};
    var prov = pkt.provenance || {};
    var council = (intakeItem && intakeItem.councilArtifacts) || null;
    var isNsf = lane === 'nsf-project-pitch';

    pkg.sections = {
      projectTitle:        _str(idy.title) || null,
      problemNeed: {
        statement: _str(ev.failure) || _str(ev.trigger) || null,
        whyNow:    _str(sig.whyNow) || null
      },
      innovation: {
        action:    _str(imp.action) || null,
        doThis:    _str(imp.doThis) || null
      },
      objectives: {
        objectives: [],
        sourceNote: 'Objectives must be authored by PI; placeholder.'
      },
      approach: {
        nextStep:   _str(imp.nextStep) || null,
        timing:     _str(imp.timing) || null
      },
      expectedOutcomes: {
        outcomes:   [],
        sourceNote: 'Outcomes must be authored by PI; not asserted from packet.'
      },
      broaderImpactsPublicBenefit: {
        impacts:    [],
        sourceNote: isNsf
          ? 'Broader Impacts is an NSF review CRITERION to strengthen, NOT an outcome to claim. Author with PI.'
          : 'Public benefit must be authored with sponsor; placeholder.'
      },
      budgetAssumptionsPlaceholder: {
        budgetCategoryHints: ['Personnel', 'Equipment', 'Materials/Supplies', 'Travel', 'Indirect costs'],
        sourceNote: 'Budget figures are NOT asserted. PI + finance officer must complete.'
      },
      eligibilityMissingEvidence: {
        items: [],
        sourceNote: 'Eligibility is determined by the sponsoring agency, NOT by this packet.'
      },
      reviewerRiskChecklist: [
        'Confirm program scope match (read FOA / NOFO line by line)',
        'Confirm small-business / R&D / institutional eligibility per sponsor rules',
        'Confirm character/page limits per current solicitation',
        'Capture any unknown/forbidden fields explicitly as gaps',
        'Confirm broader-impacts plan has measurable indicators',
        'Human reviewer signs off before submission'
      ],
      councilCritiqueSummary: council ? {
        draftStatus:           council.draftStatus || null,
        critiqueStatus:        council.critiqueStatus || null,
        objectionLedgerLength: council.objectionLedgerLength || 0,
        objectionSummary:      council.objectionSummary || null,
        reviewedAt:            council.reviewedAt || null
      } : null
    };

    _addDisclaimer(pkg,
      'NO funding decision. NO agency endorsement. NO eligibility determination. ' +
      'Eligibility is set by the sponsoring agency. Submission readiness requires ' +
      'human PI + sponsored-research-office review.');
    if (isNsf) {
      _addDisclaimer(pkg,
        'NSF SBIR/STTR specifics: Project Pitch is a pre-application; if invited, ' +
        'a full proposal would be requested. NSF has not been contacted by this packet. ' +
        'No claim of "NSF will fund", "invited by NSF", "intellectual merit established", ' +
        '"broader impacts achieved", "reviewer consensus", or "prior award success".');
    }

    if (!pkg.sections.problemNeed.statement) {
      _markMissing(pkg, 'sections.problemNeed.statement', 'no failure/trigger evidence on packet');
    }
    if (!pkg.sections.innovation.action && !pkg.sections.innovation.doThis) {
      _markMissing(pkg, 'sections.innovation', 'implementation action/doThis missing');
    }
    var feedSources = _summarizeProvenance(prov);
    if (!feedSources.length) {
      _markMissing(pkg, 'sections.problemNeed.evidenceSources', 'provenance.feedSources missing');
    } else {
      pkg.sections.problemNeed.evidenceSources = feedSources;
    }
    return { ok: true, package: pkg };
  }

  // ── SBA package ───────────────────────────────────────────────────
  function buildSbaPackage(intakeItem) {
    var pkg = _baseEnvelope(intakeItem, 'sba-loans');
    var pkt = _checkPacket(pkg, intakeItem);
    if (!pkt) return { ok: false, error: 'PACKET_MISSING', package: pkg };

    var idy  = pkt.identity || {};
    var ev   = pkt.evidence || {};
    var imp  = pkt.implementation || {};
    var sig  = pkt.signal || {};
    var council = (intakeItem && intakeItem.councilArtifacts) || null;

    pkg.sections = {
      businessConcept: {
        title:        _str(idy.title) || null,
        domain:       _str(idy.domain) || null,
        whyNow:       _str(sig.whyNow) || null,
        sourceNote:   'Concept derived from ArtifactPacket identity + signal.'
      },
      useOfFunds: {
        items:      [],
        sourceNote: 'Use of funds must be itemized by operator; placeholder.'
      },
      marketNeed: {
        triggerEvidence: _str(ev.trigger) || null,
        validation:      _str(ev.validation) || null
      },
      operatingPlan: {
        action:    _str(imp.action) || null,
        nextStep:  _str(imp.nextStep) || null,
        timing:    _str(imp.timing) || null
      },
      revenueModel: {
        moneyChainEvidence: _str(ev.moneyChainEvidence) || null,
        sourceNote: 'Revenue projections require operator pro-forma; not asserted.'
      },
      staffingOperatorPlan: {
        roles:      [],
        sourceNote: 'Staffing plan must be authored by operator; placeholder.'
      },
      riskFactors: {
        marketRisk:      'Market acceptance uncertain; pilot data required.',
        regulatoryRisk:  'Regulatory environment subject to change.',
        executionRisk:   'Operator execution capability unverified by this packet.',
        capitalRisk:     'Loan terms, collateral, and personal guarantee not modeled.',
        sourceNote:      'Risks listed are placeholders; lender must perform full underwriting.'
      },
      documentsNeeded: [
        'Form 1919 (SBA borrower information form)',
        'Personal financial statement',
        'Three years business and personal tax returns',
        'Year-to-date P&L and balance sheet',
        '2+ years of financial projections',
        'Business debt schedule',
        'Use-of-funds itemization',
        'Resumes / management team',
        'Organizational documents (articles, operating agreement, bylaws)',
        'Business licenses / permits applicable to industry'
      ],
      lenderReviewChecklist: [
        'Confirm SBA 7(a) or 504 program fit',
        'Confirm size standard / industry NAICS eligibility',
        'Confirm credit elsewhere test',
        'Confirm collateral coverage and personal guarantee',
        'Confirm 5 Cs of credit assessment',
        'Human lender underwriter signs off before any commitment'
      ],
      councilCritiqueSummary: council ? {
        draftStatus:           council.draftStatus || null,
        critiqueStatus:        council.critiqueStatus || null,
        objectionLedgerLength: council.objectionLedgerLength || 0,
        objectionSummary:      council.objectionSummary || null,
        reviewedAt:            council.reviewedAt || null
      } : null
    };

    _addDisclaimer(pkg,
      'NO loan approval. NO eligibility determination. NO underwriting opinion. ' +
      'SBA programs require borrower documentation review and lender underwriting. ' +
      'No claim of "approved", "guaranteed", "eligible", or "ready to close".');

    if (!pkg.sections.marketNeed.triggerEvidence && !pkg.sections.marketNeed.validation) {
      _markMissing(pkg, 'sections.marketNeed', 'no trigger/validation evidence on packet');
    }
    if (!pkg.sections.revenueModel.moneyChainEvidence) {
      _markMissing(pkg, 'sections.revenueModel.moneyChainEvidence', 'evidence.moneyChainEvidence missing');
    }
    return { ok: true, package: pkg };
  }

  // ── Investment memo ───────────────────────────────────────────────
  function buildInvestmentMemo(intakeItem) {
    var pkg = _baseEnvelope(intakeItem, 'investments');
    var pkt = _checkPacket(pkg, intakeItem);
    if (!pkt) return { ok: false, error: 'PACKET_MISSING', package: pkg };

    var idy  = pkt.identity || {};
    var ev   = pkt.evidence || {};
    var imp  = pkt.implementation || {};
    var sig  = pkt.signal || {};
    var prov = pkt.provenance || {};
    var council = (intakeItem && intakeItem.councilArtifacts) || null;

    // Try to discover ticker / CIK from packet text. Conservative regex —
    // does NOT scan the full ArtifactPacket aggressively to avoid false
    // positives in prose. Only reads explicit identity/citation hints.
    var hint = _findCompanyHints(pkt);
    var companyContext = _resolveCompanyFromCommandBoard(hint);

    pkg.sections = {
      thesis: {
        statement:    _str(idy.title) || null,
        whyNow:       _str(sig.whyNow) || null,
        triggerEvidence: _str(ev.trigger) || null
      },
      targetCompanyTicker: {
        ticker:       (companyContext && companyContext.t) || hint.ticker || null,
        cik:          (companyContext && companyContext.c) || hint.cik    || null,
        name:         (companyContext && companyContext.n) || null,
        slug:         (companyContext && companyContext.s) || null,
        sourceNote:   companyContext
          ? 'Resolved from window.LIMENCommandBoardData via ticker/CIK match.'
          : 'No matching ticker/CIK in command-board data — see missingEvidence.'
      },
      kernelCommandBoardContext: companyContext
        ? {
            phase:           companyContext.p  || null,
            trajectory:      companyContext.tr || null,
            composite:       (typeof companyContext.co === 'number') ? companyContext.co : null,
            domain:          companyContext.d  || null,
            domainStress:    (typeof companyContext.ds === 'number') ? companyContext.ds : null,
            active:          companyContext.a === true,
            sourceNote:      'Read-only Command-Board snapshot. Kernel output is decision support, NOT autonomous trading authority.'
          }
        : {
            sourceNote: 'No kernel context available for this intake. Field intentionally empty rather than fabricated.'
          },
      domainStressContext: {
        artifactPacketStressBand: _str(sig.stressBand) || null,
        artifactPacketStress:     (typeof sig.stress === 'number') ? sig.stress : null,
        commandBoardDomainStress: (companyContext && typeof companyContext.ds === 'number') ? companyContext.ds : null
      },
      catalysts: {
        catalysts:   [],
        sourceNote:  'Catalysts must be authored by analyst; placeholder.'
      },
      bullCase: {
        statement:   _str(ev.outcome) || null,
        sourceNote:  'Bull case derived narrowly from packet evidence.outcome; analyst must expand.'
      },
      bearCase: {
        statement:   _str(ev.failure) || null,
        sourceNote:  'Bear case derived narrowly from packet evidence.failure; analyst must expand.'
      },
      invalidationConditions: {
        conditions: [],
        sourceNote: 'Invalidation conditions must be authored by analyst before any position is opened.'
      },
      positionSizingPlaceholder: {
        sizing:     null,
        sourceNote: 'Position sizing requires portfolio context (capital, concentration, correlation). NOT specified here.'
      },
      riskLimitsPlaceholder: {
        stopLoss:           null,
        maxAdverseExcursion: null,
        timeStop:           null,
        sourceNote:         'Risk limits must be set by human analyst before opening any position.'
      },
      missingEvidenceFlags: [],
      humanApprovalCheckpoint: [
        'Analyst reviews and signs the thesis',
        'Risk officer reviews position sizing and stop-loss',
        'Compliance reviews any restricted-list / blackout windows',
        'Trade decision is made BY HUMAN — never by this packet',
        'Order entry, if any, occurs in approved trading system — not via Helix'
      ],
      councilCritiqueSummary: council ? {
        draftStatus:           council.draftStatus || null,
        critiqueStatus:        council.critiqueStatus || null,
        objectionLedgerLength: council.objectionLedgerLength || 0,
        objectionSummary:      council.objectionSummary || null,
        reviewedAt:            council.reviewedAt || null
      } : null
    };

    _addDisclaimer(pkg,
      'NOT investment advice. NOT a recommendation to buy or sell any security. ' +
      'NO trade is executed by this packet. NO order is staged. NO automation is wired. ' +
      'Kernel output is decision support; trading decisions are made by human analysts ' +
      'under their existing risk and compliance frameworks.');

    if (!companyContext) {
      _markMissing(pkg, 'sections.targetCompanyTicker',
        'No ticker/CIK match in window.LIMENCommandBoardData. Command-board not loaded on this page or company unknown.');
    }
    if (!pkg.sections.thesis.triggerEvidence) {
      _markMissing(pkg, 'sections.thesis.triggerEvidence', 'evidence.trigger missing');
    }
    if (!pkg.sections.bullCase.statement) {
      _markMissing(pkg, 'sections.bullCase', 'evidence.outcome missing');
    }
    if (!pkg.sections.bearCase.statement) {
      _markMissing(pkg, 'sections.bearCase', 'evidence.failure missing');
    }
    pkg.sections.missingEvidenceFlags = pkg.missingEvidence.slice();
    return { ok: true, package: pkg };
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function _summarizeProvenance(prov) {
    if (!_isObj(prov)) return [];
    var sources = Array.isArray(prov.feedSources) ? prov.feedSources : [];
    var out = [];
    for (var i = 0; i < sources.length && i < 8; i++) {
      var s = sources[i];
      if (!s) continue;
      out.push({
        name:           s.name || '',
        live:           s.live === true,
        classification: s.classification || null
      });
    }
    return out;
  }

  // Conservative ticker / CIK extraction — we only look at known fields,
  // not free-form prose. False positives are worse than false negatives
  // here because the operator can always paste an updated intake.
  function _findCompanyHints(pkt) {
    var idy = (pkt && pkt.identity) || {};
    var prov = (pkt && pkt.provenance) || {};
    var hint = { ticker: null, cik: null, slug: null };

    // identity.title or identity.id may carry a ticker in parentheses.
    var titleStr = _str(idy.title);
    var m = titleStr.match(/\(([A-Z]{1,5})\)/);
    if (m) hint.ticker = m[1];

    // identity.sourceOpportunityId may be a slug or ticker — not assumed.
    var sid = _str(idy.sourceOpportunityId);
    if (sid && !hint.ticker && /^[A-Z]{1,5}$/.test(sid)) hint.ticker = sid;

    // provenance.citationHints may carry CIK. We do not parse here — leave
    // for analyst review.
    if (Array.isArray(prov.citationHints)) {
      for (var i = 0; i < prov.citationHints.length; i++) {
        var c = prov.citationHints[i];
        if (typeof c !== 'string') continue;
        var ckm = c.match(/cik[=:\s]*(\d{4,10})/i);
        if (ckm) { hint.cik = ckm[1]; break; }
      }
    }
    return hint;
  }

  function _resolveCompanyFromCommandBoard(hint) {
    if (typeof window === 'undefined') return null;
    var board = window.LIMENCommandBoardData ||
                (window.LIMENCommandBoard && window.LIMENCommandBoard.data) ||
                null;
    if (!board) return null;
    var companies = Array.isArray(board.companies) ? board.companies : (Array.isArray(board) ? board : []);
    if (!companies.length) return null;
    if (!hint || (!hint.ticker && !hint.cik && !hint.slug)) return null;
    for (var i = 0; i < companies.length; i++) {
      var c = companies[i];
      if (!c) continue;
      if (hint.ticker && c.t === hint.ticker) return c;
      if (hint.cik    && String(c.c) === String(hint.cik)) return c;
      if (hint.slug   && c.s === hint.slug) return c;
    }
    return null;
  }

  // ── Validators ────────────────────────────────────────────────────
  function _scanForbiddenLanguage(text) {
    if (typeof text !== 'string' || !text.length) return [];
    var hits = [];
    for (var i = 0; i < FORBIDDEN_RX.length; i++) {
      if (FORBIDDEN_RX[i].test(text)) hits.push(FORBIDDEN_RX[i].source);
    }
    return hits;
  }

  function _walk(obj, visit, path) {
    if (obj === null || typeof obj === 'undefined') return;
    if (typeof obj === 'string') return visit(path, obj);
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) _walk(obj[i], visit, path + '[' + i + ']');
      return;
    }
    if (typeof obj === 'object') {
      var keys = Object.keys(obj);
      for (var j = 0; j < keys.length; j++) _walk(obj[keys[j]], visit, path ? (path + '.' + keys[j]) : keys[j]);
    }
  }

  function validatePackage(pkg) {
    var errors = [];
    if (!_isObj(pkg)) return { ok: false, errors: ['package: not an object'] };
    if (pkg.packageSchemaVersion !== SCHEMA_VERSION) errors.push('packageSchemaVersion mismatch');
    if (pkg.status !== 'draft_package_only') errors.push('status must be draft_package_only');
    if (pkg.notSubmission !== true)        errors.push('notSubmission must be true');
    if (pkg.notApproval   !== true)        errors.push('notApproval must be true');
    if (pkg.humanReviewRequired !== true)  errors.push('humanReviewRequired must be true');
    if (pkg.executionAllowed !== false)    errors.push('executionAllowed must be false');
    if (!Array.isArray(pkg.missingEvidence))  errors.push('missingEvidence must be array');
    if (!Array.isArray(pkg.verifierWarnings)) errors.push('verifierWarnings must be array');
    if (!_isObj(pkg.sections))             errors.push('sections must be object');

    var forbidden = [];
    _walk(pkg.sections, function (path, text) {
      var hits = _scanForbiddenLanguage(text);
      if (hits.length) forbidden.push({ path: path, hits: hits, excerpt: text.slice(0, 160) });
    }, '');
    if (forbidden.length) errors.push({ forbiddenLanguageInSections: forbidden });

    return errors.length ? { ok: false, errors: errors } : { ok: true };
  }

  // ── Dispatcher ────────────────────────────────────────────────────
  function buildDraftPackage(intakeItem) {
    if (!_isObj(intakeItem)) {
      return { ok: false, error: 'INVALID_INTAKE', errors: ['intakeItem must be an object'] };
    }
    if (intakeItem.executionAllowed === true) {
      return { ok: false, error: 'EXECUTION_NOT_ALLOWED', errors: ['intakeItem.executionAllowed must be false'] };
    }
    var lane = intakeItem.lane;
    if (!_isStr(lane)) return { ok: false, error: 'LANE_MISSING', errors: ['intakeItem.lane required'] };

    if (lane === 'patents')               return buildPatentPackage(intakeItem);
    if (Object.prototype.hasOwnProperty.call(GRANT_LANES, lane)) return buildGrantPackage(intakeItem);
    if (lane === 'sba-loans')             return buildSbaPackage(intakeItem);
    if (lane === 'investments')           return buildInvestmentMemo(intakeItem);

    return {
      ok: false,
      error: 'UNSUPPORTED_LANE',
      errors: ['Lane "' + lane + '" not supported by MB-C artifact factory. Supported: ' + listSupportedLanes().join(', ')]
    };
  }

  function listSupportedLanes() {
    return ['patents', 'business-grants', 'research-grants', 'nsf-project-pitch', 'sba-loans', 'investments'];
  }

  // ── Public attachment (extension, not replacement) ────────────────
  // MB-C.1: defensive attach + observable readiness event. The attach
  // block is wrapped in try/catch so any silent failure surfaces in
  // console as a clear error rather than leaving artifactFactory
  // undefined with no signal. The 'limen:artifact-factory-ready' event
  // lets the inbox UI re-render once the factory becomes available
  // even if late-loading or attached after the initial paint.
  if (typeof window !== 'undefined') {
    try {
      window.LIMENMasterBrain = window.LIMENMasterBrain || {};
      window.LIMENMasterBrain.artifactFactory = {
        schemaVersion:        SCHEMA_VERSION,
        buildDraftPackage:    buildDraftPackage,
        buildPatentPackage:   buildPatentPackage,
        buildGrantPackage:    buildGrantPackage,
        buildSbaPackage:      buildSbaPackage,
        buildInvestmentMemo:  buildInvestmentMemo,
        validatePackage:      validatePackage,
        listSupportedLanes:   listSupportedLanes
      };
      try { console.info('[MB-C] artifactFactory attached (' + SCHEMA_VERSION + ')'); } catch (_) {}
      try {
        if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('limen:artifact-factory-ready', {
            detail: { schemaVersion: SCHEMA_VERSION }
          }));
        }
      } catch (_) {}
    } catch (attachErr) {
      try { console.error('[MB-C] artifactFactory attach FAILED:', attachErr); } catch (_) {}
    }
  }
})();
