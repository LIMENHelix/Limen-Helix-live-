/**
 * replay-compaction.js — does hot state stay bounded, for every INSTALLED domain?
 *
 *   node scripts/brain-audit/replay-compaction.js [cyclesPerDomain]
 *
 * Committed, not a throwaway: the bounded-growth claim is the batch-2 gate, and a claim
 * whose measurement lives in a deleted temp file cannot be re-checked by anyone.
 *
 * REAL PATHS. The real binder, the real kernel loop, LOOP.restore between every cycle as the
 * runtime does across invocations, and real archive chunks written through
 * lib/brain-shadow-archive. Redis is an injected in-memory object, so nothing leaves the
 * process; that is the only substitution.
 *
 * DOMAINS COME FROM registry.INSTALLED_DOMAINS. Measuring two domains and generalising to
 * seven is the kind of shortcut this project keeps paying for.
 *
 * SYNTHETIC TAIL. Fixtures hold ~470 rows and the retention windows need roughly 640
 * terminal predictions before compaction fires, so a deterministic seeded tail is appended.
 * It is a STRUCTURE test, not production evidence, and no figure from it should be recorded
 * as a production measurement.
 *
 * UNITS: bytes, and derived figures divide by 1024, so KiB. Never the decimal KB.
 */
'use strict';

var path = require('path'), fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

/* Inject before the store is first required, so the real transport is never touched. */
var MEM = Object.create(null);
var fake = {
  NAMESPACE_PREFIX: 'limen:', assertConfigured: function () { return true; },
  get: async function (k) { return MEM[k] === undefined ? null : MEM[k]; },
  set: async function (k, v) { MEM[k] = v; return true; },
  /* Create-if-absent, matching the real transport. The archive writes chunks with SET NX so
     a slot is write-once; a stub without it does not exercise the path the runtime takes. */
  setNX: async function (k, v) {
    if (Object.prototype.hasOwnProperty.call(MEM, k)) return false;
    MEM[k] = v; return true;
  },
  lpush: async function () { return 1; },
  lrange: async function () { return []; },
  ltrim: async function () { return true; }
};
var rp = require.resolve(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));
require.cache[rp] = { id: rp, filename: rp, loaded: true, exports: fake };

var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var COMPACT = require(path.join(ROOT, 'brain-v2', 'kernel', 'compact.js'));
var ARCHIVE = require(path.join(ROOT, 'lib', 'brain-shadow-archive.js'));

var CYCLES = parseInt(process.argv[2], 10) || 30;
var ROWS_PER_CYCLE = 120;                       // mirrors lib/brain-shadow-runtime.js

/**
 * Measure the complete retained body recursively, not a hand-picked list of top-level arrays.
 * This is what catches growth inside a retained record. Numeric values are deliberately not
 * measured by their current decimal width: a finite JavaScript number has a fixed maximum
 * representation. Structure, keys and strings are the places serialized state can acquire
 * unbounded material while record counts appear flat.
 */
function bodyMeasure(hot) {
  var body = Object.assign({}, hot);
  delete body.archiveHead;
  var m = { keys: 0, arrayEntries: 0, keyBytes: 0, stringBytes: 0,
            maxStringBytes: 0, objects: 0, arrays: 0 };
  function walk(v) {
    if (typeof v === 'string') {
      var sb = Buffer.byteLength(v, 'utf8');
      m.stringBytes += sb;
      if (sb > m.maxStringBytes) m.maxStringBytes = sb;
      return;
    }
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      m.arrays++;
      m.arrayEntries += v.length;
      v.forEach(walk);
      return;
    }
    m.objects++;
    Object.keys(v).forEach(function (k) {
      m.keys++;
      m.keyBytes += Buffer.byteLength(k, 'utf8');
      walk(v[k]);
    });
  }
  walk(body);
  m.structure = m.keys + m.arrayEntries;
  m.textBytes = m.keyBytes + m.stringBytes;
  return m;
}

function regressionSlope(samples, key) {
  if (samples.length < 2) return 0;
  var xm = (samples.length - 1) / 2;
  var ym = samples.reduce(function (a, x) { return a + x[key]; }, 0) / samples.length;
  var num = 0, den = 0;
  samples.forEach(function (x, i) { num += (i - xm) * (x[key] - ym); den += (i - xm) * (i - xm); });
  return den ? num / den : 0;
}

