/**
 * test-fetcher-shadowing.js — no two top-level fetchers in domain-snapshot.js may share a name.
 *
 * WHY THIS EXISTS. On 2026-09-05 `fetchFDARecalls` was declared twice in
 * handlers/domain-snapshot.js: once as openFDA drug-enforcement (30d count) and again,
 * ~2300 lines later, as an FDA food-recall RSS item count. JavaScript function
 * declarations hoist, so the later declaration replaced the earlier one for every call
 * site. Health's "openFDA Recalls" channel was served food-recall feed items, the health
 * row commented "distinct from openFDA API" was the same fetch run twice, and the
 * openFDA drug-enforcement code never executed.
 *
 * Nothing failed. Both channels returned a plausible number and reported `live`. The only
 * externally visible symptom was that two channels which measure different quantities
 * never disagreed, which is exactly what a healthy pair of instruments also looks like
 * until you check the units.
 *
 * A duplicate declaration is therefore not a style problem here. It silently rebinds a
 * measured channel to a different quantity while leaving every health indicator green.
 *
 * KNOWN_SHADOWED is an explicit debt list, not a suppression. Each entry is a defect that
 * is still open, recorded here so the guard stays green for NEW code while the remaining
 * collisions stay visible in the test output. Removing a name from this list is the fix;
 * adding one requires a reason.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var TARGET = path.join(__dirname, '..', 'handlers', 'domain-snapshot.js');

/**
 * Open, unfixed collisions. Keep the measured consequence next to each name so a later
 * reader can rank it rather than assuming it is cosmetic.
 */
var KNOWN_SHADOWED = {
  fetchCISAKEV:
    'Both declarations fetch the SAME upstream KEV JSON and compute the same 30d count, so '
    + 'the VALUE is not wrong. The later one wins and reports domain "supplyChain" with a '
    + 'stress channel, so technology index 71 loses its own sourceHealth row and its '
    + 'activity-channel classification. Provenance/attribution defect, not a wrong number. '
    + 'Fixing it changes stress attribution across technology and supplyChain, so it needs '
    + 'its own re-baseline decision.'
};

function topLevelDeclarations(src) {
  var found = Object.create(null);
  var lines = src.split(/\r?\n/);
  var re = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(re);
    if (!m) continue;
    var name = m[1];
    if (!found[name]) found[name] = [];
    found[name].push(i + 1);
  }
  return found;
}

function run() {
  var src = fs.readFileSync(TARGET, 'utf8');
  var decls = topLevelDeclarations(src);

  var newCollisions = [];
  var knownStillOpen = [];

  Object.keys(decls).forEach(function (name) {
    if (decls[name].length < 2) return;
    if (Object.prototype.hasOwnProperty.call(KNOWN_SHADOWED, name)) {
      knownStillOpen.push({ name: name, lines: decls[name] });
    } else {
      newCollisions.push({ name: name, lines: decls[name] });
    }
  });

  /* A stale allowlist is its own failure: it tells a reader a defect exists that does not,
     and it would hide a genuine regression if the name were ever reused. */
  var staleAllowlist = Object.keys(KNOWN_SHADOWED).filter(function (name) {
    return !decls[name] || decls[name].length < 2;
  });

  var failed = false;

  if (newCollisions.length) {
    failed = true;
    console.error('FAIL: duplicate top-level fetcher declaration(s) in handlers/domain-snapshot.js');
    newCollisions.forEach(function (c) {
      console.error('  ' + c.name + ' declared at lines ' + c.lines.join(', ')
        + ' — the LAST declaration silently wins at every call site.');
    });
    console.error('  Rename one of them. Do not add it to KNOWN_SHADOWED to get past this test.');
  }

  if (staleAllowlist.length) {
    failed = true;
    console.error('FAIL: KNOWN_SHADOWED lists name(s) that are no longer duplicated: '
      + staleAllowlist.join(', ') + '. Delete the entry.');
  }

  knownStillOpen.forEach(function (c) {
    console.log('KNOWN, still open: ' + c.name + ' at lines ' + c.lines.join(', '));
    console.log('  ' + KNOWN_SHADOWED[c.name]);
  });

  if (failed) process.exit(1);

  console.log('fetcher shadowing: no new duplicate declarations ('
    + Object.keys(decls).length + ' top-level functions checked, '
    + knownStillOpen.length + ' known collision(s) still open)');
}

run();
