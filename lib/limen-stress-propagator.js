/**
 * LIMEN Helix — Spider-Web Stress Propagator
 *
 * Pure-deterministic stress traversal across the portal functionalNetwork
 * graph. Each portal carries an INTRINSIC stress (from its kernel score
 * + alert flag). Stress propagates along edges (suppliers, customers,
 * competitors, regulators, capitalProviders, logisticsPartners) with
 * category-weighted, confidence-scaled, hop-attenuated attenuation.
 *
 * Output per portal:
 *   {
 *     slug,
 *     intrinsicStress: 0..N,          // own kernel composite + alert bonus
 *     inducedStress:   0..N,          // network-propagated stress
 *     inducedSources:  [{slug, contribution, hops, edgeCategory, edgePath}],
 *     totalStress:     intrinsic + induced,
 *     stressRatio:     induced / max(intrinsic, 0.01),
 *     networkPushed:   inducedStress > intrinsicStress   // surface flag
 *   }
 *
 * Algorithm:
 *   1. Build graph: nodes = portals (by slug), edges = each functionalNetwork
 *      entry with weight = CATEGORY_WEIGHT[cat] × CONFIDENCE_MULT[conf]
 *   2. Compute intrinsic stress for every portal from its kernel signal
 *      (CB composite × ALERT_MULT if alert; otherwise composite alone)
 *   3. BFS from every stressed node, for up to MAX_HOPS, accumulating
 *      attenuated stress on each downstream node
 *   4. Cap per-edge contribution to prevent any single source from
 *      dominating; aggregate sources with attribution
 *
 * Deterministic. No LLM. Re-runnable. Idempotent.
 *
 * Intended consumers:
 *   - Master Brain readiness biasing (induced-stress amplifies salience)
 *   - Command Board "network-pushed" visualization tier
 *   - Autofire worker (deprioritize fires on portals where induced > intrinsic
 *     UNTIL the source is addressed)
 *
 * No fabrication: stress only propagates over EXISTING edges. Orphan
 * stubs (no _resolvedFromPartnerEntry) contribute zero. Confidence
 * downscaled per the reciprocity dampening rules.
 */

// ─── Tuning constants ─────────────────────────────────────────────
const MAX_HOPS = 3;                 // 1=direct only, 2=hops, 3=cascade
const HOP_ATTENUATION = 0.5;        // 0.5^hops = 1 / 0.5 / 0.25 / 0.125
const ALERT_MULT = 2.0;             // alert-flagged nodes radiate 2× intrinsic
const MIN_PROPAGATION = 0.005;      // drop contributions below this threshold
const MAX_SOURCES_PER_NODE = 50;    // cap attribution list length

// Intrinsic-stress cap (post-alert-multiplier). Prevents kernel-side
// outliers (e.g. CB composite=107.80 vs p99=4.08) from dominating the
// propagation graph. Without this, one upstream-kernel anomaly cascades
// across the entire network and drowns the actual signal.
//
// The CAP is applied ONLY to the propagation input — the original
// uncapped intrinsic stress is still recorded in the result so the
// outlier remains visible. We're choosing not to amplify a value we
// can't validate; we're not hiding it.
const INTRINSIC_PROPAGATION_CAP = 5.0;

// ─── Inhibitory damping (MVP regulation primitive) ────────────────
// The L2 connectome (assets/data/brain-connectome.json) encodes 6
// canonical inhibitory edges (vmPFC→BLA, HAB→VTA, HAB→RAPHE,
// CAUD→GP, PUT→GP, GP→THAL). Before this primitive landed, the
// propagator was purely additive — stress could only accumulate,
// never regulate. That contradicts the L2 anatomy: the system has
// inhibitory pathways but the runtime never read them.
//
// For each portal, we count how many inhibitory edges are
// "functional" (i.e. both endpoints anchored to real entities in
// that portal's brainNodeMapping overrides — not pure template
// inheritance). Each functional edge applies a small damping
// multiplier to the portal's intrinsic stress AFTER the cap.
// Multi-edge damping compounds; the floor prevents unbounded
// suppression from any single portal.
//
// This is MVP: small, transparent, additive in concept across
// edges, doesn't touch BFS, fully audited per portal.
const INHIBITORY_DAMPING_PER_EDGE = 0.96;
const INHIBITORY_DAMPING_FLOOR    = 0.70;
const BRAIN_CONNECTOME_PATH       = require('node:path').resolve(__dirname, '..', 'assets', 'data', 'brain-connectome.json');

