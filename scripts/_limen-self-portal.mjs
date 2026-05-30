#!/usr/bin/env node
/**
 * Generate the LIMEN Helix portal so the multi-pass worker can fire
 * patent / grant / sba / franchise for the company itself.
 *
 * Uses a synthetic CIK 0000000999 (real LIMEN is privately held —
 * Transformational Sciences LLC, no SEC filing). The portal carries
 * the kernel + spider-web invention + business model anchors.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';

const TARGET = {
  slug: 'limen_helix',
  cik: '0000000999',
  ticker: null,
  name: 'LIMEN Helix Transformational Sciences LLC',
  domainId: 'intelligence',
  industry: 'Phase-conditioned financial-intelligence platform — validated kernel for distress prediction + fractal spider-web stress propagation + six-engine artifact generation (patent / grant / SBA / franchise / investment / research)',
  instructions: "LIMEN Helix Transformational Sciences LLC is a private Delaware LLC (formed 2024) building a phase-conditioned financial-intelligence platform. The platform validates company distress via an 11-phase kernel (Things 1+2 polyvagal coupling, Pass 3B counterparty propagation) and produces six classes of READY_TO_SIGN regulatory + financial artifacts (patent, grant, SBA loan package, franchise FDD, investment thesis, research brief). Real production data as of 2026-05-21: 275+ v2.0.1 fractal portals at 91% reciprocity (Walmart pilot validated 6/6 lanes), Pass 3B counterparties wired live for cohort-drag + supplier-rupture + lender-distress phase bias, auto-rescoring every 3 min, neurological sleep-cycle worker hourly. TIGHT counts: suppliers 8 (Anthropic Claude Sonnet 4.6 + Haiku 4.5 LLM backbone, Vercel for serverless hosting + cron + edge, Upstash for Redis state, GitHub for source + auto-deploy, AWS SEC EDGAR data ingest, FRED economic-data feed via St. Louis Fed, Bloomberg LP terminal for institutional sales channel, Tableau + Plotly visualization libs), customers 4 (financial-services institutions licensing kernel + portal data via API for distress monitoring, family offices + RIAs for portfolio risk overlay, public-policy researchers for cohort-stress monitoring, federal/state economic-development agencies for industry-distress early-warning), competitors 5 (Moody's MCO + S&P SPGI traditional credit ratings, Palantir PLTR Foundry + AIP defense + commercial intel, Bloomberg LP + Refinitiv institutional data terminals, Verisk VRSK insurance + risk analytics, Riskonnect + LogicGate private ERM platforms), regulators 5 (USPTO for patent prosecution under 37 CFR §§1.71-1.78 + MPEP §608, NIH SF-424 R&R + NSF PAPPG + USDA NIFA for grant submissions, SBA Office of Capital Access + SOP 50 10 7.1 + Form 1919 for 7(a) loan applications, FTC 16 CFR Part 436 for FDD if franchising, SEC 10-K + 13F if going public). 55-65w with concrete platform metrics + counterparty names anchored."
};

async function main() {
  const headers = { 'content-type': 'application/json' };
  if (TOKEN) headers.authorization = 'Bearer ' + TOKEN;

  console.log('=== authoring LIMEN Helix self-portal ===');
  const r = await fetch(BASE + '/api/enrich-portal-claude', {
    method: 'POST', headers,
    body: JSON.stringify({ target: TARGET, maxTokens: 15000 })
  });
  const j = await r.json();
  if (!j.ok) {
    console.log('FAIL:', JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  await fs.writeFile(
    path.join('assets/data/companies', TARGET.slug + '.json'),
    JSON.stringify(j.portal, null, 2)
  );
  const dr = j.densityReport || {};
  console.log('  OK ' + dr.functionalNetworkTotal + ' entries  anchored=' + dr.anchoredRate);
  console.log('  wrote: assets/data/companies/' + TARGET.slug + '.json');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
