/* Speak the "What is this?" page, in the narrator voice, in sections.
 *
 *   node scripts/generate-nova-voice.mjs --dry     what it would cost, no spend
 *   node scripts/generate-nova-voice.mjs           synthesise every changed section
 *   node scripts/generate-nova-voice.mjs --all     force all of them
 *
 * WHY SECTIONS AND NOT ONE FILE. The first cut was a single 96-second clip, and it read 54%
 * of the page — an abridgement I wrote, which from a listener's side is indistinguishable from
 * the audio cutting off. This reads the whole page. Split into sections so the first words
 * start while the rest is still downloading, instead of three minutes of silence first, and so
 * changing one paragraph re-renders one section rather than the lot.
 *
 * WHY PRE-RENDERED. The text is static, unlike a meeting, so a thousand listeners cost exactly
 * what one costs. It also cannot go through /api/orb-voice: that endpoint allowlists the twenty
 * cast domain voices, and the narrator is deliberately not one of them.
 *
 * WHY `helix`. When the twenty domain voices were cast by measuring pitch, spread and pace
 * across all 26 xAI offers, two were held back — `orion` as a meeting moderator and `helix` as
 * the system narrator. This is what helix was reserved for.
 *
 * THE SPOKEN SCRIPT IS NOT THE SCREEN COPY WORD FOR WORD, and that is deliberate: xAI's TTS
 * takes no pacing parameters, so rhythm has to be carried by the writing — short sentences,
 * hard stops, one line per beat. It now covers every section the page shows, states the same
 * facts, and claims nothing the page does not. The live figures are NOT spoken, because a
 * recording cannot track a number that moves; the page shows those and the narrator says only
 * what is permanent about them.
 *
 * Needs XAI_API_KEY. Reads .env.local so it never has to be passed on the command line.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'audio', 'nova');
const VOICE = 'helix';
const USD_PER_MCHAR = 15;
const CEILING_USD = 0.50;          // a run wanting more than this has gone wrong

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry'), ALL = argv.includes('--all');

function env(k) {
  if (process.env[k]) return process.env[k];
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

/* One line per beat; blank lines are the pauses. Section 1 is deliberately tiny so the voice
   starts almost immediately after the star ignites. */
const SECTIONS = [
  { id: '01-hook', lines: [
    'Most organizations are structurally lesioned.'
  ]},
  { id: '02-lesion', lines: [
    'They acquire, without removing. They grow, without maintenance. They add excitation, without matched inhibition.',
    'And then they accumulate debt. They lose flexibility. And they fail the way damaged brains fail.'
  ]},
  { id: '03-thesis', lines: [
    'LIMEN Helix maps neural dynamics onto business and civilization systems. Using structural homology. Not metaphor.',
    'It builds the inhibition, the extinction, and the clearance mechanisms in from the start. So that an organization’s failure modes are visible. And recoverable.'
  ]},
  { id: '04-example', lines: [
    'One worked example. Read live. Not an illustration. This is what the system is saying about the Energy domain right now, pulled from this page as you read it.',
    'Its failure class is a gating failure. A gate, stuck closed. Starvation.',
    'The circuit runs thalamus, dorsolateral prefrontal, anterior cingulate, and motor cortex. The brake is the dorsolateral prefrontal cortex. And it is present.',
    'The same named failure mode. In neural tissue. And in a power grid. With the regulatory partner identified, and its presence stated.',
    'That is what homology, not metaphor, has to mean, to be worth anything.'
  ]},
  { id: '05-does', lines: [
    'What it does. It detects pathology, and it names it. Gating failures. Disinhibition. Oscillatory pathology. Seizure-like runaway. Incomplete circuits.',
    'There is no autonomous correction. A human reads the diagnosis, and decides.',
    'It routes decisions through a hierarchy that preserves the brain’s feedforward and feedback lamination, and thalamic gating for filtering. Preventing both flooding, and starvation.',
    'It learns only from verified outcomes. Not self-report. Its validated scorer returns nothing at all, rather than a plausible number it cannot stand behind. Silence, instead of noise.',
    'It scales time constants across neural, business, and civilization, while preserving the parameter ratios. The fractal invariant.',
    'Twenty domain units feed one integration layer, over an inter-brain bus, with cron-driven consolidation. Each domain is a brain. Not a silo.'
  ]},
  { id: '06-building', lines: [
    'What it is being built to do. Transfer cross-domain integration, out of the operator, and into the substrate.',
    'Today, a human still holds that loop, and reweights by hand when one domain contradicts another. Moving it into the system is the long goal. And it is not done.',
    'Consolidate offline. The cycles run. In shadow, and observe only.',
    'And execute gated actions. Action selection is dark-armed, and stays that way until the loop is proven on a single domain, against ground truth.'
  ]},
  { id: '07-state', lines: [
    'Current state. Live now. Twenty domain units running. Cron-driven consolidation firing on schedule. Deployed with durable persistence. The validated scorer returning verified outcomes only.',
    'Not finished, and said plainly. Partially built. The integration transfer is staged. Not delivered. The execution gates remain observe only. By design. Not by accident.'
  ]}
];

