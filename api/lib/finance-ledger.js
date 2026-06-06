/**
 * finance-ledger.js — the Finance Domain's self-audit substrate.
 *
 * Records every income and spend event in Redis (via limen-db, which falls back
 * to in-memory per cold start). Computes per-stream P&L, domain financial health,
 * and the lendable surplus that — once sign-off lands — funds peer domains.
 *
 * This module RECORDS and COMPUTES. It never moves money.
 *
 * Keys (limen-db auto-prefixes with "limen:"):
 *   finance:ledger        list of event objects (newest first)
 *   finance:reserve-floor scalar operating reserve the engine must keep
 */
const db = require('./limen-db');

const LEDGER_KEY = 'finance:ledger';
const RESERVE_KEY = 'finance:reserve-floor';
const MAX_LEDGER = 5000;

function _now() { return new Date().toISOString(); }

// type: 'income' | 'spend' | 'fee-proposed' | 'lend-proposed' | 'audit'
async function record(evt) {
  const e = {
    ts: _now(),
    type: evt.type,
    streamId: evt.streamId || null,
    amount: typeof evt.amount === 'number' ? evt.amount : 0,   // USD, positive number
    currency: evt.currency || 'usd',
    source: evt.source || 'system',
    meta: evt.meta || {}
  };
  await db.lpush(LEDGER_KEY, e);
  await db.ltrim(LEDGER_KEY, 0, MAX_LEDGER - 1);
  return e;
}

async function events(limit) {
  return await db.lrange(LEDGER_KEY, 0, (limit || 500) - 1);
}

async function getReserveFloor() {
  const v = await db.get(RESERVE_KEY);
  return typeof v === 'number' ? v : 0;
}
async function setReserveFloor(n) { await db.set(RESERVE_KEY, Number(n) || 0); return true; }

// Aggregate: per-stream P&L + domain totals + health + lendable surplus.
async function summary() {
  const evs = await events(MAX_LEDGER);
  const byStream = {};
  let income = 0, spend = 0;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (!byStream[e.streamId || '_unattributed']) byStream[e.streamId || '_unattributed'] = { streamId: e.streamId || '_unattributed', income: 0, spend: 0, net: 0, events: 0 };
    const s = byStream[e.streamId || '_unattributed'];
    s.events++;
    if (e.type === 'income') { s.income += e.amount; income += e.amount; }
    else if (e.type === 'spend' || e.type === 'fee') { s.spend += e.amount; spend += e.amount; }
    s.net = s.income - s.spend;
  }
  const net = income - spend;
  const reserveFloor = await getReserveFloor();
  const lendableSurplus = Math.max(0, net - reserveFloor);

  // financial health 0..1: positive net + diversified income + low burn ratio
  const activeStreams = Object.values(byStream).filter(function (s) { return s.income > 0; }).length;
  const burnRatio = income > 0 ? spend / income : (spend > 0 ? 1 : 0);
  const diversity = Math.min(1, activeStreams / 5);              // 5+ earning streams = full marks
  const solvency = net >= 0 ? 1 : Math.max(0, 1 + net / (Math.abs(spend) || 1));
  const health = Math.max(0, Math.min(1, 0.5 * solvency + 0.3 * diversity + 0.2 * (1 - Math.min(1, burnRatio))));

  return {
    income, spend, net, reserveFloor, lendableSurplus,
    activeStreams, burnRatio: Number(burnRatio.toFixed(3)),
    health: Number(health.toFixed(3)),
    streams: Object.values(byStream).sort(function (a, b) { return b.net - a.net; }),
    eventCount: evs.length,
    backend: db.getBackend()
  };
}

module.exports = { record, events, summary, getReserveFloor, setReserveFloor };
