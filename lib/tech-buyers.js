/**
 * lib/tech-buyers.js — the paying side for the TECHNOLOGY distress feed. Who buys early notice that a
 * tech company is shedding staff or winding down, matched to the distress STAGE:
 *  - shutdown / mass  -> IP & asset buyers + wind-down advisors + software rollups (buy the carcass:
 *    patents, code, domains, customer base, or the whole distressed product).
 *  - major / layoff   -> software rollups + acqui-hire / talent buyers (the company survives but is
 *    cutting; the asset is the freed team or an undervalued line).
 * Data, not brokerage — no closer/license problem. Sold as a subscription / per-signal feed.
 */
'use strict';
var BUYERS = [
  { name: 'Sherwood Partners', type: 'Wind-down / ABC advisor', stages: ['shutdown', 'mass'], note: 'Assignment-for-benefit-of-creditors + asset sales for failing tech', url: 'https://www.sherwoodpartners.com/' },
  { name: 'Gerbsman Partners', type: 'Distressed IP / asset sales', stages: ['shutdown', 'mass'], note: 'Sells IP, patents, and assets of shutting-down tech companies', url: 'https://gerbsmanpartners.com/' },
  { name: 'Hilco Streambank', type: 'IP / brand / domain buyer', stages: ['shutdown', 'mass', 'major'], note: 'Acquires + monetizes IP, brands, domains from distressed tech', url: 'https://www.hilcostreambank.com/' },
  { name: 'RPX Corporation', type: 'Patent buyer', stages: ['shutdown', 'mass'], note: 'Buys patents from failing / downsizing tech', url: 'https://www.rpxcorp.com/' },
  { name: 'Ocean Tomo (J.S. Held)', type: 'IP merchant bank', stages: ['shutdown', 'mass'], note: 'IP valuation + transactions for distressed portfolios', url: 'https://www.oceantomo.com/' },
  { name: 'Constellation Software', type: 'Vertical-software rollup', stages: ['shutdown', 'mass', 'major'], note: 'Acquires distressed / orphaned B2B software', url: 'https://www.csisoftware.com/' },
  { name: 'Valsoft', type: 'Vertical-software rollup', stages: ['mass', 'major'], note: 'Buys niche software businesses, incl. distressed', url: 'https://www.valsoftcorp.com/' },
  { name: 'SureSwift Capital', type: 'SaaS acquirer', stages: ['mass', 'major', 'layoff'], note: 'Acquires small SaaS from founders winding down', url: 'https://sureswiftcapital.com/' },
  { name: 'Tiny', type: 'Internet-business holding co', stages: ['mass', 'major', 'layoff'], note: 'Buys profitable / recoverable internet businesses', url: 'https://www.tiny.com/' },
  { name: 'Industry Ventures', type: 'VC secondaries', stages: ['mass', 'major'], note: 'Buys secondary positions in distressed venture-backed cos', url: 'https://www.industryventures.com/' },
  { name: 'Acqui-hire / talent desks', type: 'Talent acquirer', stages: ['major', 'layoff'], note: 'Strategic acquirers + recruiters targeting freed engineering teams', url: 'https://layoffs.fyi/' }
];
function matchBuyersFor(signalType) {
  return BUYERS.filter(function (b) { return b.stages.indexOf(signalType) >= 0; })
    .map(function (b) { return { name: b.name, type: b.type, note: b.note, url: b.url }; });
}
module.exports = { BUYERS: BUYERS, matchBuyersFor: matchBuyersFor };
