#!/usr/bin/env node
/**
 * scripts/build-brain-fixture.mjs — turn recorded feed history into a brain fixture.
 *
 *   node scripts/build-brain-fixture.mjs --analyze brain-v2/fixtures/energy-recorder.json
 *   node scripts/build-brain-fixture.mjs --domain energy --n 500
 *   node scripts/build-brain-fixture.mjs --domain finance --n 500 --out brain-v2/fixtures/finance-recorder.json
 *
 * WHY THIS EXISTS. The energy fixture was assembled by hand, so there was no repeatable
 * way to turn accumulated history into one — and no way at all to answer the question
 * that actually gates SPEC row 10: does this data contain INDEPENDENT OBSERVATIONS, or
 * only repeated polls of the same cached values?
 *
 * So the evidence check is not a separate step you might forget. Every build runs it and
 * prints it, and `--analyze` runs it alone against a fixture already on disk.
 *
 * THE THREE THINGS IT MEASURES, because "we recorded 500 rows" answers none of them:
 *
 *   IDENTITY   how many channels carry the source's own observation key (`su`). A
 *              channel without one cannot distinguish a fresh publication from a re-read,
 *              so nothing downstream may count evidence from it.
 *   MOVEMENT   how many distinct values each channel actually took. A channel pinned at
 *              one value is dead however many rows it appears in.
 *   PAIRS      which declared relationships have BOTH sides identified and moving. That
 *              is the row 10 bar, and it is a property of a pair, not of the corpus.
 *
 * It never writes a fixture without printing that verdict, and it says plainly when the
 * data cannot support the row rather than leaving a green "wrote 500 rows".
 *
 * NETWORK: only in build mode, and only against this project's own /api/feed-record read
 * endpoint. `--analyze` is fully offline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

/**
 * REPOSITORY PATHS RESOLVE AGAINST THIS FILE, NEVER AGAINST process.cwd().
 *
 * `brain-v2/bind/<domain>.js` is a fixed location inside this repository, so joining it
 * onto the caller's working directory made the answer depend on where the command was
 * typed. Run from the repo root the energy manifest loaded and seven declared
 * relationships were checked; run from anywhere else the same call reported "no binder"
 * and the verdict ABSTAINED — while the manifest sat exactly where it always had.
 *
 * That direction is the dangerous one for an evidence tool. It does not crash and it does
 * not overstate; it quietly reports less support than the data has, which looks like a
 * finding about the corpus rather than a bug in the reader. An operator running this from
 * their home directory would have concluded row 10 was further away than it is.
 *
 * This file lives at <root>/scripts/, so the root is one level up. Paths the CALLER
 * supplies (--analyze, an explicit --out) stay relative to their cwd, because those are
 * the caller's own paths and should follow the caller.
 */
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

/**
 * THE REGISTRY OWNS THE TWO-NAME MAPPING; this file does not restate it.
 *
 * LIMEN carries two names for three domains — medicine/health, science/research,
 * trade/supplyChain — and the artefacts split across them: a binder is filed under the
 * PRODUCT name, while the feed-record key, the fixture filename and the `domain` recorded
 * inside a fixture all use the SNAPSHOT key.
 *
 * Ignoring that had both halves wrong at once. `--domain health` hunted for
 * `bind/health.js`, which will never exist; `--domain medicine` would have queried
 * `/api/feed-record?read=medicine`, which the recorder never writes, and then filed the
 * result as `medicine-recorder.json`, which the registry never looks for. Neither fails
 * loudly: an unaliased name resolves to a key that does not exist, which reads as a
 * domain with no data.
 */
const REGISTRY = require(path.join(REPO_ROOT, 'brain-v2', 'bind', 'registry.js'));

/** Resolve either naming system to the descriptor that says where each artefact lives. */
function resolveDomain(name) {
  if (!name) return null;
  return REGISTRY.descriptorFor(name);
}

/* Only run the CLI when invoked directly. The evidence functions below are exported and
   regression-tested, and importing a module must not execute its command line — an
   importer would otherwise get this script's argv parsing and its process.exit. */
const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
}
const has = (name) => args.includes('--' + name);

const BASE = arg('base', 'https://www.limenhelix.com');
const DOMAIN = arg('domain', null);
const N = Math.max(1, Math.min(500, parseInt(arg('n', '500'), 10) || 500));
const ANALYZE = arg('analyze', null);

/* Minimum distinct source keys before a channel is treated as carrying real observations.
   Matches divergence.js MIN_OBSERVATIONS: below it, `persistent` cannot resolve anyway,
   so a channel under this floor cannot contribute to the row regardless. */
