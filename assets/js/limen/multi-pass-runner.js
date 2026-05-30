/**
 * LIMEN Helix — Multi-Pass Artifact Runner
 *
 * Orchestrates N sequential Claude calls for the four lanes that exceed
 * the single-call 16K-token cap (patent / grant / sba / franchise).
 * Each call generates ONE section of the artifact, then the runner
 * stitches the section markdowns together and merges structured fields.
 *
 * Single-call lanes (investment / research) skip this runner entirely
 * — engine-runner-claude.js calls expand-artifact-claude.js directly.
 *
 * Total wall-clock time: 4-8 passes × 90-200s each = 6-20 minutes.
 * That's by design — real patent applications / NIH R01s / FDDs take
 * weeks to draft by hand; ~15 min for an AI first-draft is acceptable.
 *
 * Section catalog is sourced from
 *   GET /api/expand-artifact-claude  →  { lanes, sections }
 * so the client always uses the latest server-side definitions.
 *
 * Exposed via window.LIMENMultiPassRunner.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    endpoint: '/api/expand-artifact-claude',
    perPassTimeoutMs: 280000,
    onSectionDone: null   // callback({sectionIndex, sectionId, draftBytes})
  };

  // In-memory cache of section catalog (one fetch per page).
  var _laneCatalog = null;
  var _catalogPromise = null;

  function loadCatalog(endpoint) {
    if (_laneCatalog) return Promise.resolve(_laneCatalog);
    if (_catalogPromise) return _catalogPromise;
    _catalogPromise = fetch(endpoint, { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        _laneCatalog = (j && j.ok) ? { lanes: j.lanes || {}, sections: j.sections || {} } : null;
        return _laneCatalog;
      })
      .catch(function () { return null; });
    return _catalogPromise;
  }

  /**
   * @param {object} args
   *   lane              — patent | grant | sba | franchise | investment | research
   *   cik               — anchor CIK
   *   sourcePatternSig  — signature from upstream pattern envelope
   *   contextPacket     — same shape as expand-artifact-claude.js expects
   *   readiness         — 0..1 readiness score
   *   kernelSnapshot    — {thing2: {...}, ts}
   *   maxTokens         — per-section cap (default: section.targetTokens * 1.3 capped at 16K)
   * @returns Promise<{
   *   ok, lane, draftBody, structured: {sections[], openItems[], readyToSignChecklist[]},
   *   passes: [{sectionIndex, sectionId, tokens, elapsedMs, ok, draftBytes}],
   *   provenance: {model, contentHash, generatedAt, totalTokens, totalElapsedMs}
   * }>
   */
  function runMultiPass(args, options) {
    options = Object.assign({}, DEFAULTS, options || {});

    if (!args || !args.lane) return Promise.reject(new Error('lane required'));
    if (!args.contextPacket) return Promise.reject(new Error('contextPacket required'));
    if (!args.sourcePatternSig) return Promise.reject(new Error('sourcePatternSig required'));

    return loadCatalog(options.endpoint).then(function (catalog) {
      if (!catalog) throw new Error('failed to load lane catalog from ' + options.endpoint);

      var laneSections = catalog.sections[args.lane] || [];
      var laneSpec = catalog.lanes[args.lane] || {};

      if (laneSections.length === 0) {
        return Promise.reject(new Error('lane "' + args.lane + '" has no multi-pass sections defined'));
      }

      var t0 = Date.now();
      var aggregateDraftBody = '';
      var aggregateSections = [];
      var aggregateOpenItems = [];
      var aggregateChecklist = [];
      var aggregateCitations = [];
      var passResults = [];
      var totalTokens = 0;
      var lastModel = null;
      var firstAgency = null;
      var firstFormat = null;
      var firstTitle = null;

      // Sequentially generate each section. Chained Promise to keep
      // calls serial — parallel would burn rate limits and double the
      // input-prompt cache miss cost.
      var chain = Promise.resolve();
      laneSections.forEach(function (section, sectionIndex) {
        chain = chain.then(function () {
          var priorTitles = aggregateSections.map(function (s) { return s.heading || s.id || ''; });
          var passT0 = Date.now();

          var body = {
            lane: args.lane,
            cik: args.cik,
            sourcePatternSig: args.sourcePatternSig,
            readiness: args.readiness,
            kernelSnapshot: args.kernelSnapshot,
            contextPacket: args.contextPacket,
            maxTokens: Math.min(Math.round(section.targetTokens * 1.3), 16000),
            pass: {
              sectionIndex: sectionIndex,
              sectionId: section.id,
              sectionName: section.name,
              priorSectionTitles: priorTitles
            }
          };

          return fetch(options.endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
          .then(function (resp) {
            var elapsedMs = Date.now() - passT0;
            if (!resp.body || !resp.body.ok) {
              var failResult = {
                sectionIndex: sectionIndex,
                sectionId: section.id,
                ok: false,
                error: resp.body && resp.body.error || 'unknown',
                elapsedMs: elapsedMs,
                httpStatus: resp.status
              };
              passResults.push(failResult);
              // Pass failure DOES NOT abort the run — continue with other
              // sections, capture the failure in passResults, and the
              // operator can re-fire just this section later.
              aggregateDraftBody += '\n\n---\n\n## [SECTION ' + (sectionIndex + 1) + ' FAILED] ' + section.name + '\n\n' +
                '`[REGENERATE_NEEDED: pass ' + section.id + ' returned ' + (resp.body && resp.body.error || 'error') + ']`\n';
              aggregateSections.push({
                heading: section.name,
                id: section.id,
                completeness: 0,
                regenerateNeeded: true
              });
              return;
            }

            var cj = resp.body;
            var outer = cj.structured || {};
            var inner = outer.structured || outer;
            var draftBody = cj.draftBody || '';
            totalTokens += (cj.usage && cj.usage.output_tokens) || 0;
            lastModel = cj.model || lastModel;

            // Hold onto top-level metadata from first successful section
            if (!firstAgency && inner.agency_or_office) firstAgency = inner.agency_or_office;
            if (!firstFormat && inner.format_standard) firstFormat = inner.format_standard;
            if (!firstTitle && inner.title) firstTitle = inner.title;

            // Stitch this section's draftBody onto the aggregate
            if (aggregateDraftBody.length > 0) {
              aggregateDraftBody += '\n\n---\n\n';
            }
            aggregateDraftBody += draftBody;

            // Append section descriptor
            if (Array.isArray(inner.sections) && inner.sections.length > 0) {
              inner.sections.forEach(function (s) {
                aggregateSections.push(Object.assign({}, s, { passId: section.id }));
              });
            } else {
              aggregateSections.push({
                heading: section.name,
                id: section.id,
                summary: '',
                completeness: 0.9,
                passId: section.id
              });
            }

            // Merge openItems / checklist / citations (de-dup by description)
            (inner.openItems || []).forEach(function (oi) {
              aggregateOpenItems.push(Object.assign({}, oi, { passId: section.id }));
            });
            (inner.readyToSignChecklist || []).forEach(function (c) {
              aggregateChecklist.push(Object.assign({}, c, { passId: section.id }));
            });
            (inner.evidenceCitationsUsed || []).forEach(function (c) {
              aggregateCitations.push(c);
            });

            var result = {
              sectionIndex: sectionIndex,
              sectionId: section.id,
              ok: true,
              elapsedMs: elapsedMs,
              draftBytes: draftBody.length,
              tokens: (cj.usage && cj.usage.output_tokens) || 0,
              bannedHits: (cj.bannedHits || []).length
            };
            passResults.push(result);

            if (typeof options.onSectionDone === 'function') {
              try { options.onSectionDone(result); } catch (_) {}
            }
          })
          .catch(function (err) {
            passResults.push({
              sectionIndex: sectionIndex,
              sectionId: section.id,
              ok: false,
              error: String(err && err.message || err),
              elapsedMs: Date.now() - passT0
            });
          });
        });
      });

      return chain.then(function () {
        var totalElapsedMs = Date.now() - t0;

        // De-duplicate openItems by (kind + description) — sections may
        // surface the same placeholder (e.g., DATA_NEEDED: revenue)
        var seenOpen = {};
        var dedupOpen = [];
        aggregateOpenItems.forEach(function (oi) {
          var k = (oi.kind || '') + '::' + (oi.description || '');
          if (!seenOpen[k]) { seenOpen[k] = true; dedupOpen.push(oi); }
        });

        var anyFailed = passResults.some(function (p) { return !p.ok; });
        var allFailed = passResults.every(function (p) { return !p.ok; });

        return {
          ok: !allFailed,
          lane: args.lane,
          multiPass: true,
          passes: passResults,
          draftBody: aggregateDraftBody,
          structured: {
            title: firstTitle || (args.lane + ' draft'),
            lane: args.lane,
            agency_or_office: firstAgency,
            format_standard: firstFormat,
            sections: aggregateSections,
            openItems: dedupOpen,
            readyToSignChecklist: aggregateChecklist,
            readyToSign: !anyFailed,
            wordCount: Math.round(aggregateDraftBody.split(/\s+/).length),
            evidenceCitationsUsed: aggregateCitations
          },
          provenance: {
            model: lastModel,
            generatedAt: Date.now(),
            generatedAtISO: new Date().toISOString(),
            totalTokens: totalTokens,
            totalElapsedMs: totalElapsedMs,
            passCount: passResults.length,
            successfulPasses: passResults.filter(function (p) { return p.ok; }).length
          }
        };
      });
    });
  }

  // For preview / debug — query the section catalog without running
  function getLaneCatalog(endpoint) {
    return loadCatalog(endpoint || DEFAULTS.endpoint);
  }

  // Clear cache (test/dev only)
  function _reset() {
    _laneCatalog = null;
    _catalogPromise = null;
  }

  root.LIMENMultiPassRunner = {
    runMultiPass: runMultiPass,
    getLaneCatalog: getLaneCatalog,
    _reset: _reset
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
