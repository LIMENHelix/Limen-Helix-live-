'use strict';

/**
 * identity-coherence.js — one rule for joining a company row to a portal.
 *
 * A Board route is usable only when the normalized Board CIK equals the
 * normalized portal CIK and nonempty tickers do not contradict. A ticker match
 * alone is never sufficient. Missing identity fails closed.
 *
 * Relationship edges are checked more narrowly: an edge that omits a CIK or
 * ticker is resolved by the field it does provide; a present value that
 * contradicts the resolved node is rejected.
 */

function normalizeCik(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const stripped = s.replace(/^0+/, '');
  return stripped === '' ? null : stripped;
}

function tickerKey(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toUpperCase();
  return s || null;
}

function routeCoherent(board, portal) {
  if (!board || !portal) return false;
  const bc = normalizeCik(board.cik !== undefined ? board.cik : board.c);
  const pc = normalizeCik(portal.cik !== undefined ? portal.cik : portal.c);
  if (!bc || !pc || bc !== pc) return false;
  const bt = tickerKey(board.ticker !== undefined ? board.ticker : board.t);
  const pt = tickerKey(portal.ticker !== undefined ? portal.ticker : portal.t);
  if (bt && pt && bt !== pt) return false;
  return true;
}

function edgeCoherent(edge, node) {
  if (!edge || !node) return false;
  const ec = normalizeCik(edge.cik);
  const nc = normalizeCik(node.cik);
  if (ec && nc && ec !== nc) return false;
  const et = tickerKey(edge.ticker);
  const nt = tickerKey(node.ticker);
  if (et && nt && et !== nt) return false;
  return true;
}

module.exports = { normalizeCik, tickerKey, routeCoherent, edgeCoherent };
