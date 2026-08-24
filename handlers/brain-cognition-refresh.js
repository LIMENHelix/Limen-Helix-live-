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
const { redisSet, redisGet } = require('../lib/redis-kv.js');
const serverPacket = require('../lib/civilization-server-packet.js');

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
  // Brains read their observation via _getSnapshot() -> LIMENFastBoot.getConsoleSnapshotSync().
  // Without this the recurrent loop gets a null observation and predictionError never computes
  // (same path that starved companies). Provide it so the cognition actually runs.
  sb.window.LIMENFastBoot = {
    getConsoleSnapshotSync: function(){ return { domains: sb.window.LIMENDomains, meta: snap.meta, domainCompanyJoin: snap.domainCompanyJoin || {} }; },
    getOpportunitiesSnapshotSync: function(){ return {}; }
  };
  return sb;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var t0 = Date.now();
  var refreshId = 'brain-cognition-refresh:' + String(t0);
  // PINNED trusted origin. Never derive from a request header: this base feeds fetch()+vm.runInContext,
  // so a header-controlled base was an SSRF -> RCE path (attacker JS executed in a non-isolating sandbox).
  var BASE = 'https://' + (process.env.SELF_ORIGIN || 'limenhelix.com');
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
    var peSamples = [];   // for γ (system gain) — collected, never fed back this cycle
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
        if (c) {
          // Augment with the multimodal interoception read + headline stress/phase (server feed
          // parity with the client adapter) so lightweight consumers see them without live brains.
          var _st = b.state || {};
          var _it = (_st.interoception && typeof _st.interoception === 'object') ? _st.interoception : (_st.cognition && _st.cognition.interoception) || null;
          c.interoception = _it ? { salience: val(_it.salience), attend: val(_it.attend), divergence: num(_it.divergence), channelCount: num(_it.channelCount), integrated: num(_it.integrated) } : null;
          c.stress = num(_st.stress);
          c.phase = val(_st.phaseLabel || _st.phase);
          try {
            c.serverPacket = serverPacket.fromBrainState(dom, _st, snap.meta, refreshId, new Date().toISOString());
          } catch (packetErr) {
            c.serverPacket = null;
            c.serverPacketAbstention = String(packetErr && packetErr.code || packetErr && packetErr.message || packetErr);
          }
          var r = await redisSet(PREFIX + dom, { c: c, ts: Date.now() }, TTL); if (r && r.ok) stored++;
          // predictionError is an OBJECT {total, novelty, stressError, ...} on the raw cognition
          // (compact() null'd it via num()). Read the scalar .total for γ.
          var _cog = b.state && b.state.cognition;
          var _peObj = _cog && _cog.model && _cog.model.predictionError;
          var _pe = (_peObj && typeof _peObj === 'object') ? _peObj.total : (typeof _peObj === 'number' ? _peObj : null);
          if (typeof _pe === 'number') peSamples.push({ domain: dom, pe: _pe });
        }
      } catch (e) {}
    }

    // ── γ (SYSTEM GAIN) — READ-ONLY collective-surprise signal. MODULATES NOTHING. ──
    // = the breadth of simultaneous surprise: what fraction of the interpretive brains
    // are in high prediction-error AT ONCE this cycle. This is NOT validated cross-domain
    // distress (only the financial kernel is validated) — it is the cheap experiment for
    // "does collective surprise across domains mean anything." We compute, store, and WATCH.
    // It feeds back into no brain. Removing this block changes zero behavior.
    var gammaRecord = null;
    try {
      // Threshold calibrated by mechanism test (gamma-mech probe): a domain's total
      // prediction-error sits ~0.15 at baseline and reaches ~0.35 under a near-maximal
      // stress shock. 0.40 was unreachable (γ would be dead-flat at 0). 0.25 sits
      // clearly above baseline and is crossed by a genuine shock. We also record the
      // full distribution (max + counts at several cuts) so we recalibrate from real data.
      var GAMMA_HIGH_PE = 0.25;
      var peVals = peSamples.map(function (s) { return s.pe; });
      var surprised = peSamples.filter(function (s) { return s.pe >= GAMMA_HIGH_PE; });
      var gamma = peVals.length ? surprised.length / peVals.length : 0;
      var meanPE = peVals.length ? peVals.reduce(function (a, v) { return a + v; }, 0) / peVals.length : 0;
      var maxPE = peVals.length ? Math.max.apply(null, peVals) : 0;
      var cnt = function (t) { return peVals.filter(function (v) { return v >= t; }).length; };
      gammaRecord = {
        gamma: Math.round(gamma * 1000) / 1000,            // 0..1 — fraction of brains destabilizing at once
        meanPredictionError: Math.round(meanPE * 1000) / 1000,
        maxPredictionError: Math.round(maxPE * 1000) / 1000,
        thresholdUsed: GAMMA_HIGH_PE,
        distribution: { ge_0_20: cnt(0.20), ge_0_25: cnt(0.25), ge_0_30: cnt(0.30), ge_0_40: cnt(0.40) },
        surprisedCount: surprised.length,
        brainsSampled: peVals.length,
        surprisedDomains: surprised.map(function (s) { return s.domain; }).sort(),
        ts: Date.now(),
        note: 'READ-ONLY interpretive collective-surprise; modulates nothing; NOT validated cross-domain distress'
      };
      var prev = await redisGet('limen:system_gain');
      var hist = (prev && Array.isArray(prev.history)) ? prev.history : [];
      hist.push({ g: gammaRecord.gamma, m: gammaRecord.meanPredictionError, n: gammaRecord.surprisedCount, ts: gammaRecord.ts });
      if (hist.length > 96) hist = hist.slice(hist.length - 96);   // ~2 days at 30-min cadence
      await redisSet('limen:system_gain', { current: gammaRecord, history: hist }, 7 * 24 * 3600);
    } catch (e) {}

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ran: ran, stored: stored, gamma: gammaRecord, ms: Date.now() - t0 }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e), ms: Date.now() - t0 }));
  }
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('brain-cognition-refresh', module.exports);
