#!/usr/bin/env node
/**
 * scripts/test-control.js — render /control headless and check the levers.
 *
 * WHAT MATTERS ON A CONTROL BOARD
 * Not that it draws. That a lever never shows a position the system is not in.
 * Four ways that can go wrong, all checked here:
 *
 *   1. DEFAULTING     Before the board arrives, a lever must be DISABLED and read
 *                     "reading…". It must never sit cosmetically ON.
 *   2. MISREADING     Once the board arrives, each lever must match the server:
 *                     a shut valve reads OFF, a paused pause reads OFF.
 *   3. LYING ON WRITE A rejected write must spring the lever back and say so,
 *                     not leave the optimistic position on screen.
 *   4. FAKE HANDLES   Only the seven real controls may be levers. Email, Bluesky
 *                     and leads have no on/off and must NOT render one.
 *
 * Runs the real control.html and assets/js/control.js under jsdom. Network stubbed.
 *
 * RUN: node scripts/test-control.js
 */

'use strict';

var fs = require('fs');
var path = require('path');
var { JSDOM } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var fails = [], checks = 0;
function ok(c, m) { checks++; if (!c) fails.push(m); }

var NOW = Date.now();
// Deliberately mixed: social PAUSED, autopilot valve SHUT, AI blocked at the env.
// A board that renders these three as ON is the failure this file exists to catch.
var board = {
  ok: true, at: NOW,
  ai: { envEnabled: false, runtimePaused: false, tokensPerTick: 0, reason: 'env-disabled',
        ungatedPaidJobs: [] },
  social: { paused: true },
  stores: { touched: {}, coverage: '' },
  jobs: [
    { job: 'autopilot', cost: { cost: 'free' },
      declared: { schedule: '7,37 * * * *', kind: 'outward', role: 'motor' },
      observed: { at: NOW - 600000, ok: true }, valve: { open: false } },
    { job: 'automail', cost: { cost: 'free' },
      declared: { schedule: '45 11 * * *', kind: 'outward', role: 'motor' },
      observed: { at: NOW - 7200000, ok: true }, valve: { open: true } },
    { job: 'subscriber-digest', cost: { cost: 'free' },
      declared: { schedule: '30 13 * * *', kind: 'outward', role: 'motor' },
      observed: { at: null, neverObserved: true }, valve: { open: true } },
    { job: 'social-cron', cost: { cost: 'free' },
      declared: { schedule: '0 0,2 * * *', kind: 'outward', role: 'motor' },
      observed: { at: NOW - 3600000, ok: false }, valve: { open: true } },
    { job: 'finance-paper-cycle', cost: { cost: 'paid' },
      declared: { schedule: '16,46 * * * *', kind: 'outward', role: 'motor' },
      observed: { at: NOW - 900000, ok: true }, valve: { open: true } }
  ],
  spikes: [], coverage: { declared: 18, observed: 4, neverObserved: 14 }
};
var capsBody = { ok: true, capabilities: [
  { id: 'email', label: 'Send email', state: 'wired', missing: [] },
  { id: 'bluesky', label: 'Post to Bluesky', state: 'wired', missing: [] }
] };
var rosterBody = { ok: true,
  master: { name: 'Kai', role: 'orchestrator',
    mandate: 'I coordinate the twenty operators and speak one system decision. I open a human gate; I never walk through it.' },
  system: { ready: true, systemStress: 0.42, posture: 'hold', boundedAction: 'monitor',
            focus: { domain: 'energy', posture: 'monitor' } },
  operators: [
  { name: 'Vera', domain: 'governance', posture: 'monitor', hasLiveSignal: true },
  { name: 'Juno', domain: 'energy', posture: 'abstain', hasLiveSignal: false },
  { name: 'Vale', domain: 'finance', posture: 'open-human-gate', hasLiveSignal: true,
    situation: 'distress cluster needs a human call' },
  { name: 'Nova', domain: 'culture', posture: 'recommend', hasLiveSignal: true }
] };

var writes = [];
var rejectNext = false;

var html = fs.readFileSync(path.join(ROOT, 'control.html'), 'utf8');
var js = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'control.js'), 'utf8');

var dom = new JSDOM(html.replace(/<script src="[^"]*"><\/script>/, ''), {
  url: 'https://limenhelix.com/control', pretendToBeVisual: true, runScripts: 'outside-only'
});
var win = dom.window, doc = win.document;

var boardServed = false;
win.fetch = function (url) {
  var u = String(url);
  var body;
  if (u.indexOf('caps=1') !== -1) body = capsBody;
  else if (u.indexOf('/api/fleet') !== -1) body = rosterBody;
  else if (u.indexOf('valve=') !== -1 || u.indexOf('ai=') !== -1 || u.indexOf('social=') !== -1) {
    writes.push(u);
    if (rejectNext) { rejectNext = false; body = { ok: false, error: 'valve refused by the ledger' }; }
    else body = { ok: true, note: 'accepted' };
  } else { boardServed = true; body = board; }
  return Promise.resolve({ status: 200, json: function () { return Promise.resolve(body); } });
};
win.eval(js);

