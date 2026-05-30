/**
 * execution-portfolio-feedback.js — Portfolio Feedback into Execution Prioritization
 * Lightly influences execution priority based on portfolio state.
 * Clamp: -0.10 to +0.10 max adjustment.
 * Exposes: window.LIMENExecution.phase7.portfolioFeedback
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase7=window.LIMENExecution.phase7||{};

  function _getPortfolio(){
    var pf=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;
    if(pf&&pf.getSummary)return pf;
    var p4=window.LIMENExecution.phase4&&window.LIMENExecution.phase4.portfolio;
    if(p4&&p4.getItems)return p4;
    return null;
  }
  function _getItems(){
    var pf=_getPortfolio();
    if(!pf)return[];
    if(pf.getItems)return pf.getItems()||[];
    if(pf.getSummary){var s=pf.getSummary();return s&&s.items?s.items:[]}
    return[];
  }

  function getPortfolioPriorityAdjustment(opportunity){
    var items=_getItems();if(items.length===0)return 0;
    var domain=opportunity.domain||opportunity.domainId||'';
    var distressed=0,total=items.length;
    for(var i=0;i<items.length;i++){
      var it=items[i];
      if((it.domain||'')=== domain){
        if(it.status==='distressed'||it.status==='at_risk'||it.health==='critical')distressed++;
      }
    }
    if(distressed===0)return 0;
    var adj=Math.min(0.10,distressed*0.03);
    return Math.round(adj*100)/100;
  }

  function getPortfolioCoverageGapAdjustment(opportunity){
    var items=_getItems();if(items.length===0)return 0;
    var domain=opportunity.domain||opportunity.domainId||'';
    var hasCoverage=false;
    for(var i=0;i<items.length;i++){if((items[i].domain||'')===domain){hasCoverage=true;break}}
    if(!hasCoverage)return 0.02;
    var domainItems=items.filter(function(it){return(it.domain||'')===domain});
    if(domainItems.length>=3)return-0.03;
    return 0;
  }

  function getLinkedPortfolioPressure(opportunity){
    var adj1=getPortfolioPriorityAdjustment(opportunity);
    var adj2=getPortfolioCoverageGapAdjustment(opportunity);
    return{distressBoost:adj1,coverageGap:adj2,total:Math.max(-0.10,Math.min(0.10,adj1+adj2))};
  }

  function applyPortfolioFeedback(opportunities){
    if(!opportunities||!opportunities.length)return opportunities;
    var result=[];
    for(var i=0;i<opportunities.length;i++){
      var o=opportunities[i];
      var pressure=getLinkedPortfolioPressure(o);
      var copy={};for(var k in o)copy[k]=o[k];
      copy._portfolioFeedback=pressure;
      if(typeof copy.displayScore==='number'){
        copy.displayScore=Math.round((copy.displayScore+pressure.total)*100)/100;
      }
      result.push(copy);
    }
    return result;
  }

  window.LIMENExecution.phase7.portfolioFeedback={
    getPortfolioPriorityAdjustment:getPortfolioPriorityAdjustment,
    getPortfolioCoverageGapAdjustment:getPortfolioCoverageGapAdjustment,
    getLinkedPortfolioPressure:getLinkedPortfolioPressure,
    applyPortfolioFeedback:applyPortfolioFeedback
  };
})();
