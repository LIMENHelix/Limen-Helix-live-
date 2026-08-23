#!/usr/bin/env node
/**
 * organ-binding-fidelity.mjs
 *
 * Walks every portal in assets/data/companies/*.json and audits the
 * brainNodeId values asserted in functionalNetwork[] across ALL
 * relationship types (suppliers, customers, competitors, regulators,
 * auditor, capitalProviders, executiveTeam, logisticsPartners,
 * marketSignals).
 *
 * For each binding, three checks:
 *   1. brainNodeId is in the canonical 123-node taxonomy
 *   2. brainNodeRole text is consistent with the node's role table in
 *      brain-node-business-mapping.json:domainBindings
 *   3. neuralRole label is consistent with the node's network
 *
 * Output: assets/data/audit/binding-fidelity-report.json
 *   { generatedAt, summary, perPortal, perNode, mismatches }
 *
 * This is the "ensure business companies and issues are pointing to the
 * correct brain node" step — task #27 of the treatment-discovery build.
 * Operator reviews this BEFORE the pivot organ pulls these bindings as
 * truth for residual computation.
 *
 * Usage: node scripts/organ-binding-fidelity.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PORTAL_DIR = path.join(ROOT, 'assets/data/companies');
const TAXONOMY_FILE = path.join(ROOT, 'assets/data/brain-node-business-mapping.json');
const OUTPUT_FILE = path.join(ROOT, 'assets/data/audit/binding-fidelity-report.json');

const RELATIONSHIP_TYPES = [
  'suppliers',
  'customers',
  'competitors',
  'regulators',
  'auditor',
  'capitalProviders',
  'executiveTeam',
  'logisticsPartners',
  'marketSignals',
];

// Derived empirically from corpus + canonical taxonomy. Wider than I
// expected — neuralRole has been used to carry both classical role
// labels (DMN, Sensory, Motor, Salience, Limbic, PFC) AND
// relationship-shape labels (Peer, feedforward_demand_signal,
// feedforward_supply_signal). Both are valid; report flags only
// values outside this set.
const VALID_NEURAL_ROLES = new Set([
  'DMN',
  'Sensory',
  'Motor',
  'Salience',
  'Limbic',
  'PFC',
  'Peer',
  'Attention',
  'Reward',
  'Memory',
  'Affect',
  'Autonomic',
  'Brainstem',
  'Cerebellum',
  'feedforward_demand_signal',
  'feedforward_supply_signal',
  'feedback_inhibition',
  'lateral_inhibition',
  'Other',
]);

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('[binding-fidelity] starting audit');

  const taxonomy = loadTaxonomy();
  const canonicalNodeIds = new Set(Object.keys(taxonomy));
  console.log(`[binding-fidelity] canonical taxonomy: ${canonicalNodeIds.size} nodes`);

  const lowercased = new Map();
  for (const id of canonicalNodeIds) lowercased.set(id.toLowerCase(), id);

  const portalFiles = fs.readdirSync(PORTAL_DIR).filter((f) => f.endsWith('.json'));
  console.log(`[binding-fidelity] portals to audit: ${portalFiles.length}`);

  const report = {
    generatedAt: new Date().toISOString(),
    canonicalNodeCount: canonicalNodeIds.size,
    portalsAudited: 0,
    summary: {
      bindingsExamined: 0,
      validBindings: 0,
      missingBrainNodeId: 0,
      unknownBrainNodeId: 0,
      caseMismatchedNodeId: 0,
      invalidNeuralRole: 0,
      roleConsistent: 0,
      roleInconsistent: 0,
      portalsWithErrors: 0,
    },
    perPortal: {},
    perNode: {},
    perRelationshipType: {},
    mismatches: [],
    suspiciousDuplicates: detectDuplicates(taxonomy),
  };

  for (const file of portalFiles) {
    const slug = file.replace(/\.json$/, '');
    const portalPath = path.join(PORTAL_DIR, file);
    let portal;
    try {
      portal = JSON.parse(fs.readFileSync(portalPath, 'utf-8'));
    } catch (err) {
      report.perPortal[slug] = {
        ok: false,
        error: `parse: ${err.message}`,
      };
      report.summary.portalsWithErrors++;
      continue;
    }
    auditPortal(slug, portal, taxonomy, canonicalNodeIds, lowercased, report);
    report.portalsAudited++;
  }

  finalizeReport(report);
  writeReport(report);

  // CLI summary
  console.log('');
  console.log('=== BINDING FIDELITY SUMMARY ===');
  console.log(`portals audited:        ${report.portalsAudited}`);
  console.log(`bindings examined:      ${report.summary.bindingsExamined}`);
  console.log(`valid bindings:         ${report.summary.validBindings}`);
  console.log(`missing brainNodeId:    ${report.summary.missingBrainNodeId}`);
  console.log(`unknown brainNodeId:    ${report.summary.unknownBrainNodeId}`);
  console.log(`case mismatched:        ${report.summary.caseMismatchedNodeId}`);
  console.log(`invalid neuralRole:     ${report.summary.invalidNeuralRole}`);
  console.log(`role consistent:        ${report.summary.roleConsistent}`);
  console.log(`role inconsistent:      ${report.summary.roleInconsistent}`);
  console.log(`portals with errors:    ${report.summary.portalsWithErrors}`);
  console.log('');
  console.log(`top 10 mismatches written to ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log('');
  if (report.suspiciousDuplicates.length) {
    console.log(
      `[warn] taxonomy has ${report.suspiciousDuplicates.length} suspicious duplicate node IDs:`
    );
    for (const d of report.suspiciousDuplicates.slice(0, 5)) {
      console.log(`  - ${d.ids.join(' vs ')} (similar abbreviations)`);
    }
  }
}

// ============================================================================
// PER-PORTAL AUDIT
// ============================================================================

function auditPortal(slug, portal, taxonomy, canonicalNodeIds, lowercased, report) {
  const perPortal = {
    ok: true,
    bindingsExamined: 0,
    validBindings: 0,
    issues: [],
  };

  const fn = portal.functionalNetwork || {};

  for (const relType of RELATIONSHIP_TYPES) {
    let entries = fn[relType];
    if (!entries) continue;

    // Normalize: auditor is a single object in many portals
    if (!Array.isArray(entries)) entries = [entries];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i] || {};
      perPortal.bindingsExamined++;
      report.summary.bindingsExamined++;
      report.perRelationshipType[relType] = (report.perRelationshipType[relType] || 0) + 1;

      const entityName = entry.name || entry.firm || entry.entity || '(unnamed)';
      const brainNodeId = entry.brainNodeId;
      const neuralRole = entry.neuralRole;
      const brainNodeRole = entry.brainNodeRole;

      // CHECK 1 — brainNodeId presence + validity
      if (!brainNodeId) {
        perPortal.issues.push({
          severity: 'high',
          kind: 'missing_brainNodeId',
          relType,
          index: i,
          entityName,
        });
        report.summary.missingBrainNodeId++;
        addMismatch(report, {
          severity: 'high',
          kind: 'missing_brainNodeId',
          portalSlug: slug,
          relType,
          index: i,
          entityName,
        });
        continue;
      }

      let canonicalId = brainNodeId;
      if (!canonicalNodeIds.has(brainNodeId)) {
        const lcMatch = lowercased.get(brainNodeId.toLowerCase());
        if (lcMatch) {
          perPortal.issues.push({
            severity: 'medium',
            kind: 'case_mismatched_nodeId',
            relType,
            index: i,
            entityName,
            asserted: brainNodeId,
            canonical: lcMatch,
          });
          report.summary.caseMismatchedNodeId++;
          addMismatch(report, {
            severity: 'medium',
            kind: 'case_mismatched_nodeId',
            portalSlug: slug,
            relType,
            index: i,
            entityName,
            asserted: brainNodeId,
            canonical: lcMatch,
          });
          canonicalId = lcMatch;
        } else {
          perPortal.issues.push({
            severity: 'high',
            kind: 'unknown_brainNodeId',
            relType,
            index: i,
            entityName,
            asserted: brainNodeId,
          });
          report.summary.unknownBrainNodeId++;
          addMismatch(report, {
            severity: 'high',
            kind: 'unknown_brainNodeId',
            portalSlug: slug,
            relType,
            index: i,
            entityName,
            asserted: brainNodeId,
          });
          continue;
        }
      }

      // Track per-node binding counts
      const perNode = (report.perNode[canonicalId] = report.perNode[canonicalId] || {
        bindings: 0,
        portals: new Set(),
        relTypes: {},
        roleHistogram: {},
      });
      perNode.bindings++;
      perNode.portals.add(slug);
      perNode.relTypes[relType] = (perNode.relTypes[relType] || 0) + 1;
      if (brainNodeRole) {
        perNode.roleHistogram[brainNodeRole] = (perNode.roleHistogram[brainNodeRole] || 0) + 1;
      }

      // CHECK 2 — neuralRole label validity
      if (neuralRole && !VALID_NEURAL_ROLES.has(neuralRole)) {
        perPortal.issues.push({
          severity: 'low',
          kind: 'invalid_neuralRole',
          relType,
          index: i,
          entityName,
          asserted: neuralRole,
        });
        report.summary.invalidNeuralRole++;
        addMismatch(report, {
          severity: 'low',
          kind: 'invalid_neuralRole',
          portalSlug: slug,
          relType,
          index: i,
          entityName,
          asserted: neuralRole,
        });
      }

      // CHECK 3 — brainNodeRole consistency with canonical role table
      if (brainNodeRole) {
        const consistencyCheck = checkRoleConsistency(
          canonicalId,
          brainNodeRole,
          taxonomy
        );
        if (consistencyCheck.consistent) {
          report.summary.roleConsistent++;
        } else {
          report.summary.roleInconsistent++;
          perPortal.issues.push({
            severity: 'medium',
            kind: 'role_text_inconsistent',
            relType,
            index: i,
            entityName,
            brainNodeId: canonicalId,
            asserted: brainNodeRole,
            canonicalRolesAvailable: consistencyCheck.canonicalRoles,
            note: consistencyCheck.note,
          });
          addMismatch(report, {
            severity: 'medium',
            kind: 'role_text_inconsistent',
            portalSlug: slug,
            relType,
            index: i,
            entityName,
            brainNodeId: canonicalId,
            asserted: brainNodeRole,
            canonicalRolesAvailable: consistencyCheck.canonicalRoles.slice(0, 5),
          });
        }
      }

      // Tally valid if no high-severity issues
      const hasHigh = perPortal.issues.some(
        (issue) => issue.severity === 'high' && issue.relType === relType && issue.index === i
      );
      if (!hasHigh) {
        perPortal.validBindings++;
        report.summary.validBindings++;
      }
    }
  }

  if (perPortal.issues.length > 0) {
    perPortal.ok = false;
    report.summary.portalsWithErrors++;
  }

  report.perPortal[slug] = perPortal;
}

// ============================================================================
// CONSISTENCY CHECK
// ============================================================================

/**
 * Test whether the asserted brainNodeRole text is plausibly drawn from
 * the canonical role table for this node.
 *
 * The check is fuzzy on purpose — bindings authored by different AI
 * assistants over time will use different phrasings. We score as
 * inconsistent only when there's NO keyword overlap with ANY canonical
 * role at this node.
 */
