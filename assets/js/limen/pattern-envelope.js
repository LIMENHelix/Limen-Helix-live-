/**
 * LIMEN Helix — Pattern Envelope (universal brain-to-brain contract)
 *
 * Every brain in the fractal-recursive system emits the SAME envelope shape.
 * Master, Civilization, Connectome, the 20 domain brains, company portals,
 * opportunity surfaces, document drafts — all carry this shape.
 *
 * The envelope encodes the two-kernel readout (Thing 1 + Thing 2) plus the
 * pattern projection that downstream brains consume. Hardening rules H1
 * (provenance chain), H4 (idempotency hash), H7 (freshness receipt) are
 * enforced at the envelope level so every consumer can verify them
 * without trusting the producer.
 *
 * Exposed via window.LIMENPatternEnvelope.
 */
(function (root) {
  'use strict';

  var ENVELOPE_VERSION = 'pe-v1';
  var FRACTAL_LEVELS = {
    master:        0,
    civilization:  1,
    connectome:    1,
    domain:        2,
    business:      3,
    opportunity:   4,
    document:      5
  };

  // The 9 fractal operators (per limen_fractal_directional_architecture).
  // Every level addresses all 9, even if a value is 0 at that scale.
  var OPERATOR_KEYS = [
    'communication',
    'reporting',
    'auditing',
    'code',
    'patents',
    'grants',
    'investments',
    'phaseTracking',
    'phaseLogic'
  ];

  // The 6 engine lanes (per limen_engine_sequence_and_specs).
  var ENGINE_LANES = ['patent', 'grant', 'sba', 'franchise', 'investment', 'research'];

  // FNV-1a 64-bit-ish (folded into hex string). Deterministic, no crypto deps.
  function hash(str) {
    if (typeof str !== 'string') str = JSON.stringify(str);
    var h1 = 0x811c9dc5;
    var h2 = 0x84222325;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 ^= c;
      h1 = (h1 * 0x01000193) >>> 0;
      h2 ^= c;
      h2 = (h2 * 0x100000001b3) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) +
           ('00000000' + h2.toString(16)).slice(-8);
  }

  function safeStringify(o) {
    try {
      var seen = new WeakSet();
      return JSON.stringify(o, function (k, v) {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      });
    } catch (e) {
      return '[Unstringifiable:' + (e && e.message) + ']';
    }
  }

  // Build an empty operators block. Every brain fills what it has and leaves
  // null for what it doesn't address. Downstream code can rely on the key set.
  function emptyOperators() {
    var o = {};
    for (var i = 0; i < OPERATOR_KEYS.length; i++) {
      o[OPERATOR_KEYS[i]] = { readiness: 0, salience: 0, evidence: 0, gateSignal: null };
    }
    return o;
  }

  function emptyKernels() {
    return {
      thing1: {
        kernelId: null,
        kernelVersion: null,
        validationStatus: 'unavailable',
        alert: null,
        distressBand: null,
        narrativeSafe: []
      },
      thing2: {
        kernelId: null,
        kernelVersion: null,
        dominantPhase: null,
        phaseConfidence: 0,
        phaseVector: null,
        stress: 0,
        trajectory: null,
        coupling: {
          mode: 'intrinsic_only',
          source: 'none',
          intrinsic: null,
          coupled: null,
          biasContributions: null
        },
        interpretiveOnly: true
      }
    };
  }

  /**
   * Build a fresh envelope. Producer is expected to fill kernels + pattern
   * + outputs as it computes; provenance fields are finalized by seal().
   */
  function create(brainId, brainKind, options) {
    options = options || {};
    var level = FRACTAL_LEVELS[brainKind];
    if (level === undefined) level = 99;
    return {
      envelopeVersion: ENVELOPE_VERSION,
      brainId: String(brainId),
      brainKind: String(brainKind),
      fractalLevel: level,
      cycleId: typeof options.cycleId === 'number' ? options.cycleId : 0,
      ts: typeof options.ts === 'number' ? options.ts : Date.now(),

      kernels: emptyKernels(),

      pattern: {
        signature: null,           // computed at seal()
        salience: 0,                // 0..1 — how loudly this brain wants to be heard
        operators: emptyOperators(),
        nodes: {},                  // brainNodeId → { weight, role, state }
        bindings: [],               // [{ id, kind, weight, sourceSig }]
        crossDomainAffinities: [],  // [{ domain, role, strength }]
        artifacts: []               // [{ engineId, lane, status, outputId, sig }]
      },

      provenance: {
        chainSig: null,             // SHA-ish chain over [prevSig, inputs, kernels, pattern]
        prevSig: options.prevSig || null,
        inputs: [],                 // [{ brainId, cycleId, sig }]
        freshness: {
          kernelSnapshotTs: null,
          commandBoardTs: null,
          configSig: null,
          operator: null
        }
      },

      outputs: [],                  // [{ engineId, lane, payload, status, persistedAt, persistedSig }]

      degraded: false,              // fail-closed flag (H5)
      degradedReasons: []
    };
  }

  /**
   * Compute the deterministic pattern signature and freeze the provenance
   * chain. Call once when the producer is done populating the envelope.
   */
  function seal(env, options) {
    options = options || {};
    if (!env || typeof env !== 'object') {
      throw new Error('seal() requires an envelope object');
    }

    // Validate operators shape
    var ops = env.pattern.operators || {};
    for (var i = 0; i < OPERATOR_KEYS.length; i++) {
      var k = OPERATOR_KEYS[i];
      if (!ops[k] || typeof ops[k] !== 'object') {
        ops[k] = { readiness: 0, salience: 0, evidence: 0, gateSignal: null };
      }
    }
    env.pattern.operators = ops;

    // Pattern signature — content hash over the pattern block + kernels block.
    var patternBody = {
      brainId: env.brainId,
      brainKind: env.brainKind,
      cycleId: env.cycleId,
      kernels: env.kernels,
      pattern: {
        salience: env.pattern.salience,
        operators: env.pattern.operators,
        nodes: env.pattern.nodes,
        bindings: env.pattern.bindings,
        crossDomainAffinities: env.pattern.crossDomainAffinities,
        artifacts: env.pattern.artifacts
      }
    };
    var patternSig = hash(safeStringify(patternBody));
    env.pattern.signature = patternSig;

    // Provenance chain — incorporates prevSig + inputs
    var chainBody = {
      prevSig: env.provenance.prevSig,
      inputs: env.provenance.inputs,
      patternSig: patternSig,
      ts: env.ts
    };
    env.provenance.chainSig = hash(safeStringify(chainBody));

    // Freshness receipt (H7)
    env.provenance.freshness.kernelSnapshotTs =
      env.provenance.freshness.kernelSnapshotTs || env.ts;
    env.provenance.freshness.configSig = options.configSig || env.provenance.freshness.configSig;
    env.provenance.freshness.operator = options.operator || env.provenance.freshness.operator;

    return env;
  }

  /**
   * Verify that a sealed envelope's signature still matches its content.
   * Returns { ok, reason }.
   */
  function verify(env) {
    if (!env || typeof env !== 'object') return { ok: false, reason: 'not-object' };
    if (env.envelopeVersion !== ENVELOPE_VERSION) {
      return { ok: false, reason: 'envelope-version-mismatch' };
    }
    if (!env.pattern || !env.pattern.signature) {
      return { ok: false, reason: 'unsealed' };
    }
    var patternBody = {
      brainId: env.brainId,
      brainKind: env.brainKind,
      cycleId: env.cycleId,
      kernels: env.kernels,
      pattern: {
        salience: env.pattern.salience,
        operators: env.pattern.operators,
        nodes: env.pattern.nodes,
        bindings: env.pattern.bindings,
        crossDomainAffinities: env.pattern.crossDomainAffinities,
        artifacts: env.pattern.artifacts
      }
    };
    var expected = hash(safeStringify(patternBody));
    if (expected !== env.pattern.signature) {
      return { ok: false, reason: 'pattern-sig-mismatch', expected: expected, found: env.pattern.signature };
    }
    var chainExpected = hash(safeStringify({
      prevSig: env.provenance.prevSig,
      inputs: env.provenance.inputs,
      patternSig: env.pattern.signature,
      ts: env.ts
    }));
    if (chainExpected !== env.provenance.chainSig) {
      return { ok: false, reason: 'chain-sig-mismatch' };
    }
    return { ok: true };
  }

  /**
   * Mark an envelope degraded (H5 fail-closed). Sealed envelopes can still
   * be marked degraded post-hoc by consumers; the flag travels with the
   * pattern.
   */
  function degrade(env, reason) {
    env.degraded = true;
    env.degradedReasons = env.degradedReasons || [];
    env.degradedReasons.push({ at: Date.now(), reason: String(reason || 'unknown') });
    env.pattern.salience = 0;
    return env;
  }

  /**
   * Record an upstream pattern this brain consumed. Used by provenance chain.
   */
  function recordInput(env, upstreamEnv) {
    if (!upstreamEnv || !upstreamEnv.pattern || !upstreamEnv.pattern.signature) return env;
    env.provenance.inputs.push({
      brainId: upstreamEnv.brainId,
      cycleId: upstreamEnv.cycleId,
      sig: upstreamEnv.pattern.signature,
      ts: upstreamEnv.ts
    });
    return env;
  }

  /**
   * Add an engine artifact reference to the pattern. The actual artifact
   * payload is persisted via the engine-output endpoint; the envelope
   * carries the reference + content-hash for downstream provenance.
   */
  function recordArtifact(env, descriptor) {
    if (!descriptor || !descriptor.lane) return env;
    env.pattern.artifacts.push({
      engineId: descriptor.engineId || ('engine-' + descriptor.lane),
      lane: descriptor.lane,
      status: descriptor.status || 'READY_TO_SIGN',
      outputId: descriptor.outputId || null,
      sig: descriptor.sig || null,
      cik: descriptor.cik || null,
      ts: descriptor.ts || Date.now()
    });
    return env;
  }

  root.LIMENPatternEnvelope = {
    ENVELOPE_VERSION: ENVELOPE_VERSION,
    FRACTAL_LEVELS: FRACTAL_LEVELS,
    OPERATOR_KEYS: OPERATOR_KEYS,
    ENGINE_LANES: ENGINE_LANES,
    create: create,
    seal: seal,
    verify: verify,
    degrade: degrade,
    recordInput: recordInput,
    recordArtifact: recordArtifact,
    hash: hash,
    emptyOperators: emptyOperators,
    emptyKernels: emptyKernels
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
