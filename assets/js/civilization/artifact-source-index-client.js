/**
 * D3-G.1 — Artifact Source Index runtime client.
 *
 * Loads pre-built per-diagnosis source bundles produced by
 * scripts/build-artifact-deep-source-index.js and attaches their
 * lane-scoped detail to ArtifactPackets so the Main Brain finalizer
 * receives real deep source context instead of shallow top-level
 * packet summaries.
 *
 * STATUS: SCAFFOLD / READ-ONLY CLIENT.
 *   - Reads only static JSON under /assets/data/artifact-source-index/.
 *   - NO portal recursion. NO full-corpus scan. NO server write.
 *   - NO OpenAI / Grok call. NO submission/filing/trading/funding/
 *     approval/execution side effects. executionAllowed semantics on
 *     downstream packets are not changed by this client; the
 *     finalizer/factory continue to enforce them.
 *
 * Exposed:
 *   window.LIMENArtifactSourceIndex = {
 *     normalizeDiagnosisId(id),
 *     loadDiagnosisBundle(diagnosisId),  → Promise<{ok, bundle | code}>
 *     selectLaneSource(bundle, lane),    → lane block (or null)
 *     enrichPacket(packet),              → Promise<{ok, packet, deepSource | code}>
 *     stats(),                           → {hits, misses, errors, cached}
 *     SCHEMA_VERSION
 *   };
 *
 * Bundle path:
 *   /assets/data/artifact-source-index/by-diagnosis/<diagnosisId>.json
 *
 * Missing bundle policy:
 *   - { ok: false, code: 'BUNDLE_NOT_FOUND' } returned to caller.
 *   - Packet is left unchanged. Existing MB-D.1.3
 *     SOURCE_CONTEXT_SHALLOW path remains the backstop.
 */
