#!/usr/bin/env node
/**
 * Quarantine legacy portal-side kernel verdicts whose provenance cannot be
 * verified from the portal record.
 *
 * These records have no first-class CIK, yet claim a validated K1 score. Some
 * carry a CIK only inside helixReportUrl, but that field is not trustworthy:
 * unrelated companies reuse the same embedded CIK. The safe operation is to
 * preserve the original claim, remove its active verdict/alert and derived
 * bridge artifacts, and leave the rest of the portal intact.
 *
 *   node scripts/quarantine-unsupported-kernel-claims.mjs          # measure
 *   node scripts/quarantine-unsupported-kernel-claims.mjs --apply  # write
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPANY_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const AUDIT_REL = 'assets/data/audit/unsupported-kernel-claims.json';
const AUDIT_PATH = path.join(ROOT, AUDIT_REL);
const APPLY = process.argv.includes('--apply');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function embeddedCik(url) {
  const match = String(url || '').match(/[?&]cik=([^&#]+)/i);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]);
  return /^\d+$/.test(decoded) ? decoded.padStart(10, '0') : decoded;
}

function isTarget(portal) {
  const fh = portal.financialHealth || {};
  return !portal.cik &&
    /^validated$/i.test(String(fh.validationStatus || '')) &&
    typeof fh.compositeScore === 'number' &&
    Number.isFinite(fh.compositeScore);
}

const candidates = fs.readdirSync(COMPANY_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const abs = path.join(COMPANY_DIR, name);
    const bytes = fs.readFileSync(abs);
    return { name, abs, bytes, portal: JSON.parse(bytes) };
  })
  .filter(({ portal }) => isTarget(portal));

const alerts = candidates.filter(({ portal }) => portal.financialHealth.alert === true).length;
const bridgeMatches = candidates.reduce((n, { portal }) =>
  n + (Array.isArray(portal.bridgeReadings?.matched) ? portal.bridgeReadings.matched.length : 0), 0);
const investmentOutputs = candidates.reduce((n, { portal }) =>
  n + (Array.isArray(portal.engineOutputs?.investment) ? portal.engineOutputs.investment.length : 0), 0);
const researchOutputs = candidates.reduce((n, { portal }) =>
  n + (Array.isArray(portal.engineOutputs?.research) ? portal.engineOutputs.research.length : 0), 0);

console.log(`unsupported validated claims: ${candidates.length}`);
console.log(`active alerts: ${alerts}`);
console.log(`dependent bridge matches: ${bridgeMatches}`);
console.log(`dependent outputs: investment ${investmentOutputs}, research ${researchOutputs}`);

if (!APPLY) process.exit(0);
if (candidates.length === 0) {
  console.log('nothing to change');
  process.exit(0);
}
if (fs.existsSync(AUDIT_PATH)) {
  throw new Error(`${AUDIT_REL} already exists; refusing to overwrite preserved evidence`);
}

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8'
}).trim();
const generatedAt = process.env.LIMEN_SNAPSHOT_AT || new Date().toISOString();
const reasonCode = 'KERNEL_PROVENANCE_UNVERIFIED';

const archive = {
  schemaVersion: 'unsupported-kernel-claims/1.0',
  generatedAt,
  sourceCommit,
  reasonCode,
  scope: 'Portal-side K1 verdicts with validationStatus=validated, a finite compositeScore, and no first-class portal CIK.',
  finding: 'An embedded CIK in helixReportUrl is not accepted as score provenance because unrelated portals reuse embedded CIKs. The portal remains; only the unsupported verdict and its dependent derived artifacts are removed from active use.',
  totals: {
    portals: candidates.length,
    activeAlerts: alerts,
    bridgeMatches,
    investmentOutputs,
    researchOutputs
  },
  records: candidates.map(({ name, bytes, portal }) => ({
    path: `assets/data/companies/${name}`,
    fileSha256: sha256(bytes),
    slug: portal.slug || name.slice(0, -5),
    name: portal.name || null,
    ticker: portal.ticker || null,
    firstClassCik: portal.cik ?? null,
    embeddedReportCik: embeddedCik(portal.helixReportUrl),
    originalClaim: {
      kernelStatus: portal.kernelStatus ?? null,
      helixReportMode: portal.helixReportMode ?? null,
      helixReportUrl: portal.helixReportUrl ?? null,
      financialHealth: portal.financialHealth
    },
    dependentArtifacts: {
      bridgeMatches: Array.isArray(portal.bridgeReadings?.matched) ? portal.bridgeReadings.matched.length : 0,
      investmentOutputs: Array.isArray(portal.engineOutputs?.investment) ? portal.engineOutputs.investment.length : 0,
      researchOutputs: Array.isArray(portal.engineOutputs?.research) ? portal.engineOutputs.research.length : 0,
      fullOriginalPreservedAt: `${sourceCommit}:${`assets/data/companies/${name}`}`
    }
  }))
};

fs.writeFileSync(AUDIT_PATH, JSON.stringify(archive, null, 2) + '\n');

for (const { abs, portal } of candidates) {
  portal.kernelStatus = 'PROVENANCE_UNVERIFIED';
  portal.helixReportMode = 'unavailable';
  portal.helixReportUrl = null;
  portal.financialHealth = {
    asOf: null,
    lastKernelRun: null,
    kernelId: null,
    validationStatus: 'unavailable',
    envelopeStatus: 'PROVENANCE_UNVERIFIED',
    historyQuarters: 0,
    latestQuarter: null,
    compositeScore: null,
    alert: false,
    distressBand: 'unknown',
    dominantPhase: null,
    financialState: {
      cashLatest: null,
      debtLatest: null,
      cashRunwayQ: null
    },
    quarantine: {
      reasonCode,
      auditPath: AUDIT_REL,
      quarantinedAt: generatedAt,
      originalPreserved: true
    }
  };
  // The bridge matches and generated artifacts were downstream of the
  // unsupported phase/composite. Keep their full originals in sourceCommit,
  // but do not let them continue to feed research or investment queues.
  portal.bridgeReadings = {
    matched: [],
    evaluatedAt: null,
    patternsConsidered: 0,
    quarantine: {
      reasonCode,
      auditPath: AUDIT_REL
    }
  };
  portal.engineOutputs = {
    investment: [],
    research: [],
    generatedAt: null,
    generatorVersion: 'quarantined/1.0',
    bridgeCount: 0,
    artifactsByLane: {
      investment: 0,
      research: 0
    },
    totalArtifacts: 0,
    quarantine: {
      reasonCode,
      auditPath: AUDIT_REL
    }
  };
  fs.writeFileSync(abs, JSON.stringify(portal, null, 2) + '\n');
}

console.log(`wrote ${AUDIT_REL}`);
console.log(`quarantined ${candidates.length} portals; all other portal content retained`);
