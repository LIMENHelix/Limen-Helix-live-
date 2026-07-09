/**
 * lib/energy-distress.js — ENERGY domain P3 core (L1 broker). Turns retiring power generators into
 * ranked "distressed asset" deals. Signal = EIA operating-generator-capacity (EIA-860M) planned
 * retirements — national, structured, free (needs a free EIA API key). A generator with a planned
 * retirement is a dying asset whose real value is its LIVE GRID INTERCONNECTION (years of queue time
 * already paid). Catch it and connect it to a repowering developer / fund before the queue-watchers.
 *
 * Native asset = the interconnection + site, NOT the plant. Business model: broker the connection,
 * own nothing (lib/energy-buyers.js) — a finder/brokerage fee or the distress feed sold as data.
 * L1 of docs/energy-node-business-ladder.md (microglial "preserve the connection, discard the cell").
 * Rank 1-3, lagging public signal, no validated kernel — find + connect fast, never "predict".
 *
 * Shared by scripts/energy-distress-fetch.js (ingest) and handlers/energy-distress.js (read).
 * ⚠ EIA v2 field names may need tuning on first live run — parsing is fuzzy on purpose (RA-style).
 */
'use strict';
// signal types = fuel of the retiring asset (routes the counterparty), ordered by repowering value.
var SIGNALS = [
  { key: 'coal',      label: 'Coal retirement (prime repowering site)', sev: 72 },
  { key: 'gas',       label: 'Gas retirement (interconnection + site)', sev: 60 },
  { key: 'petroleum', label: 'Oil / petroleum retirement', sev: 54 },
  { key: 'nuclear',   label: 'Nuclear retirement (decommission)', sev: 50 },
  { key: 'other',     label: 'Generator retirement', sev: 42 }
];
var SIG = {}; SIGNALS.forEach(function (s) { SIG[s.key] = s; });

function num(v) { if (v == null) return null; if (Array.isArray(v)) v = v[0]; var n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
function str(v) { if (v == null) return ''; if (Array.isArray(v)) v = v[0]; return String(v).trim(); }
function fuelOf(s) {
  s = (s || '').toLowerCase();
  if (/coal|lignite|anthracite/.test(s)) return 'coal';
  if (/gas|methane|lng/.test(s)) return 'gas';
  if (/petrol|oil|diesel|distillate|kerosene|jet fuel/.test(s)) return 'petroleum';
  if (/nuclear|uranium/.test(s)) return 'nuclear';
  return 'other';
}

// obj = { <fieldName>: value } for one EIA generator record. Fuzzy-matched so an EIA field rename
// degrades gracefully instead of silently dropping the field.
function fromRecord(obj) {
  var keys = Object.keys(obj || {});
  function pick(re) { for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) return obj[keys[i]]; return null; }
  var techStr = str(pick(/technology/i)) + ' ' + str(pick(/energy.?source/i)) + ' ' + str(pick(/prime.?mover/i));
  var d = {
    source: 'EIA-860M',
    plant: str(pick(/plant.?name|plantname/i)) || ('Plant ' + str(pick(/^plantid$|plant.?id/i))),
    plantId: str(pick(/^plantid$|plant.?id/i)),
    generatorId: str(pick(/generator.?id/i)),
    state: str(pick(/^stateid$|state/i)),
    sector: str(pick(/^sector|sectorName|sector.?description/i)),
    capacityMw: num(pick(/nameplate.*capacity|net.?summer.*capacity|capacity.?mw/i)),
    technology: str(pick(/technology/i)) || techStr.trim(),
    interconnect: str(pick(/balancing.?authority.?name|balancing.?authority/i)),
    status: str(pick(/statusdescription|^status/i)),
    retireYear: num(pick(/planned.?retirement.?year|retirement.?year/i)),
    retireMonth: num(pick(/planned.?retirement.?month|retirement.?month/i)),
    period: str(pick(/^period$/i))
  };
  d.signalType = fuelOf(techStr);
  d.signalLabel = (SIG[d.signalType] || {}).label || d.signalType;
  d.retireDate = d.retireYear ? (d.retireYear + (d.retireMonth ? '-' + String(d.retireMonth).padStart(2, '0') : '')) : '';
  d.key = ('en|' + d.plantId + '|' + d.generatorId).replace(/[^0-9a-z|.\-]/gi, '');
  return d;
}

// a record is a live deal only if it has a planned retirement in the future (or status says retiring)
function isRetiring(d) {
  if (/retir/i.test(d.status || '')) return true;
  if (!d.retireYear) return false;
  var now = new Date();
  var m = (d.retireYear - now.getUTCFullYear()) * 12 + ((d.retireMonth || 6) - (now.getUTCMonth() + 1));
  return m >= -6 && m <= 240; // within ~-6 months to 20 years
}

function scoreEnergy(d) {
  var reasons = [], sig = SIG[d.signalType] || {}, score = sig.sev || 40;
  reasons.push((sig.label || d.signalType || '').toUpperCase());
  // capacity ~ interconnection value (the moat). Bigger = more valuable ready interconnect.
  if (d.capacityMw != null && d.capacityMw >= 500) { score += 16; reasons.push('LARGE-500MW+'); }
  else if (d.capacityMw != null && d.capacityMw >= 100) { score += 9; reasons.push('MID-100MW+'); }
  else if (d.capacityMw != null && d.capacityMw >= 25) { score += 4; reasons.push('25MW+'); }
  if (d.interconnect) { score += 5; reasons.push('INTERCONNECT'); }
  // imminence — nearer retirement = more actionable now
  if (d.retireYear) {
    var now = new Date();
    var mo = (d.retireYear - now.getUTCFullYear()) * 12 + ((d.retireMonth || 6) - (now.getUTCMonth() + 1));
    if (mo <= 18) { score += 12; reasons.push('IMMINENT-18MO'); }
    else if (mo <= 36) { score += 6; reasons.push('NEAR-36MO'); }
    else if (mo > 84) { reasons.push('long-horizon'); }
  }
  var tier, label;
  if (score >= 92) { tier = 1; label = 'CRITICAL'; }
  else if (score >= 66) { tier = 2; label = 'PRIME'; }
  else if (score >= 48) { tier = 3; label = 'WATCH'; }
  else { tier = 4; label = 'EARLY'; }
  return { tier: tier, tierLabel: label, priority: score, workFirst: tier <= 2, signals: reasons };
}
function enrichEnergy(d) { var s = scoreEnergy(d); d.tier = s.tier; d.tierLabel = s.tierLabel; d.priority = s.priority; d.workFirst = s.workFirst; d.signals = s.signals; return d; }

module.exports = { SIGNALS: SIGNALS, SIG: SIG, fuelOf: fuelOf, fromRecord: fromRecord, isRetiring: isRetiring, scoreEnergy: scoreEnergy, enrichEnergy: enrichEnergy };
