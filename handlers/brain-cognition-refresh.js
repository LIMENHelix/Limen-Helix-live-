/**
 * api/brain-cognition-refresh.js — CRON: refresh the 20 domain brains' self-models server-side.
 *
 * Runs every 30 min (vercel.json crons). Fetches the live domain snapshot + the brain source files
 * over HTTP from this same deployment, runs the 20 brains in a Node vm sandbox (browser globals
 * shimmed), captures each state.cognition, and stores a compact projection to Redis — the same
 * per-domain keys the POST path uses, so /vitals always has fresh data without anyone opening the
 * cockpit. Server-side twin of scripts/run-brain-cognition.cjs.
 *
 *   GET/POST /api/brain-cognition-refresh → { ok, ran, stored, ms }
 */
const vm = require('vm');
const { redisSet } = require('../lib/redis-kv.js');

const PREFIX = 'limen:brain:cognition:';
const TTL = 3 * 3600; // matches the feed handler

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
const FILES = [
  'assets/js/domain-identity.js',
  'assets/js/domain-brains/domain-brain-base.js',
  'assets/js/domain-brains/portal-content-resolver.js',
  'assets/js/domain-brains/inter-brain-bus.js',
  'assets/js/domain-brains/domain-change-log.js'
].concat(DOMAINS.map(function (d) { return 'assets/js/domain-brains/' + d + '-brain.js'; }));

function num(v){ return typeof v === 'number' ? v : null; }
function arr(v){ return Array.isArray(v) ? v : []; }
function val(v){ return v != null ? v : null; }
function compact(cog){
  if (!cog || typeof cog !== 'object') return null;
  var m = cog.model||{}, im = cog.immune||{}, aw = cog.awareness||{}, co = cog.conscience||{}, it = cog.intuition||{};
  return {
    domain: cog.domain || null,
    model: { cycle: num(m.cycle), predictionError: num(m.predictionError), predictedStress: num(m.predictedStress), regulation: val((m.regulation && typeof m.regulation === 'object') ? m.regulation.state : m.regulation) },
    immune: { immuneState: val(im.immuneState), severity: num(im.severity), antigenCount: arr(im.antigens).length, quarantines: val(im.quarantines), blockedFromTraversal: val(im.blockedFromTraversal) },
    awareness: { selfNarrative: val(aw.selfNarrative), humanReviewRequired: !!aw.humanReviewRequired },
    conscience: { conscienceState: val(co.conscienceState), artifactReadinessDecision: val(co.artifactReadinessDecision), blockedClaims: arr(co.blockedClaims).slice(0,4) },
    intuition: { hunches: arr(it.hunches).slice(0,3) }
  };
}

function buildSandbox(snap, BASE){
  var noop = function(){};
  var sb = {};
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  sb.console = { log: noop, warn: noop, error: noop, info: noop };
  sb.JSON = JSON; sb.Math = Math; sb.Date = Date; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Boolean = Boolean; sb.Promise = Promise;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.RegExp = RegExp; sb.Error = Error; sb.Map = Map; sb.Set = Set; sb.WeakMap = WeakMap; sb.Symbol = Symbol;
  sb.encodeURIComponent = encodeURIComponent; sb.decodeURIComponent = decodeURIComponent;
  sb.URLSearchParams = URLSearchParams; sb.URL = URL;
  sb.btoa = function(s){ return Buffer.from(s,'binary').toString('base64'); };
  sb.atob = function(s){ return Buffer.from(s,'base64').toString('binary'); };
  sb.performance = { now: function(){ return 0; } };
  sb.setTimeout = function(){ return 0; }; sb.clearTimeout = noop;
  sb.setInterval = function(){ return 0; }; sb.clearInterval = noop;
  sb.requestAnimationFrame = function(){ return 0; }; sb.cancelAnimationFrame = noop;
  sb.CustomEvent = function(type, init){ this.type = type; this.detail = init && init.detail; };
  sb.Event = function(type){ this.type = type; };
  var store = {};
  sb.localStorage = { getItem:function(k){ return store[k] != null ? store[k] : null; }, setItem:function(k,v){ store[k] = String(v); }, removeItem:function(k){ delete store[k]; } };
  var elt = function(){ return { setAttribute:noop, appendChild:noop, removeChild:noop, addEventListener:noop, classList:{add:noop,remove:noop}, style:{}, dataset:{}, set onload(f){}, set onerror(f){}, set src(v){}, set textContent(v){}, set innerHTML(v){} }; };
  sb.document = { createElement:function(){ return elt(); }, createElementNS:function(){ return elt(); }, head:{appendChild:noop}, body:{appendChild:noop}, getElementById:function(){ return null; }, querySelector:function(){ return null; }, querySelectorAll:function(){ return []; }, addEventListener:noop, removeEventListener:noop, dispatchEvent:noop, documentElement:{ style:{} }, readyState:'complete' };
  sb.window.addEventListener = noop; sb.window.removeEventListener = noop; sb.window.dispatchEvent = noop;
  sb.window.location = { href: BASE + '/', pathname:'/', search:'', origin: BASE };
  sb.navigator = { userAgent:'cron-refresh' };
  sb.fetch = function(){ return Promise.resolve({ ok:false, status:404, json:function(){ return Promise.resolve({}); }, text:function(){ return Promise.resolve(''); } }); };
  sb.window.LIMENDomains = JSON.parse(JSON.stringify(snap.domains));
  sb.window.LIMENSharedSnapshot = {
    getSnapshot: function(){ return { domains: sb.window.LIMENDomains, meta: snap.meta }; },
    requestFresh: function(){ return Promise.resolve({ domains: sb.window.LIMENDomains, meta: snap.meta }); },
    getDomain: function(k){ return sb.window.LIMENDomains[k] || null; },
    start: noop, subscribe: noop, onUpdate: noop
  };
  return sb;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var t0 = Date.now();
  var BASE = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'limenhelix.com');
  try {
    // fetch snapshot + all brain sources over HTTP (parallel)
    var snap = await fetch(BASE + '/api/domain-snapshot').then(function (r) { return r.json(); });
    var sources = await Promise.all(FILES.map(function (f) {
      return fetch(BASE + '/' + f).then(function (r) { return r.ok ? r.text() : ''; }).then(function (code) { return { name: f, code: code }; }).catch(function () { return { name: f, code: '' }; });
    }));

    var sb = buildSandbox(snap, BASE);
    vm.createContext(sb);
    for (var i = 0; i < sources.length; i++) {
      if (!sources[i].code) continue;
      try { vm.runInContext(sources[i].code, sb, { filename: sources[i].name }); } catch (e) {}
    }

    var ran = 0, stored = 0;
    for (var d = 0; d < DOMAINS.length; d++) {
      var dom = DOMAINS[d];
      var ref = sb.window[BRAIN_GLOBAL[dom]];
      var b = (typeof ref === 'function') ? null : (ref && typeof ref === 'object' ? ref : null);
      if (typeof ref === 'function') { try { b = new ref(); } catch (e) {} }
      if (!b) continue;
      try {
        if (typeof b.cycle === 'function') {
          try { await Promise.resolve(b.cycle()); } catch (e) {}
          try { await Promise.resolve(b.cycle()); } catch (e) {}
        }
        ran++;
        var c = compact(b.state && b.state.cognition);
        if (c) { var r = await redisSet(PREFIX + dom, { c: c, ts: Date.now() }, TTL); if (r && r.ok) stored++; }
      } catch (e) {}
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ran: ran, stored: stored, ms: Date.now() - t0 }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e), ms: Date.now() - t0 }));
  }
};
