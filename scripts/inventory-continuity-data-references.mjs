import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const tracked = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const files = tracked.filter(f => f.endsWith('.html') || f.startsWith('assets/js/') && /\.(?:js|mjs)$/.test(f)).sort();
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const router = fs.readFileSync('api/[...route].js', 'utf8');
const handlers = new Map([...router.matchAll(/['"]([^'"]+)['"]:\s*require\(['"]\.\.\/(handlers\/[^'"]+)['"]\)/g)].map(m => ['/api/'+m[1],m[2]+'.js']));
const crons = new Set((config.crons||[]).map(r=>r.path));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const trackedSet = new Set(tracked);
const refs = new Map(), sources = [];
for (const file of files) {
  const bytes = fs.readFileSync(file), text = bytes.toString('utf8');
  sources.push({file,sha256:hash(bytes)});
  const re = /(["'`])((?:https:\/\/limenhelix\.com)?\/(?:api\/|assets\/data\/)[^"'`\r\n]*)\1/g;
  for (const m of text.matchAll(re)) {
    const raw = m[2], local = raw.replace(/^https:\/\/limenhelix\.com/,'');
    const pathname = local.split(/[?#]/)[0];
    const dynamic = pathname.endsWith('/') || raw.includes('${') || /^\s*\+/.test(text.slice(m.index+m[0].length));
    const key = (dynamic?'dynamic:':'literal:')+local;
    let row = refs.get(key);
    if (!row) {
      const staticFunction = 'api/'+pathname.slice(5)+'.js';
      const rewritten = (config.rewrites||[]).filter(r=>r.source===pathname || r.source.endsWith('(.*)') && pathname.startsWith(r.source.slice(0,-4)));
      const handler = pathname.startsWith('/api/') ? trackedSet.has(staticFunction) ? staticFunction : handlers.get(pathname) || null : null;
      row = {reference:local,pathname,dynamic,kind:pathname.startsWith('/api/')?'api':'static-data',handler,handlerExists:handler?trackedSet.has(handler):null,
        cron:crons.has(pathname),rewrites:rewritten,localFile:pathname.startsWith('/assets/data/') && !dynamic?pathname.slice(1):null,
        localFileExists:pathname.startsWith('/assets/data/') && !dynamic?trackedSet.has(pathname.slice(1)):null,
        liveProbeAuthorized:false,semantics:pathname.startsWith('/api/')?'not-reviewed':'static-file-reference-only',references:[]};
      refs.set(key,row);
    }
    row.references.push({file,line:text.slice(0,m.index).split('\n').length});
  }
}
const rows=[...refs.values()].sort((a,b)=>a.reference.localeCompare(b.reference)||Number(a.dynamic)-Number(b.dynamic));
const counts={sourceFiles:files.length,references:rows.reduce((n,r)=>n+r.references.length,0),uniqueReferences:rows.length,api:rows.filter(r=>r.kind==='api').length,staticData:rows.filter(r=>r.kind==='static-data').length,dynamic:rows.filter(r=>r.dynamic).length,cronReferences:rows.filter(r=>r.cron).length,unmappedLiteralApis:rows.filter(r=>r.kind==='api'&&!r.dynamic&&!r.handler&&!r.rewrites.length).length,missingLiteralStaticFiles:rows.filter(r=>r.localFileExists===false).length};
const inventory={schemaVersion:'continuity-client-data-references/1',level:'LOCAL/SOURCE',generator:'scripts/inventory-continuity-data-references.mjs',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),counts,
 routingSources:['vercel.json','api/[...route].js'].map(file=>({file,sha256:hash(fs.readFileSync(file))})),sources,rows,
 limits:['Lexical quoted absolute references, including comments; not proof of executed requests or request method.','Dynamic concatenation and template references are marked; computed variables, relative URLs, Python aliases and runtime/generated URLs require further reconciliation.','Static function precedence and literal Hono mappings are recorded; rewrites are source matches, not live behavior.','No API or network request is made. Every API needs method/effect review before probing.','Missing tracked files do not prove deployed 404 or authorize deletion/replacement.']};
// Optional output preserves earlier inventories referenced by live-probe hashes.
fs.writeFileSync(process.argv[2] || 'docs/audits/continuity-client-data-references-20261001.json',JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify(counts));
