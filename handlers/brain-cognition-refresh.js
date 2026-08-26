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
const limenDb = require('../lib/limen-db.js');
const financeSemanticPacket = require('../lib/finance-semantic-packet.js');
const serverPacket = require('../lib/civilization-server-packet.js');
const handoffStore = require('../lib/civilization-handoff-store.js');
const handoffConsumer = require('../lib/civilization-handoff-consumer.js');
const efferenceStore = require('../lib/autofire-efference-store.js');
const financePaperAdmission = require('../lib/finance-paper-admission.js');
const productDomainMotorReceipt = require('../lib/product-domain-motor-receipt.js');
const productDomainMotorCapabilityOverlay = require('../lib/product-domain-motor-capability-overlay.js');
const cronAuth = require('../lib/cron-auth.js');
const compactCognition = require('../lib/brain-cognition-compact.js').compact;

// The packet consumer is strict by design: unlike the cognition projection,
// it never falls back to process memory when Redis is missing or fails.
const CIV_STORE = handoffStore.createStore();
const CIV_CONSUMER = handoffConsumer.createConsumer({ store: CIV_STORE });

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
  // Deterministic organ dependencies must exist in the VM before any brain
  // constructor runs. Without them plasticity and active inference silently
  // report mode:off in the autonomous server cycle even though browser source
  // audits pass. Phase/Thing 2 remains intentionally out of this activation.
  'assets/js/limen-k4-selfconsistency.js',
  'assets/js/limen-plasticity.js',
  'assets/js/limen-active-inference.js',
  'assets/js/domain-brains/domain-brain-base.js',
  'assets/js/domain-brains/portal-content-resolver.js',
  'assets/js/domain-brains/inter-brain-bus.js',
  'assets/js/domain-brains/domain-change-log.js'
].concat(DOMAINS.map(function (d) { return 'assets/js/domain-brains/' + d + '-brain.js'; }));

/* Finance is the only active investment manager. Read only its durable title
 * store and carry a bounded, source-preserving window into the server packet.
 * A Redis failure is an explicit abstention; the ordinary limen-db memory
 * fallback must never masquerade as production evidence here. */
async function readFinanceSemanticEvidence() {
  try {
    var sets = await limenDb.lrangeStrict('feedtitles:finance', 0, financeSemanticPacket.MAX_SETS);
    var built = financeSemanticPacket.build(sets, 'finance', Date.now());
    built.meta.backend = 'redis';
    return built;
  } catch (e) {
    return {
      schemaVersion: financeSemanticPacket.SCHEMA,
      observations: [],
      meta: {
        schemaVersion: financeSemanticPacket.SCHEMA,
        status: 'ABSTAINED',
        reason: 'finance-title-store-unavailable',
        sourceKey: 'feedtitles:finance',
        backend: 'redis-required',
        errorCode: e && e.code ? String(e.code) : 'FINANCE_TITLE_STORE_READ_FAILED',
        truncated: false,
        retrievedAt: new Date().toISOString()
      }
    };
  }
}

/* Read only fully admitted paper candidates from the strict actuator store.
 * A Preview receipt alone is not permission to enter the trusted packet. */
