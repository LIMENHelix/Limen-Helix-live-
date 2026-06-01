/**
 * render-authority.js — shared Gate B contract for entity-specific
 * claim rendering. Provides an authority CLASSIFICATION (not just a
 * boolean) plus a banner renderer that claim-painting surfaces must
 * call instead of inlining presence-checks against company data.
 *
 * Status: v0.2 — adds PLACEHOLDER_CONTAMINATED detection on top of
 * v0.1's NO_EXECUTION_EVIDENCE detection. v0.3
 * (PATTERN_GENERIC_NOT_ENTITY_SPECIFIC) reserved.
 *
 * Empirical scope (canonical repo, 767 company portals, scanned 2026-06-01):
 *   - 196 portals: NO_EXECUTION_EVIDENCE (engineOutputs absent / empty)
 *   - 461 portals: engineOutputs present and contain placeholder tokens
 *                  → PLACEHOLDER_CONTAMINATED under v0.2
 *   - 110 portals: engineOutputs present, no placeholders detected
 *                  → EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED
 *                    (still hedged pending v0.3 pattern-genericness check)
 *
 *   Placeholders live ONLY in engineOutputs across the entire universe.
 *   intelligenceCycle is procedure-template text (zero placeholders found),
 *   bridgeReadings and financialHealth are also placeholder-free.
 *   v0.2 therefore scopes its scan to engineOutputs at the company level.
 *
 * Doctrine carried in:
 *   Execution evidence is not entity-specific evidence.
 *   A pattern firing on an entity is a candidate match, not an entity
 *   verdict, unless the artifact carries entity-specific evidence.
 * (See feedback_execution_evidence_not_entity_specific in operator memory.)
 *
 *   v0.2 narrowly addresses one sub-class:
 *     Execution artifact exists, but content is incomplete/template-contaminated.
 *
 * IMPORTANT — production wiring status:
 *   At v0.2 release, the only caller of this module is company-portal-ui.js
 *   (which calls classifyAuthorityV01 — a string-returning, v0.1-only entry
 *   point that does NOT return PLACEHOLDER_CONTAMINATED). The richer
 *   classifyAuthority() and classifyArtifactAuthority() are unused until
 *   #44 wires them into company-portal-engine-render.js. Until then, no
 *   production surface fires the v0.2 banner. Danaher-class portals are
 *   detected by this module but their engineOutputs continue to render
 *   without an "INCOMPLETE TEMPLATE OUTPUT" warning until that wiring
 *   lands.
 *
 * Naming discipline:
 *   classifyAuthorityV01(co) is intentionally v0.1-only. It returns a
 *   string for backward-compat with the existing company-portal-ui.js
 *   caller. New callers should use classifyAuthority(co) /
 *   classifyArtifactAuthority(value) which return the rich object with
 *   placeholdersFound + suppressDirective.
 */