const CATEGORY_WEIGHT = {
  capitalProviders:  1.00,          // financial contagion is highest-impact
  suppliers:         0.85,          // value-chain input dependency
  customers:         0.85,          // value-chain output dependency
  logisticsPartners: 0.65,
  competitors:       0.55,          // competitive pressure, not direct cascade
  regulators:        0.45,          // regulatory cascade is slower / softer
  executiveTeam:     0.20,          // personnel changes have indirect effect
  marketSignals:     0.15,
  auditor:           0.30
};

const CONFIDENCE_MULT = {
  high:    1.00,
  medium:  0.70,
  low:     0.40,
  unknown: 0.30
};

// ─── Helpers ──────────────────────────────────────────────────────
function normalizeCik(c) {
  if (!c) return null;
  return String(c).replace(/^0+/, '');
}

function inferConfidenceCategory(rawConfidence, sourceType) {
  if (typeof rawConfidence === 'string') {
    const k = rawConfidence.toLowerCase().trim();
    if (CONFIDENCE_MULT[k] !== undefined) return k;
  }
  if (typeof rawConfidence === 'number') {
    if (rawConfidence >= 0.75) return 'high';
    if (rawConfidence >= 0.55) return 'medium';
    if (rawConfidence >= 0.35) return 'low';
    return 'unknown';
  }
  // Reciprocity-only entries default to a lower trust tier even
  // when the partner had high confidence — phase 1 already downshifted
  // but the marker itself flags it as derived.
  if (Array.isArray(sourceType) && sourceType.length === 1 && sourceType[0] === 'reciprocity_inferred') {
    return 'low';
  }
  return 'unknown';
}

// ─── Inhibitory-edge loading (L2 connectome) ──────────────────────
//
// Read brain-connectome.json once at module init. Filter to type=inhib
// (the schema uses `type` keyed against edgeTypes.inhib). If the file
// is missing or malformed, fall back to an empty set — propagator
// continues to work, just without the damping primitive.
let _INHIBITORY_EDGES_CACHE = null;
function loadInhibitoryEdges() {
  if (_INHIBITORY_EDGES_CACHE !== null) return _INHIBITORY_EDGES_CACHE;
  try {
    const fs = require('node:fs');
    const raw = fs.readFileSync(BRAIN_CONNECTOME_PATH, 'utf8');
    const conn = JSON.parse(raw);
    const edges = Array.isArray(conn.edges) ? conn.edges : [];
    // Accept multiple possible inhibition markers to be schema-resilient:
    //   type === 'inhib' (current L2 schema)
    //   type === 'inhibitory' (long form)
    //   polarity === 'negative' (alt schema)
    _INHIBITORY_EDGES_CACHE = edges
      .filter(e => {
        if (!e || !e.source || !e.target) return false;
        const t = String(e.type || '').toLowerCase();
        const pol = String(e.polarity || '').toLowerCase();
        return t === 'inhib' || t === 'inhibitory' || pol === 'negative';
      })
      .map(e => ({ source: e.source, target: e.target }))
      // Sort for deterministic iteration order (W3 determinism).
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  } catch (_err) {
    _INHIBITORY_EDGES_CACHE = [];
  }
  return _INHIBITORY_EDGES_CACHE;
}

/**
 * Determine which brain nodes in a portal are "populated" — i.e.,
 * anchored to real entities via classifier overrides rather than
 * being pure template inheritance.
 *
 * Heuristic per spec: a node is populated if portal.brainNodeMapping
 * .overrides[nodeId].external_add (or external_replace, or
 * internal_override) is present and non-empty. Cells with no override
 * block are template-defaults and don't count as anchored to *this*
 * company.
 *
 * @param {object} portal
 * @returns {Set<string>} set of brain-node IDs populated for this portal
 */
