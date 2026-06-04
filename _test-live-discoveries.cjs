// Test harness for live-discoveries.js (Feed → Discovery, Stage 1 + 2). node _test-live-discoveries.cjs
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
global.window.LIMENDomainBrainBase = { getAllStates: function(){ return {
  energy:  { stress: 1.0, phaseLabel:'INSTABILITY', diagnoses:[
    { id:'e1', label:'grid instability', active:true, relevance:0.5, matchedConditions:2, totalTriggers:4, summary:'sustained load stress' } ] },
  finance: { stress: 0.4, diagnoses:[
    { id:'f1', label:'liquidity squeeze', active:true, relevance:0.8, matchedConditions:4, totalTriggers:5 } ] }
};}};

// Mock the Stage-2 cube index fetch
const CUBE = { byDomain: {
  energy:  [
    { treatment:'biofeedback', port:'Port to energy', novelty:0.7, feasibility:0.5, percentVerified:0.3, node:'AI', rationale:'port the mechanism' },
    { treatment:'EMDR', port:'Port to energy', novelty:0.5, feasibility:0.5, percentVerified:0.2, node:'AI', rationale:'x' },
    { treatment:'SSRI', port:'Port to energy', novelty:0.5, feasibility:0.4, percentVerified:0.2, node:'AI', rationale:'x' },
    { treatment:'exposure', port:'Port to energy', novelty:0.4, feasibility:0.4, percentVerified:0.2, node:'AI', rationale:'x' }
  ],
  finance: [{ treatment:'CBT', port:'Port to finance', novelty:0.6, feasibility:0.6, percentVerified:0.6, node:'vmPFC', rationale:'port the mechanism' }]
}};
global.fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(CUBE); } }); };

const ld = require(path.join(__dirname, 'assets/js/live-discoveries.js'));

(async function () {
  console.log('Stage 1 — brain-diagnosis discoveries (before cube loads):');
  t('builds from ACTIVE diagnoses, feed-stress weighted (energy > finance)', function(){
    var l = ld.compute().filter(function(d){ return d.type === 'diagnosis'; });
    assert(l.length === 2, 'expected 2 diagnoses, got '+l.length);
    var e = l.find(function(d){return d.domain==='energy';}), f = l.find(function(d){return d.domain==='finance';});
    assert(Math.abs(e.score - 0.80) < 0.001, 'energy diag score '+e.score);
    assert(Math.abs(f.score - 0.56) < 0.001, 'finance diag score '+f.score);
  });
  t('diagnoses badged inferred, never proven', function(){
    var l = ld.compute(); assert(l[0].evidenceState === 'inferred');
  });

  // let the mocked cube fetch resolve + recompute
  await new Promise(function(r){ setTimeout(r, 30); });

  console.log('Stage 2 — cube residual-discoveries merged (feed-weighted):');
  t('cube discoveries now appear (type=discovery)', function(){
    var disc = ld.compute().filter(function(d){ return d.type === 'discovery'; });
    assert(disc.length >= 2, 'expected cube discoveries, got '+disc.length);
  });
  t('cube discovery weighted by live stress: energy outranks finance', function(){
    var disc = ld.compute().filter(function(d){ return d.type === 'discovery'; });
    var e = disc.find(function(d){return d.domain==='energy';}), f = disc.find(function(d){return d.domain==='finance';});
    // energy: 0.6*1.0 + 0.4*(0.7*0.5)=0.74 ; finance: 0.6*0.4 + 0.4*(0.6*0.6)=0.384
    assert(Math.abs(e.score - 0.74) < 0.001, 'energy cube score '+e.score);
    assert(e.score > f.score, 'energy cube should outrank finance');
  });
  t('cube discovery label shows treatment → domain', function(){
    var disc = ld.compute().filter(function(d){ return d.type === 'discovery' && d.domain==='energy'; })[0];
    assert(/biofeedback/.test(disc.label) && /energy/.test(disc.label), 'label: '+disc.label);
  });
  t('ARMED render shows BOTH DIAGNOSIS and DISCOVERY badges, no "proven"', function(){
    global.window.LIMEN_ENABLE_LIVE_DISCOVERIES = true;
    ld.compute();
    var el = { innerHTML:'' }; ld.renderInto(el);
    assert(/DIAGNOSIS/.test(el.innerHTML), 'should have DIAGNOSIS');
    assert(/DISCOVERY/.test(el.innerHTML), 'should have DISCOVERY');
    assert(!/proven/i.test(el.innerHTML), 'must not imply proven');
  });
  t('DARK render still produces nothing', function(){
    delete global.window.LIMEN_ENABLE_LIVE_DISCOVERIES;
    var el = { innerHTML:'x' }; ld.renderInto(el);
    assert(el.innerHTML === '', 'dark must be empty');
  });

  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail ? 1 : 0);
})();
