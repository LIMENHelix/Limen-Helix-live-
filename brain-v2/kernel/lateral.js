/**
 * brain-v2/kernel/lateral.js — SPEC row 24. Bounded connectivity between PEER domains.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS FILE DOES NOT SATISFY ROW 24 AND MUST NOT BE SCORED AS IF IT DID.
 *
 * Row 24 asks for lateral connectivity BETWEEN PEER DOMAINS. One domain is bound
 * (energy). The mechanism below is exercised only against synthetic peers constructed
 * inside its own test file, and a synthetic peer proves the mechanism is well-formed —
 * that it terminates, refuses echoes, and bounds influence — not that peer domains
 * inform each other usefully. Those are different claims and only the second is the row.
 *
 * The temptation this file exists to resist is copying the energy binding into a second
 * directory, calling it finance, and reporting two domains. That would produce a peer
 * whose observations are energy's observations, so every cross-domain agreement would be
 * an artefact of the copy — a correlation of one series with itself, which is exactly
 * the circular inference this project has already had to cut once. A fabricated peer is
 * worse than no peer, because no peer is visibly missing.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT LATERAL TRAFFIC IS ALLOWED TO BE
 *
 * Peers are not superiors. The hierarchy already has ascending and descending edges with
 * their own rules; lateral is the third direction and it carries EVIDENCE, never
 * commands. A peer may tell another peer what it observed. It may not tell it what to
 * conclude, may not write its state, and may not actuate on its behalf. `publish` takes
 * an observation and a stated latent; there is no verb here that changes a peer.
 *
 * THE FOUR BOUNDS, AND WHY EACH ONE IS A SEPARATE MECHANISM
 *
 *   1. ECHO SUPPRESSION (the important one). Every message carries the set of domains
 *      that contributed to it. A domain REFUSES any message its own id appears in. This
 *      is reafference cancellation at the domain level: without it, A informs B, B's
 *      state moves, B publishes, and A receives its own signal back wearing a different
 *      name and counts it as independent corroboration. Two domains would then converge
 *      on whatever A believed first and report high agreement, which is the most
 *      convincing possible way to be wrong.
 *
 *   2. INFLUENCE CAP. The total precision a domain may accept from all peers combined is
 *      capped as a fraction of its OWN precision. A domain that has measured nothing
 *      cannot be talked into confidence by peers, because a fraction of nothing is
 *      nothing. Peers are corroboration, not substitution.
 *
 *   3. TTL AND FANOUT. A message decays by hop and dies. Cycles in the peer graph are
 *      allowed to exist — real domains are not a tree — and are made harmless rather
 *      than forbidden.
 *
 *   4. DECLARED LINKS ONLY, EACH NAMING A LATENT. Same requirement `divergence.relate`
 *      imposes: if you cannot say what two domains both observe, they are not peers and
 *      the link is refused. An undeclared pair is not a broadcast, it is an error.
 *
 * PROVENANCE IS PRESERVED, NOT LAUNDERED. A received message stays labelled `foreign`
 * with its origin, hop count and contributor set intact. Nothing here converts a peer's
 * observation into the receiver's own evidence — that conversion is the barrier's
 * decision, and the barrier defaults to deny.
 *
 * Deterministic: no clock, no randomness, `at` supplied by the caller.
 */

'use strict';

var RULE_VERSION = 'lateral/1';

var DEFAULTS = {
  /* A message may cross at most this many peer boundaries. 2 lets A -> B -> C carry a
     genuine second-order relation while keeping the blast radius small and auditable. */
  maxHops: 2,
  /* Peers a single domain may publish to per message. */
  maxFanout: 4,
  /* Ceiling on total foreign precision, as a fraction of the receiver's own. At 0.5 a
     domain's peers can never outweigh its own measurements no matter how many peers
     agree, which is what stops a chorus from beating an instrument. */
  influenceCap: 0.5,
  /* Messages retained per domain inbox. Bounded so a silent consumer cannot grow one. */
  inboxCap: 64,
  /* Ancestries the bus remembers. A relay whose parent has aged out cannot prove its
     lineage, and is treated as unprovable rather than as clean — see publish(). */
  lineageCap: 512,
  /* Precision decay per hop. A second-hand report is worth less than a first-hand one,
     and this is the only place that judgement is expressed. */
  hopDecay: 0.5
};

