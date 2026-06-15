/**
 * LIMEN Helix — Claude Engine Runner (rate-limited)
 *
 * Drop-in replacement for the default engineRunner in MasterLivingBrain.
 * Pipeline per engine descriptor:
 *
 *   1. Build contextPacket via LIMENEngineContextBuilder.build(...)
 *   2. POST /api/expand-artifact-claude with (lane, cik, packet, sig)
 *      → receives draftBody + structured + provenance
 *   3. POST /api/limen-engine-output with the real draft payload
 *      → receives outputId + persistedSig (H1 chain + H7 freshness)
 *   4. Return result to master so it can attach to next pattern's artifacts
 *
 * Rate limiting: at most one Claude call per (cik, lane) per
 * RATE_LIMIT_MS (default 10 minutes). Master cycles every 8s — without
 * this the page would burn through Anthropic credits in seconds.
 *
 * Exposed via window.LIMENEngineRunnerClaude.create() — returns a
 * function suitable for `new LIMENMasterLivingBrain({ engineRunner })`.
 */
(function (root) {
  'use strict';

  var Context = root.LIMENEngineContextBuilder;
  if (!Context) {
    console.error('[EngineRunnerClaude] requires LIMENEngineContextBuilder');
    return;
  }

  var DEFAULTS = {
    rateLimitMs: 10 * 60 * 1000,    // 10 min per (cik, lane)
    minReadiness: 0.45,              // skip Claude calls below this
    claudeEndpoint: '/api/expand-artifact-claude',
    persistEndpoint: '/api/limen-engine-output',
    laneAllowList: null,             // null = all lanes; else array
    onResult: null,                  // callback({lane, cik, outputId, ...})
    onSectionDone: null,             // callback per section (multi-pass progress)
    // Lanes that exceed single-call cap — use multi-pass runner.
    // Stays in sync with LANE_SECTIONS in api/expand-artifact-claude.js.
    multiPassLanes: []
  };

  function create(options) {
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = DEFAULTS[k]; });
    if (options) Object.keys(options).forEach(function (k) { cfg[k] = options[k]; });

    var _lastCallAt = {};   // (lane + ':' + cik) → ts
    var _inFlight = {};     // (lane + ':' + cik) → true
    var _log = [];          // ring buffer of attempts
    var _logMax = 200;

    function _key(descriptor) {
      return String(descriptor.lane || '') + ':' + String(descriptor.cik || 'no-cik');
    }

    function _shouldCall(descriptor) {
      // Lane allow-list
      if (cfg.laneAllowList && cfg.laneAllowList.indexOf(descriptor.lane) === -1) {
        return { ok: false, reason: 'lane-not-allowed' };
      }
      // Minimum readiness
      if (typeof descriptor.readiness === 'number' && descriptor.readiness < cfg.minReadiness) {
        return { ok: false, reason: 'below-min-readiness', readiness: descriptor.readiness };
      }
      var k = _key(descriptor);
      if (_inFlight[k]) return { ok: false, reason: 'in-flight' };
      var last = _lastCallAt[k] || 0;
      var sinceMs = Date.now() - last;
      if (sinceMs < cfg.rateLimitMs) {
        return { ok: false, reason: 'rate-limited', remainingMs: cfg.rateLimitMs - sinceMs };
      }
      return { ok: true };
    }

    function _record(entry) {
      _log.push(Object.assign({ at: Date.now() }, entry));
      if (_log.length > _logMax) _log.splice(0, _log.length - _logMax);
    }

    // The runner function master invokes per engine descriptor
    function runner(envelope, descriptor) {
      var gate = _shouldCall(descriptor);
      if (!gate.ok) {
        _record({ phase: 'gate-skip', lane: descriptor.lane, cik: descriptor.cik, reason: gate.reason });
        return Promise.resolve({ skipped: true, reason: gate.reason });
      }

      var k = _key(descriptor);
      _inFlight[k] = true;
      _lastCallAt[k] = Date.now();
      _record({ phase: 'begin', lane: descriptor.lane, cik: descriptor.cik, sig: envelope.pattern.signature });

      // 1. Build context
      return Context.build({
        cik: descriptor.cik,
        slug: descriptor.slug,
        lane: descriptor.lane,
        domain: descriptor.domain
      })
      .then(function (contextPacket) {
        _record({ phase: 'context-built', lane: descriptor.lane, cik: descriptor.cik,
                  citations: (contextPacket.evidence.citations || []).length,
                  news: (contextPacket.evidence.news || []).length });

        var isMultiPass = cfg.multiPassLanes.indexOf(descriptor.lane) !== -1 &&
                          !!root.LIMENMultiPassRunner;

        // 2. POST to Claude (single-call or multi-pass)
        var claudePromise;
        if (isMultiPass) {
          _record({ phase: 'multi-pass-start', lane: descriptor.lane, cik: descriptor.cik });
          claudePromise = root.LIMENMultiPassRunner.runMultiPass({
            lane: descriptor.lane,
            cik: descriptor.cik,
            sourcePatternSig: envelope.pattern.signature,
            contextPacket: contextPacket,
            readiness: descriptor.readiness,
            kernelSnapshot: { thing2: envelope.kernels.thing2, ts: envelope.ts }
          }, {
            endpoint: cfg.claudeEndpoint,
            onSectionDone: function (sect) {
              _record({ phase: 'pass-done', lane: descriptor.lane, cik: descriptor.cik,
                        sectionIndex: sect.sectionIndex, sectionId: sect.sectionId,
                        ok: sect.ok, draftBytes: sect.draftBytes, tokens: sect.tokens });
              if (typeof cfg.onSectionDone === 'function') {
                try { cfg.onSectionDone(Object.assign({ lane: descriptor.lane, cik: descriptor.cik }, sect)); } catch (_) {}
              }
            }
          }).then(function (mpResult) {
            // Shape it like the single-call Claude response so the rest
            // of the pipeline (persistence + onResult) stays unchanged.
            return {
              status: 200,
              body: {
                ok: mpResult.ok,
                model: mpResult.provenance.model,
                usage: { output_tokens: mpResult.provenance.totalTokens },
                draftBody: mpResult.draftBody,
                structured: mpResult.structured,
                bannedHits: [],  // multi-pass aggregates per-section; lint at persist time
                multiPass: true,
                passes: mpResult.passes,
                provenance: mpResult.provenance
              }
            };
          }).catch(function (err) {
            return { status: 502, body: { ok: false, error: 'multi-pass-failed', detail: String(err && err.message || err) } };
          });
        } else {
          claudePromise = fetch(cfg.claudeEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              lane: descriptor.lane,
              cik: descriptor.cik,
              sourcePatternSig: envelope.pattern.signature,
              contextPacket: contextPacket,
              readiness: descriptor.readiness,
              kernelSnapshot: { thing2: envelope.kernels.thing2, ts: envelope.ts }
            })
          })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
        }

        return claudePromise
        .then(function (claudeResp) {
          if (!claudeResp.body || !claudeResp.body.ok) {
            _record({ phase: 'claude-error', lane: descriptor.lane, cik: descriptor.cik,
                      status: claudeResp.status,
                      error: claudeResp.body && claudeResp.body.error });
            return { claudeError: claudeResp.body && claudeResp.body.error || 'claude-failed', httpStatus: claudeResp.status };
          }
          _record({ phase: 'claude-ok', lane: descriptor.lane, cik: descriptor.cik,
                    model: claudeResp.body.model,
                    multiPass: !!claudeResp.body.multiPass,
                    passCount: claudeResp.body.passes ? claudeResp.body.passes.length : 1,
                    bannedHits: (claudeResp.body.bannedHits || []).length });

          // 3. POST to persistence
          var draftBody = claudeResp.body.draftBody || '';
          var structured = claudeResp.body.structured || {};
          // Multi-pass already flattens to structured.evidenceCitationsUsed;
          // single-call has the outer/inner double-nesting.
          var citationsUsed = (structured && structured.structured && structured.structured.evidenceCitationsUsed) ||
                              (structured && structured.evidenceCitationsUsed) || [];

          // Resolve nested vs flat structured shape (multi-pass returns
          // flat structured; single-call has outer wrapping inner).
          var resolvedInner = structured.structured || structured;

          var persistHeaders = { 'content-type': 'application/json' };
          if (typeof window !== 'undefined' && window.LIMEN_OPERATOR_TOKEN) {
            persistHeaders.authorization = 'Bearer ' + window.LIMEN_OPERATOR_TOKEN;
          }
          return fetch(cfg.persistEndpoint, {
            method: 'POST',
            headers: persistHeaders,
            body: JSON.stringify({
              cik: descriptor.cik,
              slug: descriptor.slug || null,
              engineId: descriptor.engineId,
              lane: descriptor.lane,
              sourcePatternSig: envelope.pattern.signature,
              readiness: descriptor.readiness,
              operator: descriptor.operator || null,
              kernelSnapshot: {
                thing2: envelope.kernels.thing2,
                ts: envelope.ts
              },
              payload: {
                title: resolvedInner.title || (descriptor.lane + ' draft'),
                lane: descriptor.lane,
                agency_or_office: resolvedInner.agency_or_office || null,
                format_standard: resolvedInner.format_standard || null,
                draftBody: draftBody,
                structured: resolvedInner,
                readyToSign: !!resolvedInner.readyToSign,
                openItems: resolvedInner.openItems || [],
                readyToSignChecklist: resolvedInner.readyToSignChecklist || [],
                wordCount: resolvedInner.wordCount || null,
                multiPass: !!claudeResp.body.multiPass,
                passes: claudeResp.body.passes || null,
                claudeProvenance: claudeResp.body.provenance,
                claudeUsage: claudeResp.body.usage,
                claudeModel: claudeResp.body.model,
                bannedHits: claudeResp.body.bannedHits || [],
                citations: citationsUsed
              }
            })
          })
          .then(function (r2) { return r2.json().then(function (j2) { return { status: r2.status, body: j2 }; }); })
          .then(function (persistResp) {
            if (!persistResp.body || !persistResp.body.ok) {
              _record({ phase: 'persist-error', lane: descriptor.lane, cik: descriptor.cik,
                        status: persistResp.status,
                        error: persistResp.body && persistResp.body.error });
              return { persistError: persistResp.body && persistResp.body.error, httpStatus: persistResp.status };
            }
            _record({ phase: 'persist-ok', lane: descriptor.lane, cik: descriptor.cik,
                      outputId: persistResp.body.outputId,
                      idempotent: persistResp.body.idempotent });
            var result = {
              outputId: persistResp.body.outputId,
              persistedSig: persistResp.body.persistedSig,
              persistedAt: persistResp.body.persistedAt,
              status: persistResp.body.status,
              idempotent: persistResp.body.idempotent,
              bannedHits: claudeResp.body.bannedHits || [],
              draftPreview: (draftBody || '').slice(0, 240)
            };
            if (typeof cfg.onResult === 'function') {
              try { cfg.onResult({
                lane: descriptor.lane,
                cik: descriptor.cik,
                outputId: result.outputId,
                draftBody: draftBody,
                structured: structured,
                ts: result.persistedAt
              }); } catch (_) {}
            }
            return result;
          });
        });
      })
      .catch(function (err) {
        _record({ phase: 'runner-error', lane: descriptor.lane, cik: descriptor.cik,
                  error: String(err && err.message || err) });
        return { error: String(err && err.message || err) };
      })
      .then(function (result) {
        _inFlight[k] = false;
        return result;
      });
    }

    runner._log = function () { return _log.slice(); };
    runner._reset = function () {
      _lastCallAt = {};
      _inFlight = {};
      _log = [];
    };
    runner._stats = function () {
      var inflight = 0;
      Object.keys(_inFlight).forEach(function (k) { if (_inFlight[k]) inflight++; });
      return {
        rateLimitMs: cfg.rateLimitMs,
        keysTracked: Object.keys(_lastCallAt).length,
        inFlight: inflight,
        logEntries: _log.length
      };
    };

    return runner;
  }

  root.LIMENEngineRunnerClaude = {
    create: create
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
