/**
 * lib/buyers.js — disposition side. Public cash-buyer / iBuyer / SFR-fund buy-boxes.
 * A deal that fits a box = someone to assign or sell it to. We own nothing; a licensed
 * human executes the contract/assignment. Shared by handlers/deal-engine.js + homestead.js.
 */
'use strict';
var BUYERS = [
  { name: 'HomeVestors (We Buy Ugly Houses)', type: 'Cash buyer', states: 'ALL', min: 20000, max: 400000, minBeds: 0, note: 'Any condition, fast cash, national franchises', url: 'https://www.homevestors.com/sell-your-house/' },
  { name: 'Sundae', type: 'Cash marketplace', states: ['AZ', 'CA', 'CO', 'FL', 'GA', 'NV', 'SC', 'TN', 'TX', 'UT', 'WA'], min: 30000, max: 600000, minBeds: 0, note: 'As-is marketplace, multiple investor bids', url: 'https://sundae.com/sell/' },
  { name: 'Invitation Homes', type: 'SFR fund', states: ['AZ', 'CA', 'CO', 'FL', 'GA', 'IL', 'MN', 'NV', 'NC', 'SC', 'TN', 'TX', 'WA'], min: 180000, max: 500000, minBeds: 3, note: 'Buy-and-hold SFR, Sun Belt, rent-ready or light rehab', url: 'https://www.invitationhomes.com/' },
  { name: 'American Homes 4 Rent', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV', 'OH', 'IN', 'OK', 'AL', 'MO'], min: 140000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.amh.com/' },
  { name: 'Progress Residential', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV', 'AL', 'IN', 'OH', 'OK'], min: 130000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold, Sun Belt', url: 'https://rentprogress.com/' },
  { name: 'Tricon Residential', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV'], min: 180000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.triconresidential.com/' },
  { name: 'FirstKey Homes', type: 'SFR fund', states: ['AL', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'OH', 'IN', 'OK', 'MO'], min: 100000, max: 350000, minBeds: 3, note: 'SFR buy-and-hold, Southeast/Midwest', url: 'https://firstkeyhomes.com/' },
  { name: 'Amherst / Main Street Renewal', type: 'SFR fund', states: ['AL', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'OH', 'IN', 'OK', 'MO', 'AZ'], min: 100000, max: 350000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.amherst.com/' },
  { name: 'Opendoor', type: 'iBuyer', states: ['AZ', 'TX', 'FL', 'GA', 'NC', 'SC', 'TN', 'NV', 'CO', 'UT', 'OH'], min: 100000, max: 600000, minBeds: 2, note: 'Instant offer, near-market condition preferred', url: 'https://www.opendoor.com/sell' },
  { name: 'Offerpad', type: 'iBuyer', states: ['AZ', 'TX', 'FL', 'GA', 'NC', 'SC', 'TN', 'NV', 'CO', 'AL'], min: 100000, max: 500000, minBeds: 2, note: 'Instant offer, lighter rehab', url: 'https://www.offerpad.com/' }
];
function matchBuyersFor(state, price, beds) {
  var bd = (beds == null || beds === '') ? null : (parseInt(beds, 10) || 0);
  price = price || 0;
  return BUYERS.filter(function (b) {
    var stOk = b.states === 'ALL' || b.states.indexOf(state) !== -1;
    var priceOk = price >= b.min && price <= b.max;
    var bedsOk = !b.minBeds || bd == null || bd >= b.minBeds;
    return stOk && priceOk && bedsOk;
  }).map(function (b) { return { name: b.name, type: b.type, note: b.note, url: b.url }; });
}
module.exports = { BUYERS: BUYERS, matchBuyersFor: matchBuyersFor };