const MIN_OBSERVATIONS = 6;

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

/**
 * The evidence check. Takes fixture rows, returns per-channel identity and movement.
 * Pure — no network, no clock — so it can be run against anything on disk.
 */
function analyze(rows) {
  const byName = new Map();
  for (const row of rows) {
    for (const s of (row.src || [])) {
      if (!s.n) continue;
      if (!byName.has(s.n)) byName.set(s.n, { name: s.n, rows: 0, values: new Set(), ids: new Set(), noId: 0 });
      const c = byName.get(s.n);
      c.rows++;
      if (typeof s.v === 'number' && isFinite(s.v)) c.values.add(s.v);
      if (s.su !== undefined && s.su !== null && s.su !== '') c.ids.add(s.su); else c.noId++;
    }
  }
  return [...byName.values()].map((c) => ({
    name: c.name,
    rows: c.rows,
    distinctValues: c.values.size,
    distinctSourceKeys: c.ids.size,
    rowsWithoutKey: c.noId,
    /* BOTH are required. An identified channel that never moves has nothing to observe;
       a moving channel with no key cannot say whether the movement was one publication
       re-read or many. */
    moving: c.values.size >= 2,
    identified: c.ids.size >= 1,
    usableObservations: c.ids.size
  })).sort((a, b) => b.usableObservations - a.usableObservations || b.distinctValues - a.distinctValues);
}

/**
 * THE DECLARED RELATIONSHIP MANIFEST, and why support is judged against it and nothing else.
 *
 * Counting usable channels is not the row 10 bar and never was. Two usable channels in
 * unrelated corners of a domain -- a weather alert count and a CVE count -- say nothing
 * about whether any DECLARED relationship can be tested, because a divergence claim is a
 * statement about a specific pair that both observe a specific latent. A corpus can carry
 * ten well-identified channels and still leave every declared pair untestable, which is
 * precisely the state the energy fixture is in.
 *
 * ABSTAIN WHEN THERE IS NO BINDER. A domain with no binding has no declared latents, so
 * there is nothing a relationship could be tested against, and support is false with a
 * stated reason rather than inferred from whatever channels happen to be present. Most of
 * the twenty are in that state; energy and finance are the two that are not.
 *
 * The binder is looked up by PRODUCT name via the registry descriptor, so `--domain
 * health` and `--domain medicine` both find `bind/medicine.js`.
 */
function loadManifest(domain) {
  if (!domain) return { ok: false, why: 'no domain given, so no declared relationships can be loaded' };
  const d = resolveDomain(domain);
  if (!d) {
    return { ok: false, why: '"' + domain + '" is not one of the 20 canonical domains under either naming system' };
  }
  const p = path.join(REPO_ROOT, 'brain-v2', 'bind', d.binder + '.js');
  if (!fs.existsSync(p)) {
    return { ok: false, why: 'no binder at ' + p +
      (d.aliased ? ' (product name for snapshot key "' + d.snapshot + '")' : '') +
      ' -- this domain declares no relationships, so support cannot be established' };
  }
  try {
    const bind = require(path.resolve(p));
    const spec = bind.spec();
    const nameByKey = new Map();
    for (const c of (spec.channels || [])) nameByKey.set(c.key, c.name);
    return { ok: true, relationships: spec.relationships || [], nameByKey };
  } catch (e) {
    return { ok: false, why: 'binder at ' + p + ' failed to load: ' + e.message };
  }
}

/**
 * Which DECLARED relationships this data could actually test. Both sides must be moving
 * and each must carry at least MIN_OBSERVATIONS distinct source keys -- a pair is only as
 * testable as its weaker side.
 */
function testableRelationships(stats, manifest) {
  if (!manifest.ok) return [];
  const byName = new Map(stats.map((c) => [c.name, c]));
  const usableSide = (key) => {
    const name = manifest.nameByKey.get(key);
    const c = name ? byName.get(name) : null;
    return { key, name: name || null, ok: !!(c && c.moving && c.usableObservations >= MIN_OBSERVATIONS), stat: c || null };
  };
  const out = [];
  for (const rel of manifest.relationships) {
    const a = usableSide(rel.a), b = usableSide(rel.b);
    out.push({
      a: rel.a, b: rel.b, latent: rel.latent, expect: rel.expect,
      testable: a.ok && b.ok,
      /* The blocking side is named. "Untestable" without saying which half failed sends
         someone to look at both. */
      blockedBy: a.ok && b.ok ? null : [!a.ok ? rel.a : null, !b.ok ? rel.b : null].filter(Boolean).join(' + '),
      aKeys: a.stat ? a.stat.usableObservations : 0,
      bKeys: b.stat ? b.stat.usableObservations : 0
    });
  }
  return out;
}

