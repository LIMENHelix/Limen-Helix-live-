/**
 * brain-v2/test/lateral.js — SPEC row 24. Synthetic and adversarial only.
 *
 *   node brain-v2/test/lateral.js
 *
 * EVERY PEER IN THIS FILE IS SYNTHETIC AND THAT IS STATED, NOT HIDDEN. These tests can
 * establish that the mechanism is well-formed — it terminates, refuses echoes, bounds
 * influence, survives restart, replays identically. They cannot establish that peer
 * domains inform each other usefully, because there is only one bound domain. Row 24
 * stays NOT COMPLETE and the report() call carries `satisfiesRow24: false` so runtime
 * output says the same thing.
 *
 * The adversarial cases are the point. A lateral bus that merely delivers is trivial;
 * the failure modes worth engineering against are mutual confirmation, a chorus of weak
 * peers outvoting a measurement, and cycles that never terminate.
 */

'use strict';

var L = require('../kernel/lateral.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var T0 = 1e12;

/** A bus with n synthetic domains registered, fully labelled as synthetic. */
function bus(names, opts) {
  var b = L.createBus(opts);
  names.forEach(function (n) { L.register(b, n, T0); });
  return b;
}
function obs(latent, value, precision) {
  return { latent: latent, value: value, precision: precision, why: 'synthetic test observation' };
}

console.log('');
console.log('=== LATERAL: BOUNDED PEER CONNECTIVITY (SPEC row 24) ===');
console.log('    ALL PEERS SYNTHETIC. This file cannot satisfy row 24 and does not claim to.');
console.log('');

// ── L1: declaration discipline ───────────────────────────────────────────────
(function () {
  console.log('L1: a link must be declared and must name what both domains observe');
  var b = bus(['energy', 'weather']);

  var threw = false;
  try { L.link(b, 'energy', 'weather', { at: T0 }); } catch (e) { threw = /must name the latent/.test(e.message); }
  assert('a link with no stated latent is refused', threw);

  threw = false;
  try { L.link(b, 'energy', 'finance', { at: T0, latent: 'x' }); } catch (e) { threw = /must be registered/.test(e.message); }
  assert('a link to an unregistered domain is refused', threw);

  threw = false;
  try { L.link(b, 'energy', 'energy', { at: T0, latent: 'x' }); } catch (e) { threw = /cannot be its own peer/.test(e.message); }
  assert('a domain cannot be its own peer', threw);

  L.link(b, 'energy', 'weather', { at: T0, latent: 'regional demand shock' });
  var r = L.publish(b, 'energy', obs('regional demand shock', 1.0, 2.0), T0 + 1);
  assert('a declared link delivers', r.delivered.length === 1 && r.delivered[0].to === 'weather');

  /* An undeclared pair is not silently reachable. */
  L.register(b, 'shipping', T0);
  var r2 = L.publish(b, 'energy', obs('regional demand shock', 1.0, 2.0), T0 + 2);
  assert('an unlinked registered domain receives nothing',
    r2.delivered.every(function (m) { return m.to !== 'shipping'; }));
})();

// ── L2: THE ONE THAT MATTERS. Echo suppression ───────────────────────────────
(function () {
  console.log('L2 [adversarial]: a domain cannot receive its own signal back as corroboration');
  var b = bus(['a', 'b']);
  L.link(b, 'a', 'b', { at: T0, latent: 'shared shock' });

  var out = L.publish(b, 'a', obs('shared shock', 1.0, 4.0), T0 + 1);
  assert('a reaches b', out.delivered.length === 1);
  var received = out.delivered[0];
  assert('and the message names its contributor chain', received.contributors.join() === 'a', received.contributors.join());

  /* b now relays what it heard. Without echo suppression this lands back on a, and a
     would count its OWN signal as an independent second opinion. */
  var back = L.publish(b, 'b', obs('shared shock', 1.0, 4.0), T0 + 2, { inheritedFrom: received });
  assert('the relay reaches nobody', back.delivered.length === 0, JSON.stringify(back.delivered));
  assert('and it is refused as an ECHO, naming the chain',
    back.refused.length === 1 && /ECHO/.test(back.refused[0].why) && /a -> b/.test(back.refused[0].why),
    JSON.stringify(back.refused));
  assert('the bus counts it', b.metrics.echoRefused === 1, String(b.metrics.echoRefused));

  /* A THIRD party may still hear it — the suppression is about the originator, not about
     forbidding relays outright, or a peer network would be reduced to one hop. */
  var c = bus(['a', 'b', 'c']);
  L.link(c, 'a', 'b', { at: T0, latent: 's' });
  L.link(c, 'b', 'c', { at: T0, latent: 's' });
  var first = L.publish(c, 'a', obs('s', 1.0, 4.0), T0 + 1).delivered[0];
  var relay = L.publish(c, 'b', obs('s', 1.0, 4.0), T0 + 2, { inheritedFrom: first });
  var toC = relay.delivered.filter(function (m) { return m.to === 'c'; });
  assert('c, which contributed nothing, does receive the relay', toC.length === 1);
  assert('a, which originated it, does not', relay.delivered.every(function (m) { return m.to !== 'a'; }));
  assert('and the relay carries the whole chain', toC[0].contributors.join() === 'a,b', toC[0].contributors.join());
})();

// ── L3: THE FORGERY TEST. This one asserted the hole existed, and passed. ────
(function () {
  console.log('L3 [adversarial]: a forged contributor list cannot return an echo to its origin');
  var b = bus(['a', 'b']);
  L.link(b, 'a', 'b', { at: T0, latent: 's' });
  var m = L.publish(b, 'a', obs('s', 1.0, 4.0), T0 + 1).delivered[0];

  /**
   * THE ATTACK. A compromised or buggy peer relays the message with the contributor list
   * emptied, so nothing on the object says `a` was ever involved.
   *
   * The first version of this test asserted that the forged relay REACHED `a` and called
   * that a pass, on the reasoning that b could not erase itself. That was a test written
   * to match the implementation instead of the requirement: reaching `a` at all IS the
   * echo, and `a` counting it would be exactly the mutual confirmation the whole module
   * exists to prevent. Lineage is now owned by the bus and keyed by the id the bus
   * issued, so the forged copy is simply not consulted.
   */
  var forged = Object.assign({}, m, { contributors: [] });
  var back = L.publish(b, 'b', obs('s', 1.0, 4.0), T0 + 2, { inheritedFrom: forged });
  assert('the forged relay reaches NOBODY', back.delivered.length === 0, JSON.stringify(back.delivered));
  assert('and above all it does not reach a, the originator',
    back.delivered.every(function (x) { return x.to !== 'a'; }));
  assert('refused as an echo, from the bus own record rather than the message',
    back.refused.some(function (r) { return /ECHO/.test(r.why) && /bus own lineage/.test(r.why); }),
    JSON.stringify(back.refused));

  /* Editing the id as well is not a way round it either: an id the bus never issued has
     no provable ancestry, and unprovable is refused rather than assumed clean. */
  var renamed = Object.assign({}, m, { contributors: [], id: 'lat_forged:whatever:0:0:s:0' });
  var r2 = L.publish(b, 'b', obs('s', 1.0, 4.0), T0 + 3, { inheritedFrom: renamed });
  assert('a parent id the bus never issued is refused outright',
    r2.published === false && /did not issue/.test(r2.refused[0].why), JSON.stringify(r2.refused));
  assert('and the bus counts the attempt', b.metrics.forgedParent === 1, String(b.metrics.forgedParent));

  /* The honest relay still works — the defence is against forgery, not against relaying. */
  var c = bus(['a', 'b', 'c']);
  L.link(c, 'a', 'b', { at: T0, latent: 's' });
  L.link(c, 'b', 'c', { at: T0, latent: 's' });
  var first = L.publish(c, 'a', obs('s', 1.0, 4.0), T0 + 1).delivered[0];
  var honest = L.publish(c, 'b', obs('s', 1.0, 4.0), T0 + 2, { inheritedFrom: first });
  assert('an honest relay to an uninvolved third party still passes',
    honest.delivered.length === 1 && honest.delivered[0].to === 'c');
  assert('carrying the bus-verified chain', honest.delivered[0].contributors.join() === 'a,b',
    honest.delivered[0].contributors.join());
  assert('and a delivered message is still labelled foreign', honest.delivered[0].provenance === 'foreign');
})();

// ── L3b: the declared latent actually gates delivery ─────────────────────────
(function () {
  console.log('L3b [adversarial]: an observation cannot cross a link declared for a different latent');
  var b = bus(['a', 'b', 'c']);
  L.link(b, 'a', 'b', { at: T0, latent: 'grid stress' });
  L.link(b, 'a', 'c', { at: T0, latent: 'fuel price' });

  /* The latent check was dead until 2026-08-03: it was guarded on an `observation
     .latentScope` flag nothing ever set, so the second half never evaluated and traffic
     about ANY latent crossed EVERY link. That reduces "name what both domains observe"
     to decoration — the declaration exists precisely so that traffic outside it is not
     covered. */
  var r = L.publish(b, 'a', obs('grid stress', 1.0, 2.0), T0 + 1);
  assert('an observation reaches only the link declared for its latent',
    r.delivered.length === 1 && r.delivered[0].to === 'b',
    r.delivered.map(function (m) { return m.to; }).join());
  assert('the mismatched link is counted, not silently skipped', b.metrics.latentMismatch === 1,
    String(b.metrics.latentMismatch));

  var r2 = L.publish(b, 'a', obs('fuel price', 1.0, 2.0), T0 + 2);
  assert('and the other latent reaches only its own link',
    r2.delivered.length === 1 && r2.delivered[0].to === 'c',
    r2.delivered.map(function (m) { return m.to; }).join());

  var r3 = L.publish(b, 'a', obs('something nobody declared', 1.0, 2.0), T0 + 3);
  assert('an undeclared latent reaches nobody at all', r3.delivered.length === 0,
    JSON.stringify(r3.delivered));
})();

// ── L4: the influence cap ────────────────────────────────────────────────────
(function () {
  console.log('L4 [adversarial]: a chorus of peers cannot outvote an instrument');
  var names = ['self', 'p1', 'p2', 'p3', 'p4'];
  var b = bus(names, { maxFanout: 8 });
  ['p1', 'p2', 'p3', 'p4'].forEach(function (p) { L.link(b, p, 'self', { at: T0, latent: 's' }); });

  ['p1', 'p2', 'p3', 'p4'].forEach(function (p, i) {
    L.publish(b, p, obs('s', 1.0, 3.0), T0 + i + 1);
  });
  assert('four peers delivered', b.inbox.self.length === 4, String(b.inbox.self.length));

  var r = L.receive(b, 'self', 2.0);        // own precision 2.0, cap 0.5 -> budget 1.0
  assert('total admitted foreign precision cannot exceed the budget',
    r.usedPrecision <= r.budget + 1e-12, r.usedPrecision + ' > ' + r.budget);
  assert('so most of the chorus is held, not admitted', r.capped.length > 0, JSON.stringify(r.capped.length));
  assert('and the receiver is told how much it is being told', /of a .* budget/.test(r.why), r.why);

  /* THE CASE THAT MATTERS MOST: a domain with no measurements of its own. */
  var blind = L.receive(b, 'self', 0);
  assert('a domain that has measured nothing admits NOTHING from peers',
    blind.admitted.length === 0 && blind.budget === 0, JSON.stringify(blind.admitted.length));
  assert('and says why, rather than reporting quiet agreement',
    /measured nothing/.test(blind.why) && /cannot substitute/.test(blind.why), blind.why);
})();

// ── L5: hop bound and cycles ─────────────────────────────────────────────────
(function () {
  console.log('L5 [adversarial]: a cyclic peer graph terminates');
  var b = bus(['a', 'b', 'c'], { maxHops: 2 });
  L.link(b, 'a', 'b', { at: T0, latent: 's' });
  L.link(b, 'b', 'c', { at: T0, latent: 's' });
  L.link(b, 'c', 'a', { at: T0, latent: 's' });     // the cycle is CLOSED on purpose

  var hops = 0, cur = L.publish(b, 'a', obs('s', 1.0, 8.0), T0 + 1).delivered[0];
  var guard = 0;
  while (cur && guard++ < 50) {
    var next = L.publish(b, cur.to, obs('s', 1.0, 8.0), T0 + 10 + guard, { inheritedFrom: cur });
    if (!next.delivered.length) break;
    cur = next.delivered[0];
    hops++;
  }
  assert('propagation terminates rather than circulating', guard < 50, 'guard ' + guard);
  assert('and it stops at the declared hop bound or on the echo, whichever comes first',
    hops <= b.opts.maxHops, hops + ' hops with maxHops ' + b.opts.maxHops);
  assert('precision decays with distance, so second-hand is worth less than first-hand',
    b.opts.hopDecay < 1);
})();

// ── L6: peers carry evidence, never commands ─────────────────────────────────
(function () {
  console.log('L6: the API has no verb that lets one domain change another');
  var api = Object.keys(L).filter(function (k) { return typeof L[k] === 'function'; });
  var mutating = api.filter(function (k) { return /^(set|write|force|apply|command|actuate|override)/.test(k); });
  assert('no set/write/force/actuate/override entry point exists', mutating.length === 0, mutating.join(','));

  var b = bus(['a', 'b']);
  L.link(b, 'a', 'b', { at: T0, latent: 's' });
  var threw = false;
  try { L.publish(b, 'a', { latent: 's', value: 1 }, T0 + 1); } catch (e) { threw = /precision/.test(e.message); }
  assert('an observation with no precision is refused — a peer cannot weigh an unquantified claim', threw);

  threw = false;
  try { L.publish(b, 'a', { value: 1, precision: 1 }, T0 + 1); } catch (e) { threw = /must name the latent/.test(e.message); }
  assert('an observation with no latent is refused', threw);

  var m = L.publish(b, 'a', obs('s', 1, 1), T0 + 1).delivered[0];
  assert('a delivered message stays labelled foreign', m.provenance === 'foreign');
})();

// ── L7: determinism, restart, and the standing caveat ────────────────────────
(function () {
  console.log('L7: deterministic, restartable, and honest about what it has NOT shown');
  function build() {
    var b = bus(['a', 'b', 'c'], { maxFanout: 8 });
    L.link(b, 'a', 'b', { at: T0, latent: 's' });
    L.link(b, 'a', 'c', { at: T0, latent: 's' });
    for (var i = 0; i < 6; i++) L.publish(b, 'a', obs('s', i, 1 + i), T0 + i);
    return b;
  }
  var x = build(), y = build();
  assert('two identical runs produce identical buses',
    JSON.stringify(L.serialize(x)) === JSON.stringify(L.serialize(y)));

  var back = L.deserialize(L.serialize(x));
  assert('serialize/restore round-trips exactly',
    JSON.stringify(L.serialize(back)) === JSON.stringify(L.serialize(x)));

  /* Read order must not depend on delivery interleaving, or a replay could admit a
     different set under the same cap. */
  var r1 = L.receive(x, 'b', 10), r2 = L.receive(back, 'b', 10);
  assert('receive() is order-stable across a restart',
    r1.admitted.map(function (m) { return m.id; }).join() === r2.admitted.map(function (m) { return m.id; }).join());

  var rep = L.report(x);
  assert('report() states row 24 is NOT satisfied', rep.satisfiesRow24 === false);
  assert('and says a synthetic peer cannot settle it',
    /Synthetic peers|UNEXERCISED/.test(rep.why), rep.why);

  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'kernel', 'lateral.js'), 'utf8');
  assert('the module reads no clock and no random source',
    !/Date\.now\(|Math\.random\(|new Date\(\)/.test(src));
})();

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('NOT PROVEN BY THIS FILE: that peer domains inform each other usefully. Every peer');
console.log('above is synthetic. Row 24 needs a real second domain with its own observations.');
console.log('');
process.exit(failures ? 1 : 0);
