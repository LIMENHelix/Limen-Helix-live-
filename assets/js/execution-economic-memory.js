/**
 * execution-economic-memory.js — Economic History Ledger
 * Persists economic totals from claims/outcomes/payouts.
 * Exposes: window.LIMENExecution.phase6.economicMemory
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase6=window.LIMENExecution.phase6||{};
  var K='LIMEN_EXECUTION_ECONOMIC_MEMORY';
  function load(){try{return JSON.parse(localStorage.getItem(K)||'null')}catch(e){return null}}
  function save(d){try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}}
  function rebuild(){
    var l=window.LIMENClaimLedger,o=window.LIMENExecution.outcomes;
    var claims=l?l.getAllClaims():[];var outcomes=o?o.getAllOutcomes():[];
    var mem={totals:{estimatedGross:0,realizedGross:0,estOperator:0,realOperator:0,estPlatform:0,realPlatform:0},byType:{},byDomain:{},byMonth:{},recentEvents:[],rebuiltAt:Date.now()};
    for(var i=0;i<claims.length;i++){var c=claims[i];mem.totals.estimatedGross+=(c.estimatedValue||0);mem.totals.estOperator+=(c.estimatedOperatorPayout||0);mem.totals.estPlatform+=(c.estimatedPlatformValue||0);
      var t=c.type||'other';if(!mem.byType[t])mem.byType[t]={estGross:0,realGross:0,count:0};mem.byType[t].estGross+=(c.estimatedValue||0);mem.byType[t].count++;
      var d=c.domain||'unknown';if(!mem.byDomain[d])mem.byDomain[d]={estGross:0,realGross:0,count:0};mem.byDomain[d].estGross+=(c.estimatedValue||0);mem.byDomain[d].count++;
      var mo=new Date(c.claimedAt||Date.now()).toISOString().slice(0,7);if(!mem.byMonth[mo])mem.byMonth[mo]={claims:0,value:0};mem.byMonth[mo].claims++;mem.byMonth[mo].value+=(c.estimatedValue||0)}
    for(var j=0;j<outcomes.length;j++){var oc=outcomes[j];mem.totals.realizedGross+=(oc.outcomeValue||0);mem.totals.realOperator+=(oc.finalPayoutEstimate||0);mem.totals.realPlatform+=Math.max(0,(oc.outcomeValue||0)-(oc.finalPayoutEstimate||0));
      var t2=oc.type||'other';if(mem.byType[t2])mem.byType[t2].realGross+=(oc.outcomeValue||0);
      var d2=oc.domain||'unknown';if(mem.byDomain[d2])mem.byDomain[d2].realGross+=(oc.outcomeValue||0)}
    save(mem);return mem
  }
  function get(){return load()||rebuild()}
  function getTotals(){return get().totals}
  function getByType(t){return(get().byType||{})[t]||null}
  function getByDomain(d){return(get().byDomain||{})[d]||null}
  function appendEvent(evt){var m=get();m.recentEvents.push({type:evt.type,detail:evt.detail,timestamp:Date.now()});if(m.recentEvents.length>100)m.recentEvents=m.recentEvents.slice(-100);save(m)}
  window.LIMENExecution.phase6.economicMemory={rebuild:rebuild,get:get,getTotals:getTotals,getByType:getByType,getByDomain:getByDomain,appendEvent:appendEvent};
})();