function populatedBrainNodes(portal) {
  const out = new Set();
  if (!portal || typeof portal !== 'object') return out;
  const bnm = portal.brainNodeMapping;
  if (!bnm || typeof bnm !== 'object') return out;
  const overrides = bnm.overrides;
  if (!overrides || typeof overrides !== 'object') return out;
  // Sort keys for deterministic Set insertion order (W3 determinism).
  const sortedEntries = Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b));
  for (const [nodeId, ov] of sortedEntries) {
    if (!ov || typeof ov !== 'object') continue;
    const hasExternalAdd = Array.isArray(ov.external_add) && ov.external_add.length > 0;
    const hasExternalReplace = Array.isArray(ov.external_replace) && ov.external_replace.length > 0;
    const hasInternalOverride = ov.internal_override && typeof ov.internal_override === 'object';
    if (hasExternalAdd || hasExternalReplace || hasInternalOverride) {
      out.add(nodeId);
    }
  }
  return out;
}

/**
 * For a portal, count how many inhibitory edges (from L2) have BOTH
 * endpoints populated in the portal's brainNodeMapping, and compute
 * the resulting damping multiplier.
 *
 * @param {object} portal
 * @param {Array<{source,target}>} inhibitoryEdges
 * @returns {{ damping: number, functional: number, edges: Array<{source,target}> }}
 */
function computeInhibitoryDamping(portal, inhibitoryEdges) {
  const populated = populatedBrainNodes(portal);
  if (populated.size === 0 || inhibitoryEdges.length === 0) {
    return { damping: 1.0, functional: 0, edges: [] };
  }
  const functional = [];
  for (const e of inhibitoryEdges) {
    if (populated.has(e.source) && populated.has(e.target)) {
      functional.push({ source: e.source, target: e.target });
    }
  }
  if (functional.length === 0) {
    return { damping: 1.0, functional: 0, edges: [] };
  }
  // Sort functional edges for deterministic output (W3 determinism).
  functional.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  // Compound multiplicatively per edge, floor at INHIBITORY_DAMPING_FLOOR.
  // 0.96^1=.96, ^2=.92, ^3=.88, ^4=.85, ^5=.81, ^6=.78 — all above 0.70 floor.
  const raw = Math.pow(INHIBITORY_DAMPING_PER_EDGE, functional.length);
  const damping = Math.max(raw, INHIBITORY_DAMPING_FLOOR);
  return { damping, functional: functional.length, edges: functional };
}

// ─── Graph construction ───────────────────────────────────────────

/**
 * Build the propagation graph from a portal corpus.
 *
 * @param {object} portalsBySlug - map of slug -> portal JSON
 * @returns {object} { nodes: Map(slug, NodeMeta), edges: Map(srcSlug, OutboundEdge[]) }
 */
