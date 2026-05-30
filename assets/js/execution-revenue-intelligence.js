/**
 * execution-revenue-intelligence.js — Revenue Intelligence Layer
 * Traces pipeline, realized, retained, projected value across types/domains.
 * Exposes: window.LIMENExecution.phase8.revenue
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _outcomes(){return window.LIMENExecution.outcomes?window.LIMENExecution.outcomes.getAllOutcomes():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getValueTotals?c.getValueTotals():null}
  function _portfolio(){var p=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;return p&&p.getSummary?p.getSummary():null}

  function _opShare(claim){
    var val=parseFloat(claim.estimatedValue)||0;
    if(val===0)return 10;
    if(claim.estimatedOperatorPayout)return Math.round((parseFloat(claim.estimatedOperatorPayout)/val)*100);
    return parseFloat(claim.operatorSharePct)||10;
  }

  function getRevenueSnapshot(){
    var claims=_claims(),outcomes=_outcomes(),crm=_crm(),pf=_portfolio();
    var projGross=0,projOpPay=0,projPlatform=0,realGross=0,realOpPay=0,realPlatform=0;
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='rejected')continue;
      var val=parseFloat(c.estimatedValue)||0;
      var share=_opShare(c);
      if(c.status==='closed'){
        realGross+=val;realOpPay+=val*(share/100);realPlatform+=val*(1-share/100);
      }else{
        projGross+=val;projOpPay+=val*(share/100);projPlatform+=val*(1-share/100);
      }
    }
    for(var j=0;j<outcomes.length;j++){
      var o=outcomes[j];
      if(o.result==='success'||o.result==='partial'){
        var ov=parseFloat(o.outcomeValue)||0;
        realGross+=ov;
      }
    }
    return{
      projectedGross:Math.round(projGross),realizedGross:Math.round(realGross),
      projectedOperatorPayout:Math.round(projOpPay),realizedOperatorPayout:Math.round(realOpPay),
      projectedPlatformRetained:Math.round(projPlatform),realizedPlatformRetained:Math.round(realPlatform),
      crmProjected:crm&&crm.projected?crm.projected:0,
      portfolioLinked:pf&&pf.totalValue?pf.totalValue:0
    };
  }

  function _byField(field){
    var claims=_claims();var result={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='rejected')continue;
      var key=field==='type'?(c.type||c.path||'unknown').toUpperCase():(c.domain||'unknown');
      if(!result[key])result[key]={projected:0,realized:0,operatorPay:0,platformRetained:0};
      var val=parseFloat(c.estimatedValue)||0;var share=_opShare(c);
      if(c.status==='closed'){result[key].realized+=val}else{result[key].projected+=val}
      result[key].operatorPay+=val*(share/100);
      result[key].platformRetained+=val*(1-share/100);
    }
    for(var k in result){result[k].projected=Math.round(result[k].projected);result[k].realized=Math.round(result[k].realized);result[k].operatorPay=Math.round(result[k].operatorPay);result[k].platformRetained=Math.round(result[k].platformRetained)}
    return result;
  }

  function getProjectedRevenueByType(){return _byField('type')}
  function getProjectedRevenueByDomain(){return _byField('domain')}
  function getRealizedRevenueByType(){var d=_byField('type');var r={};for(var k in d)r[k]=d[k].realized;return r}
  function getRetainedValueByDomain(){var d=_byField('domain');var r={};for(var k in d)r[k]=d[k].platformRetained;return r}

  function getRevenueConcentration(){
    var byType=_byField('type');var vals=[];var total=0;
    for(var t in byType){var v=byType[t].projected+byType[t].realized;vals.push(v);total+=v}
    if(total===0)return{label:'BALANCED',hhi:0};
    var hhi=0;for(var i=0;i<vals.length;i++){var s=vals[i]/total;hhi+=s*s}
    hhi=Math.round(hhi*10000);
    return{label:hhi<2500?'BALANCED':hhi<5000?'MODERATE CONCENTRATION':'HIGH CONCENTRATION',hhi:hhi};
  }

  function getRevenueTrend(){
    var mem=window.LIMENExecution.phase8.strategicMemory;
    if(!mem)return{label:'INSUFFICIENT DATA',months:[]};
    var sm=mem.getStrategicMemory();if(!sm||!sm.byMonth)return{label:'INSUFFICIENT DATA',months:[]};
    var months=Object.keys(sm.byMonth).sort();
    if(months.length<2)return{label:'INSUFFICIENT DATA',months:months};
    var recent=sm.byMonth[months[months.length-1]];
    var prev=sm.byMonth[months[months.length-2]];
    if(!recent||!prev)return{label:'INSUFFICIENT DATA',months:months};
    var label='STABLE';
    if(recent.value>prev.value*1.2)label='RISING';
    else if(recent.value<prev.value*0.8)label='FALLING';
    return{label:label,months:months,recentValue:recent.value,previousValue:prev.value};
  }

  window.LIMENExecution.phase8.revenue={
    getRevenueSnapshot:getRevenueSnapshot,
    getProjectedRevenueByType:getProjectedRevenueByType,
    getProjectedRevenueByDomain:getProjectedRevenueByDomain,
    getRealizedRevenueByType:getRealizedRevenueByType,
    getRetainedValueByDomain:getRetainedValueByDomain,
    getRevenueConcentration:getRevenueConcentration,
    getRevenueTrend:getRevenueTrend
  };
})();
