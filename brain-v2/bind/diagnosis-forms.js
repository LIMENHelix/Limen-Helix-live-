/**
 * brain-v2/bind/diagnosis-forms.js — the reviewed interpreter for declarative diagnoses.
 *
 * WHY THIS EXISTS. Every diagnosis in this system used to be a JavaScript function stored
 * beside its declaration. That made two things impossible at once: you could not enumerate
 * what the library actually tests without reading sixty-three function bodies, and nothing
 * stopped a future entry from expressing something no one had reviewed. A predicate is a
 * claim about when a domain is in trouble, and a claim that can say anything is not a
 * bounded claim.
 *
 * So the definitions became data and the evaluation lives here, once. A registry entry names
 * a FORM from the closed set below and supplies operands and thresholds. It cannot carry a
 * function, a closure, or an expression string, because this file never evaluates text — it
 * matches on a form name and runs the arithmetic that form was reviewed to run.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE TEN FORMS ARE MEASURED, NOT INVENTED
 *
 * They were derived by mechanically classifying all sixty-three predicates that existed
 * before this file (scripts/brain-audit/regen-finding-map.js regenerates that mapping on
 * demand). Sixty-three of sixty-three matched, with zero left over, which is the only
 * reason a closed grammar is honest here: the library was already this small, it just was
 * not written down.
 *
 * An eleventh form is a review of THIS file, not a data edit. That asymmetry is the entire
 * point of the boundary, and it is why `validate()` throws on an unknown form rather than
 * skipping the entry: an unevaluatable rule that reports nothing is indistinguishable from
 * a rule that found nothing.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 *
 * It does not read titles, headlines or any other text. It does not invent thresholds. It
 * does not create diagnoses. Every threshold it will resolve is one of the three values the
 * pre-existing library already used, and a fourth requires review — a diagnosis whose
 * trigger point drifts is a different diagnosis wearing the same id.
 */

'use strict';

/** Schema versions this interpreter implements. An entry declaring anything else throws. */
var SUPPORTED_SCHEMA_VERSIONS = [1];

/**
 * The named threshold constants. SIGMA is the same 2.0 the core detector uses and the
 * binders already declared; it is named rather than repeated so the library has one
 * definition of "a departure worth calling out".
 */
var THRESHOLD_NAMES = { SIGMA: 2.0 };

/**
 * Numeric thresholds that already existed in the pre-migration library, and therefore the
 * only bare numbers an entry may use. This is not a style rule. A registry that accepts any
 * number lets a diagnosis be retuned by editing data, which is exactly the change that most
 * needs a reviewer looking at it.
 */
var REVIEWED_LITERALS = [1.0, 2.5];

/**
 * Legal lifecycle states for a registry entry. `declared` means the entry exists and is
 * evaluated. There is deliberately no `active` state here: activation is a separate,
 * separately reviewed decision and this file must not be the place it can be granted.
 */
var LEGAL_STATUSES = ['declared'];

function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }

/** A departure reading, as core/brain.js hands it over: an object carrying a z score. */
function z(dep) { return (dep && isFiniteNumber(dep.z)) ? dep.z : null; }

/**
 * THE TEN FORMS.
 *
 * `arity`      how many operand channels the form reads. DOMAIN_DEPART reads none: it tests
 *              the FUSED state, and its `requires` is a liveness precondition rather than a
 *              list of operands. Conflating those two is the defect this field prevents.
 * `thresholds` exactly how many threshold values the form consumes. Wrong count throws.
 * `evaluate`   the arithmetic, written once, in the same order the original predicates used.
 *
 * Every evaluate() returns a strict boolean. The predicates this replaces returned the
 * operand object itself when a channel was missing (`d.a && ...` yields undefined), and
 * core/brain.js has only ever branched on truthiness, so normalising to false at the point
 * where the value is consumed changes no decision. The equivalence tests compare the old
 * result's truthiness against the new boolean rather than assuming this.
 */
