#!/usr/bin/env node
/**
 * gen-walmart-tree-l2.js — Walmart-tree Level-2 portal JSON generator.
 *
 * Per limen_brain_node_tracking memory (2026-05-10): every functionalNetwork
 * entry carries BOTH a high-level neuralRole AND a specific brainNodeId
 * from the 124-node LIMEN taxonomy (assets/data/brain-node-domains.json).
 * Plus a brainNodeRole drawn from the existing business binding for that
 * node. The relationshipNote is hand-curated per pair — distinctive fact,
 * not filler. Generic phrasing like "retail channel" or "warehouse channel"
 * is a code smell here; if a note doesn't teach the reader something
 * specific about THIS pair, rewrite it.
 *
 * Pattern-transfer is the point: tagging structure makes it findable when
 * a business pattern matches a known neurological pattern, or vice versa.
 *
 * Usage:
 *   node scripts/gen-walmart-tree-l2.js              # write missing
 *   node scripts/gen-walmart-tree-l2.js --force      # overwrite existing
 *   node scripts/gen-walmart-tree-l2.js --dry-run    # preview, no writes
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Brain-node primitives ──
// Each is a partial entry; merge with name/ticker/cik/slug at use site.
// brainNodeRole strings come from assets/data/brain-node-domains.json
// existing business/finance/trade bindings.
function _bn(role, nodeId, nodeRole) {
  return { neuralRole: role, brainNodeId: nodeId, brainNodeRole: nodeRole };
}

// Common regulator + auditor entries — each tagged with brain node specific
// to its neurological role, not just "Salience".
const SEC = { name: 'U.S. Securities and Exchange Commission', shortName: 'SEC',
  ..._bn('Salience', 'dACC', 'Compliance & Governance — disclosure conflict-monitor'),
  relationshipNote: '10-K, 10-Q, 8-K, Reg S-K + S-X. Continuous disclosure regime; quarterly forced honesty.' };
const FTC = { name: 'Federal Trade Commission', shortName: 'FTC',
  ..._bn('Salience', 'dACC', 'Compliance & Governance — antitrust + UDAP review'),
  relationshipNote: 'Antitrust merger review + Section 5 unfair-practices; Khan-era posture more aggressive than 1990s baseline.' };
const FDA = { name: 'Food and Drug Administration', shortName: 'FDA',
  ..._bn('Salience', 'AI', 'Crisis Detection — health-harm interoceptive sensor'),
  relationshipNote: 'Drug approval, food labeling, medical-device clearance. Recall authority is the live ammunition.' };
const USDA = { name: 'U.S. Department of Agriculture', shortName: 'USDA',
  ..._bn('Salience', 'AI', 'Crisis Detection — meat & poultry pathogen sentinel'),
  relationshipNote: 'FSIS inspection at meat-processing plants; one bad lot = nationwide recall, brand damage.' };
const EPA = { name: 'Environmental Protection Agency', shortName: 'EPA',
  ..._bn('Salience', 'BLA', 'Risk Assessment — chronic-environmental threat'),
  relationshipNote: 'TSCA chemical inventory, FIFRA pesticide registration, Clean Water/Air permits. Slow-burn enforcement.' };
const OSHA = { name: 'Occupational Safety and Health Administration', shortName: 'OSHA',
  ..._bn('Salience', 'BLA', 'Risk Assessment — workplace-injury threat detection'),
  relationshipNote: 'Workplace safety regulation; warehouse + factory citations. Amazon + Tyson have been frequent targets.' };
const DOT = { name: 'U.S. Department of Transportation', shortName: 'DOT',
  ..._bn('Salience', 'dACC', 'Compliance & Governance — transport policy'),
  relationshipNote: 'Hours-of-service rules + commercial-driver licensing. Trucking firm operating-cost backbone.' };
const FMCSA = { name: 'Federal Motor Carrier Safety Administration', shortName: 'FMCSA',
  ..._bn('Salience', 'AI', 'Crisis Detection — commercial-vehicle accident sentinel'),
  relationshipNote: 'CSA scoring + electronic logging device (ELD) mandate. Out-of-service rate is fleet-quality KPI.' };
const FAA = { name: 'Federal Aviation Administration', shortName: 'FAA',
  ..._bn('Salience', 'AI', 'Crisis Detection — air-cargo accident sentinel'),
  relationshipNote: 'Airworthiness certification; ground-stop authority is the kill-switch.' };
const CFTC = { name: 'Commodity Futures Trading Commission', shortName: 'CFTC',
  ..._bn('Salience', 'dACC', 'Compliance & Governance — derivatives integrity'),
  relationshipNote: 'Position-limits + speculative-trading oversight; agribusiness commodity hedgers report under CFTC rules.' };
const CPSC = { name: 'Consumer Product Safety Commission', shortName: 'CPSC',
  ..._bn('Salience', 'AI', 'Crisis Detection — consumer-product harm sentinel'),
  relationshipNote: 'Product recall authority; toy + appliance + apparel safety standards.' };

const auditor = (firm, since, note) => ({
  name: firm + ' LLP', shortName: firm,
  ..._bn('Salience', 'BLA', 'Risk Assessment — fiduciary threat-detection'),
  relationshipNote: 'External independent auditor' + (since ? ' since ' + since : '') + '. Issues annual audit opinion on 10-K' + (note ? '. ' + note + '.' : '.') + ' Private firm, no CIK.'
});

// Walmart-as-customer entry — repeated across most supplier rows. Pre-built
// here so each per-company table is shorter and the WMT-specific note is
// stable. Per-company override possible by spreading + replacing.
const WMT = (note) => ({
  name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
  ..._bn('Motor', 'M1', 'Production & Delivery — downstream distribution motor'),
  relationshipNote: note
});

// Per-company data table — every relationshipNote distinctive to its pair.
const COMPANIES = [
  // ──────────── SUPPLIERS (DMN-class to Walmart) ────────────
  {
    slug: 'procter_gamble', name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424',
    sic: '2840', industry: 'Soap, Cleaners & Toilet Preparations', domainId: 'trade',
    domainRelevance: 'Anchor U.S. consumer-packaged-goods firm. Brand portfolio (Tide, Pampers, Gillette, Crest, Olay, Bounty, Charmin) is the structural identity of household + grocery shelves nationwide.',
    fn: {
      suppliers: [
        { name: 'International Paper', ticker: 'IP', cik: '0000051434', slug: 'international_paper',
          ..._bn('DMN', 'S1', 'Raw Materials — primary somatosensory pulp input'),
          relationshipNote: 'Hardwood pulp + fluff for Bounty, Charmin, Pampers absorbent cores. PG\'s single largest raw-material exposure to forestry-product cyclicality.' },
        { name: 'Berry Global Group', ticker: 'BERY', cik: '0001378992', slug: 'berry_global',
          ..._bn('DMN', 'S1', 'Raw Materials — packaging substrate'),
          relationshipNote: 'Rigid plastic bottles for Tide, Cascade, Olay, Pantene. Multi-decade strategic supplier; PG\'s plastic-resin pass-through clause is the price-control mechanism.' }
      ],
      customers: [
        WMT('PG\'s #1 global customer — ~15% of net sales pass through Walmart shelves. PG/WMT pioneered Joint Business Planning (continuous data + assortment co-management) in the 1990s; the template every other CPG-retailer relationship copied.'),
        { name: 'Target Corporation', ticker: 'TGT', cik: '0000027419', slug: 'target',
          ..._bn('Motor', 'M1', 'Production & Delivery — premium-discount channel'),
          relationshipNote: 'Target\'s 2018 beauty reset elevated Olay + Native + Pantene to anchor positions; PG co-developed against Target\'s Up & Up private label as a benchmark.' },
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Costco\'s Kirkland private label competes directly with PG; PG sells limited club-pack SKUs (Bounty Plus 12-roll, Pampers economy boxes) to coexist with Kirkland economics.' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Motor', 'M1', 'Production & Delivery — e-commerce subscription channel'),
          relationshipNote: 'Subscribe & Save penetration is PG\'s direct-to-consumer KPI. PG was an early Amazon Vendor Central partner; AMZN now also competes via Solimo + 365 private labels.' },
        { name: 'CVS Health', ticker: 'CVS', cik: '0000064803', slug: 'cvs_health',
          ..._bn('Motor', 'M1', 'Production & Delivery — drug-retail channel'),
          relationshipNote: 'CVS ExtraCare data shows PG capturing higher AUR (avg unit retail) on Olay + Crest premium SKUs than mass-market channel — drugstore is PG\'s margin-rich distribution.' },
        { name: 'Walgreens Boots Alliance', ticker: 'WBA', cik: '0001618921', slug: 'walgreens',
          ..._bn('Motor', 'M1', 'Production & Delivery — drug-retail channel'),
          relationshipNote: 'Pharmacist-recommended Crest 3D Whitening + Oral-B Pro positioning. WBA\'s 2024 store-closure wave reduces PG distribution surface ~10%.' }
      ],
      competitors: [
        { name: 'Unilever', ticker: 'UL', cik: '0000217076', slug: 'unilever',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — multi-decade rival mind-model'),
          relationshipNote: 'PG vs UL is the longest-running CPG rivalry: Tide vs Persil, Pantene vs Dove, Olay vs Dove, Old Spice vs Axe. Different countries of origin (Cincinnati vs London/Rotterdam), opposite share-leadership in different categories.' },
        { name: 'Colgate-Palmolive', ticker: 'CL', cik: '0000021665', slug: 'colgate_palmolive',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — toothpaste duopoly'),
          relationshipNote: 'Crest vs Colgate is the textbook two-firm market — combined ~85% U.S. toothpaste share, fierce shelf-space war, near-symmetric R&D + advertising spend.' },
        { name: 'Kimberly-Clark', ticker: 'KMB', cik: '0000055785', slug: 'kimberly_clark',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — paper-goods adjacency'),
          relationshipNote: 'PG\'s Bounty vs KMB\'s Brawny + Scott; PG\'s Charmin vs KMB\'s Cottonelle; PG\'s Pampers vs KMB\'s Huggies. Same upstream pulp economics; different downstream brand strategies.' }
      ],
      regulators: [SEC, FDA, FTC, EPA, OSHA],
      auditor: auditor('Deloitte & Touche', '1890', 'One of the longest continuous Big Four audit relationships in U.S. corporate history'),
      executiveTeam: [
        { name: 'Jon Moeller', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2021; CFO 2009–2021. Career PG; the rare CEO who knows every product-category P&L from inside.' },
        { name: 'Andre Schulten', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2021; came up through PG-Europe finance. Owns capital allocation + share-repurchase cadence.' }
      ]
    }
  },
  {
    slug: 'coca_cola', name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344',
    sic: '2080', industry: 'Beverages', domainId: 'trade',
    domainRelevance: 'Concentrate-maker model — KO sells syrup to bottlers + foodservice, captures brand royalty + advertising leverage. Asset-light vs PEP\'s vertically integrated model.',
    fn: {
      suppliers: [
        { name: 'Coca-Cola Consolidated', ticker: 'COKE', cik: '0000317540', slug: 'coca_cola_consolidated',
          ..._bn('DMN', 'STRI', 'Operations — bottling habit-circuit'),
          relationshipNote: 'Largest independent KO bottler in the U.S.; handles ~14% of KO U.S. volume across 14 Southeast/Mid-Atlantic states. KO holds ~34% economic stake.' },
        { name: 'Ball Corporation', ticker: 'BALL', cik: '0000009389', slug: 'ball',
          ..._bn('DMN', 'S1', 'Raw Materials — aluminum can substrate'),
          relationshipNote: 'Aluminum cans for Coke, Diet Coke, Sprite. Ball is duopoly with Crown — KO\'s aluminum-price exposure is mostly Ball-mediated.' },
        { name: 'Crown Holdings', ticker: 'CCK', cik: '0001219601', slug: 'crown_holdings',
          ..._bn('DMN', 'S1', 'Raw Materials — beverage-can + closure substrate'),
          relationshipNote: 'Beverage cans + closures; Crown holds the other half of the U.S. aluminum-can duopoly with Ball.' },
        { name: 'Archer-Daniels-Midland', ticker: 'ADM', cik: '0000007084', slug: 'adm',
          ..._bn('DMN', 'STRI', 'Operations — sweetener feedstock'),
          relationshipNote: 'High-fructose corn syrup is the dominant sweetener in KO U.S. carbonated soft drinks; ADM is one of three major HFCS suppliers, alongside Cargill (private) and Tate & Lyle.' }
      ],
      customers: [
        WMT('Largest single retail account; KO + WMT relationship dates to Sam Walton\'s Bentonville sourcing meetings in the 1970s. Cooler placement is contractual — endcap + checkout cooler real estate measurably moves volume.'),
        { name: 'McDonald\'s Corporation', ticker: 'MCD', cik: '0000063908', slug: 'mcdonalds',
          ..._bn('Motor', 'M1', 'Production & Delivery — exclusive foodservice channel'),
          relationshipNote: 'KO has been MCD\'s exclusive cola supplier since 1955 — 70-year master pouring agreement. ~$1B+ annual revenue at the syrup level; the deepest beverage-foodservice relationship in U.S. history.' },
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Costco\'s $1.50 hot dog + soda combo (since 1985) uses Coke; Hodak-era KO renegotiations preserved the price point even through 2020s inflation.' },
        { name: 'Target Corporation', ticker: 'TGT', cik: '0000027419', slug: 'target',
          ..._bn('Motor', 'M1', 'Production & Delivery — discretionary-tilt channel'),
          relationshipNote: 'Target\'s grocery footprint is younger than WMT\'s; KO\'s cooler real estate at Target leans premium (Smartwater, Topo Chico) vs mass at Walmart.' }
      ],
      competitors: [
        { name: 'PepsiCo', ticker: 'PEP', cik: '0000077476', slug: 'pepsico',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cola war'),
          relationshipNote: 'The Cola Wars — 130+ years of direct competition. KO leads cola; PEP leads diversified (Frito-Lay snacks). Different operating models: KO concentrate-and-license, PEP vertically integrated.' },
        { name: 'Keurig Dr Pepper', ticker: 'KDP', cik: '0001418135', slug: 'keurig_dr_pepper',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — flavor-CSD rival'),
          relationshipNote: 'Dr Pepper, Snapple, Canada Dry. Smaller share but anchor on flavored carbonated soft drinks; KDP merged 2018 (JAB Holding consolidation).' },
        { name: 'Monster Beverage', ticker: 'MNST', cik: '0000865752', slug: 'monster_beverage',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — energy-drink rival, distributed by KO'),
          relationshipNote: 'KO holds ~19% equity stake in MNST and distributes Monster through KO bottlers since 2015. Quasi-cooperative competitor — a fractal kink in the rivalry tree.' }
      ],
      regulators: [SEC, FDA, FTC, USDA],
      auditor: auditor('Ernst & Young', null, 'Annual audit + transformation-program advisory'),
      executiveTeam: [
        { name: 'James Quincey', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2017. British; came up through KO Mexico + Latin America. Architected the post-Buffett premium-pricing pivot.' },
        { name: 'John Murphy', role: 'President & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2019, also President since 2022 — combined COO/CFO role unusual at KO\'s scale.' }
      ]
    }
  },
  {
    slug: 'pepsico', name: 'PepsiCo, Inc.', ticker: 'PEP', cik: '0000077476',
    sic: '2080', industry: 'Beverages + Snack Foods', domainId: 'trade',
    domainRelevance: 'Beverage + Frito-Lay snacks conglomerate. Direct-store-delivery (DSD) model — PEP trucks bypass retailer DCs and re-stock store shelves themselves. Unique among CPG; integrates with retailer logistics differently than KO\'s warehouse-route model.',
    fn: {
      suppliers: [
        { name: 'Archer-Daniels-Midland', ticker: 'ADM', cik: '0000007084', slug: 'adm',
          ..._bn('DMN', 'STRI', 'Operations — corn + oil feedstock'),
          relationshipNote: 'Corn + vegetable oils for Frito-Lay; potato + corn-flour inputs for Lay\'s, Doritos, Tostitos. PEP\'s commodity-cost exposure is largely ADM-mediated.' },
        { name: 'Ball Corporation', ticker: 'BALL', cik: '0000009389', slug: 'ball',
          ..._bn('DMN', 'S1', 'Raw Materials — aluminum cans'),
          relationshipNote: 'Aluminum cans for Pepsi, Mountain Dew, Bubly. Same upstream as KO — both companies share the can-maker duopoly exposure.' }
      ],
      customers: [
        WMT('Direct-store-delivery (DSD) gives PEP route-truck access inside Walmart stores — unusual privilege; PEP merchandisers re-stock Lay\'s/Frito-Lay shelves directly. KO uses warehouse-route, not DSD, at WMT.'),
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Costco rotates KO/PEP exclusivity by region — current contract structure means COST is one beverage at a time per region.' },
        { name: 'McDonald\'s Corporation', ticker: 'MCD', cik: '0000063908', slug: 'mcdonalds',
          ..._bn('Motor', 'M1', 'Production & Delivery — limited foodservice'),
          relationshipNote: 'PEP loses the McDonald\'s pour to KO but keeps Yum (Pizza Hut, Taco Bell, KFC) — the Pepsi Challenge map.' }
      ],
      competitors: [
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cola war + DSD-vs-warehouse'),
          relationshipNote: 'Direct cola rival; differentiated operating models (PEP DSD + vertical, KO concentrate + bottler). PEP wins on diversified portfolio (Frito-Lay), KO wins on cola share.' },
        { name: 'Mondelez International', ticker: 'MDLZ', cik: '0001103982', slug: 'mondelez',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — snack-aisle rival'),
          relationshipNote: 'Frito-Lay vs Oreo + Cadbury; salty-vs-sweet snack-aisle adjacency.' },
        { name: 'Kellanova', ticker: 'K', cik: '0000055067', slug: 'kellanova',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — snack-cereal rival'),
          relationshipNote: 'Pringles + Cheez-It (Kellanova) vs Lay\'s + Cheetos (Frito-Lay). Mars\'s pending acquisition of Kellanova will shift competitive dynamics.' }
      ],
      regulators: [SEC, FDA, FTC, USDA],
      auditor: auditor('KPMG'),
      executiveTeam: [
        { name: 'Ramon Laguarta', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2018, succeeded Indra Nooyi. Spanish; came up through PEP Europe + emerging markets.' },
        { name: 'Jamie Caulfield', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2024; replaced Hugh Johnston who departed for Disney.' }
      ]
    }
  },
  {
    slug: 'kraft_heinz', name: 'The Kraft Heinz Company', ticker: 'KHC', cik: '0001637459',
    sic: '2030', industry: 'Canned, Frozen & Preserved Foods', domainId: 'trade',
    domainRelevance: 'Berkshire-3G alliance creation (2015 Kraft + Heinz merger). Anchor U.S. packaged-food company (Heinz ketchup, Oscar Mayer, Kraft cheese, Philadelphia, Lunchables). Post-merger underperformance vs PEP/MDLZ; 3G zero-based-budgeting model under critical examination.',
    fn: {
      suppliers: [
        { name: 'Tyson Foods', ticker: 'TSN', cik: '0000100493', slug: 'tyson_foods',
          ..._bn('DMN', 'STRI', 'Operations — meat input'),
          relationshipNote: 'Tyson supplies pork + chicken for Oscar Mayer + Lunchables. Cross-CPG-rival relationship: Tyson is also KHC\'s direct competitor in branded packaged meats (Hillshire vs Oscar Mayer).' },
        { name: 'Crown Holdings', ticker: 'CCK', cik: '0001219601', slug: 'crown_holdings',
          ..._bn('DMN', 'S1', 'Raw Materials — cans + closures'),
          relationshipNote: 'Steel cans + lids for Heinz baked beans, Heinz ketchup-glass closures. Heinz brand legacy is the world\'s most recognizable shelf-stable container.' }
      ],
      customers: [
        WMT('Anchor mass-market account. Heinz ketchup is the highest-frequency SKU in WMT\'s grocery section by foot-traffic correlation.'),
        { name: 'The Kroger Co.', ticker: 'KR', cik: '0000056873', slug: 'kroger',
          ..._bn('Motor', 'M1', 'Production & Delivery — pure-play grocery'),
          relationshipNote: 'Kroger grocery-anchor channel; private-label expansion (Simple Truth, Private Selection) compresses KHC margin headroom.' },
        { name: 'Albertsons Companies', ticker: 'ACI', cik: '0001646972', slug: 'albertsons',
          ..._bn('Motor', 'M1', 'Production & Delivery — multi-banner grocery'),
          relationshipNote: 'Multi-banner (Safeway, Vons, Jewel-Osco, Acme). Kroger-Albertsons merger blocked 2024 — KHC\'s top-2 customers staying separate preserves KHC\'s pricing leverage.' }
      ],
      competitors: [
        { name: 'General Mills', ticker: 'GIS', cik: '0000040704', slug: 'general_mills',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — packaged-food rival'),
          relationshipNote: 'Cereal + soup adjacency; Pillsbury (GIS) vs Kraft Mac & Cheese (KHC).' },
        { name: 'Conagra Brands', ticker: 'CAG', cik: '0000023217', slug: 'conagra',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — frozen-meal rival'),
          relationshipNote: 'Frozen meals: Healthy Choice + Banquet (CAG) vs Smart Ones + Stouffer\'s alliance — direct frozen-aisle rival.' },
        { name: 'Hormel Foods', ticker: 'HRL', cik: '0000048465', slug: 'hormel',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — branded-meat rival'),
          relationshipNote: 'Spam, Skippy peanut butter, Hormel Black Label bacon vs Oscar Mayer. Both family-controlled (Hormel Foundation; KHC Berkshire+3G).' }
      ],
      regulators: [SEC, FDA, USDA, FTC],
      auditor: auditor('PricewaterhouseCoopers', '2015', 'Auditor since post-merger'),
      executiveTeam: [
        { name: 'Carlos Abrams-Rivera', role: 'CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since January 2024. Replaced Miguel Patricio; first non-3G-veteran CEO post-merger.' },
        { name: 'Andre Maciel', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2022; ex-3G + ex-AB InBev. Owns the goodwill-impairment cadence that\'s been the post-merger story.' }
      ]
    }
  },
  {
    slug: 'unilever', name: 'Unilever PLC', ticker: 'UL', cik: '0000217076',
    sic: '2840', industry: 'Soap, Cleaners & Toilet Preparations', domainId: 'trade',
    domainRelevance: 'Anglo-Dutch CPG conglomerate (Dove, Hellmann\'s, Knorr, Magnum, Axe, Vaseline, Ben & Jerry\'s). Foreign filer with NYSE ADR; SEC-disclosure regime applies. Unified single-listing structure since 2020 (former PLC + NV dual structure).',
    fn: {
      suppliers: [
        { name: 'Berry Global Group', ticker: 'BERY', cik: '0001378992', slug: 'berry_global',
          ..._bn('DMN', 'S1', 'Raw Materials — packaging substrate'),
          relationshipNote: 'Plastic packaging for Dove + Vaseline + Knorr; UL\'s sustainability commitments push BERY toward post-consumer-recycled (PCR) resin streams.' }
      ],
      customers: [
        WMT('Anchor mass-market account; Dove + Hellmann\'s + Vaseline are core. UL\'s European-style brand premium plays differently at WMT than at Boots/Tesco.'),
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Limited UL SKUs at Costco; UL\'s portfolio fits poorly with bulk-club economics (most products too premium-positioned).' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Motor', 'M1', 'Production & Delivery — e-commerce channel'),
          relationshipNote: 'Dollar Shave Club (UL acquired 2016) was UL\'s first big subscription/e-commerce play — partial template for AMZN Subscribe & Save penetration.' }
      ],
      competitors: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — multi-decade CPG rival'),
          relationshipNote: 'Largest direct rival globally. PG dominates U.S.; UL stronger in EMEA + LATAM + Asia. Different brand-equity-vs-price strategies; mostly avoid head-to-head price wars.' },
        { name: 'Colgate-Palmolive', ticker: 'CL', cik: '0000021665', slug: 'colgate_palmolive',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — personal-care overlap'),
          relationshipNote: 'Dove (UL) vs Softsoap + Irish Spring (CL) in body wash. Smaller adjacency than PG conflict but consistent.' }
      ],
      regulators: [SEC, FDA, FTC, EPA, OSHA],
      auditor: auditor('KPMG', null, 'Audits global UL group; SEC oversight via 20-F filing'),
      executiveTeam: [
        { name: 'Hein Schumacher', role: 'CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2023; ex-FrieslandCampina dairy CEO. Stepped in after Alan Jope\'s ESG-emphasis tenure underperformed.' },
        { name: 'Fernando Fernandez', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2024; previously Beauty & Wellbeing president. The Beauty unit is the highest-margin pillar; Fernandez owns the demerger of Ice Cream (Magnum + Ben & Jerry\'s separation, expected 2025).' }
      ]
    }
  },
  {
    slug: 'general_mills', name: 'General Mills, Inc.', ticker: 'GIS', cik: '0000040704',
    sic: '2040', industry: 'Grain Mill Products', domainId: 'trade',
    domainRelevance: 'Cereal + packaged-food anchor (Cheerios, Yoplait, Pillsbury, Nature Valley, Blue Buffalo, Häagen-Dazs U.S.). Pet-food (Blue Buffalo, 2018 acquisition) is fastest-growing segment.',
    fn: {
      suppliers: [
        { name: 'Archer-Daniels-Midland', ticker: 'ADM', cik: '0000007084', slug: 'adm',
          ..._bn('DMN', 'STRI', 'Operations — grain + milled inputs'),
          relationshipNote: 'Wheat, oats, corn for cereal manufacturing. ADM also handles much of GIS\'s contract milling. GIS\'s wheat-price hedging is largely ADM-mediated.' }
      ],
      customers: [
        WMT('Anchor account; Cheerios + Pillsbury + Blue Buffalo in WMT\'s pet-food aisle. Blue Buffalo distribution at WMT was the strategic rationale for the 2018 acquisition.'),
        { name: 'The Kroger Co.', ticker: 'KR', cik: '0000056873', slug: 'kroger',
          ..._bn('Motor', 'M1', 'Production & Delivery — pure-play grocery'),
          relationshipNote: 'Cheerios + Yoplait core grocery placement; Kroger\'s Simple Truth private-label cereal puts pressure on Cheerios price points.' }
      ],
      competitors: [
        { name: 'Kellanova', ticker: 'K', cik: '0000055067', slug: 'kellanova',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cereal duopoly'),
          relationshipNote: 'Cheerios vs Frosted Flakes + Special K. The cereal-aisle duopoly; Kellanova\'s 2023 split of Kellogg into snacks (Kellanova) + cereal (WK Kellogg) reshaped the rivalry.' },
        { name: 'Post Holdings', ticker: 'POST', cik: '0001530950', slug: 'post_holdings',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — value-cereal rival'),
          relationshipNote: 'Honey Bunches of Oats, Grape-Nuts, Malt-O-Meal. Smaller share but value-tier threat to Cheerios pricing.' }
      ],
      regulators: [SEC, FDA, USDA, FTC],
      auditor: auditor('KPMG'),
      executiveTeam: [
        { name: 'Jeff Harmening', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2017; Career-GIS, came up through cereal then international. Owns the Blue Buffalo acquisition + integration.' },
        { name: 'Kofi Bruce', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2020; ran GIS Latin America before. First Black CFO at GIS.' }
      ]
    }
  },
  {
    slug: 'kimberly_clark', name: 'Kimberly-Clark Corporation', ticker: 'KMB', cik: '0000055785',
    sic: '2670', industry: 'Converted Paper & Paperboard Products', domainId: 'trade',
    domainRelevance: 'Anchor personal-care paper-goods company (Kleenex, Huggies, Cottonelle, Scott, Kotex, Depend). Pulp-economics direct exposure; less-diversified vs PG.',
    fn: {
      suppliers: [
        { name: 'International Paper', ticker: 'IP', cik: '0000051434', slug: 'international_paper',
          ..._bn('DMN', 'S1', 'Raw Materials — pulp + paperboard'),
          relationshipNote: 'Hardwood + softwood pulp for tissue + diaper absorbent layers. KMB\'s margin is more pulp-cost-sensitive than PG\'s diversified portfolio — pulp price moves directly hit KMB EPS.' }
      ],
      customers: [
        WMT('Anchor mass-market account; Huggies + Kleenex + Scott. WMT\'s diaper aisle is duopoly: Huggies (KMB) + Pampers (PG); private-label Parent\'s Choice rounds out the value tier.'),
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Motor', 'M1', 'Production & Delivery — e-commerce subscription channel'),
          relationshipNote: 'Diaper + tissue is THE Subscribe & Save category — predictable replenishment makes KMB AMZN-friendly. AMZN\'s Mama Bear private-label diaper is the threat KMB watches.' },
        { name: 'HCA Healthcare', ticker: 'HCA', cik: '0000860730', slug: 'hca',
          ..._bn('Motor', 'M1', 'Production & Delivery — institutional channel'),
          relationshipNote: 'KCP (Kimberly-Clark Professional) sells washroom + healthcare paper goods to HCA hospitals + offices. Different channel economics from consumer retail.' }
      ],
      competitors: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — paper-goods duopoly'),
          relationshipNote: 'Pampers vs Huggies; Bounty vs Brawny + Scott; Charmin vs Cottonelle. Same upstream pulp economics; PG has cushion from non-paper categories, KMB doesn\'t.' }
      ],
      regulators: [SEC, FDA, EPA, OSHA],
      auditor: auditor('Deloitte & Touche'),
      executiveTeam: [
        { name: 'Mike Hsu', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2019; previously consumer-goods at PepsiCo + Kraft. Owns post-COVID volume-recovery story.' },
        { name: 'Nelson Urdaneta', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2022; ex-Coca-Cola + Mondelez. Cross-CPG finance veteran.' }
      ]
    }
  },
  {
    slug: 'colgate_palmolive', name: 'Colgate-Palmolive Company', ticker: 'CL', cik: '0000021665',
    sic: '2840', industry: 'Soap, Cleaners & Toilet Preparations', domainId: 'trade',
    domainRelevance: 'Oral-care anchor (Colgate toothpaste #1 globally), household soaps (Palmolive), pet nutrition (Hill\'s — Science Diet, Prescription Diet). Pet segment is highest-margin pillar.',
    fn: {
      suppliers: [
        { name: 'Berry Global Group', ticker: 'BERY', cik: '0001378992', slug: 'berry_global',
          ..._bn('DMN', 'S1', 'Raw Materials — packaging substrate'),
          relationshipNote: 'Toothpaste tubes + dish-soap bottles. CL\'s tube-laminate sustainability transition (recyclable mono-material tubes) is BERY-co-engineered.' }
      ],
      customers: [
        WMT('Anchor mass-market account; Colgate toothpaste + Hill\'s pet food. Hill\'s grocery-store strategy (vs Hill\'s veterinary-channel exclusive) plays especially through WMT pet aisle.'),
        { name: 'CVS Health', ticker: 'CVS', cik: '0000064803', slug: 'cvs_health',
          ..._bn('Motor', 'M1', 'Production & Delivery — drug-retail channel'),
          relationshipNote: 'Premium oral-care SKUs (Colgate Optic White, Total) capture margin at CVS that mass channel can\'t support.' },
        { name: 'Walgreens Boots Alliance', ticker: 'WBA', cik: '0001618921', slug: 'walgreens',
          ..._bn('Motor', 'M1', 'Production & Delivery — drug-retail channel'),
          relationshipNote: 'Walgreens reduction in store count (~1,200 closures by 2027) compresses CL\'s drugstore distribution surface.' }
      ],
      competitors: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — toothpaste duopoly'),
          relationshipNote: 'Crest vs Colgate is the most-studied two-firm market in U.S. CPG textbooks; combined ~85% U.S. toothpaste share. Near-symmetric on pricing, advertising spend, R&D cadence.' },
        { name: 'Unilever', ticker: 'UL', cik: '0000217076', slug: 'unilever',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — personal-care overlap'),
          relationshipNote: 'Soap + body wash adjacency; Dove (UL) vs Softsoap + Irish Spring (CL).' }
      ],
      regulators: [SEC, FDA, FTC, EPA],
      auditor: auditor('PricewaterhouseCoopers'),
      executiveTeam: [
        { name: 'Noel Wallace', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2019; first non-finance CEO at CL since 2007. Career CL — 30+ years.' },
        { name: 'Stanley Sutula', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2021; ex-IBM + Pitney Bowes. Owns the Hill\'s Pet Nutrition margin-expansion narrative.' }
      ]
    }
  },
  {
    slug: 'mondelez', name: 'Mondelez International, Inc.', ticker: 'MDLZ', cik: '0001103982',
    sic: '2090', industry: 'Food and Kindred Products', domainId: 'trade',
    domainRelevance: 'Global snack-and-confectionery (Oreo, Cadbury, Ritz, belVita, Trident, Toblerone, Milka). 2012 Kraft Foods spin-off — international + snacks were spun out, Kraft Heinz was the U.S. legacy. Cocoa + sugar commodity-price-sensitive.',
    fn: {
      suppliers: [
        { name: 'Archer-Daniels-Midland', ticker: 'ADM', cik: '0000007084', slug: 'adm',
          ..._bn('DMN', 'STRI', 'Operations — cocoa + ingredient feedstock'),
          relationshipNote: 'Cocoa + sugar + flour for Oreo, Cadbury, Toblerone. 2024 cocoa-price spike (West Africa supply shock) hit MDLZ margins severely; ADM hedging absorbs some but not all.' }
      ],
      customers: [
        WMT('Anchor mass-market account; Oreo + Ritz + Cadbury. Oreo is one of MDLZ\'s few SKUs that holds price discipline at WMT — most others get squeezed.'),
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Costco club-pack Oreo + Ritz are anchor SKUs; KS private-label cookies are direct competitive threat.' }
      ],
      competitors: [
        { name: 'The Hershey Company', ticker: 'HSY', cik: '0000047111', slug: 'hershey',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — chocolate rival in U.S.'),
          relationshipNote: 'Cadbury (MDLZ) is non-U.S.; Hershey controls Cadbury distribution rights inside the U.S. — a unique inverted-rivalry where the competitor is also a licensee.' },
        { name: 'Kellanova', ticker: 'K', cik: '0000055067', slug: 'kellanova',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — snack rival'),
          relationshipNote: 'Pringles + Cheez-It vs Ritz; pending Mars-Kellanova merger (announced 2024) reshapes snack competition map.' }
      ],
      regulators: [SEC, FDA, USDA, FTC],
      auditor: auditor('PricewaterhouseCoopers'),
      executiveTeam: [
        { name: 'Dirk Van de Put', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2017; ex-McCain Foods CEO. Belgian; international-ops orientation matches MDLZ\'s non-U.S. revenue mix.' },
        { name: 'Luca Zaramella', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2018; long Mondelez/Kraft career. Owns the post-Kraft-spinoff portfolio discipline.' }
      ]
    }
  },
  {
    slug: 'nike', name: 'NIKE, Inc.', ticker: 'NKE', cik: '0000320187',
    sic: '3021', industry: 'Rubber & Plastics Footwear', domainId: 'trade',
    domainRelevance: 'World\'s largest athletic-footwear + apparel brand by revenue. Asset-light contract-manufacturing model (95%+ outsourced to factories in Vietnam, Indonesia, China). Marketing + design + retail-relationship asymmetry is the moat.',
    fn: {
      suppliers: [],
      customers: [
        WMT('Mass-market basics + value-tier; WMT carries Nike basics + clearance/factory store inventory, NOT the full Nike Direct premium SKUs.'),
        { name: 'Foot Locker', ticker: 'FL', cik: '0000850209', slug: 'foot_locker',
          ..._bn('Motor', 'M1', 'Production & Delivery — specialty athletic-shoe channel'),
          relationshipNote: 'FL is Nike\'s most-strategic specialty wholesaler globally. Nike\'s 2017 Consumer Direct Acceleration cut FL allocations sharply; FL revenue still ~70% Nike — co-dependent in distress mode.' },
        { name: 'Dick\'s Sporting Goods', ticker: 'DKS', cik: '0001089063', slug: 'dicks_sporting_goods',
          ..._bn('Motor', 'M1', 'Production & Delivery — sporting-goods channel'),
          relationshipNote: 'DKS is Nike\'s largest U.S. wholesale account; combined Nike+Jordan ~25% of DKS sales. The "House of Sport" stores are flagship Nike-experience retail.' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Motor', 'M1', 'Production & Delivery — e-commerce channel'),
          relationshipNote: 'Nike pulled OUT of Amazon Vendor Central in 2019; resumed limited 2023. Amazon counterfeit + brand-control issue makes this a fraught channel.' }
      ],
      competitors: [
        { name: 'Under Armour', ticker: 'UAA', cik: '0001336917', slug: 'under_armour',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — performance-apparel rival'),
          relationshipNote: 'UA peaked 2015-16 then collapsed; Nike took back NCAA + NFL share. UA is now a much smaller threat than mid-2010s.' },
        { name: 'Lululemon Athletica', ticker: 'LULU', cik: '0001397187', slug: 'lululemon',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — premium-athleisure rival'),
          relationshipNote: 'LULU dominant in women\'s premium activewear (yoga + run); Nike\'s women\'s segment lags. LULU\'s growing men\'s line is the head-to-head threat.' },
        { name: 'On Holding', ticker: 'ONON', cik: '0001825436', slug: 'on_holding',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — premium-running rival'),
          relationshipNote: 'Swiss On Cloud running shoes + Roger Federer endorsement. Nike\'s premium-running share losses in 2023-24 mostly went to ONON + HOKA.' }
      ],
      regulators: [SEC, CPSC, FTC],
      auditor: auditor('PricewaterhouseCoopers'),
      executiveTeam: [
        { name: 'Elliott Hill', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since October 2024 — returned from retirement to replace John Donahoe. 32-year Nike career; viewed as the wholesale-relationship-repair pick after Donahoe-era DTC over-rotation.' },
        { name: 'Matt Friend', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2020; long Nike-finance career. Owns inventory normalization + DTC-to-wholesale rebalancing math.' }
      ]
    }
  },
  {
    slug: 'tyson_foods', name: 'Tyson Foods, Inc.', ticker: 'TSN', cik: '0000100493',
    sic: '2011', industry: 'Meat Packing Plants', domainId: 'trade',
    domainRelevance: 'Largest U.S. meat processor (chicken, beef, pork, prepared foods). Tyson family controls ~71% voting power via Class B shares. Concentrated supplier-customer position vertically integrates feed → animal → processed meat.',
    fn: {
      suppliers: [
        { name: 'Archer-Daniels-Midland', ticker: 'ADM', cik: '0000007084', slug: 'adm',
          ..._bn('DMN', 'STRI', 'Operations — animal-feed grain'),
          relationshipNote: 'Corn + soybean meal for Tyson chicken + pork feed. ADM also competes with TSN feed division — both supplier and rival.' },
        { name: 'Bunge Global', ticker: 'BG', cik: '0001144519', slug: 'bunge',
          ..._bn('DMN', 'S1', 'Raw Materials — oilseed processing'),
          relationshipNote: 'Soybean meal + protein concentrates from Bunge oilseed processing; alternative to ADM for diversification.' }
      ],
      customers: [
        WMT('Anchor account; Tyson is WMT\'s largest poultry supplier. Multi-decade relationship; WMT\'s shift to "no antibiotics ever" reshaped Tyson\'s supply chain.'),
        { name: 'McDonald\'s Corporation', ticker: 'MCD', cik: '0000063908', slug: 'mcdonalds',
          ..._bn('Motor', 'M1', 'Production & Delivery — foodservice anchor'),
          relationshipNote: 'McNuggets, McChicken, breakfast sausage — Tyson is one of three primary MCD chicken suppliers. The McNugget supply chain was retooled around Tyson processing capacity.' },
        { name: 'Yum! Brands', ticker: 'YUM', cik: '0001041061', slug: 'yum_brands',
          ..._bn('Motor', 'M1', 'Production & Delivery — KFC + Taco Bell channel'),
          relationshipNote: 'KFC chicken + Taco Bell meat. KFC\'s chicken-sandwich war has driven Tyson allocation pressure since 2019.' },
        { name: 'Sysco Corporation', ticker: 'SYY', cik: '0000096021', slug: 'sysco',
          ..._bn('Motor', 'M1', 'Production & Delivery — foodservice distribution'),
          relationshipNote: 'Largest U.S. foodservice distributor; Sysco aggregates Tyson product to independent restaurants + institutions. The B2B-distribution backbone Tyson lacks direct-to-customer.' }
      ],
      competitors: [
        { name: 'Pilgrim\'s Pride', ticker: 'PPC', cik: '0000802481', slug: 'pilgrims_pride',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — chicken-processor rival'),
          relationshipNote: 'PPC is JBS S.A.-controlled (Brazilian beef giant). Combined JBS+PPC plus Tyson dominate U.S. chicken — DOJ price-fixing investigation 2019-21 hit both.' },
        { name: 'Hormel Foods', ticker: 'HRL', cik: '0000048465', slug: 'hormel',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — branded-meat rival'),
          relationshipNote: 'Spam + Hormel Black Label vs Tyson Hillshire Farm + Jimmy Dean. HRL Foundation-controlled; smaller scale but more brand-anchored than TSN.' }
      ],
      regulators: [SEC, USDA, FDA, EPA, OSHA],
      auditor: auditor('PricewaterhouseCoopers'),
      executiveTeam: [
        { name: 'Donnie King', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2021; long Tyson career. Took over after Dean Banks\'s short tenure; non-family operator.' },
        { name: 'John R. Tyson', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2022; 4th-generation Tyson family. Family + executive overlap is a corporate-governance structure unusual in the S&P 500.' }
      ]
    }
  },
  {
    slug: 'adm', name: 'Archer-Daniels-Midland Company', ticker: 'ADM', cik: '0000007084',
    sic: '2070', industry: 'Fats & Oils', domainId: 'trade',
    domainRelevance: 'Global agricultural-commodity processor + merchant. Grains, oilseeds, sweeteners, animal nutrition, biofuels. The B2B "supermarket to the world" — anchor input supplier upstream of every CPG brand on Walmart\'s shelves.',
    fn: {
      suppliers: [],
      customers: [
        { name: 'PepsiCo', ticker: 'PEP', cik: '0000077476', slug: 'pepsico',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — anchor B2B account'),
          relationshipNote: 'Major HFCS + corn sweetener + cooking-oil customer; Frito-Lay potato + corn-flour processing partnerships. PEP\'s commodity-cost line and ADM\'s revenue line are mirror images.' },
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — HFCS anchor account'),
          relationshipNote: 'High-fructose corn syrup is the dominant U.S.-Coke sweetener (sucrose only in glass-bottle "Mexican Coke"); ADM is one of three majors (with Cargill private + Tate & Lyle).' },
        { name: 'General Mills', ticker: 'GIS', cik: '0000040704', slug: 'general_mills',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — grain-processing anchor account'),
          relationshipNote: 'Wheat + oat + corn for cereal manufacturing; ADM also handles GIS contract milling.' },
        { name: 'Tyson Foods', ticker: 'TSN', cik: '0000100493', slug: 'tyson_foods',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — animal-feed anchor account'),
          relationshipNote: 'Corn + soybean meal for poultry + pork feed. ADM\'s feed division also competes with TSN\'s vertically-integrated feed operations.' },
        { name: 'Mondelez International', ticker: 'MDLZ', cik: '0001103982', slug: 'mondelez',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — cocoa + sweetener anchor account'),
          relationshipNote: 'Cocoa + sugar processing for Oreo, Cadbury, Toblerone. ADM cocoa-trade desk is one of the world\'s largest physical cocoa traders.' },
        { name: 'The Kraft Heinz Company', ticker: 'KHC', cik: '0001637459', slug: 'kraft_heinz',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — packaged-food anchor account'),
          relationshipNote: 'Tomato paste + condiment ingredients; KHC\'s Heinz ketchup tomato-supply chain is partly ADM-mediated.' },
        { name: 'Unilever', ticker: 'UL', cik: '0000217076', slug: 'unilever',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — vegetable-oil anchor account'),
          relationshipNote: 'Vegetable oils for Hellmann\'s mayo + Knorr base; sustainable palm-oil sourcing partnership.' }
      ],
      competitors: [
        { name: 'Bunge Global', ticker: 'BG', cik: '0001144519', slug: 'bunge',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — oilseed-processing rival'),
          relationshipNote: 'BG completed Viterra merger 2024 — combined company is the largest direct rival to ADM in oilseed processing + grain trading.' }
      ],
      regulators: [SEC, USDA, EPA, CFTC],
      auditor: auditor('Ernst & Young', null, 'Auditor under restated-2023-financials regime; restatement saga is itself a §4.4-class XBRL-coverage flag'),
      executiveTeam: [
        { name: 'Juan Luciano', role: 'Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2014. Argentine; ex-Dow Chemical. Owns the Nutrition-segment-restatement crisis that\'s been the 2024 story.' },
        { name: 'Monish Patolawala', role: 'President & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'President + CFO since 2024; replaced Vikram Luthar mid-restatement. Ex-3M CFO.' }
      ]
    }
  },
  {
    slug: 'clorox', name: 'The Clorox Company', ticker: 'CLX', cik: '0000021076',
    sic: '2840', industry: 'Soap, Cleaners & Toilet Preparations', domainId: 'trade',
    domainRelevance: 'Mid-cap household-products company (Clorox bleach, Pine-Sol, Glad, Brita, Burt\'s Bees, Hidden Valley Ranch, Kingsford charcoal). Smaller scale than PG/UL but anchor in U.S. cleaning + disinfection. 2023 cyberattack disrupted production for ~6 months — operational-risk case study.',
    fn: {
      suppliers: [
        { name: 'Berry Global Group', ticker: 'BERY', cik: '0001378992', slug: 'berry_global',
          ..._bn('DMN', 'S1', 'Raw Materials — packaging substrate'),
          relationshipNote: 'Plastic bottles for bleach + Pine-Sol; trigger-spray dispensers. CLX bleach-bottle resin is a HDPE specialty grade.' }
      ],
      customers: [
        WMT('Anchor mass-market account; Clorox bleach + Pine-Sol + Glad. CLX\'s 2023 cyberattack briefly emptied WMT shelves of Clorox SKUs.'),
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Motor', 'M1', 'Production & Delivery — bulk-format channel'),
          relationshipNote: 'Costco Kingsford charcoal club packs; Brita filter multipacks. KS private-label cleaners directly compete with Pine-Sol.' },
        { name: 'The Kroger Co.', ticker: 'KR', cik: '0000056873', slug: 'kroger',
          ..._bn('Motor', 'M1', 'Production & Delivery — pure-play grocery'),
          relationshipNote: 'Cleaning-aisle anchor; Hidden Valley dressing in refrigerated section.' }
      ],
      competitors: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cleaning-aisle rival'),
          relationshipNote: 'Tide + Cascade + Mr. Clean + Dawn are PG cleaning anchors against Clorox\'s bleach-and-disinfectant focus. PG has scale advantage in laundry; CLX dominates disinfection.' }
      ],
      regulators: [SEC, EPA, FDA, OSHA],
      auditor: auditor('Ernst & Young'),
      executiveTeam: [
        { name: 'Linda Rendle', role: 'Chair & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2020; Career CLX. Owned the 2023 cyberattack response — $356M earnings hit + ~6-month production disruption.' },
        { name: 'Luc Bellet', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2024.' }
      ]
    }
  },
  // ──────────── LOGISTICS (Motor-class to Walmart) ────────────
  {
    slug: 'ups', name: 'United Parcel Service, Inc.', ticker: 'UPS', cik: '0001090727',
    sic: '4513', industry: 'Air Courier Services', domainId: 'infrastructure',
    domainRelevance: 'Largest integrated logistics + parcel network in the U.S. by volume. Ground + air + supply-chain solutions. Amazon disintermediation (in-housing) is the existential threat shrinking UPS\'s biggest single account.',
    fn: {
      suppliers: [
        { name: 'PACCAR Inc.', ticker: 'PCAR', cik: '0000075362', slug: 'paccar',
          ..._bn('DMN', 'STRI', 'Operations — heavy-truck fleet input'),
          relationshipNote: 'Kenworth + Peterbilt heavy trucks for UPS ground fleet. PCAR is roughly half of UPS\'s class-8 truck purchases (Daimler + Volvo split the rest).' },
        { name: 'The Boeing Company', ticker: 'BA', cik: '0000012927', slug: 'boeing',
          ..._bn('DMN', 'STRI', 'Operations — air-freighter fleet input'),
          relationshipNote: '767 + 747-8 freighters for UPS Worldport (Louisville). UPS is a top BA cargo customer; 747-8 freighter production line ended 2023, making UPS\'s 28-aircraft 747F fleet a closed asset class.' },
        { name: 'Exxon Mobil', ticker: 'XOM', cik: '0000034088', slug: 'exxon_mobil',
          ..._bn('DMN', 'STRI', 'Operations — fuel input'),
          relationshipNote: 'Diesel + jet fuel; UPS fuel-cost sensitivity is direct (no full hedge). Fuel surcharge passed through to customers but with lag.' }
      ],
      customers: [
        WMT('WMT contracts UPS for select last-mile + return-logistics; not WMT\'s primary parcel partner (in-house Spark Driver fills that role).'),
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — historical anchor customer, now disintermediating'),
          relationshipNote: 'AMZN was UPS\'s largest single customer (~11% of revenue at peak). Amazon Logistics in-housing has cut UPS volume; UPS\'s 2024 strategy is to "trade volume for margin."' },
        { name: 'eBay', ticker: 'EBAY', cik: '0001065088', slug: 'ebay',
          ..._bn('Motor', 'M1', 'Production & Delivery — marketplace seller channel'),
          relationshipNote: 'eBay seller-shipping channel; UPS partnership predates Amazon disintermediation playbook.' }
      ],
      competitors: [
        { name: 'FedEx Corporation', ticker: 'FDX', cik: '0001048911', slug: 'fedex',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — integrated-logistics duopoly'),
          relationshipNote: 'UPS-FedEx duopoly in U.S. integrated logistics; differentiated network architectures (UPS hub-and-spoke; FedEx point-to-point air). Combined ~80% private-parcel volume.' }
      ],
      regulators: [SEC, FAA, DOT, OSHA, FMCSA],
      auditor: auditor('Deloitte & Touche'),
      executiveTeam: [
        { name: 'Carol Tomé', role: 'CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2020; ex-Home Depot CFO. First non-UPS-veteran CEO. "Better, not bigger" strategy is the post-Amazon-disintermediation pivot.' },
        { name: 'Brian Newman', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2020; came over with Tomé from Home Depot finance.' }
      ]
    }
  },
  {
    slug: 'werner_enterprises', name: 'Werner Enterprises, Inc.', ticker: 'WERN', cik: '0000793074',
    sic: '4213', industry: 'Trucking (No Local)', domainId: 'infrastructure',
    domainRelevance: 'Mid-cap dedicated + one-way truckload carrier headquartered in Omaha. Walmart is largest single account (~10% of revenue). Family-controlled (Clarence Werner founded 1956); modest market cap (~$1-2B).',
    fn: {
      suppliers: [
        { name: 'PACCAR Inc.', ticker: 'PCAR', cik: '0000075362', slug: 'paccar',
          ..._bn('DMN', 'STRI', 'Operations — heavy-truck fleet input'),
          relationshipNote: 'Werner runs Kenworth + Peterbilt class-8 tractors. PCAR is the dominant fleet OEM for mid-cap truckload carriers.' },
        { name: 'Exxon Mobil', ticker: 'XOM', cik: '0000034088', slug: 'exxon_mobil',
          ..._bn('DMN', 'STRI', 'Operations — diesel fuel input'),
          relationshipNote: 'Diesel fuel; truckload carriers run fuel-surcharge passthroughs but margin-compressed during fuel-price spikes.' }
      ],
      customers: [
        WMT('Werner\'s LARGEST single customer — dedicated lanes, 24/7 freight to WMT\'s ~1,400 distribution centers. Werner\'s revenue volatility tracks WMT inventory cycles closely.'),
        { name: 'Dollar General', ticker: 'DG', cik: '0000029534', slug: 'dollar_general',
          ..._bn('Motor', 'M1', 'Production & Delivery — rural-format DC freight'),
          relationshipNote: 'DG\'s ~19,000-store network is freight-intensive (small loads, many stops); Werner serves DG\'s rural-format DC outbound.' }
      ],
      competitors: [
        { name: 'J.B. Hunt Transport Services', ticker: 'JBHT', cik: '0000728535', slug: 'jb_hunt',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — direct truckload + intermodal rival'),
          relationshipNote: 'JBHT is similar-sized mid-cap truckload + intermodal. Both also serve Walmart heavily; JBHT\'s intermodal segment is the differentiator Werner doesn\'t match.' },
        { name: 'Schneider National', ticker: 'SNDR', cik: '0001692063', slug: 'schneider_national',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — truckload rival'),
          relationshipNote: 'SNDR went public 2017; comparable scale to Werner.' },
        { name: 'C.H. Robinson Worldwide', ticker: 'CHRW', cik: '0001043277', slug: 'ch_robinson',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — asset-light brokerage rival'),
          relationshipNote: 'CHRW is brokerage-only (asset-light); Werner is asset-heavy. Different operating models, overlapping shipper customer bases.' }
      ],
      regulators: [SEC, DOT, FMCSA, OSHA],
      auditor: auditor('KPMG'),
      executiveTeam: [
        { name: 'Derek Leathers', role: 'Chairman, President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2019; Werner career-veteran. Combined Chair+CEO+President role is unusual at this scale.' }
      ]
    }
  },
  {
    slug: 'jb_hunt', name: 'J.B. Hunt Transport Services, Inc.', ticker: 'JBHT', cik: '0000728535',
    sic: '4213', industry: 'Trucking (No Local)', domainId: 'infrastructure',
    domainRelevance: 'Largest U.S. intermodal + dedicated-truckload carrier. Founded 1961 in Lowell, Arkansas (next to WMT). Pioneered intermodal trucking-rail integration with BNSF. Walmart is largest single account.',
    fn: {
      suppliers: [
        { name: 'PACCAR Inc.', ticker: 'PCAR', cik: '0000075362', slug: 'paccar',
          ..._bn('DMN', 'STRI', 'Operations — heavy-truck fleet input'),
          relationshipNote: 'Kenworth + Peterbilt class-8 tractors for both Hunt\'s dedicated + intermodal divisions.' },
        { name: 'Exxon Mobil', ticker: 'XOM', cik: '0000034088', slug: 'exxon_mobil',
          ..._bn('DMN', 'STRI', 'Operations — diesel fuel input'),
          relationshipNote: 'Diesel fuel; JBHT\'s intermodal segment fuels the dray operations on either end of rail.' }
      ],
      customers: [
        WMT('JBHT\'s LARGEST single customer — dedicated + intermodal. Geographic neighbor (both founded in NW Arkansas) gave JBHT a structural relationship advantage no other carrier could match.'),
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('Motor', 'M1', 'Production & Delivery — CPG inbound freight'),
          relationshipNote: 'PG\'s national CPG inbound freight to retailer DCs; JBHT intermodal service for cross-country PG flows.' },
        { name: 'Target Corporation', ticker: 'TGT', cik: '0000027419', slug: 'target',
          ..._bn('Motor', 'M1', 'Production & Delivery — DC inbound freight'),
          relationshipNote: 'Target inbound DC freight; JBHT competes with Werner for these accounts.' }
      ],
      competitors: [
        { name: 'Werner Enterprises', ticker: 'WERN', cik: '0000793074', slug: 'werner_enterprises',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — direct truckload rival'),
          relationshipNote: 'Closest match in dedicated + truckload; Werner doesn\'t do intermodal — that\'s JBHT\'s differentiator.' },
        { name: 'Old Dominion Freight Line', ticker: 'ODFL', cik: '0000878927', slug: 'old_dominion',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — LTL specialist rival'),
          relationshipNote: 'ODFL is LTL-focused (less-than-truckload); JBHT JBT segment is the comparison point. ODFL has best margins in trucking; cited as the reference operator.' }
      ],
      regulators: [SEC, DOT, FMCSA, OSHA],
      auditor: auditor('Ernst & Young'),
      executiveTeam: [
        { name: 'Shelley Simpson', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2024; long JBHT career, came up through intermodal. Replaced John Roberts (retired).' },
        { name: 'John Kuhlow', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2023.' }
      ]
    }
  },
  // ──────────── COMPETITORS (Peer to Walmart) ────────────
  {
    slug: 'costco', name: 'Costco Wholesale Corporation', ticker: 'COST', cik: '0000909832',
    sic: '5331', industry: 'Variety Stores', domainId: 'trade',
    domainRelevance: 'Membership warehouse — fundamentally different model from WMT. Fewer SKUs (~4,000 vs WMT\'s 100,000+), member fees as P&L anchor, treasure-hunt rotating merchandise, ~14% gross margin (deliberately compressed; member fee = profit). Kirkland Signature private label is ~30% of sales.',
    fn: {
      suppliers: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — anchor CPG account'),
          relationshipNote: 'PG limited-SKU club packs (Bounty, Pampers, Tide); Kirkland is direct competitor on most categories. PG-COST relationship deliberately narrow vs PG-WMT.' },
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — beverage anchor'),
          relationshipNote: 'Costco rotates KO/PEP regional exclusivity — unusual; gives COST pricing leverage.' },
        { name: 'Tyson Foods', ticker: 'TSN', cik: '0000100493', slug: 'tyson_foods',
          ..._bn('DMN', 'STRI', 'Operations — meat anchor'),
          relationshipNote: 'Costco rotisserie chicken ($4.99 hold-the-line price for 25+ years) sources from Tyson + Costco\'s own Nebraska processing plant.' }
      ],
      customers: [],
      competitors: [
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — Sam\'s Club rivalry'),
          relationshipNote: 'WMT\'s Sam\'s Club is the direct membership-warehouse rival; combined Costco + Sam\'s ~80% U.S. warehouse-club share.' },
        { name: 'BJ\'s Wholesale Club', ticker: 'BJ', cik: '0001531152', slug: 'bjs_wholesale',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — East Coast warehouse rival'),
          relationshipNote: 'BJ\'s is East-Coast-concentrated; ~225 locations vs Costco\'s ~600. Smaller scale; mostly geographic-niche.' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — bulk-online overlap'),
          relationshipNote: 'AMZN Subscribe & Save + Whole Foods + Amazon Fresh. Costco\'s membership model is structurally protected vs AMZN\'s subscription model — different value props.' }
      ],
      regulators: [SEC, FTC, USDA, FDA, OSHA],
      auditor: auditor('KPMG'),
      executiveTeam: [
        { name: 'Ron Vachris', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since January 2024; began career as Costco forklift operator. Successor to Craig Jelinek (legendary 13-year tenure).' },
        { name: 'Gary Millerchip', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2024; ex-Kroger CFO. The cross-retail finance hire.' }
      ]
    }
  },
  {
    slug: 'target', name: 'Target Corporation', ticker: 'TGT', cik: '0000027419',
    sic: '5331', industry: 'Variety Stores', domainId: 'trade',
    domainRelevance: 'Mass-market retailer with discretionary tilt vs WMT\'s consumables-heavy mix. ~1,950 stores. "Cheap chic" brand positioning, in-house designer apparel collaborations. 2022-23 inventory miscall + 2024 boycott incidents created post-COVID drawdown.',
    fn: {
      suppliers: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — household + beauty anchor'),
          relationshipNote: 'PG-TGT 2018 beauty reset elevated Olay + Native + Pantene to anchor positions; Target\'s Up & Up benchmark also shapes PG\'s pricing.' },
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('DMN', 'STRI', 'Operations — beverage anchor'),
          relationshipNote: 'KO premium-tier SKUs (Smartwater, Topo Chico, Body Armor) overweight at Target vs WMT — Target customer mix is more discretionary-friendly.' },
        { name: 'Mondelez International', ticker: 'MDLZ', cik: '0001103982', slug: 'mondelez',
          ..._bn('DMN', 'STRI', 'Operations — snack anchor'),
          relationshipNote: 'Oreo + Ritz mainline grocery; smaller share of Target sales than at WMT due to Target\'s smaller grocery footprint per store.' },
        { name: 'Nike', ticker: 'NKE', cik: '0000320187', slug: 'nike',
          ..._bn('DMN', 'STRI', 'Operations — apparel + footwear anchor'),
          relationshipNote: 'Nike basics + value-tier; Target carries below the Foot Locker / DKS premium tier.' }
      ],
      customers: [],
      competitors: [
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — closest direct overlap'),
          relationshipNote: 'WMT vs TGT is the textbook discount-vs-discretionary mass-retail duel. WMT wins on grocery + price; TGT wins on apparel + home + cheap-chic.' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — e-commerce competitor'),
          relationshipNote: 'AMZN\'s discretionary apparel + home growth directly overlaps Target\'s strongest mix.' },
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — warehouse-club overlap'),
          relationshipNote: 'COST + TGT both serve the slightly-more-affluent middle vs WMT\'s broader customer mix.' }
      ],
      regulators: [SEC, FTC, USDA, FDA, OSHA],
      auditor: auditor('Ernst & Young'),
      executiveTeam: [
        { name: 'Brian Cornell', role: 'Chair & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since 2014; ex-PepsiCo + Sam\'s Club + Michaels. Long-tenured; weathered 2017 Amazon-fear sell-off + 2022-23 inventory crisis.' },
        { name: 'Jim Lee', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2024; ex-PepsiCo CFO of North America Beverages.' }
      ]
    }
  },
  {
    slug: 'amazon', name: 'Amazon.com, Inc.', ticker: 'AMZN', cik: '0001018724',
    sic: '5961', industry: 'Catalog & Mail-Order Houses', domainId: 'technology',
    domainRelevance: 'Multi-segment hyperscaler: e-commerce retail + AWS cloud + advertising + Whole Foods + logistics + Prime Video. AWS is operating-margin engine (~60-65% of consolidated operating profit). Kernel sees consolidated retail/cloud/ads P&L.',
    fn: {
      suppliers: [
        { name: 'NVIDIA Corporation', ticker: 'NVDA', cik: '0001045810', slug: 'nvidia',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — GPU compute anchor'),
          relationshipNote: 'GPUs + accelerators for AWS AI infrastructure (P-series, G-series instances). NVDA is structural to the AWS-AI offering even as AMZN ships Trainium + Inferentia in-house chips.' },
        { name: 'Advanced Micro Devices', ticker: 'AMD', cik: '0000002488', slug: 'amd',
          ..._bn('DMN', 'STRI', 'Operations — server CPU + GPU input'),
          relationshipNote: 'EPYC server CPUs + Instinct GPUs for AWS. AMD is alternative path to NVDA dominance.' },
        { name: 'Intel Corporation', ticker: 'INTC', cik: '0000050863', slug: 'intel',
          ..._bn('DMN', 'STRI', 'Operations — legacy server CPU input'),
          relationshipNote: 'Xeon CPUs (legacy + ongoing AWS instance lines). INTC share at AWS declining as AMD + Graviton (in-house ARM) take share.' },
        { name: 'United Parcel Service', ticker: 'UPS', cik: '0001090727', slug: 'ups',
          ..._bn('Motor', 'STRI', 'Operations — external delivery (declining)'),
          relationshipNote: 'External delivery; volume declining as AMZN Logistics in-houses last-mile + middle-mile. UPS partnership now mostly returns + B2B.' }
      ],
      customers: [
        { name: 'Netflix', ticker: 'NFLX', cik: '0001065280', slug: 'netflix',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — anchor AWS account'),
          relationshipNote: 'NFLX runs nearly entirely on AWS — one of AWS\'s most-cited reference customers despite NFLX competing with Prime Video. Tolerated coopetition — fractal.' },
        { name: 'Snap Inc.', ticker: 'SNAP', cik: '0001564408', slug: 'snap',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — AWS contracted commitment'),
          relationshipNote: 'SNAP committed $2B+ AWS spend; AWS runs Snapchat infrastructure.' }
      ],
      competitors: [
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — retail e-commerce + grocery'),
          relationshipNote: 'AMZN-WMT is the central retail rivalry of the 2010s-2020s. WMT\'s in-store + online grocery vs AMZN Whole Foods + Amazon Fresh. Walmart+ vs Prime.' },
        { name: 'Microsoft Corporation', ticker: 'MSFT', cik: '0000789019', slug: 'microsoft',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cloud rivalry'),
          relationshipNote: 'Azure is AWS\'s primary cloud rival; gap closing 2022-2024. AI workloads + enterprise license bundling are MSFT\'s moves.' },
        { name: 'Alphabet Inc.', ticker: 'GOOG', cik: '0001652044', slug: 'alphabet',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — cloud + ads rival'),
          relationshipNote: 'Google Cloud + Google Ads. AMZN\'s ads business now ~$50B revenue — direct Google Search + YouTube ads competitor.' }
      ],
      regulators: [SEC, FTC],
      auditor: auditor('Ernst & Young', null, 'Auditor through FTC antitrust scrutiny + EU DSA/DMA compliance regimes'),
      executiveTeam: [
        { name: 'Andy Jassy', role: 'President & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since July 2021; built AWS from scratch. Cost-discipline + AI-investment cadence is his post-Bezos signature.' },
        { name: 'Brian Olsavsky', role: 'CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2015; long Amazon-finance career. Pre-AWS-disclosure era through hyperscaler era.' }
      ]
    }
  },
  {
    slug: 'kroger', name: 'The Kroger Co.', ticker: 'KR', cik: '0000056873',
    sic: '5411', industry: 'Retail-Grocery Stores', domainId: 'trade',
    domainRelevance: 'Largest pure-play U.S. grocer (~2,700 stores). Multi-banner format (Kroger, Ralphs, Fred Meyer, Harris Teeter, Smith\'s, King Soopers). 84.51° data-science subsidiary monetizes shopper data — increasingly important profit pillar. 2024 Albertsons merger blocked by FTC.',
    fn: {
      suppliers: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('DMN', 'mPFC', 'Brand & Identity — household + beauty anchor'),
          relationshipNote: 'PG anchors KR\'s health-beauty + cleaning aisle. KR\'s Simple Truth + Private Selection private labels compress PG\'s pricing power year over year.' },
        { name: 'Tyson Foods', ticker: 'TSN', cik: '0000100493', slug: 'tyson_foods',
          ..._bn('DMN', 'STRI', 'Operations — meat anchor'),
          relationshipNote: 'Tyson chicken + Hillshire Farm + Jimmy Dean across KR\'s ~2,700 stores; meat-aisle anchor.' },
        { name: 'The Kraft Heinz Company', ticker: 'KHC', cik: '0001637459', slug: 'kraft_heinz',
          ..._bn('DMN', 'STRI', 'Operations — packaged-food anchor'),
          relationshipNote: 'Heinz ketchup + Oscar Mayer + Kraft cheese across grocery. KR private label compresses KHC center-store share.' }
      ],
      customers: [],
      competitors: [
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — largest grocery rival'),
          relationshipNote: 'WMT is the largest grocery seller in the U.S. (~25% share); KR is largest pure-play (~10% share). Different formats but converging shopper.' },
        { name: 'Albertsons Companies', ticker: 'ACI', cik: '0001646972', slug: 'albertsons',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — direct grocer rival, attempted merger partner'),
          relationshipNote: 'Multi-banner (Safeway, Vons, Jewel-Osco, Acme). FTC blocked $24.6B Kroger-Albertsons merger 2024 — KR\'s strategic combinatorial play to match WMT scale failed.' },
        { name: 'Costco Wholesale', ticker: 'COST', cik: '0000909832', slug: 'costco',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — warehouse-club overlap'),
          relationshipNote: 'COST grocery share is rising; warehouse-club competition for fresh + bulk grocery.' },
        { name: 'Amazon', ticker: 'AMZN', cik: '0001018724', slug: 'amazon',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — Whole Foods + Amazon Fresh'),
          relationshipNote: 'AMZN\'s grocery push (Whole Foods + Amazon Fresh + Amazon Grocery convenience stores) directly threatens KR\'s premium-grocer banners.' }
      ],
      regulators: [SEC, FTC, USDA, FDA, OSHA],
      auditor: auditor('PricewaterhouseCoopers'),
      executiveTeam: [
        { name: 'Ron Sargent', role: 'Interim Chairman & CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'Interim CEO since 2025 after Rodney McMullen\'s departure. Sargent is ex-Staples CEO; KR board chair. Interim leadership during post-failed-merger reset.' },
        { name: 'Todd Foley', role: 'Interim EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'Interim CFO since 2024; long-tenured KR finance.' }
      ]
    }
  },
  {
    slug: 'dollar_tree', name: 'Dollar Tree, Inc.', ticker: 'DLTR', cik: '0000935703',
    sic: '5331', industry: 'Variety Stores', domainId: 'trade',
    domainRelevance: 'Deep-discount channel. Fixed-price ($1) heritage broken in 2021 (raised to $1.25, then multi-price tiers). 2015 Family Dollar acquisition has chronically underperformed. Family Dollar divestiture announced 2024.',
    fn: {
      suppliers: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('DMN', 'STRI', 'Operations — CPG anchor'),
          relationshipNote: 'PG limited-SKU value packs. Dollar Tree price-point constraints force PG to provide deliberately small packs that fit retail-price-tier compression.' },
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('DMN', 'STRI', 'Operations — beverage anchor'),
          relationshipNote: '12-oz cans + 16-oz singles fit DLTR\'s price-tier discipline.' }
      ],
      customers: [],
      competitors: [
        { name: 'Dollar General', ticker: 'DG', cik: '0000029534', slug: 'dollar_general',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — direct deep-discount rival'),
          relationshipNote: 'DG is rural-format-strong; DLTR is suburban-format-stronger. Combined ~35,000 stores — largest small-format discount footprint in U.S.' },
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — mass-market price competition'),
          relationshipNote: 'WMT\'s opening price points compete with DLTR for the same trips on consumables; the dollar-store channel has been stress-tested by WMT\'s deflation focus 2023-24.' },
        { name: 'Five Below', ticker: 'FIVE', cik: '0001212760', slug: 'five_below',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — discretionary-discount overlap'),
          relationshipNote: 'FIVE is teen-focused, $1-5 price-points, more discretionary than consumable.' }
      ],
      regulators: [SEC, FTC, CPSC],
      auditor: auditor('KPMG'),
      executiveTeam: [
        { name: 'Mike Creedon', role: 'CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO since November 2024. Replaced Rick Dreiling who exited the same week DLTR announced Family Dollar divestiture.' },
        { name: 'Stewart Glendinning', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2023; ex-Tyson Foods CFO. The cross-retail finance hire.' }
      ]
    }
  },
  {
    slug: 'dollar_general', name: 'Dollar General Corporation', ticker: 'DG', cik: '0000029534',
    sic: '5331', industry: 'Variety Stores', domainId: 'trade',
    domainRelevance: '~19,000 small-format stores; rural + small-town footprint underserved by big-box retail (Walmart-mile coverage gap). Consumables-heavy (~70%) with low discretionary mix. Post-COVID drawdown from inflation + over-expansion + DOJ OSHA scrutiny.',
    fn: {
      suppliers: [
        { name: 'The Procter & Gamble Company', ticker: 'PG', cik: '0000080424', slug: 'procter_gamble',
          ..._bn('DMN', 'STRI', 'Operations — CPG anchor'),
          relationshipNote: 'PG dominates DG\'s laundry + personal-care aisles; DG carries smaller sizes designed for rural budget shoppers.' },
        { name: 'The Coca-Cola Company', ticker: 'KO', cik: '0000021344', slug: 'coca_cola',
          ..._bn('DMN', 'STRI', 'Operations — beverage anchor'),
          relationshipNote: '20-oz singles + 12-pack cases — fits DG\'s value-tier consumables mix.' },
        { name: 'The Kraft Heinz Company', ticker: 'KHC', cik: '0001637459', slug: 'kraft_heinz',
          ..._bn('DMN', 'STRI', 'Operations — shelf-stable food anchor'),
          relationshipNote: 'Heinz + Kraft Mac & Cheese + Oscar Mayer in DG\'s expanded grocery sets. DG Fresh distribution-center buildout 2018-2022 was specifically to handle frozen + chilled brands like KHC.' }
      ],
      customers: [],
      competitors: [
        { name: 'Dollar Tree', ticker: 'DLTR', cik: '0000935703', slug: 'dollar_tree',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — direct deep-discount rival'),
          relationshipNote: 'DG is rural-format dominant; DLTR is suburban. Combined are the dollar-store duopoly.' },
        { name: 'Walmart Inc.', ticker: 'WMT', cik: '0000104169', slug: 'walmart',
          ..._bn('Peer', 'TPJ', 'Perspective-Taking — overlapping rural geography'),
          relationshipNote: 'DG\'s rural moat is exposed when WMT extends Walmart Express + Neighborhood Market formats into small towns.' }
      ],
      regulators: [SEC, FTC, USDA],
      auditor: auditor('Ernst & Young'),
      executiveTeam: [
        { name: 'Todd Vasos', role: 'CEO',
          ..._bn('PFC', 'FPN', 'Executive Leadership'),
          relationshipNote: 'CEO 2015-2022, returned 2023 after successor Jeff Owen\'s short tenure. Brought back to stabilize post-2022 OSHA + inventory crisis. Exemplifies "founder-class veteran returning" recovery pattern.' },
        { name: 'Kelly Dilts', role: 'EVP & CFO',
          ..._bn('PFC', 'vmPFC', 'Financial Management'),
          relationshipNote: 'CFO since 2023.' }
      ]
    }
  }
];

// FRED-series defaults per domain
const FRED_DEFAULTS = {
  trade: ['RSXFS', 'PCESV', 'CPIAUCSL', 'UMCSENT'],
  infrastructure: ['IPMAN', 'TRUCKD11', 'PPIIDC', 'GDPC1'],
  technology: ['JTU5400JOL', 'NASDAQCOM', 'GDPC1', 'CPIAUCSL'],
};

function buildJSON(c) {
  const portalAttachment =
    c.domainId === 'trade' ? 'trade-portal.html' :
    c.domainId === 'infrastructure' ? 'infrastructure-portal.html' :
    c.domainId === 'technology' ? 'technology-portal.html' :
    c.domainId + '-portal.html';
  return {
    type: 'company',
    companyId: c.slug,
    slug: c.slug,
    name: c.name,
    ticker: c.ticker,
    cik: c.cik,
    sic: c.sic,
    industry: c.industry,
    domainId: c.domainId,
    portalAttachment: portalAttachment,
    fredSeries: FRED_DEFAULTS[c.domainId] || [],
    feedSources: [],
    helixReportMode: 'validated_kernel',
    helixReportUrl: 'helix-report.html?cik=' + c.cik,
    warningSignals: [],
    opportunitySignals: [],
    financialHealth: {},
    domainRelevance: c.domainRelevance,
    portalRelevance: 'Level-2 in the Walmart functional-network tree (gen-walmart-tree-l2.js, 2026-05-10). Each entry tagged with both neuralRole and a specific brainNodeId from the 124-node LIMEN taxonomy per limen_brain_node_tracking memory — surfaces patterns where business structure rhymes with neuroanatomy in either direction.',
    notes: { generatedBy: 'gen-walmart-tree-l2.js', level: 2, parent: 'walmart' },
    intelligenceCycle: [],
    functionalNetwork: {
      model: c.name + ' as a mini-brain. Each functional-network entry carries both a high-level neuralRole AND a specific brainNodeId from the LIMEN 124-node taxonomy. Pattern transfer across business and neurology in both directions.',
      suppliers: c.fn.suppliers || [],
      customers: c.fn.customers || [],
      competitors: c.fn.competitors || [],
      regulators: c.fn.regulators || [],
      auditor: c.fn.auditor || null,
      executiveTeam: c.fn.executiveTeam || [],
      marketSignals: c.fn.marketSignals || []
    }
  };
}

let written = 0, skipped = 0;
for (const c of COMPANIES) {
  const fp = path.join(DIR, c.slug + '.json');
  if (!FORCE && fs.existsSync(fp)) {
    console.log('  skip (exists): ' + c.slug + '.json');
    skipped++;
    continue;
  }
  const json = buildJSON(c);
  if (DRY_RUN) {
    console.log('  would write: ' + c.slug + '.json (' + (JSON.stringify(json).length / 1024).toFixed(1) + ' KB)');
  } else {
    fs.writeFileSync(fp, JSON.stringify(json, null, 2));
    console.log('  wrote: ' + c.slug + '.json (' + (JSON.stringify(json, null, 2).length / 1024).toFixed(1) + ' KB)');
  }
  written++;
}

console.log('\n──── DONE ────');
console.log('Companies in table: ' + COMPANIES.length);
console.log(DRY_RUN ? '(dry run)' : 'Written: ' + written + ', Skipped existing: ' + skipped);
