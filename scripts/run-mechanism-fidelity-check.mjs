#!/usr/bin/env node
/**
 * run-mechanism-fidelity-check.mjs
 *
 * Task #35 — the structural gate that decides whether a port is a
 * coherent transfer or a primitive substitution.
 *
 * Reads two inputs:
 *   1. assets/data/audit/mechanism-ontology.json
 *      — controlled vocabulary of action + effect classes
 *   2. assets/data/audit/port-mechanism-statements.json
 *      — hand-authored source-leg + port-leg primitives per port
 *
 * For each port:
 *   - If source.primitive is null  → no-source-mechanism
 *   - Else compare source.actionClass ↔ port.actionClass
 *     AND  source.effectClass ↔ port.effectClass
 *   - Both classes are members of the ontology → check identity
 *   - Either class is not in the ontology     → ambiguous (held for review)
 *   - Both classes match identity             → mechanism-coherent
 *   - Either class differs                    → primitive-substituted
 *     (rationale names which dimension differed)
 *
 * Then compares each verdict against the operator's pre-recorded
 * prediction in the port-mechanism-statements file. Any mismatch is the
 * comparator failing on a case the operator graded by hand — the same
 * spot-check discipline applied to the PubMed gate, now applied to the
 * fidelity gate.
 *
 * Output: assets/data/audit/mechanism-fidelity-report.json
 *
 * Usage: node scripts/run-mechanism-fidelity-check.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ONTOLOGY_FILE = path.join(ROOT, 'assets/data/audit/mechanism-ontology.json');
const STATEMENTS_FILE = path.join(ROOT, 'assets/data/audit/port-mechanism-statements.json');
const OUTPUT_FILE = path.join(ROOT, 'assets/data/audit/mechanism-fidelity-report.json');

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const ontology = JSON.parse(fs.readFileSync(ONTOLOGY_FILE, 'utf-8'));
  const statements = JSON.parse(fs.readFileSync(STATEMENTS_FILE, 'utf-8'));

  const validActionClasses = new Set(Object.keys(ontology.actionClasses));
  const validEffectClasses = new Set(Object.keys(ontology.effectClasses));

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    ontologySource: ONTOLOGY_FILE.replace(ROOT + path.sep, '').replace(/\\/g, '/'),
    statementsSource: STATEMENTS_FILE.replace(ROOT + path.sep, '').replace(/\\/g, '/'),
    summary: {
      portsChecked: 0,
      verdictDistribution: {
        'mechanism-coherent': 0,
        'primitive-substituted': 0,
        'no-source-mechanism': 0,
        ambiguous: 0,
      },
      predictionMatch: 0,
      predictionMismatch: 0,
      marginCases: 0,
    },
    verdicts: [],
  };

  for (const port of statements.ports) {
    const verdict = computeVerdict(port, validActionClasses, validEffectClasses, ontology);
    const operatorPrediction = parseOperatorPrediction(port.operatorPrediction);

    const result = {
      id: port.id,
      sourceTreatment: port.sourceTreatment,
      isControl: !!port.is_control,
      isMarginCase: !!port.is_margin_case,
      sourcePrimitive: port.sourceMechanism?.primitive || null,
      portPrimitive: port.portMechanism?.primitive || null,
      verdict: verdict.verdict,
      rationale: verdict.rationale,
      operatorPredicted: operatorPrediction.canonical,
      operatorPredictionRaw: port.operatorPrediction,
      matchesPrediction: matchesPrediction(verdict.verdict, operatorPrediction),
    };

    report.verdicts.push(result);
    report.summary.portsChecked++;
    report.summary.verdictDistribution[verdict.verdict]++;
    if (result.matchesPrediction) report.summary.predictionMatch++;
    else report.summary.predictionMismatch++;
    if (port.is_margin_case) report.summary.marginCases++;
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));

  // CLI rendering
  printReport(report);
}

// ============================================================================
// COMPARATOR
// ============================================================================

function computeVerdict(port, validActionClasses, validEffectClasses, ontology) {
  const src = port.sourceMechanism?.primitive;
  const prt = port.portMechanism?.primitive;

  if (!src) {
    return {
      verdict: 'no-source-mechanism',
      rationale:
        'Source has no extractable primitive (sourceMechanism.primitive is null). The port may be a valid standalone proposal, but it cannot claim mechanistic transfer FROM the named source because no source mechanism is characterized.',
    };
  }
  if (!prt) {
    return {
      verdict: 'ambiguous',
      rationale: 'Port primitive is missing — required for fidelity comparison.',
    };
  }

  const srcA = src.actionClass;
  const srcE = src.effectClass;
  const prtA = prt.actionClass;
  const prtE = prt.effectClass;

  // Ontology validity check — both sides' classes must be in the controlled
  // vocabulary. Anything outside is ambiguous, not coherent.
  const inOntology = (a, e) =>
    validActionClasses.has(a) && validEffectClasses.has(e);

  if (!inOntology(srcA, srcE)) {
    return {
      verdict: 'ambiguous',
      rationale: `Source primitive has out-of-ontology class(es): actionClass="${srcA}" (${
        validActionClasses.has(srcA) ? 'OK' : 'NOT IN ONTOLOGY'
      }), effectClass="${srcE}" (${validEffectClasses.has(srcE) ? 'OK' : 'NOT IN ONTOLOGY'}). Held for human review.`,
    };
  }
  if (!inOntology(prtA, prtE)) {
    return {
      verdict: 'ambiguous',
      rationale: `Port primitive has out-of-ontology class(es): actionClass="${prtA}" (${
        validActionClasses.has(prtA) ? 'OK' : 'NOT IN ONTOLOGY'
      }), effectClass="${prtE}" (${validEffectClasses.has(prtE) ? 'OK' : 'NOT IN ONTOLOGY'}). Held for human review.`,
    };
  }

  // Required-fields check — classes that carry requiredFields force the
  // author to commit to the qualifying assertion in a structured slot.
  // Without the field populated, class assignment is rejected as ambiguous
  // regardless of class-identity match. This is the class-level catch the
  // operator's conditional-assertion-pattern fix targets — windows that are
  // merely scheduled, restorations with no characterized mechanism, and
  // interference with no named target all return ambiguous here.
  const fieldErrors = [
    ...checkRequiredFields(src, 'source', ontology),
    ...checkRequiredFields(prt, 'port', ontology),
  ];
  if (fieldErrors.length > 0) {
    return {
      verdict: 'ambiguous',
      rationale: `Class assignment missing required authoring assertion(s): ${fieldErrors.join('; ')}. The class definition specifies these fields as qualifying assertions — without them, the assignment is decorative.`,
    };
  }

  // Structural comparison.
  const actionMatch = srcA === prtA;
  const effectMatch = srcE === prtE;

  if (actionMatch && effectMatch) {
    return {
      verdict: 'mechanism-coherent',
      rationale: `Source primitive (action="${srcA}", effect="${srcE}") and port primitive (action="${prtA}", effect="${prtE}") share both structural dimensions. Transfer preserves the mechanism.`,
    };
  }

  const differing = [];
  if (!actionMatch) differing.push(`actionClass differs: source="${srcA}" vs port="${prtA}"`);
  if (!effectMatch) differing.push(`effectClass differs: source="${srcE}" vs port="${prtE}"`);

  return {
    verdict: 'primitive-substituted',
    rationale: `Port substitutes one or both primitive dimensions of the source. ${differing.join('; ')}. The port may produce a desired outcome via a different mechanism, but it is not a transfer.`,
  };
}

/**
 * For each class assignment on the primitive, look up the class's
 * requiredFields in the ontology and confirm each required field is
 * present and non-empty. Returns a list of error strings; empty list
 * means all required fields are populated.
 */
