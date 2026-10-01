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
  const requestUrl = new URL(req.url, 'http://127.0.0.1:8932');
  const domain = requestUrl.searchParams.get('domain');
  if (req.method === 'GET' && requestUrl.pathname === '/supplemental') {
    const page = fs.readFileSync('domain-console.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const observer = fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8');
    const evidence = JSON.parse(fs.readFileSync('docs/audits/continuity-supplemental-provenance-20261001.json', 'utf8'));
    const fixture = `<aside style="position:relative;z-index:999;background:#173544;padding:15px;color:white;font:16px system-ui">LOCAL/FIXTURE: original domain-console HTML and actual Execution Observatory script. Supplemental state comes from actual loader/builder fixtures; no native brain startup, motor, live source freshness or production claim. <label>Data fixture <select id="fixture-source-mode"><option value="all-404">All optional data unavailable</option><option value="existing-local-files">Existing local fallback files</option></select></label></aside>
<script>
const supplementalRows = ${JSON.stringify(evidence.rows).replace(/</g, '\\u003c')};
const fixtureBrains = {};
const aliases = {trade:'supplyChain',medicine:'health',science:'research'};
window.LIMENDomainBrains = {getAll:()=>fixtureBrains};
function chooseSourceFixture() {
 Object.keys(fixtureBrains).forEach(key=>delete fixtureBrains[key]);
 supplementalRows.filter(row=>row.mode===document.getElementById('fixture-source-mode').value).forEach(row=>{
  fixtureBrains[aliases[row.domain]||row.domain]={state:{[row.field]:row.layer}};
 });
 if(window.LIMENExecutionObservatory)window.LIMENExecutionObservatory.refresh();
}
window.fetch=async path=>{
 if(!['/api/brain-cognition','/api/limen-autofire-log?limit=50'].includes(path))throw Error('Unexpected fixture request');
 return {ok:true,json:async()=>({cognition:{},count:0,cycles:[]})};
};
document.getElementById('fixture-source-mode').addEventListener('change',chooseSourceFixture);
chooseSourceFixture();
</script><script>${observer}</script>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(page.replace('</body>', () => fixture + '</body>'));
  }
  if (req.method === 'GET' && requestUrl.pathname === '/operator' && domains.includes(domain) && requestUrl.searchParams.get('mode') === 'operator') {
    const page = fs.readFileSync('domain-console.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const operator = fs.readFileSync('assets/js/' + domain + '-clarity-operator.js', 'utf8');
    const fixture = `<aside style="position:relative;z-index:999;background:#173544;padding:15px;color:white;font:16px system-ui">LOCAL/FIXTURE: original domain-console HTML and complete ${domain} operator script; fixture brain state, boot marker and responses. No business execution or production claim. <select id="fixture-mode"><option value="unavailable">Unavailable branch</option><option value="success">Populated success</option></select></aside>
<script>
const fixtureState = {updated:1,stress:0,diagnoses:[],feeds:[],opportunities:[{title:'FIXTURE integration directive',source:'portal_directive',rank:1,_richness:2,_omittedSiblingCount:1,_directive:{nodeId:'fixture-node',ancestryPath:[${JSON.stringify(domain)},'fixture'],depth:2},scores:{econRelevance:1},steps:['Fixture observation only'],explain:'UI fixture only; no execution authority'}]};
window.LIMENDomainBrains = {get:()=>({getState:()=>fixtureState})};
document.getElementById('clarity-view').innerHTML='<div id="dcb-exec">Fixture boot marker</div>';
document.getElementById('console-grid').classList.add('dcb-active');
window.fetch = async (path, options) => {
 if(options&&options.method==='HEAD')return {ok:false,status:404};
 if(path.includes('branch-index.json'))return {ok:true,json:async()=>({branches:[{nodeId:'fixture-node',ancestryPath:[${JSON.stringify(domain)},'fixture'],portalDomainId:'fixture',treatmentLabel:'Fixture related branch',depth:2}]})};
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
