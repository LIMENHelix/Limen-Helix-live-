/**
 * audit-readiness.mjs — READ-ONLY readiness audit of all 20 domains.
 *
 * Writes only its own output file. No network, no Redis, no repository mutation.
 *
 * Coverage (what the binder can read) and ELIGIBILITY (the analyzer verdict) are separate
 * questions and are reported separately. Eligibility is not re-derived here: analyze,
 * loadManifest, testableRelationships and MIN_OBSERVATIONS are imported from
 * scripts/build-brain-fixture.mjs, which is the authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* Two levels up: this file lives in scripts/brain-audit/. Resolved against the module URL,
   never process.cwd(), so the answer does not depend on where it was invoked from. */
const ROOT = path.join(__dirname, '..', '..');
const require = createRequire(import.meta.url);

const REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
const LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
/* THE AUTHORITY ON ELIGIBILITY. Imported, not reimplemented. Verified safe to import:
   the module guards its CLI behind `if (!IS_CLI)`, and an instrumented import performs
   zero fetches and zero writes. */
/* pathToFileURL, not a hand-built 'file://' string: that form mishandles Windows drive
   letters and any path containing spaces or URL-sensitive characters. */
const ANALYZER = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'build-brain-fixture.mjs')).href);
const { analyze, loadManifest, testableRelationships, MIN_OBSERVATIONS } = ANALYZER;

const MAX_ROWS_PER_CYCLE = 120;              // mirrors lib/brain-shadow-runtime.js
const HOUR = 3600000;
const DEFAULT_HORIZON_MS = 6 * HOUR;
/* DERIVED, NEVER TYPED. Defect 3. */
const INSTALLED = REG.INSTALLED_DOMAINS;

const out = [];

