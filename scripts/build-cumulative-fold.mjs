#!/usr/bin/env node
/**
 * build-cumulative-fold.mjs — the afferent upward fold (operator's model).
 *
 * Every portal is a neuron; its children are its afferent inputs. Instead of
 * dumping all descendants into a flat bucket (what build-diagnosis-digest did),
 * this folds each subtree's reading UP into its parent, bottom to top, so the
 * deep signal MOVES FORWARD into the reachable surface (L1-L3, the only levels
 * that deploy). Read an L3 portal and you transitively hold everything beneath
 * it (L4-L7) — its reading already integrated the deep tree.
 *
 *   reading(L6) -> folded into reading(L5) -> reading(L4) -> reading(L3)
 *
 * Deterministic. No LLM, no agents. It runs the node-guard so only REAL nodes
 * fold forward (non-nodes are braked + counted, never carried as a binding).
 *
 * Reads the FULL repo (which holds the ~466k deep tree); writes ONE compact
 * fold file per domain into the LIVE repo's assets/data/deep/ (deploys).
 * Per-domain streaming keeps memory bounded to one subtree at a time.
 *
 * Output per surface portal (L1-L3): its own issue count + the folded subtree:
 *   descendant count, distress mass, real-node histogram (top nodes + motif),
 *   heaviest contributor path (the drill breadcrumb), and braked-binding count.
 * The live derivation layer (domain-brain-base) then lights each real node in
 * that folded set from feeds x motif — structure baked here, level live there.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE_ROOT = path.resolve(HERE, '..');
const FULL_DOMAINS = 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
const LIVE_DOMAINS = path.join(LIVE_ROOT, 'assets', 'data', 'domains');
const SRC = fs.existsSync(FULL_DOMAINS) ? FULL_DOMAINS : LIVE_DOMAINS;
const OUT_DIR = path.join(LIVE_ROOT, 'assets', 'data', 'deep');
const SURFACE_MAX_DEPTH = 3;     // L1-L3 = the levels that actually deploy
const TOP_NODES = 15;
const TOP_CONTRIB = 3;

// ── canonical-node classification (same source of truth as lib/node-guard) ──
const canon = JSON.parse(fs.readFileSync(path.join(LIVE_ROOT, 'assets', 'data', 'canonical-nodes.json'), 'utf8')).nodes || {};
function realNode(id) { const r = canon[id]; return r && r.canBindBusiness ? r : null; }
function motifOf(id) { const r = canon[id]; return r ? (r.motif || null) : null; }

const onlyArg = process.argv[2] || null; // optional: fold a single domain (proof/time run)

// depth = underscore segments; parent = drop last segment
function depthOf(slug) { return slug.split('_').length; }
function parentOf(slug) { const i = slug.lastIndexOf('_'); return i < 0 ? null : slug.slice(0, i); }

// the foldable per-portal own signal
function ownSignal(j) {
  const nodes = {};   // real node id -> count
  let blocked = 0;
  const add = (id) => { if (!id) return; if (realNode(id)) nodes[id] = (nodes[id] || 0) + 1; else if (canon[id] || id) blocked++; };
  (j.issues || []).forEach(iss => (iss.circuits || []).forEach(c => add(c && c.nodeId)));
  (j.activations || []).forEach(a => add(a && a.brainNodeId));
  return { issues: (j.issues || []).length, nodes, blocked };
}

function mergeHist(into, from, w) { for (const k in from) into[k] = (into[k] || 0) + from[k] * (w || 1); }

function foldDomain(root) {
  // gather this domain's files only (bounds memory to one subtree)
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json') && (f === root + '.json' || f.startsWith(root + '_')));
  if (!files.length) return null;

  // pass 1: read each portal's own signal (minimal record kept)
  const rec = new Map(); // slug -> { depth, own, sub }
  const childrenOf = new Map(); // parentSlug -> [childSlug]
  let read = 0;
  for (const f of files) {
    const slug = f.slice(0, -5);
    let j; try { j = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch { continue; }
    const own = ownSignal(j);
    rec.set(slug, {
      depth: depthOf(slug), own,
      // subtree accumulators (seed with own; children fold in during pass 2)
      sub: { count: 0, mass: own.issues, nodes: Object.assign({}, own.nodes), blocked: own.blocked, contrib: [] }
    });
    const p = parentOf(slug);
    if (p) { if (!childrenOf.has(p)) childrenOf.set(p, []); childrenOf.get(p).push(slug); }
    if (++read % 25000 === 0) process.stdout.write('    read ' + read + '/' + files.length + '\r');
  }

  // pass 2: fold bottom-up. Process deepest-first so a child is always folded
  // before its parent absorbs it.
  const slugs = [...rec.keys()].sort((a, b) => rec.get(b).depth - rec.get(a).depth);
  for (const slug of slugs) {
    const p = parentOf(slug);
    if (!p || !rec.has(p)) continue;
    const c = rec.get(slug), par = rec.get(p);
    par.sub.count += 1 + c.sub.count;
    par.sub.mass += c.sub.mass;
    par.sub.blocked += c.sub.blocked;
    mergeHist(par.sub.nodes, c.sub.nodes, 1);
    // remember this child as a contributor (by folded mass) for the breadcrumb
    par.sub.contrib.push({ slug: slug, mass: c.sub.mass, count: c.sub.count });
  }

  // emit the surface (L1-L3) with each portal's folded subtree summary
  const surface = [];
  for (const [slug, r] of rec) {
    if (r.depth > SURFACE_MAX_DEPTH) continue;
    const topNodes = Object.keys(r.sub.nodes)
      .sort((a, b) => r.sub.nodes[b] - r.sub.nodes[a])
      .slice(0, TOP_NODES)
      .map(id => ({ id, motif: motifOf(id), count: Math.round(r.sub.nodes[id]) }));
    // heaviest contributor path: follow the top-mass child down a few hops
    const path2 = [];
    let cur = slug;
    for (let hop = 0; hop < 4; hop++) {
      const cr = rec.get(cur); if (!cr || !cr.sub.contrib.length) break;
      const best = cr.sub.contrib.slice().sort((a, b) => b.mass - a.mass)[0];
      if (!best || best.mass <= 0) break;
      path2.push(best.slug.split('_').slice(-1)[0]); cur = best.slug;
    }
    surface.push({
      slug, depth: r.depth,
      ownIssues: r.own.issues,
      subtreeCount: r.sub.count,
      subtreeMass: r.sub.mass,
      blockedBindings: r.sub.blocked,
      topNodes,
      heaviestPath: path2
    });
  }
  surface.sort((a, b) => b.subtreeMass - a.subtreeMass);
  return { domain: root, srcFiles: files.length, surfaceCount: surface.length, surface };
}

// ── run ──────────────────────────────────────────────────────────────────
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const roots = onlyArg ? [onlyArg]
  : fs.readdirSync(SRC).filter(f => f.endsWith('.json') && f.split('_').length === 1).map(f => f.slice(0, -5)).sort();

console.log('cumulative fold  src=' + SRC);
console.log('domains: ' + roots.length + (onlyArg ? ' (single: ' + onlyArg + ')' : ''));
let grandFiles = 0;
for (const root of roots) {
  const t0 = process.hrtime.bigint();
  const out = foldDomain(root);
  if (!out) { console.log('  ' + root.padEnd(16) + ' (no files)'); continue; }
  fs.writeFileSync(path.join(OUT_DIR, root + '-fold.json'), JSON.stringify(out));
  grandFiles += out.srcFiles;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const top = out.surface[0];
  console.log('  ' + root.padEnd(16) + String(out.srcFiles).padStart(7) + ' files  '
    + String(out.surfaceCount).padStart(5) + ' surface  ' + (ms / 1000).toFixed(1) + 's'
    + (top ? '  hottest: ' + top.slug + ' (mass ' + top.subtreeMass + ', ' + top.subtreeCount + ' beneath)' : ''));
}
console.log('done. folded ' + grandFiles + ' portal files -> ' + roots.length + ' domain fold files in assets/data/deep/');
