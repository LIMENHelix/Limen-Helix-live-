// Test harness for live-discoveries.js (Feed → Discovery, Stage 1). node _test-live-discoveries.cjs
const assert = require('assert');
const path = require('path');
let pass = 0, fail = 0;
function t(n, fn){ try{ fn(); pass++; console.log('  PASS  '+n);}catch(e){ fail++; console.log('  FAIL  '+n+'  -> '+(e&&e.message)); } }

const emitted = [];
global.window = {
  addEventListener(){}, dispatchEvent(e){ emitted.push(e); return true; },
  CustomEvent: function(type, opts){ this.type=type; this.detail=opts&&opts.detail; }
};
global.CustomEvent = global.window.CustomEvent;
global.document = { readyState:'complete', addEventListener(){}, getElementById(){return null;},
  createElement(){ return { textContent:'', appendChild(){} }; }, head:{ appendChild(){} } };

// Mock the 20-brain accessor with two domains (one high-stress, one mid).
global.window.LIMENDomainBrainBase = { getAllStates: function(){ return {
  energy:  { stress: 1.0, phaseLabel:'INSTABILITY', diagnoses:[
    { id:'e1', label:'grid instability', active:true,  relevance:0.5, matchedConditions:2, totalTriggers:4, summary:'sustained load stress' },
    { id:'e2', label:'inactive one',     active:false, relevance:0.9 } ] },
  finance: { stress: 0.4, diagnoses:[
    { id:'f1', label:'liquidity squeeze', active:true, relevance:0.8, matchedConditions:4, totalTriggers:5 } ] }
};}};

const ld = require(path.join(__dirname, 'assets/js/live-discoveries.js'));

console.log('compute() — feed-weighted discoveries from live diagnoses:');
t('builds discoveries only from ACTIVE diagnoses', function(){
  var list = ld.compute();
  assert(list.length === 2, 'expected 2 active, got '+list.length); // e2 inactive excluded
});
t('weights by feed-stress: energy(stress1.0) outranks finance(stress0.4)', function(){
  var list = ld.compute();
  assert(list[0].domain === 'energy', 'energy should rank first, got '+list[0].domain);
  // energy e1: 1.0*0.6 + 0.5*0.4 = 0.80 ; finance f1: 0.4*0.6 + 0.8*0.4 = 0.56
  assert(Math.abs(list[0].score - 0.80) < 0.001, 'energy score '+list[0].score);
  assert(Math.abs(list[1].score - 0.56) < 0.001, 'finance score '+list[1].score);
});
t('discoveries are labeled INFERRED (a diagnosis), never proven', function(){
  var list = ld.compute();
  assert(list[0].evidenceState === 'inferred');
});
t('emits limen:live-discoveries-updated', function(){
  emitted.length = 0; ld.compute();
  assert(emitted.some(function(e){ return e.type === 'limen:live-discoveries-updated'; }));
});

console.log('renderInto() — DARK vs armed:');
t('DARK (flag off): renders NOTHING', function(){
  delete global.window.LIMEN_ENABLE_LIVE_DISCOVERIES;
  var el = { innerHTML: 'x' }; ld.renderInto(el);
  assert(el.innerHTML === '', 'dark must render empty, got: '+el.innerHTML);
});
t('ARMED: renders the section as DIAGNOSIS, with no "proven" wording', function(){
  global.window.LIMEN_ENABLE_LIVE_DISCOVERIES = true;
  ld.compute();
  var el = { innerHTML: '' }; ld.renderInto(el);
  assert(/LIVE DISCOVERIES/.test(el.innerHTML), 'should have a title');
  assert(/grid instability/.test(el.innerHTML), 'should list the diagnosis');
  assert(/DIAGNOSIS/.test(el.innerHTML), 'should badge as DIAGNOSIS');
  assert(!/proven/i.test(el.innerHTML), 'must NOT imply proven');
});

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail ? 1 : 0);
