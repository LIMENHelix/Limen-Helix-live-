/**
 * execution-integrations.js — External Integration Wrappers
 * Safe wrappers for external workflows without exposing secrets client-side.
 * Exposes: window.LIMENExecution.phase11.integrations
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase11=window.LIMENExecution.phase11||{};

  var INTEGRATIONS=[
    {id:'crm_handoff',label:'CRM Handoff',category:'crm',requiredFields:['contactName','contactEmail','domain','interest'],hasEndpoint:false},
    {id:'customer_inquiry',label:'Customer Inquiry Handoff',category:'customer',requiredFields:['name','email','inquiryType','message'],hasEndpoint:false},
    {id:'operator_intake',label:'Operator Intake Handoff',category:'operator',requiredFields:['name','email','selectedDomains'],hasEndpoint:false},
    {id:'grant_submission',label:'Grant Submission Handoff',category:'grant',requiredFields:['grantProgram','applicantOrg','proposalSummary','estimatedValue'],hasEndpoint:false},
    {id:'patent_counsel',label:'Patent Counsel Handoff',category:'patent',requiredFields:['inventionTitle','inventorName','priorArtNotes'],hasEndpoint:false},
    {id:'lender_packet',label:'Lender Packet Handoff',category:'loan',requiredFields:['businessName','loanAmount','loanPurpose','financialDocs'],hasEndpoint:false},
    {id:'sales_contact',label:'Sales Contact Handoff',category:'sales',requiredFields:['contactName','contactEmail','product','tier'],hasEndpoint:false},
    {id:'payout_operations',label:'Payout Operations Handoff',category:'payout',requiredFields:['claimId','operatorId','payoutAmount','payoutBasis'],hasEndpoint:false}
  ];

  function getAvailableIntegrations(){return INTEGRATIONS.map(function(i){return{id:i.id,label:i.label,category:i.category,hasEndpoint:i.hasEndpoint}})}

  function getIntegrationStatus(integrationId){
    for(var i=0;i<INTEGRATIONS.length;i++){
      if(INTEGRATIONS[i].id===integrationId)return{id:integrationId,label:INTEGRATIONS[i].label,hasEndpoint:INTEGRATIONS[i].hasEndpoint,status:INTEGRATIONS[i].hasEndpoint?'CONNECTED':'HANDOFF READY'};
    }
    return{id:integrationId,status:'NOT FOUND'};
  }

  function buildIntegrationPayload(integrationId,data){
    var integ=null;
    for(var i=0;i<INTEGRATIONS.length;i++){if(INTEGRATIONS[i].id===integrationId){integ=INTEGRATIONS[i];break}}
    if(!integ)return{valid:false,error:'Integration not found'};
    var payload={integrationId:integrationId,category:integ.category,preparedAt:Date.now(),data:data||{}};
    return{valid:true,payload:payload};
  }

  function validateIntegrationPayload(integrationId,data){
    var integ=null;
    for(var i=0;i<INTEGRATIONS.length;i++){if(INTEGRATIONS[i].id===integrationId){integ=INTEGRATIONS[i];break}}
    if(!integ)return{valid:false,missing:['integration_not_found']};
    var missing=[];
    for(var j=0;j<integ.requiredFields.length;j++){
      if(!data||!data[integ.requiredFields[j]])missing.push(integ.requiredFields[j]);
    }
    return{valid:missing.length===0,missing:missing};
  }

  function prepareExternalHandoff(integrationId,data){
    var validation=validateIntegrationPayload(integrationId,data);
    if(!validation.valid)return{ready:false,missing:validation.missing,status:'INCOMPLETE'};
    var payload=buildIntegrationPayload(integrationId,data);
    var status=getIntegrationStatus(integrationId);
    return{ready:true,payload:payload.payload,integrationStatus:status.status,handoffType:status.hasEndpoint?'API':'MANUAL'};
  }

  window.LIMENExecution.phase11.integrations={getAvailableIntegrations:getAvailableIntegrations,getIntegrationStatus:getIntegrationStatus,buildIntegrationPayload:buildIntegrationPayload,validateIntegrationPayload:validateIntegrationPayload,prepareExternalHandoff:prepareExternalHandoff};
})();
