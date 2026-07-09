/**
 * lib/recall-match.js — Tuned Monitoring core: match a clinic's inventory item against FDA recalls.
 *
 * openFDA enforcement records are mostly FREE TEXT (product_description + recalling_firm + code_info
 * lot list); structured NDC/UDI is inconsistently present. So matching is tiered by CONFIDENCE, and
 * we are transparent about it — a compliance backstop must surface possibilities to verify, never
 * assert a recall it can't stand behind. Order of trust:
 *   exact   — the clinic's lot # appears in the recall's affected lots, OR NDC matches.
 *   likely  — same manufacturer AND a distinctive product-name token in common (verify your lot).
 *   watch   — same manufacturer, but not clearly the same product (check if it's yours).
 *   possible— strong product-name token overlap without a manufacturer match.
 * No match tier is invented; every field compared comes from real clinic input vs. real openFDA data.
 */
'use strict';

// legal-entity + filler words stripped from firm names so "Arrow International, LLC" == "Arrow".
var FIRM_NOISE = /\b(llc|l\.?l\.?c|lp|inc|incorporated|corp|corporation|co|company|ltd|limited|plc|gmbh|ag|sa|nv|bv|pharmaceuticals?|pharma|labs?|laboratories|medical|healthcare|health|group|holdings?|international|industries|products|systems|technologies|usa|us|na|the)\b/g;
// generic product words that are NOT distinctive on their own (a "catheter" match means nothing).
var GENERIC = { catheter:1, syringe:1, needle:1, tablet:1, tablets:1, capsule:1, capsules:1, solution:1,
  injection:1, injectable:1, gauze:1, glove:1, gloves:1, applicator:1, applicators:1, swab:1, swabs:1,
  kit:1, set:1, sets:1, tube:1, tubing:1, bag:1, bags:1, device:1, implant:1, valve:1, sensor:1, pump:1,
  wipe:1, wipes:1, dressing:1, bandage:1, mask:1, gown:1, sterile:1, disposable:1, cream:1, ointment:1,
  gel:1, spray:1, drops:1, ophthalmic:1, oral:1, topical:1, powder:1, liquid:1, suspension:1 };
var STOP = { the:1, and:1, for:1, with:1, of:1, in:1, to:1, a:1, an:1, ml:1, mg:1, mcg:1, mm:1, cm:1, fr:1,
  oz:1, fl:1, ea:1, each:1, box:1, case:1, pack:1, count:1, ct:1, size:1, non:1, free:1, single:1, use:1,
  usp:1, nf:1, latex:1, assorted:1, per:1, no:1, model:1 };