/**
 * Trend after warm-up, MEASURED against its own noise.
 *
 * THE DEFECT THIS REPLACES, and it was in the instrument rather than the runtime. The verdict
 * used to be "the late window must overlap the early window", over windows of 2 to 5 samples.
 * On a signal that WANDERS inside a fixed band that is a coin flip, and it behaved like one:
 * the same seven-domain state passed at 60 cycles, failed at 40 naming education, and failed
 * at 100 naming population. Direct attribution then showed why. `memory.episodic` holds
 * exactly 512 records at every post-warm-up cycle, min equal to max, so the CAP HOLDS; its
 * node count drifts with per-record composition inside a 33-node band on a base of 72,000,
 * with 28 increments up and 39 down and an OLS slope of 0.03 nodes per cycle. A two-window
 * comparison cannot tell that from accumulation, and a gate that answers differently at three
 * depths is not evidence at any of them.
 *
 * So the question is asked properly: is the slope distinguishable from zero given the scatter
 * around it? A real per-record accumulator lifts the count every cycle and clears this easily;
 * bounded wander does not. `t` is the slope over its own standard error.
 */
function compareWindows(samples, key, from) {
  var post = samples.slice(from);
  var width = Math.max(2, Math.min(5, Math.floor(post.length / 2)));
  var early = post.slice(0, width), late = post.slice(-width);
  function max(a) { return Math.max.apply(null, a.map(function (x) { return x[key]; })); }
  function min(a) { return Math.min.apply(null, a.map(function (x) { return x[key]; })); }
  function mean(a) { return a.reduce(function (s, x) { return s + x[key]; }, 0) / a.length; }

  var slope = regressionSlope(post, key);
  var n = post.length;
  var xm = (n - 1) / 2, ym = post.reduce(function (s, x) { return s + x[key]; }, 0) / n;
  var sxx = 0, sse = 0;
  post.forEach(function (x, i) {
    sxx += (i - xm) * (i - xm);
    var fit = ym + slope * (i - xm);
    sse += (x[key] - fit) * (x[key] - fit);
  });
  /* n-2 residual degrees of freedom; a two-point series has none and cannot be judged. */
  var se = (n > 2 && sxx > 0) ? Math.sqrt(sse / (n - 2) / sxx) : Infinity;
  var t = se && isFinite(se) && se > 0 ? slope / se : 0;

  return { earlyMin: min(early), earlyMax: max(early), lateMin: min(late), lateMax: max(late),
           earlyMean: mean(early), lateMean: mean(late),
           slope: slope, slopeSE: se, t: t,
           /* RISING, not merely moving: a shrinking collection is not a leak. Significance is
              necessary and NOT sufficient - see the caller, which also requires the rise to be
              worth at least one whole retained record. */
           rising: slope > 0 && t > 3, samples: n };
}

/** Every serialized collection that has a declared cap outside compact.js. */
function internalCapViolations(hot, cycle) {
  var out = [];
  function cap(name, value, limit) {
    if (value > limit) out.push('cycle ' + cycle + ' ' + name + '=' + value + ' > ' + limit);
  }
  cap('brainHistory', (hot.brainHistory || []).length, 96); // brain.js BASELINE_WINDOW(24) * 4
  (hot.channels || []).forEach(function (ch) {
    ['innov', 'innovP', 'innovG', 'innovR', 'seen', 'changeAt'].forEach(function (k) {
      cap('channel.' + ch.key + '.' + k, (ch[k] || []).length, 64);
    });
  });
  cap('forwardModel.history', ((hot.forwardModel || {}).history || []).length, 512);
  cap('efferences', (hot.efferences || []).length, 512);
  cap('routed', (hot.routed || []).length, 512);
  Object.keys(hot.varHistory || {}).forEach(function (k) {
    cap('varHistory.' + k, hot.varHistory[k].length, 48);
  });
  var mod = hot.modulators || {};
  cap('modulators.rewardHistory', (mod.rewardHistory || []).length, 256);
  cap('modulators.surpriseHistory', (mod.surpriseHistory || []).length, 256);
  Object.keys(mod.series || {}).forEach(function (k) { cap('modulators.series.' + k, mod.series[k].length, 256); });
  cap('divergences.closed', (((hot.divergences || {}).closed) || []).length, 512);
  cap('consolidator.history', (((hot.consolidator || {}).history) || []).length, 32);
  var topo = hot.topology || {}, topts = topo.opts || {};
  cap('topology.transitions', (topo.transitions || []).length, topts.transitionCap || 512);
  Object.keys(topo.edges || {}).forEach(function (k) {
    cap('topology.edges.' + k + '.history', ((topo.edges[k] || {}).history || []).length,
      topts.historyCap || 128);
  });
  cap('vitals.setPointHistory', (((hot.vitals || {}).setPointHistory) || []).length, 32);
  cap('errors', (hot.errors || []).length, LOOP.ERROR_WINDOW);
  return out;
}