function verdict(stats, manifest) {
  const identified = stats.filter((c) => c.identified);
  const moving = stats.filter((c) => c.moving);
  const usable = stats.filter((c) => c.identified && c.moving && c.usableObservations >= MIN_OBSERVATIONS);

  console.log('');
  console.log(pad('channel', 34) + pad('rows', 7) + pad('values', 8) + pad('src keys', 10) + pad('no key', 8) + 'usable');
  console.log('-'.repeat(76));
  for (const c of stats) {
    console.log(pad(c.name.slice(0, 33), 34) + pad(c.rows, 7) + pad(c.distinctValues, 8) +
      pad(c.distinctSourceKeys, 10) + pad(c.rowsWithoutKey, 8) +
      (c.identified && c.moving && c.usableObservations >= MIN_OBSERVATIONS ? 'YES' : 'no'));
  }
  console.log('');
  console.log('  channels                : ' + stats.length);
  console.log('  carrying a source key   : ' + identified.length);
  console.log('  actually moving         : ' + moving.length);
  console.log('  USABLE (both, >= ' + MIN_OBSERVATIONS + ' keys): ' + usable.length);
  console.log('');

  /* THE BAR IS A DECLARED RELATIONSHIP, not a channel count. */
  if (!manifest.ok) {
    console.log('  DECLARED RELATIONSHIPS: none loadable -- ' + manifest.why);
    console.log('');
    console.log('  VERDICT: ABSTAIN. Support for SPEC row 10 cannot be established without a');
    console.log('  declared relationship to test. Usable channels alone do not answer it: a');
    console.log('  divergence claim is a statement about a specific pair on a specific latent.');
    console.log('');
    return { usable, rels: [], testable: [] };
  }

  const rels = testableRelationships(stats, manifest);
  const testable = rels.filter((r) => r.testable);
  console.log('  DECLARED RELATIONSHIPS (' + rels.length + '):');
  for (const r of rels) {
    console.log('    ' + (r.testable ? 'TESTABLE ' : 'blocked  ') + pad(r.a + ' <-> ' + r.b, 32) +
      pad(r.aKeys + '/' + r.bKeys + ' keys', 14) +
      (r.testable ? r.latent : 'blocked by ' + r.blockedBy));
  }
  console.log('');
  if (testable.length) {
    console.log('  VERDICT: ' + testable.length + ' declared relationship(s) have BOTH sides moving and');
    console.log('  carrying at least ' + MIN_OBSERVATIONS + ' distinct source keys. Row 10 is testable on:');
    for (const r of testable) console.log('    ' + r.a + ' <-> ' + r.b + '  (' + r.latent + ')');
  } else if (identified.length === 0) {
    console.log('  VERDICT: NO channel carries a source-supplied key. This data cannot support');
    console.log('  SPEC row 10 at all -- every row is a poll, and polls are not observations.');
    console.log('  Rows recorded before the recorder kept `su` will always read this way.');
  } else {
    console.log('  VERDICT: ' + usable.length + ' channel(s) are usable, but NO declared relationship has');
    console.log('  both sides usable. Usable channels are not the bar -- a testable pair is.');
  }
  console.log('');
  return { usable, rels, testable };
}

