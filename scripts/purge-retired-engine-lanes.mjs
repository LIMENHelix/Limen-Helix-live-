#!/usr/bin/env node
/**
 * Remove generated application artifacts for retired engine lanes.
 *
 * Active output is intentionally limited to research and investment. This
 * migration deletes patent/grant/SBA/franchise payloads embedded in company
 * portal records, repairs their counts, and rebuilds the tracked Master Brain
 * inbox from the same post-purge corpus.
 *
 *   node scripts/purge-retired-engine-lanes.mjs          # measure only
 *   node scripts/purge-retired-engine-lanes.mjs --apply  # rewrite corpus + inbox
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildInbox } = require('../lib/master-brain-consumer.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPANY_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const INBOX_PATH = path.join(ROOT, 'assets', 'data', '_master-inbox.json');
const VERBIAGE_PATH = path.join(ROOT, 'assets', 'data', 'verbiage-templates.json');
const REPORT_PATH = path.join(ROOT, 'assets', 'data', 'audit', 'retired-engine-lane-purge.json');
const ACTIVE = ['investment', 'research'];
const RETIRED = ['patent', 'grant', 'sba', 'franchise'];
const APPLY = process.argv.includes('--apply');

const verbiageRaw = fs.readFileSync(VERBIAGE_PATH, 'utf8');
const verbiage = JSON.parse(verbiageRaw);
const verbiageBefore = Buffer.byteLength(verbiageRaw, 'utf8');
verbiage.schemaVersion = 'verbiage/2.0_research_investment_only';
verbiage.description = 'Investment-lane language templates. Research uses the bounded research schema in lib/engine-output-generator.js. Patent, grant, SBA, and franchise application templates are retired.';
verbiage.lanes = { investment: verbiage.lanes && verbiage.lanes.investment };
verbiage.engineHooks = { investmentEngine: verbiage.engineHooks && verbiage.engineHooks.investmentEngine };
const verbiageOutput = JSON.stringify(verbiage, null, /\r?\n/.test(verbiageRaw) ? 2 : null);

const files = fs.readdirSync(COMPANY_DIR)
  .filter(name => name.endsWith('.json') && !name.startsWith('_'))
  .sort();

const portals = [];
const removed = Object.fromEntries(RETIRED.map(lane => [lane, { artifacts: 0, bytes: 0, portals: 0 }]));
let portalsChanged = 0;

for (const name of files) {
  const file = path.join(COMPANY_DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  const portal = JSON.parse(raw);
  const indentation = /\r?\n/.test(raw) ? 2 : null;
  const output = portal.engineOutputs;
  let changed = false;

  if (output && typeof output === 'object' && !Array.isArray(output)) {
    for (const lane of RETIRED) {
      if (!Object.prototype.hasOwnProperty.call(output, lane)) continue;
      const artifacts = Array.isArray(output[lane]) ? output[lane] : [];
      removed[lane].artifacts += artifacts.length;
      removed[lane].bytes += Buffer.byteLength(JSON.stringify(output[lane]), 'utf8');
      if (artifacts.length) removed[lane].portals++;
      delete output[lane];
      changed = true;
    }

    const counts = {};
    for (const lane of ACTIVE) counts[lane] = Array.isArray(output[lane]) ? output[lane].length : 0;
    const total = counts.investment + counts.research;
    if (JSON.stringify(output.artifactsByLane || {}) !== JSON.stringify(counts)) changed = true;
    if (output.totalArtifacts !== total) changed = true;
    output.artifactsByLane = counts;
    output.totalArtifacts = total;
    output.generatorVersion = '2.0_research_investment_only';
  }

  if (changed) {
    portalsChanged++;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(portal, null, indentation));
  }
  portals.push(portal);
}

const inbox = buildInbox(portals);
const report = {
  schemaVersion: 'retired-engine-lane-purge/1.0',
  generatedAt: new Date().toISOString(),
  sourceCommit: '7e12bde88075ad748824f962402717c06e88da44',
  activeLanes: ACTIVE,
  retiredLanes: RETIRED,
  portalsScanned: files.length,
  portalsChanged,
  removed,
  removedTotals: {
    artifacts: RETIRED.reduce((n, lane) => n + removed[lane].artifacts, 0),
    bytes: RETIRED.reduce((n, lane) => n + removed[lane].bytes, 0)
  },
  verbiageTemplates: {
    beforeBytes: verbiageBefore,
    afterBytes: Buffer.byteLength(verbiageOutput, 'utf8'),
    activeKeys: Object.keys(verbiage.lanes)
  },
  rebuiltInbox: {
    totalCandidates: inbox.stats.totalCandidates,
    readyToFire: inbox.stats.readyToFire,
    byLaneReady: inbox.stats.byLaneReady
  },
  applied: APPLY
};

if (APPLY) {
  fs.writeFileSync(VERBIAGE_PATH, verbiageOutput);
  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2));
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));
