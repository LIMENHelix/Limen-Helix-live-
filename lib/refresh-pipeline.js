/**
 * refresh-pipeline.js — regenerate an artifact with greater detail.
 *
 * Operator clicks REFRESH on an artifact. This module re-runs the generator
 * with strictness flags + portal-context expansion. When ANTHROPIC_API_KEY is
 * set, optionally calls Claude with the prior artifact + an "improve depth /
 * specificity / anchoring" prompt. Without the key, falls back to deterministic
 * regeneration with expanded context windows.
 *
 * Refresh modes:
 *   strictness=1  default — regenerate with more portal context, more bridge
 *                 mechanism detail, more clinical references
 *   strictness=2  add quantitative anchors (financial signal from kernelReadings,
 *                 peer cohort context, functional-network counterparty data)
 *   strictness=3  full Anthropic augmentation (requires key + budget)
 */
const fs = require('node:fs');
const path = require('node:path');
const { generateForPortal, generatePatent, generateGrant, generateInvestment, generateResearch } = require('./engine-output-generator.js');

const ROOT = path.join(__dirname, '..', '..');
const PORTALS_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const PATTERNS_PATH = path.join(ROOT, 'assets', 'data', 'bridge-patterns.json');

function _loadPortal(slug) { try { return JSON.parse(fs.readFileSync(path.join(PORTALS_DIR, slug + '.json'), 'utf8')); } catch (e) { return null; } }
function _savePortal(slug, portal) { fs.writeFileSync(path.join(PORTALS_DIR, slug + '.json'), JSON.stringify(portal, null, 2)); }
function _loadPatterns() { try { return JSON.parse(fs.readFileSync(PATTERNS_PATH, 'utf8')); } catch (e) { return { patterns: [] }; } }
function _getBridge(portal, lane, index) {
  const item = portal.engineOutputs && portal.engineOutputs[lane] && portal.engineOutputs[lane][index];
  if (!item) return null;
  const bridge = (portal.bridgeReadings && portal.bridgeReadings.matched || []).find(m => m.patternId === item.patternId);
  return bridge;
}

const LANE_GENERATORS = {
  patent: generatePatent,
  grant: generateGrant,
  investment: generateInvestment,
  research: generateResearch
};

// Inject extra portal context into a bridge match so the generators produce
// more anchored, more specific output on the next pass.
function _enrichBridge(bridge, portal, strictness) {
  const fn = portal.functionalNetwork || {};
  const enriched = JSON.parse(JSON.stringify(bridge));
  // pull supplier + customer names for anchored references
  const supplierNames = (fn.suppliers || []).slice(0, 5).map(s => s.name).filter(Boolean);
  const customerNames = (fn.customers || []).slice(0, 5).map(c => c.name).filter(Boolean);
  enriched._enrichedContext = {
    supplierAnchors: supplierNames,
    customerAnchors: customerNames,
    sector: portal.sector || portal.industry,
    domain: portal.domainId,
    kernelPhase: (portal.kernelReadings && portal.kernelReadings.k2 && portal.kernelReadings.k2.phase) || (portal.financialHealth && portal.financialHealth.dominantPhase),
    strictness
  };
  return enriched;
}

