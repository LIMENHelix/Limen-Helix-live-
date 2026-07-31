// scripts/sense/organ-kernel.mjs — kernel coverage organ (K1/K2/K3).
//
// Reframed 2026-05-29 per direction "rendering should not gate on K1".
//
// Three kernel slots:
//   K1 = financial / autonomic (limen_v4_kernel.js + Pass 1)
//        Coverage gap is expected (banks/insurers/REITs excluded, ETFs,
//        private, pre-revenue, bankrupt with <2Q data, off-CB portals).
//        K1-null is INFORMATIONAL, not a system failure.
//   K2 = financial × relational / polyvagal (Pass 2, phase_engine.py). RESERVED slot.
//        Thing 2 is the interpretive, never-validated layer — explicitly NOT a public
//        default (per the Thing taxonomy). K2-null is EXPECTED, not a failure; it does
//        not penalize the organ score (operator decision 2026-06-24, treat like K3).
//   K3 = relational-only (slot reserved). Future fill for any portal that
//        K1 and K2 can't reach. For now: always null, slot present in schema.
//
// Per-portal kernel coverage is read from portal.kernelReadings.{k1, k2, k3}.
// Legacy K1 readings still live at portal.financialHealth.composite; we
// honor both during the migration window.
import fs from 'node:fs';
import { inputs } from './_inputs.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORTAL_DIR = path.join(ROOT, 'assets', 'data', 'companies');

export const id = 'kernel';
export const role = 'kernel coverage (K1 financial validated · K2 polyvagal + K3 relational — reserved)';
export const order = 50;

const FILES = {
  v4: path.join(ROOT, 'limen-helix-api', 'limen_v4_kernel.js'),
  backtest: path.join(ROOT, 'limen-helix-api', 'limen_backtest_kernel.js'),
  helixApp: path.join(ROOT, 'api', 'helix_app', 'index.py'),
  phaseEngine: path.join(ROOT, 'api', 'helix_app', 'thing2', 'phase_engine.py'),
  manifest: path.join(ROOT, 'assets', 'data', 'companies-manifest.json')
};

function hasK1(p) {
  // legacy K1 reading lives at financialHealth — but portals store the score as
  // `compositeScore`, NOT `composite` (same field-name drift fixed in
  // kernel-reading-helper.js). Checking only `.composite` read undefined and
  // reported K1 0% while 539/798 portals actually carry a real financial score.
  // Accept either field so the kernel organ reflects reality.
  const fh = p.financialHealth;
  if (fh && (typeof fh.compositeScore === 'number' || typeof fh.composite === 'number')) return true;
  // new shape: kernelReadings.k1.composite
  if (p.kernelReadings && p.kernelReadings.k1 && typeof p.kernelReadings.k1.composite === 'number') return true;
  return false;
}
function hasK2(p) {
  return !!(p.kernelReadings && p.kernelReadings.k2 && typeof p.kernelReadings.k2 === 'object' && (p.kernelReadings.k2.phase || p.kernelReadings.k2.dominantPhase || p.kernelReadings.k2.coupling_mode));
}
function hasK3(p) {
  return !!(p.kernelReadings && p.kernelReadings.k3 && typeof p.kernelReadings.k3 === 'object' && p.kernelReadings.k3.phase);
}

