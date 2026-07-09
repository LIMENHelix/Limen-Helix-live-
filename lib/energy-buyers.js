/**
 * lib/energy-buyers.js — the paying side for the ENERGY distressed-asset feed. Who pays for early
 * notice of a retiring generator, matched to the fuel/stage. The prize is usually the site's LIVE GRID
 * INTERCONNECTION (years of queue time + study cost already sunk) — worth far more than the scrap:
 *  - coal / gas / petroleum -> REPOWERING developers (battery, solar) + infrastructure/PE funds that
 *    want the ready interconnection and the site.
 *  - nuclear -> DECOMMISSIONING specialists + site remediation.
 *  - any -> distressed-energy funds, site/land buyers.
 * Data / brokerage, own nothing.
 */
'use strict';
var BUYERS = [
  { name: 'NextEra Energy Resources', type: 'Repowering developer (solar/storage)', fuels: ['coal', 'gas', 'petroleum', 'other'], note: 'Largest US renewables developer; wants ready interconnection', url: 'https://www.nexteraenergyresources.com/' },
  { name: 'Plus Power', type: 'Standalone storage developer', fuels: ['coal', 'gas', 'petroleum', 'other'], note: 'Battery projects sited on retiring-plant interconnections', url: 'https://www.pluspower.com/' },
  { name: 'Avantus', type: 'Utility-scale solar + storage', fuels: ['coal', 'gas', 'other'], note: 'Solar/storage seeking interconnection-ready sites', url: 'https://www.avantus.com/' },
  { name: 'Brookfield Renewable', type: 'Renewable infrastructure fund', fuels: ['coal', 'gas', 'petroleum', 'nuclear', 'other'], note: 'Buys/repowers generation + transmission assets', url: 'https://www.brookfield.com/our-businesses/renewable-power-transition' },
  { name: 'Ares Infrastructure Opportunities', type: 'Infrastructure PE', fuels: ['coal', 'gas', 'petroleum', 'other'], note: 'Distressed / transition energy asset capital', url: 'https://www.aresmgmt.com/' },
  { name: 'Rockland Capital', type: 'Special-situations power PE', fuels: ['coal', 'gas', 'petroleum', 'other'], note: 'Acquires distressed / transitioning power assets', url: 'https://www.rocklandcapital.com/' },
  { name: 'EIG', type: 'Energy infrastructure investor', fuels: ['gas', 'petroleum', 'nuclear', 'other'], note: 'Energy-sector distressed / structured capital', url: 'https://eigpartners.com/' },
  { name: 'NorthStar Group Services', type: 'Decommissioning + demolition', fuels: ['nuclear', 'coal', 'gas', 'petroleum'], note: 'Plant decommissioning, dismantlement, remediation', url: 'https://www.nsgs.com/' },
  { name: 'EnergySolutions', type: 'Nuclear decommissioning', fuels: ['nuclear'], note: 'Reactor decommissioning + waste handling', url: 'https://www.energysolutions.com/' },
  { name: 'Charah Solutions', type: 'Coal-site remediation', fuels: ['coal'], note: 'Ash management + retired coal-site redevelopment', url: 'https://www.charah.com/' }
];
function matchBuyersFor(signalType) {
  return BUYERS.filter(function (b) { return b.fuels.indexOf(signalType) >= 0; })
    .map(function (b) { return { name: b.name, type: b.type, note: b.note, url: b.url }; });
}
module.exports = { BUYERS: BUYERS, matchBuyersFor: matchBuyersFor };
