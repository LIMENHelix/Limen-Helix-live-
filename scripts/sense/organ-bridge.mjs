// scripts/sense/organ-bridge.mjs — bridge layer / idea-generation organ.
//
// The bridge layer is the prime-directive piece: explicit pattern mappings
// between neural mechanisms and business signatures. Without it, LIMEN is a
// regulatory monitor; with it, LIMEN derives ideas (patents, grants,
// investment angles) that neither neurology nor business literature alone has
// produced.
//
// This organ measures:
//   - library size (pattern count)
//   - coverage (portals with ≥1 matched bridge)
//   - average bridges per portal
//   - pattern dominance distribution (any pattern matching >50% is over-firing)
//   - portals with no bridge match (the library-gap frontier)
//   - derivedAngles density (how many engine-feedable angles exist per portal)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const PATTERNS_PATH = path.join(ROOT, 'assets', 'data', 'bridge-patterns.json');
const VERBIAGE_PATH = path.join(ROOT, 'assets', 'data', 'verbiage-templates.json');
const LOG_PATH = path.join(ROOT, 'assets', 'data', '_bridge-build-log.json');

export const id = 'bridge';
export const role = 'brain↔business bridge layer (idea generation)';
export const order = 110;   // after the body's sensing organs — output layer

export function sense() {
  let lib; try { lib = JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8')); } catch (e) { lib = { patterns: [] }; }
  const patterns = lib.patterns || [];
  const patternCount = patterns.length;
  // verbiage library — templates the engine lanes use to mint real-shaped artifacts
  let verbiage = null; try { verbiage = JSON.parse(fs.readFileSync(VERBIAGE_PATH, 'utf8')); } catch (e) {}
  const verbiageLanes = (verbiage && verbiage.lanes) ? Object.keys(verbiage.lanes) : [];
  const verbiageReady = verbiageLanes.length >= 4;   // patent + grant + sba + investment minimum

  let total = 0;
  let withBridges = 0;
  let totalBridges = 0;
  let totalDerivedAngles = 0;
  let withEngineOutputs = 0;
  let totalArtifacts = 0;
  const byLaneArtifacts = { patent: 0, grant: 0, sba: 0, investment: 0, research: 0, franchise: 0 };
  const byPattern = {};
  const byMappingType = {};
  const blindToBridge = [];
  let lastEvalSample = null;

  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')); } catch (e) {}
  for (const f of files) {
    let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
    total++;
    const br = p.bridgeReadings;
    if (!br || !Array.isArray(br.matched) || br.matched.length === 0) {
      if (blindToBridge.length < 25) blindToBridge.push({ slug: f.replace(/\.json$/, ''), name: p.name });
      continue;
    }
    withBridges++;
    totalBridges += br.matched.length;
    if (!lastEvalSample && br.evaluatedAt) lastEvalSample = br.evaluatedAt;
    for (const m of br.matched) {
      byPattern[m.patternId] = (byPattern[m.patternId] || 0) + 1;
      if (m.mappingType) byMappingType[m.mappingType] = (byMappingType[m.mappingType] || 0) + 1;
      // count derivedAngles slots that are populated
      const da = m.derivedAngles || {};
      for (const k of Object.keys(da)) if (da[k] != null) totalDerivedAngles++;
    }
    // engine outputs (lane artifacts minted from bridges)
    const eo = p.engineOutputs;
    if (eo && typeof eo === 'object' && eo.totalArtifacts > 0) {
      withEngineOutputs++;
      totalArtifacts += eo.totalArtifacts;
      for (const lane of Object.keys(byLaneArtifacts)) byLaneArtifacts[lane] += (eo[lane] || []).length;
    }
  }

  // pattern-dominance: warn if any single pattern matches > 50% of all matched portals
  const patternDominance = [];
  for (const pid in byPattern) {
    const share = totalBridges ? byPattern[pid] / totalBridges : 0;
    if (share > 0.30) patternDominance.push({ patternId: pid, count: byPattern[pid], shareOfMatches: +share.toFixed(2) });
  }

  // last batch summary
  let lastBatch = null;
  if (fs.existsSync(LOG_PATH)) { try { lastBatch = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch (e) {} }

  const coverage = total ? +(withBridges / total).toFixed(3) : 0;
  const avgBridges = total ? +(totalBridges / total).toFixed(2) : 0;

  // scoring: weight coverage primarily, library size as a floor.
  // (15 patterns is a starting library — expect to grow over time.)
  const coverageScore = Math.round(coverage * 100);
  const libraryScore = Math.min(100, Math.round(patternCount * 5));   // 20 patterns = full
  const score = Math.round((coverageScore + libraryScore) / 2);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  const attention = [];
  if (patternCount === 0) attention.push({ issue: 'Bridge pattern library is EMPTY', severity: 'high', count: 1, action: 'restore assets/data/bridge-patterns.json', organ: id });
  if (!verbiage) attention.push({ issue: 'Verbiage template library missing — engine outputs will read generated, not approved', severity: 'high', count: 1, action: 'restore assets/data/verbiage-templates.json (distilled from real USPTO/NIH/SBA/investor samples)', organ: id });
  else if (!verbiageReady) attention.push({ issue: 'Verbiage library incomplete — needs all 4 lanes (patent, grant, sba, investment)', severity: 'med', count: 4 - verbiageLanes.length, action: 'expand assets/data/verbiage-templates.json', organ: id });
  if (withBridges < total * 0.7 && total > 0) attention.push({ issue: 'Bridge coverage below 70% — many portals have no neuro↔business mapping', severity: 'med', count: total - withBridges, action: 'either expand bridge-patterns.json to cover more business signatures, OR these portals genuinely lack pathology pattern (informational)', organ: id });
  for (const pd of patternDominance) attention.push({ issue: 'Pattern dominance: ' + pd.patternId + ' matches ' + Math.round(pd.shareOfMatches * 100) + '% of all bridges (over-firing?)', severity: 'low', count: pd.count, action: 'tighten indicators in pattern ' + pd.patternId + ' to be more specific', organ: id });
  if (lastBatch && lastBatch.generatedAt) {
    const ageHours = (Date.now() - new Date(lastBatch.generatedAt).getTime()) / 3600000;
    if (ageHours > 24) attention.push({ issue: 'Bridge readings stale (>24h)', severity: 'low', count: Math.round(ageHours), action: 'run scripts/build-bridge-readings.mjs --apply', organ: id });
  }

  return {
    score, status,
    summary: `${patternCount} patterns · ${withBridges}/${total} portals bridged (${Math.round(coverage * 100)}%) · ${totalBridges} bridges · ${totalArtifacts} engine artifacts on ${withEngineOutputs} portals · verbiage ${verbiageReady ? '✓' : '✗'}`,
    metrics: {
      patternCount,
      coverage,
      portalsWithBridges: withBridges,
      portalsBlindToBridge: total - withBridges,
      totalBridges,
      totalDerivedAngles,
      averageBridgesPerPortal: avgBridges,
      byPattern,
      byMappingType,
      patternDominance,
      blindToBridgeSample: blindToBridge,
      lastEvaluated: lastEvalSample,
      engineOutputs: { portalsWithOutputs: withEngineOutputs, totalArtifacts, byLane: byLaneArtifacts },
      verbiageLibrary: { present: !!verbiage, lanes: verbiageLanes, schemaVersion: verbiage && verbiage.schemaVersion },
      scoreParts: { coverage: coverageScore, library: libraryScore }
    },
    attention
  };
}
