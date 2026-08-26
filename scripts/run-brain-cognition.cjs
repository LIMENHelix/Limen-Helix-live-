#!/usr/bin/env node
/**
 * run-brain-cognition.cjs — headless harness that runs the 20 domain brains in a Node vm
 * sandbox against the LIVE domain snapshot, captures each brain's state.cognition, and POSTs
 * a compact projection to the live /api/brain-cognition feed (so the Vitals page renders it).
 *
 * Not a production path — a way to "run it and see the results" without a browser/cockpit.
 *   node scripts/run-brain-cognition.cjs
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const compact = require('../lib/brain-cognition-compact.js').compact;

const BASE = process.env.LIMEN_BASE || 'https://limenhelix.com';
const TOKEN = process.env.BRAIN_COGNITION_TOKEN || '';
const ROOT = path.resolve(__dirname, '..');

const DOMAINS = ['energy','infrastructure','culture','finance','economy','technology','defense','intelligence','trade','industry','environment','governance','agriculture','communication','medicine','education','population','science','law','religion'];
const BRAIN_GLOBAL = {
  energy:'LIMENEnergyBrain', infrastructure:'LIMENInfrastructureBrain', culture:'LIMENCultureBrain',
  finance:'LIMENFinanceBrain', economy:'LIMENEconomyBrain', technology:'LIMENTechnologyBrain',
  defense:'LIMENDefenseBrain', intelligence:'LIMENIntelligenceBrain', trade:'LIMENSupplyChainBrain',
  industry:'LIMENIndustryBrain', environment:'LIMENEnvironmentBrain', governance:'LIMENGovernanceBrain',
  agriculture:'LIMENAgricultureBrain', communication:'LIMENCommunicationBrain', medicine:'LIMENHealthBrain',
  education:'LIMENEducationBrain', population:'LIMENPopulationBrain', science:'LIMENResearchBrain',
  law:'LIMENLawBrain', religion:'LIMENReligionBrain'
};

function buildSandbox(snap){
  const noop = function(){};
  const sb = {};
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  sb.console = { log: noop, warn: noop, error: noop, info: noop };
  sb.JSON = JSON; sb.Math = Math; sb.Date = Date; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Boolean = Boolean; sb.Promise = Promise;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.RegExp = RegExp; sb.Error = Error; sb.Map = Map; sb.Set = Set; sb.WeakMap = WeakMap; sb.Symbol = Symbol;
  sb.encodeURIComponent = encodeURIComponent; sb.decodeURIComponent = decodeURIComponent;
  sb.URLSearchParams = URLSearchParams; sb.URL = URL;
  sb.TextEncoder = (typeof TextEncoder !== 'undefined') ? TextEncoder : undefined;
  sb.btoa = (typeof btoa !== 'undefined') ? btoa : function(s){ return Buffer.from(s,'binary').toString('base64'); };
  sb.atob = (typeof atob !== 'undefined') ? atob : function(s){ return Buffer.from(s,'base64').toString('binary'); };
  sb.performance = { now: function(){ return 0; } };
  sb.requestAnimationFrame = function(){ return 0; }; sb.cancelAnimationFrame = function(){};
  sb.setTimeout = function(){ return 0; }; sb.clearTimeout = noop;
  sb.setInterval = function(){ return 0; }; sb.clearInterval = noop;
  sb.CustomEvent = function(type, init){ this.type = type; this.detail = init && init.detail; };
  sb.Event = function(type){ this.type = type; };
  const store = {};
  sb.localStorage = { getItem:function(k){ return store[k] != null ? store[k] : null; }, setItem:function(k,v){ store[k] = String(v); }, removeItem:function(k){ delete store[k]; } };
  const elt = function(){ return { setAttribute:noop, appendChild:noop, removeChild:noop, addEventListener:noop, classList:{add:noop,remove:noop}, style:{}, dataset:{}, set onload(f){}, set onerror(f){}, set src(v){}, set textContent(v){}, set innerHTML(v){} }; };
  sb.document = { createElement:function(){ return elt(); }, createElementNS:function(){ return elt(); }, head:{appendChild:noop}, body:{appendChild:noop}, getElementById:function(){ return null; }, querySelector:function(){ return null; }, querySelectorAll:function(){ return []; }, addEventListener:noop, removeEventListener:noop, dispatchEvent:noop, documentElement:{ style:{} }, readyState:'complete' };
  sb.window.addEventListener = noop; sb.window.removeEventListener = noop; sb.window.dispatchEvent = noop;
  sb.window.location = { href: BASE + '/', pathname:'/', search:'', origin: BASE };
  sb.navigator = { userAgent:'node-harness' };
  sb.fetch = function(){ return Promise.resolve({ ok:false, status:404, json:function(){ return Promise.resolve({}); }, text:function(){ return Promise.resolve(''); } }); };
  // snapshot bridge — the real per-domain data
  sb.window.LIMENDomains = JSON.parse(JSON.stringify(snap.domains));
  sb.window.LIMENSharedSnapshot = {
    getSnapshot: function(){ return { domains: sb.window.LIMENDomains, meta: snap.meta }; },
    requestFresh: function(){ return Promise.resolve({ domains: sb.window.LIMENDomains, meta: snap.meta }); },
    getDomain: function(k){ return sb.window.LIMENDomains[k] || null; },
    start: noop, subscribe: noop, onUpdate: noop
  };
  return sb;
}

(async function main(){
  if (!TOKEN) throw new Error('BRAIN_COGNITION_TOKEN is required; the cognition harness fails closed');
  console.log('[harness] fetching live snapshot…');
  const snap = await fetch(BASE + '/api/domain-snapshot').then(r => r.json());
  console.log('[harness] snapshot: ' + Object.keys(snap.domains||{}).length + ' domains');

  const sb = buildSandbox(snap);
  vm.createContext(sb);

  const files = [
    'assets/js/domain-identity.js',
    'assets/js/limen-k4-selfconsistency.js',
    'assets/js/limen-plasticity.js',
    'assets/js/limen-active-inference.js',
    'assets/js/domain-brains/domain-brain-base.js',
    'assets/js/domain-brains/portal-content-resolver.js',
    'assets/js/domain-brains/inter-brain-bus.js',
    'assets/js/domain-brains/domain-change-log.js'
  ].concat(DOMAINS.map(function(d){ return 'assets/js/domain-brains/' + d + '-brain.js'; }));

  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { console.warn('[harness] MISSING ' + f); continue; }
    try { vm.runInContext(fs.readFileSync(p,'utf8'), sb, { filename: f }); }
    catch (e) { console.warn('[harness] load-error ' + f + ': ' + e.message); }
  }

  const out = {};
  for (const d of DOMAINS) {
    const ref = sb.window[BRAIN_GLOBAL[d]];
    let b = null;
    if (typeof ref === 'function') { try { b = new ref(); } catch (e) {} }   // class
    else if (ref && typeof ref === 'object') { b = ref; }                     // self-instantiated singleton
    if (!b) { console.warn('[harness] no instance for ' + d + ' (' + BRAIN_GLOBAL[d] + ')'); continue; }
    try {
      // brains self-start on load (setInterval shimmed off). Run a couple more cycles so the
      // recurrent model has a prior to compute prediction-error against, then read cognition.
      if (typeof b.cycle === 'function') { try { await b.cycle(); } catch (e) {} try { await b.cycle(); } catch (e) {} }
      out[d] = compact(b.state && b.state.cognition);
      if (!out[d]) console.warn('[harness] ' + d + ': no state.cognition (state keys: ' + Object.keys(b.state||{}).slice(0,8).join(',') + ')');
    } catch (e) { console.warn('[harness] run-error ' + d + ': ' + e.message); out[d] = null; }
  }

  // POST each to the live feed + print a summary
  let posted = 0;
  console.log('\nDOMAIN          IMMUNE      SEV   REG          pStress  pErr   ANTI  NARRATIVE');
  for (const d of DOMAINS) {
    const c = out[d];
    if (!c) { console.log(d.padEnd(15) + ' (no cognition)'); continue; }
    const im = c.immune||{}, m = c.model||{}, aw = c.awareness||{};
    console.log(
      d.padEnd(15) + ' ' +
      String(im.immuneState||'—').padEnd(11) + ' ' +
      String(im.severity==null?'—':im.severity).padEnd(5) + ' ' +
      String(m.regulation||'—').padEnd(12) + ' ' +
      String(m.predictedStress==null?'—':m.predictedStress).padEnd(8) + ' ' +
      String(m.predictionError==null?'—':m.predictionError).padEnd(6) + ' ' +
      String(im.antigenCount||0).padEnd(5) + ' ' +
      String(aw.selfNarrative||'').slice(0,60)
    );
    try {
      const r = await fetch(BASE + '/api/brain-cognition', {
        method:'POST', headers:{ 'content-type':'application/json', 'x-brain-token': TOKEN },
        body: JSON.stringify({ domain: d, cognition: c })
      }).then(x => x.json());
      if (r && r.stored) posted++;
    } catch (e) {}
  }
  console.log('\n[harness] posted ' + posted + '/' + DOMAINS.length + ' cognitions to ' + BASE + '/api/brain-cognition');
})();
