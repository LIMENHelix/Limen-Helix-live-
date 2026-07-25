/**
 * api/economy-tools.js — Economy Watch tool: YOUR RECEIPT FROM THE GOVERNMENT.
 *
 *   GET /api/economy-tools            → the federal ledger, fiscal year to date
 *
 * You give a store your money and it gives you a receipt. The federal government takes more
 * than any store ever will and never itemises it. This does, from Treasury's own Monthly
 * Treasury Statement: what was collected, what was spent, the gap between them, what went to
 * interest on past borrowing, and the split across every agency.
 *
 * The arithmetic that makes it personal runs in the browser from the one number the user
 * enters (what they actually paid). Nothing about a user is stored or sent anywhere.
 *
 * HONESTY BOUNDARY. This is an ALLOCATION, not an earmark: federal money is fungible and no
 * specific dollar is traceable to a specific program. It is the same method the Treasury's own
 * taxpayer-receipt work uses. It is information about public spending, NOT tax advice, and it
 * says nothing about what anyone should pay.
 *
 * Source: Treasury Fiscal Data, MTS Table 5 (Outlays by Agency), keyless.
 * Validation: the agency rows are checked against Treasury's own "Total Outlays" line and the
 * residual is reported as an explicit row rather than silently absorbed. Fetching fewer rows
 * than the month contains silently loses whole agencies, so the page size is set past the
 * real row count and the count is asserted.
 */
var T = require('../lib/tool-fetch');

var FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_5';
var KEY = 'economy:tool:receipt:v1';
var TTL = 12 * 3600 * 1000;   // MTS publishes monthly; twice a day is generous

function isNull(v) { return v === null || v === 'null' || v === undefined; }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

// Plain-language for what each agency actually does with the money, because "Department of
// the Treasury: $1.27T" is meaningless without knowing that most of it is debt interest.
var AGENCY_PLAIN = {
  'Department of Health and Human Services': 'Medicare, Medicaid, CHIP and public health',
  'Social Security Administration': 'Retirement, survivor and disability benefits',
  'Department of the Treasury': 'Mostly interest on the national debt, plus tax administration',
  'Department of Defense--Military Programs': 'Military pay, operations, weapons and bases',
  'Department of Veterans Affairs': 'Veteran health care, disability and pensions',
  'Department of Agriculture': 'SNAP/food assistance, farm programs, forestry',
  'Office of Personnel Management': 'Federal civilian retirement and health benefits',
  'Department of Transportation': 'Highways, transit, aviation and rail',
  'Department of Homeland Security': 'Borders, immigration, TSA, FEMA, Coast Guard',
  'Department of Housing and Urban Development': 'Rental assistance and housing programs',
  'Department of Education': 'Student aid, student loans, K-12 grants',
  'Department of Labor': 'Unemployment insurance and worker programs',
  'Department of Energy': 'Nuclear weapons stockpile, labs and energy programs',
  'Department of Justice': 'FBI, DEA, federal prisons and courts prosecution',
  'Department of State': 'Embassies and diplomacy',
  'International Assistance Programs': 'Foreign aid and development lending',
  'National Aeronautics and Space Administration': 'Space flight and science',
  'Environmental Protection Agency': 'Pollution rules, cleanup and water grants',
  'Other Defense Civil Programs': 'Military retirement and related civil accounts',
  'Undistributed Offsetting Receipts': 'Money flowing back IN (rents, royalties, premiums), which is why it is negative'
};

async function latestDate() {
  var r = await T.getJSON(FD + '?sort=-record_date&page%5Bsize%5D=1&format=json', 12000);
  if (r.status !== 200 || !r.body || !r.body.data || !r.body.data[0]) return null;
  return r.body.data[0].record_date || null;
}

