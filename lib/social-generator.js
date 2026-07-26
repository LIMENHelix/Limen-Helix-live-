/**
 * lib/social-generator.js — turn live tool data into posts.
 *
 * THE REGISTER, per the standing thesis: edgy hook, checkable payload. Every number in every
 * post comes from a live endpoint on this site, and the post links to the page where the
 * reader can verify it. That is the whole moat — the hook earns the click, the receipt earns
 * the trust, and neither survives without the other.
 *
 * THE HARD RULE: if the data is not there, return null. A generator NEVER fabricates a
 * number, never rounds a missing value to zero, and never ships a template with a blank in
 * it. A single invented figure discredits every real one on the site, and unlike a bad tool
 * card a bad post cannot be quietly fixed after the fact.
 *
 * Every link carries UTM parameters so a lead that arrives from a post is attributable in the
 * 5-stage funnel instead of looking like organic traffic (see handlers/lead.js).
 */
var T = require('./tool-fetch');
var social = require('./social-post');

var SITE = 'https://limenhelix.com';
var API = SITE + '/api/';

function utm(domain) {
  return SITE + '/' + domain + '?utm_source=bluesky&utm_medium=social&utm_campaign=' + encodeURIComponent(domain);
}
function usd(n) {
  if (n == null || !isFinite(n)) return null;
  var a = Math.abs(n);
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(1) + 'T';
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

async function get(path) {
  var r = await T.getJSON(API + path, 20000);
  return (r.status === 200 && r.body && r.body.ok !== false) ? r.body : null;
}

// ── per-domain builders. Each returns { domain, text } or null. ─────────────

async function economy() {
  var j = await get('economy-tools');
  if (!j || !j.spentPerDollar || j.interestShareOfReceipts == null) return null;
  var cents = Math.round(j.interestShareOfReceipts * 100);
  var per = j.spentPerDollar.toFixed(2);
  return {
    domain: 'economy',
    text: cents + ' cents of every dollar Washington collected this year went to interest on '
      + 'debt run up before you paid it.\n\nIt spent $' + per + ' for every $1 it took in.\n\n'
      + 'Treasury\'s own ledger. Itemise your share:\n' + utm('economy')
  };
}

async function population() {
  var j = await get('population-tools');
  if (!j || j.yearsOfIncome == null) return null;
  var now = j.yearsOfIncome.toFixed(1);
  var then = (j.yearsOfIncomeThen != null && j.thenYear) ? j.yearsOfIncomeThen.toFixed(1) : null;
  var line = 'A median US home now costs ' + now + ' years of the median household income.';
  if (then) line += '\n\nIn ' + j.thenYear + ' it was ' + then + '.';
  line += '\n\nLenders used to call 3x affordable.\n\nCheck your state:\n' + utm('population');
  return { domain: 'population', text: line };
}

async function technology() {
  var j = await get('technology-tools');
  if (!j || !j.total) return null;
  return {
    domain: 'technology',
    text: j.total.toLocaleString() + ' software flaws are being actively exploited right now. '
      + j.ransomwareCount.toLocaleString() + ' are tied to ransomware crews.\n\n'
      + j.recentCount + ' were added in the last 30 days.\n\n'
      + 'Search your own stack, free:\n' + utm('technology')
  };
}

async function agriculture() {
  var j = await get('agriculture-tools?tool=inputs');
  if (!j || !Array.isArray(j.rows)) return null;
  var n = j.rows.find(function (r) { return r.ok && /Nitrogen/i.test(r.label); });
  var g = j.rows.find(function (r) { return r.ok && /Natural gas/i.test(r.label); });
  if (!n || n.changeYear == null || !g || g.changeYear == null) return null;
  if (!(n.changeYear > 0 && g.changeYear < 0)) return null;   // only post it when the split is real
  return {
    domain: 'agriculture',
    text: 'Nitrogen fertiliser is up ' + n.changeYear + '% in a year.\n\n'
      + 'Natural gas, the feedstock it is made from, is DOWN ' + Math.abs(g.changeYear) + '%.\n\n'
      + 'Someone is taking that margin, and it is not the farmer.\n\n'
      + 'Federal price data:\n' + utm('agriculture')
  };
}

async function environment() {
  var j = await get('environment-tools?tool=fires');
  if (!j || !Array.isArray(j.rows) || !j.rows.length) return null;

  // Count only fires that are NOT fully contained. The raw list keeps 100%-contained
  // incidents, and the largest one on it was a 642k-acre fire at 100% containment — calling
  // that "burning right now" is false, and it alone was a third of the headline acreage.
  var live = j.rows.filter(function (r) { return r.contained != null && r.contained < 100 && r.name && r.acres; });
  if (!live.length) return null;
  live.sort(function (a, b) { return b.acres - a.acres; });
  var worst = live[0];
  var acres = live.reduce(function (s, r) { return s + r.acres; }, 0);

  return {
    domain: 'environment',
    text: live.length + ' wildfires over 100 acres are burning uncontained right now, '
      + acres.toLocaleString() + ' acres between them.\n\n'
      + 'Largest: ' + worst.name + ' in ' + (worst.state || 'the US') + ', '
      + worst.acres.toLocaleString() + ' acres, ' + worst.contained + '% contained.\n\n'
      + 'Air quality at your ZIP:\n' + utm('environment')
  };
}

async function medicine() {
  var j = await get('medicine-tools?tool=shortages');
  // Must be the DRUG count, not the record count. openFDA files one record per manufacturer
  // presentation, so 1,175 current records were only 73 distinct drugs — posting the record
  // count as "drugs in shortage" overstated it by ~16x. Refuse rather than fall back to total.
  if (!j || !j.distinctDrugs) return null;
  return {
    domain: 'medicine',
    text: j.distinctDrugs.toLocaleString() + ' drugs are in active FDA shortage right now, across '
      + (j.total || 0).toLocaleString() + ' manufacturer listings.\n\n'
      + 'Your pharmacy will not tell you until you are standing there.\n\n'
      + 'Check yours by name, free:\n' + utm('medicine')
  };
}

async function law() {
  var j = await get('law-tools');
  if (!j || !j.total) return null;
  var soon = j.closingWeek || 0;
  if (!soon) return null;   // the urgency IS the post; without it there is nothing to say
  return {
    domain: 'law',
    text: soon + ' federal rules close for public comment within 7 days.\n\n'
      + j.total + ' are open in total.\n\nAgencies must consider what comes in, and you do not '
      + 'need a lawyer to file.\n\nSee what is closing:\n' + utm('law')
  };
}

async function defense() {
  var j = await get('defense-tools');
  if (!j || !Array.isArray(j.rows) || !j.rows.length) return null;
  var top = j.rows[0];
  if (!top.recipient || !top.amount) return null;
  return {
    domain: 'defense',
    text: 'Largest Pentagon contract this fiscal year: ' + usd(top.amount) + ' to '
      + top.recipient + '.\n\nThat is a ceiling, not a cheque, and it is public record '
      + 'almost nobody reads.\n\nSee who else got paid:\n' + utm('defense')
  };
}

async function intelligence() {
  var j = await get('intelligence-tools');
  if (!j || !j.total || !Array.isArray(j.programs) || !j.programs.length) return null;
  return {
    domain: 'intelligence',
    text: j.total.toLocaleString() + ' people, companies and vessels are barred from dealing '
      + 'with US persons.\n\nLargest programme: ' + j.programs[0].program + ', '
      + j.programs[0].count.toLocaleString() + ' entries.\n\nScreen any name free:\n' + utm('intelligence')
  };
}

async function governance() {
  var j = await get('governance-tools');
  if (!j || !Array.isArray(j.rows) || !j.rows.length) return null;
  var top = j.rows[0];
  if (!top.name || !top.amount) return null;
  return {
    domain: 'governance',
    text: usd(top.amount) + ' in federal contracts went to ' + top.name + ' this fiscal year.\n\n'
      + 'Every dollar is published with the name of the company that collected it.\n\n'
      + 'See who is being paid in your state:\n' + utm('governance')
  };
}

async function trade() {
  var j = await get('trade-tools');
  if (!j || !Array.isArray(j.prices)) return null;
  var all = j.prices.find(function (p) { return p.id === 'IR' && p.changeYear != null; });
  if (!all) return null;
  return {
    domain: 'trade',
    text: 'Imported goods cost ' + (all.changeYear > 0 ? all.changeYear + '% MORE' : Math.abs(all.changeYear) + '% less')
      + ' than a year ago.\n\nThat lands on your shelf before it lands in any headline.\n\n'
      + 'Track it by trading partner:\n' + utm('trade')
  };
}

var BUILDERS = [
  { name: 'economy', fn: economy }, { name: 'population', fn: population },
  { name: 'technology', fn: technology }, { name: 'agriculture', fn: agriculture },
  { name: 'environment', fn: environment }, { name: 'medicine', fn: medicine },
  { name: 'law', fn: law }, { name: 'defense', fn: defense },
  { name: 'intelligence', fn: intelligence }, { name: 'governance', fn: governance },
  { name: 'trade', fn: trade }
];

/**
 * Build one post, rotating so the same domain does not repeat back to back.
 * `after` is the last domain posted; generation starts at the next one and takes the first
 * that yields real data. A builder returning null (source down, or the fact it needs is not
 * true today) is skipped silently rather than filled in.
 */
async function generate(o) {
  o = o || {};
  var start = 0;
  if (o.after) {
    for (var i = 0; i < BUILDERS.length; i++) if (BUILDERS[i].name === o.after) { start = i + 1; break; }
  }
  var only = o.domain ? String(o.domain).toLowerCase() : null;
  var tried = [], skipped = [];

  for (var k = 0; k < BUILDERS.length; k++) {
    var b = BUILDERS[(start + k) % BUILDERS.length];
    if (only && b.name !== only) continue;
    tried.push(b.name);
    var post = null;
    try { post = await b.fn(); } catch (e) { post = null; }
    if (!post || !post.text) { skipped.push(b.name); continue; }

    var len = social.graphemeLength(post.text);
    if (len > social.MAX_GRAPHEMES) { skipped.push(b.name + ' (too long: ' + len + ')'); continue; }
    post.length = len;
    post.tried = tried;
    post.skipped = skipped;
    return post;
  }
  return { ok: false, reason: 'No domain produced a post from live data.', tried: tried, skipped: skipped };
}

module.exports = { generate: generate, BUILDERS: BUILDERS.map(function (b) { return b.name; }) };