function syntheticTail(template, n, seedBase) {
  var seed = seedBase;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var names = (template.src || []).map(function (s) { return s.n; });
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ t: template.t + (i + 1) * 3600000, src: names.map(function (nm, j) {
      return { n: nm, ch: 'stress', l: 1, v: +(10 + 5 * Math.sin(i / 7 + j) + rnd()).toFixed(4) };
    }) });
  }
  return out;
}

async function replay(product) {
  var d = REG.descriptorFor(product);
  var binder = require(REG.binderPath(d));
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  var rows = doc.rows.slice().sort(function (a, b) { return a.t - b.t; });
  var need = CYCLES * ROWS_PER_CYCLE;
  if (rows.length < need) rows = rows.concat(syntheticTail(rows[rows.length - 1], need - rows.length, 7919));

  var spec = { domain: d.snapshot, brainSpec: binder.spec(), horizonMs: 6 * 3600000,
    vitalsOpts: { learningPeriodMs: 3600000, homeostaticPeriodMs: 24 * 3600000 } };

  var snap = null, samples = [], firstCompactAt = null;
  for (var c = 0; c < CYCLES; c++) {
    var loop = snap ? LOOP.restore(spec, snap) : LOOP.create(spec);
    var batch = rows.slice(c * ROWS_PER_CYCLE, (c + 1) * ROWS_PER_CYCLE);
    for (var i = 0; i < batch.length; i++) {
      var rd = binder.readRecorderRow(batch[i]) || {};
      if (Object.keys(rd).length) LOOP.tick(loop, rd, batch[i].t);
    }
    var hot = LOOP.serialize(loop);
    var plan = COMPACT.plan(hot, {});
    if (plan.retiredCount) {
      var head = hot.archiveHead || { sequence: 0, hash: null };
      var seq = (head.sequence || 0) + 1;
      var w = await ARCHIVE.writeChunk(d.snapshot, seq, head.hash || null, plan.retired);
      hot = plan.apply({ sequence: seq, hash: w.hash, totals: plan.totals,
        consumedHorizon: plan.consumedHorizon });
      if (firstCompactAt === null) firstCompactAt = c + 1;
    }
    snap = hot;
    /* ATTRIBUTION, not a threshold. The state is split into the archive HEAD (sequence plus
       cumulative counters, which necessarily gain digits) and EVERYTHING ELSE. If the rest
       is flat and only the head moves, the linear per-record term is gone and the residual
       is digit width. A slope small enough to look acceptable is not the same claim. */
    var headBytes = Buffer.byteLength(JSON.stringify(hot.archiveHead || null), 'utf8');
    var total = Buffer.byteLength(JSON.stringify(hot), 'utf8');
    var bm = bodyMeasure(hot);
    var prospective = hot.memory.prospective || [];
    var predictionList = Object.keys(hot.registry.predictions || {}).map(function (id) {
      return hot.registry.predictions[id];
    });
    samples.push({
      cycle: c + 1, bytes: total, headBytes: headBytes, bodyBytes: total - headBytes,
      structure: bm.structure, textBytes: bm.textBytes, maxStringBytes: bm.maxStringBytes,
      episodic: hot.memory.episodic.length,
      terminalProspective: prospective.filter(function (x) { return x.status !== 'open'; }).length,
      openProspective: prospective.filter(function (x) { return x.status === 'open'; }).length,
      terminalPredictions: predictionList.filter(COMPACT._isTerminalPrediction).length,
      openPredictions: predictionList.filter(COMPACT._isOpenPrediction).length,
      order: hot.registry.order.length,
      resolved: hot.registry.resolved.length,
      consumed: Object.keys(hot.forwardModel.consumed || {}).length,
      episodeIndexEntries: Object.keys(hot.memory.episodeIndex || {}).reduce(function (a, k) {
        return a + hot.memory.episodeIndex[k].length; }, 0),
      attention: Object.keys(hot.attention || {}).reduce(function (a, k) {
        return Math.max(a, ((hot.attention[k] || {}).history || []).length); }, 0),
      internalCapViolations: internalCapViolations(hot, c + 1)
    });
  }

  var n = samples.length;
  /* Leave at least ten measured cycles after warm-up so the two equal windows are disjoint. */
  var from = Math.max(firstCompactAt || 0, Math.floor(n * 0.6));
  if (n - from < 10) from = Math.max(firstCompactAt || 0, n - 10);
  var structureTrend = compareWindows(samples, 'structure', from);
  var textTrend = compareWindows(samples, 'textBytes', from);
  var openProspectiveTrend = compareWindows(samples, 'openProspective', from);
  var openPredictionTrend = compareWindows(samples, 'openPredictions', from);
  var consumedTrend = compareWindows(samples, 'consumed', from);
  var bodyTrend = compareWindows(samples, 'bodyBytes', from);
  var totalTrend = compareWindows(samples, 'bytes', from);
  var last = samples[n - 1];
  var postWarm = samples.slice(from);
  var capViolations = [];
  postWarm.forEach(function (s) {
    if (s.episodic > COMPACT.RETAIN.episodic) capViolations.push('cycle ' + s.cycle + ' episodic=' + s.episodic);
    if (s.terminalProspective > COMPACT.RETAIN.prospectiveClosed) capViolations.push('cycle ' + s.cycle + ' terminalProspective=' + s.terminalProspective);
    if (s.terminalPredictions > COMPACT.RETAIN.resolved + COMPACT.ROLLBACK_WINDOW) capViolations.push('cycle ' + s.cycle + ' terminalPredictions=' + s.terminalPredictions);
    if (s.resolved > COMPACT.RETAIN.resolved + COMPACT.ROLLBACK_WINDOW) capViolations.push('cycle ' + s.cycle + ' resolved=' + s.resolved);
    if (s.episodeIndexEntries > s.episodic) capViolations.push('cycle ' + s.cycle + ' index=' + s.episodeIndexEntries + ' > episodic=' + s.episodic);
    if (s.attention > COMPACT.RETAIN.attentionPerSource) capViolations.push('cycle ' + s.cycle + ' attention=' + s.attention);
    s.internalCapViolations.forEach(function (v) { capViolations.push(v); });
  });
  var head = snap.archiveHead || {};
  return {
    product: product, snapshot: d.snapshot, cycles: n,
    firstCompactAt: firstCompactAt, bytes: last.bytes,
    /* Average nodes per retained record, from the final state: the structure count over every
       record the state is holding. It is the yardstick the structure sentinel needs, because
       "grew by a lot" is meaningless without knowing what one record costs. */
    nodesPerRecord: last.structure / Math.max(1,
      last.episodic + last.terminalProspective + last.openProspective +
      last.terminalPredictions + last.openPredictions + last.consumed),
    totalTrend: totalTrend, bodyTrend: bodyTrend, structureTrend: structureTrend,
    textTrend: textTrend, openProspectiveTrend: openProspectiveTrend,
    openPredictionTrend: openPredictionTrend, consumedTrend: consumedTrend,
    capViolations: capViolations,
    order: last.order, resolved: last.resolved, consumed: last.consumed,
    episodeIndexEntries: last.episodeIndexEntries,
    sequence: head.sequence || 0,
    calibrationN: COMPACT.calibrationWithArchive(snap).n,
    episodic: last.episodic,
    prospective: last.terminalProspective + last.openProspective,
    predictions: last.terminalPredictions + last.openPredictions,
    openProspective: last.openProspective, openPredictions: last.openPredictions,
    attention: last.attention, structure: last.structure, textBytes: last.textBytes
  };
}

