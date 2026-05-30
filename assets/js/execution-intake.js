/**
 * execution-intake.js — Real Customer / Operator Intake
 * Storage: LIMEN_EXECUTION_INTAKE
 * Exposes: window.LIMENExecution.phase11.intake
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};
  var SK='LIMEN_EXECUTION_INTAKE';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function createIntakeRecord(payload){
    var records=_load();
    var rec={
      id:'INT-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      type:payload.type||'customer',
      name:payload.name||'',
      email:payload.email||'',
      organization:payload.organization||'',
      domain:payload.domain||'',
      message:payload.message||'',
      tier:payload.tier||'standard',
      status:'new',
      createdAt:Date.now(),
      convertedTo:null
    };
    records.push(rec);_save(records);return rec;
  }

  function getIntakeRecords(){return _load()}
  function getIntakeByType(type){return _load().filter(function(r){return r.type===type})}

  function convertIntakeToLead(intakeId){
    var records=_load();
    for(var i=0;i<records.length;i++){
      if(records[i].id===intakeId){
        records[i].status='converted';records[i].convertedTo='lead';
        _save(records);
        try{var leads=JSON.parse(localStorage.getItem('LIMEN_PORTAL_LEADS'))||[];
        leads.push({id:'LEAD-'+Date.now(),source:'intake',name:records[i].name,email:records[i].email,domain:records[i].domain,tier:records[i].tier,createdAt:Date.now()});
        localStorage.setItem('LIMEN_PORTAL_LEADS',JSON.stringify(leads))}catch(e){}
        return records[i];
      }
    }
    return null;
  }

  function convertIntakeToOperator(intakeId){
    var records=_load();
    for(var i=0;i<records.length;i++){
      if(records[i].id===intakeId){
        records[i].status='converted';records[i].convertedTo='operator';
        _save(records);
        var ob=window.LIMENExecution.phase11.onboarding;
        if(ob)ob.createOperatorProfile({name:records[i].name,email:records[i].email,selectedDomains:records[i].domain?[records[i].domain]:[]});
        return records[i];
      }
    }
    return null;
  }

  window.LIMENExecution.phase11.intake={createIntakeRecord:createIntakeRecord,getIntakeRecords:getIntakeRecords,getIntakeByType:getIntakeByType,convertIntakeToLead:convertIntakeToLead,convertIntakeToOperator:convertIntakeToOperator};
})();
