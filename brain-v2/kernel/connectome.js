/**
 * brain-v2/kernel/connectome.js — BLOCK_B7 gate + BLOCK_B9 wiring. Bounded typed routing.
 *
 * MASTER_PROMPT §8.3, §8.4, §21 ("event bus ≠ connectome"). Fidelity: F0/F1.
 *
 * THE NAME IS A LIABILITY AND IS TREATED AS ONE. A message bus called a connectome is still a
 * message bus. What earns the name here is a short list of properties an ordinary bus does not
 * have, each of which is enforced in code below and testable:
 *
 *   1. RELEVANCE ROUTING, not broadcast. A packet goes to targets that declared interest in
 *      its kind. Broadcast-to-all is refused, not discouraged — §8.3.
 *   2. CONFIDENCE AND SALIENCE STAY SEPARATE. They are never multiplied into one "priority".
 *      A loud low-confidence signal must be able to jump the queue AND arrive marked unreliable.
 *      Collapsing them is how a rumour outranks a measurement.
 *   3. INHIBITION IS FIRST-CLASS. An inhibition packet suppresses a target's pending traffic.
 *      A bus that can only deliver can only excite (SPEC Part 4 motif 3).
 *   4. BOUNDED PROPAGATION. Hop limits, dedup, expiry, queue caps, and a measured amplification
 *      ratio. The ratio is the early warning for a loop storm and it is reported every tick.
 *
 * WHAT IT IS NOT: a topology. There are no weights here and no learned structure. Edges are
 * declared subscriptions. Calling that a connectome in the anatomical sense would be exactly
 * the substitution the No-Shortcut Contract prohibits.
 */

'use strict';

var PK = require('./packet.js');
var TOPO = require('./topology.js');

var DEFAULTS = {
  queueLimit: 256,          // backpressure ceiling per tick
  dedupWindow: 512,         // ids remembered for loop detection
  maxFanout: 8,             // a single packet may not reach more targets than this
  amplificationAlarm: 3.0   // out/in ratio above this is a storm signature
};

function create(opts) {
  opts = Object.assign({}, DEFAULTS, opts || {});
  return {
    opts: opts,
    // edges: target -> { kinds:[], domains:[] }. Declared, not learned.
    edges: Object.create(null),
    queue: [],
    recent: [],                  // dedup ring
    recentSet: Object.create(null),
    inhibited: Object.create(null), // target -> {until, by, reason}
    /* Optional structural plasticity (SPEC row 25). Null = no topology governs this
       connectome and routing behaves exactly as before. attachTopology() opts in. */
    topology: null,
    metrics: { in: 0, out: 0, dropped: 0, deduped: 0, expired: 0, hopExceeded: 0, inhibitedDrops: 0, backpressure: 0 }
  };
}

/**
 * Declare an edge. Every edge is typed on kind (SPEC Part 3) and must state its direction.
 * An edge with no kind filter would be a broadcast subscription by another name, so it throws.
 */
function connect(cx, target, spec) {
  if (!spec || !Array.isArray(spec.kinds) || !spec.kinds.length) {
    throw new Error('edge to "' + target + '" must declare which signal kinds it accepts — an untyped edge is undefined behavior (SPEC Part 3)');
  }
  spec.kinds.forEach(function (k) {
    if (PK.KINDS.indexOf(k) < 0) throw new Error('edge declares unknown kind: ' + k);
  });
  cx.edges[target] = {
    kinds: spec.kinds.slice(),
    domains: (spec.domains || []).slice(),   // empty = any domain
    direction: spec.direction || PK.DIRECTION.ASCENDING,
    role: spec.role || PK.ROLE.DRIVER,
    minConfidence: (typeof spec.minConfidence === 'number') ? spec.minConfidence : null,
    handler: spec.handler || null
  };
  return cx;
}

/**
 * Attach a topology (SPEC row 25). Separate from create() so an existing connectome is
 * unaffected until a caller explicitly opts in, and so a topology restored from a
 * snapshot can be reattached without rebuilding the connectome.
 */