var FORMS = {
  SINGLE_DEPART_ABS: {
    arity: 1, thresholds: 1,
    shape: '|z(a)| >= T',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]);
      return a !== null && Math.abs(a) >= th[0];
    }
  },
  SINGLE_DEPART_SIGNED: {
    arity: 1, thresholds: 1,
    shape: 'z(a) >= T',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]);
      return a !== null && a >= th[0];
    }
  },
  PAIR_CO_DEPART_ABS: {
    arity: 2, thresholds: 2,
    shape: '|z(a)| >= T1 && |z(b)| >= T2',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && Math.abs(a) >= th[0] && Math.abs(b) >= th[1];
    }
  },
  PAIR_CO_DEPART_ABS_SUM: {
    arity: 2, thresholds: 3,
    shape: '|z(a)| >= T1 && |z(b)| >= T2 && (|z(a)| + |z(b)|) >= T3',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && Math.abs(a) >= th[0] && Math.abs(b) >= th[1] &&
             (Math.abs(a) + Math.abs(b)) >= th[2];
    }
  },
  PAIR_CO_DEPART_SIGNED: {
    arity: 2, thresholds: 2,
    shape: 'z(a) >= T1 && z(b) >= T2',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && a >= th[0] && b >= th[1];
    }
  },
  PAIR_CO_DEPART_SIGNED_SUM: {
    arity: 2, thresholds: 3,
    shape: 'z(a) >= T1 && z(b) >= T2 && (z(a) + z(b)) >= T3',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && a >= th[0] && b >= th[1] && (a + b) >= th[2];
    }
  },
  /* Either channel clearing its own floor, PLUS a joint sum. The disjunction is why this is
     its own form: collapsing it into PAIR_CO_DEPART would require both channels to clear,
     which is a strictly narrower rule that fires less often. */
  PAIR_EITHER_PLUS_SUM: {
    arity: 2, thresholds: 3,
    shape: '(z(a) >= T1 || z(b) >= T2) && (z(a) + z(b)) >= T3',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && (a >= th[0] || b >= th[1]) && (a + b) >= th[2];
    }
  },
  /* NO per-channel floor. One channel far past the sum with the other slightly negative
     still fires, and that asymmetry is deliberate in the one entry that uses it. Mapping
     this onto a co-departure form would change when it fires. */
  PAIR_SUM_ONLY: {
    arity: 2, thresholds: 1,
    shape: '(z(a) + z(b)) >= T',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && (a + b) >= th[0];
    }
  },
  /* Two sensors on one latent pointing OPPOSITE ways by more than T. This is the only form
     whose subject is disagreement rather than magnitude. */
  PAIR_SIGN_DISAGREE: {
    arity: 2, thresholds: 1,
    shape: 'sign(z(a)) !== sign(z(b)) && |z(a) - z(b)| >= T',
    evaluate: function (op, th, s, d) {
      var a = z(d[op[0]]), b = z(d[op[1]]);
      return a !== null && b !== null && Math.sign(a) !== Math.sign(b) && Math.abs(a - b) >= th[0];
    }
  },
  /**
   * THE FUSED STATE, NOT A CHANNEL.
   *
   * This form reads `state.departure` and never touches an operand. Its entry still declares
   * `requires`, and that list is a LIVENESS PRECONDITION enforced upstream by core/brain.js:
   * the finding is not evaluated at all unless those channels reported this cycle. The
   * predicate itself is about the domain, not about them. Five entries use this form, and an
   * interpreter that quietly evaluated a channel here instead would turn a domain-level
   * statement into a single-sensor one without changing a single id.
   */
  DOMAIN_DEPART: {
    arity: 0, thresholds: 1,
    shape: '|state.departure| >= T',
    evaluate: function (op, th, s, d) {
      return !!s && isFiniteNumber(s.departure) && Math.abs(s.departure) >= th[0];
    }
  }
};

var FORM_NAMES = Object.keys(FORMS);

/**
 * Resolve one declared threshold to a number.
 *
 * Named constants resolve through THRESHOLD_NAMES; bare numbers must appear in
 * REVIEWED_LITERALS. Anything else throws rather than defaulting, because a threshold that
 * silently falls back to a default is a diagnosis whose trigger point nobody chose.
 */
function resolveThreshold(t, where) {
  if (typeof t === 'string') {
    if (!Object.prototype.hasOwnProperty.call(THRESHOLD_NAMES, t)) {
      throw new Error(where + ': unknown threshold constant "' + t + '". Known: ' +
        Object.keys(THRESHOLD_NAMES).join(', ') + '. A diagnosis may not invent its own trigger point.');
    }
    return THRESHOLD_NAMES[t];
  }
  if (isFiniteNumber(t)) {
    if (REVIEWED_LITERALS.indexOf(t) < 0) {
      throw new Error(where + ': threshold ' + t + ' is not one of the reviewed literals [' +
        REVIEWED_LITERALS.join(', ') + ']. Adding a threshold is a review, not a data edit.');
    }
    return t;
  }
  throw new Error(where + ': a threshold must be a named constant or a reviewed number, got ' + typeof t);
}

/**
 * Validate one registry entry against the domain that declares it.
 *
 * `declaredChannels` is the set of channel keys the domain actually declares. An operand or
 * a requirement naming anything outside it throws: a rule that can never fire is
 * indistinguishable from a rule that never found anything, which is the same reasoning the
 * binder factory already applies to relationships.
 */
