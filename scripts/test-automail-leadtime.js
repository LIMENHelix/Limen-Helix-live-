#!/usr/bin/env node
/**
 * scripts/test-automail-leadtime.js — the lead-time gate on homestead auto-mail.
 *
 * WHY THIS IS TESTED AND NOT EYEBALLED
 * Every pick here spends real postage on a real address. Before this gate the
 * selector asked work-first, owner address, equity, state and not-already-mailed
 * — and never asked how many days were left. A sale three days out got a letter
 * that could not arrive before the gavel: money spent to be too late.
 *
 * Checked here:
 *   1. a sale already past is never mailed
 *   2. a sale sooner than minLeadDays is never mailed
 *   3. a deal with no parseable saleDate is never mailed (the letter body
 *      interpolates the date and would read "scheduled for soon")
 *   4. eligible deals ARE mailed, soonest first
 *   5. the skip reasons are reported separately, so "0 sent" can be told apart
 *      from "0 available"
 *   6. minLeadDays: 0 is honoured — the operator may deliberately disable it
 *
 * Runs the real handler with an in-memory store. Nothing is sent: no LOB key is
 * set, so the handler stays in dry-run and lobSend is never reached.
 *
 * RUN: node scripts/test-automail-leadtime.js
 */

'use strict';

var path = require('path');
var Module = require('module');

var fails = [], checks = 0;
function ok(c, m) { checks++; if (!c) fails.push(m); }

function isoPlus(days) {
  var d = new Date(Date.now() + days * 86400000);
  return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' +
         String(d.getUTCDate()).padStart(2, '0') + '/' + d.getUTCFullYear();
}

// ── in-memory stand-in for lib/limen-db ──────────────────────────────────────
var store = {};
var fakeDb = {
  get: function (k) { return Promise.resolve(store[k]); },
  set: function (k, v) { store[k] = v; return Promise.resolve(true); },
  getBackend: function () { return 'memory'; }
};

var ROOT = path.join(__dirname, '..');
var dbPath = require.resolve(path.join(ROOT, 'lib', 'limen-db.js'));
var origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && /homestead-automail/.test(parent.filename || '') && /limen-db/.test(request)) return fakeDb;
  return origLoad.apply(this, arguments);
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

process.env.LEAD_ADMIN_KEY = 'testadmin';
delete process.env.LOB_API_KEY;                 // stay in dry-run; never transmit

var handler = require(path.join(ROOT, 'handlers', 'homestead-automail.js'));

function call(body) {
  return new Promise(function (resolve) {
    var chunks = JSON.stringify(body);
    var req = {
      method: 'POST', url: '/api/homestead-automail',
      on: function (ev, cb) {
        if (ev === 'data') cb(chunks);
        if (ev === 'end') cb();
        return req;
      }
    };
    var out = { code: 200 };
    var res = {
      setHeader: function () {},
      end: function (b) { try { out.body = JSON.parse(b); } catch (e) { out.body = b; } resolve(out); }
    };
    Object.defineProperty(res, 'statusCode', {
      set: function (v) { out.code = v; }, get: function () { return out.code; }
    });
    handler(req, res);
  });
}

var DEALS = [
  { parcel: 'PAST-1',  workFirst: true, equity: 50000, tier: 1, state: 'FL',
    owner: { mailAddr: '1 Old Rd, Tampa FL 33601' }, saleDate: isoPlus(-3) },
  { parcel: 'SOON-1',  workFirst: true, equity: 90000, tier: 1, state: 'FL',
    owner: { mailAddr: '2 Soon St, Tampa FL 33601' }, saleDate: isoPlus(3) },
  { parcel: 'SOON-2',  workFirst: true, equity: 80000, tier: 1, state: 'FL',
    owner: { mailAddr: '3 Soon St, Tampa FL 33601' }, saleDate: isoPlus(7) },
  { parcel: 'OK-NEAR', workFirst: true, equity: 40000, tier: 3, state: 'FL',
    owner: { mailAddr: '4 Fine Ave, Tampa FL 33601' }, saleDate: isoPlus(12) },
  { parcel: 'OK-FAR',  workFirst: true, equity: 70000, tier: 1, state: 'FL',
    owner: { mailAddr: '5 Fine Ave, Tampa FL 33601' }, saleDate: isoPlus(60) },
  { parcel: 'NODATE',  workFirst: true, equity: 60000, tier: 1, state: 'FL',
    owner: { mailAddr: '6 Unknown Way, Tampa FL 33601' }, saleDate: '' }
];

