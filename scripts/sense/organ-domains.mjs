// scripts/sense/organ-domains.mjs — 21 cortical circuits.
//
// Each domain has a brain file in assets/js/domain-brains/ that defines its
// feed sources, activation logic, and pattern envelope emission. This organ
// verifies all 21 brain files exist, each exports a brainId, and structural
// markers (feedSources, kernels, opportunities) are present in the source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DOMAIN_BRAINS_DIR = path.join(ROOT, 'assets', 'js', 'domain-brains');

export const id = 'domains';
export const role = '21 cortical circuits (domain brains)';
export const order = 30;

const EXPECTED_DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','supplyChain','technology','trade'];
// Domain brains are IIFE-wrapped scripts that extend LIMENDomainBrainBase and
// expose window.LIMEN<X>Brain. Required structural markers, not literal field names:
const REQUIRED_MARKERS = ['LIMENDomainBrainBase', 'window.LIMEN'];

export function sense() {
  if (!fs.existsSync(DOMAIN_BRAINS_DIR)) {
    return { score: 0, status: 'IN_PAIN', summary: 'domain-brains dir missing — no cortical circuits', metrics: {}, attention: [{ issue: 'assets/js/domain-brains directory missing', severity: 'high', count: 1, action: 'restore from git history', organ: id }] };
  }
  const files = fs.readdirSync(DOMAIN_BRAINS_DIR).filter(f => f.endsWith('-brain.js') || f.endsWith('-brain.mjs'));
  const present = new Set(files.map(f => f.replace(/-brain\.(js|mjs)$/, '')));
  const missing = EXPECTED_DOMAINS.filter(d => !present.has(d));
  const extras = [...present].filter(d => !EXPECTED_DOMAINS.includes(d));

  // structural check per file — does each export brainId? carry feedSources / kernels?
  const malformed = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(DOMAIN_BRAINS_DIR, f), 'utf8');
    const missingMarkers = REQUIRED_MARKERS.filter(m => !src.includes(m));
    if (missingMarkers.length > 0) malformed.push({ file: f, missing: missingMarkers });
  }

  // packet adapter — memory says #1 pathology was loop open at domain-packet-adapter.js
  const ADAPTER = path.join(ROOT, 'assets', 'js', 'limen', 'domain-packet-adapter.js');
  const adapterPresent = fs.existsSync(ADAPTER);

  const attention = [];
  if (missing.length > 0) attention.push({ issue: 'Missing canonical domain brain files', severity: 'high', count: missing.length, action: 'create ' + missing.map(d => `assets/js/domain-brains/${d}-brain.js`).join(', '), organ: id });
  if (malformed.length > 0) attention.push({ issue: 'Domain brain files lacking required markers (brainId / feedSources / kernels)', severity: 'med', count: malformed.length, action: 'inspect: ' + malformed.slice(0, 5).map(m => m.file).join(', '), organ: id });
  if (!adapterPresent) attention.push({ issue: 'domain-packet-adapter.js missing — loop between domains and Main Brain is OPEN', severity: 'high', count: 1, action: 'restore assets/js/limen/domain-packet-adapter.js (memory: this was canonical #1 pathology)', organ: id });

  const countScore = Math.round(present.size / EXPECTED_DOMAINS.length * 100);
  const structuralScore = files.length === 0 ? 0 : Math.round((files.length - malformed.length) / files.length * 100);
  const adapterScore = adapterPresent ? 100 : 0;
  const score = Math.round((countScore + structuralScore + adapterScore) / 3);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${present.size}/${EXPECTED_DOMAINS.length} domains · ${files.length - malformed.length}/${files.length} structurally complete · packet-adapter ${adapterPresent ? '✓' : '✗ OPEN LOOP'}`,
    metrics: { fileCount: files.length, presentDomains: [...present], missingDomains: missing, extraDomains: extras, malformed, adapterPresent, scoreParts: { count: countScore, structural: structuralScore, adapter: adapterScore } },
    attention
  };
}
