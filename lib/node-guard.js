/**
 * lib/node-guard.js — the connectome's inhibitory brake (motif M1 applied to LIMEN itself).
 *
 * Single gate every generator / resolver / portal-derivation path calls before binding a business,
 * an efferent, or a diagnosis to a node. It reads the ONE source of truth (assets/data/canonical-
 * nodes.json, built by scripts/build-canonical-nodes.mjs) and REFUSES to let a non-node (tract,
 * molecule, glia, composite, construct, effector, ambiguous) carry a business/efferent — remapping
 * it to where the function actually belongs (edge / parameter / view / state) instead.
 *
 * This is layer-2 of "treat the connectome, don't amputate it": stop the aberrant firing at the
 * source so no downstream portal, digest, propagation, or opportunity is ever built on a phantom
 * node again. It also exposes each real node's MOTIF + failure-modes so the portal layer can DERIVE
 * a diagnosis from live feed state (feed x motif) instead of storing frozen text.
 *
 * Server/build-time (Node). Deterministic, no LLM.
 */
'use strict';
var fs = require('node:fs');
var path = require('node:path');

var _reg = null;
function load() {
  if (_reg) return _reg;
  var anchors = [
    path.join(__dirname, '..', 'assets', 'data', 'canonical-nodes.json'),
    '/var/task/assets/data/canonical-nodes.json',
    path.join(process.cwd(), 'assets', 'data', 'canonical-nodes.json')
  ];
  for (var i = 0; i < anchors.length; i++) {
    try { _reg = JSON.parse(fs.readFileSync(anchors[i], 'utf8')).nodes; if (_reg) return _reg; } catch (e) {}
  }
  _reg = {}; // degrade safe: unknown ids treated as non-bindable (see classify)
  return _reg;
}

// full record for an id (or an "unknown" record — treated conservatively as NOT bindable)
function classify(id) {
  var r = load()[id];
  if (r) return r;
  return { class: 'unknown', canBindBusiness: false, motif: null, remapTo: 'confirm', note: 'id not in canonical set — confirm before binding' };
}

function isRealNode(id) { return !!classify(id).canBindBusiness; }
function motifOf(id) { return classify(id).motif || null; }

// HARD brake — throws. Use in build scripts where a bad binding should fail loudly.
function assertRealNode(id) {
  var r = classify(id);
  if (!r.canBindBusiness) throw new Error('node-guard: cannot bind to non-node "' + id + '" (' + r.class + ') — belongs as ' + (r.remapTo || '?') + (r.remapTarget ? ' -> ' + r.remapTarget : ''));
  return r;
}

// SOFT brake — never throws. Returns whether a business/efferent may bind here, and if not, where
// the function should go instead. This is what generators call per candidate binding.
function guardBinding(id) {
  var r = classify(id);
  if (r.canBindBusiness) return { ok: true, id: id, class: 'real', motif: r.motif, role: r.role || null };
  return { ok: false, id: id, class: r.class, remapTo: r.remapTo, remapTarget: r.remapTarget || null, reason: r.note || (r.class + ' is not a bindable node') };
}

// DERIVATION seed (for the portals-as-feeds model): given a real node and a live activity/stress
// level (0..1, from the feeds propagating into it), return which failure pole it is in — so a
// diagnosis is COMPUTED from (feed x motif), not stored. hi/lo thresholds default to 0.66/0.34.
function deriveFailurePole(id, level, hi, lo) {
  var r = classify(id);
  if (!r.canBindBusiness) return { ok: false, reason: 'non-node', remapTo: r.remapTo };
  hi = hi == null ? 0.66 : hi; lo = lo == null ? 0.34 : lo;
  var fm = String(r.failureModes || '');
  var parts = fm.split(/\s+\/\s+/); // " / " delimits hyper/hypo; a pole may contain its own slash
  var pole = level >= hi ? 'hyper' : (level <= lo ? 'hypo' : 'regulated');
  var text = pole === 'hyper' ? (parts[0] || '').trim() : pole === 'hypo' ? (parts[1] || '').trim() : 'within regulated range';
  return { ok: true, id: id, motif: r.motif, role: r.role || null, level: level, pole: pole, diagnosis: text };
}

module.exports = { classify: classify, isRealNode: isRealNode, motifOf: motifOf, assertRealNode: assertRealNode, guardBinding: guardBinding, deriveFailurePole: deriveFailurePole };
