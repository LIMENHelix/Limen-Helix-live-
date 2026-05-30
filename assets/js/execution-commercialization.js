/**
 * execution-commercialization.js — Commercialization Activation Layer
 * Bridges pricing, CRM, portal leads, and execution services.
 * Exposes: window.LIMENExecution.phase11.commercial
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  function _claims(){return window.LIMENClaimLedger?window.LIMENClaimLedger.getAllClaims():[]}
  function _crm(){var c=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.crm;return c&&c.getAll?c.getAll():[]}
  function _leads(){try{return JSON.parse(localStorage.getItem('LIMEN_PORTAL_LEADS'))||[]}catch(e){return[]}}
  function _portfolio(){var p=window.LIMENExecution.phase5&&window.LIMENExecution.phase5.portfolioMonitor;return p&&p.getSummary?p.getSummary():null}

  function getActiveRevenueStreams(){
    var streams=[];var claims=_claims(),crm=_crm(),leads=_leads(),pf=_portfolio();
    var activeClaims=claims.filter(function(c){return c.status!=='closed'&&c.status!=='rejected'});
    if(activeClaims.length>0)streams.push({stream:'execution_services',label:'Execution Services',count:activeClaims.length,estimatedValue:activeClaims.reduce(function(a,c){return a+(parseFloat(c.estimatedValue)||0)},0)});
    var wonCRM=crm.filter(function(c){return c.stage==='won'});
    if(wonCRM.length>0)streams.push({stream:'crm_won',label:'CRM Won Deals',count:wonCRM.length,estimatedValue:wonCRM.reduce(function(a,c){return a+(parseFloat(c.value)||0)},0)});
    if(leads.length>0)streams.push({stream:'portal_leads',label:'Portal Leads',count:leads.length,estimatedValue:0});
    if(pf&&pf.total>0)streams.push({stream:'portfolio_linked',label:'Portfolio-Linked Value',count:pf.total,estimatedValue:pf.totalValue||0});
    return streams;
  }

  function getLeadSources(){
    var leads=_leads();var crm=_crm();
    var sources={portal:0,crm:0,intake:0,direct:0};
    sources.portal=leads.length;
    sources.crm=crm.filter(function(c){return c.source==='portal'||c.source==='lead'}).length;
    try{var intake=JSON.parse(localStorage.getItem('LIMEN_EXECUTION_INTAKE'))||[];sources.intake=intake.length}catch(e){}
    return sources;
  }

  function getConversionReadiness(){
    var conv=window.LIMENExecution.phase8&&window.LIMENExecution.phase8.crmConversion;
    if(!conv)return{status:'NO DATA'};
    var snap=conv.getCRMConversionSnapshot();
    return{leadToQualified:snap.leadToQualified.rate,wonToExecution:snap.wonToExecution.rate,status:snap.wonToExecution.rate>=30?'STRONG':snap.wonToExecution.rate>=10?'MODERATE':'WEAK'};
  }

  function getCommercialBlockers(){
    var blockers=[];
    var profile=window.LIMENExecution.phase11.onboarding?window.LIMENExecution.phase11.onboarding.getOperatorProfile():null;
    if(!profile||!profile.onboardingCompletedAt)blockers.push({type:'onboarding',detail:'Operator not onboarded'});
    var streams=getActiveRevenueStreams();
    if(streams.length===0)blockers.push({type:'no_revenue',detail:'No active revenue streams'});
    var leads=_leads();var crm=_crm();
    if(leads.length===0&&crm.length===0)blockers.push({type:'no_pipeline',detail:'No leads or CRM records'});
    return blockers;
  }

  function getCommercialSnapshot(){
    return{streams:getActiveRevenueStreams(),leadSources:getLeadSources(),conversionReadiness:getConversionReadiness(),blockers:getCommercialBlockers(),totalStreams:getActiveRevenueStreams().length};
  }

  window.LIMENExecution.phase11.commercial={getCommercialSnapshot:getCommercialSnapshot,getActiveRevenueStreams:getActiveRevenueStreams,getLeadSources:getLeadSources,getConversionReadiness:getConversionReadiness,getCommercialBlockers:getCommercialBlockers};
})();