(function() {
  'use strict';

  var STATES = {
    NO_EXECUTION_EVIDENCE: 'NO_EXECUTION_EVIDENCE',
    EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED: 'EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED',
    PLACEHOLDER_CONTAMINATED: 'PLACEHOLDER_CONTAMINATED',
    PATTERN_GENERIC_NOT_ENTITY_SPECIFIC: 'PATTERN_GENERIC_NOT_ENTITY_SPECIFIC'
  };

  // Uppercase-template-variable regex. Matches:
  //   [POSITION_SIZE_PCT]   [PRICE]   [TARGET]   [UPSIDE_PCT]
  //   [METRIC]   [VALUE]   [MULTIPLE]
  //   $[PRICE]   $[TARGET]   $[BASIS]
  // Does NOT match:
  //   [1]   [23]   [12]                  (citations — no leading letter)
  //   ["DHR"]   ["10-K"]                 (JSON arrays — char after [ is quote)
  //   [lowercase]   [Mixed]              (must start with uppercase letter)
  //   [A]                                (under 2 chars total)
  var PLACEHOLDER_RE = /\$?\[[A-Z][A-Z0-9_]{1,80}\]/g;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function hasNonBlankValue(value) {
    return value !== null &&
           value !== undefined &&
           String(value).trim().length > 0;
  }

  function hasSubstantiveEntries(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }

  /**
   * Recursively walk any value (string, array, object) and collect
   * uppercase-template-variable placeholders.
   *
   * Returns a deduplicated array of placeholder tokens (e.g.
   * ['[POSITION_SIZE_PCT]', '$[PRICE]']).
   *
   * Non-string leaves (numbers, booleans, null) contribute nothing.
   * Cycles are detected via a WeakSet to avoid infinite recursion on
   * pathological inputs.
   */
  function findTemplatePlaceholders(value) {
    var found = {};
    var seen = new WeakSet();

    function walk(node) {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') {
        var m = node.match(PLACEHOLDER_RE);
        if (m) {
          for (var i = 0; i < m.length; i++) found[m[i]] = true;
        }
        return;
      }
      if (typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        for (var j = 0; j < node.length; j++) walk(node[j]);
      } else {
        for (var k in node) {
          if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]);
        }
      }
    }

    walk(value);
    return Object.keys(found);
  }

  /**
   * Convenience boolean wrapper around findTemplatePlaceholders.
   */
  function hasPlaceholderContamination(value) {
    return findTemplatePlaceholders(value).length > 0;
  }

  /**
   * v0.1 boolean predicate — "is there any evidence the engine ran
   * for this entity?". Checks slot presence only. Does NOT validate
   * content for placeholder contamination (v0.2) or pattern-genericness
   * (v0.3).
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
   * v0.1 classifier — returns a STATES string. Backward-compatible with
   * the existing company-portal-ui.js caller. Reaches only
   * NO_EXECUTION_EVIDENCE or EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED.
   *
   * Does NOT detect placeholder contamination. Callers needing the v0.2
   * detector should use classifyAuthority(co) (rich object return).
   */
  function classifyAuthorityV01(co) {
    if (!hasExecutionEvidenceV01(co)) return STATES.NO_EXECUTION_EVIDENCE;
    return STATES.EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED;
  }

  /**
   * v0.2 company-level classifier. Returns
   *   { state, placeholdersFound, suppressDirective }
   *
   * Reaches:
   *   NO_EXECUTION_EVIDENCE          — engineOutputs/bridgeReadings/asOf
   *                                    all empty
   *   PLACEHOLDER_CONTAMINATED       — engineOutputs has uppercase-
   *                                    template-variable placeholders
   *   EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED
   *                                  — passes v0.1 + v0.2, pending v0.3
   *
   * NO_EXECUTION_EVIDENCE has priority over PLACEHOLDER_CONTAMINATED.
   * A portal with no engine output is reported as "not run", not as
   * "contaminated", even if the procedure-template text contains
   * bracketed labels (empirically it doesn't, but the priority order
   * is the right semantic anyway).
   *
   * Placeholder scan is scoped to co.engineOutputs only. Empirical
   * basis: across the canonical 767-portal universe, placeholders
   * appear in 461 portals' engineOutputs and 0 portals' other fields.
   */
  function classifyAuthority(co) {
    if (!hasExecutionEvidenceV01(co)) {
      return {
        state: STATES.NO_EXECUTION_EVIDENCE,
        placeholdersFound: [],
        suppressDirective: true
      };
    }
    var placeholders = findTemplatePlaceholders(co && co.engineOutputs);
    if (placeholders.length > 0) {
      return {
        state: STATES.PLACEHOLDER_CONTAMINATED,
        placeholdersFound: placeholders,
        suppressDirective: true
      };
    }
    // v0.3 PATTERN_GENERIC_NOT_ENTITY_SPECIFIC detector lands here.
    return {
      state: STATES.EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED,
      placeholdersFound: [],
      suppressDirective: false
    };
  }

  /**
   * v0.2 artifact-level classifier. Takes any value (string, object,
   * array) and reports whether it carries placeholder contamination.
   *
   * Returns { state, placeholdersFound, suppressDirective }.
   *
   * Does NOT reach NO_EXECUTION_EVIDENCE (that is a company-level
   * concept; an artifact either exists or doesn't, and the caller
   * decides). Used by engine-render et al. to gate single artifacts
   * (e.g. one patent draft, one investment thesis) inside a portal
   * that may have other clean artifacts.
   */
  function classifyArtifactAuthority(value) {
    var placeholders = findTemplatePlaceholders(value);
    if (placeholders.length > 0) {
      return {
        state: STATES.PLACEHOLDER_CONTAMINATED,
        placeholdersFound: placeholders,
        suppressDirective: true
      };
    }
    return {
      state: STATES.EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED,
      placeholdersFound: [],
      suppressDirective: false
    };
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
   * Snippet listing detected placeholder tokens for embedding in the
   * v0.2 banner. Caps at 12 to avoid runaway banner length; appends
   * "(N more)" if more exist.
   */
  function describePlaceholderList(placeholders) {
    if (!placeholders || placeholders.length === 0) return '';
    var visible = placeholders.slice(0, 12);
    var rest = placeholders.length - visible.length;
    var codes = visible.map(function(p) {
      return '<code style="color:#e85454">' + esc(p) + '</code>';
    }).join(' ');
    if (rest > 0) codes += ' <span style="opacity:0.7">… (' + rest + ' more)</span>';
    return codes;
  }

  /**
   * Banner HTML for the current authority state, parameterized by
   * section context. Empty string when the state does not require
   * a banner.
   *
   * Branches on classifyAuthority() result (rich, v0.2-aware):
   *   NO_EXECUTION_EVIDENCE       → v0.1 "PROCEDURE TEMPLATE" banner
   *   PLACEHOLDER_CONTAMINATED    → v0.2 "INCOMPLETE TEMPLATE OUTPUT" banner
   *   EXECUTION_EVIDENCE_PRESENT_CONTENT_UNVERIFIED  → no banner
   *
   * opts.sectionLabel — short noun for what the section claims to do
   *   ("diagnosis" / "engine output" / "verdict" / "treatment").
   *   Defaults to "diagnosis" to preserve the existing company-portal
   *   Intelligence Cycle string.
   *
   * Note on call sites: at v0.2 release, the only production caller
   * (company-portal-ui.js) gates this call on its own check of
   * classifyAuthorityV01(co) === NO_EXECUTION_EVIDENCE. So the v0.2
   * branch below is unreachable from that caller. It becomes reachable
   * once #44 wires this banner into company-portal-engine-render.js
   * (the renderer that actually paints engine output artifacts).
   */
  function renderAuthorityBanner(co, opts) {
    opts = opts || {};
    var sectionLabel = opts.sectionLabel || 'diagnosis';
    var result = classifyAuthority(co);

    if (result.state === STATES.NO_EXECUTION_EVIDENCE) {
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

    if (result.state === STATES.PLACEHOLDER_CONTAMINATED) {
      var name2 = co && co.name ? esc(co.name) : 'this entity';
      var label2 = esc(sectionLabel);
      return (
        '<div style="padding:10px 12px;margin:6px 0 10px;border:1px solid rgba(232,84,84,0.35);background:rgba(232,84,84,0.06);border-radius:3px;font-size:0.4rem;line-height:1.7;color:rgba(232,180,180,0.85)">' +
        '<strong style="letter-spacing:1.5px;color:#e85454">INCOMPLETE TEMPLATE OUTPUT — NOT READY TO USE.</strong> ' +
        'The ' + label2 + ' text below for ' + name2 + ' contains unfilled template placeholders. Engine output is incomplete: ' +
        describePlaceholderList(result.placeholdersFound) +
        '</div>'
      );
    }

    // v0.3 PATTERN_GENERIC_NOT_ENTITY_SPECIFIC will branch here.

    return '';
  }

  window.LIMENRenderAuthority = {
    STATES: STATES,
    PLACEHOLDER_RE: PLACEHOLDER_RE,
    classifyAuthorityV01: classifyAuthorityV01,
    classifyAuthority: classifyAuthority,
    classifyArtifactAuthority: classifyArtifactAuthority,
    hasExecutionEvidenceV01: hasExecutionEvidenceV01,
    hasPlaceholderContamination: hasPlaceholderContamination,
    findTemplatePlaceholders: findTemplatePlaceholders,
    renderAuthorityBanner: renderAuthorityBanner,
    describeEvidenceSlots: describeEvidenceSlots,
    describePlaceholderList: describePlaceholderList,
    hasNonBlankValue: hasNonBlankValue,
    hasSubstantiveEntries: hasSubstantiveEntries,
    version: '0.2.0'
  };
})();
