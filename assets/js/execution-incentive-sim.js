/**
 * execution-incentive-sim.js — Global Incentive Simulation Layer
 * Simulates how policy changes affect operator/platform economics.
 * Does NOT alter live claim or payout values.
 * Exposes: window.LIMENExecution.phase7.incentives
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _currentPolicy(){
    var p=window.LIMENExecution.policy;
    return p&&p.getConfig?p.getConfig():{operatorSharePct:10,successBonusPct:5,platformRetainedPct:90};
  }

  function _simulate(claims,outcomes,policy){
    var totalValue=0,operatorPayout=0,platformRetained=0;
    var byType={GRANT:{value:0,opPay:0},PATENT:{value:0,opPay:0},INVEST:{value:0,opPay:0},BUSINESS:{value:0,opPay:0}};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];
      var val=parseFloat(c.estimatedValue)||0;
      totalValue+=val;
      var opShare=policy.operatorSharePct||10;
      if(policy.successOnly){
        var hasSuccess=false;
        for(var j=0;j<outcomes.length;j++){if(outcomes[j].claimId===c.id&&outcomes[j].result==='success'){hasSuccess=true;break}}
        if(!hasSuccess)opShare=0;
      }
      if(policy.successBonusPct){
        for(var k=0;k<outcomes.length;k++){if(outcomes[k].claimId===c.id&&outcomes[k].result==='success')opShare+=policy.successBonusPct}
      }
      var opPay=val*(opShare/100);
      operatorPayout+=opPay;
      platformRetained+=val-opPay;
      var t=(c.type||c.path||'GRANT').toUpperCase();
      if(byType[t]){byType[t].value+=val;byType[t].opPay+=opPay}
    }
    return{totalValue:Math.round(totalValue),operatorPayout:Math.round(operatorPayout),platformRetained:Math.round(platformRetained),byType:byType};
  }

  function simulateCompensationPolicy(overrides){
    var claims=_claims().filter(function(c){return c.status!=='rejected'});
    var outcomes=_outcomes();
    var policy=_currentPolicy();
    if(overrides){for(var k in overrides)policy[k]=overrides[k]}
    return _simulate(claims,outcomes,policy);
  }

  function comparePolicyScenarios(scenarios){
    var claims=_claims().filter(function(c){return c.status!=='rejected'});
    var outcomes=_outcomes();
    var results=[];
    for(var i=0;i<scenarios.length;i++){
      var s=scenarios[i];
      var policy={};for(var k in _currentPolicy())policy[k]=_currentPolicy()[k];
      if(s.overrides){for(var j in s.overrides)policy[j]=s.overrides[j]}
      var sim=_simulate(claims,outcomes,policy);
      sim.scenarioName=s.name||'Scenario '+(i+1);
      results.push(sim);
    }
    return results;
  }

  function getScenarioSummary(){
    var current=simulateCompensationPolicy({});
    var higher=simulateCompensationPolicy({operatorSharePct:15});
    var lower=simulateCompensationPolicy({operatorSharePct:5});
    var successOnly=simulateCompensationPolicy({operatorSharePct:0,successOnly:true,successBonusPct:20});
    var mixed=simulateCompensationPolicy({operatorSharePct:5,successBonusPct:10});
    return{
      current:{label:'Current Policy',data:current},
      higherOperator:{label:'Higher Operator Share (15%)',data:higher,operatorDelta:higher.operatorPayout-current.operatorPayout,platformDelta:higher.platformRetained-current.platformRetained},
      lowerOperator:{label:'Lower Operator Share (5%)',data:lower,operatorDelta:lower.operatorPayout-current.operatorPayout,platformDelta:lower.platformRetained-current.platformRetained},
      successOnly:{label:'Success-Only Compensation',data:successOnly,operatorDelta:successOnly.operatorPayout-current.operatorPayout,platformDelta:successOnly.platformRetained-current.platformRetained},
      mixed:{label:'Mixed Base + Success',data:mixed,operatorDelta:mixed.operatorPayout-current.operatorPayout,platformDelta:mixed.platformRetained-current.platformRetained}
    };
  }

  window.LIMENExecution.phase7.incentives={
    simulateCompensationPolicy:simulateCompensationPolicy,
    comparePolicyScenarios:comparePolicyScenarios,
    getScenarioSummary:getScenarioSummary
  };
})();
