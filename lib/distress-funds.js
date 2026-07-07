/**
 * lib/distress-funds.js — the paying side for the FINANCE distress feed. These are who buys the
 * intelligence (a subscription / per-signal), matched to the distress STAGE: restructuring advisors
 * and distressed-debt buyers pile in at/after a bankruptcy or default; special-situations PE wants
 * the EARLIER going-concern / delisting signal (pre-bankruptcy rescue capital). Data, not brokerage.
 */
'use strict';
var FUNDS = [
  { name: 'Oaktree Capital', type: 'Distressed-debt fund', stages: ['bankruptcy', 'default', 'delisting', 'goingconcern'], note: 'Buys distressed debt / DIP financing', url: 'https://www.oaktreecapital.com/' },
  { name: 'Silver Point Capital', type: 'Distressed-debt fund', stages: ['bankruptcy', 'default'], note: 'Distressed debt / claims', url: 'https://www.silverpointcapital.com/' },
  { name: 'Apollo (Hybrid Value)', type: 'Special situations', stages: ['default', 'delisting', 'goingconcern'], note: 'Rescue capital, distressed credit', url: 'https://www.apollo.com/' },
  { name: 'Cerberus Capital', type: 'Distressed / turnaround PE', stages: ['bankruptcy', 'default', 'goingconcern'], note: 'Distressed control investing', url: 'https://www.cerberus.com/' },
  { name: 'Centerbridge Partners', type: 'Special situations', stages: ['default', 'delisting', 'goingconcern'], note: 'Distressed + control', url: 'https://www.centerbridge.com/' },
  { name: 'Alvarez & Marsal', type: 'Restructuring advisor', stages: ['bankruptcy', 'default', 'nonreliance', 'goingconcern'], note: 'Turnaround + interim management', url: 'https://www.alvarezandmarsal.com/' },
  { name: 'AlixPartners', type: 'Restructuring advisor', stages: ['bankruptcy', 'default', 'goingconcern'], note: 'Turnaround advisory', url: 'https://www.alixpartners.com/' },
  { name: 'FTI Consulting', type: 'Restructuring advisor', stages: ['bankruptcy', 'default', 'nonreliance', 'goingconcern'], note: 'Corporate finance / restructuring', url: 'https://www.fticonsulting.com/' },
  { name: 'Houlihan Lokey', type: 'Restructuring banker', stages: ['bankruptcy', 'default', 'goingconcern'], note: 'Top restructuring advisor', url: 'https://www.hl.com/' },
  { name: 'PJT Partners (RSSG)', type: 'Restructuring banker', stages: ['bankruptcy', 'default'], note: 'Restructuring & special situations', url: 'https://www.pjtpartners.com/' },
  { name: 'Hilco Global', type: 'Asset liquidator', stages: ['bankruptcy'], note: 'Asset monetization in/near Ch.11', url: 'https://www.hilcoglobal.com/' }
];
function matchFundsFor(signalType) {
  return FUNDS.filter(function (f) { return f.stages.indexOf(signalType) >= 0; })
    .map(function (f) { return { name: f.name, type: f.type, note: f.note, url: f.url }; });
}
module.exports = { FUNDS: FUNDS, matchFundsFor: matchFundsFor };
