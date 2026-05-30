/**
 * execution-phase8-dashboard.js — Phase 8 Dashboard Integration
 * Renders compact Phase 8 strategic widgets on execution-capable pages.
 * Exposes: window.LIMENExecution.phase8.dashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  function _isExecutionCapable(){
    var path=window.location.pathname.toLowerCase();
    var pages=['domain-console','execution-reports','disputes-exceptions','energy-workspace','crm-pipeline','venture-portfolio'];
    for(var i=0;i<pages.length;i++){if(path.indexOf(pages[i])!==-1)return true}
    if((window.location.search||'').indexOf('mode=operator')!==-1)return true;
    return false;
  }

  function _safe(fn,fallback){try{return fn()}catch(e){return fallback}}

  function buildDashboardData(){
    var p8=window.LIMENExecution.phase8;
    var widgets={};

    if(p8.strategicMemory)widgets.strategicMemory=_safe(function(){return p8.strategicMemory.getStrategicMemorySummary()},{});
    if(p8.revenue)widgets.revenue=_safe(function(){var s=p8.revenue.getRevenueSnapshot();return{projectedGross:s.projectedGross,realizedGross:s.realizedGross,trend:p8.revenue.getRevenueTrend().label}},{});
    if(p8.operatorPathways)widgets.operatorPathways=_safe(function(){var s=p8.operatorPathways.getOperatorPathwaySnapshot();return{strongestLane:s.strongestLane,weakestLane:s.weakestLane,avgCreateToApproval:s.lags.avgCreateToApproval+'d'}},{});
    if(p8.bottlenecks)widgets.bottlenecks=_safe(function(){var b=p8.bottlenecks.getTopBottlenecks();return{count:b.length,top:b.slice(0,3).map(function(x){return{title:x.title,type:x.type,severity:x.severity}})}},{});
    if(p8.cohorts)widgets.cohorts=_safe(function(){var best=p8.cohorts.getBestCohorts('type');var worst=p8.cohorts.getWorstCohorts('type');return{bestType:best.length>0?best[0].cohort:'NONE',worstType:worst.length>0?worst[0].cohort:'NONE'}},{});
    if(p8.portfolioMonetization)widgets.portfolioMonetization=_safe(function(){var v=p8.portfolioMonetization.getValueLinkedToPortfolio();return{linkedClaims:v.linkedClaims,estimatedGross:v.estimatedGross}},{});
    if(p8.crmConversion)widgets.crmConversion=_safe(function(){var s=p8.crmConversion.getCRMConversionSnapshot();return{leadToQualified:s.leadToQualified.rate+'%',wonToExecution:s.wonToExecution.rate+'%'}},{});
    if(p8.thresholds)widgets.governance=_safe(function(){return{status:p8.thresholds.getThresholdStatus(),warnings:p8.thresholds.getThresholdWarnings().length}},{});
    if(p8.policyPropagation)widgets.policyPropagation=_safe(function(){var s=p8.policyPropagation.getPolicyChangeSummary();return{policyTypes:s.length,totalDependencies:s.reduce(function(a,b){return a+b.modulesAffected+b.pagesAffected},0)}},{});

    return widgets;
  }

  function getWidgetList(){return Object.keys(buildDashboardData())}

  function init(){
    if(!_isExecutionCapable()){console.log('[Phase8Dashboard] Not an execution-capable page');return}
    // Register in module registry
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    if(reg&&reg.registerModule){
      var p8=window.LIMENExecution.phase8;
      if(p8.strategicMemory)reg.registerModule('phase8_strategicMemory',p8.strategicMemory);
      if(p8.policyPropagation)reg.registerModule('phase8_policyPropagation',p8.policyPropagation);
      if(p8.revenue)reg.registerModule('phase8_revenue',p8.revenue);
      if(p8.operatorPathways)reg.registerModule('phase8_operatorPathways',p8.operatorPathways);
      if(p8.bottlenecks)reg.registerModule('phase8_bottlenecks',p8.bottlenecks);
      if(p8.cohorts)reg.registerModule('phase8_cohorts',p8.cohorts);
      if(p8.portfolioMonetization)reg.registerModule('phase8_portfolioMonetization',p8.portfolioMonetization);
      if(p8.crmConversion)reg.registerModule('phase8_crmConversion',p8.crmConversion);
      if(p8.thresholds)reg.registerModule('phase8_thresholds',p8.thresholds);
      if(p8.dashboard)reg.registerModule('phase8_dashboard',p8.dashboard);
    }
    // Rebuild strategic memory on load
    if(window.LIMENExecution.phase8.strategicMemory){
      try{window.LIMENExecution.phase8.strategicMemory.rebuildStrategicMemory()}catch(e){console.warn('[Phase8Dashboard] Strategic memory rebuild failed:',e.message)}
    }
    console.log('[Phase8Dashboard] Phase 8 active on: '+window.location.pathname);
  }

  setTimeout(init,3000);

  window.LIMENExecution.phase8.dashboard={
    buildDashboardData:buildDashboardData,
    getWidgetList:getWidgetList,
    init:init
  };
})();
