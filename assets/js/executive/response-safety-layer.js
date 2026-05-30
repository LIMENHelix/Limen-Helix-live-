/**
 * response-safety-layer.js — Global Response Safety Enforcement
 *
 * Intercepts ALL user-facing generated text before render.
 * Detects and rewrites prohibited output patterns:
 *   - accusations / intent attribution
 *   - psychological inference / profiling
 *   - side-taking in disputes
 *   - threat escalation from ambiguity
 *   - personalized vulnerability claims
 *
 * This layer sits between model output and user-facing response.
 * It MUST wrap all dynamic text surfaces.
 *
 * Exposes: window.LIMENResponseSafety
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // PROHIBITED PATTERN REGISTRY
  // ══════════════════════════════════════════════════════════════════════

  // Each pattern: { regex, category, replacement (optional) }
  // Categories: ACCUSATION, PSYCH_INFERENCE, SIDE_TAKING, THREAT_ESCALATION, VULNERABILITY_CLAIM

  var PROHIBITED_PATTERNS = [
    // ── ACCUSATION / INTENT ATTRIBUTION ──
    { re: /\b(could be used against|weaponiz|exploit(?:ing|ed|ation)|manipulat(?:ing|ed|ive)|abusi(?:ng|ve)|endanger(?:ing|ed)|negligent|complicit)\b/gi, cat: 'ACCUSATION' },
    { re: /\b(unsafe environment|hostile environment|toxic (?:parent|home|relationship)|harmful (?:parent|behavior|influence))\b/gi, cat: 'ACCUSATION' },
    { re: /\b(you (?:are|may be|could be|might be) (?:harm|hurt|damag|endanger|abus|neglect|exploit))/gi, cat: 'ACCUSATION' },
    { re: /\b(this (?:creates|poses|represents|indicates) (?:a |)(?:risk|danger|threat) (?:of|to) (?:harm|abuse|exploitation|neglect))/gi, cat: 'ACCUSATION' },
    { re: /\b((?:her|his|their|the) (?:safety|wellbeing|welfare) (?:is|may be|could be) (?:at risk|compromised|threatened|in danger|in jeopardy))\b/gi, cat: 'ACCUSATION' },

    // ── PSYCHOLOGICAL INFERENCE / PROFILING ──
    { re: /\b(your (?:nervous system|amygdala|cortisol|attachment style|trauma response|fight.or.flight|stress response) (?:is|are|was))\b/gi, cat: 'PSYCH_INFERENCE' },
    { re: /\b(you (?:are|feel|seem) (?:in |)(?:protective mode|hypervigilant|triggered|dysregulated|activated|dissociat))/gi, cat: 'PSYCH_INFERENCE' },
    { re: /\b(you feel (?:unsafe|threatened|attacked|victimized|trapped|powerless) because)\b/gi, cat: 'PSYCH_INFERENCE' },
    { re: /\b(this is triggering (?:your|a)|your (?:body|mind|system) is (?:telling|signaling|warning))\b/gi, cat: 'PSYCH_INFERENCE' },
    { re: /\b((?:narcissist|borderline|antisocial|psychopath|sociopath)(?:ic|ism)?)\b/gi, cat: 'PSYCH_INFERENCE' },

    // ── SIDE-TAKING IN DISPUTES ──
    { re: /\b((?:she|he|they|the (?:mother|father|parent|partner|spouse|ex)) (?:is|are|was|were) (?:clearly|obviously|definitely|certainly) (?:wrong|at fault|responsible|guilty|lying|manipulat|abus))/gi, cat: 'SIDE_TAKING' },
    { re: /\b(you (?:are|were) (?:right|correct|justified) (?:to|in|about|when))\b/gi, cat: 'SIDE_TAKING' },
    { re: /\b((?:she|he|they) (?:should(?:n't| not)|must(?:n't| not)|need(?:s|) to) (?:stop|cease|be (?:stopped|prevented|reported)))\b/gi, cat: 'SIDE_TAKING' },

    // ── THREAT ESCALATION FROM AMBIGUITY ──
    { re: /\b(this (?:could|may|might) (?:lead to|result in|cause|escalate (?:to|into)) (?:harm|danger|abuse|violence|removal|loss of custody))\b/gi, cat: 'THREAT_ESCALATION' },
    { re: /\b((?:call|contact|report to|notify) (?:CPS|child protective|police|authorities|law enforcement) (?:immediately|now|right away|as soon as))\b/gi, cat: 'THREAT_ESCALATION' },
    { re: /\b((?:red flag|warning sign|danger sign|alarm(?:ing|)) (?:for|of|that|indicating) (?:abuse|neglect|harm|danger))\b/gi, cat: 'THREAT_ESCALATION' },

    // ── PERSONALIZED VULNERABILITY CLAIMS ──
    { re: /\b((?:your|the) (?:child|daughter|son|kid)(?:'s|s)? (?:autism|neurodivergence|disability|condition|diagnosis) (?:makes|puts|leaves|renders) (?:them|her|him) (?:more |particularly |especially |)(?:vulnerable|at risk|susceptible|exposed))\b/gi, cat: 'VULNERABILITY_CLAIM' },
    { re: /\b(children (?:like|with|who have) (?:autism|ADHD|special needs) are (?:more |particularly |especially |)(?:vulnerable|at risk|susceptible) to)\b/gi, cat: 'VULNERABILITY_CLAIM' }
  ];

  // ══════════════════════════════════════════════════════════════════════
  // SAFE RESPONSE TEMPLATE
  // ══════════════════════════════════════════════════════════════════════

  var SAFE_TEMPLATE = "I don't have evidence of harm or misuse based on what's been described. If you have specific concerns about how the system is being used or affecting outcomes, you can share more detail and I can help clarify how it works and what it does.";

  // ══════════════════════════════════════════════════════════════════════
  // INTERCEPT LOG
  // ══════════════════════════════════════════════════════════════════════

  var _interceptionLog = []; // { timestamp, category, originalFragment, rewrittenTo, surface }
  var MAX_LOG = 200;

  function _logIntercept(category, original, rewritten, surface) {
    _interceptionLog.push({
      timestamp: Date.now(),
      category: category,
      originalFragment: original.substring(0, 200),
      rewrittenTo: rewritten.substring(0, 200),
      surface: surface || 'unknown'
    });
    if (_interceptionLog.length > MAX_LOG) _interceptionLog.shift();
    console.warn('[ResponseSafety] INTERCEPTED (' + category + ') on surface: ' + (surface || 'unknown'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // CORE SCAN + REWRITE
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Scan text for prohibited patterns.
   * Returns { safe: boolean, violations: [{category, match}] }
   */
  function scan(text) {
    if (!text || typeof text !== 'string') return { safe: true, violations: [] };

    var violations = [];
    for (var i = 0; i < PROHIBITED_PATTERNS.length; i++) {
      var p = PROHIBITED_PATTERNS[i];
      var match = text.match(p.re);
      if (match) {
        violations.push({ category: p.cat, match: match[0] });
      }
    }
    return { safe: violations.length === 0, violations: violations };
  }

  /**
   * Sanitize text: remove prohibited patterns, replace with neutral language.
   * For partial matches, redacts the offending phrase.
   * For full-text violations (e.g., entire oracle response), replaces entirely.
   */
  function sanitize(text, surface) {
    if (!text || typeof text !== 'string') return text;

    var result = scan(text);
    if (result.safe) return text;

    var sanitized = text;
    var totalViolations = result.violations.length;

    // If more than 3 violations or violations span > 30% of text, replace entirely
    if (totalViolations > 3) {
      _logIntercept('MULTIPLE_' + result.violations[0].category, text, SAFE_TEMPLATE, surface);
      return SAFE_TEMPLATE;
    }

    // Otherwise, redact individual violations
    for (var i = 0; i < PROHIBITED_PATTERNS.length; i++) {
      var p = PROHIBITED_PATTERNS[i];
      if (p.re.test(sanitized)) {
        var original = sanitized;
        sanitized = sanitized.replace(p.re, '[system observation redacted]');
        if (sanitized !== original) {
          _logIntercept(p.cat, original, sanitized, surface);
        }
        // Reset regex lastIndex for global patterns
        p.re.lastIndex = 0;
      }
    }

    return sanitized;
  }

  /**
   * Full response intercept — for oracle/chat responses.
   * More aggressive: replaces entire response if any violation found.
   */
  function interceptResponse(text, surface) {
    if (!text || typeof text !== 'string') return text;

    var result = scan(text);
    if (result.safe) return text;

    // Any violation in a direct response = full replacement
    _logIntercept(result.violations[0].category, text, SAFE_TEMPLATE, surface || 'response');
    return SAFE_TEMPLATE;
  }

  // ══════════════════════════════════════════════════════════════════════
  // SENSITIVE CONTEXT DETECTION
  // ══════════════════════════════════════════════════════════════════════

  // Detects family/custody/legal/child contexts from conversation history
  var SENSITIVE_CONTEXT_PATTERNS = [
    /\b(mother|father|mom|dad|parent|co.?parent|ex.?wife|ex.?husband|ex.?partner|step.?parent)\b/i,
    /\b(daughter|son|child|kid|toddler|infant|baby|my (?:girl|boy|little))\b/i,
    /\b(custody|visitation|parenting (?:time|plan|agreement)|GAL|guardian ad litem|family court|divorce|separation)\b/i,
    /\b(autis(?:m|tic)|neurodivergent|ADHD|special needs|sensory (?:processing|issues)|developmental)\b/i,
    /\b(abuse|neglect|harm(?:ing|ful|ed)|unsafe|concern(?:s|ed) about (?:her|his|their|the) (?:parent|father|mother|behavior))\b/i,
    /\b(attorney|lawyer|legal (?:action|proceeding|case)|court (?:order|hearing|date)|judge|mediator)\b/i,
    /\b(CPS|child protective|DCFS|social worker|investigation|report(?:ing|ed) (?:to|for))\b/i
  ];

  // Soft-paraphrase patterns that bypass exact keyword blocks
  var SAFE_MODE_VIOLATIONS = [
    // Emotional validation / instinct mirroring
    { re: /\b(protective instinct|gut (?:feeling|telling|says|instinct)|trust your (?:gut|instinct|feeling|intuition))\b/gi, cat: 'INSTINCT_MIRROR' },
    { re: /\b(picking up (?:on |)something (?:real|valid|important)|you'?re (?:sensing|detecting|noticing) something)\b/gi, cat: 'INSTINCT_MIRROR' },
    { re: /\b(your (?:concern|worry|fear|instinct|feeling|sense|read) (?:is|seems|sounds|appears) (?:valid|justified|warranted|understandable|reasonable|legitimate))\b/gi, cat: 'SUSPICION_VALIDATION' },
    { re: /\b(that(?:'s| is) (?:harmful|dangerous|concerning|alarming|troubling|disturbing|worrisome|problematic))\b/gi, cat: 'HARM_FRAMING' },

    // Psych framing through paraphrase
    { re: /\b(adaptive response|shutdown signal|survival (?:mode|response|mechanism)|coping (?:mechanism|strategy|response))\b/gi, cat: 'PSYCH_PARAPHRASE' },
    { re: /\b((?:emotional|nervous|stress) (?:regulation|dysregulation|response)|fight.or.flight|freeze response|fawn response)\b/gi, cat: 'PSYCH_PARAPHRASE' },
    { re: /\b((?:re)?traumatiz|(?:complex |c-?)PTSD|attachment (?:wound|injury|rupture|disruption))\b/gi, cat: 'PSYCH_PARAPHRASE' },

    // Suspicion reinforcement
    { re: /\b(misread (?:normal|typical|healthy|natural) (?:variation|behavior|development|responses?) as (?:crisis|problem|disorder|pathology))\b/gi, cat: 'SUSPICION_FRAME' },
    { re: /\b(pathologiz(?:e|ing|ed|ation)|over.?diagnos(?:e|ing|ed)|medical(?:iz|is)(?:e|ing|ed))\b/gi, cat: 'SUSPICION_FRAME' },
    { re: /\b(used? (?:it |this |the (?:system|tool|data|report|output) )?(?:against|to (?:control|manipulate|coerce|pressure|undermine|discredit)))\b/gi, cat: 'SUSPICION_FRAME' },

    // Leading emotional questions
    { re: /\b(what(?:'s| is| does) your (?:gut|instinct|heart|feeling|sense|body) (?:tell|say|signal|indicate))\b/gi, cat: 'LEADING_QUESTION' },
    { re: /\b(do you feel (?:safe|unsafe|threatened|scared|afraid|worried|concerned about (?:your|her|his)))\b/gi, cat: 'LEADING_QUESTION' },
    { re: /\b((?:are you|do you) (?:afraid|scared|worried|concerned|frightened) (?:that|about|of|for))\b/gi, cat: 'LEADING_QUESTION' },
    { re: /\b(what (?:are you|would you) (?:most )?(?:afraid|scared|worried|concerned|frightened) (?:of|about))\b/gi, cat: 'LEADING_QUESTION' },
    { re: /\b(how does (?:that|this|it) make you (?:feel|think about))\b/gi, cat: 'LEADING_QUESTION' }
  ];

  var SAFE_MODE_RESPONSE = "I can explain what the system does, but I can't determine harm or misuse from this description alone. LIMEN maps inputs into pattern summaries and recommendations; it does not determine intent or make independent judgments about a child or parent. If you have a specific concern, the useful questions are: what data was entered, who can access the output, and how the output is being used.\n\nWhat specific output or use of the system are you concerned about?";

  /**
   * Detect whether conversation contains sensitive family/custody/child context.
   * Checks both the current text and recent conversation history.
   */
  function detectSensitiveContext(text, conversationHistory) {
    var textToCheck = text || '';
    // Also check recent conversation messages if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      var recent = conversationHistory.slice(-10);
      for (var i = 0; i < recent.length; i++) {
        textToCheck += ' ' + (recent[i].content || '');
      }
    }

    for (var p = 0; p < SENSITIVE_CONTEXT_PATTERNS.length; p++) {
      if (SENSITIVE_CONTEXT_PATTERNS[p].test(textToCheck)) {
        SENSITIVE_CONTEXT_PATTERNS[p].lastIndex = 0;
        return true;
      }
    }
    return false;
  }

  /**
   * Check response for safe-mode violations (paraphrased unsafe content).
   * Returns { safe: boolean, violations: [] }
   */
  function scanSafeMode(text) {
    if (!text || typeof text !== 'string') return { safe: true, violations: [] };

    var violations = [];
    for (var i = 0; i < SAFE_MODE_VIOLATIONS.length; i++) {
      var p = SAFE_MODE_VIOLATIONS[i];
      var match = text.match(p.re);
      if (match) {
        violations.push({ category: p.cat, match: match[0] });
      }
      p.re.lastIndex = 0;
    }
    return { safe: violations.length === 0, violations: violations };
  }

  /**
   * Enforce safe mode on a response when sensitive context is detected.
   * If the response contains ANY safe-mode violation OR any prohibited pattern,
   * the ENTIRE response is replaced with the safe mode response.
   */
  function enforceSafeMode(responseText, surface, conversationHistory) {
    if (!responseText || typeof responseText !== 'string') return responseText;

    // Check if sensitive context exists
    var isSensitive = detectSensitiveContext(responseText, conversationHistory);
    if (!isSensitive) {
      // Not sensitive context — fall through to normal scan only
      return null; // null = not handled, caller should use normal path
    }

    // Sensitive context detected — check for ANY violation (original + paraphrase)
    var origScan = scan(responseText);
    var safeScan = scanSafeMode(responseText);

    if (!origScan.safe || !safeScan.safe) {
      var violationType = !origScan.safe ? origScan.violations[0].category : safeScan.violations[0].category;
      _logIntercept('SAFE_MODE_' + violationType, responseText, SAFE_MODE_RESPONSE, surface || 'safe_mode');
      return SAFE_MODE_RESPONSE;
    }

    // Sensitive context but no violations detected — allow through
    return responseText;
  }

  // ══════════════════════════════════════════════════════════════════════
  // ENHANCED INTERCEPT (replaces simple interceptResponse for oracle)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Full response intercept with safe mode enforcement.
   * For oracle/chat: checks sensitive context first, then patterns.
   */
  function interceptResponseSafe(text, surface, conversationHistory) {
    if (!text || typeof text !== 'string') return text;

    // Try safe mode first (sensitive context + violation = full replace)
    var safeModeResult = enforceSafeMode(text, surface, conversationHistory);
    if (safeModeResult !== null && safeModeResult !== text) {
      return safeModeResult; // Was replaced by safe mode
    }

    // Fall through to normal prohibited pattern scan
    var result = scan(text);
    if (!result.safe) {
      _logIntercept(result.violations[0].category, text, SAFE_TEMPLATE, surface || 'response');
      return SAFE_TEMPLATE;
    }

    // Also check safe-mode paraphrase patterns even outside sensitive context
    var smResult = scanSafeMode(text);
    if (!smResult.safe) {
      _logIntercept('PARAPHRASE_' + smResult.violations[0].category, text, SAFE_TEMPLATE, surface || 'response');
      return SAFE_TEMPLATE;
    }

    return text;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENResponseSafety = {
    scan: scan,
    scanSafeMode: scanSafeMode,
    sanitize: sanitize,
    interceptResponse: interceptResponseSafe,
    detectSensitiveContext: detectSensitiveContext,
    enforceSafeMode: enforceSafeMode,
    getLog: function () { return _interceptionLog.slice(); },
    getSafeTemplate: function () { return SAFE_TEMPLATE; },
    getSafeModeResponse: function () { return SAFE_MODE_RESPONSE; }
  };

})();