async function readFinancePaperAdmissions() {
  try {
    efferenceStore.assertDurable();
    var log = await efferenceStore.lrange(financePaperAdmission.LOG_KEY, 0, 19);
    var opportunities = [], seen = Object.create(null);
    for (var i = 0; i < log.length && opportunities.length < 8; i++) {
      var packetId = log[i] && log[i].packetId;
      if (!packetId || seen[packetId]) continue;
      seen[packetId] = true;
      var receipt = await efferenceStore.get(financePaperAdmission.admissionKey(packetId));
      var replay = receipt && receipt.replayCandidate;
      if (!receipt || receipt.status !== 'ADMITTED_TO_PAPER' ||
          !receipt.safety || receipt.safety.paperOnly !== true ||
          receipt.safety.brokerTouched !== false || receipt.safety.orderPlaced !== false ||
          receipt.safety.liveMoney !== false || !replay) continue;
      opportunities.push(replay);
    }
    return { opportunities: opportunities, status: 'OBSERVED', source: financePaperAdmission.LOG_KEY };
  } catch (e) {
    return { opportunities: [], status: 'ABSTAINED', source: financePaperAdmission.LOG_KEY,
      errorCode: e && e.code ? String(e.code) : 'FINANCE_PAPER_ADMISSION_READ_FAILED' };
  }
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
  res.setHeader('cache-control', 'no-store');
  // This cycle writes cognition, packet/handoff, motor-receipt and system-gain
  // state. It is a cron actuator even though its HTTP method is GET, so request
  // reachability must never be mistaken for authority.
  if (!cronAuth.enforce(req, res)) return;
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

    var financeSemantic = await readFinanceSemanticEvidence();
    var financeAdmissions = await readFinancePaperAdmissions();
    var ran = 0, stored = 0, motorReceiptsStored = 0;
    var motorReceiptFailures = [];
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
        // Import only this product brain's independently persisted executor +
        // observer evidence. The overlay cannot alter external switches, spend,
        // capital authority, or another domain's state. Missing/stale evidence
        // actively clears both booleans before the readiness receipt is built.
        var _motorCapability = await productDomainMotorCapabilityOverlay.apply(
          efferenceStore, dom, b, refreshId, Date.now()
        );
        var c = compactCognition(b.state && b.state.cognition);
        if (c) {
          // Augment with the multimodal interoception read + headline stress/phase (server feed
          // parity with the client adapter) so lightweight consumers see them without live brains.
          var _st = b.state || {};
          var _motorReceipt = await productDomainMotorReceipt.persist(
            efferenceStore, dom, _st, refreshId, Date.now()
          );
          c.motorReceiptPersistence = _motorReceipt.ok ? {
            ok: true,
            restored: _motorReceipt.restored === true,
            key: _motorReceipt.key,
            receiptId: _motorReceipt.receipt.receiptId,
            ownerDomain: _motorReceipt.receipt.ownerDomain,
            contractId: _motorReceipt.receipt.contractId,
            lane: _motorReceipt.receipt.lane,
            status: _motorReceipt.receipt.status,
            blockers: _motorReceipt.receipt.blockers,
            safety: _motorReceipt.receipt.safety
          } : _motorReceipt;
          c.motorCapabilityEvidence = _motorCapability;
          if (_motorReceipt.ok) motorReceiptsStored++;
          else motorReceiptFailures.push({ domain: dom, error: _motorReceipt.error, detail: _motorReceipt.detail });
          var _it = (_st.interoception && typeof _st.interoception === 'object') ? _st.interoception : (_st.cognition && _st.cognition.interoception) || null;
          c.interoception = _it ? { salience: val(_it.salience), attend: val(_it.attend), divergence: num(_it.divergence), channelCount: num(_it.channelCount), integrated: num(_it.integrated) } : null;
          // Runtime proof for the later Energy-reference organs. These are
          // observation fields only; they grant no provider, broker, posting,
          // spending, or other external authority.
          var _pl = _st.domainPlasticity || _st.energyPlasticity || null;
          var _ai = _st.domainActiveInference || _st.energyActiveInference || null;
          var _eq = _st.domainEmissionQueue || _st.energyEmissionQueue || null;
          var _ae = _st.domainAutoEmission || _st.energyAutoEmission || null;
          var _rm = _st.resourceMetabolism || null;
          c.brainOrgans = {
            plasticity: _pl ? {
              mode: val(_pl.mode), rewardActive: _pl.rewardActive === true,
              liveLayers: arr(_pl.liveLayers).slice(0, 8),
              persistenceEnabled: !!(_pl.persistence && (_pl.persistence.enabled || _pl.persistence.persistEnabled)),
              hydrated: !!(_pl.persistence && _pl.persistence.hydrated)
            } : null,
            activeInference: _ai ? { mode: val(_ai.mode), selected: val(_ai.selected), agreement: val(_ai.agreement) } : null,
            emissionQueue: _eq ? { queued: num(_eq.queued), poolSize: num(_eq.poolSize), domain: val(_eq.domain) } : null,
            autonomousInternalEmission: _ae ? {
              holdReason: val(_ae.holdReason), emittedCount: num(_ae.emittedCount), stagedCount: num(_ae.stagedCount),
              outwardAuthority: false
            } : null,
            resourceMetabolism: _rm ? { ownerDomain: val(_rm.ownerDomain), state: val(_rm.state), gates: val(_rm.gates) } : null
          };
          c.stress = num(_st.stress);
          c.phase = val(_st.phaseLabel || _st.phase);
          try {
            var _domainJoin = snap.domainCompanyJoin && snap.domainCompanyJoin[dom] || null;
            var _phaseEvidence = _domainJoin && Array.isArray(_domainJoin.companies)
              ? _domainJoin.companies.filter(function (co) { return co && co.scored === true && co.phase; }).slice(0, 32).map(function (co) {
                return { source: 'company-phase-scorer', cik: co.cik || null, ticker: co.ticker || null, phase: co.phase, trajectory: co.trajectory || null, observedAt: co.timestamp || null };
              }) : [];
            var _packetExtras = {
              companyDomainJoin: _domainJoin,
              phaseEvidence: _phaseEvidence,
              bridgePattern: _st.bridgePattern || _st.bridgeReadings || null,
              regulation: _st.regulation || null,
              recovery: _st.recovery || null,
              mappings: _st.homologyMappings || null
            };
            if (dom === 'finance') {
              _packetExtras.semanticEvidence = financeSemantic.observations;
              _packetExtras.semanticEvidenceMeta = financeSemantic.meta;
              _packetExtras.releasedOpportunities = financeAdmissions.opportunities;
            }
            // Packet capture is an observation step, not an opportunity gate:
            // Finance must still emit a packet when stress is null/low and the
            // opportunity list is empty. Opportunity release is a later,
            // source-grounded boundary and may abstain independently.
            c.serverPacket = serverPacket.fromBrainState(
              dom, _st, snap.meta, refreshId, new Date().toISOString(), _packetExtras
            );
            c.serverPacketPersistence = await CIV_CONSUMER.consumePacket(c.serverPacket);
          } catch (packetErr) {
            c.serverPacket = null;
            c.serverPacketAbstention = String(packetErr && packetErr.code || packetErr && packetErr.message || packetErr);
            c.serverPacketPersistence = { ok: false, error: { code: packetErr && packetErr.code || 'PACKET_BUILD_FAILED', message: String(packetErr && packetErr.message || packetErr) } };
          }
          var r = await redisSet(PREFIX + dom, { c: c, ts: Date.now() }, TTL); if (r && r.ok) stored++;
          // predictionError is an OBJECT {total, novelty, stressError, ...} on the raw cognition
          // (compactCognition() null'd it via num()). Read the scalar .total for γ.
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
    return res.end(JSON.stringify({
      ok: true,
      ran: ran,
      stored: stored,
      motorReceipts: {
        attempted: ran,
        storedAndRestored: motorReceiptsStored,
        failures: motorReceiptFailures
      },
      gamma: gammaRecord,
      ms: Date.now() - t0
    }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e), ms: Date.now() - t0 }));
  }
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('brain-cognition-refresh', module.exports);
