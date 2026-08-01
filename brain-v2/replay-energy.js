/**
 * brain-v2/replay-energy.js — run the new brain over REAL recorded energy history.
 *
 *   node brain-v2/replay-energy.js [rows]
 *
 * The recorder (handlers/feed-record.js) holds up to 2160 hourly rows per domain, each with a
 * compacted per-source array. Replaying it is the only way to see the new brain behave on real
 * data without waiting weeks for a baseline to accumulate.
 *
 * WHAT THIS CAN AND CANNOT SHOW, stated up front:
 *   CAN  — which channels the liveness gate declares DEAD on the same numbers the existing
 *          brain thresholds against. That is the load-bearing question.
 *   CANNOT — anything about recent7d. The recorder stores each source's saturated `value`,
 *          not its recency fields. So this replay is deliberately run on the WORSE input, and
 *          the result is a lower bound on how much the saturation matters.
 */
'use strict';

var B = require('./core/brain.js');
var BIND = require('./bind/energy.js');

var N = parseInt(process.argv[2], 10) || 400;
var URL = 'https://limenhelix.com/api/feed-record?read=energy&n=' + N;

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

(async function () {
  var res = await fetch(URL, { redirect: 'follow' });
  var j = await res.json();
  var rows = (j.rows || []).slice().reverse();     // oldest first
  if (!rows.length) { console.log('no recorder rows'); return; }

  console.log('replaying ' + rows.length + ' recorded hours of ENERGY');
  console.log('  from ' + new Date(rows[0].t).toISOString().slice(0, 16).replace('T', ' '));
  console.log('  to   ' + new Date(rows[rows.length - 1].t).toISOString().slice(0, 16).replace('T', ' '));
  console.log('  NOTE: recorder stores the SATURATED `value`; recent7d is not in history.');
  console.log('');

  var brain = B.createBrain(BIND.spec());
  var out = null, abstained = 0, detected = 0, firedTotal = 0;
  var firedBy = {};

  rows.forEach(function (row) {
    out = B.cycle(brain, BIND.readRecorderRow(row), row.t);
    if (out.state.abstained) abstained++;
    if (out.dysregulation && out.dysregulation.detected) detected++;
    out.findings.forEach(function (f) { firedTotal++; firedBy[f.id] = (firedBy[f.id] || 0) + 1; });
  });

  console.log('=== CHANNEL VERDICT after ' + rows.length + ' real hours ===');
  console.log(pad('channel', 14) + pad('state', 10) + pad('liveness', 10) + padL('updates', 8) + padL('variance', 11) + '  why');
  out.sensors.forEach(function (s) {
    console.log(pad(s.key, 14) + pad(s.state, 10) + pad(s.liveness, 10) + padL(s.updates, 8) +
      padL(s.variance.toFixed(4), 11) + '  ' + (s.why ? String(s.why).slice(0, 62) : ''));
  });

  var dead = out.sensors.filter(function (s) { return s.liveness === 'dead'; });
  var live = out.sensors.filter(function (s) { return s.liveness === 'live'; });
  var unk = out.sensors.filter(function (s) { return s.liveness === 'unknown'; });

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('  channels DEAD (constant across window): ' + dead.length + '  -> ' + (dead.map(function (s) { return s.key; }).join(', ') || 'none'));
  console.log('  channels LIVE                         : ' + live.length + '  -> ' + (live.map(function (s) { return s.key; }).join(', ') || 'none'));
  console.log('  channels UNKNOWN (too few obs)        : ' + unk.length);
  console.log('');
  console.log('  cycles abstained (precision below floor or nothing fusable): ' + abstained + ' / ' + rows.length);
  console.log('  cycles with dysregulation detected                        : ' + detected + ' / ' + rows.length);
  console.log('  total findings fired                                      : ' + firedTotal);
  Object.keys(firedBy).forEach(function (k) { console.log('      ' + pad(k, 26) + firedBy[k]); });
  if (!firedTotal) console.log('      (none — every finding either could not be evaluated or its conditions were not met)');

  console.log('');
  console.log('=== FINAL CYCLE ===');
  console.log('  state: ' + (out.state.abstained
    ? 'ABSTAINED — ' + out.state.why
    : 'departure ' + out.state.departure.toFixed(3) + ' sd, confidence ' + out.state.confidence.toFixed(3) + ', from [' + out.state.basisOf.join(', ') + ']'));
  console.log('  dysregulation: ' + JSON.stringify(out.dysregulation).slice(0, 200));
  console.log('  blind: ' + out.blind.length + ' channel(s)');
  console.log('  candidates not evaluated: ' + out.candidates.filter(function (c) { return c.triggerSource === 'unevaluated'; }).length);
})().catch(function (e) { console.error('replay failed:', e.message); process.exit(1); });
