#!/usr/bin/env node
// Domain structure audit + per-domain manifests + similarity chart.
// Regenerates work-output/by-domain/ from the current assets/js/*-*.js engine files.
// Run manually (`node scripts/domain-structure-audit.mjs`) or via the PostToolUse regen hook.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const JS = path.join(REPO, 'assets/js');
const OUT = path.resolve(REPO, '../.claude/projects/C--Users-Chris-Limen-Helix-live-/work-output/by-domain');

const DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','technology','trade'];

// ---- map each domain's JS files by canonical "role" (filename minus domain prefix) ----
const jsFiles = fs.readdirSync(JS).filter(f => f.endsWith('.js'));
const byDomain = Object.fromEntries(DOMAINS.map(d => [d, {}]));
for (const f of jsFiles) {
  for (const d of DOMAINS) {
    if (f.startsWith(d + '-')) { byDomain[d][f.slice(d.length + 1)] = f; break; }
  }
}
const roleSet = new Set();
for (const d of DOMAINS) for (const r of Object.keys(byDomain[d])) roleSet.add(r);
const ROLES = [...roleSet].sort();

// ---- normalization + fingerprints ----
function normalize(text, domain) {
  const cap = domain[0].toUpperCase() + domain.slice(1);
  return text
    .replace(new RegExp(domain, 'g'), 'DOMAIN')
    .replace(new RegExp(cap, 'g'), 'Domain')
    .replace(new RegExp(domain.toUpperCase(), 'g'), 'DOMAIN')
    .replace(/\r/g, '');
}
function meaningfulLines(text) {
  return text.split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('//') && !l.startsWith('*') && l !== '/*' && l !== '*/');
}
function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const data = {};
for (const d of DOMAINS) {
  data[d] = {};
  for (const r of ROLES) {
    const fname = byDomain[d][r];
    if (!fname) { data[d][r] = null; continue; }
    const text = fs.readFileSync(path.join(JS, fname), 'utf8');
    data[d][r] = { file: fname, lines: text.split('\n').length, norm: new Set(meaningfulLines(normalize(text, d))) };
  }
}

// ---- per-role clone report ----
const setKey = s => [...s].sort().join('\n');
const roleReport = {};
for (const r of ROLES) {
  const present = DOMAINS.filter(d => data[d][r]);
  const groups = new Map();
  for (const d of present) { const k = setKey(data[d][r].norm); (groups.get(k) || groups.set(k, []).get(k)).push(d); }
  const grpList = [...groups.values()].map(ds => ({ domains: ds, size: ds.length })).sort((a,b)=>b.size-a.size);
  let sum=0,cnt=0;
  for (let i=0;i<present.length;i++) for (let j=i+1;j<present.length;j++){ sum+=jaccard(data[present[i]][r].norm,data[present[j]][r].norm); cnt++; }
  roleReport[r] = { present: present.length, groups: grpList, biggestClone: grpList[0]?.size||0,
    meanPairSim: cnt?sum/cnt:1, meanLines: Math.round(present.reduce((a,d)=>a+data[d][r].lines,0)/present.length) };
}

// ---- domain x domain matrix + clone score ----
const matrix = {};
for (const a of DOMAINS) { matrix[a] = {};
  for (const b of DOMAINS) {
    if (a===b){ matrix[a][b]=1; continue; }
    let sum=0,cnt=0;
    for (const r of ROLES) if (data[a][r]&&data[b][r]) { sum+=jaccard(data[a][r].norm,data[b][r].norm); cnt++; }
    matrix[a][b] = cnt?sum/cnt:0;
  }
}
const cloneScore = {};
for (const a of DOMAINS) { const v = DOMAINS.filter(b=>b!==a).map(b=>matrix[a][b]); cloneScore[a]=v.reduce((x,y)=>x+y,0)/v.length; }
const perDomainRoleLines = Object.fromEntries(DOMAINS.map(d=>[d, Object.fromEntries(ROLES.map(r=>[r, data[d][r]?data[d][r].lines:null]))]));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, '_audit-data.json'), JSON.stringify({ ROLES, roleReport, matrix, cloneScore, byDomain, perDomainRoleLines }, null, 2));

// ---- html pages per domain ----
const htmls = fs.readdirSync(REPO).filter(f => f.endsWith('.html'));
const pagesOf = Object.fromEntries(DOMAINS.map(d => [d,
  htmls.filter(f => f===`${d}.html` || f.startsWith(`${d}_`) || f.startsWith(`${d}-`) || f===`admin-${d}.html`).sort()]));
