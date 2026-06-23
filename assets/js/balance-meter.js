/**
 * balance-meter.js
 * LIMEN HELIX — Domain Balance Meter
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks both destabilizing and stabilizing pressure per domain.
 * Computes net balance so LIMEN reveals recovery, not only danger.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit
 * Listens: limen:domain-update
 * Emits: limen:balance-update (every cycle), limen:balance-shift (state change)
 * Output: window.LIMENBalance
 *
 * Load order: after domain-signal-engine.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var HISTORY_MAX = 12;

  // ─── Infrastructure-native semantics ──────────────────────────────────────
  // Energy parity: energy-brain.js maps live signal conditions to named
  // domain-native pathways (crude_above_90 / grid_stress / chokepoint …) with
  // weighted contributions, rather than treating stress as a single opaque
  // scalar. Civil infrastructure has its OWN failure/recovery vocabulary —
  // roads/bridges, water & sewer mains, the electric GRID (transmission &
  // distribution reliability), transit/transport, dams & levees, cyber-physical
  // (SCADA / ICS / CISA KEV), construction & public works, deferred maintenance,
  // and capital funding. Crude-price / oil / gas / nuclear / renewable content
  // is NOT used here; those energy primitives are translated to civil ones.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score.
  // This is the same shape as energy's condition→weight mapping, civil content.
  var INFRA_DESTABILIZING = [
    // Cyber-physical threat persistence — SCADA/ICS intrusions that dwell.
    { re: /scada|ics intrusion|cyber-?physical|cisa kev|known exploited|ransomware|control system/i, weight: 0.18, tag: 'cyber_physical_threat' },
    // Transmission / distribution grid reliability — the civil GRID, not fuel.
    { re: /transmission (line )?(fail|outage|congest)|distribution outage|grid reliability|frequency deviation|substation/i, weight: 0.16, tag: 'grid_reliability' },
    // Deferred maintenance acceleration / backlog spike.
    { re: /deferred maintenance|maintenance backlog|repair backlog|state of good repair/i, weight: 0.15, tag: 'deferred_maintenance' },
    // Structural assets in distress — bridges, dams, levees, tunnels.
    { re: /bridge (deficien|closure|fail)|structurally deficient|dam (fail|breach|deficien)|levee (fail|breach)|tunnel (fail|closure)/i, weight: 0.17, tag: 'structural_asset_failure' },
    // Water / sewer mains — breaks, boil-water, treatment failures.
    { re: /water main (break|fail)|sewer (overflow|fail)|boil(-| )water|treatment plant (fail|outage)|lead (service )?line/i, weight: 0.15, tag: 'water_system_failure' },
    // Transit / transport reliability — service collapse, derailment, bridge ban.
    { re: /transit (cut|collapse|breakdown)|derailment|service suspension|weight restriction|load posting/i, weight: 0.13, tag: 'transport_reliability' },
    // Supply-side hardware lead times — transformer / equipment shortage.
    { re: /transformer (shortage|lead time)|equipment (shortage|backorder)|long lead time|procurement delay/i, weight: 0.12, tag: 'equipment_lead_time' }
  ];
  var INFRA_STABILIZING = [
    // Capital funding renewal — appropriations, bonds, IIJA/grant inflow.
    { re: /funding (renew|secured|appropriat)|capital (program|plan) (approv|fund)|bond (issu|approv)|infrastructure (bill|act|grant)|reauthoriz/i, weight: 0.16, tag: 'funding_renewal' },
    // Capacity modernization — upgrades, hardening, resilience build-out.
    { re: /moderniz|capacity (expansion|upgrade)|hardening|resilience (upgrade|invest)|grid (upgrade|hardening)|seismic retrofit/i, weight: 0.14, tag: 'capacity_modernization' },
    // Repair completion rate — backlog being burned down, projects delivered.
    { re: /repair(s)? complet|backlog (reduc|cleared)|project(s)? delivered|restored to service|rehabilitation complet/i, weight: 0.15, tag: 'repair_completion' }
  ];

  // ─── Culture-native semantics ─────────────────────────────────────────────
  // Energy parity (same shape as INFRA above): culture has its OWN failure/
  // recovery vocabulary. Where energy reads crude_above_90 / grid_stress and
  // infrastructure reads grid_reliability / deferred_maintenance, CULTURE reads
  // the attention economy — fanbases & audience attention, artists/creators &
  // burnout, scenes & genres, streaming & virality, taste-making & trend
  // emergence, cultural movements & discourse. No grid/fuel content is used
  // here; every primitive is a cultural-semantic equivalent.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, cultural content.
  var CULTURE_DESTABILIZING = [
    // Backlash accumulation / cancellation risk — social-media fury, harassment.
    { re: /backlash|cancel(l?ed|lation|\s?culture)?|social media (fury|storm|pile-?on)|creator harassment|public shaming|controversy|outrage cycle/i, weight: 0.18, tag: 'backlash_accumulation' },
    // Audience attention collapse — fanbase exodus, engagement/listener drop-off.
    { re: /audience (exodus|collapse|decline|flight)|fan(base)? (exodus|decline|loss)|engagement (collapse|drop)|listener(ship)? (decline|drop)|unfollow(s)? surge|stream(s|ing)? (decline|drop)/i, weight: 0.16, tag: 'audience_attention_collapse' },
    // Scene saturation / trend collapse — oversupply, fatigue, dying trend.
    { re: /saturation|oversaturat|trend (collapse|fatigue|dying|exhaust)|scene (decline|fragment|collapse)|genre fatigue|content glut|algorithm fatigue/i, weight: 0.15, tag: 'scene_saturation' },
    // Creator burnout — overwork, exodus from platform, mental-health strain.
    { re: /creator (burnout|exodus|fatigue)|artist (burnout|exhaust|hiatus)|burnout|overwork|platform exodus|quit(ting)? (youtube|tiktok|twitch|the platform)/i, weight: 0.14, tag: 'creator_burnout' },
    // Cultural movement fragmentation — discourse splintering, infighting.
    { re: /fragment(ation|ing)?|infighting|movement (splinter|fractur|collaps)|tribal(ism|ize)|discourse (collaps|breakdown)|community (split|schism|fracture)/i, weight: 0.13, tag: 'movement_fragmentation' },
    // Gatekeeper / distribution chokepoint — deplatforming, demonetization.
    { re: /deplatform|demonetiz|shadow ?ban|delist|distribution (block|cut)|label (drop|shelv)|playlist removal|gatekeep(ing|er)/i, weight: 0.12, tag: 'distribution_chokepoint' }
  ];
  var CULTURE_STABILIZING = [
    // Fanbase momentum / breakout — viral moment, breakout artist, scene growth.
    { re: /fan(base)? (growth|momentum|surge|expansion)|breakout (artist|moment|hit|act)|viral (moment|hit|breakout)|going viral|chart (debut|climb|surge)|sold ?out (tour|show)/i, weight: 0.16, tag: 'fanbase_momentum' },
    // Taste-making emergence / scene momentum — new wave, tastemaker, movement.
    { re: /taste-?mak(er|ing)( emergence)?|scene (momentum|emergence|rising)|new wave|cultural movement (rising|gaining)|emerging (genre|sound|scene)|critical acclaim|buzz building/i, weight: 0.15, tag: 'tastemaker_emergence' },
    // Mainstream adoption / cultural crossover — breaking through, mass reach.
    { re: /mainstream (adoption|breakthrough|crossover)|cultural (adoption|crossover|breakthrough)|mass(-| )?market reach|breaking through|prime-?time|sync (placement|deal)|festival headlin/i, weight: 0.14, tag: 'mainstream_adoption' }
  ];

  // ─── Finance-native semantics ─────────────────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE above): finance has its OWN
  // failure/recovery vocabulary. Where energy reads crude_above_90 / grid_stress,
  // infrastructure reads grid_reliability / deferred_maintenance, and culture
  // reads the attention economy, FINANCE reads capital markets & credit:
  // liquidity & solvency, credit & lending, banking, funding & investment, M&A,
  // payments/fintech, corporate distress & default, and systemic financial risk.
  // No grid/fuel/cultural content is used here; every primitive is a
  // financial-semantic equivalent (liquidity crunch, credit-spread widening,
  // solvency pressure, margin call, capital flight, deleveraging cascade,
  // default risk, covenant breach, counterparty exposure, repo/haircut stress).
  //
  // IMPORTANT: this is the CLIENT-SIDE ADVISORY balance meter only. It does NOT
  // touch the validated P3 distress kernel (Thing1) — scoreStress / deriveDiagnoses,
  // /api/limen/score, /api/helix/helix-report/score are entirely separate server
  // paths and are not referenced here. This adds a finance-native pathway readout
  // alongside energy/infra/culture, identical mechanism, financial content.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, financial content.
  var FINANCE_DESTABILIZING = [
    // Liquidity crunch — funding markets seizing, dash for cash, runs.
    { re: /liquidity (crunch|crisis|squeeze|stress|dry(-| )?up)|funding (squeeze|stress|freeze)|cash (crunch|squeeze)|dash for cash|(bank|deposit) run|fire ?sale/i, weight: 0.18, tag: 'liquidity_crunch' },
    // Credit-spread widening — risk repricing, spread blowout, downgrades.
    { re: /credit spread(s)? (widen|blow|gap)|spread(s)? (widen|blow)|risk premium (surge|spike)|cds (spike|widen|blow)|(rating|credit) downgrade|junk (spread|bond) (surge|spike)/i, weight: 0.16, tag: 'credit_spread_widening' },
    // Solvency pressure — capital depletion, insolvency, negative equity.
    { re: /solvency (pressure|risk|concern)|insolven(t|cy)|under(-| )?capitaliz|capital (depletion|shortfall|hole)|negative equity|impair(ment|ed) charge|write(-| )?down/i, weight: 0.17, tag: 'solvency_pressure' },
    // Margin call / forced liquidation — leverage unwind, collateral calls.
    { re: /margin call|collateral call|forced (liquidation|selling|sale)|leverage unwind|margin (pressure|squeeze)|delever(age|aging) (forced|cascade)?|liquidat(e|ion) position/i, weight: 0.15, tag: 'margin_call' },
    // Default risk / covenant breach — distress, bankruptcy, missed payment.
    { re: /default (risk|wave|event)|covenant (breach|violation|waiver)|missed (payment|coupon)|bankrupt(cy)?|chapter 11|debt (restructur|distress)|payment default|technical default/i, weight: 0.16, tag: 'default_risk' },
    // Counterparty / contagion exposure — interbank stress, repo/haircut stress.
    { re: /counterparty (risk|exposure|fail)|contagion|interbank (stress|freeze)|repo (stress|freeze|spike)|haircut(s)? (rise|widen|increase)|systemic (risk|stress)|spillover/i, weight: 0.15, tag: 'counterparty_exposure' },
    // Capital flight — outflows, redemptions, deposit/asset withdrawal surge.
    { re: /capital flight|(fund|deposit|investor) (outflow|redemption|withdrawal)|outflow(s)? surge|flight to (safety|quality)|asset (flight|exodus)|run on (the )?(fund|bank)/i, weight: 0.13, tag: 'capital_flight' }
  ];
  var FINANCE_STABILIZING = [
    // Liquidity restoration — backstops, facilities, funding access reopening.
    { re: /liquidity (restor|inject|support|provision|backstop)|funding (secured|access restored|reopen)|(fed|central bank) (facility|backstop|support)|emergency facility|discount window|recapitaliz/i, weight: 0.16, tag: 'liquidity_restoration' },
    // Credit normalization — spreads tightening, upgrades, risk appetite return.
    { re: /credit spread(s)? (tighten|narrow|compress)|spread(s)? (tighten|narrow)|(rating|credit) upgrade|risk appetite (return|recover)|credit (normaliz|easing|reopen)|issuance (window|reopen)/i, weight: 0.15, tag: 'credit_normalization' },
    // Capital strengthening — raises, buffers rebuilt, deleveraging orderly.
    { re: /capital (raise|injection|infusion|buffer rebuilt|strengthen)|recapitaliz(ed|ation)|equity (raise|infusion)|balance(-| )?sheet (repair|strengthen)|orderly delever|debt (refinanc|repaid|reduced)/i, weight: 0.15, tag: 'capital_strengthening' }
  ];

  // Scan a domain's signal strings against a civil pattern table and return the
  // summed weighted contribution (clamped). Mirrors how energy accumulates its
  // condition-driven pressure, but over civil-native keywords.
  function _infraSignalScore(signals, table) {
    if (!signals || !signals.length) return { score: 0, tags: [] };
    var total = 0;
    var tags = [];
    for (var t = 0; t < table.length; t++) {
      var ent = table[t];
      for (var i = 0; i < signals.length; i++) {
        var s = String(signals[i] || '');
        if (ent.re.test(s)) {
          total += ent.weight;
          tags.push(ent.tag);
          break; // count each pattern at most once
        }
      }
    }
    return { score: _clamp(total, 0, 0.6), tags: tags };
  }

  // ─── State ───────────────────────────────────────────────────────────────

  var _balance = {};
  var _stressHistory = {};
  var _prevState = {};

  function _init() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      _balance[k] = { destabilizing: 0, stabilizing: 0, net: 0, state: 'neutral' };
      _stressHistory[k] = [];
      _prevState[k] = 'neutral';
    }
  }
  _init();

  // ─── Balance computation ──────────────────────────────────────────────

  function _compute() {
    var domains = window.LIMENDomains || {};
    var shifts = [];

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d) continue;

      var stress = d.stress || 0;
      var trend = d.trend || 0;
      var confidence = d.confidence || 0;
      var signals = d.signals || [];

      // Track stress history for volatility + trajectory
      _stressHistory[k].push(stress);
      if (_stressHistory[k].length > HISTORY_MAX) _stressHistory[k].shift();

      // ─── Destabilizing score ────────────────────────────────────
      // High stress, rising trend, high volatility = destabilizing
      var destab = 0;

      // Current stress level (primary factor)
      destab += stress * 0.55;

      // Rising trend amplifies
      if (trend > 0.02) {
        destab += trend * 2.0;
      }

      // Volatility (std dev of recent history)
      var vol = _stddev(_stressHistory[k]);
      destab += vol * 1.5;

      // Low confidence means less trust in data, slight destab
      if (confidence < 0.3 && stress > 0.3) {
        destab += 0.05;
      }

      // ── Infrastructure-native destabilizing pathways (energy parity) ──
      // For the infrastructure domain ONLY, add civil-specific pressure from
      // named failure pathways found in the live signal strings (grid reliability,
      // cyber-physical/SCADA threat persistence, deferred-maintenance acceleration,
      // structural-asset failure, water-system failure, transport reliability,
      // equipment lead time). This is the civil analogue of energy's
      // crude_above_*/grid_stress/chokepoint condition weighting.
      var _infraDestabTags = null;
      if (k === 'infrastructure') {
        var _id = _infraSignalScore(signals, INFRA_DESTABILIZING);
        destab += _id.score;
        _infraDestabTags = _id.tags;
      }

      // ── Culture-native destabilizing pathways (energy parity) ──
      // For the culture domain ONLY, add cultural-semantic pressure from named
      // failure pathways found in the live signal strings (backlash accumulation,
      // audience-attention collapse, scene saturation / trend collapse, creator
      // burnout, cultural-movement fragmentation, distribution chokepoints). This
      // is the attention-economy analogue of energy's crude_above_*/grid_stress
      // and infrastructure's grid_reliability/deferred_maintenance weighting.
      var _cultureDestabTags = null;
      if (k === 'culture') {
        var _cd = _infraSignalScore(signals, CULTURE_DESTABILIZING);
        destab += _cd.score;
        _cultureDestabTags = _cd.tags;
      }

      // ── Finance-native destabilizing pathways (energy parity) ──
      // For the finance domain ONLY, add financial-semantic pressure from named
      // failure pathways found in the live signal strings (liquidity crunch,
      // credit-spread widening, solvency pressure, margin call / forced
      // liquidation, default risk / covenant breach, counterparty/contagion
      // exposure, capital flight). This is the capital-markets analogue of
      // energy's crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, and culture's backlash/audience-collapse weighting.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _financeDestabTags = null;
      if (k === 'finance') {
        var _fd = _infraSignalScore(signals, FINANCE_DESTABILIZING);
        destab += _fd.score;
        _financeDestabTags = _fd.tags;
      }

      destab = _clamp(destab, 0, 1);

      // ─── Stabilizing score ─────────────────────────────────────
      // Falling trend, reducing volatility, improving trajectory = stabilizing
      var stab = 0;

      // Falling trend is stabilizing
      if (trend < -0.02) {
        stab += Math.abs(trend) * 2.5;
      }

      // Low and stable stress is stabilizing
      if (stress < 0.30) {
        stab += (0.30 - stress) * 0.8;
      }

      // Decreasing volatility over time
      if (_stressHistory[k].length >= 6) {
        var olderVol = _stddev(_stressHistory[k].slice(0, Math.floor(_stressHistory[k].length / 2)));
        var newerVol = _stddev(_stressHistory[k].slice(Math.floor(_stressHistory[k].length / 2)));
        if (olderVol > newerVol + 0.01) {
          stab += (olderVol - newerVol) * 3.0;
        }
      }

      // Trajectory: if stress was higher before and is now lower
      if (_stressHistory[k].length >= 4) {
        var older = _avg(_stressHistory[k].slice(0, 3));
        var newer = _avg(_stressHistory[k].slice(-3));
        if (older > newer + 0.02) {
          stab += (older - newer) * 2.0;
        }
      }

      // High confidence in low-stress data is stabilizing
      if (confidence > 0.7 && stress < 0.40) {
        stab += 0.08;
      }

      // ── Infrastructure-native stabilizing pathways (energy parity) ──
      // Civil recovery vocabulary: capital funding renewal, capacity
      // modernization, and repair completion rate. Mirrors energy's
      // falling-trend / declining-volatility stabilizers but with civil
      // semantics drawn from the live signal strings.
      var _infraStabTags = null;
      if (k === 'infrastructure') {
        var _is = _infraSignalScore(signals, INFRA_STABILIZING);
        stab += _is.score;
        _infraStabTags = _is.tags;
      }

      // ── Culture-native stabilizing pathways (energy parity) ──
      // Cultural recovery vocabulary: fanbase momentum / breakout, taste-making
      // emergence & scene momentum, mainstream adoption / cultural crossover.
      // Mirrors energy's falling-trend / declining-volatility stabilizers and
      // infrastructure's funding-renewal / repair-completion, with cultural
      // semantics drawn from the live signal strings.
      var _cultureStabTags = null;
      if (k === 'culture') {
        var _cs = _infraSignalScore(signals, CULTURE_STABILIZING);
        stab += _cs.score;
        _cultureStabTags = _cs.tags;
      }

      // ── Finance-native stabilizing pathways (energy parity) ──
      // Financial recovery vocabulary: liquidity restoration (backstops/
      // facilities), credit normalization (spreads tightening / upgrades), and
      // capital strengthening (raises / orderly deleveraging). Mirrors energy's
      // falling-trend / declining-volatility stabilizers, infrastructure's
      // funding-renewal / repair-completion, and culture's fanbase-momentum /
      // mainstream-adoption, with financial semantics from the live signals.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _financeStabTags = null;
      if (k === 'finance') {
        var _fs = _infraSignalScore(signals, FINANCE_STABILIZING);
        stab += _fs.score;
        _financeStabTags = _fs.tags;
      }

      stab = _clamp(stab, 0, 1);

      // ─── Net balance ───────────────────────────────────────────
      var net = _round(stab - destab);
      destab = _round(destab);
      stab = _round(stab);

      // State label
      var state = 'neutral';
      if (net > 0.08) state = 'improving';
      else if (net < -0.08) state = 'destabilizing';

      _balance[k] = {
        destabilizing: destab,
        stabilizing: stab,
        net: net,
        state: state
      };

      // Surface the civil-native pathways that drove the infrastructure score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'infrastructure') {
        _balance[k].destabilizingFactors = _infraDestabTags || [];
        _balance[k].stabilizingFactors = _infraStabTags || [];
      }

      // Surface the culture-native pathways that drove the culture score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'culture') {
        _balance[k].destabilizingFactors = _cultureDestabTags || [];
        _balance[k].stabilizingFactors = _cultureStabTags || [];
      }

      // Surface the finance-native pathways that drove the finance score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'finance') {
        _balance[k].destabilizingFactors = _financeDestabTags || [];
        _balance[k].stabilizingFactors = _financeStabTags || [];
      }

      // Detect state shift
      if (_prevState[k] !== state) {
        shifts.push({ domain: k, from: _prevState[k], to: state, net: net });
        _prevState[k] = state;
      }
    }

    window.LIMENBalance = _balance;
    _dispatch('limen:balance-update', { balance: _balance, updated: Date.now() });

    // Emit shifts
    for (var s = 0; s < shifts.length; s++) {
      _dispatch('limen:balance-shift', shifts[s]);
    }
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    _compute();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        _compute();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      _compute();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _avg(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function _stddev(arr) {
    if (arr.length < 2) return 0;
    var mean = _avg(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      var diff = arr[i] - mean;
      sum += diff * diff;
    }
    return Math.sqrt(sum / arr.length);
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENBalance = _balance;

  window.LIMENBalanceMeter = {
    start: start,
    stop: stop
  };

})();
