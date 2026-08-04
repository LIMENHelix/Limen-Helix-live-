/**
 * brain-v2/bind/economy.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, taken from the exact `economy: buildDomain('economy', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning below was read out of the fetcher
 * that produces it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO DECLARED RELATIONSHIPS, AND THAT IS A RESULT RATHER THAN AN OMISSION.
 *
 * A relationship claims two channels observe ONE latent, and it has to hold on the
 * statistic, the units, the geography and the TIME HORIZON. One pair here looked
 * obviously relatable and is not:
 *
 *   FRED CPI            monthly change in CPIAUCSL, computed from the latest two
 *                       observations — a month-over-month percentage
 *   World Bank Inflation FP.CPI.TOTL.ZG, US CPI ANNUAL % YoY, stamped with a YEAR
 *
 * Both are "US CPI inflation" in words. They are a monthly delta and an annual rate,
 * which are different quantities that happen to share a name, and relating them would
 * have divergence grading a gap that exists by construction. Nothing else in this list
 * measures the same statistic as anything else: a debt stock, a deficit flow and a cash
 * balance are three different quantities about the same government.
 *
 * So this domain declares none. `factory.js` accepts that, `divergence.js` has nothing
 * to skip, and no dead letter is created. The alternative — declaring a plausible pair
 * to avoid an empty list — is exactly the fabrication the latent requirement exists to
 * prevent.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

/**
 * q/r are SET, not fitted [mark: prior]. r is lowest for a published rate or price, higher
 * for a survey index, highest for a document count — a count of filings is a far noisier
 * read of the economy than an overnight rate. core/channel.js derives both from each
 * channel's own innovations once enough accumulate, and abstains until then.
 *
 * `recordedField` is 'v' throughout: every fetcher below returns its number as `value`,
 * which handlers/feed-record.js stores as `v`. None is an RSS recency count.
 */
var CHANNELS = [
  // ── Prices and rates: real published quantities. ──
  { key: 'cpi',          name: 'FRED CPI',                recordedField: 'v', field: 'value', source: 'FRED CPIAUCSL, latest two observations',   cadenceMs: MONTH, units: '% change month over month', q: 0.02, r: 0.06 },
  { key: 'foodCpi',      name: 'FRED Food CPI',           recordedField: 'v', field: 'value', source: 'FRED food CPI series',                     cadenceMs: MONTH, units: '% change',                 q: 0.02, r: 0.06 },
  { key: 'gasPrice',     name: 'FRED Gas Price',          recordedField: 'v', field: 'value', source: 'FRED gasoline price series',               cadenceMs: DAY,   units: '$/gallon',                 q: 0.02, r: 0.05 },
  { key: 'effr',         name: 'NY Fed EFFR',             recordedField: 'v', field: 'value', source: 'NY Fed markets API, effective fed funds',  cadenceMs: DAY,   units: '% overnight',              q: 0.01, r: 0.04 },
  { key: 'sentiment',    name: 'FRED Consumer Sentiment', recordedField: 'v', field: 'value', source: 'FRED consumer sentiment index',            cadenceMs: MONTH, units: 'index points',             q: 0.03, r: 0.10 },
  { key: 'payrolls',     name: 'BLS Employment',          recordedField: 'v', field: 'value', source: 'BLS nonfarm payroll series',               cadenceMs: MONTH, units: 'thousands of jobs',        q: 0.02, r: 0.08 },

  // ── Fiscal quantities. Three different measures of one government, not one measure. ──
  { key: 'deficit',      name: 'Treasury MTS',            recordedField: 'v', field: 'value', source: 'Treasury Monthly Treasury Statement',      cadenceMs: MONTH, units: '$ billions (deficit)',     q: 0.02, r: 0.08 },
  { key: 'cashBalance',  name: 'Treasury Cash Balance',   recordedField: 'v', field: 'value', source: 'Treasury operating cash balance',          cadenceMs: DAY,   units: '$ billions',               q: 0.03, r: 0.08 },
  { key: 'debt',         name: 'Treasury Debt Outstanding', recordedField: 'v', field: 'value', source: 'Treasury fiscaldata debt_outstanding',   cadenceMs: DAY,   units: '$ trillions',              q: 0.005, r: 0.03 },

  // ── Annual World Bank indicators. Stamped with a YEAR: far slower than everything above. ──
  { key: 'gdpGrowth',    name: 'World Bank GDP Growth',   recordedField: 'v', field: 'value', source: 'World Bank NY.GDP.MKTP.KD.ZG, USA',        cadenceMs: YEAR,  units: '% annual growth',          q: 0.01, r: 0.10 },
  { key: 'wbInflation',  name: 'World Bank Inflation',    recordedField: 'v', field: 'value', source: 'World Bank FP.CPI.TOTL.ZG, USA',           cadenceMs: YEAR,  units: '% annual, year over year', q: 0.01, r: 0.10 },

  /* PUBLICATION COUNTS. Real numbers, but counts of documents rather than measures of the
     economy. Units say so, and no finding is built on them. */
  { key: 'fedRegFed',    name: 'Fed Reg Fed Reserve',     recordedField: 'v', field: 'value', source: 'federalregister.gov, Federal Reserve, 30d', cadenceMs: DAY,  units: 'documents in 30d',         q: 0.04, r: 0.18 },
  { key: 'fedRegTreas',  name: 'Fed Reg Treasury',        recordedField: 'v', field: 'value', source: 'federalregister.gov, Treasury, 30d',        cadenceMs: DAY,  units: 'documents in 30d',         q: 0.04, r: 0.18 },
  { key: 'fedRegIrs',    name: 'Fed Reg IRS',             recordedField: 'v', field: 'value', source: 'federalregister.gov, IRS, 30d',             cadenceMs: DAY,  units: 'documents in 30d',         q: 0.04, r: 0.18 },

  /* A NET KEYWORD SCORE, not a measurement. The fetcher counts hawkish and dovish terms
     across Fed press releases and returns the difference, so it moves with how the Fed
     writes as much as with what it decides. Declared because it is in the domain's source
     list; excluded from every finding for the same reason the keyword counts are. */
  { key: 'fedBias',      name: 'Fed Monetary Press',      recordedField: 'v', field: 'value', source: 'Federal Reserve press releases, hawkish minus dovish term count', cadenceMs: DAY, units: 'net term count', q: 0.06, r: 0.25 }
];

