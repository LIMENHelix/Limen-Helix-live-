/**
 * lib/homestead-read.js / educational Homestead stage clock and options map.
 *
 * This is NOT a property-record search and it NEVER invents an auction date.
 * Stage comes from what the visitor said they received (or "unsure"). Place
 * comes from a public ZIP/address lookup. Official links are static and named.
 */
'use strict';

var STAGES = ['pre_nod', 'nod', 'auction_scheduled', 'sold', 'unknown'];

var NOTICE_TO_STAGE = {
  none: 'pre_nod',
  late: 'pre_nod',
  nod: 'nod',
  sale: 'auction_scheduled',
  sold: 'sold',
  unsure: 'unknown'
};

var STAGE_COPY = {
  pre_nod: {
    label: 'Pre-NOD',
    plain: 'Late or nothing filed yet. People in this band usually still have time to talk to the lender and a housing counselor before a formal default notice.',
    clock: 'Before a Notice of Default (or your state’s equivalent) is recorded.'
  },
  nod: {
    label: 'Notice of Default',
    plain: 'A formal default notice is typically the public start of foreclosure. Dates on that notice come from the lender and the county, not from us.',
    clock: 'After a Notice of Default (or equivalent) and before a sale is set.'
  },
  auction_scheduled: {
    label: 'Auction scheduled',
    plain: 'A sale has been noticed. We will not guess that date. Read the notice you received and the county’s official sale list.',
    clock: 'A sale notice exists. Confirm the date on official county paper only.'
  },
  sold: {
    label: 'Sold',
    plain: 'The property may already have transferred. Confirm with the county recorder. Surplus funds, eviction timelines, and next housing are county-specific.',
    clock: 'After a completed sale or trustee/sheriff transfer.'
  },
  unknown: {
    label: 'Educational overview',
    plain: 'We do not have a notice type from you, so this is the four-stage map, not a claim about this address.',
    clock: 'No property-level stage. Educational only.'
  }
};

var OPTIONS = {
  pre_nod: [
    { t: 'Call the servicer', d: 'Ask for loss-mitigation / hardship options in writing. Get the name of who you spoke to.' },
    { t: 'HUD housing counselor', d: 'A HUD-approved counselor is free and is not trying to buy the house. Start at hud.gov/findacounselor.' },
    { t: 'Budget the arrears', d: 'Write down what is owed, when it started, and what you can actually pay this month.' },
    { t: 'Read your state’s official help page', d: 'Attorney-general and housing-finance pages below. Those are the rules that apply where you live.' },
    { t: 'Do not ignore certified mail', d: 'A missed notice is how people lose the window to respond. Open it and keep a copy.' }
  ],
  nod: [
    { t: 'Read the notice with a counselor', d: 'The dates that matter are printed on the notice and at the county recorder, not on this page.' },
    { t: 'Ask the servicer what cures default', d: 'Reinstatement, repayment, modification, or a short sale. Get the numbers in writing.' },
    { t: 'Confirm recording at the county', d: 'Search the recorder / clerk site for your name and parcel. We do not invent that record.' },
    { t: 'Legal help if you need it', d: 'Legal aid and the state bar lawyer-referral line. This page is not legal advice.' },
    { t: 'Watch this ZIP', d: 'Leave an email. We will not pretend we already have live desk alerts.' }
  ],
  auction_scheduled: [
    { t: 'Confirm the sale on the official list', d: 'County auction / sheriff / trustee calendar. If a date is not on that list, it is not a date we will print.' },
    { t: 'HUD counselor, same day', d: 'Last-chance options (reinstatement, sale, bankruptcy referral) belong with a counselor or an attorney, not a chatbot.' },
    { t: 'Do not pay a “we can stop the sale” stranger', d: 'Rescue scams spike at this stage. Official counselors do not demand an upfront fee to “erase” a foreclosure.' },
    { t: 'If you will sell, get a real listing path', d: 'A conventional sale before auction is often what people mean by “sell before auction.” A licensed broker closes it.' },
    { t: 'Document everything', d: 'Keep the sale notice, envelopes, and every servicer letter. Dates come from those papers.' }
  ],
  sold: [
    { t: 'Confirm the transfer at the recorder', d: 'A completed sale shows up as a deed or certificate. We will not guess that it happened.' },
    { t: 'Ask about surplus funds', d: 'If the sale brought more than the debt, some states return the surplus to the former owner. The county treasurer is the official door.' },
    { t: 'Housing next', d: '211 and local housing authorities for short-term shelter and rental help.' },
    { t: 'Counselor still helps after a sale', d: 'Post-sale timelines (redemption, eviction) are state law. A counselor or legal aid can read yours.' }
  ],
  unknown: [
    { t: 'If nothing has been filed', d: 'Treat it as pre-NOD: call the servicer and a HUD counselor before a notice lands.' },
    { t: 'If you have a default notice', d: 'Treat it as NOD: read the dates on that paper and confirm at the county recorder.' },
    { t: 'If you have a sale notice', d: 'Treat it as auction-scheduled: confirm the official county list. We will not invent the date.' },
    { t: 'If you think it already sold', d: 'Treat it as sold: confirm the deed at the recorder before you plan the next step.' },
    { t: 'Watch this ZIP', d: 'Free list. Desk Alerts are not live yet; we will not charge $19 for a feed we cannot send.' }
  ]
};

