// generates the audit workflow script with the payload embedded, so no giant args
import fs from 'node:fs';
const SP = 'C:/Users/Chris/AppData/Local/Temp/claude/C--Users-Chris-Limen-Helix-live-/e3faa59a-4294-4c5a-b80f-b6d734886f4f/scratchpad/';
const p = JSON.parse(fs.readFileSync(SP + 'audit-payload.json', 'utf8'));

const script = `export const meta = {
  name: 'named-diagnosis-node-audit',
  description: 'Judge every named diagnosis node-by-node (hyper/hypo, right/wrong) against the connectome crosswalk',
  phases: [{ title: 'Judge', detail: 'parallel batches grade each node' }]
}

const NODES = ${JSON.stringify(p.nodes)};
const DX = ${JSON.stringify(p.diagnoses)};

const NODE_REF = Object.keys(NODES).map(function (id) {
  var r = NODES[id];
  return id + (r.m ? '/' + r.m : '') + ' — ' + r.role + '  [hyper: ' + (r.hyper || '?') + ' | hypo: ' + (r.hypo || '?') + ']';
}).join('\\n');

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          label: { type: 'string' },
          bestNode: { type: 'string' },
          bestDir: { type: 'string', enum: ['hyper', 'hypo'] },
          bestReading: { type: 'string' },
          nodes: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                node: { type: 'string' },
                dir: { type: 'string' },
                verdict: { type: 'string', enum: ['RIGHT', 'WEAK', 'WRONG'] },
                fix: { type: 'string' }
              },
              required: ['node', 'verdict', 'fix']
            }
          }
        },
        required: ['label', 'bestNode', 'bestDir', 'bestReading', 'nodes']
      }
    }
  },
  required: ['verdicts']
};

const BATCH = 15;
const batches = [];
for (var i = 0; i < DX.length; i += BATCH) batches.push(DX.slice(i, i + BATCH));
log(DX.length + ' named diagnoses in ' + batches.length + ' batches');

phase('Judge');
const results = await parallel(batches.map(function (batch, bi) {
  return function () {
    var listing = batch.map(function (d) {
      return '### ' + d.label + '  (domain: ' + d.domain + ')\\n' +
        (d.summary ? 'mechanism: ' + d.summary + '\\n' : '') +
        'mapped circuits: ' + d.circuits.map(function (c) { return c.n + '(' + (c.d || '?') + ')'; }).join(', ');
    }).join('\\n\\n');
    var prompt =
      'You are a computational neuroscientist AND a domain analyst. Judge how well each diagnosis below is mapped to brain-connectome nodes.\\n\\n' +
      'Each node maps a real-world failure onto a neural regulatory motif, with a hyper/hypo failure meaning:\\n\\n' +
      NODE_REF + '\\n\\n' +
      'RULES for judging each mapped circuit (node + direction):\\n' +
      '- RIGHT: the node function genuinely matches THIS diagnosis mechanism AND the direction (hyper/hypo) matches what actually happens (e.g. credit freeze = capital GATE locked shut = GP hypo).\\n' +
      '- WEAK: plausible but not central to the mechanism.\\n' +
      '- WRONG: the node function is unrelated, OR the direction is inverted. Sensory/visual/auditory relays (LGN, MGN, V1, A1, S1) are almost always WRONG for socio-economic/systemic diagnoses even if a keyword matches.\\n' +
      'For any WEAK/WRONG, put the correct node+direction (or a short why) in "fix". For RIGHT, set fix to "".\\n' +
      'Then give the SINGLE best-fit node (bestNode) + direction (bestDir) whose failure grammar names this diagnosis, and the resulting reading (bestReading).\\n' +
      'Judge by MECHANISM, not keyword overlap. Be strict and consistent.\\n\\n' +
      'DIAGNOSES:\\n\\n' + listing;
    return agent(prompt, { label: 'judge:batch-' + (bi + 1), phase: 'Judge', schema: SCHEMA, model: 'sonnet' })
      .then(function (r) { return (r && r.verdicts) || []; })
      .catch(function () { return []; });
  };
}));

const all = results.flat().filter(Boolean);
log('judged ' + all.length + ' diagnoses');
return { total: all.length, verdicts: all };
`;

fs.writeFileSync(SP + 'audit-workflow.mjs', script);
console.log('wrote audit-workflow.mjs (' + (script.length / 1024).toFixed(0) + 'KB)');
