/**
 * LIMEN Helix — Engine Context Builder
 *
 * Assembles the contextPacket sent to /api/expand-artifact-claude.
 * Pulls from the live in-page state populated by the upstream civilization
 * stack:
 *   - window.LIMENDomains           (domain brain output)
 *   - window.LIMENCivilizationPackets
 *   - window.LIMENMainBrainHandoffState
 *   - window.LIMENCrossNodeOpportunityState
 *
 * And lazy-fetches from substrate:
 *   - /assets/data/deep/{domain}-deep-directives.json (real Grade-A citations)
 *   - /api/fetch-portal?id={slug}                     (company portal)
 *
 * Output contextPacket shape (the only thing Claude sees as fact):
 * {
 *   subject: {
 *     cik, slug, entityName,
 *     industry: { naics, label, descriptor },
 *     proposedScope: { title, description, problemStatement, proposedApproach },
 *     personnel: [],         // [DATA_NEEDED] unless caller supplies
 *     drawings: [],          // [DATA_NEEDED] unless caller supplies
 *     executionMode: 'PAPER' // investment lane default
 *   },
 *   evidence: {
 *     citations: [           // ONLY real DOIs / sources from substrate
 *       { author, year, title, journal, volume, pages, doi, source, sourceType }
 *     ],
 *     news: [],              // real newsfeed entries when wired
 *     priorArt: [],          // from related directives
 *     financial: {           // from company portal financialHealth + EDGAR
 *       latestQuarter, revenueLast4Q, ocfLast4Q, cashOnHand, totalDebt
 *     }
 *   }
 * }
 *
 * IMPORTANT: This module strips ALL LIMEN-internal vocabulary before
 * shipping the packet to Claude. The contextPacket reads as if written
 * by an industry analyst, not by an internal system.
 *
 * Exposed via window.LIMENEngineContextBuilder.
 */