function createBus(opts) {
  return {
    ruleVersion: RULE_VERSION,
    opts: Object.assign({}, DEFAULTS, opts || {}),
    domains: Object.create(null),   // id -> { id, registeredAt }
    links: [],                      // declared peer links
    inbox: Object.create(null),     // domainId -> [message]
    /**
     * LINEAGE IS OWNED BY THE BUS, NOT CARRIED BY THE MESSAGE.
     *
     * The first version read `contributors` off the object the caller handed back as
     * `inheritedFrom`, which made the whole echo defence advisory: any caller could pass
     * a copy with the list emptied and relay a signal straight back to its originator.
     * Worse, the adversarial test for it asserted that the forged relay DID reach the
     * origin and called that a pass — the test documented the hole instead of closing it.
     *
     * So the bus keeps its own record, keyed by a message id it issued itself, and
     * `publish` reads only from here. A caller can edit the copy it holds all it likes;
     * the copy is not consulted. A parent id the bus never issued is refused outright,
     * because accepting an unknown ancestry is the same laundering path with an extra
     * step.
     *
     * messageId -> contributors[]
     */
    lineage: Object.create(null),
    lineageHop: Object.create(null),  // messageId -> hop depth, same ownership rule
    lineageOrder: [],               // insertion order, for bounded eviction
    seq: 0,                         // deterministic id disambiguator
    metrics: { published: 0, delivered: 0, echoRefused: 0, hopExpired: 0, undeclared: 0,
               capped: 0, fanoutTrimmed: 0, selfPublish: 0, latentMismatch: 0, forgedParent: 0 },
    version: 0
  };
}

/** Record a message's ancestry against the id the bus issued. Bounded. */
function recordLineage(bus, id, contributors) {
  if (!bus.lineage[id]) bus.lineageOrder.push(id);
  bus.lineage[id] = contributors.slice();
  while (bus.lineageOrder.length > bus.opts.lineageCap) {
    var gone = bus.lineageOrder.shift();
    delete bus.lineage[gone];
    delete bus.lineageHop[gone];
  }
  return bus.lineage[id];
}

/** Register a domain as a participant. Registration is not a link. */
function register(bus, domainId, at) {
  if (!domainId) throw new Error('lateral: a domain needs an id');
  if (typeof at !== 'number') throw new Error('lateral: register needs a caller-supplied `at` (no clock in this module)');
  if (!bus.domains[domainId]) {
    bus.domains[domainId] = { id: domainId, registeredAt: at };
    bus.inbox[domainId] = [];
    bus.version++;
  }
  return bus.domains[domainId];
}

/**
 * Declare a peer link. Both domains must be registered and the link must name the latent
 * they both observe — the same commitment `divergence.relate` requires, for the same
 * reason: a link you cannot describe is a link you cannot be caught being wrong about.
 */
function link(bus, a, b, spec) {
  spec = spec || {};
  if (a === b) throw new Error('lateral: a domain cannot be its own peer: ' + a);
  if (!bus.domains[a] || !bus.domains[b]) {
    throw new Error('lateral: both domains must be registered before they can be linked (' + a + ', ' + b + ')');
  }
  if (!spec.latent) {
    throw new Error('lateral: link ' + a + '/' + b + ' must name the latent both domains observe — ' +
                    'an unnamed link is a broadcast subscription with a nicer word for it');
  }
  if (typeof spec.at !== 'number') throw new Error('lateral: link needs a caller-supplied `at`');
  var rec = { a: a, b: b, latent: spec.latent, why: spec.why || null, at: spec.at,
              bidirectional: spec.bidirectional !== false };
  bus.links.push(rec);
  bus.version++;
  return rec;
}

/** Peers of `from` under the declared links, respecting direction. */
function peersOf(bus, from) {
  var out = [];
  bus.links.forEach(function (l) {
    if (l.a === from) out.push({ to: l.b, link: l });
    else if (l.b === from && l.bidirectional) out.push({ to: l.a, link: l });
  });
  return out;
}

/**
 * PUBLISH an observation to declared peers.
 *
 * `msg.contributors` accumulates every domain the content passed through, and it is what
 * makes echo suppression possible. It is set here rather than trusted from the caller:
 * a sender that could edit its own contributor list could launder its signal back to
 * itself, which is the one thing this module exists to prevent.
 */
