/**
 * execution-economy-board.js — Operator Economy Readiness Board
 * Makes the operator economy visible as a system layer.
 * Exposes: window.LIMENExecution.phase7.economyBoard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getValueTotals?c.getValueTotals():null}
  function _portfolio(){var p=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;return p&&p.getSummary?p.getSummary():null}

  function getValueByType(){
    var claims=_claims();var byType={GRANT:0,PATENT:0,INVEST:0,BUSINESS:0,OTHER:0};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='closed'||c.status==='rejected')continue;
      var t=(c.type||c.path||'OTHER').toUpperCase();
      if(!byType.hasOwnProperty(t))t='OTHER';
      byType[t]+=(parseFloat(c.estimatedValue)||0);
    }
    return byType;
  }

  function getValueByDomain(){
    var claims=_claims();var byDomain={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='closed'||c.status==='rejected')continue;
      var d=c.domain||'unknown';
      if(!byDomain[d])byDomain[d]=0;
      byDomain[d]+=(parseFloat(c.estimatedValue)||0);
    }
    return byDomain;
  }

  function getPayoutExposure(){
    var claims=_claims();var operatorTotal=0,platformTotal=0;
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='closed'||c.status==='rejected')continue;
      var val=parseFloat(c.estimatedValue)||0;
      var opShare=parseFloat(c.operatorSharePct||c.estimatedOperatorPayout?((c.estimatedOperatorPayout/val)*100):10)||10;
      operatorTotal+=val*(opShare/100);
      platformTotal+=val*(1-opShare/100);
    }
    return{estimatedOperatorPayout:Math.round(operatorTotal),estimatedPlatformRetained:Math.round(platformTotal),total:Math.round(operatorTotal+platformTotal)};
  }

  function getConcentrationRisk(){
    var byType=getValueByType();var vals=[];var total=0;
    for(var t in byType){vals.push(byType[t]);total+=byType[t]}
    if(total===0)return{label:'BALANCED',hhi:0};
    var hhi=0;
    for(var j=0;j<vals.length;j++){var share=vals[j]/total;hhi+=share*share}
    hhi=Math.round(hhi*10000);
    var label=hhi<2500?'BALANCED':hhi<5000?'MODERATE CONCENTRATION':'HIGH CONCENTRATION';
    return{label:label,hhi:hhi};
  }

  function _realizedValue(){
    var outcomes=_outcomes();var total=0;
    for(var i=0;i<outcomes.length;i++){
      if(outcomes[i].result==='success'||outcomes[i].result==='partial'){
        total+=(parseFloat(outcomes[i].outcomeValue)||0);
      }
    }
    return Math.round(total);
  }

  function _strongestWeakest(){
    var byType=getValueByType();var best=null,worst=null,bestVal=-1,worstVal=Infinity;
    for(var t in byType){
      if(byType[t]>bestVal){bestVal=byType[t];best=t}
      if(byType[t]<worstVal){worstVal=byType[t];worst=t}
    }
    return{strongest:best||'NONE',weakest:worst||'NONE'};
  }

  function getEconomyBoardData(){
    var claims=_claims();var active=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    var exposure=getPayoutExposure();
    var concentration=getConcentrationRisk();
    var sw=_strongestWeakest();
    var crm=_crm();var portfolio=_portfolio();
    return{
      activeClaims:active.length,
      activeClaimsValue:exposure.total,
      estimatedGrossPipeline:exposure.total+(crm&&crm.projected?crm.projected:0),
      estimatedOperatorPayout:exposure.estimatedOperatorPayout,
      estimatedPlatformRetained:exposure.estimatedPlatformRetained,
      realizedValue:_realizedValue(),
      strongestType:sw.strongest,
      weakestType:sw.weakest,
      concentrationRisk:concentration.label,
      concentrationHHI:concentration.hhi,
      portfolioLinkedValue:portfolio&&portfolio.totalValue?portfolio.totalValue:0,
      crmProjectedValue:crm&&crm.projected?crm.projected:0
    };
  }

  window.LIMENExecution.phase7.economyBoard={
    getEconomyBoardData:getEconomyBoardData,
    getPayoutExposure:getPayoutExposure,
    getConcentrationRisk:getConcentrationRisk,
    getValueByType:getValueByType,
    getValueByDomain:getValueByDomain
  };
})();