(function (root) {
  'use strict';

  // Industry-language translation table. Maps LIMEN-internal keywords to
  // plain industry vocabulary. Applied to any string passed to the packet.
  var VOCAB_MAP = [
    // Strip all internal product names
    [/\blimen\s*helix\b/gi, ''],
    [/\blimenhelix\b/gi, ''],
    [/\blimen\b/gi, ''],
    [/\bhelix\b/gi, ''],
    // Strip kernel / phase / polyvagal jargon
    [/\bpolyvagal[- ]?(coupling|coupled|context|cast)?\b/gi, 'coupled-context'],
    [/\bthing\s*1\b/gi, 'validated distress scorer'],
    [/\bthing\s*2\b/gi, 'phase tracker'],
    [/\bkernel\b/gi, 'analytic model'],
    [/\bdominant\s+phase\b/gi, 'current condition stage'],
    [/\bphase\s+vector\b/gi, 'condition state'],
    [/\bphase\s+confidence\b/gi, 'condition confidence'],
    [/\bphase\s+tracking\b/gi, 'condition tracking'],
    [/\bphase\s+logic\b/gi, 'condition logic'],
    // Strip system-architecture jargon
    [/\bcivilization\s+(brain|super[- ]?brain|aggregator|packet)\b/gi, 'sector aggregator'],
    [/\bconnectome\s+(brain|super[- ]?brain|substrate)\b/gi, 'node graph'],
    [/\bmaster\s+(brain|living\s+brain)\b/gi, 'executive layer'],
    [/\bsuper[- ]?brain\b/gi, 'aggregator'],
    [/\bdomain\s+brain\b/gi, 'sector signal'],
    [/\bsub[- ]?brain\b/gi, 'sub-signal'],
    [/\bfractal\s+(brain|recursive|grid|directional)\b/gi, 'multi-scale'],
    [/\bpattern\s+(envelope|broker|signature|emission)\b/gi, 'signal'],
    [/\bcross[- ]?domain\s+(audit|opportunity)\b/gi, 'cross-sector finding'],
    [/\bhandoff\s+packet\b/gi, 'workflow item'],
    [/\bsalience\s+score\b/gi, 'priority weight'],
    [/\bopportunity\s+signal\b/gi, 'opportunity'],
    [/\bcommercialization\s+status\b/gi, 'commercialization record'],
    // Stress → industry-appropriate
    [/\bstress\s+(score|level|index|signal|state|threshold)\b/gi, 'operational pressure index'],
    [/\bstress\b/gi, 'operational pressure'],
    // Generic clean-ups
    [/\bsalience\b/gi, 'priority'],
    [/\bdomain\b(?!\s+name|\s+expert|\s+specific)/gi, 'sector']
  ];

  function translate(s) {
    if (typeof s !== 'string') return s;
    var out = s;
    for (var i = 0; i < VOCAB_MAP.length; i++) {
      out = out.replace(VOCAB_MAP[i][0], VOCAB_MAP[i][1]);
    }
    // Collapse double spaces created by deletions
    return out.replace(/\s{2,}/g, ' ').trim();
  }

  function translateDeep(o) {
    if (o == null) return o;
    if (typeof o === 'string') return translate(o);
    if (Array.isArray(o)) return o.map(translateDeep);
    if (typeof o === 'object') {
      var out = {};
      Object.keys(o).forEach(function (k) {
        // Don't translate keys, just values
        out[k] = translateDeep(o[k]);
      });
      return out;
    }
    return o;
  }

  // ── Citation extraction ─────────────────────────────────────────
  // Treatment objects in subdomain portals and deep directives carry a
  // citation[] array of {author, year, title, journal, volume, pages, doi}.
  function extractCitationsFromTreatments(treatments) {
    var out = [];
    if (!Array.isArray(treatments)) return out;
    treatments.forEach(function (tr) {
      var cites = tr && tr.citation;
      if (Array.isArray(cites)) {
        cites.forEach(function (c) {
          if (c && (c.author || c.title)) {
            out.push({
              author: c.author || '',
              year: c.year || '',
              title: c.title || '',
              journal: c.journal || '',
              volume: c.volume || '',
              pages: c.pages || '',
              doi: c.doi || '',
              source: c.author && c.year ? (c.author + ' (' + c.year + ')') : (c.title || ''),
              sourceType: c.doi ? 'peer-reviewed' : 'institutional'
            });
          }
        });
      }
      // Fall back to the raw `cite` string if no structured citation
      if ((!cites || !cites.length) && tr && tr.cite) {
        out.push({
          author: '', year: '', title: '', journal: '',
          volume: '', pages: '', doi: '',
          source: tr.cite,
          sourceType: 'unparsed'
        });
      }
    });
    return out;
  }

  // ── Newsfeed extraction (from company portal newsFeed[] when wired) ──
  function extractNewsFromPortal(portal) {
    var out = [];
    if (!portal || !Array.isArray(portal.newsFeed)) return out;
    portal.newsFeed.forEach(function (n) {
      if (!n || !n.url) return;
      out.push({
        date: n.date || n.publishedAt || '',
        source: n.source || n.publisher || '',
        url: n.url,
        headline: n.headline || n.title || '',
        summary: n.summary || ''
      });
    });
    return out;
  }

  // ── Domain inference from CIK or descriptor ──────────────────────
  function inferDomainForCik(cik) {
    if (!cik) return null;
    // Walk known LIMENDomains for a match in their company portfolios
    var domains = root.LIMENDomains || {};
    var match = null;
    Object.keys(domains).forEach(function (d) {
      var entry = domains[d];
      var companies = (entry && (entry.brainCompanies || entry.companies)) || [];
      for (var i = 0; i < companies.length; i++) {
        var c = companies[i];
        if (c && (c.cik === cik || c.ticker === cik)) { match = d; break; }
      }
    });
    return match;
  }

  // ── Top directives for (domain, lane) ────────────────────────────
  var _directiveCache = {};
  function loadDirectives(domain) {
    if (!domain) return Promise.resolve([]);
    if (_directiveCache[domain]) return Promise.resolve(_directiveCache[domain]);
    var url = '/assets/data/deep/' + encodeURIComponent(domain) + '-deep-directives.json';
    return fetch(url, { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) {
        var arr = (j && Array.isArray(j.directives)) ? j.directives : [];
        _directiveCache[domain] = arr;
        return arr;
      })
      .catch(function () { return []; });
  }

  // ── Company portal fetch ─────────────────────────────────────────
  var _portalCache = {};
  function loadPortal(slug) {
    if (!slug) return Promise.resolve(null);
    if (_portalCache[slug]) return Promise.resolve(_portalCache[slug]);
    return fetch('/assets/data/companies/' + encodeURIComponent(slug) + '.json', { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) return null; return r.json(); })
      .then(function (p) { _portalCache[slug] = p; return p; })
      .catch(function () { return null; });
  }

  // ── Subject framing per lane ─────────────────────────────────────
  function buildSubject(lane, cik, slug, portal, domain, topDirective) {
    var subject = {
      cik: cik || null,
      slug: slug || null,
      entityName: (portal && portal.name) || (portal && portal.companyName) || null,
      industry: {
        naics: (portal && portal.naics) || null,
        label: (portal && portal.industryLabel) || domain || null,
        descriptor: translate((portal && portal.descriptor) || '') || null
      },
      proposedScope: {
        title: null,
        description: null,
        problemStatement: null,
        proposedApproach: null
      },
      personnel: [],
      drawings: [],
      executionMode: lane === 'investment' ? 'PAPER' : null
    };

    if (topDirective) {
      var translated = translateDeep({
        title: topDirective.treatmentLabel || '',
        description: topDirective.treatmentDescription || '',
        problemStatement: topDirective.treatmentTarget || topDirective.nodeFunction || '',
        proposedApproach: Array.isArray(topDirective.treatmentSteps) ?
          topDirective.treatmentSteps.join(' ') : (topDirective.treatmentLabel || '')
      });
      subject.proposedScope = translated;
    }

    // Per-lane financial block for SBA / investment
    if ((lane === 'sba' || lane === 'investment') && portal && portal.financialHealth) {
      subject.financialHealth = {
        latestQuarter: portal.financialHealth.latestQuarter || null,
        revenueLastQ: portal.financialHealth.revenueLastQ || null,
        ocfLastQ: portal.financialHealth.ocfLastQ || null,
        cashOnHand: portal.financialHealth.cashOnHand || null,
        totalDebt: portal.financialHealth.totalDebt || null,
        compositeScore: portal.financialHealth.compositeScore || null,
        history: portal.financialHealth.historyQuarters || null
      };
    }

    return subject;
  }

  // ── Public: build context packet ─────────────────────────────────
  function build(opts) {
    opts = opts || {};
    var cik = opts.cik || null;
    var lane = opts.lane || 'patent';
    var slug = opts.slug || null;

    return loadPortal(slug).then(function (portal) {
      var domain = opts.domain || (portal && (portal.domainId || portal.domain)) || inferDomainForCik(cik);
      return loadDirectives(domain).then(function (directives) {
        var topN = directives.slice(0, 5);

        // Citations: pool from top-5 directives' citation arrays
        var citations = [];
        topN.forEach(function (d) {
          var c = extractCitationsFromTreatments([{ citation: d.treatmentCitation || d.citation }]);
          citations = citations.concat(c);
        });
        // De-dupe by DOI when present, else by source string
        var seen = {};
        var unique = [];
        citations.forEach(function (c) {
          var key = c.doi || c.source || JSON.stringify(c);
          if (!seen[key]) { seen[key] = true; unique.push(c); }
        });

        var news = extractNewsFromPortal(portal);

        // Prior art for patent lane: pull related directives' titles + cites
        var priorArt = [];
        if (lane === 'patent') {
          directives.slice(0, 20).forEach(function (d) {
            if (!d) return;
            priorArt.push({
              title: translate(d.treatmentLabel || ''),
              field: translate(d.nodeFunction || ''),
              source: d.treatmentCite || ''
            });
          });
        }

        // Financial — only for SBA / investment
        var financial = {};
        if ((lane === 'sba' || lane === 'investment') && portal && portal.financialHealth) {
          financial = {
            latestQuarter: portal.financialHealth.latestQuarter || null,
            revenueLastQ: portal.financialHealth.revenueLastQ || null,
            ocfLastQ: portal.financialHealth.ocfLastQ || null,
            cashOnHand: portal.financialHealth.cashOnHand || null,
            totalDebt: portal.financialHealth.totalDebt || null,
            historyQuarters: portal.financialHealth.historyQuarters || null
          };
        }

        var subject = buildSubject(lane, cik, slug, portal, domain, topN[0] || null);
        // Caller overrides win
        if (opts.subjectOverride) {
          Object.keys(opts.subjectOverride).forEach(function (k) {
            subject[k] = opts.subjectOverride[k];
          });
        }

        return {
          subject: subject,
          evidence: {
            citations: unique,
            news: news,
            priorArt: priorArt,
            financial: financial
          },
          _meta: {
            builtAt: Date.now(),
            domain: domain,
            directiveCount: directives.length,
            topDirectiveLabel: topN[0] ? topN[0].treatmentLabel : null
          }
        };
      });
    });
  }

  root.LIMENEngineContextBuilder = {
    build: build,
    translate: translate,
    translateDeep: translateDeep,
    // Exposed for inspection / debugging
    _vocabMap: VOCAB_MAP
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