function publish(bus, from, observation, at, opts) {
  opts = opts || {};
  if (!bus.domains[from]) throw new Error('lateral: unregistered domain cannot publish: ' + from);
  if (typeof at !== 'number') throw new Error('lateral: publish needs a caller-supplied `at`');
  if (!observation || !observation.latent) {
    throw new Error('lateral: a published observation must name the latent it concerns');
  }
  if (typeof observation.precision !== 'number' || !isFinite(observation.precision) || observation.precision < 0) {
    throw new Error('lateral: a published observation must carry a finite non-negative precision — ' +
                    'a peer cannot weigh a claim that does not say how well it is known');
  }

  bus.metrics.published++;

  /**
   * ANCESTRY COMES FROM THE BUS'S OWN RECORD, KEYED BY THE ID THE BUS ISSUED.
   * `opts.inheritedFrom` is used for one thing only — to name which prior message this
   * relays — and every field on it other than that id is ignored.
   */
  var parent = opts.inheritedFrom || null;
  var inherited = [], hop = 0;
  if (parent) {
    var known = parent.id ? bus.lineage[parent.id] : null;
    if (!known) {
      /* A parent this bus never issued, or one whose ancestry has aged out. Either way
         its lineage is UNPROVABLE, and an unprovable ancestry must not be treated as an
         empty one — that is exactly the forgery being defended against. */
      bus.metrics.forgedParent++;
      return { published: false, from: from, delivered: [], refused: [{ to: '*',
        why: 'relayed message names a parent this bus did not issue (' + (parent.id || 'no id') + '), so its ' +
             'ancestry cannot be verified. An unverifiable lineage is refused, not assumed clean — accepting ' +
             'it is how a forged contributor list returns a signal to its own origin.' }],
        contributors: [], hop: 0 };
    }
    inherited = known;
    /* Hop also comes from the bus's record, via the parent's own stored depth. */
    hop = (typeof bus.lineageHop[parent.id] === 'number') ? bus.lineageHop[parent.id] + 1 : inherited.length;
  }
  var contributors = inherited.indexOf(from) >= 0 ? inherited.slice() : inherited.concat([from]);

  var allPeers = peersOf(bus, from);
  var targets = allPeers.filter(function (p) {
    /**
     * DECLARED LINKS ONLY, AND THE LATENT MUST MATCH.
     *
     * This read `!observation.latentScope || ...` until 2026-08-03. Nothing ever set
     * `latentScope`, so the second half never evaluated and the check was dead: an
     * observation about one latent crossed a link declared for a different one. That
     * makes the "name the latent" requirement decorative — the whole point of declaring
     * what two domains jointly observe is that traffic about anything else is not
     * covered by the declaration.
     */
    return !!p.link && p.link.latent === observation.latent;
  });
  var mismatched = allPeers.length - targets.length;
  if (mismatched > 0) bus.metrics.latentMismatch += mismatched;
  if (targets.length > bus.opts.maxFanout) {
    bus.metrics.fanoutTrimmed += targets.length - bus.opts.maxFanout;
    targets = targets.slice(0, bus.opts.maxFanout);
  }

  var delivered = [], refused = [];
  targets.forEach(function (p) {
    if (hop >= bus.opts.maxHops) {
      bus.metrics.hopExpired++;
      refused.push({ to: p.to, why: 'hop limit ' + bus.opts.maxHops + ' reached' });
      return;
    }
    /* ECHO SUPPRESSION. The receiver already contributed to this content, so accepting
       it would be counting its own signal as independent corroboration. */
    if (contributors.indexOf(p.to) >= 0) {
      bus.metrics.echoRefused++;
      refused.push({ to: p.to, why: 'ECHO: ' + p.to + ' already contributed to this content (' +
                                    contributors.join(' -> ') + ', from the bus own lineage record, not from the ' +
                                    'message); accepting it would count its own signal as independent evidence' });
      return;
    }
    if (p.to === from) { bus.metrics.selfPublish++; refused.push({ to: p.to, why: 'a domain cannot publish to itself' }); return; }

    /* The bus issues the id, and `seq` makes it unique even when two publishes share
       every other field. Deterministic: the counter advances with the call sequence, so
       a replay of the same calls produces the same ids. */
    var mid = 'lat_' + from + ':' + p.to + ':' + at + ':' + hop + ':' + observation.latent + ':' + (bus.seq++);
    var msg = {
      id: mid,
      from: from, to: p.to,
      latent: observation.latent,
      value: observation.value,
      /* DECAYED BY HOP. A second-hand report carries less weight than a first-hand one,
         and the decay is applied here so no consumer has to remember to apply it. */
      precision: observation.precision * Math.pow(bus.opts.hopDecay, hop),
      rawPrecision: observation.precision,
      hop: hop,
      contributors: contributors,
      at: at,
      /* PROVENANCE IS NOT LAUNDERED. This stays foreign for its whole life. Whether it
         may become the receiver's own evidence is the barrier's call, not this module's. */
      provenance: 'foreign',
      why: observation.why || null,
      ruleVersion: bus.ruleVersion
    };
    /* Ancestry recorded against the bus's own id BEFORE delivery, so a relay of this
       message can be verified no matter what the receiver does to its copy. */
    recordLineage(bus, mid, contributors);
    bus.lineageHop[mid] = hop;

    var box = bus.inbox[p.to];
    box.push(msg);
    while (box.length > bus.opts.inboxCap) box.shift();
    bus.metrics.delivered++;
    delivered.push(msg);
  });

  bus.version++;
  return { published: true, from: from, delivered: delivered, refused: refused, contributors: contributors, hop: hop };
}