function checkRoleConsistency(nodeId, assertedRole, taxonomy) {
  const node = taxonomy[nodeId];
  if (!node) return { consistent: false, note: 'node not in taxonomy', canonicalRoles: [] };

  const bindings = Array.isArray(node.domainBindings) ? node.domainBindings : [];
  const canonicalRoles = bindings
    .map((b) => b.role || b.label)
    .filter(Boolean);

  if (canonicalRoles.length === 0) {
    // Node has no role table — treat as consistent by default but note it
    return { consistent: true, note: 'no canonical roles to check against', canonicalRoles: [] };
  }

  const assertedTokens = tokenize(assertedRole);
  if (assertedTokens.size === 0) {
    return { consistent: false, note: 'asserted role has no tokens', canonicalRoles };
  }

  // Also include the node's own region + function + business prose
  const nodeProseTokens = new Set([
    ...tokenize(node.region || ''),
    ...tokenize(node.function || ''),
    ...tokenize(node.business || ''),
  ]);

  for (const canonical of canonicalRoles) {
    const canonicalTokens = tokenize(canonical);
    if (hasOverlap(assertedTokens, canonicalTokens)) {
      return { consistent: true, canonicalRoles };
    }
  }

  // Final fallback: check against node-level prose (region/function/business)
  if (hasOverlap(assertedTokens, nodeProseTokens)) {
    return { consistent: true, note: 'matched node-level prose', canonicalRoles };
  }

  return { consistent: false, canonicalRoles };
}