const jobs = SECTIONS.map((s, i) => {
  const text = s.lines.join('\n\n');
  const hash = createHash('sha1').update(VOICE + ' ' + text).digest('hex').slice(0, 16);
  const file = s.id + '.mp3';
  return { n: i, id: s.id, file, text, chars: text.length, hash };
});

const mpath = join(OUT, 'manifest.json');
const prev = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : { sections: {} };
for (const j of jobs) {
  const old = prev.sections && prev.sections[j.id];
  j.stale = ALL || !old || old.hash !== j.hash || !existsSync(join(OUT, j.file));
}

const todo = jobs.filter(j => j.stale);
const chars = todo.reduce((a, j) => a + j.chars, 0);
const total = jobs.reduce((a, j) => a + j.chars, 0);
const cost = (chars / 1e6) * USD_PER_MCHAR;

console.log(`voice: ${VOICE}`);
console.log(`${jobs.length} sections, ${total} characters total, ~${Math.round(total / 16.5)}s spoken`);
console.log(`${todo.length} to render, ${chars} characters, $${cost.toFixed(4)}\n`);
for (const j of jobs) console.log(`  ${j.stale ? 'SPEAK' : ' keep'}  ${j.id.padEnd(13)}${String(j.chars).padStart(5)} chars`);

if (DRY) { console.log('\ndry run, nothing synthesised'); process.exit(0); }
if (!todo.length) { console.log('\nnothing changed'); process.exit(0); }
if (cost > CEILING_USD) { console.error(`\n$${cost.toFixed(2)} exceeds the $${CEILING_USD} ceiling`); process.exit(1); }

const KEY = env('XAI_API_KEY');
if (!KEY) { console.error('XAI_API_KEY not found in env or .env.local'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

/* Re-encode to 48 kbps mono. Speech, not music. Skipped silently without ffmpeg: a big
   correct file beats no file. */
function shrink(p) {
  try {
    const tmp = p + '.tmp.mp3';
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', p, '-ac', '1', '-b:a', '48k', '-ar', '22050', tmp], { stdio: 'ignore' });
    if (statSync(tmp).size > 2000) { renameSync(tmp, p); return; }
    unlinkSync(tmp);
  } catch { /* keep the original */ }
}

const manifest = { voice: VOICE, generated: new Date().toISOString(), order: jobs.map(j => j.file),
                   sections: { ...(prev.sections || {}) } };
let spent = 0;
for (const j of todo) {
  const r = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    // `language` is REQUIRED and absent from the public docs summary; omitting it returns 422.
    body: JSON.stringify({ voice: VOICE, language: 'en', text: j.text, format: 'mp3' })
  });
  if (!r.ok) { console.error(`  FAIL ${j.id} HTTP ${r.status} ${(await r.text()).slice(0, 160)}`); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  // A short body is a failure that arrived with a 200. Do not write it.
  if (buf.length < 2000) { console.error(`  FAIL ${j.id} empty clip`); continue; }
  const p = join(OUT, j.file);
  writeFileSync(p, buf);
  shrink(p);
  spent += (j.chars / 1e6) * USD_PER_MCHAR;
  console.log(`  ok   ${j.id.padEnd(13)}${(statSync(p).size / 1024).toFixed(0)} KB`);
}

// Kept sections keep their entry; re-stat every file so sizes are never stale.
for (const j of jobs) {
  let bytes = null;
  try { bytes = statSync(join(OUT, j.file)).size; } catch { /* never rendered */ }
  manifest.sections[j.id] = { file: j.file, hash: j.hash, chars: j.chars, bytes, text: j.text };
}
writeFileSync(mpath, JSON.stringify(manifest, null, 1));
writeFileSync(join(OUT, 'what-is-this.txt'), jobs.map(j => j.text).join('\n\n'), 'utf8');
console.log(`\nspent $${spent.toFixed(4)}\nmanifest: assets/audio/nova/manifest.json`);
