// scripts/sense/organ-master-brain.mjs — PFC / executive cortex.
//
// Master Brain integrates civilization + connectome kernels and gates 6
// execution lanes (Research / Patent / Grant / SBA / Franchise / Investment).
// Static checks: file existence, all 6 lanes declared, weight-blend present,
// engineOutput persistence wired.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MASTER_BRAIN = path.join(ROOT, 'assets', 'js', 'limen', 'master-living-brain.js');
const EXECUTOR = path.join(ROOT, 'assets', 'js', 'master-brain-executor.js');
const ENGINE_PERSIST = path.join(ROOT, 'api', 'limen-engine-output.js');
const INBOX_PATH = path.join(ROOT, 'assets', 'data', '_master-inbox.json');
const CONSUMER_PATH = path.join(ROOT, 'lib', 'master-brain-consumer.js');

export const id = 'masterBrain';
export const role = 'PFC / executive cortex (6 engine gates)';
export const order = 80;

const SIX_LANES = ['patent', 'grant', 'sba', 'franchise', 'investment', 'research'];

export function sense() {
  const present = {
    masterBrain: fs.existsSync(MASTER_BRAIN),
    executor: fs.existsSync(EXECUTOR),
    enginePersist: fs.existsSync(ENGINE_PERSIST),
    consumer: fs.existsSync(CONSUMER_PATH),
    inbox: fs.existsSync(INBOX_PATH)
  };

  // Consumption state: does the Master Brain actually have an inbox? Is it fresh?
  let inboxStats = null, inboxAgeHours = null;
  if (present.inbox) {
    try {
      const inbox = JSON.parse(fs.readFileSync(INBOX_PATH, 'utf8'));
      inboxStats = inbox.stats || null;
      if (inbox.generatedAt) inboxAgeHours = (Date.now() - new Date(inbox.generatedAt).getTime()) / 3600000;
    } catch (e) {}
  }
  if (!present.masterBrain && !present.executor) {
    return { score: 0, status: 'IN_PAIN', summary: 'master-living-brain.js + master-brain-executor.js both missing — system has no executive', metrics: {}, attention: [{ issue: 'Master Brain files missing', severity: 'high', count: 2, action: 'restore from git history', organ: id }] };
  }
  const src = (present.masterBrain ? fs.readFileSync(MASTER_BRAIN, 'utf8') : '') + '\n' + (present.executor ? fs.readFileSync(EXECUTOR, 'utf8') : '');

  // lane declarations
  const lanesPresent = SIX_LANES.filter(l => new RegExp(`['"\`]${l}['"\`]`).test(src));
  const lanesMissing = SIX_LANES.filter(l => !lanesPresent.includes(l));

  const checks = {
    consumesCivilization: /civilization|LIMENCivilization|civ_kernel/i.test(src),
    consumesConnectome: /connectome|LIMENConnectome/i.test(src),
    weightBlend: /(0\.65|0\.35|65.*35|35.*65)/.test(src),       // memory: 65% civ + 35% connectome
    readinessGate: /readiness\b/.test(src),
    salienceGate: /salience\b/.test(src),
    engineFireLog: /engineFire|fireEngine|fireLane/i.test(src),
    enginePersistEndpoint: present.enginePersist,
    readyToSignGate: /READY[-_ ]TO[-_ ]SIGN|readyToSign/i.test(src),
    patternEnvelopeEmit: /emit\s*\(/.test(src)
  };

  const attention = [];
  if (lanesMissing.length > 0) attention.push({ issue: 'Master Brain missing engine lane declarations', severity: 'high', count: lanesMissing.length, action: 'add lane configs for: ' + lanesMissing.join(', '), organ: id });
  if (!checks.consumesCivilization) attention.push({ issue: 'Master Brain does not consume civilization kernel', severity: 'high', count: 1, action: 'wire to LIMENCivilization superbrain output', organ: id });
  if (!checks.consumesConnectome) attention.push({ issue: 'Master Brain does not consume connectome kernel', severity: 'high', count: 1, action: 'wire to LIMENConnectome superbrain output', organ: id });
  if (!checks.weightBlend) attention.push({ issue: '65/35 civ/connectome weight blend not detected', severity: 'med', count: 1, action: 'verify integration weights in master-living-brain.js', organ: id });
  if (!checks.enginePersistEndpoint) attention.push({ issue: 'api/limen-engine-output.js missing — engine outputs cannot persist', severity: 'high', count: 1, action: 'restore persistence endpoint', organ: id });
  if (!checks.readyToSignGate) attention.push({ issue: 'READY-TO-SIGN gating not detected — H6 human-click contract may be broken', severity: 'med', count: 1, action: 'inspect master-brain-executor.js qualification gates', organ: id });
  if (!present.inbox) attention.push({ issue: 'Master Brain inbox never built — engine outputs not gated/prioritized yet', severity: 'med', count: 1, action: 'run scripts/build-master-inbox.mjs --apply', organ: id });
  else if (inboxAgeHours !== null && inboxAgeHours > 6) attention.push({ issue: 'Master Brain inbox stale (>6h)', severity: 'low', count: Math.round(inboxAgeHours), action: 'invoke build-master-inbox.mjs (also runs in the autonomic loop)', organ: id });
  if (inboxStats && inboxStats.readyToFire === 0 && inboxStats.totalCandidates > 0) attention.push({ issue: 'All ' + inboxStats.totalCandidates + ' candidate artifacts INHIBITED — readiness/salience thresholds too high OR engine outputs too placeholder-heavy', severity: 'low', count: inboxStats.totalCandidates, action: 'inspect /master-inbox.html or master-brain-consumer.js thresholds', organ: id });

  const lanesScore = Math.round(lanesPresent.length / SIX_LANES.length * 100);
  const structuralPassed = Object.values(checks).filter(Boolean).length;
  const structuralScore = Math.round(structuralPassed / Object.keys(checks).length * 100);
  const score = Math.round((lanesScore + structuralScore) / 2);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${lanesPresent.length}/${SIX_LANES.length} engine lanes · ${structuralPassed}/${Object.keys(checks).length} markers` + (inboxStats ? ` · inbox ${inboxStats.readyToFire}/${inboxStats.totalCandidates} ready (${inboxAgeHours !== null ? inboxAgeHours.toFixed(1) + 'h old' : 'fresh'})` : ' · inbox ✗'),
    metrics: { present, lanesPresent, lanesMissing, checks, inbox: inboxStats, inboxAgeHours, scoreParts: { lanes: lanesScore, structural: structuralScore } },
    attention
  };
}