// Official, public pages only. No affiliate, no invented county calendars.
var FEDERAL = [
  { name: 'HUD housing counselor', url: 'https://www.hud.gov/findacounselor', why: 'Free, HUD-approved. Not a buyer.' },
  { name: 'CFPB foreclosure help', url: 'https://www.consumerfinance.gov/housing/housing-insecurity/foreclosure/', why: 'Federal consumer rules in plain language.' },
  { name: 'HUD HomeStore (FHA listings)', url: 'https://www.hudhomestore.gov/', why: 'Public FHA-foreclosed listings. Search by city. Not your parcel status.' },
  { name: '211', url: 'https://www.211.org/', why: 'Local housing, food, and emergency help.' }
];

var STATE_HELP = {
  AL: { name: 'Alabama Attorney General / consumer', url: 'https://www.alabamaag.gov/consumer-protection/' },
  AK: { name: 'Alaska Department of Law / consumer', url: 'https://law.alaska.gov/department/civil/consumer/' },
  AZ: { name: 'Arizona Attorney General / housing', url: 'https://www.azag.gov/consumer/housing' },
  AR: { name: 'Arkansas Attorney General / consumer', url: 'https://www.arkansasag.gov/consumer-protection/' },
  CA: { name: 'California DFPI / foreclosure help', url: 'https://dfpi.ca.gov/consumers/housing/' },
  CO: { name: 'Colorado Attorney General / consumer', url: 'https://coag.gov/office-sections/consumer-protection/' },
  CT: { name: 'Connecticut Department of Banking / mortgage', url: 'https://portal.ct.gov/dob' },
  DE: { name: 'Delaware Attorney General / consumer', url: 'https://attorneygeneral.delaware.gov/fraud/cmu/' },
  DC: { name: 'DC Department of Housing', url: 'https://dhcd.dc.gov/' },
  FL: { name: 'Florida DFS / foreclosure help', url: 'https://www.myfloridacfo.com/division/consumers' },
  GA: { name: 'Georgia Department of Law / consumer', url: 'https://consumer.georgia.gov/' },
  HI: { name: 'Hawaii Office of Consumer Protection', url: 'https://cca.hawaii.gov/ocp/' },
  ID: { name: 'Idaho Attorney General / consumer', url: 'https://www.ag.idaho.gov/consumer-protection/' },
  IL: { name: 'Illinois Attorney General / housing', url: 'https://www.illinoisattorneygeneral.gov/consumers/housing.html' },
  IN: { name: 'Indiana Attorney General / consumer', url: 'https://www.in.gov/attorneygeneral/consumer-protection-division/' },
  IA: { name: 'Iowa Attorney General / consumer', url: 'https://www.iowaattorneygeneral.gov/for-consumers' },
  KS: { name: 'Kansas Attorney General / consumer', url: 'https://www.ag.ks.gov/consumer-protection' },
  KY: { name: 'Kentucky Attorney General / consumer', url: 'https://www.ag.ky.gov/Resources/Consumer-Protection/' },
  LA: { name: 'Louisiana Attorney General / consumer', url: 'https://www.ag.state.la.us/Consumer' },
  ME: { name: 'Maine Bureau of Consumer Credit', url: 'https://www.maine.gov/pfr/consumercredit/' },
  MD: { name: 'Maryland Department of Housing', url: 'https://dhcd.maryland.gov/' },
  MA: { name: 'Massachusetts Attorney General / housing', url: 'https://www.mass.gov/topics/housing-and-property' },
  MI: { name: 'Michigan Attorney General / consumer', url: 'https://www.michigan.gov/ag/consumer-protection' },
  MN: { name: 'Minnesota Attorney General / consumer', url: 'https://www.ag.state.mn.us/consumer/' },
  MS: { name: 'Mississippi Attorney General / consumer', url: 'https://www.ago.state.ms.us/divisions/consumer-protection/' },
  MO: { name: 'Missouri Attorney General / consumer', url: 'https://ago.mo.gov/civil-division/consumer/' },
  MT: { name: 'Montana Department of Justice / consumer', url: 'https://dojmt.gov/consumer/' },
  NE: { name: 'Nebraska Attorney General / consumer', url: 'https://ago.nebraska.gov/consumer-protection' },
  NV: { name: 'Nevada Housing Division', url: 'https://housing.nv.gov/' },
  NH: { name: 'New Hampshire Banking Department', url: 'https://www.nh.gov/banking/' },
  NJ: { name: 'New Jersey Housing and Mortgage Finance', url: 'https://nj.gov/dca/hmfa/' },
  NM: { name: 'New Mexico Attorney General / consumer', url: 'https://www.nmag.gov/consumer-protection/' },
  NY: { name: 'New York Department of Financial Services', url: 'https://www.dfs.ny.gov/consumers/help_for_homeowners' },
  NC: { name: 'North Carolina Commissioner of Banks', url: 'https://www.nccob.gov/' },
  ND: { name: 'North Dakota Department of Financial Institutions', url: 'https://www.nd.gov/dfi/' },
  OH: { name: 'Ohio Attorney General / consumer', url: 'https://www.ohioattorneygeneral.gov/Individuals-and-Families/Consumers' },
  OK: { name: 'Oklahoma Attorney General / consumer', url: 'https://www.oag.ok.gov/consumer-protection' },
  OR: { name: 'Oregon Housing and Community Services', url: 'https://www.oregon.gov/ohcs/' },
  PA: { name: 'Pennsylvania Attorney General / consumer', url: 'https://www.attorneygeneral.gov/protect-yourself/consumer-protection/' },
  RI: { name: 'Rhode Island Housing', url: 'https://www.rihousing.com/' },
  SC: { name: 'South Carolina Department of Consumer Affairs', url: 'https://consumer.sc.gov/' },
  SD: { name: 'South Dakota Attorney General / consumer', url: 'https://atg.sd.gov/legal/consumers/' },
  TN: { name: 'Tennessee Department of Commerce / consumer', url: 'https://www.tn.gov/commerce/consumer-resources.html' },
  TX: { name: 'Texas Attorney General / consumer', url: 'https://www.texasattorneygeneral.gov/consumer-protection' },
  UT: { name: 'Utah Department of Commerce / consumer', url: 'https://commerce.utah.gov/consumer/' },
  VT: { name: 'Vermont Department of Financial Regulation', url: 'https://dfr.vermont.gov/' },
  VA: { name: 'Virginia Housing', url: 'https://www.vhda.com/' },
  WA: { name: 'Washington Department of Financial Institutions', url: 'https://dfi.wa.gov/consumers/homeowners' },
  WV: { name: 'West Virginia Attorney General / consumer', url: 'https://ago.wv.gov/consumerprotection/' },
  WI: { name: 'Wisconsin Department of Financial Institutions', url: 'https://dfi.wi.gov/' },
  WY: { name: 'Wyoming Attorney General / consumer', url: 'https://ag.wyo.gov/law-office-divisions/consumer-protection-and-antitrust' }
};