function buildGraph(portalsBySlug) {
  const nodes = new Map();
  const edges = new Map();
  const slugByCik = new Map();
  const slugByName = new Map();

  // Sort slugs once for deterministic iteration across BOTH passes (W3 determinism).
  // Without this, Map insertion order — which downstream BFS iteration depends on —
  // would inherit OS / fs.readdirSync order from upstream callers.
  const sortedSlugs = Object.keys(portalsBySlug).sort();

  // Pass 1: enumerate nodes + build lookup indices
  for (const slug of sortedSlugs) {
    const p = portalsBySlug[slug];
    if (!p) continue;
    nodes.set(slug, {
      slug,
      cik: normalizeCik(p.cik),
      name: p.name || slug,
      domain: p.domainId || null,
      industry: p.industry || null
    });
    if (p.cik) slugByCik.set(normalizeCik(p.cik), slug);
    if (p.name) slugByName.set(p.name.toLowerCase(), slug);
    edges.set(slug, []);
  }

  // Pass 2: for each portal, resolve every fn entry into a graph edge
  for (const slug of sortedSlugs) {
    const p = portalsBySlug[slug];
    if (!p || !p.functionalNetwork) continue;
    const out = edges.get(slug);

    // Sort category keys for deterministic edge insertion order (W3 determinism).
    for (const category of Object.keys(p.functionalNetwork).sort()) {
      const baseWeight = CATEGORY_WEIGHT[category];
      if (baseWeight === undefined) continue;  // skip unknown categories

      const arr = p.functionalNetwork[category];
      const items = Array.isArray(arr) ? arr : (arr ? [arr] : []);
      for (const e of items) {
        if (!e || typeof e !== 'object') continue;

        // Resolve target slug — by slug, then by CIK, then by name fuzzy
        let targetSlug = null;
        if (e.slug && nodes.has(e.slug)) targetSlug = e.slug;
        else if (e.cik) {
          const c = normalizeCik(e.cik);
          if (slugByCik.has(c)) targetSlug = slugByCik.get(c);
        }
        if (!targetSlug && e.name) {
          const cand = slugByName.get(String(e.name).toLowerCase());
          if (cand) targetSlug = cand;
        }
        if (!targetSlug) continue;       // edge to a node we don't have — skip
        if (targetSlug === slug) continue; // self-loop, skip

        const confKey = inferConfidenceCategory(e.confidence, e.sourceType);
        const weight = baseWeight * CONFIDENCE_MULT[confKey];

        out.push({
          source: slug,
          target: targetSlug,
          category,
          weight,
          confidence: confKey,
          isReciprocityInferred: Array.isArray(e.sourceType) && e.sourceType.includes('reciprocity_inferred')
        });
      }
    }
  }

  // Sort each outbound edge list for deterministic BFS iteration (W3 determinism).
  // BFS dequeue order is deterministic given graph.edges iteration order; without
  // this sort, edges enumerated from different fn-category orderings could shuffle.
  for (const [slug, arr] of edges) {
    arr.sort((a, b) =>
      a.target.localeCompare(b.target) ||
      a.category.localeCompare(b.category) ||
      (b.weight - a.weight)
    );
  }

  return { nodes, edges, slugByCik, slugByName };
}

// ─── Intrinsic stress computation ──────────────────────────────────

/**
 * Compute intrinsic stress per node from kernel scores.
 *
 * @param {Map} nodes
 * @param {Array} commandBoardEntries - the CB companies array (short-key shape)
 * @param {object} [portalsBySlug] - optional, used for inhibitory damping
 * @returns {Map} slug -> { intrinsic, intrinsicRaw, capped, pathCAnomaly, kernelPath, intrinsicInhibitoryDamping, inhibitoryEdgesFunctional, ... }
 */
function computeIntrinsicStress(nodes, commandBoardEntries, portalsBySlug) {
  const intrinsic = new Map();
  const byCik = new Map();
  for (const c of commandBoardEntries) {
    if (c.c) byCik.set(normalizeCik(c.c), c);
  }

  const inhibitoryEdges = loadInhibitoryEdges();
  const portals = portalsBySlug && typeof portalsBySlug === 'object' ? portalsBySlug : {};

  for (const [slug, meta] of nodes) {
    let rawStress = 0;
    let kernelEntry = null;
    if (meta.cik && byCik.has(meta.cik)) {
      kernelEntry = byCik.get(meta.cik);
      const composite = Number(kernelEntry.co) || 0;
      const alertBonus = kernelEntry.a ? composite * (ALERT_MULT - 1) : 0;
      rawStress = composite + alertBonus;
    }
    // Cap the value used for propagation, but record the raw value so
    // outliers stay visible in the output for triage.
    const cappedStress = Math.min(rawStress, INTRINSIC_PROPAGATION_CAP);
    // Kernel path C is known to produce unbounded composite values
    // (path=A/B normalize 0..~3, path=C can spike to 30-100+).
    // Flag so downstream consumers know the upstream score is suspect.
    const pathCAnomaly = kernelEntry && kernelEntry.path === 'C' && rawStress > INTRINSIC_PROPAGATION_CAP;

    // Apply inhibitory damping AFTER the cap. Portals with intact
    // regulatory anatomy (inhibitory edges where both endpoints are
    // anchored to real entities) get a small reduction; portals with
    // no brainNodeMapping or no functional inhibitory edges pass
    // through unchanged.
    const inh = computeInhibitoryDamping(portals[slug], inhibitoryEdges);
    const dampedStress = cappedStress * inh.damping;

    intrinsic.set(slug, {
      slug,
      intrinsic: dampedStress,                              // post-cap, post-damping (used for propagation)
      intrinsicPreDamping: cappedStress,                    // post-cap, pre-damping (for audit)
      intrinsicRaw: rawStress,                              // pre-cap (visible for triage)
      capped: rawStress > INTRINSIC_PROPAGATION_CAP,
      pathCAnomaly,
      kernelPath: kernelEntry ? kernelEntry.path || null : null,
      composite: kernelEntry ? Number(kernelEntry.co) || 0 : 0,
      alert: kernelEntry ? !!kernelEntry.a : false,
      phase: kernelEntry ? kernelEntry.p || null : null,
      trajectory: kernelEntry ? kernelEntry.tr || null : null,
      hasKernelData: !!kernelEntry,
      intrinsicInhibitoryDamping: Number(inh.damping.toFixed(4)),
      inhibitoryEdgesFunctional: inh.functional,
      inhibitoryEdgePaths: inh.edges
    });
  }
  return intrinsic;
}