function validate(domain, rec, declaredChannels) {
  var where = 'diagnosis ' + domain + '/' + (rec && rec.id ? rec.id : '(no id)');
  if (!rec || typeof rec !== 'object') throw new Error(where + ': entry must be an object');
  if (!rec.id) throw new Error(where + ': every diagnosis needs an id');

  if (typeof rec.test === 'function') {
    throw new Error(where + ': entries are DATA. A `test` function reintroduces the executable ' +
      'predicate this registry replaced, and would bypass every bound this file enforces.');
  }
  if (typeof rec.expression === 'string') {
    throw new Error(where + ': expression strings are not supported. This interpreter never evaluates text.');
  }

  if (SUPPORTED_SCHEMA_VERSIONS.indexOf(rec.schemaVersion) < 0) {
    throw new Error(where + ': schemaVersion ' + rec.schemaVersion + ' is not implemented by this interpreter. Supported: ' +
      SUPPORTED_SCHEMA_VERSIONS.join(', '));
  }
  if (!isFiniteNumber(rec.definitionVersion)) {
    throw new Error(where + ': definitionVersion is required and must be a number. Shape and meaning version ' +
      'independently: a re-defined diagnosis in an unchanged shape is the case one number cannot express.');
  }
  if (!rec.provenance || !rec.provenance.derivedFrom || !rec.provenance.commit) {
    throw new Error(where + ': provenance must name what this entry was derived from and at which commit');
  }
  if (LEGAL_STATUSES.indexOf(rec.status) < 0) {
    throw new Error(where + ': status "' + rec.status + '" is not legal. Legal: ' + LEGAL_STATUSES.join(', ') +
      '. Activation is a separate decision and cannot be granted here.');
  }
  if (!rec.basis) {
    throw new Error(where + ': a diagnosis must state its basis in words a reviewer can check');
  }

  var form = FORMS[rec.form];
  if (!form) {
    throw new Error(where + ': unknown form "' + rec.form + '". The grammar is closed; known forms are ' +
      FORM_NAMES.join(', ') + '. An eleventh form is a review of diagnosis-forms.js, not a data edit.');
  }

  var operands = rec.operands || [];
  if (!Array.isArray(operands) || operands.length !== form.arity) {
    throw new Error(where + ': form ' + rec.form + ' reads ' + form.arity + ' operand(s), entry declares ' +
      operands.length + '.');
  }
  operands.forEach(function (k) {
    if (!declaredChannels[k]) {
      throw new Error(where + ': operand "' + k + '" is not a channel this domain declares. It could never ' +
        'be read, and a rule that cannot be evaluated must not look like one that found nothing.');
    }
  });

  var requires = rec.requires || [];
  if (!Array.isArray(requires)) throw new Error(where + ': requires must be an array');
  requires.forEach(function (k) {
    if (!declaredChannels[k]) {
      throw new Error(where + ': requires "' + k + '", which this domain does not declare.');
    }
  });

  var th = rec.thresholds || [];
  if (!Array.isArray(th) || th.length !== form.thresholds) {
    throw new Error(where + ': form ' + rec.form + ' consumes ' + form.thresholds + ' threshold(s), entry declares ' +
      th.length + '. A missing threshold must never be defaulted.');
  }
  th.forEach(function (t) { resolveThreshold(t, where); });

  return true;
}

/**
 * Compile one validated entry into the evaluator core/brain.js calls.
 *
 * The closure is built HERE, by reviewed code, from data. That is the distinction the whole
 * design rests on: the definition never carries behaviour, and the behaviour never carries
 * anything the definition did not declare. Thresholds are resolved once at construction so a
 * bad one throws while the binder is being built rather than being swallowed by the
 * try/catch around evaluation, where it would silently read as "did not fire".
 */
function compile(domain, rec) {
  var form = FORMS[rec.form];
  var where = 'diagnosis ' + domain + '/' + rec.id;
  var operands = (rec.operands || []).slice();
  var thresholds = (rec.thresholds || []).map(function (t) { return resolveThreshold(t, where); });
  return function (vals, state, deps) {
    return form.evaluate(operands, thresholds, state, deps || {});
  };
}

module.exports = {
  FORMS: FORMS,
  FORM_NAMES: FORM_NAMES,
  THRESHOLD_NAMES: THRESHOLD_NAMES,
  REVIEWED_LITERALS: REVIEWED_LITERALS,
  LEGAL_STATUSES: LEGAL_STATUSES,
  SUPPORTED_SCHEMA_VERSIONS: SUPPORTED_SCHEMA_VERSIONS,
  resolveThreshold: resolveThreshold,
  validate: validate,
  compile: compile
};
