#!/usr/bin/env node
/**
 * 48a-priority: 14 HIGH-ALERT Command Board CIKs missing portals.
 *
 * One was filtered out: hcc (US Ecology) — acquired by Republic
 * Services, already covered by republic_services portal.
 *
 * Minimal instructions per target — relies on the enricher's
 * system prompt (Walmart-grade exemplar) to drive density. Any
 * portal that comes back thin (<25 fn entries or <70% anchored)
 * gets flagged for TIGHT-instruction re-fire in a follow-up batch.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
function headers() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = 'Bearer ' + TOKEN;
  return h;
}

const TARGETS = [
  { slug: 'constellation_energy',   cik: '0001868275', ticker: 'CEG',
    name: 'Constellation Energy Corporation', domainId: 'energy',
    industry: 'Independent power producer — nuclear (largest US nuclear fleet) + gas + renewables; spun off from Exelon Feb 2022; Three Mile Island Crane Clean Energy Center restart 2028 for Microsoft 20-yr PPA' },

  { slug: 'enphase_energy',         cik: '0001463101', ticker: 'ENPH',
    name: 'Enphase Energy, Inc.', domainId: 'energy',
    industry: 'Residential solar microinverters + IQ batteries + IQ8 line + EV charging; California NEM 3.0 + IRA 45X tax credits + Section 201/301 tariff exposure on China cells' },

  { slug: 'fidelity_national_info', cik: '0001136893', ticker: 'FIS',
    name: 'Fidelity National Information Services, Inc.', domainId: 'finance',
    industry: 'Banking + capital markets technology; Worldpay spinoff Feb 2024 → GTCR + Issuer Solutions sale to Apollo $11.5B Apr 2024; core banking + payments + lending platforms for ~5K bank + credit union clients' },

  { slug: 'lincoln_ed_services',    cik: '0001168331', ticker: 'LINC',
    name: 'Lincoln Educational Services Corporation', domainId: 'education',
    industry: 'For-profit career/technical education — automotive + skilled trades + healthcare + business; ~22 campuses; Title IV financial aid dependence; gainful-employment + 90/10 rule + financial-responsibility composite-score exposure' },

  { slug: 'veritone',                cik: '0001615165', ticker: 'VERI',
    name: 'Veritone, Inc.', domainId: 'technology',
    industry: 'aiWARE enterprise AI platform — media + broadcast (production search/clip/captioning) + public-safety (digital evidence management) + energy (forecasting); recurring SaaS + transactional licensing' },

  { slug: 'houghton_mifflin_harcourt', cik: '0001580156', ticker: 'HMHC',
    name: 'Houghton Mifflin Harcourt Company', domainId: 'education',
    industry: 'K-12 curriculum + digital learning — Into Reading + Into Math + HMH Ed Suite SaaS; taken private by Veritas Capital Apr 2022 $2.8B; ESSER pandemic-funding wind-down 2024-2026 hits curriculum-adoption cycles' },

  { slug: 'huntington_ingalls',     cik: '0001501585', ticker: 'HII',
    name: 'Huntington Ingalls Industries, Inc.', domainId: 'defense',
    industry: 'US Navy shipbuilder — Newport News (Virginia-class SSN + Columbia-class SSBN + Ford-class CVN nuclear-aircraft-carrier) + Ingalls (DDG-51 Arleigh Burke + LHA-amphibious + NSC USCG); Mission Technologies services arm' },

  { slug: 'zimmer_biomet',          cik: '0001136869', ticker: 'ZBH',
    name: 'Zimmer Biomet Holdings, Inc.', domainId: 'medicine',
    industry: 'Musculoskeletal devices — knee + hip + extremities + spine + dental + sports medicine; ROSA robotics platform; Persona knee + Avenir hip key product families; CMS + Medicare DRG pricing pressure' },

  { slug: 'qiagen',                  cik: '0001660334', ticker: 'QGEN',
    name: 'QIAGEN N.V.', domainId: 'medicine',
    industry: 'Molecular sample-prep + diagnostics — QIAcube + QIAsymphony platforms + QuantiFERON-TB Gold + therascreen companion diagnostics + digital insights; ADR Nasdaq; Thermo Fisher 2020 takeover bid withdrawn' },

  { slug: 'athersys',                cik: '0001368148', ticker: 'ATHX',
    name: 'Athersys, Inc.', domainId: 'medicine',
    industry: 'MultiStem (allogeneic stem-cell) therapy for ischemic stroke + ARDS; TREASURE Japan Ph 2/3 + MASTERS-2 US Ph 3 ischemic stroke; Chapter 11 filed May 2024 (TERMINAL_DIVERGENCE signal) — phylogenetic failure case' },

  { slug: 'lindsay_corporation',    cik: '0000836157', ticker: 'LNN',
    name: 'Lindsay Corporation', domainId: 'agriculture',
    industry: 'Zimmatic irrigation systems (center-pivot + lateral-move) + FieldNET remote management; Road Infrastructure (Road Zipper barriers + crash cushions); ~70/30 irrigation/infrastructure revenue split' },

  { slug: 'sentinelone',             cik: '0001583708', ticker: 'S',
    name: 'SentinelOne, Inc.', domainId: 'technology',
    industry: 'Singularity XDR endpoint + cloud + identity security platform; AI-driven Purple AI assistant + Singularity Data Lake; competes CrowdStrike + Palo Alto + Microsoft Defender; $725M Krebs Stamos acquisition Nov 2024' },

  { slug: 'lumen_technologies',     cik: '0000018926', ticker: 'LUMN',
    name: 'Lumen Technologies, Inc.', domainId: 'communication',
    industry: 'Enterprise + wholesale fiber + edge cloud — North American 450K-route-mile network + EMEA + APAC; Microsoft + AWS + Google Cloud $5B+ multi-year cloud-connectivity deals 2024; consumer broadband Quantum Fiber + legacy copper wind-down' },

  { slug: 'dk_butterfly_1',          cik: '0000886158', ticker: null,
    name: '20230930 DK-Butterfly-1, Inc. (formerly Bed Bath & Beyond)', domainId: 'trade',
    industry: 'Chapter 11 estate of Bed Bath & Beyond Inc. — liquidation 2023; Overstock acquired BBBY brand IP + domain Jun 2023 $21.5M; phylogenetic failure case (TERMINAL_DIVERGENCE p7a)' }
];

async function processTarget(target) {
  console.log('=== ' + target.slug + ' ===');
  try {
    const r = await fetch(BASE + '/api/enrich-portal-claude', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ target, maxTokens: 15000 })
    });
    const j = await r.json();
    if (j.ok) {
      await fs.writeFile(path.join('assets/data/companies', target.slug + '.json'),
        JSON.stringify(j.portal, null, 2) + '\n');
      const dr = j.densityReport || {};
      console.log('  OK ' + dr.functionalNetworkTotal + ' entries  anchored=' + dr.anchoredRate);
      return { slug: target.slug, ok: true, entries: dr.functionalNetworkTotal, anchored: dr.anchoredRate };
    } else {
      console.log('  FAIL: ' + JSON.stringify(j).slice(0, 200));
      return { slug: target.slug, ok: false, error: j.error || 'unknown' };
    }
  } catch (e) {
    console.log('  EXCEPTION: ' + e.message);
    return { slug: target.slug, ok: false, error: e.message };
  }
}

async function main() {
  const results = [];
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const r = await processTarget(t);
    results.push(r);
    if (i < TARGETS.length - 1) {
      console.log('  (90s pause)');
      await new Promise(r => setTimeout(r, 90000));
    }
  }
  console.log('');
  console.log('=== SUMMARY ===');
  let ok = 0, fail = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log('  ' + r.slug + '  ' + r.entries + '  ' + (typeof r.anchored === 'number' ? (r.anchored * 100).toFixed(0) + '%' : r.anchored));
    } else {
      fail++;
      console.log('  ' + r.slug + '  FAIL: ' + r.error);
    }
  }
  console.log('  ' + ok + '/' + TARGETS.length + ' succeeded');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