// ─── BFS propagation ───────────────────────────────────────────────

/**
 * Propagate stress through the graph using BFS from every stressed node.
 *
 * @param {object} graph - { nodes, edges }
 * @param {Map} intrinsic - slug -> { intrinsic, ... }
 * @returns {Map} slug -> { intrinsicStress, inducedStress, inducedSources[], totalStress, stressRatio, networkPushed }
 */
function propagate(graph, intrinsic) {
  const result = new Map();
  for (const slug of graph.nodes.keys()) {
    const i = intrinsic.get(slug);
    result.set(slug, {
      slug,
      intrinsicStress: i.intrinsic,                   // post-cap, post-damping (used for math)
      intrinsicStressPreDamping: i.intrinsicPreDamping, // post-cap, pre-damping (audit)
      intrinsicStressRaw: i.intrinsicRaw,             // pre-cap (visible for triage)
      intrinsicCapped: i.capped,
      pathCAnomaly: i.pathCAnomaly,
      kernelPath: i.kernelPath,
      intrinsicInhibitoryDamping: i.intrinsicInhibitoryDamping,
      inhibitoryEdgesFunctional: i.inhibitoryEdgesFunctional,
      inhibitoryEdgePaths: i.inhibitoryEdgePaths,
      inducedStress: 0,
      inducedSources: [],
      _sourceMap: new Map() // sourceSlug -> { contribution, hops, edgeCategory, edgePath }
    });
  }

  // BFS from every node with nonzero intrinsic stress.
  for (const [originSlug, originMeta] of intrinsic) {
    if (originMeta.intrinsic <= 0) continue;

    const visited = new Map(); // slug -> minimum hops seen
    const queue = [{ slug: originSlug, hops: 0, accumulator: originMeta.intrinsic, path: [originSlug] }];
    visited.set(originSlug, 0);

    while (queue.length) {
      const cur = queue.shift();
      if (cur.hops >= MAX_HOPS) continue;

      const outbound = graph.edges.get(cur.slug) || [];
      for (const e of outbound) {
        const next = e.target;
        if (next === originSlug) continue;  // never propagate back to source

        // Compute the contribution this edge delivers
        const hopAtten = Math.pow(HOP_ATTENUATION, cur.hops + 1);
        const contribution = cur.accumulator * e.weight * hopAtten;
        if (contribution < MIN_PROPAGATION) continue;

        // Record on target node (always — multiple paths from same source add up)
        const node = result.get(next);
        const existingSrc = node._sourceMap.get(originSlug);
        if (existingSrc) {
          existingSrc.contribution += contribution;
        } else {
          node._sourceMap.set(originSlug, {
            sourceSlug: originSlug,
            contribution,
            firstHops: cur.hops + 1,
            edgeCategory: e.category,
            edgePath: cur.path.concat([next])
          });
        }

        // Only continue BFS to this node if we haven't visited it yet
        // at this depth (avoids exponential blowup; cycles handled too)
        const prevHops = visited.get(next);
        if (prevHops === undefined || cur.hops + 1 < prevHops) {
          visited.set(next, cur.hops + 1);
          queue.push({
            slug: next,
            hops: cur.hops + 1,
            accumulator: contribution,  // attenuate before re-propagating
            path: cur.path.concat([next])
          });
        }
      }
    }
  }

  // Finalize: convert _sourceMap to arrays, compute aggregates
  for (const [slug, node] of result) {
    const sources = Array.from(node._sourceMap.values())
      .sort((a, b) => b.contribution - a.contribution);
    node.inducedStress = sources.reduce((sum, s) => sum + s.contribution, 0);
    node.inducedSources = sources.slice(0, MAX_SOURCES_PER_NODE).map(s => ({
      sourceSlug: s.sourceSlug,
      contribution: Number(s.contribution.toFixed(4)),
      firstHops: s.firstHops,
      edgeCategory: s.edgeCategory,
      edgePath: s.edgePath
    }));
    node.intrinsicStress = Number(node.intrinsicStress.toFixed(4));
    node.inducedStress = Number(node.inducedStress.toFixed(4));
    node.totalStress = Number((node.intrinsicStress + node.inducedStress).toFixed(4));
    node.stressRatio = node.intrinsicStress > 0.01
      ? Number((node.inducedStress / node.intrinsicStress).toFixed(2))
      : (node.inducedStress > 0 ? null : 0);  // null = inducedStress with no intrinsic baseline
    node.networkPushed = node.inducedStress > node.intrinsicStress && node.inducedStress > 0.1;
    delete node._sourceMap;
  }

  return result;
}

