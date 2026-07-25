/**
 * api/intelligence-tools.js — Intelligence Watch tool: IS THIS NAME SANCTIONED?
 *
 *   GET /api/intelligence-tools                    → list size, programme breakdown
 *   GET /api/intelligence-tools?tool=sdn&q=<name>  → search the OFAC list
 *
 * Why this: "threat briefings" are commentary. The Specially Designated Nationals list is the
 * opposite, a legally operative document: dealing with anyone on it is prohibited for US
 * persons. It is public, it changes constantly, and checking a name against it is a real
 * compliance action, not a read.
 *
 * Source: OFAC SDN list (US Treasury), keyless CSV export, ~19,000 rows.
 *
 * The list is 5.6MB, far too large to hold in Redis on a bandwidth-billed plan. It is parsed
 * into a slim in-memory index that survives while a serverless container stays warm, and only
 * the small per-query RESULT is cached in Redis.
 *
 * NOT a compliance product. Screening for real obligations needs fuzzy matching, aliases,
 * dates of birth and the other Treasury lists; a name match here is a starting point only.
 */
var T = require('../lib/tool-fetch');

var SDN_URL = 'https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/SDN.CSV';
var MEM_TTL = 12 * 3600 * 1000;
var Q_TTL = 12 * 3600 * 1000;

var _mem = null;        // { at, rows[], programs{} } — module scope, survives warm invocations
var _loading = null;

// SDN.CSV has no header. Columns are fixed:
// 0 ent_num, 1 SDN_Name, 2 SDN_Type, 3 Program, 4 Title, 5 Call_Sign, 6 Vess_type,
// 7 Tonnage, 8 GRT, 9 Vess_flag, 10 Vess_owner, 11 Remarks. Null is the literal "-0-".
function splitCsvLine(line) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function clean(v) {
  var s = String(v == null ? '' : v).trim();
  return (!s || s === '-0-') ? null : s;
}

async function loadList() {
  if (_mem && (Date.now() - _mem.at) < MEM_TTL) return _mem;
  if (_loading) return _loading;
  _loading = (async function () {
    var r = await T.getText(SDN_URL, 25000);
    if (r.status !== 200 || !r.raw || r.raw.length < 10000) {
      _loading = null;
      return { error: 'OFAC returned ' + (r.status || 'no response') + ' for the sanctions list.' };
    }
    var lines = r.raw.split(/\r?\n/);
    var rows = [], programs = {};
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l || l.length < 5) continue;
      var c = splitCsvLine(l);
      var name = clean(c[1]);
      if (!name) continue;
      var prog = clean(c[3]);
      var row = {
        id: clean(c[0]),
        name: name,
        type: clean(c[2]) || 'Entity',
        program: prog,
        title: clean(c[4]),
        remarks: clean(c[11]) ? String(c[11]).slice(0, 300) : null
      };
      rows.push(row);
      if (prog) {
        // a record can carry several bracketed programmes in one field
        String(prog).split(/\]\s*\[|\[|\]/).forEach(function (p) {
          var k = p.trim();
          if (k) programs[k] = (programs[k] || 0) + 1;
        });
      }
    }
    _loading = null;
    if (!rows.length) return { error: 'The sanctions list parsed to zero usable rows.' };
    _mem = { at: Date.now(), rows: rows, programs: programs };
    return _mem;
  })();
  return _loading;
}

function summary(mem) {
  var progs = Object.keys(mem.programs).map(function (k) { return { program: k, count: mem.programs[k] }; })
    .sort(function (a, b) { return b.count - a.count; }).slice(0, 14);
  var types = {};
  mem.rows.forEach(function (r) { types[r.type] = (types[r.type] || 0) + 1; });
  return {
    ok: true,
    total: mem.rows.length,
    programs: progs,
    types: Object.keys(types).map(function (k) { return { type: k, count: types[k] }; }).sort(function (a, b) { return b.count - a.count; }),
    source: 'OFAC Specially Designated Nationals list (U.S. Treasury)',
    sourceUrl: 'https://sanctionssearch.ofac.treas.gov/',
    note: 'Everyone on this list is barred from dealing with US persons, and their US-facing property is blocked. The list changes constantly, which is exactly why a trained model cannot answer this.',
    caveat: 'This is a plain name search, not a compliance screen. Real screening needs alias and fuzzy matching, dates of birth, and the other Treasury lists. Treat a hit as a starting point and confirm on Treasury\'s own search.'
  };
}

async function search(qRaw) {
  var q = T.cleanQuery(qRaw, 60);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three characters.' };
  return T.cachedQuery('intelligence:tool:sdn:' + T.slugKey(q), Q_TTL, async function () {
    var mem = await loadList();
    if (mem.error) return { ok: false, reason: mem.error };
    var ql = q.toLowerCase();
    var hits = mem.rows.filter(function (r) {
      return r.name.toLowerCase().indexOf(ql) !== -1 || (r.remarks && r.remarks.toLowerCase().indexOf(ql) !== -1);
    });
    return {
      ok: true, query: q, found: hits.length,
      rows: hits.slice(0, 25),
      total: mem.rows.length,
      source: 'OFAC Specially Designated Nationals list (U.S. Treasury)',
      sourceUrl: 'https://sanctionssearch.ofac.treas.gov/',
      note: hits.length
        ? 'Each hit is a designated person, company or vessel. The programme codes show which sanctions authority applies.'
        : 'No entry on the SDN list matches that. That is not a clearance: this is a plain text search of one list, and aliases or spellings may differ.'
    };
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'sdn' && q.q) return T.send(res, await search(q.q));
    var mem = await loadList();
    if (mem.error) return T.send(res, { ok: false, reason: mem.error });
    return T.send(res, summary(mem));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