function normFirm(s) {
  return String(s || '').toLowerCase().replace(/[.,/&-]/g, ' ').replace(FIRM_NOISE, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function zpad(s, n) { s = String(s || '').replace(/\D/g, ''); while (s.length < n) s = '0' + s; return s; }
// Reduce any NDC (clinic package-NDC or openFDA product-NDC, dashed or raw) to a canonical 9-digit
// LABELER+PRODUCT key (5+4), dropping the package segment. Returns '' when the format is ambiguous
// (we'd rather miss than assert a false NDC match). Lot/firm/token carry the real matching load.
function ndcKey(s) {
  s = String(s || '').trim(); if (!s) return '';
  if (s.indexOf('-') !== -1) {
    var seg = s.split('-').filter(Boolean);
    if (seg.length >= 2) {
      var lab = seg[0].replace(/\D/g, ''), prod = seg[1].replace(/\D/g, '');
      if (lab.length >= 3 && lab.length <= 5 && prod.length >= 2 && prod.length <= 4) return zpad(lab, 5) + zpad(prod, 4);
    }
    return '';
  }
  var d = s.replace(/\D/g, '');
  if (d.length === 10) d = '0' + d;      // 10-digit raw -> assume leading-zero labeler -> 11
  if (d.length === 11) return d.slice(0, 9);   // drop 2-digit package segment
  return '';
}
function ndcMatch(a, b) { var A = ndcKey(a), B = ndcKey(b); return A.length === 9 && A === B; }
function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(function (t) { return t.length >= 3 && !STOP[t] && !/^\d+$/.test(t); });
}
function distinctive(s) { return tokens(s).filter(function (t) { return !GENERIC[t]; }); }

// firm match: normalized equality, or the shorter name's words are all inside the longer AND the
// first (anchor) word matches — so "arrow" matches "arrow international" but not "medline".
function firmMatch(a, b) {
  var A = normFirm(a), B = normFirm(b); if (!A || !B) return false;
  if (A === B) return true;
  var aw = A.split(' '), bw = B.split(' ');
  var shortW = aw.length <= bw.length ? aw : bw, longW = aw.length <= bw.length ? bw : aw;
  if (!shortW.length || shortW[0] !== longW[0]) return false;
  return shortW.every(function (w) { return longW.indexOf(w) !== -1; });
}

// lot match: the clinic's lot/batch string appears in the recall's code_info affected-lot list.
// Requires length >= 4 to avoid coincidental short-string hits; alphanumeric-normalized both sides.
function lotMatch(invLot, codeInfo) {
  var l = String(invLot || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (l.length < 4) return false;
  var c = String(codeInfo || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
  return (' ' + c + ' ').indexOf(l) !== -1;
}

// item: { product, manufacturer, ndc, lot }   recall: from lib/medicine.fromRecall (+codeInfo,+ndc)
function matchItem(item, recalls) {
  var invTokens = distinctive(item.product);
  var out = [];
  for (var i = 0; i < (recalls || []).length; i++) {
    var r = recalls[i] || {};
    var rText = [r.product, r.brand, r.generic].filter(Boolean).join(' ');
    var rTokens = distinctive(rText);
    var shared = invTokens.filter(function (t) { return rTokens.indexOf(t) !== -1; });
    var fMatch = firmMatch(item.manufacturer, r.firm);
    var nMatch = ndcMatch(item.ndc, r.ndc);
    var lMatch = lotMatch(item.lot, r.codeInfo);

    var tier = null, why = [];
    if (lMatch) { tier = 'exact'; why.push('your lot # is in the recall'); }
    else if (nMatch) { tier = 'exact'; why.push('NDC match'); }
    else if (fMatch && shared.length) { tier = 'likely'; why.push('same manufacturer + product (' + shared.slice(0, 3).join(', ') + ') — confirm your lot'); }
    else if (fMatch) { tier = 'watch'; why.push('same manufacturer (' + normFirm(r.firm) + ') — check if this is a product you use'); }
    else if (shared.length >= 2) { tier = 'possible'; why.push('product name match (' + shared.slice(0, 3).join(', ') + ') — different/unknown manufacturer'); }

    if (tier) out.push({
      tier: tier, why: why.join('; '), shared: shared,
      recallNumber: r.recallNumber, classification: r.classification || r.signalType,
      firm: r.firm, product: r.product, reason: r.reason, date: r.date, url: r.url
    });
  }
  var rank = { exact: 0, likely: 1, watch: 2, possible: 3 };
  out.sort(function (a, b) { return (rank[a.tier] - rank[b.tier]) || String(a.recallNumber).localeCompare(String(b.recallNumber)); });
  return out;
}

// scan a whole inventory; returns only items with >=1 match, best-tier first.
function scanInventory(items, recalls) {
  var results = [];
  for (var i = 0; i < (items || []).length; i++) {
    var m = matchItem(items[i], recalls);
    if (m.length) results.push({ item: items[i], matches: m, bestTier: m[0].tier });
  }
  var rank = { exact: 0, likely: 1, watch: 2, possible: 3 };
  results.sort(function (a, b) { return rank[a.bestTier] - rank[b.bestTier]; });
  return results;
}

module.exports = {
  normFirm: normFirm, firmMatch: firmMatch, ndcMatch: ndcMatch, lotMatch: lotMatch,
  distinctive: distinctive, matchItem: matchItem, scanInventory: scanInventory
};