// ─── High-level public API ────────────────────────────────────────

/**
 * Run a full propagation pass over a corpus.
 *
 * @param {object} portalsBySlug - map of slug -> portal JSON
 * @param {Array} commandBoardEntries - CB companies (short-key shape)
 * @returns {object} { nodes, edges, intrinsic, propagated, stats }
 */
function runPropagation(portalsBySlug, commandBoardEntries) {
  const graph = buildGraph(portalsBySlug);
  const intrinsic = computeIntrinsicStress(graph.nodes, commandBoardEntries || [], portalsBySlug);
  const propagated = propagate(graph, intrinsic);

  // Summary stats
  let edgeCount = 0;
  for (const arr of graph.edges.values()) edgeCount += arr.length;

  const stressedNodes = Array.from(propagated.values()).filter(n => n.intrinsicStress > 0).length;
  const networkPushed = Array.from(propagated.values()).filter(n => n.networkPushed).length;
  const inducedOnly = Array.from(propagated.values()).filter(n => n.intrinsicStress === 0 && n.inducedStress > 0).length;
  const cappedNodes = Array.from(propagated.values()).filter(n => n.intrinsicCapped).length;
  const cappedDetails = Array.from(propagated.values())
    .filter(n => n.intrinsicCapped)
    .map(n => ({ slug: n.slug, raw: n.intrinsicStressRaw, capped: n.intrinsicStress }))
    .sort((a, b) => b.raw - a.raw);

  // Inhibitory-damping rollup
  const inhibitoryEdgesLoaded = loadInhibitoryEdges().length;
  const dampedNodes = Array.from(propagated.values()).filter(n => n.inhibitoryEdgesFunctional > 0);
  const avgDamping = dampedNodes.length
    ? dampedNodes.reduce((s, n) => s + n.intrinsicInhibitoryDamping, 0) / dampedNodes.length
    : 1.0;
  const dampingHistogram = {};
  for (const n of dampedNodes) {
    const k = String(n.inhibitoryEdgesFunctional);
    dampingHistogram[k] = (dampingHistogram[k] || 0) + 1;
  }

  return {
    nodes: graph.nodes,
    edges: graph.edges,
    intrinsic,
    propagated,
    stats: {
      totalNodes: graph.nodes.size,
      totalEdges: edgeCount,
      stressedNodes,
      networkPushed,
      inducedOnly,
      cappedNodes,
      cappedDetails,
      maxHops: MAX_HOPS,
      hopAttenuation: HOP_ATTENUATION,
      alertMult: ALERT_MULT,
      intrinsicPropagationCap: INTRINSIC_PROPAGATION_CAP,
      inhibitoryEdgesLoaded,
      inhibitoryDampedNodes: dampedNodes.length,
      inhibitoryAvgDamping: Number(avgDamping.toFixed(4)),
      inhibitoryDampingHistogram: dampingHistogram,
      inhibitoryDampingPerEdge: INHIBITORY_DAMPING_PER_EDGE,
      inhibitoryDampingFloor: INHIBITORY_DAMPING_FLOOR
    }
  };
}

