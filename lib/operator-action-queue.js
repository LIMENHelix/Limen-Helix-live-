/**
 * operator-action-queue.js — record + read operator decisions on artifacts.
 *
 * Storage: Upstash Redis when KV_REST_API_URL + KV_REST_API_TOKEN are set;
 * otherwise falls back to assets/data/_operator-actions.json (file-based,
 * works locally + for autonomic-loop processing).
 *
 * Action shape:
 *   {
 *     id: '<artifactRef>:<actionTs>',
 *     artifactRef: 'walmart/patent/0',           // portalSlug/lane/index
 *     portalSlug, lane, patternId,               // dehydrated lookup context
 *     action: 'PRINT' | 'REFRESH' | 'DECLINE',
 *     reason?: 'operator note',
 *     requestedAt: ISO timestamp,
 *     processedAt: ISO timestamp | null,
 *     status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
 *     result?: { ...lane-specific result data }
 *   }
 *
 * The queue is processed by:
 *   scripts/process-operator-actions.mjs — drains QUEUED items, dispatches to
 *   print-pipeline.js or refresh-pipeline.js, persists results.
 */
const fs = require('node:fs');
const path = require('node:path');

const QUEUE_FILE = path.join(__dirname, '..', '..', 'assets', 'data', '_operator-actions.json');

function _now() { return new Date().toISOString(); }

function _loadFile() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch (e) { return { schemaVersion: 'operator-actions/1.0', actions: [] }; }
}

function _saveFile(state) {
  state.lastUpdated = _now();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(state, null, 2));
}

// Upstash is the production backend (per existing /api/limen-worker-* crons).
// When env vars present, dispatch there; else file backend.
function _redisEnabled() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
async function _redisCall(method, args) {
  const url = process.env.KV_REST_API_URL + '/' + method.toLowerCase() + '/' + args.map(encodeURIComponent).join('/');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.KV_REST_API_TOKEN } });
  if (!r.ok) throw new Error('redis ' + method + ' ' + r.status);
  return (await r.json()).result;
}

async function recordAction(opts) {
  const action = {
    id: opts.artifactRef + ':' + Date.now(),
    artifactRef: opts.artifactRef,
    portalSlug: opts.portalSlug,
    lane: opts.lane,
    patternId: opts.patternId || null,
    action: opts.action,
    reason: opts.reason || null,
    requestedAt: _now(),
    processedAt: null,
    status: 'QUEUED',
    result: null
  };
  if (_redisEnabled()) {
    await _redisCall('LPUSH', ['limen:operator-actions', JSON.stringify(action)]);
  } else {
    const state = _loadFile();
    state.actions.unshift(action);
    state.actions = state.actions.slice(0, 5000);
    _saveFile(state);
  }
  return action;
}

async function listPending() {
  if (_redisEnabled()) {
    const raw = await _redisCall('LRANGE', ['limen:operator-actions', '0', '500']);
    return (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean).filter(a => a.status === 'QUEUED');
  }
  const state = _loadFile();
  return state.actions.filter(a => a.status === 'QUEUED');
}

async function listAll() {
  if (_redisEnabled()) {
    const raw = await _redisCall('LRANGE', ['limen:operator-actions', '0', '5000']);
    return (raw || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
  }
  return _loadFile().actions;
}

async function updateAction(id, patch) {
  if (_redisEnabled()) {
    // simplification: in production we'd LREM + LPUSH; for now just append updated copy
    const all = await listAll();
    const found = all.find(a => a.id === id);
    if (!found) return null;
    Object.assign(found, patch);
    await _redisCall('LPUSH', ['limen:operator-actions', JSON.stringify(found)]);
    return found;
  }
  const state = _loadFile();
  const a = state.actions.find(x => x.id === id);
  if (!a) return null;
  Object.assign(a, patch);
  _saveFile(state);
  return a;
}

module.exports = { recordAction, listPending, listAll, updateAction };
