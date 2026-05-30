// scripts/sense/organ-pattern-bus.mjs — pattern-envelope bus / inter-organ comm.
//
// The pattern-broker is the pub/sub bus every super-brain publishes envelopes
// to. Without a healthy bus, no organ talks to any other. Static checks:
//   - broker + envelope files exist
//   - audit log buffer cap (5000) present
//   - emit depth re-entrancy guard (8) present
//   - envelope contract: _sealed + _signature integrity fields present
//   - subscribe / register / emit method signatures present
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BROKER = path.join(ROOT, 'assets', 'js', 'limen', 'pattern-broker.js');
const ENVELOPE = path.join(ROOT, 'assets', 'js', 'limen', 'pattern-envelope.js');

export const id = 'patternBus';
export const role = 'pattern-envelope bus (inter-organ comm)';
export const order = 100;

export function sense() {
  const present = { broker: fs.existsSync(BROKER), envelope: fs.existsSync(ENVELOPE) };
  if (!present.broker || !present.envelope) {
    return { score: 0, status: 'IN_PAIN', summary: 'pattern bus files missing — no inter-organ comm', metrics: { present }, attention: [{ issue: 'pattern-broker.js / pattern-envelope.js missing', severity: 'high', count: 1, action: 'restore from git history', organ: id }] };
  }
  const bsrc = fs.readFileSync(BROKER, 'utf8');
  const esrc = fs.readFileSync(ENVELOPE, 'utf8');
  const checks = {
    auditLogBuffer: /_auditMax\s*=\s*[0-9]+|maxAudit\s*=\s*[0-9]+/.test(bsrc),
    emitDepthGuard: /_emitDepthMax\s*=\s*[0-9]+|emitDepth/.test(bsrc),
    subscribeMethod: /subscribe\s*[\(:]/.test(bsrc),
    registerMethod: /register\s*[\(:]/.test(bsrc),
    emitMethod: /emit\s*[\(:]/.test(bsrc),
    subscribersIndex: /_subscribers\s*=\s*\{|this\._subscribers/.test(bsrc),
    latestIndex: /_latest\s*=\s*\{|this\._latest/.test(bsrc),
    // Real envelope shape: env.pattern.signature (computed in sealEnvelope())
    sealedField: /seal\s*[A-Za-z]|sealed\b|sealEnvelope/.test(esrc),
    signatureField: /\bsignature\b/.test(esrc),
    kernelsField: /kernels\b/.test(esrc),
    cycleIdField: /cycleId/.test(esrc),
    brainIdField: /brainId/.test(esrc)
  };

  const attention = [];
  if (!checks.auditLogBuffer) attention.push({ issue: 'Pattern bus audit log buffer cap not detected', severity: 'med', count: 1, action: 'verify _auditMax in pattern-broker.js (expected ~5000)', organ: id });
  if (!checks.emitDepthGuard) attention.push({ issue: 'Re-entrancy depth guard not detected', severity: 'med', count: 1, action: 'verify _emitDepthMax in pattern-broker.js (expected 8)', organ: id });
  if (!checks.sealedField || !checks.signatureField) attention.push({ issue: 'Envelope integrity seal missing (_sealed / _signature)', severity: 'high', count: 1, action: 'envelope contract broken — no integrity guarantee on inter-organ messages', organ: id });
  if (!checks.subscribeMethod || !checks.emitMethod) attention.push({ issue: 'Pattern-broker missing core methods (subscribe / emit)', severity: 'high', count: 1, action: 'inspect pattern-broker.js', organ: id });

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const score = Math.round(passed / total * 100);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${passed}/${total} structural markers · broker ${(fs.statSync(BROKER).size / 1024).toFixed(1)}KB · envelope ${(fs.statSync(ENVELOPE).size / 1024).toFixed(1)}KB`,
    metrics: { present, checks },
    attention
  };
}