async function ledger() {
  var date = await latestDate();
  if (!date) return { ok: false, reason: 'Treasury Fiscal Data did not return a current statement date.' };

  // page size deliberately past the real row count; a short read silently drops whole agencies
  var r = await T.getJSON(FD + '?filter=record_date:eq:' + date + '&page%5Bsize%5D=1200&format=json', 20000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.data)) {
    return { ok: false, reason: 'Treasury returned ' + (r.status || 'no response') + ' for the Monthly Treasury Statement.' };
  }
  var rows = r.body.data;
  var declared = r.body.meta && r.body.meta['total-count'];
  if (declared && rows.length < declared) {
    return { ok: false, reason: 'Treasury returned only ' + rows.length + ' of ' + declared + ' statement rows; the breakdown would be incomplete.' };
  }

  var totals = rows.filter(function (x) { return /^Total--/.test(x.classification_desc || ''); });
  var heads = rows.filter(function (x) { return isNull(x.parent_id) && /:$/.test(x.classification_desc || ''); });

  var totalOutlaysRow = rows.find(function (x) { return x.classification_desc === 'Total Outlays'; });
  var deficitRow = rows.find(function (x) { return /^Total Surplus/.test(x.classification_desc || ''); });
  var interestRow = totals.find(function (x) { return x.classification_desc === 'Total--Interest on the Public Debt'; });

  var outlays = num(totalOutlaysRow && totalOutlaysRow.current_fytd_net_outly_amt);
  var deficit = num(deficitRow && deficitRow.current_fytd_net_outly_amt);   // negative when in deficit
  if (outlays == null || deficit == null) return { ok: false, reason: 'The statement did not carry a usable total-outlays or deficit line.' };

  // Receipts are not in this table, but the identity holds exactly: receipts = outlays + (surplus/deficit).
  // Cross-checked against MTS Table 1 year-to-date: 4,151.4B, identical.
  var receipts = outlays + deficit;
  var interest = num(interestRow && interestRow.current_fytd_net_outly_amt);

  var agencies = [];
  heads.forEach(function (h) {
    var nm = String(h.classification_desc).replace(/:$/, '');
    var t = totals.find(function (x) { return x.classification_desc === 'Total--' + nm; });
    var v = num(t && t.current_fytd_net_outly_amt);
    if (v == null) return;
    agencies.push({ name: nm, plain: AGENCY_PLAIN[nm] || null, amount: v, share: outlays ? v / outlays : null });
  });
  if (!agencies.length) return { ok: false, reason: 'No agency lines could be read from the statement.' };
  agencies.sort(function (a, b) { return b.amount - a.amount; });

  // Report the leftover rather than quietly normalising it away.
  var summed = agencies.reduce(function (s, a) { return s + a.amount; }, 0);
  var residual = outlays - summed;

  return {
    ok: true,
    asOf: date,
    fiscalYear: (rows[0] && rows[0].record_fiscal_year) || null,
    receipts: receipts,
    outlays: outlays,
    deficit: deficit,
    interest: interest,
    // the two numbers that do the work. NOTE the denominators differ on purpose and must not
    // be interchanged: the personal split allocates a tax bill across SPENDING, so interest
    // inside that split is a share of OUTLAYS. The share-of-RECEIPTS figure answers a
    // different question ("interest ate this much of everything collected") and is a statement
    // about the government, not about one person's bill.
    spentPerDollar: receipts ? outlays / receipts : null,
    interestShareOfOutlays: (interest != null && outlays) ? interest / outlays : null,
    interestShareOfReceipts: (interest != null && receipts) ? interest / receipts : null,
    agencies: agencies,
    residual: residual,
    residualShare: outlays ? residual / outlays : null,
    source: 'U.S. Treasury, Monthly Treasury Statement (Table 5, Outlays by Agency)',
    sourceUrl: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/outlays-of-the-u-s-government',
    note: 'Fiscal year to date. The federal fiscal year starts on 1 October, so this is not a calendar year and not a full year. Figures are net outlays as Treasury reports them. State and local taxes are not in here at all.',
    method: 'Splitting one person\'s tax across these categories is an ALLOCATION, not an earmark: federal money is fungible and no individual dollar can be traced to a program. It answers "if my taxes were spent the way Washington actually spends, where would mine have gone" and nothing more. It is not tax advice.'
  };
}

module.exports = async function handler(req, res) {
  try {
    return T.send(res, await T.cached(KEY, TTL, ledger));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
