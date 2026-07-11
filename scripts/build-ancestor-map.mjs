#!/usr/bin/env node
/**
 * build-ancestor-map.mjs — the fractal inheritance table. For every L1-L3 portal slug,
 * record its verified node+dir per failure-type (from diagnosis-node-overrides.json). Deep
 * portals (L4-L7) resolve their node by walking UP this table to the nearest ancestor slug.
 * Shared by the fold rebuild AND the render derivation. Deterministic, no agents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL = 'C:\\Users\\Chris\\Limen-Helix\\assets\\data\\domains';
const SRC = fs.existsSync(FULL) ? FULL : path.join(ROOT, 'assets', 'data', 'domains');
const OUT = path.join(ROOT, 'assets', 'data', 'diagnosis-ancestor-map.json');
const ov = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'diagnosis-node-overrides.json'), 'utf8'));

const TYPES = { 'system failure': 'sf', 'capacity overload': 'co', 'quality degradation': 'qd', 'governance gap': 'gg', 'coordination breakdown': 'cb' };
function ftype(l) { l = String(l).toLowerCase(); for (const k in TYPES) if (l.endsWith(k)) return TYPES[k]; return 'nm'; }

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json') && f.slice(0, -5).split('_').length <= 3);
const map = {};
let slugs = 0, cells = 0;
for (const f of files) {
  const slug = f.slice(0, -5);
  let j; try { j = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch { continue; }
  for (const iss of (j.issues || [])) {
    const lbl = (iss.label || '').trim().toLowerCase(); if (!lbl) continue;
    const o = ov[lbl]; if (!o) continue;
    const t = ftype(lbl);
    if (!map[slug]) { map[slug] = {}; }
    // compact: node|dir string per type (d=dir: h=hyper, o=hypo)
    if (!map[slug][t]) { map[slug][t] = o.node + '|' + (o.dir === 'hypo' ? 'o' : 'h'); cells++; }
  }
  if (map[slug]) slugs++;
}
// type-default fallback baked in under key "_def"
// sf = system failure = STN HYPER (over-brake = paralysis); runaway is contagion/
// tipping-point. Matches the reasoned named-override in portal-ui.js / base.
map._def = { sf: 'STN|h', co: 'THAL|h', qd: 'CBLM|h', gg: 'vmPFC|o', cb: 'THAL|o' };
fs.writeFileSync(OUT, JSON.stringify(map));
console.log('wrote diagnosis-ancestor-map.json: ' + slugs + ' slugs, ' + cells + ' type-cells, ' + (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
