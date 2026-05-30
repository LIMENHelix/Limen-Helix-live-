/**
 * execution-operator-onboarding.js — Real Operator Onboarding Shell
 * Storage: LIMEN_EXECUTION_OPERATOR_PROFILE
 * Exposes: window.LIMENExecution.phase11.onboarding
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};
  var SK='LIMEN_EXECUTION_OPERATOR_PROFILE';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||null}catch(e){return null}}
  function _save(p){try{localStorage.setItem(SK,JSON.stringify(p))}catch(e){}}

  function createOperatorProfile(payload){
    var profile={
      id:'OP-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      name:payload.name||'',
      email:payload.email||'',
      selectedDomains:payload.selectedDomains||[],
      selectedPaths:payload.selectedPaths||[],
      agreementAccepted:false,
      policyAccepted:false,
      onboardingCompletedAt:null,
      readinessStatus:'not_started',
      createdAt:Date.now()
    };
    _save(profile);return profile;
  }

  function getOperatorProfile(){return _load()}

  function updateOperatorProfile(updates){
    var p=_load();if(!p)return null;
    for(var k in updates)p[k]=updates[k];
    _save(p);return p;
  }

  function completeOnboarding(){
    var p=_load();if(!p)return null;
    p.onboardingCompletedAt=Date.now();
    p.readinessStatus='completed';
    _save(p);return p;
  }

  function getOnboardingStatus(){
    var p=_load();
    if(!p)return{status:'no_profile',complete:false};
    if(p.onboardingCompletedAt)return{status:'completed',complete:true};
    return{status:'in_progress',complete:false,missing:getOnboardingChecklist().filter(function(c){return!c.completed})};
  }

  function getOnboardingChecklist(){
    var p=_load()||{};
    return[
      {step:'profile_created',label:'Profile created',completed:!!p.id},
      {step:'name_provided',label:'Name provided',completed:!!p.name},
      {step:'email_provided',label:'Email provided',completed:!!p.email},
      {step:'domains_selected',label:'Domains selected',completed:p.selectedDomains&&p.selectedDomains.length>0},
      {step:'paths_selected',label:'Paths selected',completed:p.selectedPaths&&p.selectedPaths.length>0},
      {step:'agreement_accepted',label:'Agreement accepted',completed:!!p.agreementAccepted},
      {step:'policy_accepted',label:'Policy accepted',completed:!!p.policyAccepted},
      {step:'onboarding_complete',label:'Onboarding complete',completed:!!p.onboardingCompletedAt}
    ];
  }

  window.LIMENExecution.phase11.onboarding={createOperatorProfile:createOperatorProfile,getOperatorProfile:getOperatorProfile,updateOperatorProfile:updateOperatorProfile,completeOnboarding:completeOnboarding,getOnboardingStatus:getOnboardingStatus,getOnboardingChecklist:getOnboardingChecklist};
})();
