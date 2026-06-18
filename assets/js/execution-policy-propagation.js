/**
 * execution-policy-propagation.js — Policy Propagation Engine
 * Shows where policy changes would affect the operating system.
 * Exposes: window.LIMENExecution.phase8.policyPropagation
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase8=window.LIMENExecution.phase8||{};

  var DEPENDENCY_MAP={
    claimAgreement:{modules:['claimLedger','approvalAuthority','approvalRouting'],pages:['domain-console'],description:'Claim agreement version affects all active and future claims'},
    approval:{modules:['approvalAuthority','approvalRouting','approvalIntelligence','bottlenecks'],pages:['domain-console','execution-reports'],description:'Approval rules affect queue sorting, readiness scoring, and bottleneck detection'},
    payout:{modules:['payoutFinalizer','compensation','economicMemory','economyBoard','incentives','revenue'],pages:['domain-console','execution-reports','portal-pricing'],description:'Payout rules affect operator compensation, platform retained value, and revenue projections'},
    riskControl:{modules:['investmentControls','portfolioMonitor','capacityGovernance','thresholds'],pages:['domain-console','venture-portfolio'],description:'Risk controls affect investment gating, portfolio monitoring, and governance thresholds'},
    reporting:{modules:['reports','operatorBoard','operatorStats','boardSnapshot'],pages:['execution-reports'],description:'Reporting config affects all dashboard and report outputs'},
    audit:{modules:['policyVersioning','lineage','integrity','coherence'],pages:['execution-reports'],description:'Audit policy affects lineage tracking, integrity checks, and coherence scoring'}
  };

  function getPolicyDependencyMap(){return JSON.parse(JSON.stringify(DEPENDENCY_MAP))}

  function getAffectedModules(policyType){
    if(DEPENDENCY_MAP[policyType])return DEPENDENCY_MAP[policyType].modules.slice();
    var all={};for(var k in DEPENDENCY_MAP){var m=DEPENDENCY_MAP[k].modules;for(var i=0;i<m.length;i++)all[m[i]]=true}
    return Object.keys(all);
  }

  function getAffectedPages(policyType){
    if(DEPENDENCY_MAP[policyType])return DEPENDENCY_MAP[policyType].pages.slice();
    var all={};for(var k in DEPENDENCY_MAP){var p=DEPENDENCY_MAP[k].pages;for(var i=0;i<p.length;i++)all[p[i]]=true}
    return Object.keys(all);
  }

  function getPolicyChangeSummary(){
    var summary=[];
    for(var k in DEPENDENCY_MAP){
      var d=DEPENDENCY_MAP[k];
      summary.push({policyType:k,modulesAffected:d.modules.length,pagesAffected:d.pages.length,description:d.description});
    }
    return summary;
  }

  function simulatePolicyPropagation(policyType){
    var dep=DEPENDENCY_MAP[policyType];
    if(!dep)return{policyType:policyType,found:false,modules:[],pages:[],description:'Unknown policy type'};
    var reg=window.LIMENExecution.phase6&&window.LIMENExecution.phase6.registry;
    var moduleStatus=[];
    for(var i=0;i<dep.modules.length;i++){
      var active=reg&&reg.isModuleActive?reg.isModuleActive(dep.modules[i]):false;
      moduleStatus.push({module:dep.modules[i],active:active,wouldBeAffected:true});
    }
    return{policyType:policyType,found:true,modules:moduleStatus,pages:dep.pages,description:dep.description,totalAffected:dep.modules.length+dep.pages.length};
  }

  window.LIMENExecution.phase8.policyPropagation={
    getPolicyDependencyMap:getPolicyDependencyMap,
    getAffectedModules:getAffectedModules,
    getAffectedPages:getAffectedPages,
    getPolicyChangeSummary:getPolicyChangeSummary,
    simulatePolicyPropagation:simulatePolicyPropagation
  };
})();