var SIGMA = 2.0;   // [mark: prior] — same threshold the core detector uses, stated once

/**
 * FINDINGS. Only on channels that are a direct measured quantity, and only as a departure
 * from that channel's OWN baseline — never a level judgement, which would need a
 * threshold nobody here can defend. Nothing is built on a document count or the net term
 * score: those move when an agency publishes, which is a fact about publishing.
 */
var FINDINGS = [
  { id: 'PRICE_SHOCK', requires: ['cpi'],
    basis: 'monthly CPI change departing its own baseline by >=2sd',
    test: function (v, s, d) { return d.cpi && Math.abs(d.cpi.z) >= SIGMA; } },

  { id: 'POLICY_RATE_MOVE', requires: ['effr'],
    basis: 'effective fed funds rate departing its own baseline',
    test: function (v, s, d) { return d.effr && Math.abs(d.effr.z) >= SIGMA; } },

  { id: 'FUEL_PRICE_MOVE', requires: ['gasPrice'],
    basis: 'retail gasoline price departing its own baseline',
    test: function (v, s, d) { return d.gasPrice && Math.abs(d.gasPrice.z) >= SIGMA; } },

  { id: 'LABOUR_MARKET_SHIFT', requires: ['payrolls'],
    basis: 'nonfarm payrolls departing their own baseline',
    test: function (v, s, d) { return d.payrolls && Math.abs(d.payrolls.z) >= SIGMA; } },

  { id: 'FISCAL_STRESS', requires: ['deficit', 'cashBalance'],
    basis: 'the monthly deficit and the operating cash balance both departing their own baselines — two different fiscal quantities moving together, which one of them alone cannot show',
    test: function (v, s, d) {
      return d.deficit && d.cashBalance && Math.abs(d.deficit.z) >= SIGMA && Math.abs(d.cashBalance.z) >= 1.0;
    } },

  { id: 'SYSTEMIC_ECONOMIC_STRESS', requires: ['cpi', 'effr'],
    basis: 'the fused domain state itself past 2sd, with a price and a rate both live',
    test: function (v, s, d) { return typeof s.departure === 'number' && Math.abs(s.departure) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  domain: 'economy',
  version: 'brain-v2/0.1.0-economy',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. See the header: no two of these measure the same statistic on the same horizon. */
  relationships: [],
  efferent: null   // R7: nothing consumes this domain's output yet, and it says so
});
