/**
 * venture-engine.js — node -> VENTURE PORTFOLIO, any archetype, classified on the capital ladder.
 *
 * The efferent arc of the autonomous regulator: a sensed dysregulation -> node -> a portfolio of
 * candidate BUSINESSES (not just "broker a signal"), each tagged by archetype + capital level
 * L1..L6, with the Claude Code skill-chain that STANDS IT UP (option b: landing page / offer /
 * storefront), NOT just outreach. Deterministic + no-cost (paid AI only DEEPENS a scaffold on a run).
 *
 * Grounded in the operator's capital-ladder-bootstrap:
 *  - L1 = no capital (own nothing) ... L6 = heavy (own the platform, take positions, acquire).
 *  - AFFERENT-FEEDER unlock: every deep L4-L6 business has a low-capital sensory-INTAKE role that
 *    sources its inputs (sign-ups, scouting, leads, field data) and gets paid per unit. THAT feeder
 *    is the L1 entry. So from one node we emit the deep business AND its L1 feeder. Enter by FEEDING.
 *  - COMPOUNDING self-funding: run L1 first; each completed rung stays on and funds the next
 *    (1->2, 1+2->3, ...). Never retire a rung. Ambition is the whole ladder.
 *
 * Dual export: window.LimenVentureEngine (browser) + module.exports (server/tests).
 */
