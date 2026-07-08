/**
 * lib/plaintiff-firms.js — the paying side for the MEDICINE distress feed. Mass-tort / plaintiff firms
 * buy early notice of a monetizable drug/device safety failure (a Class I/II recall or adverse-event
 * pattern) so they can qualify + sign claimants before competitors. Legal lead-gen is a multi-billion
 * market; firms pay $500-3000+ per signed qualified case. We sell the SIGNAL (data), not the case.
 *
 * Matched by product type + severity: the big national drug/device tort firms take Class I / tort-
 * pattern recalls; device-focused firms take device recalls. `stages` = signalType keys from medicine.js.
 */
'use strict';
var FIRMS = [
  { name: 'Morgan & Morgan', type: 'National mass-tort', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Largest US plaintiff firm; heavy mass-tort intake', url: 'https://www.forthepeople.com/' },
  { name: 'Beasley Allen', type: 'Mass-tort drug/device', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Major pharma + device MDL firm', url: 'https://www.beasleyallen.com/' },
  { name: 'Weitz & Luxenberg', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Drug/device + toxic tort', url: 'https://www.weitzlux.com/' },
  { name: 'Baron & Budd', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Pharmaceutical + product liability', url: 'https://baronandbudd.com/' },
  { name: 'Motley Rice', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI'], note: 'Catastrophic drug/device litigation', url: 'https://www.motleyrice.com/' },
  { name: 'Simmons Hanly Conroy', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Pharma + medical device', url: 'https://www.simmonsfirm.com/' },
  { name: 'Aylstock, Witkin, Kreis & Overholtz', type: 'Device-focused mass-tort', kinds: ['device', 'drug'], stages: ['classI', 'classII'], note: 'Leadership counsel on many device MDLs', url: 'https://www.awkolaw.com/' },
  { name: 'Levin Papantonio', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI'], note: 'Pharmaceutical injury litigation', url: 'https://www.levinlaw.com/' },
  { name: 'Lieff Cabraser', type: 'Plaintiff class/MDL', kinds: ['drug', 'device'], stages: ['classI', 'classII'], note: 'Class action + MDL leadership', url: 'https://www.lieffcabraser.com/' },
  { name: 'Robins Kaplan', type: 'Mass-tort', kinds: ['drug', 'device'], stages: ['classI'], note: 'Complex drug/device litigation', url: 'https://www.robinskaplan.com/' }
];
function matchFirmsFor(signalType, productType) {
  return FIRMS.filter(function (f) {
    if (f.stages.indexOf(signalType) < 0) return false;
    if (productType && f.kinds.indexOf(productType) < 0) return false;
    return true;
  }).map(function (f) { return { name: f.name, type: f.type, note: f.note, url: f.url }; });
}
module.exports = { FIRMS: FIRMS, matchFirmsFor: matchFirmsFor };