// ─── Determinism contract (W3) ────────────────────────────────────
//
// `propagated[]` is the hashable payload — every entry depends only on
// the input portal corpus + Command Board snapshot + L2 inhibitory
// edges + tuning constants. None of its fields carry a wall-clock or
// PRNG value. Cross-run hash equality of `propagated[]` is the
// determinism contract verified by
// `scripts/verify-iteration-determinism.mjs`.
//
// `generatedAt` (and `computeMs`, attached by the endpoint) belong to
// the envelope wrapper, NOT to the hashable payload. We picked the
// "two-function" design over the "envelope-extract" design because:
//   - the existing on-disk cache (stress-network-state.json) and the
//     wire shape consumers see MUST keep `generatedAt` for human-
//     readability and freshness checks
//   - splitting into `serializeResult()` (with timestamp) and
//     `serializeResultDeterministic()` (timestamp-free) keeps that
//     contract obvious at every call site, with zero risk that a
//     consumer accidentally hashes the wrong region
// Callers that need a hash always go through `serializeResultDeterministic()`
// or `propagatedHash()`. The cache writer + endpoint continue to use
// `serializeResult()`.

/**
 * Build the deterministic, JSON-friendly representation of a propagation
 * result. NO wall-clock fields. Safe to hash byte-for-byte.
 */
function serializeResultDeterministic(result) {
  // Sort with explicit tie-break on slug so identical totalStress values
  // produce stable ordering across runs (insertion-order ties would inherit
  // upstream non-determinism if any later relaxation slips in).
  const sorted = Array.from(result.propagated.values())
    .map(n => ({
      slug: n.slug,
      intrinsicStress: n.intrinsicStress,
      intrinsicStressPreDamping: n.intrinsicStressPreDamping,
      intrinsicStressRaw: n.intrinsicStressRaw,
      intrinsicCapped: n.intrinsicCapped,
      pathCAnomaly: n.pathCAnomaly,
      kernelPath: n.kernelPath,
      intrinsicInhibitoryDamping: n.intrinsicInhibitoryDamping,
      inhibitoryEdgesFunctional: n.inhibitoryEdgesFunctional,
      inhibitoryEdgePaths: n.inhibitoryEdgePaths,
      inducedStress: n.inducedStress,
      totalStress: n.totalStress,
      stressRatio: n.stressRatio,
      networkPushed: n.networkPushed,
      inducedSources: n.inducedSources
    }))
    .sort((a, b) => (b.totalStress - a.totalStress) || a.slug.localeCompare(b.slug));

  return {
    schemaVersion: '1.0.0',
    stats: result.stats,
    propagated: applyAmplificationRanks(sorted, result.edges)
  };
}

/**
 * Serialize propagation result to JSON-friendly form for the cache + endpoint.
 * Includes `generatedAt` for human readability. NOT safe to hash for
 * determinism — use `serializeResultDeterministic()` or `propagatedHash()`
 * for that.
 */
function serializeResult(result) {
  const det = serializeResultDeterministic(result);
  return {
    schemaVersion: det.schemaVersion,
    generatedAt: new Date().toISOString(),
    stats: det.stats,
    propagated: det.propagated
  };
}