/**
 * READ a domain's inbox, applying the influence cap against its OWN precision.
 *
 * The cap is applied at READ time, not at publish time, because only the receiver knows
 * its own precision. Messages beyond the cap are returned as `capped` rather than
 * dropped: a domain that is being told a great deal it cannot afford to weigh should be
 * able to see that, since it is a fact about how much corroboration exists.
 */
function receive(bus, to, ownPrecision, opts) {
  opts = opts || {};
  if (!bus.domains[to]) throw new Error('lateral: unregistered domain cannot receive: ' + to);
  var own = (typeof ownPrecision === 'number' && isFinite(ownPrecision) && ownPrecision > 0) ? ownPrecision : 0;
  var budget = own * bus.opts.influenceCap;

  /* Deterministic order: highest precision first, ties broken by id. Reading in arrival
     order would make the cap depend on delivery interleaving, so two replays of the same
     event log could admit different messages. */
  var sorted = (bus.inbox[to] || []).slice().sort(function (x, y) {
    if (y.precision !== x.precision) return y.precision - x.precision;
    return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0);
  });

  var admitted = [], capped = [], used = 0;
  sorted.forEach(function (m) {
    if (used + m.precision <= budget) { admitted.push(m); used += m.precision; }
    else { capped.push(m); }
  });
  if (capped.length) bus.metrics.capped += capped.length;

  return {
    admitted: admitted, capped: capped,
    ownPrecision: own, budget: budget, usedPrecision: used,
    why: own === 0
      ? 'this domain has measured nothing, so its peer budget is zero: ' + sorted.length +
        ' peer message(s) held. Corroboration cannot substitute for an instrument.'
      : admitted.length + ' of ' + sorted.length + ' peer message(s) admitted, using ' +
        used.toFixed(4) + ' of a ' + budget.toFixed(4) + ' budget (' +
        (bus.opts.influenceCap * 100) + '% of own precision ' + own.toFixed(4) + ')'
  };
}

/** Clear an inbox after consumption. Explicit, so a caller cannot double-count by re-reading. */
function drain(bus, to) {
  var n = (bus.inbox[to] || []).length;
  bus.inbox[to] = [];
  bus.version++;
  return { drained: n };
}

function report(bus) {
  var inboxes = Object.keys(bus.inbox).map(function (d) { return { domain: d, pending: bus.inbox[d].length }; });
  return {
    ruleVersion: bus.ruleVersion,
    domains: Object.keys(bus.domains).length,
    links: bus.links.length,
    inboxes: inboxes,
    metrics: Object.assign({}, bus.metrics),
    /* THE STANDING CAVEAT, carried in the report itself so a reader of runtime output
       cannot mistake an exercised mechanism for a satisfied row. */
    peerDomainsBound: Object.keys(bus.domains).length,
    satisfiesRow24: false,
    why: Object.keys(bus.domains).length < 2
      ? 'fewer than two domains are registered, so lateral connectivity is UNEXERCISED — the mechanism exists and nothing has used it'
      : 'mechanism exercised across ' + Object.keys(bus.domains).length + ' registered domain(s), but row 24 asks for ' +
        'peer DOMAINS informing each other. Synthetic peers test that the mechanism is well-formed, not that ' +
        'real domains inform each other usefully; only real second-domain observations can settle that.'
  };
}

function serialize(bus) {
  return { ruleVersion: bus.ruleVersion, opts: bus.opts, domains: bus.domains,
           links: bus.links, inbox: bus.inbox, metrics: bus.metrics,
           /* Lineage is the echo defence. A restart that dropped it would make every
              in-flight message unverifiable, and every relay across the restart boundary
              would be refused — or, worse under the old design, silently trusted. */
           lineage: bus.lineage, lineageOrder: bus.lineageOrder, lineageHop: bus.lineageHop,
           seq: bus.seq, version: bus.version };
}
function deserialize(o) {
  var b = createBus((o && o.opts) || {});
  if (o) {
    b.ruleVersion = o.ruleVersion || RULE_VERSION;
    b.domains = o.domains || Object.create(null);
    b.links = o.links || [];
    b.inbox = o.inbox || Object.create(null);
    b.lineage = o.lineage || Object.create(null);
    b.lineageOrder = o.lineageOrder || [];
    b.lineageHop = o.lineageHop || Object.create(null);
    b.seq = o.seq || 0;
    b.metrics = Object.assign(b.metrics, o.metrics || {});
    b.version = o.version || 0;
  }
  return b;
}

module.exports = {
  RULE_VERSION: RULE_VERSION,
  DEFAULTS: DEFAULTS,
  createBus: createBus,
  register: register,
  link: link,
  peersOf: peersOf,
  publish: publish,
  receive: receive,
  drain: drain,
  report: report,
  serialize: serialize,
  deserialize: deserialize
};
