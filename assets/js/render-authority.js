/**
 * render-authority.js — shared Gate B contract for entity-specific
 * claim rendering. Provides an authority CLASSIFICATION (not just a
 * boolean) plus a banner renderer that claim-painting surfaces must
 * call instead of inlining presence-checks against company data.
 *
 * Status: v0.1 — extracted from company-portal-ui.js inline patch
 * (commit adec4819d9d). No behavior change is committed by this
 * file's presence alone — no caller references it yet. The actual
 * caller swap inside company-portal-ui.js lands in a separate
 * commit. Until that swap, this module is a dormant contract.
 *
 * Doctrine carried in:
 *   Execution evidence is not entity-specific evidence.
 *   A pattern firing on an entity is a candidate match, not an
 *   entity verdict, unless the artifact carries entity-specific
 *   evidence.
 * See feedback_execution_evidence_not_entity_specific in operator memory.
 *
 * Roadmap:
 *   v0.1 — NO_EXECUTION_EVIDENCE detection (Chevron class). THIS FILE.
 *   v0.2 — PLACEHOLDER_CONTAMINATED detection (Danaher class).
 *          Largely text-regex on engineOutputs content.
 *   v0.3 — PATTERN_GENERIC_NOT_ENTITY_SPECIFIC detection
 *          (Montrose / Waste Management / Bank of America class).
 *          Requires an evidence contract at artifact mint time
 *          (evidenceRefs / entitySpecificObservations / sourceFields /
 *          company-specific rationale) plus a renderer-side check.
 *
 * Naming discipline:
 *   The v0.1 predicate is intentionally NOT called isExecuted().
 *   That word over-claims. hasExecutionEvidenceV01 preserves the
 *   honest semantic: there is evidence the engine ran for this
 *   entity, but the content has not been validated for placeholder
 *   contamination (v0.2) or pattern-genericness (v0.3).
 */
