'use strict';

// Manual startup observation: original HTML/scripts and local static assets.
// No routed application handlers, provider proxy, secrets or successful API fixtures.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const assetRoot = fs.realpathSync(path.join(root, 'assets'));
const requests = [];
const prelude = `<script>
window.__continuityBootstrap = {level:'LOCAL/STATIC STARTUP',errors:[],reads:[],cycles:[]};
const bootstrapTrace = window.__continuityBootstrap;
window.addEventListener('error',event=>bootstrapTrace.errors.push({message:event.message||'resource-load-failure',file:event.filename||event.target&&event.target.src||'',line:event.lineno||null}));
window.addEventListener('unhandledrejection',event=>bootstrapTrace.errors.push({message:String(event.reason),kind:'unhandled-rejection'}));
window.addEventListener('limen:domain-brain-update',event=>bootstrapTrace.cycles.push({owner:event.detail.domainId,diagnoses:(event.detail.state.diagnoses||[]).length,opportunities:(event.detail.state.opportunities||[]).length}));
const localAssetFetch = window.fetch.bind(window);
window.fetch=async function(input,options){
 const raw=typeof input==='string'?input:input.url;
 const url=new URL(raw,location.href);
 const method=String(options&&options.method||input&&input.method||'GET').toUpperCase();
 const localAsset=url.origin===location.origin&&url.pathname.startsWith('/assets/')&&method==='GET';
 bootstrapTrace.reads.push({path:url.pathname,method,localAsset,status:localAsset?'static-file':method==='GET'?404:403});
 if(localAsset)return localAssetFetch(input,options);
 return new Response(JSON.stringify({ok:false,fixture:true,reason:'LOCAL startup fixture has no API/provider evidence'}),{status:method==='GET'?404:403,headers:{'Content-Type':'application/json'}});
};
document.addEventListener('DOMContentLoaded',()=>{
 const banner=document.createElement('aside');banner.id='continuity-bootstrap-banner';
 banner.style.cssText='position:relative;z-index:10000;padding:12px;background:#173544;color:white;font:16px system-ui';
 banner.textContent='LOCAL/STATIC STARTUP — original console and scripts. Existing local assets only; all API/provider reads unavailable and actions blocked. No production or business execution claim.';
 document.body.prepend(banner);
});
</script>`;
const server = http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  requests.push({method:req.method,path:url.pathname});
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; worker-src 'none'; object-src 'none'");
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.writeHead(403);return res.end('Fixture blocks actions');}
  if(url.pathname==='/__fixture-requests'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(requests));}
  if(url.pathname==='/domain-console.html'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end(fs.readFileSync(path.join(root,'domain-console.html'),'utf8').replace('<head>','<head>'+prelude));
  }
  if(url.pathname.startsWith('/assets/')){
    const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile()){
      const resolved=fs.realpathSync(candidate);
      if(resolved.startsWith(assetRoot+path.sep)){
        const mime={'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'}[path.extname(resolved)];
        if(mime){res.setHeader('Content-Type',mime);return res.end(fs.readFileSync(resolved));}
      }
    }
  }
  res.writeHead(404);res.end('LOCAL fixture unavailable');
});
server.listen(0,'127.0.0.1',()=>console.log('LOCAL startup fixture http://127.0.0.1:'+server.address().port+'/domain-console.html?domain=law'));