function attachTopology(cx, topo) { cx.topology = topo || null; return cx; }

/**
 * INV-7 CHECK — reciprocity. For every ascending edge A->B there must be a descending edge.
 *
 * This is SPEC row 6, and it is the pathology the project has "repeatedly rediscovered". Making
 * it a runtime query rather than a design note means a feedforward-only wiring shows up as a
 * failing assertion instead of as a slow realisation six weeks later.
 */
function reciprocityReport(cx) {
  var asc = [], desc = [], open = [];
  Object.keys(cx.edges).forEach(function (t) {
    var e = cx.edges[t];
    if (e.direction === PK.DIRECTION.ASCENDING) asc.push(t);
    if (e.direction === PK.DIRECTION.DESCENDING) desc.push(t);
  });
  asc.forEach(function (t) {
    var hasReturn = desc.some(function (d) { return d.indexOf(t.split(':')[0]) === 0 || t.indexOf(d.split(':')[0]) === 0; });
    if (!hasReturn) open.push(t);
  });
  return {
    ascending: asc.length,
    descending: desc.length,
    lateral: Object.keys(cx.edges).filter(function (t) { return cx.edges[t].direction === PK.DIRECTION.LATERAL; }).length,
    openLoops: open,
    satisfiesINV7: open.length === 0
  };
}

/**
 * Which targets should see this packet. Relevance, not broadcast.
 * Returns [] when nothing matches — and that is a legitimate outcome, not an error: a signal
 * with no interested consumer is exactly the "dead axon" case SPEC row 1 asks about, and it
 * must be visible as such rather than papered over by a default subscriber.
 */
function route(cx, packet) {
  var targets = [];
  Object.keys(cx.edges).forEach(function (t) {
    var e = cx.edges[t];
    if (e.kinds.indexOf(packet.signalKind) < 0) return;
    if (e.domains.length && e.domains.indexOf(packet.sourceDomain) < 0) return;
    if (e.minConfidence !== null && (packet.confidence === null || packet.confidence < e.minConfidence)) return;
    if (packet.intendedTargets.length && packet.intendedTargets.indexOf(t) < 0) return;
    targets.push(t);
  });

  /**
   * TOPOLOGY IS APPLIED LAST, AND ONLY SUBTRACTS. SPEC row 25.
   *
   * Every rule above — kind, domain, confidence, intendedTargets — has already run, and
   * the fanout cap runs below. topology.filterTargets can only REMOVE from what
   * survived, never add. That ordering is the structural guarantee that a topology edit
   * cannot smuggle a packet past a type, direction, domain or provenance check: there is
   * no code path by which a dormant-then-reactivated edge re-enters the list except
   * through the same filters that admitted it originally.
   *
   * An undeclared edge is governed by the connectome alone, so attaching a topology to
   * an existing connectome changes nothing until edges are declared to it.
   */
  if (cx.topology) targets = TOPO.filterTargets(cx.topology, targets);

  return targets.slice(0, cx.opts.maxFanout);
}

/** Inhibit a target. SPEC Part 4 motif 4: enabling and disabling are different primitives. */
function inhibit(cx, target, until, by, reason) {
  cx.inhibited[target] = { until: until, by: by, reason: reason };
  return cx.inhibited[target];
}

function isInhibited(cx, target, now) {
  var i = cx.inhibited[target];
  if (!i) return null;
  if (typeof i.until === 'number' && now > i.until) { delete cx.inhibited[target]; return null; }
  return i;
}

/**
 * Submit a packet for routing. Returns a delivery report.
 *
 * Every drop names its cause. "Dropped" with no reason is how a silent loss becomes a
 * mysterious gap in a trace three days later.
 */
