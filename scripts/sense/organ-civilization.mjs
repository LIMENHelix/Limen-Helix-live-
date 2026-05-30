// scripts/sense/organ-civilization.mjs — thalamus / salience / global workspace.
//
// Civilization super-brain aggregates 20 canonical domains' pattern emissions
// into a civilization-scope kernel readout (dominantPhase, phaseVector, stress,
// trajectory). Feeds civilization.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CIV = path.join(ROOT, 'assets', 'js', 'limen', 'civilization-super-brain.js');

export const id = 'civilization';
export const role = 'thalamus / salience / global workspace';
export const order = 70;

const CANONICAL_DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','supplyChain','technology'];

export function sense() {
  if (!fs.existsSync(CIV)) {
    return { score: 0, status: 'IN_PAIN', summary: 'civilization-super-brain.js missing', metrics: {}, attention: [{ issue: 'civilization-super-brain.js missing', severity: 'high', count: 1, action: 'restore from git history', organ: id }] };
  }
  const src = fs.readFileSync(CIV, 'utf8');
  // canonical domain array present + complete
  const domainsInSrc = CANONICAL_DOMAINS.filter(d => new RegExp(`['"\`]${d}['"\`]`).test(src));
  const missingDomains = CANONICAL_DOMAINS.filter(d => !domainsInSrc.includes(d));
  const checks = {
    canonicalDomainsComplete: domainsInSrc.length === CANONICAL_DOMAINS.length,
    kernelStructure: /kernels\.thing2|thing2\s*:/.test(src),
    dominantPhase: /dominantPhase/.test(src),
    phaseVector: /phaseVector/.test(src),
    stressField: /stress\b.*:/.test(src),
    trajectoryField: /trajectory\b.*:/.test(src),
    patternEnvelopeEmit: /broker|publish|sealEnvelope|sealed|envelope/i.test(src),
    consumesPackets: /LIMENCivilizationPackets|domainPackets|consumeDomainPacket/.test(src)
  };
  const size = fs.statSync(CIV).size;

  const attention = [];
  if (missingDomains.length > 0) attention.push({ issue: 'Civilization aggregator missing canonical domains', severity: 'high', count: missingDomains.length, action: 'add: ' + missingDomains.join(', '), organ: id });
  if (!checks.kernelStructure) attention.push({ issue: 'kernels.thing2 readout not detected', severity: 'high', count: 1, action: 'inspect civilization-super-brain.js — kernel structure missing', organ: id });
  if (!checks.patternEnvelopeEmit) attention.push({ issue: 'Civilization not publishing to pattern bus', severity: 'high', count: 1, action: 'wire emit() to LIMENPatternBroker', organ: id });
  if (!checks.consumesPackets) attention.push({ issue: 'Civilization not consuming domain packets — aggregator has no input', severity: 'high', count: 1, action: 'wire to LIMENCivilizationPackets / domain brain output', organ: id });

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const score = Math.round(passed / total * 100);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${passed}/${total} structural markers · ${domainsInSrc.length}/${CANONICAL_DOMAINS.length} canonical domains in aggregator · size ${(size / 1024).toFixed(1)}KB`,
    metrics: { checks, domainsCovered: domainsInSrc, missingDomains, size },
    attention
  };
}
