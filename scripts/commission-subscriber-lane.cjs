#!/usr/bin/env node
'use strict';

/**
 * scripts/commission-subscriber-lane.cjs — thin CLI wrapper.
 *
 * The chain implementation lives in lib/commission-subscriber-lane.js because
 * vercel.json excludes scripts/** from the api function bundle (the api glob's
 * excludeFiles) — a handler requiring scripts/**
 * crashes the whole catch-all at boot in production (incident 2026-09-22).
 *
 * NOTE: production commissioning runs through POST /api/commission-subscriber-lane
 * (see ops/subscriber-enablement.md §3) — production credentials are Vercel
 * Sensitive envs and can never be pulled locally. This wrapper remains for
 * development against non-sensitive environments.
 *
 * USAGE
 *   node scripts/commission-subscriber-lane.cjs --address=<email> [--live --consent]
 */

var Lib = require('../lib/commission-subscriber-lane.js');

async function main() {
  var options = Lib.parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('usage: node scripts/commission-subscriber-lane.cjs --address=<owned consented email> [--live --consent]');
    console.log('default is dry-run: full chain in memory, stubbed provider, nothing sent, nothing persisted.');
    console.log('production: use POST /api/commission-subscriber-lane instead (Sensitive envs cannot be pulled locally).');
    return;
  }
  try {
    var report = await Lib.runCommissioning(options);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
  } catch (error) {
    console.log(JSON.stringify(error.report || { ok: false, status: 'REFUSED', reason: String(error && error.message || error), providerCalled: false, liveMoney: false }, null, 2));
    process.exit(error.report ? 1 : 2);
  }
}

if (require.main === module) main();

module.exports = Lib;