function categorize(domain, pages) {
  const cats = {};
  for (const p of pages) {
    const base = p.replace(/\.html$/, '');
    let rest = base.startsWith(domain+'_') ? base.slice(domain.length+1)
      : base.startsWith(domain+'-') ? '(site) '+base.slice(domain.length+1) : '(root) '+base;
    const cat = rest.startsWith('(') ? rest.split(' ')[0] : rest.split('_')[0];
    (cats[cat] ??= []).push(p);
  }
  return cats;
}
const CLONE_HI=0.70, DIV_LO=0.45;
const rankOrder = DOMAINS.slice().sort((a,b)=>cloneScore[b]-cloneScore[a]);
function neighbors(d){ const a=DOMAINS.filter(x=>x!==d).map(x=>[x,matrix[d][x]]).sort((p,q)=>q[1]-p[1]); return {near:a.slice(0,3),far:a.slice(-3).reverse()}; }

for (const d of DOMAINS) {
  const dir = path.join(OUT, d); fs.mkdirSync(dir, { recursive: true });
  const pages = pagesOf[d], cats = categorize(d, pages), catNames = Object.keys(cats).sort();
  const { near, far } = neighbors(d);
  const roles = ROLES.filter(r => perDomainRoleLines[d][r] != null);
  const roleRows = roles.map(r => { const rr=roleReport[r];
    const label = rr.meanPairSim>=CLONE_HI?'CLONE':rr.meanPairSim<=DIV_LO?'DIVERGENT':'mixed';
    return { r, lines: perDomainRoleLines[d][r], sim: rr.meanPairSim, label, cloneGrp:`${rr.biggestClone}/${rr.present}` };
  }).sort((a,b)=>a.sim-b.sim);
  const totalLines = roleRows.reduce((a,x)=>a+x.lines,0);
  const divergent = roleRows.filter(x=>x.label==='DIVERGENT'), clone = roleRows.filter(x=>x.label==='CLONE');

  let md = `# ${d.toUpperCase()} — domain manifest\n\n`;
  md += `_Generated by scripts/domain-structure-audit.mjs. Clone-score ${cloneScore[d].toFixed(3)} `;
  md += `(rank ${rankOrder.indexOf(d)+1}/20 most clone-like; 1 = identical to peers, low = divergent)._\n\n`;
  md += `## Structure at a glance\n\n`;
  md += `- **Pages / sites:** ${pages.length} (${catNames.length} sub-categories)\n`;
  md += `- **JS engine files:** ${roles.length} roles, ${totalLines.toLocaleString()} total lines\n`;
  md += `- **Most similar domains:** ${near.map(([x,s])=>`${x} (${s.toFixed(2)})`).join(', ')}\n`;
  md += `- **Most divergent domains:** ${far.map(([x,s])=>`${x} (${s.toFixed(2)})`).join(', ')}\n`;
  md += `- **Real per-domain logic (DIVERGENT roles):** ${divergent.length?divergent.map(x=>x.r.replace('.js','')).join(', '):'—'}\n`;
  md += `- **Boilerplate (CLONE roles):** ${clone.length?clone.map(x=>x.r.replace('.js','')).join(', '):'—'}\n\n`;
  md += `## Code audit — JS engine roles\n\n`;
  md += `Sorted divergent-first. \`sim\` = mean cross-domain similarity of that role (low = this domain's real logic; high = cloned boilerplate). \`cloneGrp\` = size of the largest identical-across-domains group.\n\n`;
  md += `| role | lines | cross-domain sim | biggest clone group | verdict |\n|---|--:|--:|:--:|:--|\n`;
  for (const x of roleRows) md += `| \`${x.r}\` | ${x.lines} | ${x.sim.toFixed(2)} | ${x.cloneGrp} | ${x.label} |\n`;
  md += `\n> Reading: **DIVERGENT** roles carry ${d}'s genuine differentiation — audit/keep these. **CLONE** roles are the ~30 cloned-20x boilerplate; one fix propagates to all 20 domains.\n\n`;
  md += `## Page / site inventory (${pages.length})\n\n`;
  for (const c of catNames) { md += `### ${c} (${cats[c].length})\n`; for (const p of cats[c]) md += `- \`${p}\`\n`; md += `\n`; }
  fs.writeFileSync(path.join(dir, `${d}.md`), md);
}