async function refreshArtifact({ portalSlug, lane, index, strictness, actionId }) {
  const portal = _loadPortal(portalSlug);
  if (!portal) return { ok: false, error: 'portal not found' };
  const bridge = _getBridge(portal, lane, index);
  if (!bridge) return { ok: false, error: 'bridge match not found for artifact' };
  const gen = LANE_GENERATORS[lane];
  if (!gen) return { ok: false, error: 'no generator for lane ' + lane };

  // strictness ≥ 1: enrich bridge with portal-context anchors
  const enriched = _enrichBridge(bridge, portal, strictness || 1);
  let refreshed = gen(portal, enriched);
  if (!refreshed) return { ok: false, error: 'generator returned null' };

  // strictness ≥ 2: append portal counterparty anchors into artifact prose
  if ((strictness || 1) >= 2 && refreshed.artifact) {
    const ctx = enriched._enrichedContext || {};
    const anchorLine = ctx.supplierAnchors && ctx.supplierAnchors.length
      ? '\n\n[Anchored counterparties: suppliers — ' + ctx.supplierAnchors.join(', ') + (ctx.customerAnchors && ctx.customerAnchors.length ? '; customers — ' + ctx.customerAnchors.join(', ') : '') + ']'
      : '';
    if (lane === 'patent' && refreshed.artifact.abstract) refreshed.artifact.abstract += anchorLine;
    if (lane === 'grant' && refreshed.artifact.abstract) refreshed.artifact.abstract += anchorLine;
    if (lane === 'investment' && refreshed.artifact.variantView) refreshed.artifact.variantView += anchorLine;
    if (lane === 'research' && refreshed.artifact.methodology) refreshed.artifact.methodology += anchorLine;
  }

  // strictness ≥ 3: try Anthropic augmentation if API key available
  if ((strictness || 1) >= 3 && process.env.ANTHROPIC_API_KEY) {
    try {
      const augmented = await _claudeAugment(refreshed.artifact, lane, bridge, portal);
      if (augmented) refreshed.artifact = augmented;
    } catch (e) {
      console.warn('[refresh] Claude augmentation failed, falling back:', e.message);
    }
  }

  refreshed.refreshedAt = new Date().toISOString();
  refreshed.refreshActionId = actionId || null;
  refreshed.refreshStrictness = strictness || 1;

  // replace the artifact in place
  portal.engineOutputs[lane][parseInt(index, 10)] = refreshed;
  portal.engineOutputs.lastRefreshAt = new Date().toISOString();
  _savePortal(portalSlug, portal);

  return { ok: true, artifact: refreshed, strictness: strictness || 1 };
}

async function _claudeAugment(artifact, lane, bridge, portal) {
  const orchestrator = require('./ai-orchestrator.js');
  const system = "You are an expert in clinical neuroscience, corporate financial analysis, and the specific lane (patent / grant / investment / research) you are improving. Your job is to take a draft artifact and rewrite it with greater depth, specificity, and anchored detail while preserving the structural conventions of approved documents in this lane (real USPTO claim shape, real NIH SBIR Specific Aims shape, real disciplined investment thesis shape, real research note shape). Do NOT invent facts. Do NOT add fabricated numbers. Use the provided portal context to anchor every claim. Return ONLY the improved artifact as JSON matching the input shape — no preamble, no markdown wrapper.";
  const prompt = JSON.stringify({
    instruction: 'Improve this ' + lane + ' artifact for ' + (portal.name || portal.slug) + '. Increase depth, add specific anchored references to functional-network counterparties and kernel readings, tighten the prose to match real ' + lane + '-approved documents.',
    bridge: {
      patternId: bridge.patternId,
      neuralRegion: bridge.neuralRegionLabel || bridge.neuralRegion,
      businessSignature: bridge.businessSignature,
      mechanism: bridge.bridge ? bridge.bridge.rationale : null,
      knownTreatments: bridge.knownTreatments,
      matchedIndicators: bridge.matchedIndicators
    },
    portalContext: {
      name: portal.name,
      ticker: portal.ticker,
      sector: portal.sector || portal.industry,
      domain: portal.domainId,
      cik: portal.cik,
      kernelPhase: (portal.kernelReadings && portal.kernelReadings.k2 && portal.kernelReadings.k2.phase) || (portal.financialHealth && portal.financialHealth.dominantPhase),
      suppliers: ((portal.functionalNetwork || {}).suppliers || []).slice(0, 6).map(s => ({ name: s.name, phase: s.phase })),
      customers: ((portal.functionalNetwork || {}).customers || []).slice(0, 6).map(c => ({ name: c.name, phase: c.phase }))
    },
    draftArtifact: artifact
  });
  const r = await orchestrator.call('REFRESH_ARTIFACT', { system, prompt, maxTokens: 8192 });
  if (!r.ok) { console.warn('[refresh._claudeAugment] orchestrator failed:', r.error); return null; }
  try {
    // accept either bare JSON or JSON inside the response text
    let txt = r.text || '';
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start >= 0 && end > start) txt = txt.slice(start, end + 1);
    return JSON.parse(txt);
  } catch (e) {
    console.warn('[refresh._claudeAugment] JSON parse failed:', e.message);
    return null;
  }
}

module.exports = { refreshArtifact };