for (const d of REG.DOMAINS) {
  const row = {
    product: d.product, snapshot: d.snapshot, aliased: d.aliased,
    installed: INSTALLED.includes(d.product),
    state: null, binderOk: false, loadError: null,
    channels: 0, relationships: 0, findings: 0,
    rows: 0, firstT: null, lastT: null, spanH: null,
    // ── runtime-visible coverage: what the BINDER reads, per declared channel ──
    channelsRead: 0, channelsUnread: [], suChannels: 0, distinctTotal: 0, perChannel: [],
    // ── analyzer verdict: the real eligibility rule, kept separate from coverage ──
    analyzerUsableChannels: 0, analyzerIdentified: 0, analyzerMoving: 0,
    rels: [], relsTestable: 0, manifestLoaded: false, manifestWhy: null,
    supportsIndependentObservations: false,
    // ── cost ──
    tickLoopMs: null, ticks: 0, abstained: 0, rowsInFirstCycle: 0,
    throws: null, notes: []
  };

  const insp = REG.inspect(d.snapshot);
  row.state = insp.state;
  row.binderOk = !!insp.binder && !insp.loadError;
  row.loadError = insp.loadError || null;
  row.channels = insp.channels || 0;
  row.relationships = insp.relationships || 0;
  row.findings = insp.findings || 0;
  if (!row.binderOk) { out.push(row); continue; }

  const binder = require(REG.binderPath(d));
  const spec = binder.spec();
  const fp = REG.fixturePath(d);
  if (!fs.existsSync(fp)) { row.notes.push('no fixture file'); out.push(row); continue; }

  let doc;
  try { doc = JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (e) { row.notes.push('fixture unparseable: ' + e.message); out.push(row); continue; }

  const rows = (doc.rows || []).slice().sort((a, b) => a.t - b.t);
  row.rows = rows.length;
  if (rows.length) {
    row.firstT = rows[0].t; row.lastT = rows[rows.length - 1].t;
    row.spanH = +((row.lastT - row.firstT) / HOUR).toFixed(1);
  }

  /* ── (A) RUNTIME-VISIBLE COVERAGE ────────────────────────────────────────────
     What the binder actually produces, per declared channel, through the same
     readRecorderRow the runtime calls. This answers "what can this domain sense",
     and it is NOT the eligibility rule. */
  const occ = {}, withSu = {}, distinct = {};
  spec.channels.forEach(c => { occ[c.key] = 0; withSu[c.key] = 0; distinct[c.key] = new Set(); });
  let threw = null;
  for (let i = 0; i < rows.length; i++) {
    let readings;
    try { readings = binder.readRecorderRow(rows[i]) || {}; }
    catch (e) { threw = 'row ' + i + ': ' + e.message; break; }
    for (const k of Object.keys(readings)) {
      if (occ[k] === undefined) continue;
      occ[k]++;
      const oid = readings[k].observationId;
      if (oid !== undefined && oid !== null && oid !== '') { withSu[k]++; distinct[k].add(String(oid)); }
    }
  }
  row.throws = threw;
  for (const c of spec.channels) {
    const n = distinct[c.key].size;
    if (occ[c.key] > 0) row.channelsRead++; else row.channelsUnread.push(c.key + ' (' + c.name + ')');
    if (withSu[c.key] > 0) row.suChannels++;
    row.distinctTotal += n;
    row.perChannel.push({ key: c.key, name: c.name, occ: occ[c.key], withSu: withSu[c.key], distinctSourceKeys: n });
  }

  /* ── (B) ANALYZER VERDICT ────────────────────────────────────────────────────
     The real rule, from the real analyzer, over the RAW rows keyed by source name,
     which is the population build-brain-fixture.mjs judges. A side counts only when it
     is identified AND moving AND carries >= MIN_OBSERVATIONS distinct keys. */
  const stats = analyze(rows);
  const manifest = loadManifest(d.product);
  row.manifestLoaded = !!manifest.ok;
  row.manifestWhy = manifest.ok ? null : manifest.why;
  row.analyzerIdentified = stats.filter(c => c.identified).length;
  row.analyzerMoving = stats.filter(c => c.moving).length;
  row.analyzerUsableChannels =
    stats.filter(c => c.identified && c.moving && c.usableObservations >= MIN_OBSERVATIONS).length;

  const rels = testableRelationships(stats, manifest);
  row.rels = rels.map(r => ({
    latent: r.latent, a: r.a, b: r.b, aKeys: r.aKeys, bKeys: r.bKeys,
    testable: r.testable, blockedBy: r.blockedBy
  }));
  row.relsTestable = rels.filter(r => r.testable).length;
  /* The same flag the fixture records on its own face. Never a channel count. */
  row.supportsIndependentObservations = !!manifest.ok && row.relsTestable >= 1;

  /* ── (C) TICK-LOOP TIME, and what it is NOT ──────────────────────────────────
     Defect 4. This times ONLY `binder.readRecorderRow` plus `LOOP.tick` over the first
     capped batch. A real cycle also does: STORE.readState, STORE.readRecorderRows,
     LOOP.serialize of a multi-megabyte object, JSON.stringify of it, STORE.writeState,
     STORE.writeCycle (a SET, an LPUSH, an LTRIM and a read-back LRANGE), plus the
     network latency of all SEVEN Redis round trips: state GET, recorder LRANGE, state SET,
     cycle SET, history LPUSH, history LTRIM, history LRANGE (the read-back). Counted from
     lib/brain-shadow-store.js rather than recalled; an earlier draft said six and dropped
     the read-back. Serialization alone grows with state and is
     not bounded. Calling this "cycle cost" understated the real figure by an unmeasured
     margin, so the field is named for what it measures. */
  try {
    const loop = LOOP.create({
      domain: d.snapshot, brainSpec: spec, horizonMs: DEFAULT_HORIZON_MS,
      vitalsOpts: { learningPeriodMs: HOUR, homeostaticPeriodMs: 24 * HOUR }
    });
    const fresh = rows.slice(0, MAX_ROWS_PER_CYCLE);
    row.rowsInFirstCycle = fresh.length;
    const t0 = process.hrtime.bigint();
    for (const rw of fresh) {
      const rd = binder.readRecorderRow(rw) || {};
      if (!Object.keys(rd).length) { row.abstained++; continue; }
      LOOP.tick(loop, rd, rw.t);
      row.ticks++;
    }
    row.tickLoopMs = +(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
  } catch (e) {
    row.notes.push('LOOP failed: ' + e.message);
  }

  out.push(row);
}

fs.writeFileSync(path.join(__dirname, 'audit-out.json'), JSON.stringify(out, null, 1));

// ── report ───────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const lp = (s, n) => String(s).padStart(n);

console.log('\nINSTALLED (derived from REG.INSTALLED_DOMAINS): ' + INSTALLED.join(', '));
console.log('installed ' + INSTALLED.length + ' of ' + REG.DOMAINS.length + ' domains\n');

console.log('COVERAGE (what the binder can read) and ELIGIBILITY (the analyzer verdict) are');
console.log('different questions. Coverage columns are left of the bar, analyzer right of it.\n');
console.log('domain         in  st     ch  rd  un  suCh  keys | ident mov usable  rel test  SIO | rows  spanH  ticks tickLoopMs');
for (const r of out) {
  console.log(
    pad(r.product, 14) + pad(r.installed ? 'Y' : '-', 4) + pad((r.state || '?').slice(0, 5), 7) +
    lp(r.channels, 3) + lp(r.channelsRead, 4) + lp(r.channelsUnread.length, 4) +
    lp(r.suChannels, 6) + lp(r.distinctTotal, 6) + '  |' +
    lp(r.analyzerIdentified, 6) + lp(r.analyzerMoving, 4) + lp(r.analyzerUsableChannels, 7) +
    lp(r.relationships, 5) + lp(r.relsTestable, 5) + lp(r.supportsIndependentObservations ? 'yes' : 'no', 5) + '  |' +
    lp(r.rows, 6) + lp(r.spanH === null ? '-' : r.spanH, 7) + lp(r.ticks, 7) + lp(r.tickLoopMs === null ? '-' : r.tickLoopMs, 11) +
    (r.throws ? '  THREW: ' + r.throws : ''));
}

const totalRels = out.reduce((a, r) => a + r.relationships, 0);
const totalTestable = out.reduce((a, r) => a + r.relsTestable, 0);
console.log('\nsuCh/keys = channels carrying a source key, and total distinct keys, as the BINDER reads them.');
console.log('ident/mov/usable = analyzer channel stats. usable requires identified AND moving AND >= ' +
  MIN_OBSERVATIONS + ' keys.');
console.log('test = declared relationships the ANALYZER calls testable. SIO = supportsIndependentObservations.');
console.log('\ndeclared relationships: ' + totalRels + '   analyzer-testable: ' + totalTestable);
console.log('domains reporting supportsIndependentObservations: ' +
  out.filter(r => r.supportsIndependentObservations).length + ' of ' + out.length);
console.log('\ntickLoopMs is readRecorderRow + LOOP.tick ONLY. It excludes state read, serialize,');
console.log('stringify, and all seven Redis round trips. It is not the cycle cost.');