// ---- top-level markdown chart ----
let chart = `# Domain structure similarity — 20-domain audit\n\n`;
chart += `Compares the per-domain JS engine code (${ROLES.length} shared roles) after stripping the domain name, so true clones collapse. Cell = mean role-by-role line similarity (0 = unrelated, 1 = identical). Domains ordered most-clone-like → most-divergent.\n\n`;
chart += `## Clone score (mean similarity to the other 19)\n\n`;
for (const d of rankOrder) chart += `\`${d.padEnd(15)}\` ${cloneScore[d].toFixed(3)} ${'█'.repeat(Math.round(cloneScore[d]*50))}\n`;
chart += `\n## Role clone/divergence (what's real vs boilerplate)\n\n`;
chart += `| role | present | cross-domain sim | largest clone group | verdict |\n|---|--:|--:|:--:|:--|\n`;
for (const r of ROLES.slice().sort((a,b)=>roleReport[a].meanPairSim-roleReport[b].meanPairSim)) {
  const rr=roleReport[r]; const v = rr.meanPairSim>=0.70?'CLONE':rr.meanPairSim<=0.45?'DIVERGENT (real logic)':'mixed';
  chart += `| \`${r}\` | ${rr.present}/20 | ${rr.meanPairSim.toFixed(2)} | ${rr.biggestClone}/${rr.present} | ${v} |\n`;
}
chart += `\n## Similarity matrix (×100)\n\n`;
chart += `| | ${rankOrder.map(d=>d.slice(0,4)).join(' | ')} |\n|---|${rankOrder.map(()=>'--:').join('|')}|\n`;
for (const a of rankOrder) chart += `| **${a.slice(0,6)}** | ${rankOrder.map(b=>a===b?'—':Math.round(matrix[a][b]*100)).join(' | ')} |\n`;
fs.writeFileSync(path.join(OUT, '_STRUCTURE-CHART.md'), chart);

// ---- visual html heatmap ----
function rgb(v){ const t=Math.max(0,Math.min(1,v)); const lo=[38,166,154],mid=[71,85,105],hi=[239,138,54];
  const lerp=(a,b,f)=>a.map((x,i)=>Math.round(x+(b[i]-x)*f)); return t<0.5?lerp(lo,mid,t*2):lerp(mid,hi,(t-0.5)*2); }
const col=v=>{const c=rgb(v);return `rgb(${c[0]},${c[1]},${c[2]})`;};
function fg(v){ const [r,g,b]=rgb(v).map(x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;});
  return (0.2126*r+0.7152*g+0.0722*b)>0.42?'#0b1220':'#f0f6ff'; }
let colh = '<tr><th></th>'+rankOrder.map(d=>`<th class="colh"><span>${d}</span></th>`).join('')+'</tr>';
let cells='';
for (const a of rankOrder){ cells+=`<tr><th class="rowh">${a}</th>`;
  for (const b of rankOrder){ const v=a===b?1:matrix[a][b]; const bg=a===b?'#1e293b':col(v); const ink=a===b?'#64748b':fg(v);
    cells+=`<td style="background:${bg};color:${ink}" title="${a} ↔ ${b}: ${v.toFixed(2)}">${a===b?'·':Math.round(v*100)}</td>`; }
  cells+=`</tr>`; }
const scoreBars = rankOrder.map(d=>{const s=cloneScore[d];
  return `<div class="bar"><span class="lbl">${d}</span><span class="track"><i style="width:${s*100}%;background:${col(s)}"></i></span><span class="val">${s.toFixed(3)}</span></div>`;}).join('');
const roleRowsHtml = ROLES.slice().sort((a,b)=>roleReport[a].meanPairSim-roleReport[b].meanPairSim).map(r=>{
  const rr=roleReport[r],v=rr.meanPairSim; const verdict=v>=0.70?'CLONE':v<=0.45?'DIVERGENT':'mixed';
  const cls=v>=0.70?'clone':v<=0.45?'div':'mix';
  return `<tr class="${cls}"><td class="mono">${r}</td><td>${rr.present}/20</td><td><span class="track sm"><i style="width:${v*100}%;background:${col(v)}"></i></span>${v.toFixed(2)}</td><td>${rr.biggestClone}/${rr.present}</td><td class="verdict ${cls}">${verdict}</td></tr>`;}).join('');
