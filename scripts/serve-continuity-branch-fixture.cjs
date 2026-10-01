// Manual local browser verification of actual isolated consumer functions.
// No application startup, live provider requests or production UI claim.
const http = require('node:http');
const fs = require('node:fs');
const acorn = require('acorn');
const walk = require('acorn-walk');
const domains = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','technology','trade'];
const functions = {};
for (const domain of domains) {
  const source = fs.readFileSync(`assets/js/${domain}-clarity-operator.js`, 'utf8');
  walk.simple(acorn.parse(source, { ecmaVersion: 'latest' }), { FunctionDeclaration(n) {
    if (n.id.name === '_handleLoadBranch') functions[domain] = source.slice(n.start, n.end);
  } });
  if (!functions[domain]) throw new Error(`Missing actual consumer ${domain}`);
}
const html = `<!doctype html><meta charset="utf-8"><title>Continuity branch fixture</title>
<style>body{font:18px system-ui;background:#17202b;color:#eee;padding:24px}button,select{font:inherit;margin:8px;padding:8px}#branch-content-fixture div,#branch-content-fixture span,#branch-content-fixture button{font-size:16px!important}pre{white-space:pre-wrap}#branch-content-fixture{padding:20px;border:1px solid #7ba}</style>
<h1>LOCAL/FIXTURE: isolated branch consumer</h1><p>Actual committed LOAD BRANCH functions; fixture responses only. This is not the production operator layout or business execution.</p>
<label>Domain <select id="domain">${domains.map(d => `<option>${d}</option>`).join('')}</select></label>
<label>Response <select id="mode"><option value="unavailable">Unavailable 404 / 500</option><option value="success">Populated success</option><option value="malformed">Malformed activations</option><option value="empty">Valid empty content</option></select></label>
<button id="load">LOAD BRANCH</button><div id="branch-content-fixture" style="display:none"></div><h2>Fixture request log</h2><pre id="log"></pre>
<script>
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
window.fetch = async path => {
 document.getElementById('log').textContent += path + '\\n';
 const mode = document.getElementById('mode').value;
 if (mode === 'unavailable') return {ok:false,status:path.startsWith('/assets/')?404:500};
 return {ok:true,json:async()=>mode==='malformed'?{activations:{}}:mode==='empty'?{activations:[]}:{activations:[{treatments:[{label:'Recovered fixture branch',monitoring:'Fixture monitoring result'}]}]}};
};
const loaders = {${domains.map(d => `${JSON.stringify(d)}:${functions[d]}`).join(',')}};
document.getElementById('load').onclick = () => loaders[document.getElementById('domain').value]('fixture');
document.getElementById('domain').onchange = () => {document.getElementById('branch-content-fixture').style.display='none';document.getElementById('branch-content-fixture').innerHTML='';document.getElementById('log').textContent='';};
</script>`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");
  if (req.method === 'GET' && req.url === '/operator?domain=energy&mode=operator') {
    const page = fs.readFileSync('domain-console.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const operator = fs.readFileSync('assets/js/energy-clarity-operator.js', 'utf8');
    const fixture = `<aside style="position:relative;z-index:999;background:#173544;padding:15px;color:white;font:16px system-ui">LOCAL/FIXTURE: original domain-console HTML and complete Energy operator script; fixture brain state, boot marker and responses. No business execution or production claim. <select id="fixture-mode"><option value="unavailable">Unavailable branch</option><option value="success">Populated success</option></select></aside>
<script>
const fixtureState = {updated:1,stress:0,diagnoses:[],feeds:[],opportunities:[{title:'FIXTURE integration directive',source:'portal_directive',rank:1,_richness:2,_omittedSiblingCount:1,_directive:{nodeId:'fixture-node',ancestryPath:['energy','fixture'],depth:2},scores:{econRelevance:1},steps:['Fixture observation only'],explain:'UI fixture only; no execution authority'}]};
window.LIMENDomainBrains = {get:()=>({getState:()=>fixtureState})};
document.getElementById('clarity-view').innerHTML='<div id="dcb-exec">Fixture boot marker</div>';
document.getElementById('console-grid').classList.add('dcb-active');
window.fetch = async (path, options) => {
 if(options&&options.method==='HEAD')return {ok:false,status:404};
 if(path.includes('branch-index.json'))return {ok:true,json:async()=>({branches:[{nodeId:'fixture-node',ancestryPath:['energy','fixture'],portalDomainId:'fixture',treatmentLabel:'Fixture related branch',depth:2}]})};
 if(document.getElementById('fixture-mode').value==='unavailable')return {ok:false,status:path.startsWith('/assets/')?404:500};
 return {ok:true,json:async()=>({activations:[{treatments:[{label:'Recovered integration branch',monitoring:'Fixture integration monitoring'}]}]})};
};
</script><script>${operator}</script>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(page.replace('</body>', () => fixture + '</body>'));
  }
  if (req.method !== 'GET' || req.url !== '/') { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
});
server.listen(8932, '127.0.0.1', () => console.log('Fixture browser harness http://127.0.0.1:8932/; Ctrl-C stops server'));
