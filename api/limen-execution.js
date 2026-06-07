/**
 * api/limen-execution.js — Execution State Persistence
 *
 * GET  /api/limen-execution?domain=energy
 * POST /api/limen-execution  { domain, action, data }
 *
 * Actions:
 *   claim_opportunity  { opportunity_id, claimed_by }
 *   update_opportunity { opportunity_id, status, last_action }
 *   create_execution   { opportunity_id, action_type }
 *   update_execution   { execution_id, status }
 *   create_outcome     { opportunity_id, execution_id, type, value }
 *
 * Stores in Redis: limen:execution_{domain}
 * TTL: 30 days
 */

var db = require('../lib/limen-db');

var TTL = 2592000; // 30 days

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  var domain = (req.method === 'GET' ? (req.query && req.query.domain) : (req.body && req.body.domain)) || 'energy';
  var key = 'execution_' + domain;

  // GET: return full execution state
  if (req.method === 'GET') {
    var state = await db.get(key);
    if (!state) state = { opportunities: {}, executions: [], outcomes: [], updatedAt: 0 };
    res.status(200).json({ ok: true, domain: domain, state: state });
    return;
  }

  // POST: mutate execution state
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !body.action) { res.status(400).json({ ok: false, error: 'action required' }); return; }

    var state = await db.get(key);
    if (!state) state = { opportunities: {}, executions: [], outcomes: [], updatedAt: 0 };
    var now = Date.now();

    switch (body.action) {

      case 'claim_opportunity': {
        var oid = body.data && body.data.opportunity_id;
        if (!oid) { res.status(400).json({ ok: false, error: 'opportunity_id required' }); break; }
        if (!state.opportunities[oid]) state.opportunities[oid] = {};
        var opp = state.opportunities[oid];
        if (opp.status === 'CLAIMED' || opp.status === 'IN_PROGRESS') {
          res.status(200).json({ ok: true, already_claimed: true, claimed_by: opp.claimed_by });
          return;
        }
        opp.status = 'CLAIMED';
        opp.claimed_by = (body.data && body.data.claimed_by) || 'LOCAL_USER';
        opp.claimed_at = now;
        opp.last_action = 'Claimed';
        opp.last_updated_at = now;
        break;
      }

      case 'update_opportunity': {
        var oid2 = body.data && body.data.opportunity_id;
        if (!oid2) { res.status(400).json({ ok: false, error: 'opportunity_id required' }); break; }
        if (!state.opportunities[oid2]) state.opportunities[oid2] = {};
        var opp2 = state.opportunities[oid2];
        if (body.data.status) opp2.status = body.data.status;
        if (body.data.last_action) opp2.last_action = body.data.last_action;
        // Clear ownership on release
        if (body.data.status === 'UNCLAIMED') {
          opp2.claimed_by = null;
          opp2.claimed_at = null;
        }
        opp2.last_updated_at = now;
        break;
      }

      case 'create_execution': {
        var execId = 'exec_' + now + '_' + Math.random().toString(36).substr(2, 4);
        var exec = {
          id: execId,
          opportunity_id: (body.data && body.data.opportunity_id) || null,
          action_type: (body.data && body.data.action_type) || 'GRANT',
          status: 'GENERATED',
          created_at: now,
          updated_at: now
        };
        state.executions.push(exec);
        // Update opportunity last_action
        if (exec.opportunity_id && state.opportunities[exec.opportunity_id]) {
          state.opportunities[exec.opportunity_id].last_action = exec.action_type + ' generated';
          state.opportunities[exec.opportunity_id].last_updated_at = now;
          if (state.opportunities[exec.opportunity_id].status === 'CLAIMED') {
            state.opportunities[exec.opportunity_id].status = 'IN_PROGRESS';
          }
        }
        if (state.executions.length > 200) state.executions = state.executions.slice(-200);
        res.status(200).json({ ok: true, execution_id: execId });
        state.updatedAt = now;
        await db.set(key, state, TTL);
        return;
      }

      case 'update_execution': {
        var eid = body.data && body.data.execution_id;
        for (var i = 0; i < state.executions.length; i++) {
          if (state.executions[i].id === eid) {
            if (body.data.status) state.executions[i].status = body.data.status;
            state.executions[i].updated_at = now;
            break;
          }
        }
        break;
      }

      case 'create_outcome': {
        var outcome = {
          id: 'out_' + now + '_' + Math.random().toString(36).substr(2, 4),
          opportunity_id: (body.data && body.data.opportunity_id) || null,
          execution_id: (body.data && body.data.execution_id) || null,
          type: (body.data && body.data.type) || 'FUNDING',
          value: (body.data && body.data.value) || 0,
          description: (body.data && body.data.description) || '',
          timestamp: now
        };
        state.outcomes.push(outcome);
        if (state.outcomes.length > 100) state.outcomes = state.outcomes.slice(-100);
        break;
      }

      default:
        res.status(400).json({ ok: false, error: 'unknown action: ' + body.action });
        return;
    }

    state.updatedAt = now;
    await db.set(key, state, TTL);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
