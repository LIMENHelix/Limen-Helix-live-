/**
 * execution-portfolio-monetization.js — Portfolio Monetization Visibility
 * Shows how portfolio entities connect to value creation.
 * Exposes: window.LIMENExecution.phase8.portfolioMonetization
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _portfolioItems(){
    var p=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;
    if(p&&p.getItems)return p.getItems()||[];
    if(p&&p.getSummary){var s=p.getSummary();return s&&s.items?s.items:[]}
    return[];
  }

  function _isPortfolioLinked(claim,items){
    for(var i=0;i<items.length;i++){
      if(items[i].domain&&claim.domain&&items[i].domain===claim.domain)return true;
      if(items[i].id&&claim.portfolioId&&items[i].id===claim.portfolioId)return true;
    }
    return false;
  }

  function getValueLinkedToPortfolio(){
    var claims=_claims(),items=_portfolioItems();
    var linked=0,gross=0,opPay=0,platRetained=0;
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='rejected')continue;
      if(_isPortfolioLinked(c,items)){
        linked++;
        var val=parseFloat(c.estimatedValue)||0;
        gross+=val;
        var share=parseFloat(c.operatorSharePct)||10;
        opPay+=val*(share/100);
        platRetained+=val*(1-share/100);
      }
    }
    return{linkedClaims:linked,estimatedGross:Math.round(gross),estimatedOperatorPayout:Math.round(opPay),estimatedPlatformRetained:Math.round(platRetained)};
  }

  function getPortfolioValueByDomain(){
    var claims=_claims(),items=_portfolioItems();var byDomain={};
    for(var i=0;i<claims.length;i++){
      var c=claims[i];if(c.status==='rejected')continue;
      if(_isPortfolioLinked(c,items)){
        var d=c.domain||'unknown';
        if(!byDomain[d])byDomain[d]={claims:0,value:0};
        byDomain[d].claims++;
        byDomain[d].value+=parseFloat(c.estimatedValue)||0;
      }
    }
    for(var k in byDomain)byDomain[k].value=Math.round(byDomain[k].value);
    return byDomain;
  }

  function getPortfolioExposureSummary(){
    var items=_portfolioItems();
    var distressed=0,healthy=0,watch=0;
    for(var i=0;i<items.length;i++){
      var s=items[i].status||items[i].health||'unknown';
      if(s==='distressed'||s==='critical')distressed++;
      else if(s==='watch'||s==='at_risk')watch++;
      else healthy++;
    }
    return{total:items.length,healthy:healthy,watch:watch,distressed:distressed};
  }

  function getPortfolioExecutionDependencies(){
    var claims=_claims(),items=_portfolioItems(),crm=_crm();
    var linkedClaims=0,linkedCRM=0;
    for(var i=0;i<claims.length;i++){if(_isPortfolioLinked(claims[i],items))linkedClaims++}
    for(var j=0;j<crm.length;j++){
      for(var k=0;k<items.length;k++){if(items[k].domain&&crm[j].domain&&items[k].domain===crm[j].domain){linkedCRM++;break}}
    }
    return{linkedClaims:linkedClaims,linkedCRMRecords:linkedCRM,totalPortfolioItems:items.length};
  }

  function getPortfolioMonetizationSnapshot(){
    return{
      value:getValueLinkedToPortfolio(),
      byDomain:getPortfolioValueByDomain(),
      exposure:getPortfolioExposureSummary(),
      dependencies:getPortfolioExecutionDependencies()
    };
  }

  window.LIMENExecution.phase8.portfolioMonetization={
    getPortfolioMonetizationSnapshot:getPortfolioMonetizationSnapshot,
    getValueLinkedToPortfolio:getValueLinkedToPortfolio,
    getPortfolioValueByDomain:getPortfolioValueByDomain,
    getPortfolioExposureSummary:getPortfolioExposureSummary,
    getPortfolioExecutionDependencies:getPortfolioExecutionDependencies
  };
})();