var NAME2ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
  'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
  'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
  'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
  'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

var DISCLAIMER =
  'Educational information only. Not legal, financial, tax, or emergency advice. ' +
  'LIMEN Helix does not represent you and does not invent auction dates. ' +
  'Confirm every date and filing with the county recorder, the official sale list, and a HUD-approved counselor. ' +
  'In a crisis call 988 or 211.';

function normNotice(raw) {
  var s = String(raw || 'unsure').toLowerCase().trim();
  if (NOTICE_TO_STAGE[s]) return s;
  return 'unsure';
}

function stageOf(notice) {
  return NOTICE_TO_STAGE[normNotice(notice)] || 'unknown';
}

function stateAbbr(state) {
  var s = String(state || '').trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return NAME2ABBR[s] || null;
}

function resourcesFor(state) {
  var abbr = stateAbbr(state);
  var out = FEDERAL.slice();
  if (abbr && STATE_HELP[abbr]) {
    out.unshift({
      name: STATE_HELP[abbr].name,
      url: STATE_HELP[abbr].url,
      why: 'Official state page for the place we resolved. Not a county auction calendar.'
    });
  }
  return out;
}

function clock(notice, place) {
  var noticeKey = normNotice(notice);
  var stage = stageOf(noticeKey);
  var copy = STAGE_COPY[stage];
  return {
    ok: true,
    educational: true,
    validated: false,
    inventedAuctionDate: false,
    auctionDate: null,
    notice: noticeKey,
    stage: stage,
    label: copy.label,
    plain: copy.plain,
    clock: copy.clock,
    options: OPTIONS[stage],
    stages: STAGES.filter(function (s) { return s !== 'unknown'; }).map(function (s) {
      return { id: s, label: STAGE_COPY[s].label, current: s === stage };
    }),
    place: place || null,
    resources: resourcesFor(place && place.state),
    freshness: {
      label: 'Stage is educational, from what you said you received. Place is a public ZIP/address lookup. We do not search county foreclosure dockets on this read, and we do not invent auction dates.',
      asOf: new Date().toISOString()
    },
    disclaimer: DISCLAIMER
  };
}

function extractZip(q) {
  var m = String(q || '').match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : '';
}

function looksLikeStreet(q) {
  var s = String(q || '').trim();
  if (extractZip(s) && /^\d{5}(?:-\d{4})?$/.test(s)) return false;
  return /\d/.test(s) && /[A-Za-z]/.test(s) && s.length >= 8;
}

module.exports = {
  STAGES: STAGES,
  NOTICE_TO_STAGE: NOTICE_TO_STAGE,
  STAGE_COPY: STAGE_COPY,
  DISCLAIMER: DISCLAIMER,
  FEDERAL: FEDERAL,
  STATE_HELP: STATE_HELP,
  NAME2ABBR: NAME2ABBR,
  normNotice: normNotice,
  stageOf: stageOf,
  stateAbbr: stateAbbr,
  resourcesFor: resourcesFor,
  clock: clock,
  extractZip: extractZip,
  looksLikeStreet: looksLikeStreet
};