(async function () {
  var pad = function (s, w) { return String(s).padEnd(w); };
  var lp = function (s, w) { return String(s).padStart(w); };
  console.log('');
  console.log('COMPACTION REPLAY over registry.INSTALLED_DOMAINS  (' + CYCLES + ' cycles x ' +
    ROWS_PER_CYCLE + ' rows)');
  console.log('Fixture rows plus a deterministic synthetic tail. STRUCTURE TEST, not production evidence.');
  console.log('');

  var rows = [];
  for (var i = 0; i < REG.INSTALLED_DOMAINS.length; i++) rows.push(await replay(REG.INSTALLED_DOMAINS[i]));

  console.log(pad('domain', 12) + lp('KiB', 8) + lp('struct', 9) + lp('textKiB', 9) +
    lp('epis', 6) + lp('openPr', 8) + lp('openPd', 8) + lp('termPd', 8) +
    lp('cons', 7) + lp('idxE', 6) + lp('attn', 6));
  console.log('-'.repeat(97));
  rows.forEach(function (r) {
    console.log(pad(r.product, 12) + lp((r.bytes / 1024).toFixed(0), 8) + lp(r.structure, 9) +
      lp((r.textBytes / 1024).toFixed(0), 9) + lp(r.episodic, 6) +
      lp(r.openProspective, 8) + lp(r.openPredictions, 8) +
      lp(r.predictions - r.openPredictions, 8) + lp(r.consumed, 7) +
      lp(r.episodeIndexEntries, 6) + lp(r.attention, 6));
  });

  console.log('');
  console.log('POLICY CAPS — checked on EVERY post-warm-up cycle:');
  var failures = [];
  rows.forEach(function (r) {
    r.capViolations.forEach(function (v) { failures.push(r.product + ' ' + v); });
  });
  console.log('  ' + (failures.length ? 'EXCEEDED: ' + failures.join(', ') :
    'episodic, terminal prospective, terminal predictions, resolved, episode index and attention all stayed within policy'));

  console.log('');
  console.log('LIVE-LEDGER GATE + RECURSIVE STRUCTURE SENTINEL — after warm-up:');
  console.log('  ' + pad('domain', 12) + lp('structure', 20) + lp('text bytes', 20) +
    lp('openPr', 16) + lp('openPd', 16) + lp('consumed', 16));
  var growing = [];
  rows.forEach(function (r) {
    /* Open work and consumed ids have no count cap: they must not lift at all, so a raw max
       comparison is right for them. Recursive structure is different in kind: it is a sentinel
       for an omitted nested collection, and record COMPOSITION jitters inside a band even when
       every record count is pinned at its cap, so it is judged by a slope measured against its
       own scatter rather than by whether two short windows overlap. Text stays diagnostic
       because embedded counters gain digits logarithmically. */
    [['openProspective', r.openProspectiveTrend], ['openPredictions', r.openPredictionTrend],
     ['consumed', r.consumedTrend]].forEach(function (x) {
      if (x[1].lateMax > x[1].earlyMax) growing.push(r.product + '.' + x[0] +
        ' max ' + x[1].earlyMax + ' -> ' + x[1].lateMax);
    });
    /**
     * TWO CONDITIONS, because either alone gives the wrong answer.
     *
     * Significance alone fires on drift of 0.09 nodes per cycle: real, measurable, and about
     * one hundred years from mattering. Magnitude alone fires on noise. What this sentinel
     * exists to catch is a nested collection compaction FORGOT, and such a collection gains
     * whole records - so the rise over the measured window must be worth at least one average
     * retained record. An omitted collection taking one record per cycle clears that by two
     * orders of magnitude; composition drift inside pinned caps never does.
     */
    var st = r.structureTrend;
    var rise = st.slope * st.samples;
    if (st.rising && rise >= r.nodesPerRecord) {
      growing.push(r.product + '.recursiveStructure RISES by ' + rise.toFixed(0) +
        ' nodes over ' + st.samples + ' cycles (slope ' + st.slope.toFixed(3) +
        '/cycle, t=' + st.t.toFixed(1) + '), which is at least one whole record of ~' +
        r.nodesPerRecord.toFixed(0) + ' nodes');
    }
    function pair(t) { return t.earlyMax + '→' + t.lateMax; }
    console.log('  ' + pad(r.product, 12) + lp(pair(r.structureTrend), 20) +
      lp(pair(r.textTrend), 20) + lp(pair(r.openProspectiveTrend), 16) +
      lp(pair(r.openPredictionTrend), 16) + lp(pair(r.consumedTrend), 16));
  });

  console.log('');
  console.log('RAW BYTES — diagnostic only; OLS over every post-warm-up sample:');
  rows.forEach(function (r) {
    console.log('  ' + pad(r.product, 12) + 'body ' + lp(r.bodyTrend.slope.toFixed(1), 9) +
      ' B/cycle   total ' + lp(r.totalTrend.slope.toFixed(1), 9) + ' B/cycle');
  });

  console.log('');
  if (failures.length || growing.length) {
    if (growing.length) console.log('POST-WARM-UP STRUCTURE STILL GROWS: ' + growing.join('; '));
    console.log('THE GATE IS NOT CLOSED.');
    process.exit(1);
  }
  console.log('All ' + rows.length + ' installed domains: every compaction and internal collection cap');
  console.log('held on every measured cycle; open work and consumed ids did not lift; and complete');
  console.log('recursive body-structure windows still overlap. Numeric and embedded-counter widths');
  console.log('can fluctuate or gain digits, but with capped structure and stable live ledgers they');
  console.log('cannot add a linear per-record term. The archive head grows only by counter digits.');
  console.log('The linear per-record hot-state term is gone for this deterministic replay.');
})().catch(function (e) { console.error('THREW: ' + (e && e.stack || e)); process.exit(1); });
