/**
 * lib/fema.js — federal disaster declarations, the P4 signal.
 *
 * WHY THIS IS P4 AND NOT SOMETHING ELSE. The arc defines Scaffolding as external support
 * brought in to hold a fracture: borrowed structure, coherence held from outside rather than
 * self-generated. A federal disaster declaration is precisely that and nothing else. It is the
 * moment a state stops absorbing an event on its own and federal money and machinery are
 * brought in to hold it. It is declared, dated and published, so we are reading a fact rather
 * than inferring a phase from a number crossing a line we chose.
 *
 * Shared because two domains need it: Environment reads fire, flood and storm declarations;
 * Agriculture reads drought. Same source, same shape.
 *
 * DEDUPE IS MANDATORY. OpenFEMA returns ONE ROW PER COUNTY, so a single disaster appears
 * dozens of times. Three consecutive rows in a raw query were the same Oregon fire. Counting
 * rows would inflate "how many disasters" by an order of magnitude, which is exactly the
 * saturation-artefact mistake in a different costume.
 *
 * Source: OpenFEMA v2, keyless. https://www.fema.gov/about/openfema/api
 */
var T = require('./tool-fetch');

var BASE = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';

// FEMA's own declaration types, expanded. These are legal categories, not our labels.
var DECL_TYPE = {
  DR: 'major disaster declaration',
  EM: 'emergency declaration',
  FM: 'fire management assistance',
  FS: 'fire suppression authorisation',
  FL: 'flood'
};

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

/**
 * Recent declarations, one row per DISASTER (not per county).
 * @param {object} o { days, state, incidentType }
 */
async function recent(o) {
  o = o || {};
  var days = Math.min(Math.max(parseInt(o.days, 10) || 90, 1), 365);
  var filters = ["declarationDate ge '" + isoDaysAgo(days) + "'"];
  if (o.state) filters.push("state eq '" + String(o.state).toUpperCase().slice(0, 2) + "'");
  if (o.incidentType) filters.push("incidentType eq '" + String(o.incidentType).replace(/'/g, '') + "'");

  var url = BASE + '?$top=1000&$orderby=declarationDate desc&$filter=' + encodeURIComponent(filters.join(' and '));
  var r = await T.getJSON(url, 20000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.DisasterDeclarationsSummaries)) {
    return { ok: false, reason: 'FEMA returned ' + (r.status || 'no response') + '.' };
  }

  var byDisaster = {};
  r.body.DisasterDeclarationsSummaries.forEach(function (x) {
    var id = x.disasterNumber;
    if (id == null) return;
    var cur = byDisaster[id];
    if (!cur) {
      byDisaster[id] = {
        disasterNumber: id,
        state: x.state || null,
        title: x.declarationTitle || null,
        incidentType: x.incidentType || null,
        declaredOn: (x.declarationDate || '').slice(0, 10) || null,
        type: x.declarationType || null,
        typePlain: DECL_TYPE[x.declarationType] || null,
        began: (x.incidentBeginDate || '').slice(0, 10) || null,
        ended: (x.incidentEndDate || '').slice(0, 10) || null,
        // which kinds of federal support were actually switched on
        individualAid: !!(x.ihProgramDeclared || x.iaProgramDeclared),
        publicAid: !!x.paProgramDeclared,
        hazardMitigation: !!x.hmProgramDeclared,
        counties: 1
      };
    } else {
      cur.counties += 1;
      // any county with a programme means the programme is on for that disaster
      if (x.ihProgramDeclared || x.iaProgramDeclared) cur.individualAid = true;
      if (x.paProgramDeclared) cur.publicAid = true;
      if (x.hmProgramDeclared) cur.hazardMitigation = true;
    }
  });

  var rows = Object.keys(byDisaster).map(function (k) { return byDisaster[k]; })
    .sort(function (a, b) { return String(b.declaredOn).localeCompare(String(a.declaredOn)); });

  return {
    ok: true,
    days: days,
    count: rows.length,
    countyRows: r.body.DisasterDeclarationsSummaries.length,
    rows: rows,
    source: 'FEMA disaster declarations (OpenFEMA)',
    sourceUrl: 'https://www.fema.gov/disaster/declarations',
    note: 'A declaration is the moment a state stops absorbing an event alone and federal support is switched on. ' +
          'FEMA publishes one record per COUNTY, so these are grouped by disaster: ' +
          'the county count is shown rather than folded into the total.'
  };
}

module.exports = { recent: recent, DECL_TYPE: DECL_TYPE };
