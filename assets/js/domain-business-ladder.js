/*
 * Domain business-capital ladder for the twenty public fronts.
 *
 * This surface is intentionally separate from the live P0-P10 domain phase.
 * It renders candidate ventures by capital band; it never changes cognition,
 * opens a valve, calls a provider, spends, or claims that a designed venture is
 * operating. Source: assets/data/domain-business-ladders.json.
 */
(function () {
  'use strict';

  var DATA_URL = '/assets/data/domain-business-ladders.json';
  var REGULATION_URL = '/assets/data/domain-business-regulation.json';
  var STATUS = {
    LIVE_SURFACE: 'live surface',
    OFFER_DEFINED: 'offer defined',
    SOURCE_IMPLEMENTED_HELD: 'implemented · held',
    BOUNDED_RUNTIME: 'bounded runtime',
    DESIGNED_UNMEASURED: 'designed · unmeasured',
    LICENSE_GATED: 'license / capital gated'
  };

  function domainFromUrl() {
    var query = new URLSearchParams(window.location.search).get('domain');
    if (query) return query.toLowerCase();
    return window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].replace(/\.html$/i, '').toLowerCase();
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function addStyle() {
    if (document.getElementById('domainBusinessLadderStyle')) return;
    var style = element('style');
    style.id = 'domainBusinessLadderStyle';
    style.textContent = [
      '.dbl-wrap{max-width:1120px;margin:0 auto;padding:42px 22px}',
      '.dbl-shell{border:1px solid rgba(139,154,168,.28);border-radius:16px;padding:24px;background:rgba(11,18,27,.78);color:#eaf1f7}',
      '.dbl-kicker{font:700 11px/1.4 Inter,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#35e0c4}',
      '.dbl-title{margin:7px 0 8px;font:600 clamp(24px,3vw,34px)/1.15 Newsreader,Georgia,serif;color:#f1f5f8}',
      '.dbl-intro{max-width:78ch;margin:0;color:#aebbc5;font:400 14px/1.65 Inter,system-ui,sans-serif}',
      '.dbl-warning{margin:14px 0 0;padding:10px 12px;border-left:3px solid #d9b74a;background:rgba(217,183,74,.08);color:#d9cfad;font:500 12px/1.55 Inter,system-ui,sans-serif}',
      '.dbl-directory{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 0}',
      '.dbl-directory a{display:inline-block;padding:7px 10px;border:1px solid rgba(53,224,196,.35);border-radius:999px;color:#9debdc;background:rgba(53,224,196,.06);font:700 10px/1.25 Inter,system-ui,sans-serif;letter-spacing:.06em;text-decoration:none}',
      '.dbl-directory a:hover,.dbl-directory a:focus-visible{border-color:#35e0c4;color:#fff;outline:2px solid rgba(53,224,196,.25);outline-offset:2px}',
      '.dbl-regulation{margin:16px 0 0;border:1px solid rgba(139,154,168,.22);border-radius:12px;background:rgba(5,12,20,.48)}',
      '.dbl-regulation summary{cursor:pointer;padding:13px 14px;color:#dfe8ee;font:700 12px/1.4 Inter,system-ui,sans-serif}',
      '.dbl-regulation summary:focus-visible{outline:2px solid #35e0c4;outline-offset:2px}',
      '.dbl-reg-body{padding:0 14px 14px}',
      '.dbl-reg-note{margin:0 0 12px;color:#aebbc5;font:400 11px/1.55 Inter,system-ui,sans-serif}',
      '.dbl-stress{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}',
      '.dbl-stress span{padding:4px 7px;border:1px solid rgba(139,154,168,.22);border-radius:999px;color:#aebbc5;font:600 9px/1.2 Inter,system-ui,sans-serif}',
      '.dbl-phase-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}',
      '.dbl-phase-rule{padding:9px;border-left:2px solid rgba(53,224,196,.38);background:rgba(17,26,37,.65)}',
      '.dbl-phase-rule b{display:block;color:#9debdc;font:700 10px/1.3 "IBM Plex Mono",monospace}',
      '.dbl-phase-rule span{display:block;margin-top:4px;color:#9caab5;font:400 10px/1.45 Inter,system-ui,sans-serif}',
      '.dbl-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:20px}',
      '.dbl-card{min-width:0;border:1px solid rgba(139,154,168,.23);border-radius:12px;padding:14px;background:rgba(17,26,37,.92)}',
      '.dbl-phase{color:#35e0c4;font:700 12px/1.2 "IBM Plex Mono",monospace;letter-spacing:.08em}',
      '.dbl-band{margin:5px 0 9px;color:#8b9aa8;font:600 10px/1.35 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em}',
      '.dbl-venture{margin:0 0 7px;color:#f1f5f8;font:700 15px/1.25 Inter,system-ui,sans-serif}',
      '.dbl-mechanism{margin:0;color:#b9c5cd;font:400 12px/1.5 Inter,system-ui,sans-serif}',
      '.dbl-status{display:inline-block;margin:12px 0 8px;padding:3px 7px;border:1px solid rgba(53,224,196,.35);border-radius:999px;color:#9debdc;background:rgba(53,224,196,.07);font:700 9px/1.25 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em}',
      '.dbl-status[data-status="DESIGNED_UNMEASURED"],.dbl-status[data-status="LICENSE_GATED"]{border-color:rgba(217,183,74,.35);color:#ddca82;background:rgba(217,183,74,.07)}',
      '.dbl-evidence,.dbl-gate,.dbl-econ{margin:7px 0 0;color:#8796a2;font:400 10.5px/1.5 Inter,system-ui,sans-serif}',
      '.dbl-evidence b,.dbl-gate b,.dbl-econ b{color:#b9c5cd}',
      '.dbl-link{display:inline-block;margin-top:10px;color:#35e0c4;font:700 11px/1.4 Inter,system-ui,sans-serif;text-decoration:none}',
      '.dbl-rule{margin:18px 0 0;padding-top:14px;border-top:1px solid rgba(139,154,168,.2);color:#8b9aa8;font:400 11px/1.55 Inter,system-ui,sans-serif}',
      '@media(max-width:980px){.dbl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dbl-phase-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:600px){.dbl-wrap{padding:30px 14px}.dbl-shell{padding:18px}.dbl-grid,.dbl-phase-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderRegulation(regulation) {
    if (!regulation || !Array.isArray(regulation.phases) || !Array.isArray(regulation.stressBands)) return null;
    var details = element('details', 'dbl-regulation');
    details.setAttribute('data-regulation-namespace', regulation._meta.namespace);
    details.appendChild(element('summary', '', 'How sensed stress regulates these businesses · P0-P10 policy'));
    var body = element('div', 'dbl-reg-body');
    body.appendChild(element('p', 'dbl-reg-note', regulation._meta.compositionRule + ' This is policy and shadow telemetry, not a claim that an external motor is authorized.'));
    var stress = element('div', 'dbl-stress');
    stress.setAttribute('aria-label', 'Continuous stress overlays');
    regulation.stressBands.forEach(function (band) {
      var upper = band.maxExclusive != null ? '<' + Math.round(band.maxExclusive * 100) : '≤' + Math.round(band.maxInclusive * 100);
      var range = band.minInclusive == null ? 'unmeasured' : '≥' + Math.round(band.minInclusive * 100) + '% and ' + upper + '%';
      stress.appendChild(element('span', '', band.label + ' · ' + range + ' · ' + band.newCommitments.toLowerCase().replace(/_/g, ' ')));
    });
    body.appendChild(stress);
    var grid = element('div', 'dbl-phase-grid');
    regulation.phases.forEach(function (phase) {
      var row = element('div', 'dbl-phase-rule');
      row.appendChild(element('b', '', phase.phase + ' · ' + phase.title + ' · ' + phase.businessPosture.toLowerCase().replace(/_/g, ' ')));
      row.appendChild(element('span', '', phase.businessResponse));
      grid.appendChild(row);
    });
    body.appendChild(grid);
    details.appendChild(body);
    return details;
  }

  function render(data, regulation, domainId) {
    var domain = data && data.domains && data.domains[domainId];
    var bands = data && data._meta && data._meta.bands;
    if (!domain || !Array.isArray(bands)) return;

    addStyle();
    var section = element('section', 'dbl-wrap');
    section.id = 'businessLadderSection';
    section.setAttribute('data-business-domain', domainId);
    section.setAttribute('data-phase-namespace', data._meta.phaseNamespace);

    var shell = element('div', 'dbl-shell');
    shell.appendChild(element('div', 'dbl-kicker', 'P0-P10 · business capital architecture'));
    shell.appendChild(element('h2', 'dbl-title', 'How ' + domain.name + ' can build businesses'));
    shell.appendChild(element('p', 'dbl-intro', 'Each band reuses the evidence, tools and operating skill built below it. A domain may build, invest in or decline a venture; pressure alone never forces a company into existence.'));
    var directory = element('nav', 'dbl-directory');
    directory.setAttribute('aria-label', 'Domain application navigation');
    var directoryLink = element('a', '', 'All domains & apps →');
    directoryLink.href = '/pages';
    directory.appendChild(directoryLink);
    var portalLink = element('a', '', domain.name + ' portal / engine →');
    portalLink.href = '/portal?domain=' + encodeURIComponent(domainId);
    directory.appendChild(portalLink);
    var consoleLink = element('a', '', domain.name + ' operator console →');
    consoleLink.href = '/domain-console?domain=' + encodeURIComponent(domainId);
    directory.appendChild(consoleLink);
    shell.appendChild(directory);
    shell.appendChild(element('p', 'dbl-warning', 'Separate namespace: this ladder describes venture capital and operating maturity. It is not this domain\'s current LIMEN cycle phase, a diagnosis, a forecast, or effect authority.'));
    var regulationSection = renderRegulation(regulation);
    if (regulationSection) shell.appendChild(regulationSection);

    var grid = element('div', 'dbl-grid');
    bands.forEach(function (band) {
      var venture = domain.bands && domain.bands[band.id];
      if (!venture) return;
      var card = element('article', 'dbl-card');
      card.setAttribute('data-business-band', band.id);
      card.appendChild(element('div', 'dbl-phase', band.phases.join('–')));
      card.appendChild(element('div', 'dbl-band', band.label));
      card.appendChild(element('h3', 'dbl-venture', venture.venture));
      card.appendChild(element('p', 'dbl-mechanism', venture.mechanism));
      var status = element('span', 'dbl-status', STATUS[venture.status] || venture.status);
      status.setAttribute('data-status', venture.status);
      card.appendChild(status);
      var economics = element('p', 'dbl-econ');
      economics.appendChild(element('b', '', 'Capital: '));
      economics.appendChild(document.createTextNode(band.capital + ' · '));
      economics.appendChild(element('b', '', 'Model: '));
      economics.appendChild(document.createTextNode(band.revenue + '.'));
      card.appendChild(economics);
      var evidence = element('p', 'dbl-evidence');
      evidence.appendChild(element('b', '', 'Evidence: '));
      evidence.appendChild(document.createTextNode(venture.evidence));
      card.appendChild(evidence);
      var gate = element('p', 'dbl-gate');
      gate.appendChild(element('b', '', 'Next gate: '));
      gate.appendChild(document.createTextNode(venture.nextGate));
      card.appendChild(gate);
      if (venture.runtimeLane) card.setAttribute('data-runtime-lane', venture.runtimeLane);
      if (venture.href) {
        var link = element('a', 'dbl-link', (venture.linkLabel || 'Open') + ' →');
        link.href = venture.href;
        card.appendChild(link);
      }
      grid.appendChild(card);
    });
    shell.appendChild(grid);
    shell.appendChild(element('p', 'dbl-rule', 'Funding rule: realized, reconciled surplus may capitalize the next band. Otherwise the domain must request a separate, budgeted Finance contract or explicit owner capital. Missing evidence, stale controls or missing reversibility keeps the higher band designed or held.'));
    section.appendChild(shell);

    var calcstack = document.querySelector('[data-calcstack-domain]');
    var footer = document.querySelector('footer');
    var anchor = calcstack || footer;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor);
    else document.body.appendChild(section);
  }

  var domainId = domainFromUrl();
  Promise.all([
    fetch(DATA_URL, { headers: { accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('business ladder unavailable');
      return response.json();
    }),
    fetch(REGULATION_URL, { headers: { accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .catch(function () { return null; })
  ]).then(function (payloads) { render(payloads[0], payloads[1], domainId); })
    .catch(function () { /* Fail quiet: a strategy surface must never break the live domain front. */ });
})();
