/* Speak the "What is this?" page once, in the narrator voice.
 *
 *   node scripts/generate-nova-voice.mjs --dry     what it would cost, no spend
 *   node scripts/generate-nova-voice.mjs           synthesise it
 *
 * WHY PRE-RENDERED. This text is static, unlike a meeting, so there is nothing to synthesise
 * per visitor. Rendered once, a thousand listeners cost exactly what one costs. It is also why
 * this does not go through /api/orb-voice: that endpoint allowlists the twenty cast domain
 * voices, and the narrator is deliberately not one of them.
 *
 * WHY `helix`. When the twenty domain voices were cast by measuring pitch, spread and pace
 * across all 26 xAI offers, two were held back — `orion` as a meeting moderator and `helix` as
 * the system narrator. This is the thing helix was reserved for. It has never been used.
 *
 * THE SPOKEN SCRIPT IS NOT THE SCREEN COPY, and that is deliberate. xAI's TTS takes no pacing
 * parameters, so rhythm has to be carried by the writing: short sentences, hard stops, a line
 * per beat. It states the same facts as the page and claims nothing the page does not — an
 * abridgement for delivery, not a different argument.
 *
 * Needs XAI_API_KEY. Reads .env.local so it never has to be passed on the command line.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'audio', 'nova');
const VOICE = 'helix';
const USD_PER_MCHAR = 15;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');

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

/* One line per beat. The blank lines are the pauses. */
const SCRIPT = [
  'Most organizations are structurally lesioned.',
  'They acquire, without removing. They grow, without maintenance. They add excitation, without matched inhibition.',
  'And then they accumulate debt. They lose flexibility. And they fail the way damaged brains fail.',
  'LIMEN Helix maps neural dynamics onto business and civilization systems. Using structural homology. Not metaphor.',
  'It builds the inhibition, the extinction, and the clearance mechanisms in from the start. So that an organization’s failure modes are visible. And recoverable.',
  'Consider the Energy domain. Right now.',
  'Its failure class is a gating failure. A gate, stuck closed. Starvation.',
  'The circuit runs thalamus, dorsolateral prefrontal, anterior cingulate, and motor cortex. The brake is the dorsolateral prefrontal cortex. And it is present.',
  'The same named failure. In neural tissue. And in a power grid.',
  'That is what homology has to mean, to be worth anything.',
  'What it does. It detects pathology, and it names it. There is no autonomous correction. A human reads the diagnosis, and decides.',
  'It learns only from verified outcomes. Its validated scorer returns nothing at all, rather than a plausible number it cannot stand behind. Silence, instead of noise.',
  'What it is being built to do. Transfer cross-domain integration, out of the operator, and into the substrate. Today, a human still holds that loop. That is the long goal. And it is not done.',
  'Twenty domain units are running. The consolidation cycles are firing. The execution gates remain observe only. By design. Not by accident.',
  'Partially built. And saying so.'
].join('\n\n');

const chars = SCRIPT.length;
const cost = (chars / 1e6) * USD_PER_MCHAR;
console.log(`voice: ${VOICE}`);
console.log(`${chars} characters, $${cost.toFixed(4)} at $${USD_PER_MCHAR}/M`);
console.log(`out:   assets/audio/nova/what-is-this.mp3`);

if (DRY) { console.log('\ndry run, nothing synthesised'); process.exit(0); }

const KEY = env('XAI_API_KEY');
if (!KEY) { console.error('XAI_API_KEY not found in env or .env.local'); process.exit(1); }

const r = await fetch('https://api.x.ai/v1/tts', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  // `language` is REQUIRED and absent from the public docs summary; omitting it returns 422.
  body: JSON.stringify({ voice: VOICE, language: 'en', text: SCRIPT, format: 'mp3' })
});
if (!r.ok) { console.error('FAIL HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }

const buf = Buffer.from(await r.arrayBuffer());
// A short body is a failure that arrived with a 200. Do not write it.
if (buf.length < 2000) { console.error('FAIL: empty clip'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const mp3 = join(OUT, 'what-is-this.mp3');
writeFileSync(mp3, buf);

/* xAI returns a music bitrate. Speech at 48 kbps mono is indistinguishable and roughly a third
   the size, which matters for how long a visitor waits before the narrator starts. Skipped
   silently if ffmpeg is absent: a big correct file beats no file. */
try {
  const tmp = mp3 + '.tmp.mp3';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-b:a', '48k', '-ar', '22050', tmp], { stdio: 'ignore' });
  if (statSync(tmp).size > 2000) renameSync(tmp, mp3); else unlinkSync(tmp);
} catch { /* no ffmpeg; keep the original */ }

writeFileSync(join(OUT, 'what-is-this.txt'), SCRIPT, 'utf8');
console.log(`\nwrote ${(statSync(mp3).size / 1024).toFixed(0)} KB, spent $${cost.toFixed(4)}`);