async function build() {
  if (!DOMAIN) {
    console.error('need --domain <name>, or --analyze <fixture.json>');
    process.exit(2);
  }
  const d = resolveDomain(DOMAIN);
  if (!d) {
    console.error('"' + DOMAIN + '" is not one of the 20 canonical domains under either naming system');
    process.exit(2);
  }
  /* SNAPSHOT KEY for the feed. handlers/feed-record.js writes `feedhist:<snapshotKey>`,
     so asking for `medicine` returns nothing while `health` returns the history. */
  const url = BASE + '/api/feed-record?read=' + encodeURIComponent(d.snapshot) + '&n=' + N;
  if (d.aliased) {
    console.log('note: "' + DOMAIN + '" resolves to product ' + d.product +
                ', snapshot key ' + d.snapshot + ' (binder bind/' + d.binder + '.js)');
  }
  console.log('reading ' + url);
  const resp = await fetch(url);
  if (!resp.ok) { console.error('HTTP ' + resp.status); process.exit(1); }
  const json = await resp.json();
  if (!json || !json.ok || !Array.isArray(json.rows)) {
    console.error('unexpected response: ' + JSON.stringify(json).slice(0, 200));
    process.exit(1);
  }

  /* Oldest first, matching the existing fixture and what every replay expects. The
     endpoint returns newest-first. */
  const rows = json.rows.slice().sort((a, b) => a.t - b.t);
  if (!rows.length) { console.error('no rows recorded for "' + DOMAIN + '" yet'); process.exit(1); }

  /* The DEFAULT output is a repository location and resolves against the root; an
     explicit --out is the caller's path and resolves against their cwd. */
  /* SNAPSHOT KEY for the filename too, because that is what registry.fixturePath looks
     for. Writing `medicine-recorder.json` would produce a file nothing ever reads. */
  const out = arg('out', null) || path.join(REPO_ROOT, 'brain-v2', 'fixtures', d.snapshot + '-recorder.json');
  if (fs.existsSync(out) && !has('force')) {
    console.error('refusing to overwrite ' + out + ' — pass --force if that is intended.');
    console.error('A fixture is the evidence other results are quoted against; replacing one');
    console.error('silently would change what past numbers meant.');
    process.exit(1);
  }

  const stats = analyze(rows);
  const manifest = loadManifest(d.product);
  const { usable, rels, testable } = verdict(stats, manifest);

  const doc = {
    fetchedAt: rows[rows.length - 1].t,
    url: url,
    /* The SNAPSHOT key, matching what the registry validates a fixture's identity
       against. Both names are recorded so a reader never has to guess which layer this
       file belongs to. */
    domain: d.snapshot,
    productDomain: d.product,
    /* The verdict travels WITH the fixture. Anyone replaying it can see what it can and
       cannot support without re-deriving it, and a fixture that cannot support row 10
       says so on its face. */
    evidence: {
      rows: rows.length,
      spanMs: rows[rows.length - 1].t - rows[0].t,
      channels: stats.length,
      usableChannels: usable.map((c) => c.name),
      minObservations: MIN_OBSERVATIONS,
      /* Every declared relationship with its verdict, so the claim is auditable rather
         than a bare boolean somebody has to take on trust. */
      testableRelationships: testable.map((r) => ({ a: r.a, b: r.b, latent: r.latent })),
      declaredRelationships: rels.length,
      manifestLoaded: manifest.ok,
      manifestWhy: manifest.ok ? null : manifest.why,
      /* THE ONLY SOURCE OF THIS FLAG. Never a channel count: two usable channels in
         unrelated corners of a domain say nothing about whether any declared pair can be
         tested, and no binder means abstain rather than guess. */
      supportsIndependentObservations: manifest.ok && testable.length >= 1
    },
    rows: rows
  };
  fs.writeFileSync(out, JSON.stringify(doc, null, 0));
  console.log('wrote ' + out + ' — ' + rows.length + ' rows, ' +
    (doc.evidence.spanMs / 86400000).toFixed(1) + ' days');
  if (!doc.evidence.supportsIndependentObservations) {
    console.log('');
    console.log('NOTE: written, but it does NOT yet support row 10. See the verdict above.');
  }
}

if (!IS_CLI) {
  /* imported: expose the rules, run nothing */
} else if (ANALYZE) {
  const doc = JSON.parse(fs.readFileSync(ANALYZE, 'utf8'));
  const rows = (doc.rows || []).slice().sort((a, b) => a.t - b.t);
  console.log('');
  console.log('=== EVIDENCE CHECK: ' + ANALYZE + ' ===');
  console.log('rows ' + rows.length + (rows.length
    ? ', ' + ((rows[rows.length - 1].t - rows[0].t) / 86400000).toFixed(1) + ' days'
    : ''));
  /* The domain names the manifest. Taken from the fixture itself when it records one,
     else from --domain, else from the filename -- and if none of those resolve to a
     binder, the verdict abstains rather than falling back to a channel count. */
  const dom = doc.domain || DOMAIN ||
    path.basename(ANALYZE).replace(/-recorder[.]json$/, '').replace(/[.]json$/, '');
  /* Through the registry, so a fixture filed under a snapshot key still finds the binder
     filed under its product name. */
  const rd = resolveDomain(dom);
  verdict(analyze(rows), loadManifest(rd ? rd.product : dom));
} else {
  build().catch((e) => { console.error(e.message); process.exit(1); });
}

/* Exported so the evidence rule itself can be regression-tested offline. `analyze` and
   `testableRelationships` are pure; only build() touches the network. */
export { analyze, loadManifest, testableRelationships, resolveDomain, MIN_OBSERVATIONS };
