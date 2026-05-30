/**
 * LIMEN Signal Router
 * Biosensor-optional signal abstraction layer.
 * Decouples all signal sources from propagation engine.
 *
 * Usage:
 *   const signals = LIMENSignalRouter.gatherInputs()
 *   const seeds = SignalMapper.mapSignals(signals)
 *   const state = LIMENPropagation.activate(seeds)
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════
  // CLASS 1 — LIMENSignalRouter
  // ═══════════════════════════════════════

  var _customSources = [];

  var LIMENSignalRouter = {
    gatherInputs: function () {
      var signals = [];
      // Always collect behavior + user choice
      var behav = BehaviorSignal.read();
      for (var i = 0; i < behav.length; i++) signals.push(behav[i]);
      var choice = UserChoiceSignal.read();
      for (var j = 0; j < choice.length; j++) signals.push(choice[j]);
      // Biosensor if active
      if (window.LIMENBiosensor && window.LIMENBiosensor.active) {
        var bio = BioSignal.read();
        for (var k = 0; k < bio.length; k++) signals.push(bio[k]);
      }
      // Custom registered sources
      for (var s = 0; s < _customSources.length; s++) {
        try {
          var custom = _customSources[s].read();
          if (custom && custom.length) {
            for (var c = 0; c < custom.length; c++) signals.push(custom[c]);
          }
        } catch (e) { /* skip failing sources */ }
      }
      return signals;
    },

    registerSource: function (sourceClass) {
      if (sourceClass && typeof sourceClass.read === 'function') {
        _customSources.push(sourceClass);
      }
    }
  };

  // ═══════════════════════════════════════
  // CLASS 2 — BehaviorSignal
  // ═══════════════════════════════════════

  var BehaviorSignal = {
    read: function () {
      var signals = [];
      var b = window.LIMENBehavior;
      if (!b) return signals;

      // Click cadence: fast or irregular clicks
      if (b.clickCadence !== undefined) {
        if (b.clickCadence > 3 || b.clickIrregular) {
          signals.push({ type: 'fastClicks', intensity: Math.min(1, (b.clickCadence || 4) / 8) });
        }
      }

      // Scroll velocity
      if (b.scrollVelocity !== undefined) {
        if (b.scrollVelocity > 500) {
          signals.push({ type: 'fastScrolling', intensity: Math.min(1, b.scrollVelocity / 2000) });
        }
      }

      // Pause duration: long dwell
      if (b.pauseDuration !== undefined) {
        if (b.pauseDuration > 3000) {
          signals.push({ type: 'slowReading', intensity: Math.min(1, b.pauseDuration / 10000) });
        }
      }

      // Node revisits
      if (b.nodeRevisits !== undefined) {
        if (b.nodeRevisits > 2) {
          signals.push({ type: 'revisiting', intensity: Math.min(1, b.nodeRevisits / 6) });
        }
      }

      return signals;
    }
  };

  // ═══════════════════════════════════════
  // CLASS 3 — UserChoiceSignal
  // ═══════════════════════════════════════

  var UserChoiceSignal = {
    read: function () {
      var signals = [];
      var u = window.LIMENUserChoice;
      if (!u) return signals;

      // Selected node IDs
      if (u.selectedNodes && u.selectedNodes.length) {
        for (var i = 0; i < u.selectedNodes.length; i++) {
          signals.push({ type: 'nodeSelected', nodeId: u.selectedNodes[i] });
        }
      }

      // Selected phase
      if (u.selectedPhase != null) {
        signals.push({ type: 'phaseSelected', phase: u.selectedPhase });
      }

      // Selected domain
      if (u.selectedDomain) {
        signals.push({ type: 'domainSelected', domain: u.selectedDomain });
      }

      return signals;
    }
  };

  // ═══════════════════════════════════════
  // BioSignal — optional biosensor bridge
  // ═══════════════════════════════════════

  var BioSignal = {
    read: function () {
      var signals = [];
      var bs = window.LIMENBiosensor;
      if (!bs || !bs.active) return signals;

      // Heart rate variability → stress signal
      if (bs.hrv !== undefined && bs.hrv > 0 && bs.hrv < 40) {
        signals.push({ type: 'lowHRV', intensity: Math.min(1, (60 - bs.hrv) / 40) });
      }

      // Elevated heart rate → arousal (was bs.hr, now bs.heartRate)
      if (bs.heartRate !== undefined && bs.heartRate > 90) {
        signals.push({ type: 'elevatedHR', intensity: Math.min(1, (bs.heartRate - 90) / 40) });
      }

      // High arousal → stress (replaces EDA which was never emitted)
      if (bs.arousal !== undefined && bs.arousal > 0.6) {
        signals.push({ type: 'highEDA', intensity: Math.min(1, (bs.arousal - 0.6) / 0.4) });
      }

      return signals;
    }
  };

  // ═══════════════════════════════════════
  // FeedStressSignal — domain feed → node seeds
  // Maps civilization domain stress to associated brain hub nodes.
  // Additive influence only — does not override user-selected issues.
  // ═══════════════════════════════════════

  var FEED_DOMAIN_NODES = {
    // Domain → array of {nodeId (numeric), weight} from DOMAIN_HUBS + extended mappings
    economy:     [{ id: 6, w: 0.6 }, { id: 12, w: 0.4 }],   // OFC + DLPFC
    energy:      [{ id: 31, w: 0.6 }, { id: 8, w: 0.3 }],    // Hypothalamus + AI
    environment: [{ id: 31, w: 0.5 }, { id: 73, w: 0.4 }],   // Hypothalamus + ENS
    health:      [{ id: 1, w: 0.5 }, { id: 17, w: 0.4 }],    // mPFC + BLA
    technology:  [{ id: 12, w: 0.6 }, { id: 15, w: 0.3 }],   // DLPFC + FPCN
    research:    [{ id: 20, w: 0.5 }, { id: 12, w: 0.3 }],   // HIPP + DLPFC
    supplyChain: [{ id: 73, w: 0.5 }, { id: 6, w: 0.4 }],     // ENS + OFC
    governance:     [{ id: 12, w: 0.5 }, { id: 9, w: 0.4 }],   // DLPFC + ACC
    infrastructure: [{ id: 73, w: 0.5 }, { id: 31, w: 0.4 }],  // ENS + Hypothalamus
    agriculture:    [{ id: 31, w: 0.5 }, { id: 73, w: 0.4 }],   // Hypothalamus + ENS
    industry:       [{ id: 6, w: 0.5 }, { id: 12, w: 0.4 }],    // OFC + DLPFC
    education:      [{ id: 20, w: 0.5 }, { id: 12, w: 0.3 }],   // HIPP + DLPFC
    communication:  [{ id: 8, w: 0.5 }, { id: 15, w: 0.4 }],    // AI + FPCN
    culture:        [{ id: 1, w: 0.5 }, { id: 2, w: 0.4 }],     // mPFC + PCC
    defense:        [{ id: 17, w: 0.5 }, { id: 18, w: 0.4 }],   // BLA + CeA
    religion:       [{ id: 1, w: 0.5 }, { id: 9, w: 0.4 }],     // mPFC + ACC
    population:     [{ id: 31, w: 0.5 }, { id: 1, w: 0.3 }],    // Hypothalamus + mPFC
    law:            [{ id: 12, w: 0.5 }, { id: 13, w: 0.4 }],   // DLPFC + vlPFC
    finance:        [{ id: 6, w: 0.6 }, { id: 24, w: 0.3 }],    // OFC + NAc
    intelligence:   [{ id: 8, w: 0.5 }, { id: 12, w: 0.4 }]     // AI + DLPFC
  };
  var FEED_STRESS_FLOOR = 0.4;   // Only emit signals for domains above this stress level
  var FEED_MAX_INTENSITY = 0.35; // Cap: feed stress never dominates user-driven activation

  var FeedStressSignal = {
    read: function () {
      var signals = [];
      var domains = window.LIMENDomains;
      if (!domains) return signals;
      for (var domainId in FEED_DOMAIN_NODES) {
        if (!FEED_DOMAIN_NODES.hasOwnProperty(domainId)) continue;
        var d = domains[domainId];
        if (!d || typeof d.stress !== 'number' || d.stress < FEED_STRESS_FLOOR) continue;
        // Scale stress above floor into 0–1 intensity, capped
        var rawIntensity = (d.stress - FEED_STRESS_FLOOR) / (1 - FEED_STRESS_FLOOR);
        var intensity = Math.min(rawIntensity, FEED_MAX_INTENSITY);
        signals.push({ type: 'feedStress', domain: domainId, intensity: intensity });
      }
      return signals;
    }
  };

  // ═══════════════════════════════════════
  // CLASS 4 — SignalMapper
  // ═══════════════════════════════════════

  // Phase → primary node IDs (numeric, from connectome-weights.json)
  var PHASE_NODES = {
    0:  [1, 2, 3, 7, 106],       // P0: mPFC, PCC, Precuneus, RSC, DMN Core
    1:  [8, 9, 10, 52],           // P1: AI, ACC, dACC, TPJ
    2:  [20, 21, 22, 23, 73],     // P2: HIPP, EC, Perirhinal, PHC, ENS
    3:  [6, 17, 18, 19, 59],      // P3: OFC, BLA, CeA, BNST, PAG
    4:  [12, 13, 15, 55],         // P4: DLPFC, vlPFC, FPCN, IPS
    5:  [16, 69, 70],             // P5: SMA, M1, PMC
    6:  [40, 41, 42, 43, 57],     // P6: MD, Pulvinar, AT, THAL, Cerebellum
    7:  [31, 32, 33, 96],         // P7: HYPO, Pituitary, Adrenal, SCN
    8:  [92, 93, 75],             // P8: BDNF, TrkB/mTOR, Astrocytes
    9:  [1, 2, 5, 105],           // P9: mPFC, PCC, vmPFC, DMN-MTL
    10: [3, 84, 97]               // P10: Precuneus, Gamma, Pineal
  };

  // Domain → hub node IDs (numeric)
  var DOMAIN_HUBS = {
    clinical:       1,   // mPFC
    agriculture:    73,  // ENS (gut-brain)
    education:      12,  // DLPFC
    business:       6,   // OFC
    communication:  14,  // Broca's/IFG
    civilization:   1,   // mPFC
    law:            9,   // ACC
    technology:     12,  // DLPFC
    environment:    31,  // Hypothalamus
    arts:           3,   // Precuneus
    sports:         16,  // SMA
    spirituality:   2    // PCC
  };

  var SignalMapper = {
    mapSignals: function (signals) {
      var seeds = {};

      function addSeed(nodeId, val) {
        if (!seeds[nodeId] || val > seeds[nodeId]) seeds[nodeId] = val;
      }

      for (var i = 0; i < signals.length; i++) {
        var sig = signals[i];
        var intensity = sig.intensity || 1;

        switch (sig.type) {
          case 'fastClicks':
            addSeed(17, 0.5 * intensity); // amygdala (BLA)
            addSeed(27, 0.4 * intensity); // LC
            break;

          case 'fastScrolling':
            addSeed(17, 0.4 * intensity); // amygdala (BLA)
            addSeed(8,  0.3 * intensity); // anterior insula (AI)
            break;

          case 'slowReading':
            addSeed(20, 0.4 * intensity); // hippocampus
            addSeed(12, 0.3 * intensity); // DLPFC
            break;

          case 'revisiting':
            addSeed(2,  0.5 * intensity); // PCC
            addSeed(20, 0.3 * intensity); // hippocampus
            break;

          case 'nodeSelected':
            if (sig.nodeId != null) addSeed(sig.nodeId, 1.0);
            break;

          case 'phaseSelected':
            var phaseNum = typeof sig.phase === 'string' ? parseInt(sig.phase.replace('P', '')) : sig.phase;
            var pNodes = PHASE_NODES[phaseNum];
            if (pNodes) {
              for (var p = 0; p < pNodes.length; p++) addSeed(pNodes[p], 0.8);
            }
            break;

          case 'domainSelected':
            var hub = DOMAIN_HUBS[sig.domain];
            if (hub) addSeed(hub, 0.7);
            break;

          // Biosensor signals
          case 'lowHRV':
            addSeed(31, 0.5 * intensity); // hypothalamus (HPA)
            addSeed(27, 0.4 * intensity); // LC
            break;

          case 'elevatedHR':
            addSeed(17, 0.4 * intensity); // BLA
            addSeed(8,  0.3 * intensity); // AI
            break;

          case 'highEDA':
            addSeed(17, 0.5 * intensity); // BLA
            addSeed(31, 0.3 * intensity); // hypothalamus
            break;

          case 'feedStress':
            // Map domain stress to associated brain hub nodes (additive, capped)
            var mapping = FEED_DOMAIN_NODES[sig.domain];
            if (mapping) {
              for (var m = 0; m < mapping.length; m++) {
                addSeed(mapping[m].id, mapping[m].w * intensity);
              }
            }
            break;
        }
      }

      return seeds;
    }
  };

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  // Auto-register feed stress as a signal source
  LIMENSignalRouter.registerSource(FeedStressSignal);

  window.LIMENSignalRouter = LIMENSignalRouter;
  window.BehaviorSignal = BehaviorSignal;
  window.UserChoiceSignal = UserChoiceSignal;
  window.BioSignal = BioSignal;
  window.FeedStressSignal = FeedStressSignal;
  window.SignalMapper = SignalMapper;

})();