function submit(cx, packet, now) {
  cx.metrics.in++;
  var report = { packetId: packet.id, traceId: packet.traceId, delivered: [], dropped: [] };

  // dedup — the loop-containment primitive (TEST 15)
  if (cx.recentSet[packet.id]) {
    cx.metrics.deduped++;
    report.dropped.push({ target: '*', why: 'duplicate packet id — already routed this window' });
    return report;
  }
  cx.recentSet[packet.id] = true;
  cx.recent.push(packet.id);
  if (cx.recent.length > cx.opts.dedupWindow) delete cx.recentSet[cx.recent.shift()];

  if (packet.expiresAt !== null && now > packet.expiresAt) {
    cx.metrics.expired++;
    report.dropped.push({ target: '*', why: 'expired at ' + packet.expiresAt });
    return report;
  }
  if (packet.hopCount >= packet.hopLimit) {
    cx.metrics.hopExceeded++;
    report.dropped.push({ target: '*', why: 'hop limit ' + packet.hopLimit + ' reached' });
    return report;
  }
  if (cx.queue.length >= cx.opts.queueLimit) {
    cx.metrics.backpressure++;
    report.dropped.push({ target: '*', why: 'backpressure: queue at limit ' + cx.opts.queueLimit });
    return report;
  }

  var targets = route(cx, packet);
  if (!targets.length) {
    cx.metrics.dropped++;
    report.dropped.push({ target: '*', why: 'no edge accepts kind "' + packet.signalKind + '" from domain "' + packet.sourceDomain + '" — this signal has no consumer' });
    return report;
  }

  targets.forEach(function (t) {
    var inh = isInhibited(cx, t, now);
    if (inh) {
      cx.metrics.inhibitedDrops++;
      report.dropped.push({ target: t, why: 'target inhibited by ' + inh.by + ': ' + inh.reason });
      return;
    }
    var hopped = PK.hop(packet, t, now);
    if (!hopped) {
      cx.metrics.hopExceeded++;
      report.dropped.push({ target: t, why: 'hop limit reached on delivery' });
      return;
    }
    cx.queue.push({ target: t, packet: hopped });
    cx.metrics.out++;
    report.delivered.push({ target: t, packetId: hopped.id, hop: hopped.hopCount });
  });
  return report;
}

/** Drain the queue through declared handlers. Bounded by budget; the remainder stays queued. */
function drain(cx, budget) {
  budget = budget || cx.opts.queueLimit;
  var handled = [];
  var n = Math.min(budget, cx.queue.length);
  for (var i = 0; i < n; i++) {
    var item = cx.queue.shift();
    var e = cx.edges[item.target];
    var res = null;
    if (e && typeof e.handler === 'function') {
      try { res = e.handler(item.packet); }
      catch (err) { res = { error: err.message }; }   // fault isolation: one handler cannot stop the drain
    }
    handled.push({ target: item.target, packetId: item.packet.id, result: res });
  }
  return { handled: handled, remaining: cx.queue.length };
}

/**
 * AMPLIFICATION — out/in. The storm signature.
 * Reported every tick because a connectome that quietly doubles its own traffic looks healthy
 * right up until it does not.
 */
function amplification(cx) {
  if (!cx.metrics.in) return { ratio: null, alarm: false, why: 'no traffic' };
  var r = cx.metrics.out / cx.metrics.in;
  return { ratio: r, alarm: r > cx.opts.amplificationAlarm, threshold: cx.opts.amplificationAlarm };
}

function snapshotMetrics(cx) {
  return {
    metrics: Object.assign({}, cx.metrics),
    amplification: amplification(cx),
    queueDepth: cx.queue.length,
    edges: Object.keys(cx.edges).length,
    inhibited: Object.keys(cx.inhibited).length,
    reciprocity: reciprocityReport(cx),
    topology: cx.topology ? TOPO.report(cx.topology) : { attached: false }
  };
}

module.exports = {
  create: create,
  connect: connect,
  attachTopology: attachTopology,
  route: route,
  submit: submit,
  drain: drain,
  inhibit: inhibit,
  isInhibited: isInhibited,
  amplification: amplification,
  reciprocityReport: reciprocityReport,
  snapshotMetrics: snapshotMetrics,
  DEFAULTS: DEFAULTS
};
