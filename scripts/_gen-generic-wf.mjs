// generate the GENERIC-issue best-node audit workflow (all 9,688), payload embedded compactly
import fs from 'node:fs';
const SP = 'C:/Users/Chris/AppData/Local/Temp/claude/C--Users-Chris-Limen-Helix-live-/e3faa59a-4294-4c5a-b80f-b6d734886f4f/scratchpad/';
const nodes = JSON.parse(fs.readFileSync(SP + 'audit-payload.json', 'utf8')).nodes; // reuse node ref
const gen = JSON.parse(fs.readFileSync(SP + 'generic-list.json', 'utf8'));

const TYPES = ['system failure', 'capacity overload', 'quality degradation', 'governance gap', 'coordination breakdown'];
const tcode = {}; TYPES.forEach((t, i) => tcode[t] = i);
// compact tuples [label, typeCode]
const ITEMS = gen.map(g => [g.label, tcode[g.type]]);

const script = `export const meta = {
  name: 'generic-issue-node-audit',
  description: 'Best-fit node for all 9,688 generic failure-type issues (subtopic x mechanism), strict per issue',
  phases: [{ title: 'Judge', detail: 'parallel batches pick the best node per issue' }]
}

const NODES = ${JSON.stringify(nodes)};
const TYPES = ${JSON.stringify(TYPES)};
const ITEMS = ${JSON.stringify(ITEMS)};

const NODE_REF = Object.keys(NODES).map(function (id) {
  var r = NODES[id];
  return id + (r.m ? '/' + r.m : '') + ' — ' + r.role + '  [hyper: ' + (r.hyper || '?') + ' | hypo: ' + (r.hypo || '?') + ']';
}).join('\\n');

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          i: { type: 'integer', description: '1-based position in the batch listing' },
          node: { type: 'string', description: 'best-fit real node id' },
          dir: { type: 'string', enum: ['hyper', 'hypo'] }
        },
        required: ['i', 'node', 'dir']
      }
    }
  },
  required: ['results']
};

const BATCH = 45;
const batches = [];
for (var i = 0; i < ITEMS.length; i += BATCH) batches.push({ start: i, items: ITEMS.slice(i, i + BATCH) });
log(ITEMS.length + ' generic issues in ' + batches.length + ' batches');

phase('Judge');
const raw = await parallel(batches.map(function (b, bi) {
  return function () {
    var listing = b.items.map(function (it, k) {
      return (k + 1) + '. ' + it[0] + '   [failure type: ' + TYPES[it[1]] + ']';
    }).join('\\n');
    var prompt =
      'You are a computational neuroscientist AND domain analyst. For each item, pick the SINGLE brain-connectome node + direction (hyper/hypo) whose regulatory failure grammar best names that failure.\\n\\n' +
      'The failure TYPE is the mechanism; the subtopic before it is the domain context. Node reference (function + hyper/hypo meaning):\\n\\n' +
      NODE_REF + '\\n\\n' +
      'RULES: choose by MECHANISM, not keyword. A capacity/throughput overload = a gating node flooding (THAL hyper). A quality/error problem = an error-monitor/forward-model (dACC or CBLM). A system failure/collapse = a brake or gate failing (STN, vmPFC, THAL). A governance/oversight gap = the inhibitory brake failing (vmPFC/vlPFC hypo). BUT if the subtopic explicitly names a specific circuit (reward, memory, executive, attention, fear/threat, motor, language, homeostasis/supply, capital/credit), map to THAT circuit instead. Never pick a pure sensory/visual/auditory relay (LGN, MGN, V1, A1) for a socio-economic subtopic. Pick the direction that matches what actually goes wrong.\\n\\n' +
      'Return one result per item with its 1-based index i.\\n\\nITEMS:\\n' + listing;
    return agent(prompt, { label: 'gjudge:' + (b.start + 1), phase: 'Judge', schema: SCHEMA, model: 'sonnet' })
      .then(function (r) {
        var out = [];
        ((r && r.results) || []).forEach(function (x) {
          var it = b.items[x.i - 1];
          if (it) out.push({ label: it[0], node: String(x.node).split('/')[0], dir: x.dir });
        });
        return out;
      })
      .catch(function () { return []; });
  };
}));

const flat = raw.flat().filter(Boolean);
log('judged ' + flat.length + ' generic issues');
return { total: flat.length, results: flat };
`;

fs.writeFileSync(SP + 'generic-workflow.mjs', script);
console.log('wrote generic-workflow.mjs (' + (script.length / 1024).toFixed(0) + 'KB), items ' + ITEMS.length + ', batches ' + Math.ceil(ITEMS.length / 45));
