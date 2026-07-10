// generate the VERIFICATION workflow: adversarially re-judge all 10,205 applied nodes
import fs from 'node:fs';
const SP = 'C:/Users/Chris/AppData/Local/Temp/claude/C--Users-Chris-Limen-Helix-live-/e3faa59a-4294-4c5a-b80f-b6d734886f4f/scratchpad/';
const nodes = JSON.parse(fs.readFileSync(SP + 'audit-payload.json', 'utf8')).nodes;
const applied = JSON.parse(fs.readFileSync('C:/Users/Chris/Limen-Helix-live-/assets/data/diagnosis-node-overrides.json', 'utf8'));

// index the applied nodes to keep the payload compact
const NODEIDS = Array.from(new Set(Object.values(applied).map(o => o.node)));
const nidx = {}; NODEIDS.forEach((n, i) => nidx[n] = i);
// ITEMS: [label, nodeIndex, dirCode(0=hyper,1=hypo)]
const ALL = Object.keys(applied).map(l => [l, nidx[applied[l].node], applied[l].dir === 'hypo' ? 1 : 0]);
const HALF = Math.ceil(ALL.length / 2);
const CHUNKS = [ALL.slice(0, HALF), ALL.slice(HALF)];

CHUNKS.forEach((ITEMS, ci) => {
const script = `export const meta = {
  name: 'applied-node-verification',
  description: 'Adversarial second-opinion on all 10,205 applied diagnosis nodes; flip the wrong ones',
  phases: [{ title: 'Verify', detail: 'parallel batches re-judge each applied node' }]
}

const NODES = ${JSON.stringify(nodes)};
const NIDS = ${JSON.stringify(NODEIDS)};
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
          i: { type: 'integer' },
          ok: { type: 'boolean', description: 'true if the applied node+dir is the best mechanism fit' },
          node: { type: 'string', description: 'if ok=false: the corrected node id (else repeat the applied one)' },
          dir: { type: 'string', enum: ['hyper', 'hypo'] }
        },
        required: ['i', 'ok', 'node', 'dir']
      }
    }
  },
  required: ['results']
};

const BATCH = 50;
const batches = [];
for (var i = 0; i < ITEMS.length; i += BATCH) batches.push(ITEMS.slice(i, i + BATCH));
log(ITEMS.length + ' applied nodes to verify in ' + batches.length + ' batches');

phase('Verify');
const raw = await parallel(batches.map(function (batch, bi) {
  return function () {
    var listing = batch.map(function (it, k) {
      return (k + 1) + '. "' + it[0] + '"  — currently applied: ' + NIDS[it[1]] + ' ' + (it[2] ? 'hypo' : 'hyper');
    }).join('\\n');
    var prompt =
      'You are a strict, skeptical computational neuroscientist reviewing another analyst\\'s node assignments. Each diagnosis was mapped to ONE connectome node + direction. Confirm it is the BEST mechanism fit, or flip it.\\n\\n' +
      'Node reference (function + hyper/hypo meaning):\\n\\n' + NODE_REF + '\\n\\n' +
      'For each item: set ok=true ONLY if the applied node+direction genuinely best names the failure mechanism. If a different node (or the opposite direction) is clearly a better mechanism fit, set ok=false and give the corrected node+dir. Judge by MECHANISM not keyword; never pick a sensory/visual/auditory relay (LGN/MGN/V1/A1/S1) for a socio-economic subtopic. Do not flip on style — only flip a genuine mechanism error. When ok=true, repeat the applied node+dir.\\n\\n' +
      'ITEMS:\\n' + listing;
    return agent(prompt, { label: 'verify:' + (bi * 50 + 1), phase: 'Verify', schema: SCHEMA, model: 'sonnet' })
      .then(function (r) {
        var corr = [];
        ((r && r.results) || []).forEach(function (x) {
          var it = batch[x.i - 1]; if (!it) return;
          if (x.ok === false && x.node) corr.push({ label: it[0], node: String(x.node).split('/')[0], dir: x.dir === 'hypo' ? 'hypo' : 'hyper' });
        });
        return corr;
      })
      .catch(function () { return []; });
  };
}));

const flat = raw.flat().filter(Boolean);
log(flat.length + ' corrections proposed by verification');
// return an OBJECT (not a >4096 array) of corrections only
const corrections = {};
flat.forEach(function (c) { corrections[String(c.label).toLowerCase()] = { node: c.node, dir: c.dir }; });
return { checked: ITEMS.length, correctionCount: Object.keys(corrections).length, corrections: corrections };
`;

const fn = 'verify-wf-' + (ci === 0 ? 'a' : 'b') + '.mjs';
fs.writeFileSync(SP + fn, script);
console.log('wrote ' + fn + ' (' + (script.length / 1024).toFixed(0) + 'KB), items ' + ITEMS.length + ', batches ' + Math.ceil(ITEMS.length / 50));
});