const html = `<title>LIMEN — 20-domain code structure audit</title>
<style>
:root{--bg:#0b1220;--card:#111a2e;--ink:#e5edf7;--mut:#8ba0bd;--line:#22304d}
@media (prefers-color-scheme:light){:root{--bg:#f4f7fb;--card:#fff;--ink:#0f1b30;--mut:#5b6b85;--line:#dce4f0}}
:root[data-theme=dark]{--bg:#0b1220;--card:#111a2e;--ink:#e5edf7;--mut:#8ba0bd;--line:#22304d}
:root[data-theme=light]{--bg:#f4f7fb;--card:#fff;--ink:#0f1b30;--mut:#5b6b85;--line:#dce4f0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif}
.wrap{max-width:1120px;margin:0 auto;padding:34px 22px 80px}
h1{font-size:26px;margin:0 0 6px}h2{font-size:17px;margin:34px 0 12px;letter-spacing:.02em}
.sub{color:var(--mut);max-width:70ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-top:14px}
.scroll{overflow-x:auto}
table.hm{border-collapse:collapse;font-size:12px}
table.hm td{width:30px;height:30px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
table.hm th.rowh{text-align:right;padding-right:8px;color:var(--mut);font-weight:600;white-space:nowrap}
table.hm th.colh{height:96px;vertical-align:bottom}
table.hm th.colh span{writing-mode:vertical-rl;transform:rotate(180deg);color:var(--mut);font-weight:600}
.bar{display:flex;align-items:center;gap:10px;margin:5px 0}
.bar .lbl{width:130px;color:var(--mut);font-size:13px;text-align:right}
.track{flex:1;height:14px;background:var(--line);border-radius:7px;overflow:hidden}
.track.sm{display:inline-block;width:90px;height:8px;vertical-align:middle;margin-right:8px}
.track i{display:block;height:100%}
.bar .val{width:52px;font-variant-numeric:tabular-nums;color:var(--ink)}
table.roles{width:100%;border-collapse:collapse;font-size:13px}
table.roles td,table.roles th{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left}
table.roles th{color:var(--mut);font-weight:600}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.verdict{font-weight:700;font-size:11px;letter-spacing:.04em}
.verdict.clone{color:#ef8a36}.verdict.div{color:#26a68a}.verdict.mix{color:var(--mut)}
tr.div td{background:rgba(38,166,138,.06)}
.legend{display:flex;gap:6px;align-items:center;color:var(--mut);font-size:12px;margin-top:8px}
.legend .sw{width:110px;height:12px;border-radius:6px;background:linear-gradient(90deg,rgb(38,166,154),rgb(71,85,105),rgb(239,138,54))}
.k{color:var(--ink);font-weight:600}
</style>
<div class="wrap">
<h1>LIMEN — 20-domain code structure audit</h1>
<p class="sub">Per-domain JS engine files (${ROLES.length} shared roles) compared after stripping the domain name so true clones collapse to identical. Higher = more clone-like boilerplate; lower = genuine per-domain logic. Confirms the "same ~30 non-nodes cloned 20×" thesis: one backbone of real divergence (<span class="k">node-business-engine</span>) atop heavy shared scaffolding.</p>
<div class="legend"><span>divergent / real logic</span><span class="sw"></span><span>cloned boilerplate</span></div>
<h2>Similarity matrix — domain × domain (×100)</h2>
<div class="card scroll"><table class="hm">${colh}${cells}</table></div>
<h2>Clone score — mean similarity to the other 19 domains</h2>
<p class="sub">Finance & medicine carry the most unique code; environment/industry/culture/population/religion are the tightest clone cluster.</p>
<div class="card">${scoreBars}</div>
<h2>Role breakdown — what's real vs. boilerplate</h2>
<p class="sub">Sorted divergent-first. A low cross-domain similarity means that role holds each domain's genuine differentiation; a high one means it's the same file copied 20×, where a single fix propagates everywhere.</p>
<div class="card scroll"><table class="roles"><thead><tr><th>role (file)</th><th>present</th><th>cross-domain sim</th><th>largest clone group</th><th>verdict</th></tr></thead><tbody>${roleRowsHtml}</tbody></table></div>
</div>`;
fs.writeFileSync(path.join(OUT, '_structure-chart.html'), html);

// ---- readme index ----
let idx = `# by-domain — work output index\n\n`;
idx += `One folder per domain (20). Each \`<domain>/<domain>.md\` lists every page/site for that domain plus a code audit of its JS engine roles. Regenerated by \`scripts/domain-structure-audit.mjs\` (wired to a PostToolUse hook on domain JS edits).\n\n`;
idx += `- **[_STRUCTURE-CHART.md](_STRUCTURE-CHART.md)** — cross-domain similarity matrix + role clone/divergence table\n`;
idx += `- **[_structure-chart.html](_structure-chart.html)** — visual heatmap of the same\n\n`;
idx += `| domain | pages | JS roles | clone-score | most-divergent role |\n|---|--:|--:|--:|---|\n`;
for (const d of rankOrder) {
  const roles = ROLES.filter(r => perDomainRoleLines[d][r] != null);
  const mostDiv = roles.slice().sort((a,b)=>roleReport[a].meanPairSim-roleReport[b].meanPairSim)[0];
  idx += `| [${d}](${d}/${d}.md) | ${pagesOf[d].length} | ${roles.length} | ${cloneScore[d].toFixed(3)} | \`${mostDiv}\` |\n`;
}
fs.writeFileSync(path.join(OUT, 'README.md'), idx);

console.log(`[domain-audit] ${DOMAINS.length} domains, ${ROLES.length} roles -> ${OUT}`);