(function (root) {
  'use strict';

  // The capital ladder (levels = capital required to OPERATE at that rung).
  var CAPITAL = {
    L1: { level: 1, label: 'no capital', desc: 'own nothing; sell data / monitoring / leads / sign-ups (the afferent feeder)' },
    L2: { level: 2, label: 'minimal', desc: 'light delivery: a service, a subscription, a curated readout' },
    L3: { level: 3, label: 'modest', desc: 'some inventory / tooling / a small team' },
    L4: { level: 4, label: 'moderate', desc: 'real product, conversion, working capital' },
    L5: { level: 5, label: 'significant', desc: 'platform build, licensed data, positions' },
    L6: { level: 6, label: 'heavy', desc: 'own the platform, take positions, acquire' }
  };

  // Archetype registry. `standUp` names the deliverable option (b) produces; `skills` = the
  // Claude Code skill-chain that BUILDS + runs it (from CLAUDE_CODE_SKILLS.md / the playbook).
  var ARCHETYPES = {
    'afferent-feeder': { role: 'feeder', capital: 'L1', standUp: 'capture landing page (sign-up / scout / report) that sources the big node inputs, paid per unit',
      skills: ['web-artifacts-builder', 'content-creation', 'enrich-lead', 'lead-triage'] },
    'broker': { role: 'feeder', capital: 'L1', standUp: 'signal-alert page + per-result outreach to the buyer',
      skills: ['enrich-lead', 'compose-outreach', 'account-research'] },
    'affiliate-content': { role: 'feeder', capital: 'L1', standUp: 'content site / channel (YouTube, blog) with affiliate links',
      skills: ['content-creation', 'article-writing', 'seo-audit', 'canva-creator', 'affiliate-injector'] },
    'curated-readout': { role: 'feeder', capital: 'L1', standUp: 'a paid curated readout / newsletter over the free feed',
      skills: ['digest', 'deep-research', 'build-dashboard', 'create-viz'] },
    'local-service': { role: 'processing', capital: 'L2', standUp: 'a service landing page + booking + outreach to the sensed prospect',
      skills: ['web-artifacts-builder', 'compose-outreach', 'canva-creator'] },
    'subscription': { role: 'processing', capital: 'L2', standUp: 'a subscription / monitoring product on top of the readout',
      skills: ['build-dashboard', 'campaign-plan', 'email-sequence'] },
    'product-flip': { role: 'processing', capital: 'L4', standUp: 'a storefront (source -> convert -> list -> sell) around the sensed arbitrage',
      skills: ['market-research', 'create-product', 'canva-creator', 'run-analytics-query'] },
    'licensed-data': { role: 'incumbent', capital: 'L5', standUp: 'a licensed / owned data feed for professional counterparties',
      skills: ['system-design', 'build-dashboard', 'deploy'] },
    'owned-operation': { role: 'incumbent', capital: 'L6', standUp: 'own the platform / take positions / acquire the asset',
      skills: ['system-design', 'investor-materials', 'deploy'] }
  };

  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d || 0); }
  function capLevel(cap) { return (CAPITAL[cap] || CAPITAL.L1).level; }

  // Infer the archetype set for a sensed opportunity/node. ALWAYS pairs a deep business with its
  // L1 afferent feeder (the entry), plus any archetype the node's language suggests. Open set.
  function inferArchetypes(opp) {
    opp = opp || {};
    var text = ((opp.biz || opp.business || '') + ' ' + (opp.blurb || '') + ' ' + (opp.node || '') + ' ' + (opp.buyer || '')).toLowerCase();
    var set = {};
    // the deep business the opportunity already names (its incumbent buyer / product)
    if (opp.buyer) set['broker'] = 1;                                   // a signal + a named buyer => broker is available
    if (/feed|data|index|licensed|api/.test(text)) set['licensed-data'] = 1;
    if (/subscrib|monitor|alert|watch|newsletter/.test(text)) set['subscription'] = 1;
    if (/readout|dossier|report|digest|brief/.test(text)) set['curated-readout'] = 1;
    if (/content|creator|video|channel|affiliate/.test(text)) set['affiliate-content'] = 1;
    if (/service|install|repair|move|scout|inspect|enroll|sign.?up/.test(text)) set['local-service'] = 1;
    if (/\bbuy\b|convert|resale|\bflip\b|inventory|refurbish|arbitrage/.test(text)) set['product-flip'] = 1;   // \bbuy\b so "buyer" does not spuriously add a flip
    if (/\bown\b|platform|acquire|\bposition\b|\bfund\b/.test(text)) set['owned-operation'] = 1;
    // AFFERENT-FEEDER: always present. It is the L1 that sources the deep node's inputs.
    set['afferent-feeder'] = 1;
    // sensible default portfolio if the text was thin
    if (Object.keys(set).length <= 1) { set['broker'] = 1; set['curated-readout'] = 1; }
    return Object.keys(set);
  }

  // Turn one sensed opportunity into a full VENTURE PORTFOLIO (any archetype, L1-L6 classified).
  function generateVentures(opp) {
    opp = opp || {};
    var archs = inferArchetypes(opp);
    var ventures = archs.map(function (a) {
      var meta = ARCHETYPES[a] || ARCHETYPES['broker'];
      var cap = meta.capital;
      var v = {
        node: opp.node || null,
        diagnosis: opp.diagnosis || opp.dx || null,
        domain: opp.domain || null,
        archetype: a,
        role: meta.role,                                  // feeder | processing | incumbent
        capital: cap,
        capitalLevel: capLevel(cap),
        capitalDesc: (CAPITAL[cap] || {}).desc || '',
        title: ventureTitle(a, opp),
        buyerOrInput: (a === 'afferent-feeder')
          ? ('feeds the deep ' + (opp.biz || opp.business || 'business') + ' with sourced inputs (sign-ups / scouting / leads), paid per unit')
          : (opp.buyer || 'the counterparty the node serves'),
        economics: opp.economics || opp.ladder || null,
        validity: opp.validity || (opp.conf ? { confidence: opp.conf } : null),
        skillChain: meta.skills.slice(),
        standUpKind: meta.standUp
      };
      v.standUp = standUp(v, opp);                        // option (b): the scaffold to actually build it
      return v;
    });
    return sortByLadder(ventures);
  }

  function ventureTitle(archetype, opp) {
    var subj = opp.biz || opp.business || opp.node || 'this node';
    switch (archetype) {
      case 'afferent-feeder': return 'Feeder: source the inputs for ' + subj;
      case 'broker': return 'Broker: route the signal to ' + (opp.buyer || 'the buyer');
      case 'affiliate-content': return 'Content/affiliate around ' + subj;
      case 'curated-readout': return 'Curated readout of ' + subj;
      case 'local-service': return 'Service off ' + subj;
      case 'subscription': return 'Monitoring subscription for ' + subj;
      case 'product-flip': return 'Arbitrage / flip on ' + subj;
      case 'licensed-data': return 'Licensed data feed: ' + subj;
      case 'owned-operation': return 'Own the ' + subj + ' operation';
      default: return subj;
    }
  }

  // OPTION (b): stand up the business - the deterministic scaffold. name/offer/landing sections/
  // capture/storefront + the skill-chain that builds it. Paid AI DEEPENS this on a run; the
  // scaffold itself is free.
  function standUp(v, opp) {
    var subj = (opp && (opp.biz || opp.business)) || (v && v.title) || 'the business';
    var isFeeder = v.role === 'feeder';
    return {
      kind: v.standUpKind,
      offer: isFeeder
        ? 'a single, obvious, no-capital thing sold per unit (a sign-up, a lead, a monitored alert, a scouted site)'
        : 'the delivered outcome the ' + subj + ' node needs, priced to value',
      landingSections: isFeeder
        ? ['hook (the one pain the node names)', 'the one action (sign up / report / scout)', 'proof / free-first', 'capture form -> /api/lead']
        : ['problem the node names', 'the offer + outcome', 'proof', 'CTA (book / buy)', 'checkout or lead capture'],
      capture: isFeeder ? { type: 'lead', endpoint: '/api/lead' } : { type: (v.archetype === 'product-flip' ? 'storefront' : 'lead') },
      storefront: v.archetype === 'product-flip' ? { platform: 'shopify', flow: 'source -> convert -> list -> sell' } : null,
      buildSkills: v.skillChain,
      firstAction: isFeeder
        ? 'stand up the free capture page (web-artifacts-builder), point it at /api/lead, run the L1'
        : 'draft the offer + landing (needs a run for AI copy); keep SEND / SPEND gated to the operator',
      gated: !isFeeder                                    // higher rungs need capital/AI/human sign; L1 feeder can go now
    };
  }

  function sortByLadder(ventures) {
    return ventures.slice().sort(function (a, b) { return a.capitalLevel - b.capitalLevel; });   // L1 first (bootstrap sequence)
  }

  // COMPOUNDING: the funding sequence - each rung's cumulative lower rungs fund the next.
  function fundingChain(ventures) {
    var sorted = sortByLadder(ventures), chain = [], base = [];
    sorted.forEach(function (v) {
      chain.push({ capital: v.capital, title: v.title, fundedBy: base.slice(), note: base.length ? ('funded by ' + base.join('+')) : 'entry rung (no capital)' });
      base.push(v.capital);
    });
    return chain;
  }

  var API = { CAPITAL: CAPITAL, ARCHETYPES: ARCHETYPES, inferArchetypes: inferArchetypes,
    generateVentures: generateVentures, standUp: standUp, sortByLadder: sortByLadder, fundingChain: fundingChain, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LimenVentureEngine = API;
})(typeof window !== 'undefined' ? window : this);