function checkRequiredFields(primitive, leg, ontology) {
  const errors = [];
  const aClassDef = ontology.actionClasses[primitive.actionClass] || {};
  const eClassDef = ontology.effectClasses[primitive.effectClass] || {};
  for (const field of aClassDef.requiredFields || []) {
    if (
      !primitive[field] ||
      typeof primitive[field] !== 'string' ||
      primitive[field].trim().length === 0
    ) {
      errors.push(
        `${leg}.primitive missing or empty "${field}" required by actionClass="${primitive.actionClass}"`
      );
    }
  }
  for (const field of eClassDef.requiredFields || []) {
    if (
      !primitive[field] ||
      typeof primitive[field] !== 'string' ||
      primitive[field].trim().length === 0
    ) {
      errors.push(
        `${leg}.primitive missing or empty "${field}" required by effectClass="${primitive.effectClass}"`
      );
    }
  }
  return errors;
}

// ============================================================================
// OPERATOR PREDICTION PARSING
// ============================================================================

function parseOperatorPrediction(predictionString) {
  const s = String(predictionString || '').toLowerCase();
  const validVerdicts = [
    'mechanism-coherent',
    'primitive-substituted',
    'no-source-mechanism',
    'ambiguous',
  ];
  const present = validVerdicts.filter((v) => s.includes(v));
  return {
    canonical: present,
    raw: predictionString,
  };
}

function matchesPrediction(verdict, parsed) {
  return parsed.canonical.includes(verdict);
}

// ============================================================================
// CLI RENDER
// ============================================================================

function printReport(report) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  MECHANISM-FIDELITY CHECK — BLA × hyperactive × economy calibration set');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');
  for (const v of report.verdicts) {
    const flag = v.matchesPrediction ? '✓' : '✗';
    const tag = v.isControl ? ' [CONTROL]' : v.isMarginCase ? ' [MARGIN]' : '';
    console.log(`${flag} ${v.id}${tag}`);
    console.log(`    source: ${v.sourceTreatment}`);
    if (v.sourcePrimitive) {
      console.log(`    source primitive: action="${v.sourcePrimitive.actionClass}", effect="${v.sourcePrimitive.effectClass}"`);
    } else {
      console.log(`    source primitive: null`);
    }
    if (v.portPrimitive) {
      console.log(`    port   primitive: action="${v.portPrimitive.actionClass}", effect="${v.portPrimitive.effectClass}"`);
    }
    console.log(`    VERDICT:    ${v.verdict.toUpperCase()}`);
    console.log(`    predicted:  ${v.operatorPredictionRaw}`);
    console.log(`    rationale:  ${v.rationale}`);
    console.log('');
  }
  console.log('───────────────────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────────────────');
  console.log(`  ports checked:              ${report.summary.portsChecked}`);
  console.log(`  verdict distribution:`);
  for (const [v, n] of Object.entries(report.summary.verdictDistribution)) {
    if (n > 0) console.log(`     ${v.padEnd(26)} ${n}`);
  }
  console.log(`  prediction match:           ${report.summary.predictionMatch} / ${report.summary.portsChecked}`);
  console.log(`  prediction mismatch:        ${report.summary.predictionMismatch}`);
  console.log(`  margin cases (either-OK):   ${report.summary.marginCases}`);
  console.log('');
  console.log(`  report: ${OUTPUT_FILE.replace(ROOT + path.sep, '').replace(/\\/g, '/')}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
}

main();