// ─── Hash helper (FNV-1a, mirrors api/limen-engine-output.js:75-86) ────
// Co-located so the verify harness + future iteration-cache helpers
// don't have to duplicate the implementation across files. Identical
// algorithm and identical output format as the engine-output hash.
function fnv1aHash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let h1 = 0x811c9dc5;
  let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c; h2 = (h2 * 0x100000001b3) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) +
         ('00000000' + h2.toString(16)).slice(-8);
}

/**
 * Hash of the deterministic `propagated[]` payload from a propagation
 * result. Two runs of `runPropagation()` on identical inputs MUST
 * produce identical hashes. Used by the W3 verify harness and by the
 * future iteration cache for idempotency keys.
 */
function propagatedHash(result) {
  return fnv1aHash(serializeResultDeterministic(result).propagated);
}

// ─── Amplification ranking ─────────────────────────────────────────
// Replace the too-sensitive boolean `networkPushed` with a tiered
// signal that accounts for:
//   1. Hub topology — nodes with very high in-degree are STRUCTURALLY
//      stressed by network density, not by anomalous stress flow.
//      We surface them but tag them as `hub_pushed` not `anomaly_pushed`.
//   2. Absolute scale — induced < 1.0 is in the noise band.
//   3. Relative to corpus — pushed nodes ranked by where their
//      induced stress falls in the corpus distribution.
//
// Amplification tiers:
//   NONE        — induced < 1.0 OR induced ≤ intrinsic
//   MILD        — induced > intrinsic, induced in [1.0, p75 of corpus)
//   MODERATE    — induced in [p75, p95)
//   SEVERE      — induced ≥ p95
//   HUB_EFFECT  — node is a top-10% in-degree hub; structural not anomalous
//
// `amplificationRank` replaces `networkPushed` as the primary surfacing
// signal. networkPushed kept for backward compatibility.

const HUB_PERCENTILE = 0.90;        // top 10% by in-degree
const MIN_INDUCED_FOR_SIGNAL = 1.0;

function computeInDegree(edges) {
  const inDegree = new Map();
  for (const arr of edges.values()) {
    for (const e of arr) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }
  return inDegree;
}

function applyAmplificationRanks(nodes, edges) {
  if (!nodes.length) return nodes;

  const inDegree = computeInDegree(edges);
  const inDegrees = Array.from(inDegree.values()).sort((a, b) => a - b);
  const hubThreshold = inDegrees[Math.floor(inDegrees.length * HUB_PERCENTILE)] || Infinity;

  const induceds = nodes.map(n => n.inducedStress).filter(x => x > 0).sort((a, b) => a - b);
  const p75 = induceds[Math.floor(induceds.length * 0.75)] || Infinity;
  const p95 = induceds[Math.floor(induceds.length * 0.95)] || Infinity;

  for (const n of nodes) {
    const inD = inDegree.get(n.slug) || 0;
    n.inDegree = inD;
    n.isHub = inD >= hubThreshold;

    if (n.inducedStress < MIN_INDUCED_FOR_SIGNAL || n.inducedStress <= n.intrinsicStress) {
      n.amplificationRank = 'NONE';
    } else if (n.isHub) {
      n.amplificationRank = 'HUB_EFFECT';
    } else if (n.inducedStress >= p95) {
      n.amplificationRank = 'SEVERE';
    } else if (n.inducedStress >= p75) {
      n.amplificationRank = 'MODERATE';
    } else {
      n.amplificationRank = 'MILD';
    }
  }
  return nodes;
}

module.exports = {
  buildGraph,
  computeIntrinsicStress,
  propagate,
  runPropagation,
  serializeResult,
  serializeResultDeterministic,
  propagatedHash,
  fnv1aHash,
  // Inhibitory primitive (MVP regulation)
  loadInhibitoryEdges,
  populatedBrainNodes,
  computeInhibitoryDamping,
  // Constants for callers who want to introspect tuning
  CATEGORY_WEIGHT,
  CONFIDENCE_MULT,
  MAX_HOPS,
  HOP_ATTENUATION,
  ALERT_MULT,
  INTRINSIC_PROPAGATION_CAP,
  INHIBITORY_DAMPING_PER_EDGE,
  INHIBITORY_DAMPING_FLOOR
};