(function () {
  'use strict';

  var SCHEMA_VERSION  = 'D3-G.deepSource.v1';
  var BUNDLE_BASE     = '/assets/data/artifact-source-index/by-diagnosis/';
  var LANES = ['patents', 'business-grants', 'research-grants', 'nsf-project-pitch', 'sba-loans', 'investments'];

  // ── Diagnosis canonicalization ────────────────────────────────────
  // Mirror of scripts/build-artifact-deep-source-index.js
  // canonicalizeDiagnosisLabel — kept byte-equivalent so a label
  // captured at index time and a label resolved at runtime always
  // reduce to the same upper-snake key.
  function normalizeDiagnosisId(label) {
    if (typeof label !== 'string') return null;
    var s = label.trim();
    if (!s) return null;
    s = s.replace(/[^A-Za-z0-9]+/g, '_');
    s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!s) return null;
    return s.toUpperCase();
  }

  // ── D3-G.5 — Audited diagnosis-alias map ──────────────────────────
  //
  // Some artifact-facing diagnosis labels (used by domain brains,
  // ArtifactPacket builders, or operator memory) are not the canonical
  // upper-snake IDs that the corpus emits. The portal corpus is the
  // authoritative source of canonical IDs; aliasing here is one-way
  // re-routing from the artifact-side label to the closest corpus-side
  // bundle.
  //
  // Aliasing is NOT semantic equivalence. It is source-routing only —
  // the operator must still verify that the resolved bundle's content
  // is appropriate for the artifact draft. Every alias use is recorded
  // in packet.deepSource.aliasUsed=true and packet.deepSource.warnings
  // includes 'ALIAS_RESOLUTION_USED' so downstream review can spot it.
  //
  // No fuzzy matching. Each entry is a manual, audited routing.
  // To add a new alias, only do so when (a) the source-side ID is in
  // active use upstream and (b) the target bundle materially carries
  // detail an operator would have wanted under the source-side label.
  // If in doubt, prefer BUNDLE_NOT_FOUND over an unsafe alias.
  //
  // Format: canonical-source → canonical-target (both already
  // uppercase-snake; alias keys are matched POST-normalization, so
  // 'Renewable Intermittency' / 'renewable_intermittency' /
  // 'RENEWABLE_INTERMITTENCY' all reach the same row).
  var DIAGNOSIS_ALIAS_MAP = {
    // Energy intermittency — the artifact side speaks of 'renewable
    // intermittency'; the corpus emits 'INTERMITTENCY_SPIKE' from the
    // energy domain root portal.
    'RENEWABLE_INTERMITTENCY': {
      target: 'INTERMITTENCY_SPIKE',
      reason: 'artifact-side label maps to corpus energy-domain INTERMITTENCY_SPIKE'
    },
    // Grid stability — artifact side speaks of 'grid collapse'; corpus
    // emits 'GRID_FREQUENCY_INSTABILITY' from the infrastructure root
    // portal. Note: this is a STABILITY/INSTABILITY mapping, not a
    // catastrophic-failure mapping; operator review should confirm
    // appropriateness.
    'GRID_COLLAPSE': {
      target: 'GRID_FREQUENCY_INSTABILITY',
      reason: 'artifact-side label maps to corpus infrastructure-domain GRID_FREQUENCY_INSTABILITY'
    }
  };

  function _resolveAlias(canonicalId) {
    if (!canonicalId) return null;
    var row = DIAGNOSIS_ALIAS_MAP[canonicalId];
    if (!row || !row.target) return null;
    var target = normalizeDiagnosisId(row.target);
    if (!target || target === canonicalId) return null; // no self-loop
    return { target: target, reason: row.reason || 'ALIAS_RESOLUTION_USED' };
  }

  // ── Cache ─────────────────────────────────────────────────────────
  var _cache  = Object.create(null);   // diagnosisId → bundle (or null on miss)
  var _stats  = { hits: 0, misses: 0, errors: 0, cached: 0 };

  // ── Bundle loader ─────────────────────────────────────────────────
  //
  // Lookup order (D3-G.5):
  //   1. Try the EXACT canonical ID first. If a bundle exists, return it
  //      with aliasUsed:false.
  //   2. If exact ID is missing AND the alias map has an entry for it,
  //      try the alias target. If the alias target bundle exists,
  //      return it with aliasUsed:true, requestedDiagnosisId,
  //      resolvedDiagnosisId, and aliasReason populated.
  //   3. If both miss, return BUNDLE_NOT_FOUND with tried[] listing
  //      every ID consulted (exact + alias target if probed).
  //
  // Aliasing is one-way only: a request for the alias TARGET (e.g.
  // INTERMITTENCY_SPIKE directly) skips the alias map entirely and
  // does the normal exact-ID lookup. Aliasing never overrides an
  // existing bundle for the source-side ID.
  function _doFetchBundle(canonicalId) {
    if (Object.prototype.hasOwnProperty.call(_cache, canonicalId)) {
      var cached = _cache[canonicalId];
      if (cached) { _stats.hits++; return Promise.resolve({ ok: true, bundle: cached, fromCache: true }); }
      _stats.misses++;
      return Promise.resolve({ ok: false, code: 'BUNDLE_NOT_FOUND' });
    }
    if (typeof fetch !== 'function') {
      _stats.errors++;
      return Promise.resolve({ ok: false, code: 'FETCH_UNAVAILABLE' });
    }
    var url = BUNDLE_BASE + encodeURIComponent(canonicalId) + '.json';
    return fetch(url, { credentials: 'omit' }).then(function (resp) {
      if (resp.status === 404) {
        _cache[canonicalId] = null;
        _stats.misses++;
        return { ok: false, code: 'BUNDLE_NOT_FOUND' };
      }
      if (!resp.ok) {
        _stats.errors++;
        return { ok: false, code: 'BUNDLE_FETCH_ERROR', status: resp.status };
      }
      return resp.json().then(function (body) {
        if (!body || typeof body !== 'object') {
          _stats.errors++;
          return { ok: false, code: 'BUNDLE_PARSE_ERROR' };
        }
        _cache[canonicalId] = body;
        _stats.cached++;
        _stats.hits++;
        return { ok: true, bundle: body, fromCache: false };
      }, function () {
        _stats.errors++;
        return { ok: false, code: 'BUNDLE_PARSE_ERROR' };
      });
    }, function (err) {
      _stats.errors++;
      return { ok: false, code: 'BUNDLE_NETWORK_ERROR', message: (err && err.message) || '' };
    });
  }

  function loadDiagnosisBundle(rawId) {
    var id = normalizeDiagnosisId(rawId);
    if (!id) {
      return Promise.resolve({ ok: false, code: 'INVALID_DIAGNOSIS_ID' });
    }
    var triedIds = [id];
    return _doFetchBundle(id).then(function (r) {
      if (r.ok) {
        return {
          ok:                    true,
          bundle:                r.bundle,
          fromCache:             !!r.fromCache,
          requestedDiagnosisId:  id,
          resolvedDiagnosisId:   id,
          aliasUsed:             false,
          tried:                 triedIds.slice()
        };
      }
      // Exact miss. Try alias if one is registered.
      var alias = _resolveAlias(id);
      if (!alias) {
        return { ok: false, code: r.code || 'BUNDLE_NOT_FOUND', tried: triedIds.slice() };
      }
      triedIds.push(alias.target);
      return _doFetchBundle(alias.target).then(function (r2) {
        if (r2.ok) {
          return {
            ok:                    true,
            bundle:                r2.bundle,
            fromCache:             !!r2.fromCache,
            requestedDiagnosisId:  id,
            resolvedDiagnosisId:   alias.target,
            aliasUsed:             true,
            aliasReason:           alias.reason,
            tried:                 triedIds.slice()
          };
        }
        return {
          ok:                    false,
          code:                   r2.code || 'BUNDLE_NOT_FOUND',
          tried:                  triedIds.slice(),
          requestedDiagnosisId:   id,
          aliasTargetTried:       alias.target,
          aliasReason:            alias.reason
        };
      });
    });
  }

  // ── Lane projection ───────────────────────────────────────────────
  // D3-G.2 Option B compression: bundles may reference a shared block
  // via L._sharedRef = 'grants' instead of duplicating treatments /
  // implementationSteps / evidenceAnchors across the 4 grant/SBA
  // lanes. selectLaneSource reconstructs the full lane shape so
  // existing consumers see the SAME 9 array fields they always saw,
  // sourced from byLaneShared.<ref> when _sharedRef is set.
  function selectLaneSource(bundle, lane) {
    if (!bundle || typeof bundle !== 'object') return null;
    if (!bundle.byLane || typeof bundle.byLane !== 'object') return null;
    if (LANES.indexOf(lane) === -1) return null;
    var L = bundle.byLane[lane];
    if (!L || typeof L !== 'object') return null;

    // Pre-compression bundles or non-shared lanes: return as-is.
    if (!L._sharedRef) return L;

    var sharedKey = L._sharedRef;
    var shared = (bundle.byLaneShared && typeof bundle.byLaneShared === 'object')
      ? bundle.byLaneShared[sharedKey] : null;

    // Graceful fallback if the shared block is somehow missing:
    // return the lane object without the shared arrays (still valid
    // structurally — every consumer null-checks .length anyway).
    if (!shared || typeof shared !== 'object') return L;

    return {
      // Lane-specific (always from L)
      topSources:           Array.isArray(L.topSources)    ? L.topSources    : [],
      // Shared (from byLaneShared.<ref>)
      treatments:           Array.isArray(shared.treatments)          ? shared.treatments          : [],
      implementationSteps:  Array.isArray(shared.implementationSteps) ? shared.implementationSteps : [],
      evidenceAnchors:      Array.isArray(shared.evidenceAnchors)     ? shared.evidenceAnchors     : [],
      // Patents-only fields — empty for grant lanes, but the array
      // is materialized so consumers never NPE on .length.
      mechanismCandidates:  Array.isArray(L.mechanismCandidates)  ? L.mechanismCandidates  : [],
      methodCandidates:     Array.isArray(L.methodCandidates)     ? L.methodCandidates     : [],
      embodimentCandidates: Array.isArray(L.embodimentCandidates) ? L.embodimentCandidates : [],
      figurePlaceholders:   Array.isArray(L.figurePlaceholders)   ? L.figurePlaceholders   : [],
      // sourcePortals — prefer lane-specific; fall back to shared.
      sourcePortals:        Array.isArray(L.sourcePortals) && L.sourcePortals.length
                              ? L.sourcePortals
                              : (Array.isArray(shared.sourcePortals) ? shared.sourcePortals : []),
      // Marker preserved for debugging/diagnostics; downstream code
      // typically ignores it.
      _sharedRef:           sharedKey
    };
  }

  // ── Enrichment ────────────────────────────────────────────────────
  // Attaches packet.deepSource for the packet's first-resolvable
  // diagnosis. Mirrors a subset of fields into raw.handoffPacket so
  // MB-D.1.3 finalizer's _buildSourceContext picks them up without
  // any endpoint change.
  //
  // Idempotent: if packet.deepSource already exists, dedupes against
  // existing arrays and refreshes loadedAt only.
  // Read-only on the input packet's other fields.
  function enrichPacket(packet) {
    if (!packet || typeof packet !== 'object' || !packet.identity) {
      return Promise.resolve({ ok: false, code: 'INVALID_PACKET' });
    }
    var lane = packet.identity.lane;
    var diagnoses = Array.isArray(packet.identity.diagnoses) ? packet.identity.diagnoses : [];
    if (!diagnoses.length) {
      return Promise.resolve({ ok: false, code: 'NO_DIAGNOSES' });
    }

    // Iterate diagnoses in order; first hit wins. D3-G.5 alias map
    // is consulted inside loadDiagnosisBundle; if that fires, the
    // resolved info propagates here through r.aliasUsed /
    // requestedDiagnosisId / resolvedDiagnosisId / aliasReason.
    var i = 0;
    var allTried = [];
    function tryNext() {
      if (i >= diagnoses.length) {
        return Promise.resolve({ ok: false, code: 'BUNDLE_NOT_FOUND', tried: allTried.slice() });
      }
      var raw = diagnoses[i++];
      return loadDiagnosisBundle(raw).then(function (r) {
        // Accumulate every ID consulted (exact + alias target if probed)
        // so the caller can report what was actually tried.
        if (Array.isArray(r.tried)) {
          for (var k = 0; k < r.tried.length; k++) {
            if (allTried.indexOf(r.tried[k]) === -1) allTried.push(r.tried[k]);
          }
        }
        if (!r.ok) return tryNext();
        var laneBlock = selectLaneSource(r.bundle, lane);
        if (!laneBlock) return tryNext();
        var aliasInfo = r.aliasUsed
          ? { aliasUsed: true, requestedDiagnosisId: r.requestedDiagnosisId,
              resolvedDiagnosisId: r.resolvedDiagnosisId, aliasReason: r.aliasReason || null }
          : { aliasUsed: false, requestedDiagnosisId: r.requestedDiagnosisId || null,
              resolvedDiagnosisId: r.resolvedDiagnosisId || null };
        _attachDeepSource(packet, r.bundle, laneBlock, lane, raw, aliasInfo);
        return { ok: true, packet: packet, deepSource: packet.deepSource,
                 aliasUsed: aliasInfo.aliasUsed,
                 requestedDiagnosisId: aliasInfo.requestedDiagnosisId,
                 resolvedDiagnosisId:  aliasInfo.resolvedDiagnosisId,
                 tried: allTried.slice() };
      });
    }
    return tryNext();
  }

  function _attachDeepSource(packet, bundle, laneBlock, lane, rawDiagId, aliasInfo) {
    // D3-G.5 — aliasInfo carries the alias-resolution outcome from
    // loadDiagnosisBundle. When aliasInfo.aliasUsed===true, the
    // packet.deepSource records BOTH the operator-side ID
    // (requestedDiagnosisId, what the packet actually carried) AND
    // the corpus-side ID the bundle was loaded from
    // (resolvedDiagnosisId / diagnosisId). The warnings array gains
    // 'ALIAS_RESOLUTION_USED' so downstream review surfaces it.
    var requestedId = (aliasInfo && aliasInfo.requestedDiagnosisId) || normalizeDiagnosisId(rawDiagId);
    var resolvedId  = (aliasInfo && aliasInfo.resolvedDiagnosisId)  || requestedId;
    var aliasUsed   = !!(aliasInfo && aliasInfo.aliasUsed);
    var aliasReason = (aliasInfo && aliasInfo.aliasReason) || null;
    var canonical   = resolvedId; // legacy alias used elsewhere in this fn
    var nowIso = new Date().toISOString();

    var portal = {
      maxDepth:      bundle.maxDepth || 0,
      portalCount:   bundle.portalCount || 0,
      sourcePortals: Array.isArray(bundle.sourcePortals) ? bundle.sourcePortals.slice(0, 32) : []
    };

    var counts = {
      treatmentCount:           Array.isArray(laneBlock.treatments)           ? laneBlock.treatments.length           : 0,
      implementationStepCount:  Array.isArray(laneBlock.implementationSteps)  ? laneBlock.implementationSteps.length  : 0,
      evidenceAnchorCount:      Array.isArray(laneBlock.evidenceAnchors)      ? laneBlock.evidenceAnchors.length      : 0,
      mechanismCandidateCount:  Array.isArray(laneBlock.mechanismCandidates)  ? laneBlock.mechanismCandidates.length  : 0,
      methodCandidateCount:     Array.isArray(laneBlock.methodCandidates)     ? laneBlock.methodCandidates.length     : 0,
      embodimentCandidateCount: Array.isArray(laneBlock.embodimentCandidates) ? laneBlock.embodimentCandidates.length : 0,
      figurePlaceholderCount:   Array.isArray(laneBlock.figurePlaceholders)   ? laneBlock.figurePlaceholders.length   : 0,
      maxDepth:                 portal.maxDepth
    };

    // Heuristic depth tier — purely informational. Used by the
    // finalizer's downstream sourceContextShallow probe; not a gate.
    var sourceDepthStatus =
      (counts.treatmentCount + counts.implementationStepCount + counts.mechanismCandidateCount) >= 8 ? 'sufficient'
      : (counts.treatmentCount + counts.implementationStepCount) >= 2                                ? 'partial'
      :                                                                                                'shallow';

    var bundleWarnings = Array.isArray(bundle.warnings) ? bundle.warnings.slice(0, 32) : [];
    if (aliasUsed) {
      bundleWarnings.push('ALIAS_RESOLUTION_USED: requested ' + requestedId +
        ' resolved to ' + resolvedId +
        (aliasReason ? ' (' + aliasReason + ')' : ''));
    }

    var deepSource = {
      schemaVersion:        SCHEMA_VERSION,
      diagnosisId:          canonical,
      // D3-G.5 — alias provenance fields
      requestedDiagnosisId: requestedId,
      resolvedDiagnosisId:  resolvedId,
      aliasUsed:            aliasUsed,
      aliasReason:          aliasReason,
      rawDiagnosisLabels:   Array.isArray(bundle.rawDiagnosisLabels) ? bundle.rawDiagnosisLabels.slice(0, 16) : [rawDiagId],
      lane:                 lane,
      loadedAt:             nowIso,
      sourceBundlePath:     BUNDLE_BASE + canonical + '.json',
      sourceDepthStatus:    sourceDepthStatus,
      portal:               portal,
      treatments:           Array.isArray(laneBlock.treatments)           ? laneBlock.treatments.slice(0, 100)           : [],
      implementationSteps:  Array.isArray(laneBlock.implementationSteps)  ? laneBlock.implementationSteps.slice(0, 200)  : [],
      mechanismCandidates:  Array.isArray(laneBlock.mechanismCandidates)  ? laneBlock.mechanismCandidates.slice(0, 100)  : [],
      methodCandidates:     Array.isArray(laneBlock.methodCandidates)     ? laneBlock.methodCandidates.slice(0, 100)     : [],
      claimTypeCandidates:  Array.isArray(laneBlock.claimTypeCandidates)  ? laneBlock.claimTypeCandidates.slice(0, 100)  : [],
      embodimentCandidates: Array.isArray(laneBlock.embodimentCandidates) ? laneBlock.embodimentCandidates.slice(0, 100) : [],
      figurePlaceholders:   Array.isArray(laneBlock.figurePlaceholders)   ? laneBlock.figurePlaceholders.slice(0, 100)   : [],
      evidenceAnchors:      Array.isArray(laneBlock.evidenceAnchors)      ? laneBlock.evidenceAnchors.slice(0, 100)      : [],
      provenance: {
        sourceFeeds:   Array.isArray(laneBlock.sourcePortals) ? laneBlock.sourcePortals.slice(0, 32) : [],
        citationHints: Array.isArray(laneBlock.citationHints) ? laneBlock.citationHints.slice(0, 32) : []
      },
      sourceDepth:          counts,
      warnings:             bundleWarnings
    };

    packet.deepSource = deepSource;

    // Mirror into raw.handoffPacket so MB-D.1.3 finalizer's existing
    // _buildSourceContext picks these up without endpoint change.
    // Merge — never overwrite richer existing fields.
    if (!packet.raw || typeof packet.raw !== 'object') packet.raw = {};
    if (!packet.raw.handoffPacket || typeof packet.raw.handoffPacket !== 'object') packet.raw.handoffPacket = {};
    var hp = packet.raw.handoffPacket;

    function _mergeUnique(arr, addArr, keyFn) {
      if (!Array.isArray(addArr) || !addArr.length) return arr || [];
      var out = Array.isArray(arr) ? arr.slice() : [];
      var seen = Object.create(null);
      for (var i = 0; i < out.length; i++) {
        var k = keyFn(out[i]);
        if (k != null) seen[k] = true;
      }
      for (var j = 0; j < addArr.length; j++) {
        var k2 = keyFn(addArr[j]);
        if (k2 == null) continue;
        if (seen[k2]) continue;
        seen[k2] = true;
        out.push(addArr[j]);
      }
      return out;
    }
    var labelKey = function (x) { return x && (x.label || x.id || x.caption || x.step || null); };

    hp.treatments           = _mergeUnique(hp.treatments,           deepSource.treatments,           labelKey);
    hp.mechanism_candidates = _mergeUnique(hp.mechanism_candidates, deepSource.mechanismCandidates,  labelKey);
    hp.claim_type_candidates= _mergeUnique(hp.claim_type_candidates, deepSource.claimTypeCandidates, labelKey);
    hp.embodiments_outline  = _mergeUnique(hp.embodiments_outline,  deepSource.embodimentCandidates, labelKey);
    hp.figure_placeholders  = _mergeUnique(hp.figure_placeholders,  deepSource.figurePlaceholders,   labelKey);

    if (!hp.portalDomain && portal.sourcePortals.length && portal.sourcePortals[0].domain) {
      hp.portalDomain = portal.sourcePortals[0].domain;
    }
    if (!hp.portalTitle && portal.sourcePortals.length && portal.sourcePortals[0].title) {
      hp.portalTitle = portal.sourcePortals[0].title;
    }
    if (typeof hp.depth !== 'number' || hp.depth < portal.maxDepth) {
      hp.depth = portal.maxDepth;
    }
    if (!Array.isArray(hp.ancestryPath) || !hp.ancestryPath.length) {
      hp.ancestryPath = portal.sourcePortals.length && Array.isArray(portal.sourcePortals[0].ancestry)
        ? portal.sourcePortals[0].ancestry.slice() : [];
    }
  }

  function stats() {
    return { hits: _stats.hits, misses: _stats.misses, errors: _stats.errors, cached: _stats.cached };
  }

  // ── Public attachment ─────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    try {
      window.LIMENArtifactSourceIndex = {
        SCHEMA_VERSION:         SCHEMA_VERSION,
        normalizeDiagnosisId:   normalizeDiagnosisId,
        loadDiagnosisBundle:    loadDiagnosisBundle,
        selectLaneSource:       selectLaneSource,
        enrichPacket:           enrichPacket,
        stats:                  stats,
        // D3-G.5 — read-only alias map for diagnostics / debugging.
        // Returns a snapshot so callers cannot mutate the live table.
        aliases:                function () {
          var out = {};
          var keys = Object.keys(DIAGNOSIS_ALIAS_MAP);
          for (var k = 0; k < keys.length; k++) {
            out[keys[k]] = {
              target: DIAGNOSIS_ALIAS_MAP[keys[k]].target,
              reason: DIAGNOSIS_ALIAS_MAP[keys[k]].reason
            };
          }
          return out;
        }
      };
      try { console.info('[D3-G.1] LIMENArtifactSourceIndex attached (' + SCHEMA_VERSION + ')'); } catch (_) {}
    } catch (e) {
      try { console.error('[D3-G.1] LIMENArtifactSourceIndex attach FAILED:', e); } catch (_) {}
    }
  }

  // CommonJS export for Node-side tests.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SCHEMA_VERSION:         SCHEMA_VERSION,
      normalizeDiagnosisId:   normalizeDiagnosisId,
      loadDiagnosisBundle:    loadDiagnosisBundle,
      selectLaneSource:       selectLaneSource,
      enrichPacket:           enrichPacket,
      _attachDeepSource:      _attachDeepSource,
      stats:                  stats
    };
  }
})();