(function() {
  'use strict';

  var STATES = {
    NO_EXECUTION_EVIDENCE: 'NO_EXECUTION_EVIDENCE',
    EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED: 'EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED',
    PLACEHOLDER_CONTAMINATED: 'PLACEHOLDER_CONTAMINATED',
    PATTERN_GENERIC_NOT_ENTITY_SPECIFIC: 'PATTERN_GENERIC_NOT_ENTITY_SPECIFIC'
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /**
   * Truthy if value is non-null, non-undefined, and contains at
   * least one non-whitespace character once coerced to string.
   * Closes the v0 false-negative on Chevron (asOf="" passed the
   * v0 `!= null` check and rendered without banner).
   */
  function hasNonBlankValue(value) {
    return value !== null &&
           value !== undefined &&
           String(value).trim().length > 0;
  }

  /**
   * Truthy if value is a non-empty array OR a non-empty plain
   * object. Containers with the slot present but no entries are
   * treated as absent.
   */
  function hasSubstantiveEntries(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }

  /**
   * v0.1 boolean predicate — "is there any evidence the engine ran
   * for this entity?". Equivalent to
   *   classifyAuthorityV01(co) !== STATES.NO_EXECUTION_EVIDENCE.
   *
   * Checks slot presence only. Does NOT validate that content is
   * entity-specific (v0.3) or free of placeholder text (v0.2).
   */
  function hasExecutionEvidenceV01(co) {
    if (!co) return false;
    return Boolean(
      (co.financialHealth && hasNonBlankValue(co.financialHealth.asOf)) ||
      hasSubstantiveEntries(co.engineOutputs) ||
      hasSubstantiveEntries(co.bridgeReadings)
    );
  }

  /**
   * Authority classification. Returns one of STATES.
   *
   * v0.1 implementation reaches:
   *   NO_EXECUTION_EVIDENCE                          (evidence slots empty)
   *   EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED  (slots populated; content not inspected)
   *
   * PLACEHOLDER_CONTAMINATED and PATTERN_GENERIC_NOT_ENTITY_SPECIFIC
   * are reserved values; their detectors arrive in v0.2 / v0.3.
   * Until then, content that is contaminated or pattern-generic
   * collapses into EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED.
   */
  function classifyAuthorityV01(co) {
    if (!hasExecutionEvidenceV01(co)) {
      return STATES.NO_EXECUTION_EVIDENCE;
    }
    return STATES.EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED;
  }

  /**
   * Diagnostic snippet describing which evidence slots are present
   * vs absent for this entity. Embedded in the NO_EXECUTION_EVIDENCE
   * banner so the operator can verify the predicate's call against
   * the data without opening DevTools.
   */
  function describeEvidenceSlots(co) {
    if (!co) return '<code style="color:#e85454">company data unavailable</code>';
    var fh = co.financialHealth;
    var fhAsOf = fh && fh.asOf != null ? String(fh.asOf) : 'null';

    var eoLabel;
    if (Array.isArray(co.engineOutputs)) {
      eoLabel = co.engineOutputs.length > 0 ? co.engineOutputs.length + ' items' : 'empty array';
    } else if (co.engineOutputs && typeof co.engineOutputs === 'object') {
      var eoKeys = Object.keys(co.engineOutputs).length;
      eoLabel = eoKeys > 0 ? eoKeys + ' keys' : 'empty object';
    } else {
      eoLabel = 'absent';
    }

    var brLabel;
    if (Array.isArray(co.bridgeReadings)) {
      brLabel = co.bridgeReadings.length > 0 ? co.bridgeReadings.length + ' items' : 'empty array';
    } else if (co.bridgeReadings && typeof co.bridgeReadings === 'object') {
      var brKeys = Object.keys(co.bridgeReadings).length;
      brLabel = brKeys > 0 ? brKeys + ' keys' : 'empty object';
    } else {
      brLabel = 'absent';
    }

    return (
      '<code style="color:#e85454">financialHealth.asOf=' + esc(fhAsOf) + '</code> &middot; ' +
      '<code style="color:#e85454">engineOutputs=' + esc(eoLabel) + '</code> &middot; ' +
      '<code style="color:#e85454">bridgeReadings=' + esc(brLabel) + '</code>'
    );
  }

  /**
   * Banner HTML for the current authority state, parameterized by
   * section context. Empty string when the state does not require
   * a banner.
   *
   * v0.1 emits a banner only for NO_EXECUTION_EVIDENCE. Other states
   * collapse to no-banner until their detectors land.
   *
   * opts.sectionLabel — short noun for what the section claims to do
   *   ("diagnosis" / "engine output" / "verdict" / "treatment").
   *   Defaults to "diagnosis" to preserve the existing
   *   company-portal Intelligence Cycle string.
   */
  function renderAuthorityBanner(co, opts) {
    opts = opts || {};
    var sectionLabel = opts.sectionLabel || 'diagnosis';
    var state = classifyAuthorityV01(co);

    if (state === STATES.NO_EXECUTION_EVIDENCE) {
      var name = co && co.name ? esc(co.name) : 'this entity';
      var label = esc(sectionLabel);
      return (
        '<div style="padding:10px 12px;margin:6px 0 10px;border:1px solid rgba(232,84,84,0.35);background:rgba(232,84,84,0.06);border-radius:3px;font-size:0.4rem;line-height:1.7;color:rgba(232,180,180,0.85)">' +
        '<strong style="letter-spacing:1.5px;color:#e85454">PROCEDURE TEMPLATE — NOT RUN FOR THIS ENTITY.</strong> ' +
        'The text below describes how ' + label + ' <em>would</em> be performed for ' + name + ', not what ' + label + ' has found. No execution recorded: ' +
        describeEvidenceSlots(co) +
        '</div>'
      );
    }

    // v0.2 will branch on PLACEHOLDER_CONTAMINATED here.
    // v0.3 will branch on PATTERN_GENERIC_NOT_ENTITY_SPECIFIC here.

    return '';
  }

  window.LIMENRenderAuthority = {
    STATES: STATES,
    classifyAuthorityV01: classifyAuthorityV01,
    hasExecutionEvidenceV01: hasExecutionEvidenceV01,
    renderAuthorityBanner: renderAuthorityBanner,
    describeEvidenceSlots: describeEvidenceSlots,
    hasNonBlankValue: hasNonBlankValue,
    hasSubstantiveEntries: hasSubstantiveEntries,
    version: '0.1.0'
  };
})();
