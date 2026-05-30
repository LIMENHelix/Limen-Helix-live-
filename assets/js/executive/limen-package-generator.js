/**
 * LIMEN Package Generator — Phase 19
 *
 * Transforms internal opportunity data into external-facing business packages.
 * Dual-language model: keeps internal reasoning, outputs external business language.
 *
 * No internal jargon (stress %, connectome nodes, phase states) in final output.
 * Every package includes evidence anchors from live signals.
 *
 * Exposes: window.LIMENPackageGenerator
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // INTERNAL → EXTERNAL TRANSLATION
  // ══════════════════════════════════════════════════════════════════════

  var MARKET_TRIGGERS = {
    energy:      'Energy market disruption and supply-chain volatility have elevated demand for monitoring, routing, and resilience solutions among energy operators and adjacent logistics providers.',
    defense:     'Heightened geopolitical risk and defense spending acceleration are creating urgent demand for situational awareness, logistics coordination, and infrastructure hardening solutions.',
    finance:     'Financial market volatility and regulatory pressure are driving institutional demand for risk analytics, compliance automation, and portfolio stress testing capabilities.',
    trade:       'Global shipping disruptions and port congestion are forcing logistics operators to seek real-time routing intelligence, cargo tracking, and supply chain visibility platforms.',
    agriculture: 'Rising input costs and food supply uncertainty are accelerating adoption of precision agriculture, supply chain tracking, and crop logistics optimization tools.',
    health:      'Healthcare system strain and medical supply disruptions are creating demand for capacity analytics, supply chain monitoring, and public health surveillance infrastructure.',
    technology:  'Cybersecurity threats and infrastructure vulnerabilities are driving enterprise investment in anomaly detection, resilience testing, and digital sovereignty platforms.',
    governance:  'Regulatory complexity and policy volatility are increasing institutional need for compliance tracking, policy impact analytics, and stakeholder communication platforms.',
    environment: 'Climate risk escalation and environmental compliance requirements are creating market opportunity for monitoring platforms, emissions tracking, and early warning systems.',
    industry:    'Manufacturing disruptions and raw material shortages are pushing industrial operators toward IoT analytics, equipment optimization, and supply intelligence solutions.',
    infrastructure: 'Critical infrastructure strain and utility grid challenges are driving investment in monitoring SaaS, smart city resilience, and capacity planning platforms.'
  };

  var CUSTOMER_PAIN = {
    energy:      'Energy operators lack integrated visibility across supply, distribution, and pricing volatility, leading to reactive decision-making and margin erosion.',
    defense:     'Defense organizations face information overload without unified threat assessment and coordination tools, creating response delays and resource misallocation.',
    finance:     'Financial institutions struggle to model cascading risks across asset classes and regulatory environments simultaneously.',
    trade:       'Logistics providers cannot dynamically reroute shipments or assess port/route risk in real-time, causing delays and cost overruns.',
    agriculture: 'Agricultural operators face opaque input pricing, unpredictable supply chains, and limited crop-to-market visibility.',
    health:      'Healthcare systems lack early warning capability for capacity strain and supply chain disruption.',
    technology:  'Organizations cannot assess infrastructure vulnerability or detect anomalies before they cascade into operational failures.',
    governance:  'Government agencies lack tools to track regulatory change impact across departments and stakeholder groups.',
    environment: 'Organizations face growing compliance burden without automated monitoring and reporting infrastructure.',
    industry:    'Manufacturers lack predictive visibility into equipment lifecycle, workforce safety patterns, and raw material availability.',
    infrastructure: 'Utility operators cannot model infrastructure stress or predict failure points under changing demand patterns.'
  };

  // ══════════════════════════════════════════════════════════════════════
  // EVIDENCE ANCHOR BUILDER
  // ══════════════════════════════════════════════════════════════════════

  function _buildEvidenceAnchors(opp) {
    var anchors = [];
    var domain = opp.domain || '';

    // 1. Market evidence from live domain stress
    var domains = window.LIMENDomains || {};
    if (domains[domain]) {
      var stressLevel = domains[domain].stress || 0;
      var stressLabel = stressLevel > 0.7 ? 'significantly elevated' : (stressLevel > 0.4 ? 'elevated' : 'moderate');
      anchors.push({
        type: 'market',
        text: domain.charAt(0).toUpperCase() + domain.slice(1) + ' sector conditions are ' + stressLabel + ', indicating sustained demand pressure for operational solutions.'
      });
    }

    // 2. Defense signal evidence
    var defStatus = window.LIMENDefenseSignals ? window.LIMENDefenseSignals.getStatus() : null;
    if (defStatus && defStatus.signals) {
      var relevant = defStatus.signals.filter(function(s) {
        return s.confidence !== 'LOW' && s.affectedDomains && s.affectedDomains.indexOf(domain) !== -1;
      });
      if (relevant.length > 0) {
        var topSig = relevant[0];
        anchors.push({
          type: 'event',
          text: topSig.articleCount + ' verified news sources report ' + topSig.eventType.replace(/_/g, ' ').toLowerCase() + ' events affecting the ' + domain + ' sector (confidence: ' + topSig.confidence + ').'
        });
      }
      if (defStatus.macroShock) {
        anchors.push({
          type: 'macro',
          text: 'Multi-domain systemic disruption detected across ' + (defStatus.signals.filter(function(s){return s.confidence!=='LOW';}).length) + ' event categories, affecting ' + (new Set(defStatus.signals.reduce(function(a,s){return a.concat(s.affectedDomains);},[])).size) + '+ sectors simultaneously.'
        });
      }
    }

    // 3. Cross-domain evidence
    if (opp.sourceType === 'cross_domain') {
      anchors.push({
        type: 'operations',
        text: 'Simultaneous pressure on multiple sectors creates demand for solutions operating at the intersection, where existing single-domain tools fail to address cascading effects.'
      });
    }

    // 4. Long-term regime evidence
    var longMem = window.LIMENLongMemory;
    if (longMem && longMem.getRegime) {
      var regime = longMem.getRegime(domain, 30);
      if (regime === 'EXTREME' || regime === 'ELEVATED') {
        anchors.push({
          type: 'trend',
          text: domain.charAt(0).toUpperCase() + domain.slice(1) + ' sector has maintained elevated conditions over the recent 30-day period, suggesting structural (not transient) demand.'
        });
      }
    }

    // 5. Timestamp
    anchors.push({
      type: 'timestamp',
      text: 'Analysis current as of ' + new Date().toISOString().substring(0, 10) + '.'
    });

    return anchors;
  }

  // Phase 25G: Enrich opportunity with generated diagnosis/treatment content
  function _getGeneratedContent(domain) {
    var synth = window.LIMENGapSynthesis;
    if (!synth || !synth.getDiagnoses) return null;

    var diagnoses = synth.getDiagnoses(domain);
    if (diagnoses.length === 0) return null;

    var best = diagnoses[0]; // highest confidence (already sorted by generation order)
    var treatments = synth.getTreatments(best.id) || [];

    return {
      generatedContent: true,
      diagnosis: {
        title: best.title,
        mechanism: best.mechanism,
        confidence: best.confidence,
        linkedNodes: best.linkedNodes,
        linkedBusinesses: best.linkedBusinesses
      },
      treatments: treatments.slice(0, 4).map(function (t) {
        return { title: t.title, action: t.action, type: t.type, timeHorizon: t.timeHorizon };
      }),
      evidenceAnchors: best.evidenceAnchors
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PACKAGE TEMPLATES
  // ══════════════════════════════════════════════════════════════════════

  function _loanPackage(opp, anchors) {
    var d = (opp.domain || 'general').charAt(0).toUpperCase() + (opp.domain || '').slice(1);
    var title = opp.title || opp.indication || d + ' operational solution';
    var trigger = MARKET_TRIGGERS[opp.domain] || 'Current market conditions create demand for operational solutions in this sector.';
    var pain = CUSTOMER_PAIN[opp.domain] || 'Operators in this sector face growing complexity without adequate tooling.';

    var sections = [];
    sections.push('# LOAN APPLICATION — ' + title.toUpperCase());
    sections.push('');
    sections.push('## Business Purpose');
    sections.push(trigger);
    sections.push('');
    sections.push('## Problem Statement');
    sections.push(pain);
    sections.push('');
    sections.push('## Proposed Solution');
    sections.push('Development and deployment of a ' + title.toLowerCase() + ' platform that provides real-time operational intelligence to ' + d.toLowerCase() + ' sector operators, enabling proactive decision-making and risk mitigation.');
    sections.push('');
    sections.push('## Use of Funds');
    sections.push('- Platform development and engineering (40%)');
    sections.push('- Data infrastructure and integration (25%)');
    sections.push('- Go-to-market and initial customer acquisition (20%)');
    sections.push('- Working capital and operations (15%)');
    sections.push('');
    sections.push('## Revenue Model');
    sections.push('SaaS subscription model with per-seat or per-facility pricing. Target initial customers include mid-market ' + d.toLowerCase() + ' operators seeking operational visibility and risk management capabilities.');
    sections.push('');
    sections.push('## Market Timing');
    sections.push('Current conditions create a compelling entry window:');
    for (var ai = 0; ai < anchors.length; ai++) {
      if (anchors[ai].type !== 'timestamp') sections.push('- ' + anchors[ai].text);
    }
    sections.push('');
    sections.push('## Target Customer');
    sections.push('Mid-to-large ' + d.toLowerCase() + ' sector operators, infrastructure managers, and logistics coordinators seeking real-time operational intelligence.');
    sections.push('');
    sections.push('---');
    sections.push('*Generated by LIMEN Helix · ' + new Date().toISOString().substring(0, 10) + ' · Draft for review*');

    return { format: 'markdown', content: sections.join('\n'), template: 'LOAN' };
  }

  function _grantPackage(opp, anchors) {
    var d = (opp.domain || 'general').charAt(0).toUpperCase() + (opp.domain || '').slice(1);
    var title = opp.title || opp.indication || d + ' research solution';
    var trigger = MARKET_TRIGGERS[opp.domain] || 'Current conditions create research opportunity in this sector.';

    // Phase 25G: Enrich with generated diagnosis/treatment content
    var gen = _getGeneratedContent(opp.domain);
    if (gen) {
      trigger = gen.diagnosis.mechanism;
      if (gen.evidenceAnchors) {
        for (var gai = 0; gai < gen.evidenceAnchors.length; gai++) {
          anchors.push(gen.evidenceAnchors[gai]);
        }
      }
    }

    // Look up domain-specific funders
    var domainBase = null;
    if (window.LIMENClarity && window.LIMENClarity._getDomainBase) {
      domainBase = window.LIMENClarity._getDomainBase(opp.domain);
    }
    var funders = domainBase ? domainBase.funders : 'Federal research agencies (NSF, NIH, DOE) and sector-specific foundations';

    var sections = [];
    sections.push('# GRANT APPLICATION — ' + title.toUpperCase());
    sections.push('');
    sections.push('## Project Summary');
    sections.push('This project addresses the critical need for ' + title.toLowerCase() + ' capabilities in the ' + d.toLowerCase() + ' sector. ' + trigger);
    sections.push('');
    sections.push('## Statement of Need');
    sections.push(CUSTOMER_PAIN[opp.domain] || 'Current operational tools are insufficient for the complexity of challenges in this sector.');
    sections.push('');
    sections.push('## Research Objectives');
    sections.push('1. Develop and validate a ' + title.toLowerCase() + ' methodology applicable to real-world ' + d.toLowerCase() + ' operations');
    sections.push('2. Demonstrate measurable improvement in operational outcomes for pilot participants');
    sections.push('3. Publish findings and create reproducible implementation framework');
    sections.push('');
    sections.push('## Evidence of Demand');
    for (var ai = 0; ai < anchors.length; ai++) {
      if (anchors[ai].type !== 'timestamp') sections.push('- ' + anchors[ai].text);
    }
    sections.push('');
    sections.push('## Potential Funding Sources');
    sections.push(funders);
    sections.push('');
    // Phase 26: Deep portal content — real citations, steps, monitoring
    var resolved = opp.resolvedContent;
    if (resolved && resolved.allImplementationSteps && resolved.allImplementationSteps.length > 0) {
      sections.push('## Implementation Methodology');
      sections.push('');
      for (var si = 0; si < Math.min(resolved.allImplementationSteps.length, 5); si++) {
        var impl = resolved.allImplementationSteps[si];
        sections.push('### ' + impl.treatmentLabel);
        sections.push('Type: ' + impl.type + ' | Evidence: ' + impl.evidence);
        if (impl.steps) {
          for (var sti = 0; sti < impl.steps.length; sti++) {
            sections.push((sti + 1) + '. ' + impl.steps[sti]);
          }
        }
        if (impl.monitoring) {
          sections.push('');
          sections.push('**Monitoring:** ' + impl.monitoring);
        }
        if (impl.escalation) {
          sections.push('');
          sections.push('**Escalation:** ' + impl.escalation);
        }
        sections.push('');
      }

      // Add real citations
      if (resolved.allEvidenceAnchors && resolved.allEvidenceAnchors.length > 0) {
        sections.push('## References');
        var seenCite = {};
        for (var ci = 0; ci < resolved.allEvidenceAnchors.length; ci++) {
          var ea = resolved.allEvidenceAnchors[ci];
          if (ea.type === 'citation' && !seenCite[ea.text]) {
            seenCite[ea.text] = true;
            sections.push('- ' + ea.text + ' (Evidence: ' + ea.evidence + ')');
          }
        }
        sections.push('');
      }
    }

    sections.push('## Expected Impact');
    sections.push('Improved operational resilience, reduced response time to disruptions, and data-driven decision support for ' + d.toLowerCase() + ' sector stakeholders.');
    sections.push('');
    sections.push('---');
    sections.push('*Generated by LIMEN Helix · ' + new Date().toISOString().substring(0, 10) + ' · Draft for review*');

    return { format: 'markdown', content: sections.join('\n'), template: 'GRANT' };
  }

  function _patentPackage(opp, anchors) {
    var d = (opp.domain || 'general').charAt(0).toUpperCase() + (opp.domain || '').slice(1);
    var title = opp.title || opp.indication || d + ' intelligence system';

    var sections = [];
    sections.push('# PATENT COMMERCIALIZATION SUMMARY — ' + title.toUpperCase());
    sections.push('');
    sections.push('## Invention Overview');
    sections.push('A system and method for ' + title.toLowerCase() + ' that addresses current operational challenges in the ' + d.toLowerCase() + ' sector through automated signal processing, pattern detection, and actionable recommendation generation.');
    sections.push('');
    sections.push('## Commercial Opportunity');
    sections.push(MARKET_TRIGGERS[opp.domain] || 'Market conditions support commercialization of this technology.');
    sections.push('');
    sections.push('## Differentiation');
    sections.push('Unlike existing solutions that address isolated metrics, this system provides integrated multi-signal analysis with domain-specific intelligence, enabling operators to move from reactive to proactive decision-making.');
    sections.push('');
    sections.push('## Market Evidence');
    for (var ai = 0; ai < anchors.length; ai++) {
      if (anchors[ai].type !== 'timestamp') sections.push('- ' + anchors[ai].text);
    }
    sections.push('');
    sections.push('## Revenue Path');
    sections.push('- Enterprise SaaS licensing');
    sections.push('- API access for platform integrators');
    sections.push('- Professional services and custom implementation');
    sections.push('');
    sections.push('## Filing Recommendation');
    sections.push('File provisional patent application at USPTO ($320 small entity). Engage patent attorney for claims review. Target CPC classes relevant to ' + d.toLowerCase() + ' analytics and decision support.');
    sections.push('');
    sections.push('---');
    sections.push('*Generated by LIMEN Helix · ' + new Date().toISOString().substring(0, 10) + ' · Draft for attorney review*');

    return { format: 'markdown', content: sections.join('\n'), template: 'PATENT' };
  }

  function _investorMemo(opp, anchors) {
    var d = (opp.domain || 'general').charAt(0).toUpperCase() + (opp.domain || '').slice(1);
    var title = opp.title || opp.indication || d + ' solution';

    var sections = [];
    sections.push('# INVESTOR MEMO — ' + title.toUpperCase());
    sections.push('');
    sections.push('## Thesis');
    sections.push(MARKET_TRIGGERS[opp.domain] || 'Current market disruption creates venture-scale opportunity.');
    sections.push('');
    sections.push('## Problem');
    sections.push(CUSTOMER_PAIN[opp.domain] || 'Operators lack adequate tooling for current conditions.');
    sections.push('');
    sections.push('## Solution');
    sections.push(title.charAt(0).toUpperCase() + title.slice(1) + ' — a purpose-built platform addressing the specific operational challenges created by current ' + d.toLowerCase() + ' sector conditions.');
    sections.push('');
    sections.push('## Why Now');
    for (var ai = 0; ai < Math.min(anchors.length, 3); ai++) {
      if (anchors[ai].type !== 'timestamp') sections.push('- ' + anchors[ai].text);
    }
    sections.push('');
    sections.push('## Business Model');
    sections.push('SaaS with usage-based pricing. Land-and-expand within mid-market ' + d.toLowerCase() + ' operators.');
    sections.push('');
    sections.push('## Ask');
    sections.push('[Seed/Series A amount] for platform build, go-to-market, and first 10 enterprise customers.');
    sections.push('');
    sections.push('---');
    sections.push('*Generated by LIMEN Helix · ' + new Date().toISOString().substring(0, 10) + ' · Draft for review*');

    return { format: 'markdown', content: sections.join('\n'), template: 'INVESTOR' };
  }

  function _customerProposal(opp, anchors) {
    var d = (opp.domain || 'general').charAt(0).toUpperCase() + (opp.domain || '').slice(1);
    var title = opp.title || opp.indication || d + ' platform';

    var sections = [];
    sections.push('# PROPOSAL — ' + title.toUpperCase());
    sections.push('');
    sections.push('## Executive Summary');
    sections.push('We propose deploying a ' + title.toLowerCase() + ' to address your organization\'s need for real-time operational intelligence in the current ' + d.toLowerCase() + ' environment.');
    sections.push('');
    sections.push('## Current Challenge');
    sections.push(CUSTOMER_PAIN[opp.domain] || 'Your operations face growing complexity and risk exposure.');
    sections.push('');
    sections.push('## Our Solution');
    sections.push('A purpose-built ' + title.toLowerCase() + ' that provides automated monitoring, pattern detection, and actionable recommendations specific to your operational context.');
    sections.push('');
    sections.push('## Market Context');
    for (var ai = 0; ai < Math.min(anchors.length, 2); ai++) {
      if (anchors[ai].type !== 'timestamp') sections.push('- ' + anchors[ai].text);
    }
    sections.push('');
    sections.push('## Implementation Timeline');
    sections.push('- Phase 1 (30 days): Discovery and integration planning');
    sections.push('- Phase 2 (60 days): Platform deployment and configuration');
    sections.push('- Phase 3 (90 days): Training, validation, and optimization');
    sections.push('');
    sections.push('---');
    sections.push('*Generated by LIMEN Helix · ' + new Date().toISOString().substring(0, 10) + ' · Draft for review*');

    return { format: 'markdown', content: sections.join('\n'), template: 'PROPOSAL' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  var TEMPLATES = {
    loan: _loanPackage,
    grant: _grantPackage,
    patent: _patentPackage,
    investor: _investorMemo,
    proposal: _customerProposal
  };

  function generatePackage(opp, templateType) {
    var anchors = _buildEvidenceAnchors(opp);
    var generator = TEMPLATES[templateType] || _investorMemo;
    var pkg = generator(opp, anchors);
    // Safety layer: sanitize all text fields in generated package
    if (window.LIMENResponseSafety) {
      var _s = window.LIMENResponseSafety.sanitize;
      if (pkg.title) pkg.title = _s(pkg.title, 'package_gen');
      if (pkg.body) pkg.body = _s(pkg.body, 'package_gen');
      if (pkg.abstract) pkg.abstract = _s(pkg.abstract, 'package_gen');
      if (pkg.summary) pkg.summary = _s(pkg.summary, 'package_gen');
    }
    pkg.evidenceAnchors = anchors;
    pkg.internalContext = {
      domain: opp.domain,
      stress: opp.stress,
      sourceType: opp.sourceType,
      confidence: opp.confidence
    };
    return pkg;
  }

  function getAvailableTemplates() {
    return Object.keys(TEMPLATES);
  }

  window.LIMENPackageGenerator = {
    generatePackage: generatePackage,
    getAvailableTemplates: getAvailableTemplates,
    buildEvidenceAnchors: _buildEvidenceAnchors
  };

})();