function run() {
  store['realauction:deals'] = DEALS;
  store['homestead:automail'] = { armed: true, cap: 20, states: ['FL'], mailedTotal: 0 };

  return call({ key: 'testadmin', action: 'send' }).then(function (r) {
    var b = r.body || {};
    ok(b.ok === true, 'send did not return ok: ' + JSON.stringify(b).slice(0, 120));
    ok(b.mode === 'dry-run', 'expected dry-run without a LOB key, got ' + b.mode);

    // ── 1,2,3: the three ways a deal must be skipped ───────────────────────
    ok(b.skipped && b.skipped.past === 1, 'a past sale was not skipped (past=' +
       (b.skipped && b.skipped.past) + ')');
    ok(b.skipped && b.skipped.tooSoon === 2,
       'expected 2 deals inside the lead time to be skipped, got ' + (b.skipped && b.skipped.tooSoon));
    ok(b.skipped && b.skipped.noDate === 1, 'a deal with no saleDate was not skipped');
    ok(b.skippedTotal === 4, 'skippedTotal wrong: ' + b.skippedTotal);

    // ── 4: eligible ones go, soonest first ────────────────────────────────
    ok(b.candidates === 2, 'expected 2 eligible deals, got ' + b.candidates);
    ok(b.count === 2, 'expected 2 in the dry run, got ' + b.count);
    ok(b.soonestMailedDays === 12,
       'the soonest ELIGIBLE deal should lead at 12 days, got ' + b.soonestMailedDays);
    ok(b.minLeadDays === 8, 'default minLeadDays should be 8, got ' + b.minLeadDays);

    // ── 5: "0 sent" must be distinguishable from "0 available" ────────────
    store['realauction:deals'] = [DEALS[1]];        // one deal, too soon
    return call({ key: 'testadmin', action: 'send' }).then(function (r2) {
      var b2 = r2.body || {};
      ok(b2.count === 0 && b2.skipped.tooSoon === 1,
         'a lone too-soon deal should report 0 sent AND 1 skipped');
      store['realauction:deals'] = [];
      return call({ key: 'testadmin', action: 'send' }).then(function (r3) {
        var b3 = r3.body || {};
        ok(b3.count === 0 && b3.skippedTotal === 0,
           'an empty pipeline should report 0 sent and 0 skipped — a different fact');

        // ── 6: the operator may turn the gate off deliberately ────────────
        store['realauction:deals'] = DEALS;
        return call({ key: 'testadmin', minLeadDays: 0 }).then(function () {
          return call({ key: 'testadmin', action: 'send' }).then(function (r4) {
            var b4 = r4.body || {};
            ok(b4.minLeadDays === 0, 'minLeadDays=0 was not accepted, got ' + b4.minLeadDays);
            ok(b4.skipped.tooSoon === 0, 'with the gate off nothing should be too soon');
            ok(b4.skipped.past === 1, 'a PAST sale must still be skipped even with the gate off');
            ok(b4.skipped.noDate === 1, 'a dateless deal must still be skipped with the gate off');
            ok(b4.candidates === 4, 'expected 4 candidates with the gate off, got ' + b4.candidates);

            // The admin page can only show the skip counts if the run wrote
            // them down, and a deliberate 0 must survive a read.
            return call({ key: 'testadmin' }).then(function (g) {
              var gb = g.body || {};
              ok(gb.minLeadDays === 0,
                 'a deliberate minLeadDays=0 did not survive the status read (got ' + gb.minLeadDays + ')');
              ok(gb.lastSkipped && gb.lastSkipped.past === 1,
                 'the run did not persist its skip counts for the admin page');
              return null;
            }).then(function () {
            console.log('[automail] with an 8-day floor: 2 of 6 deals mailable · ' +
              'skipped 1 past, 2 too soon, 1 undated · soonest eligible 12 days out');
            return null;
            });
          });
        });
      });
    });
  });
}

run().then(function () {
  console.log('[automail] ' + (checks - fails.length) + '/' + checks + ' checks passed');
  if (fails.length) { fails.forEach(function (f) { console.error('  FAIL  ' + f); }); process.exit(1); }
  console.log('[automail] no letter is posted that cannot arrive before the sale');
  process.exit(0);
}).catch(function (e) {
  console.error('[automail] threw: ' + (e && e.stack || e));
  process.exit(1);
});