export function sense() {
  const present = {};
  for (const k in FILES) present[k] = fs.existsSync(FILES[k]);

  // walk portals, count per-kernel coverage
  let total = 0;
  let k1Have = 0, k2Have = 0, k3Have = 0;
  let anyKernel = 0;     // portals with at least one kernel reading
  let blindPortals = []; // portals with NO kernel reading (the K3 frontier)
  let bySector = {};     // sector → { total, k1, k2, k3, blind }

  /**
   * An unreadable corpus dir used to collapse to files = [], which makes total = 0 and every
   * coverage figure read as "no portals have kernel readings". The findings below happen to be
   * guarded by `total > 0`, so it has not fired — but that is luck, not design, and the next
   * finding added here would inherit the hazard. io.dir returns null on failure, never [].
   */
  const io = inputs();
  const filesOrNull = io.dir(PORTAL_DIR, 'assets/data/companies/', f => f.endsWith('.json') && !f.startsWith('_'));
  const corpusReadable = filesOrNull !== null;
  const files = filesOrNull || [];
  for (const f of files) {
    let p; try { p = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, f), 'utf8')); } catch (e) { continue; }
    total++;
    const slug = f.replace(/\.json$/, '');
    const sector = String(p.sector || p.industry || p.domainId || 'unknown').toLowerCase();
    bySector[sector] = bySector[sector] || { total: 0, k1: 0, k2: 0, k3: 0, blind: 0 };
    bySector[sector].total++;

    const k1 = hasK1(p), k2 = hasK2(p), k3 = hasK3(p);
    if (k1) { k1Have++; bySector[sector].k1++; }
    if (k2) { k2Have++; bySector[sector].k2++; }
    if (k3) { k3Have++; bySector[sector].k3++; }
    if (k1 || k2 || k3) anyKernel++;
    else {
      bySector[sector].blind++;
      if (blindPortals.length < 25) blindPortals.push({ slug, name: p.name, sector: p.sector || p.industry, domain: p.domainId });
    }
  }

  // CIK collisions in manifest (kept from prior detector)
  let manifestCount = 0, cikCollisions = [], cikSegments = [];
  if (present.manifest) {
    try {
      const m = JSON.parse(fs.readFileSync(FILES.manifest, 'utf8'));
      const slugList = Array.isArray(m.slugs) ? m.slugs : (Array.isArray(m) ? m : Object.keys(m.index || {}));
      manifestCount = (typeof m.count === 'number') ? m.count : slugList.length;
      const cikIndex = {}, nameBy = {};
      const index = m.index || {};
      for (const slug of slugList) {
        const row = (typeof index[slug] === 'object') ? index[slug] : null;
        const cik = String((row && (row.cik || row.c)) || '').replace(/^0+/, '');
        if (!cik) continue;
        (cikIndex[cik] = cikIndex[cik] || []).push(slug);
        nameBy[slug] = String((row && (row.name || row.n)) || slug);
      }
      // A shared CIK is INTENTIONAL when an entry is an explicitly-named segment /
      // division of a filer — a division has no own SEC CIK, so it shares the
      // parent's (e.g. Abbott + its CGM/Metabolic division, SIC 3842 vs 2834).
      // That is informational, not a defect. It is an ACCIDENTAL DUP (HIGH) only
      // when NO colliding entry carries a segment marker (a true duplicate).
      for (const cik in cikIndex) {
        if (cikIndex[cik].length <= 1) continue;
        const slugs = cikIndex[cik];
        const names = slugs.map(s => nameBy[s]);
        const isSegment = names.some(n => /\(|division|segment|\bunit\b|\barm\b/i.test(n));
        (isSegment ? cikSegments : cikCollisions).push({ cik, slugs, names });
      }
    } catch (e) { /* keep zero */ }
  }

  // coverage ratios
  const k1Cov = total ? +(k1Have / total).toFixed(3) : 0;
  const k2Cov = total ? +(k2Have / total).toFixed(3) : 0;
  const k3Cov = total ? +(k3Have / total).toFixed(3) : 0;
  const anyCov = total ? +(anyKernel / total).toFixed(3) : 0;

  // sectors with worst coverage (rank by anyKernel = 0)
  const sectorList = Object.entries(bySector).map(([s, b]) => ({ sector: s, total: b.total, k1: b.k1, k2: b.k2, k3: b.k3, blind: b.blind, anyRate: b.total ? +((b.total - b.blind) / b.total).toFixed(2) : 0 }));
  sectorList.sort((a, b) => a.anyRate - b.anyRate || b.blind - a.blind);
  const worstSectors = sectorList.slice(0, 10);

  const attention = [];
  // K2 = Thing 2 polyvagal: interpretive, never-validated, NOT a public default → RESERVED slot.
  // Empty K2 is expected/acceptable (informational), not a system failure. To build it out later:
  // repoint persist-k2-readings.mjs (its /api/helix/helix-report/score route 404s) + have the
  // Python kernel emit the Thing 2 section (currently stays intrinsic_only with no relational signal).
  if (corpusReadable && k2Cov < 1.0 && total > 0) attention.push({ issue: 'K2 (Thing 2 polyvagal) reserved — not populated', severity: 'low', count: total - k2Have, action: 'EXPECTED: Thing 2 is the interpretive, unvalidated layer (not a public default). Building it out is optional — repoint persist-k2-readings.mjs + emit the Thing 2 section.', organ: id });
  // Blind portals — no kernel of any kind. These are the K3 frontier.
  if (corpusReadable && (blindPortals.length > 0 || (total - anyKernel) > 0)) attention.push({ issue: 'Portals with NO kernel reading (K1/K2/K3 all empty) — K3 frontier', severity: 'med', count: total - anyKernel, action: 'these are where K3 needs to land. For now: ensure K2 fires post-relaxation. K3 design pending.', organ: id });
  if (corpusReadable && k1Cov === 0 && total > 0) attention.push({ issue: 'K1 (financial kernel) ZERO coverage — expected during migration if all readings are in legacy financialHealth slot', severity: 'low', count: total, action: 'informational — K1 nulls are expected for off-EDGAR portals', organ: id });
  const ioItem = io.attention(id); if (ioItem) attention.push(ioItem);
  if (cikCollisions.length > 0) attention.push({ issue: 'Accidental CIK duplicates in companies-manifest', severity: 'high', count: cikCollisions.length, action: 'dedup — same-CIK entries with no segment marker (true duplicates)', organ: id });
  if (cikSegments.length > 0) attention.push({ issue: 'Segment breakouts sharing a parent CIK (intentional)', severity: 'low', count: cikSegments.length, action: 'informational — distinct named divisions of one SEC filer (a division has no own CIK); e.g. ' + (cikSegments[0].names || []).join(' + '), organ: id });
  /**
   * api/helix_app/ holds .py files. The immune workflow checks out `api/` so they should be
   * present, but a .py under a JS tree is exactly the kind of path a future cone edit drops.
   * State the ambiguity in the action rather than asserting the kernel was deleted.
   */
  if (!present.helixApp || !present.phaseEngine) attention.push({ issue: 'Python kernel files not found', severity: 'high', count: Object.values(present).filter(v => !v).length, action: 'restore api/helix_app/ — but FIRST confirm this is not a checkout gap: api/ is in the immune-system.yml sparse list, so if this appears only in CI, check the cone before assuming deletion', organ: id });

  // Score reflects only ACTIVE kernels. K1 is the validated kernel. K2 (Thing 2 polyvagal)
  // and K3 (relational-only) are RESERVED interpretive slots — Thing 2 is explicitly NOT a
  // validated public default (per the Thing taxonomy), so an empty K2/K3 must NOT penalize the
  // score the way an empty validated kernel would. We average only slots that are active:
  // K1 always counts; K2/K3 count only once they actually carry readings (so building them
  // out later still raises the bar). Operator decision 2026-06-24: treat K2 as reserved like K3.
  const k1Score = Math.round(k1Cov * 100);
  const k2Score = Math.round(k2Cov * 100);
  const k3Score = Math.round(k3Cov * 100);
  const activeScores = [k1Score];
  if (k2Have > 0) activeScores.push(k2Score);   // K2 reserved until populated
  if (k3Have > 0) activeScores.push(k3Score);   // K3 reserved until built
  const score = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `K1 ${k1Have}/${total} (${Math.round(k1Cov * 100)}%) · K2 ${k2Have}/${total} (${Math.round(k2Cov * 100)}%) · K3 ${k3Have}/${total} (reserved) · any-kernel ${anyKernel}/${total} (${Math.round(anyCov * 100)}%)`,
    metrics: {
      total,
      coverage: { k1: k1Cov, k2: k2Cov, k3: k3Cov, anyKernel: anyCov },
      counts: { k1: k1Have, k2: k2Have, k3: k3Have, anyKernel, blind: total - anyKernel },
      slotScores: { k1: k1Score, k2: k2Score, k3: k3Score },
      blindPortals,
      worstSectors,
      present,
      manifestCount,
      cikCollisions: cikCollisions.slice(0, 15),
      cikSegments: cikSegments.slice(0, 15),
      note: 'K2 (Thing 2 polyvagal) and K3 (relational-only) are RESERVED interpretive slots — not validated public defaults — so they do not penalize the score; only active kernels (K1 + any reserved slot once populated) are averaged. Rendering surfaces should read kernelReadings.primary to be kernel-agnostic.'
    },
    attention
  };
}
