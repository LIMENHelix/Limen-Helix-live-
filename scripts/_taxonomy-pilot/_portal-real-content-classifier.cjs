/**
 * _portal-real-content-classifier.cjs — CANONICAL real-content classifier for portal cortex.
 * The executable form of the Energy Template Lock rule:
 *   "A domain may not claim cortex depth unless its portal layer passes the real-content classifier.
 *    Company names alone do not make a portal real. Template/mad-lib treatments are quarantined."
 *
 * REUSABLE ACROSS DOMAINS. Finance (and every later domain) imports THIS — it does not re-copy the
 * verb list. The runtime energy-brain.js carries an inline mirror of MADLIB_VERBS (browser IIFE can't
 * require()); the template-lock probe asserts the two never drift.
 *
 * J1 history: the original list missed 6 verbs (Calibrate/Evaluate/Streamline/Institutionalize/
 * Configure/Monitor). Once added, 100% of Energy L1 treatments classified as template. The lesson is
 * encoded here: this list is authoritative for "is this treatment real", and an incomplete list = a
 * false sense of real data. Extend it here (and mirror in energy-brain.js) if new mad-lib verbs appear.
 */
'use strict';

const MADLIB_VERBS = [
  'Develop', 'Establish', 'Implement', 'Build', 'Launch', 'Design', 'Deploy', 'Operationalize',
  'Conduct', 'Create', 'Define', 'Assess', 'Optimize', 'Modernize', 'Strengthen', 'Enhance',
  'Formalize', 'Institute', 'Standardize', 'Coordinate', 'Integrate',
  'Calibrate', 'Evaluate', 'Streamline', 'Institutionalize', 'Configure', 'Monitor'  // J1 additions
];
const MADLIB_VERB = new RegExp('^(' + MADLIB_VERBS.join('|') + ')\\b');

/** A treatment label is template/mad-lib if it starts with a generic management verb.
 *  Real (L0) treatments are noun phrases ("Diversified Generation Portfolio"). */
function isTemplate(label) { return !label || MADLIB_VERB.test(String(label)); }

/** Classify a parsed portal file: REAL | MIXED | SYNTHETIC | EMPTY + the evidence used. */
function classifyPortalFile(json) {
  if (!json || typeof json !== 'object') return { cls: 'EMPTY', companies: 0, treatments: 0, templateTreatments: 0, tmplRatio: 1, realTreatments: 0 };
  var acts = json.activations || [];
  var companies = 0, labels = [];
  acts.forEach(function (a) {
    if (a.companies && a.companies.length) companies += a.companies.length;
    (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) labels.push(l); });
  });
  var tmpl = labels.filter(isTemplate).length;
  var tmplRatio = labels.length ? tmpl / labels.length : 1;
  var cls;
  if (acts.length === 0 && labels.length === 0) cls = 'EMPTY';
  else if (companies > 0 && tmplRatio < 0.4) cls = 'REAL';
  else if (companies > 0) cls = 'MIXED';            // real companies, BUT template treatments
  else if (tmplRatio >= 0.6) cls = 'SYNTHETIC';
  else cls = 'EMPTY';
  return { cls: cls, companies: companies, treatments: labels.length, templateTreatments: tmpl, tmplRatio: Math.round(tmplRatio * 1000) / 1000, realTreatments: labels.length - tmpl };
}

/** THE RULE: portal content qualifies as real cortex DEPTH only when REAL (low template ratio).
 *  MIXED (company names + template treatments) does NOT qualify — names alone never make it real. */
function qualifiesAsRealDepth(classifyResult) {
  return !!classifyResult && classifyResult.cls === 'REAL' && classifyResult.tmplRatio < 0.4 && classifyResult.realTreatments > 0;
}

module.exports = { MADLIB_VERBS: MADLIB_VERBS, MADLIB_VERB: MADLIB_VERB, isTemplate: isTemplate, classifyPortalFile: classifyPortalFile, qualifiesAsRealDepth: qualifiesAsRealDepth };
