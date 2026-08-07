/* Convene a room, and write down what each manager asked for.
 *
 *   node scripts/record-meeting.mjs                 the full table, all twenty
 *   node scripts/record-meeting.mjs energy          the room energy is wired to
 *   node scripts/record-meeting.mjs --dry           show what would be written, write nothing
 *   node scripts/record-meeting.mjs --show          print the ledger and stop
 *   node scripts/record-meeting.mjs --local         read the APIs from 127.0.0.1:8899
 *
 * WHY A SCRIPT AND NOT THE PAGE. The public atlas is read-only on purpose. A write endpoint
 * reachable from a public page is an open invitation to fill the ledger with junk, and the
 * record of what the managers asked for is exactly the thing that must not be forgeable. The
 * meeting a visitor watches is a performance of the same deterministic function; this is the
 * one that counts.
 *
 * WHAT GETS STORED is one row per commitment: who asked whom, which direction the pathway
 * runs, and — the part that makes it answerable later — the reading it will be judged
 * against. See lib/orb-ledger.js.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ORB = require(join(ROOT, 'assets/js/orb-briefing.js'));
const LEDGER = require(join(ROOT, 'lib/orb-ledger.js'));

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const SHOW = argv.includes('--show');
const BASE = argv.includes('--local') ? 'http://127.0.0.1:8899' : 'https://limenhelix.com';
const target = argv.find((a) => !a.startsWith('--')) || null;

// .env.local so UPSTASH credentials, when present, pick the redis backend without being passed in.
if (existsSync(join(ROOT, '.env.local'))) {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const getJSON = async (u) => {
  try { const r = await fetch(u, { headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
        return r.ok ? await r.json() : null; } catch { return null; }
};

if (SHOW) {
  const rows = await LEDGER.readAll();
  console.log('backend: ' + LEDGER.backend());
  console.log(rows.length + ' entries\n');
  for (const e of rows.slice(-40)) {
    const w = e.witness || {};
    console.log(`${e.t}  ${String(e.kind).padEnd(5)} ${e.fromName} -> ${e.toName}` +
                `   watch ${e.watch}.${w.channel || '—'} = ${w.value === null || w.value === undefined ? '—' : w.value}` +
                (w.frozen ? '  [FROZEN, cannot settle]' : ''));
  }
  process.exit(0);
}

console.log('reading ' + BASE + ' …');
const cache = { snap: null, opps: null, cons: null, subs: {}, news: {} };
[cache.snap, cache.opps, cache.cons] = await Promise.all([
  getJSON(BASE + '/api/domain-snapshot'),
  getJSON(BASE + '/api/limen-snapshot?type=opportunities'),
  getJSON(BASE + '/api/limen-snapshot?type=console')
]);
if (!cache.snap) { console.error('no domain-snapshot; refusing to record a meeting with no data'); process.exit(1); }

const room = target ? ORB.roomFor(target) : ORB.DOMAINS.map(([id]) => id);
if (room.length < 2) { console.error('room too small: ' + room.join(',')); process.exit(1); }

await Promise.all(room.map(async (id) => {
  cache.subs[id] = await getJSON(BASE + '/assets/data/deep/' + id + '-neuro-substrate.json');
  if (ORB.NEWS[id]) cache.news[id] = await getJSON(BASE + '/api/' + id + '-news');
}));

/* The witness channel. Of the 170 stress-history channels, 56 are pinned flat, and a pinned
   channel can never settle anything. Pick the one that has actually moved the most, and when
   nothing has moved say so in the row rather than storing a number that cannot mean anything
   later. An entry that admits it is unfalsifiable is worth more than one that pretends. */
const hist = await getJSON(BASE + '/api/grounded-stress-history?all=1');

/* TWO NAMES FOR THREE DOMAINS. The orbs use the PRODUCT name (medicine, science, trade); the
   snapshot, recorder and stress history use the SNAPSHOT key (health, research, supplyChain).
   Without this those three would have silently recorded "no history" forever — which the dry
   run did show, and which is exactly the kind of miss that looks like missing data rather
   than a naming bug.

   HELD LOCALLY ON PURPOSE, and this is a deliberate exception to a rule I would normally
   follow. A canonical owner of this mapping exists elsewhere in the repo, and the better
   engineering is always to read it rather than keep a copy. That area is off limits by
   operator instruction, so this is a copy.

   A copy can go stale, so it is not trusted — the check below verifies it against the live
   history every run. If a fourth domain is ever split, or one of these three is renamed, the
   run that first hits it says so out loud. Drift becomes a warning at the moment it happens
   rather than an unmeasurable row nobody notices for weeks. */
const TO_SNAPSHOT = { medicine: 'health', science: 'research', trade: 'supplyChain' };
const snapKey = (id) => TO_SNAPSHOT[id] || id;

if (hist && hist.domains) {
  const unmapped = ORB.DOMAINS.map(([id]) => id).filter((id) => !hist.domains[snapKey(id)]);
  if (unmapped.length) {
    console.warn('\n  [warn] no stress history under either name for: ' + unmapped.join(', '));
    console.warn('  [warn] the product/snapshot map in this file is probably out of date;');
    console.warn('  [warn] commitments watching those domains cannot ever be settled.\n');
  }
}

function witnessFor(id) {
  const chans = (hist && hist.domains && hist.domains[snapKey(id)] && hist.domains[snapKey(id)].channels) || null;
  if (!chans) return { channel: null, value: null, points: 0, frozen: true, why: 'no history for domain' };
  let best = null;
  for (const [name, arr] of Object.entries(chans)) {
    if (!Array.isArray(arr) || arr.length < 2) continue;
    const span = Math.max(...arr) - Math.min(...arr);
    if (!best || span > best.span) best = { name, span, arr };
  }
  if (!best) return { channel: null, value: null, points: 0, frozen: true, why: 'no usable channel' };
  const frozen = best.span <= 1e-6;
  return { channel: best.name, value: best.arr[best.arr.length - 1], points: best.arr.length,
           span: Number(best.span.toFixed(6)), frozen: frozen,
           why: frozen ? 'channel is flat across its whole series' : undefined };
}

const turns = ORB.meeting(room, cache);
const at = new Date().toISOString();
const rows = [];
for (const t of turns) {
  if (!t.commit) continue;                        // that turn committed to nothing
  const c = t.commit;
  rows.push({
    t: at, room: room, from: c.from, to: c.to, fromName: c.fromName, toName: c.toName,
    kind: c.kind, watch: c.watch, witness: witnessFor(c.watch),
    said: t.lines[t.lines.length - 1]
  });
}

console.log(`\nroom: ${room.join(', ')}`);
console.log(`${turns.length} turns, ${rows.length} commitments\n`);
for (const r of rows) {
  const w = r.witness;
  console.log(`  ${String(r.kind).padEnd(5)} ${r.fromName} -> ${r.toName}   ` +
              `watch ${r.watch}.${w.channel || '—'} = ${w.value ?? '—'}` +
              (w.frozen ? `  [FROZEN: ${w.why}]` : ` (${w.points} pts, span ${w.span})`));
}

const settleable = rows.filter((r) => !r.witness.frozen).length;
console.log(`\n${settleable} of ${rows.length} can ever be settled; the rest watch a frozen channel.`);

if (DRY) { console.log('\ndry run, nothing written'); process.exit(0); }
const res = await LEDGER.append(rows);
console.log(`\nwrote ${res.written} to ${res.backend}`);
