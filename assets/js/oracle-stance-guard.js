// ═══ ORACLE STANCE GUARD ═══
// Epistemic filter to prevent frame capture in contested situations.
// Detects high-risk interpersonal/legal/family narratives and injects
// a system-level guardrail into the messages array before API call.
//
// Front-end only — does not modify the Oracle API.

(function () {
  'use strict';

  // ── High-risk keyword patterns ──
  // Each pattern targets a category of contested situation
  var CONTESTED_PATTERNS = [
    // Custody / family disputes
    /\b(custody|visitation|co-?parent|my (ex|child'?s? (father|mother|dad|mom))|family court|guardian(ship)?|parenting plan|supervised visit)\b/i,
    // Abuse allegations (from either side)
    /\b(abus(e|ing|ive)|neglect(ing|ful)?|manipulat(e|ing|ive|ion)|gaslight(ing)?|narciss(ist|istic)?|control(ling)?|coercive|victim|perpetrator|predator)\b/i,
    // Workplace / institutional conflict
    /\b(HR\b|fired|termina(ted|tion)|hostile work|discriminat(ion|ing)|harass(ment|ing)|whistleblow|wrongful|retaliat(ion|ing|ed))\b/i,
    // Legal framing
    /\b(lawyer|attorney|judge|court order|restraining order|protective order|CPS|DCFS|investigation|allegation|false accus|defam)\b/i,
    // Relationship conflict with absent party
    /\b(my (husband|wife|partner|boyfriend|girlfriend|spouse).*(always|never|refuses|won't|doesn't))\b/i,
    /\b((he|she|they) (always|never|refuses?|won't|doesn't|lied|lies|cheated|manipulated))\b/i,
    // Child-centered disputes
    /\b(my (kid|child|son|daughter|baby).*(other parent|father|mother|dad|mom))\b/i,
    /\b(parental alienat|coached|brainwash|turned.*against)\b/i
  ];

  // ── Escalation phrases that intensify frame-capture risk ──
  var ESCALATION_MARKERS = [
    /\b(everyone (knows|says|agrees))\b/i,
    /\b(obviously|clearly|definitely).*(wrong|lying|abusi|toxic|crazy|insane)\b/i,
    /\b(what should I (do|say) (to|in) court)\b/i,
    /\b(how (do|can) I (prove|document|get evidence))\b/i,
    /\b(is (this|that) (abuse|neglect|illegal))\b/i
  ];

  // ── The guardrail instruction injected as a system message ──
  var STANCE_GUARDRAIL = [
    'EPISTEMIC STANCE PROTOCOL — ACTIVE FOR THIS MESSAGE.',
    '',
    'The user appears to be describing a contested interpersonal situation ',
    '(family conflict, custody, workplace dispute, or accusation involving an absent party). ',
    'Apply the following constraints:',
    '',
    '1. DO NOT automatically validate the narrator\'s implied moral, legal, or relational conclusion.',
    '2. DO NOT assume omitted context favors the narrator. DO NOT attack the absent party.',
    '3. DO NOT generate one-sided tactical, legal, or custody advice.',
    '4. DISTINGUISH direct observations from reported statements, interpretations, and conclusions.',
    '5. DEFAULT to mechanism-level analysis: what pattern is described, what system dynamic may operate, ',
    '   what information is uncertain, what would matter to know next.',
    '6. USE epistemic hedging: "Based on what you described...", "If that pattern is accurate...", ',
    '   "That could indicate...", "I can\'t verify intent from one side alone..."',
    '7. If frame-capture risk is high, ask ONE sharp clarifying question before going deeper.',
    '8. You may still discuss ASD, ADHD, regulation, overload, masking, stress patterns, family systems, ',
    '   and behavioral mechanisms — but without becoming partisan.',
    '9. PREFERRED response shape for contested cases:',
    '   - Sentence 1: Identify the pattern/mechanism described, without taking sides.',
    '   - Sentence 2: State the key uncertainty or frame limitation.',
    '   - Sentence 3: Explain what would matter to distinguish possibilities.',
    '   - Sentence 4 (optional): One careful systems-level implication.',
    '',
    'Remain sharp, perceptive, systems-level, and psychologically literate. ',
    'Do NOT become a disclaimer bot. Stay intelligent — but epistemically disciplined.'
  ].join('\n');

  // Lighter guardrail for warm/family tone without explicit conflict
  var GENTLE_GUARDRAIL = [
    'EPISTEMIC AWARENESS — LIGHT.',
    '',
    'The user is discussing a family or relational situation. ',
    'Stay observant for one-sided framing. If the conversation shifts toward ',
    'contested claims about an absent party, escalate to full epistemic stance protocol: ',
    'analyze mechanisms without taking sides, distinguish observations from interpretations, ',
    'and preserve uncertainty where appropriate. For now, proceed normally but stay alert.'
  ].join('\n');

  /**
   * Analyze user text for contested-situation signals.
   * Returns: { contested: bool, intensity: 'none'|'light'|'full', markers: string[] }
   */
  function analyzeStance(text) {
    var markers = [];
    var contested = false;

    for (var i = 0; i < CONTESTED_PATTERNS.length; i++) {
      var m = text.match(CONTESTED_PATTERNS[i]);
      if (m) {
        contested = true;
        markers.push(m[0]);
      }
    }

    if (!contested) {
      return { contested: false, intensity: 'none', markers: [] };
    }

    // Check for escalation
    var escalated = false;
    for (var j = 0; j < ESCALATION_MARKERS.length; j++) {
      if (ESCALATION_MARKERS[j].test(text)) {
        escalated = true;
        break;
      }
    }

    // Full guardrail if: multiple contested patterns, or escalation present, or long text
    var intensity = (markers.length >= 2 || escalated || text.length > 300) ? 'full' : 'light';

    return { contested: true, intensity: intensity, markers: markers };
  }

  /**
   * Process the messages array before sending to API.
   * If the latest user message triggers the stance guard,
   * prepend an appropriate system guardrail message.
   *
   * Returns a new array (does not mutate the original).
   */
  function guardMessages(messages) {
    if (!messages || messages.length === 0) return messages;

    // Find latest user message
    var lastUserMsg = '';
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i].content;
        break;
      }
    }

    if (!lastUserMsg) return messages;

    // Also check conversation history for cumulative contested signals
    var fullContext = '';
    var recentCount = Math.min(messages.length, 6);
    for (var k = messages.length - recentCount; k < messages.length; k++) {
      if (messages[k].role === 'user') {
        fullContext += ' ' + messages[k].content;
      }
    }

    var analysis = analyzeStance(lastUserMsg);
    var contextAnalysis = analyzeStance(fullContext);

    // Use whichever is stronger
    var effective = analysis;
    if (contextAnalysis.intensity === 'full' && analysis.intensity !== 'full') {
      effective = contextAnalysis;
    } else if (contextAnalysis.contested && !analysis.contested) {
      effective = contextAnalysis;
    }

    if (!effective.contested) return messages;

    // Build guarded messages array
    var guardrail = effective.intensity === 'full' ? STANCE_GUARDRAIL : GENTLE_GUARDRAIL;
    var guarded = [{ role: 'system', content: guardrail }];
    for (var m = 0; m < messages.length; m++) {
      guarded.push(messages[m]);
    }

    return guarded;
  }

  // ── Expose API ──
  window._oracleStanceGuard = {
    analyzeStance: analyzeStance,
    guardMessages: guardMessages
  };

})();
