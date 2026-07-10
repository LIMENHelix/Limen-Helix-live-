#!/usr/bin/env node
/**
 * audit-fractal-inheritance.mjs — DRY RUN. Resolve every deep (L4-L7) issue's node by
 * inheriting its nearest corrected ANCESTOR (walk up the slug tree), falling back to the
 * type-default. Reports coverage, distribution, and anomalies. WRITES NOTHING — this is the
 * audit gate before we rebuild the fold on inherited nodes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL = 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
const DIR = fs.existsSync(FULL) ? FULL : path.join(ROOT, 'assets', 'data', 'domains');
const canon = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'canonical-nodes.json'), 'utf8')).nodes;
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'diagnosis-node-overrides.json'), 'utf8'));
const real = id => canon[id] && canon[id].canBindBusiness;

const TYPES = { 'system failure': 'sf', 'capacity overload': 'co', 'quality degradation': 'qd', 'governance gap': 'gg', 'coordination breakdown': 'cb' };
const TYPEDEF = { sf: { node: 'STN', dir: 'hypo' }, co: { node: 'THAL', dir: 'hyper' }, qd: { node: 'CBLM', dir: 'hyper' }, gg: { node: 'vmPFC', dir: 'hypo' }, cb: { node: 'THAL', dir: 'hypo' } };
function ftype(l) { l = String(l).toLowerCase(); for (const k in TYPES) if (l.endsWith(k)) return TYPES[k]; return null; }
function depthOf(slug) { return slug.split('_').length; }

// ── build ANCESTOR_MAP[slug][ftype] = {node,dir} from L1-L3 portals via the override set
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
const AMAP = {};
let l13 = 0;
for (const f of files) {
  const slug = f.slice(0, -5);
  if (depthOf(slug) > 3) continue;
  l13++;
  let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
  for (const iss of (j.issues || [])) {
    const lbl = (iss.label || '').trim().toLowerCase(); if (!lbl) continue;
    const o = ov[lbl]; if (!o) continue;
    const t = ftype(lbl) || 'nm';
    (AMAP[slug] = AMAP[slug] || {})[t] = o;
  }
}
console.log('ANCESTOR_MAP built from ' + l13 + ' L1-L3 portals, ' + Object.keys(AMAP).length + ' slugs carry corrected nodes\n');

// resolve one deep issue: walk up its slug ancestry for a same-type corrected ancestor
function resolve(slug, t) {
  let parts = slug.split('_');
  for (let d = parts.length - 1; d >= 1; d--) {
    const anc = parts.slice(0, d).join('_');
    if (AMAP[anc] && AMAP[anc][t]) return { node: AMAP[anc][t].node, dir: AMAP[anc][t].dir, src: 'inherit@L' + d };
  }
  if (TYPEDEF[t]) return { node: TYPEDEF[t].node, dir: TYPEDEF[t].dir, src: 'typedefault' };
  return null;
}

// ── sample the deep tree (stride) and resolve
const deep = files.filter(f => depthOf(f.slice(0, -5)) >= 4);
const TARGET = 18000;
const stride = Math.max(1, Math.floor(deep.length / TARGET));
let sampled = 0, issues = 0, resolved = 0;
const srcCount = {}, nodeDist = {}, anomalies = [], samples = [];
const depthInherit = {};
for (let i = 0; i < deep.length; i += stride) {
  const slug = deep[i].slice(0, -5);
  let j; try { j = JSON.parse(fs.readFileSync(path.join(DIR, deep[i]), 'utf8')); } catch { continue; }
  sampled++;
  for (const iss of (j.issues || [])) {
    const lbl = (iss.label || '').trim(); if (!lbl) continue;
    const t = ftype(lbl); if (!t) continue; // only generic types deep
    issues++;
    const r = resolve(slug, t);
    if (!r) { anomalies.push({ slug, t, why: 'no resolution' }); continue; }
    resolved++;
    srcCount[r.src.replace(/@L\d+/, '@L*')] = (srcCount[r.src.replace(/@L\d+/, '@L*')] || 0) + 1;
    const m = r.src.match(/@L(\d+)/); if (m) depthInherit[m[1]] = (depthInherit[m[1]] || 0) + 1;
    nodeDist[r.node] = (nodeDist[r.node] || 0) + 1;
    if (!real(r.node)) anomalies.push({ slug, t, node: r.node, why: 'inherited a non-node' });
    // capture before(authored primary)->after for a sample
    if (samples.length < 20) {
      const auth = (iss.circuits || []).map(c => c.nodeId).filter(Boolean);
      samples.push({ label: lbl, authored: auth.slice(0, 4).join(','), applied: r.node + ' ' + r.dir + ' [' + r.src + ']' });
    }
  }
}

console.log('=== DRY-RUN AUDIT: deep-tree fractal inheritance ===');
console.log('deep files: ' + deep.length + ' | sampled: ' + sampled + ' (stride ' + stride + ') | deep issues: ' + issues + ' | resolved: ' + resolved + ' (' + (100 * resolved / issues).toFixed(1) + '%)');
console.log('\nresolution source:');
Object.entries(srcCount).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log('  ' + String(c).padStart(6) + '  ' + s + '  (' + (100 * c / resolved).toFixed(1) + '%)'));
console.log('\ninheritance depth (ancestor found at Lx):');
Object.entries(depthInherit).sort((a, b) => b[0] - a[0]).forEach(([d, c]) => console.log('  L' + d + ': ' + c));
console.log('\nresulting node distribution (top 12):');
Object.entries(nodeDist).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([n, c]) => console.log('  ' + String(c).padStart(6) + '  ' + n + '/' + (canon[n] ? canon[n].motif || '-' : '?')));
console.log('\nANOMALIES: ' + anomalies.length);
anomalies.slice(0, 10).forEach(a => console.log('  ! ' + JSON.stringify(a)));
console.log('\nSAMPLE before(authored) -> after(inherited):');
samples.forEach(s => console.log('  ' + s.label.slice(0, 60) + '\n      [' + s.authored + '] -> ' + s.applied));