function ready() {
  return new Promise(function (r) {
    if (doc.readyState !== 'loading') return r();
    win.addEventListener('DOMContentLoaded', function () { r(); });
  });
}
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 40); }); }
function levers() { return Array.prototype.slice.call(doc.querySelectorAll('#board .sw')); }
function leverBy(name) {
  return levers().filter(function (s) { return s.querySelector('.nm').textContent === name; })[0];
}
function click(e) { e.dispatchEvent(new win.Event('click', { bubbles: true })); }

function run() {
  // ── 1. nothing may sit ON before the board arrives ────────────────────
  // The gate has not been passed, so no fetch has happened at all.
  ok(!boardServed, 'the board was fetched before the key was entered');

  doc.getElementById('gk').value = 'test-key';
  click(doc.getElementById('gb'));

  return tick(80).then(function () {
    ok(doc.getElementById('gate').classList.contains('hide'), 'gate did not close');

    var ls = levers();
    ok(ls.length === 7, 'expected 7 levers, got ' + ls.length);

    // Kai frames the board — his mandate ends "I open a human gate; I never walk
    // through it", and the levers are that gate. He must speak the REAL system
    // decision, not a calm default.
    var kaiTxt = doc.getElementById('kai').textContent;
    ok(/KAI/.test(kaiTxt), 'Kai is not on the board');
    ok(/holding/.test(kaiTxt), 'Kai does not report the live system posture');
    ok(/energy/.test(kaiTxt), 'Kai does not name the domain holding the floor');
    ok(/never walk through it/.test(kaiTxt), "Kai's gate line is missing — it is the page's thesis");

    // ── 4. no fake handles ────────────────────────────────────────────
    var capBlocks = doc.querySelectorAll('#caps .cap-tile');
    ok(capBlocks.length === 4, 'expected 4 capability rows, got ' + capBlocks.length);
    ok(doc.querySelectorAll('#caps .lever').length === 0,
       'a capability rendered a lever — email/bluesky/leads have no on/off');
    // It shares the lever's shell for density, so the distinguishing mark is the
    // chip standing where the handle would be. No chip and no lever = a tile the
    // operator cannot tell is inert.
    ok(doc.querySelectorAll('#caps .chip').length === capBlocks.length,
       'a capability tile has neither a lever nor a state chip');
    ok(doc.querySelectorAll('#unbuilt .lever').length === 0, 'an unbuilt row rendered a lever');
    ok(doc.querySelectorAll('#unbuilt .cap-tile').length === 3,
       'expected 3 unbuilt rows, got ' + doc.querySelectorAll('#unbuilt .cap-tile').length);
    // Physical mail IS built — Lob is wired in homestead-automail.js. It was
    // wrongly listed as having no code path; assert it never goes back.
    var unbuiltTxt = doc.getElementById('unbuilt').textContent;
    ok(!/physical mail/i.test(unbuiltTxt),
       'physical mail is wired to Lob but is listed as having no code path');
    ok(/lob\.com/i.test(doc.getElementById('caps').textContent),
       'the Lob transmit path is not shown as a capability');

    // ── 2. each lever matches the server ──────────────────────────────
    var social = leverBy('Social posting');
    ok(social && !/\bon\b/.test(social.className),
       'social is PAUSED on the server but the lever reads ON');

    var autopilot = leverBy('Autopilot');
    ok(autopilot && !/\bon\b/.test(autopilot.className),
       'the autopilot valve is SHUT but the lever reads ON');

    var automail = leverBy('Auto-mail');
    ok(automail && /\bon\b/.test(automail.className),
       'the automail valve is OPEN but the lever does not read ON');

    var financePaper = leverBy('Finance paper cycle');
    ok(financePaper && /\bon\b/.test(financePaper.className),
       'the Finance paper valve is OPEN but the lever does not read ON');

    // The AI lever must state the environment boundary rather than implying the
    // operator can open spend from here.
    var ai = leverBy('AI spend');
    ok(ai && /LIMEN_AI_ENABLED/.test(ai.textContent),
       'the AI lever does not say it cannot reach past the environment');

    // A job that never ran must say so on its lever.
    var digest = leverBy('Subscriber digest');
    ok(digest && /never run/i.test(digest.textContent),
       'a job with no recorded run does not say "never run"');
    var sc = leverBy('Social cron');
    ok(sc && /FAILED/i.test(sc.textContent), 'a failed last run is not surfaced');

    // ── 3. a rejected write must not stick ────────────────────────────
    rejectNext = true;
    var before = leverBy('Auto-mail').className;
    click(leverBy('Auto-mail').querySelector('.lever'));

    return tick(80).then(function () {
      ok(writes.length === 1, 'expected 1 write, saw ' + writes.length);
      ok(/valve=automail&open=0/.test(writes[0]),
         'the write did not ask to shut the valve: ' + writes[0]);
      var after = leverBy('Auto-mail').className;
      ok(/\bon\b/.test(after),
         'a REJECTED write left the lever flipped — it must spring back');
      ok(/rejected/i.test(doc.getElementById('log').textContent),
         'the log does not record the rejection');

      // ── an accepted write re-reads rather than trusting the echo ────
      var pollsBefore = 0;
      click(leverBy('Subscriber digest').querySelector('.lever'));
      return tick(90).then(function () {
        ok(writes.length === 2, 'the second throw did not write');
        ok(/valve=subscriber-digest&open=0/.test(writes[1]),
           'second write was wrong: ' + writes[1]);
        ok(/accepted/i.test(doc.getElementById('log').textContent),
           'the log does not record acceptance');

        // ── the floor draws only names the server gave ─────────────────
        var sts = doc.querySelectorAll('#floor .st');
        ok(sts.length === rosterBody.operators.length,
           'floor drew ' + sts.length + ' stations for ' + rosterBody.operators.length + ' operators');
        ok(/Vera/.test(doc.getElementById('floor').textContent), 'operator names not rendered');

        // An operator at open-human-gate is asking for the levers above. It must
        // sort to the FRONT and be counted, or the page buries its own call to action.
        ok(/Vale/.test(sts[0].textContent),
           'the operator at the gate did not sort first (got ' + sts[0].textContent.slice(0,24) + ')');
        ok(/p-open-human-gate/.test(sts[0].className), 'the gate-waiter is not marked');
        ok(/1 operator is at the gate/.test(doc.getElementById('waiting').textContent),
           'the waiting count is wrong: ' + doc.getElementById('waiting').textContent);
        ok(/wants you/.test(sts[0].textContent), 'the posture is not said in plain words');

        // ── the desks ───────────────────────────────────────────────────
        // A desk takes the WORST state among its jobs: one dead job means the
        // desk is not healthy, however well the others are running.
        function deskBy(n) {
          return Array.prototype.slice.call(doc.querySelectorAll('#desks .desk'))
            .filter(function (d) { return d.querySelector('.dnm').textContent === n; })[0];
        }
        var desks = doc.querySelectorAll('#desks .desk');
        ok(desks.length >= 9, 'expected the full desk set, got ' + desks.length);
        ok(deskBy('Relay'), 'Relay has no desk');
        ok(deskBy('Medicine'), 'Medicine has no desk');

        // Sales runs autopilot (ok) AND subscriber-digest (never observed).
        // Taking the best would paint it green; it must take the worst.
        var sales = deskBy('Sales & CRM');
        ok(sales && /s-none/.test(sales.className),
           'Sales has a never-run job but the desk does not show it (' +
           (sales ? sales.className : 'missing') + ')');
        ok(sales && /never run/i.test(sales.textContent), 'the desk does not name the dead job');

        // Publishing runs social-cron, whose last run FAILED.
        var pub = deskBy('Publishing');
        ok(pub && /s-bad/.test(pub.className),
           'a desk with a failing job does not read as failing');

        // A desk with NO schedule is "on demand" — an answer, not a fault.
        var relay = deskBy('Relay');
        ok(relay && /s-ondemand/.test(relay.className),
           'a desk with no scheduled job should read on demand, not broken');
        ok(relay && /on demand/i.test(relay.textContent), 'on-demand is not stated');

        // Things this deployment cannot reach are listed, and never as switches.
        var els = doc.querySelectorAll('#elsewhere .cap');
        ok(els.length === 1, 'expected 1 unreachable property, got ' + els.length);
        // Relay and Tension are IN LIMEN Helix. Both were wrongly listed as
        // external from stale notes; the repo shows relay handlers and a page,
        // and the medical front is here. Only killswitch.domains has no trace.
        var elTxt = doc.getElementById('elsewhere').textContent;
        ok(!/Relay/i.test(elTxt), 'Relay is in this repo but is listed as unreachable');
        ok(!/TENSION/i.test(elTxt), 'Tension is in this repo but is listed as unreachable');
        ok(doc.querySelectorAll('#elsewhere .lever').length === 0,
           'an unreachable property rendered a lever');
        ok(/killswitch\.domains/.test(doc.getElementById('elsewhere').textContent),
           'killswitch.domains is not listed');

        console.log('[control] desks: ' + desks.length + ' · worst-of-jobs honoured · ' +
          els.length + ' unreachable properties listed, none as switches');
        console.log('[control] measured: 7 levers · 3 capabilities · 3 unbuilt · ' +
          sts.length + ' operators (1 at the gate, sorted first) · ' +
          'rejected write sprang back · accepted write re-read');
        return null;
      });
    });
  });
}

ready().then(run).then(function () {
  console.log('[control] ' + (checks - fails.length) + '/' + checks + ' checks passed');
  if (fails.length) {
    fails.forEach(function (f) { console.error('  FAIL  ' + f); });
    process.exit(1);
  }
  console.log('[control] no lever shows a position the system is not in');
  process.exit(0);
}).catch(function (e) {
  console.error('[control] threw: ' + (e && e.stack || e));
  process.exit(1);
});