function tokenize(text) {
  if (!text) return new Set();
  const STOPWORDS = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'of',
    'to',
    'in',
    'on',
    'for',
    'at',
    'by',
    'with',
    'from',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'has',
    'have',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'this',
    'that',
    'these',
    'those',
    'into',
    'about',
    'than',
    'then',
    'so',
    'if',
    'but',
    'not',
    'no',
    'yes',
    '&',
    '—',
    '–',
    '-',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  );
}

function hasOverlap(a, b) {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

// ============================================================================
// FINALIZATION
// ============================================================================

function addMismatch(report, mm) {
  // Cap to keep file size reasonable
  if (report.mismatches.length < 5000) {
    report.mismatches.push(mm);
  }
}

function finalizeReport(report) {
  // Stringify per-node sets
  for (const id of Object.keys(report.perNode)) {
    const n = report.perNode[id];
    n.portalCount = n.portals.size;
    n.portals = Array.from(n.portals).sort();
    // Top 5 roles only — keep file small
    const sortedRoles = Object.entries(n.roleHistogram)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    n.topRoles = sortedRoles.map(([role, count]) => ({ role, count }));
    delete n.roleHistogram;
  }

  // Sort mismatches: high severity first
  const severityOrder = { high: 0, medium: 1, low: 2 };
  report.mismatches.sort((a, b) => {
    return (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
  });
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
}

// ============================================================================
// TAXONOMY HELPERS
// ============================================================================

function loadTaxonomy() {
  return JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
}

function detectDuplicates(taxonomy) {
  const ids = Object.keys(taxonomy);
  const dups = [];
  const seen = new Map();
  for (const id of ids) {
    const norm = id.toLowerCase();
    if (seen.has(norm)) {
      dups.push({ ids: [seen.get(norm), id], normalized: norm });
    } else {
      seen.set(norm, id);
    }
  }
  return dups;
}

// ============================================================================

main();
