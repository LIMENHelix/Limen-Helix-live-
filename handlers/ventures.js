/**
 * handlers/ventures.js — /api/ventures — the venture registry + stand-up gateway.
 *
 * The efferent arc's organizing backbone: takes a domain's sensed opportunities/nodes, runs them
 * through lib/venture-engine (node -> ANY-archetype venture portfolio, capital-ladder L1..L6
 * classified, afferent-feeder-first, compounding funding chain), stores them in a per-domain
 * registry, and serves them organized by capital level. Also returns the option-(b) stand-up
 * scaffold for a chosen venture (the landing page / offer / storefront to actually build it).
 *
 * Deterministic + no-cost. Paid AI only DEEPENS a stand-up when the domain is "run" (env-gated).
 * Admin-gated (isMaster). Nothing here contacts a buyer or spends - it organizes + scaffolds.
 *
 *   POST /api/ventures?key=<master>   body { domain, opportunities:[...] }  -> generate + store, return portfolio
 *   GET  /api/ventures?key=<master>&domain=X                                -> the stored registry, ladder-organized
 *   GET  /api/ventures?key=<master>&domain=X&standup=<ventureId>            -> the stand-up scaffold for one venture
 */
var db = require('../lib/limen-db');
var gate = require('../lib/admin-gate');
var V = require('../lib/venture-engine');

function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 4e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }
function key(domain) { return 'ventures:' + String(domain || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function vid(v, i) { return (v.domain || 'x') + '-' + v.archetype + '-' + i; }

// Group a flat venture list by capital rung, with the compounding funding chain.
function organize(ventures) {
  var byRung = { L1: [], L2: [], L3: [], L4: [], L5: [], L6: [] };
  ventures.forEach(function (v) { (byRung[v.capital] || (byRung[v.capital] = [])).push(v); });
  var rungs = Object.keys(byRung).filter(function (k) { return byRung[k].length; })
    .sort(function (a, b) { return (V.CAPITAL[a].level) - (V.CAPITAL[b].level); })
    .map(function (k) { return { capital: k, level: V.CAPITAL[k].level, desc: V.CAPITAL[k].desc, ventures: byRung[k] }; });
  return { count: ventures.length, rungs: rungs, funding: V.fundingChain(ventures),
    l1First: ventures.filter(function (v) { return v.capital === 'L1'; }).map(function (v) { return v.title; }),
    note: 'Run L1 (own-nothing, afferent feeders) first; each completed rung funds the next (compounding). Never retire a rung.' };
}

module.exports = async function handler(req, res) {
  var pass = gate.reqKey(req);
  if (!gate.isMaster(pass)) return gate.deny(res);
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var method = (req.method || 'GET').toUpperCase();

  if (method === 'POST') {
    var body = await readBody(req);
    var domain = body.domain || 'unknown';
    var opps = Array.isArray(body.opportunities) ? body.opportunities : (body.opportunity ? [body.opportunity] : []);
    if (!opps.length) return j(res, 400, { ok: false, error: 'no opportunities in body' });
    // node -> venture portfolio for every opportunity, tagged + id'd
    var ventures = [];
    opps.forEach(function (opp, oi) {
      if (!opp.domain) opp.domain = domain;
      V.generateVentures(opp).forEach(function (v, vi) { v.id = vid(v, oi * 100 + vi); v.generatedFrom = opp.biz || opp.business || opp.node || null; ventures.push(v); });
    });
    var payload = { domain: domain, updated: Date.now(), ventures: ventures };
    try { await db.set(key(domain), payload); } catch (e) {}
    return j(res, 200, { ok: true, stored: ventures.length, organized: organize(ventures) });
  }

  // GET
  var domainQ = u.searchParams.get('domain') || 'unknown';
  var standupId = u.searchParams.get('standup');
  var reg = null; try { reg = await db.get(key(domainQ)); } catch (e) {}
  var ventures = (reg && Array.isArray(reg.ventures)) ? reg.ventures : [];
  if (standupId) {
    var v = ventures.filter(function (x) { return x.id === standupId; })[0];
    if (!v) return j(res, 404, { ok: false, error: 'venture not found' });
    return j(res, 200, { ok: true, venture: v, standUp: v.standUp, skillChain: v.skillChain,
      note: v.capital === 'L1' ? 'L1 own-nothing: stand up the free capture page now (web-artifacts-builder -> /api/lead).'
        : 'Higher rung: needs capital / a run (AI copy) / operator sign. SEND + SPEND stay gated.' });
  }
  return j(res, 200, { ok: true, domain: domainQ, updated: (reg && reg.updated) || null, organized: organize(ventures) });
};
