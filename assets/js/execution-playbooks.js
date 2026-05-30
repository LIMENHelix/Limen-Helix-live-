/**
 * execution-playbooks.js — Execution Playbook Generator
 * Generates structured step-by-step playbooks for recommended actions.
 * Exposes: window.LIMENExecution.phase10.playbooks
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  var PLAYBOOKS={
    grant:[
      {stepId:'g1',label:'Identify funding source',required:true,evidenceType:'document'},
      {stepId:'g2',label:'Verify eligibility requirements',required:true,evidenceType:'checklist'},
      {stepId:'g3',label:'Prepare application materials',required:true,evidenceType:'document'},
      {stepId:'g4',label:'Submit application',required:true,evidenceType:'confirmation'},
      {stepId:'g5',label:'Track status and follow up',required:false,evidenceType:'note'},
      {stepId:'g6',label:'Record outcome',required:true,evidenceType:'outcome'}
    ],
    patent:[
      {stepId:'p1',label:'Document invention disclosure',required:true,evidenceType:'document'},
      {stepId:'p2',label:'Prior art search',required:true,evidenceType:'report'},
      {stepId:'p3',label:'Draft provisional application',required:true,evidenceType:'document'},
      {stepId:'p4',label:'File with USPTO',required:true,evidenceType:'confirmation'},
      {stepId:'p5',label:'Monitor examination',required:false,evidenceType:'note'},
      {stepId:'p6',label:'Record outcome',required:true,evidenceType:'outcome'}
    ],
    loan:[
      {stepId:'l1',label:'Identify loan program',required:true,evidenceType:'document'},
      {stepId:'l2',label:'Prepare financial documentation',required:true,evidenceType:'document'},
      {stepId:'l3',label:'Submit loan application',required:true,evidenceType:'confirmation'},
      {stepId:'l4',label:'Underwriting review',required:true,evidenceType:'note'},
      {stepId:'l5',label:'Close and fund',required:true,evidenceType:'confirmation'},
      {stepId:'l6',label:'Record outcome',required:true,evidenceType:'outcome'}
    ],
    investment_entry:[
      {stepId:'i1',label:'Validate thesis against kernel signals',required:true,evidenceType:'analysis'},
      {stepId:'i2',label:'Set position size and risk controls',required:true,evidenceType:'checklist'},
      {stepId:'i3',label:'Document entry rationale',required:true,evidenceType:'note'},
      {stepId:'i4',label:'Execute entry',required:true,evidenceType:'confirmation'},
      {stepId:'i5',label:'Set monitoring alerts',required:false,evidenceType:'note'}
    ],
    investment_exit:[
      {stepId:'x1',label:'Review exit thesis',required:true,evidenceType:'analysis'},
      {stepId:'x2',label:'Check risk controls and stops',required:true,evidenceType:'checklist'},
      {stepId:'x3',label:'Execute exit',required:true,evidenceType:'confirmation'},
      {stepId:'x4',label:'Record P&L outcome',required:true,evidenceType:'outcome'}
    ],
    crm_advancement:[
      {stepId:'c1',label:'Review current pipeline stage',required:true,evidenceType:'note'},
      {stepId:'c2',label:'Verify qualification criteria met',required:true,evidenceType:'checklist'},
      {stepId:'c3',label:'Advance to next stage',required:true,evidenceType:'confirmation'},
      {stepId:'c4',label:'Update notes and follow-up date',required:false,evidenceType:'note'}
    ],
    dispute_resolution:[
      {stepId:'d1',label:'Review dispute details',required:true,evidenceType:'note'},
      {stepId:'d2',label:'Gather supporting evidence',required:true,evidenceType:'document'},
      {stepId:'d3',label:'Decide resolution or rejection',required:true,evidenceType:'confirmation'},
      {stepId:'d4',label:'Record resolution notes',required:true,evidenceType:'note'}
    ],
    portfolio_review:[
      {stepId:'r1',label:'Review portfolio item health',required:true,evidenceType:'analysis'},
      {stepId:'r2',label:'Check linked execution items',required:true,evidenceType:'checklist'},
      {stepId:'r3',label:'Update status if needed',required:false,evidenceType:'note'}
    ],
    approval_prep:[
      {stepId:'a1',label:'Complete agreement acceptance',required:true,evidenceType:'confirmation'},
      {stepId:'a2',label:'Complete audit checklist',required:true,evidenceType:'checklist'},
      {stepId:'a3',label:'Attach supporting documentation',required:false,evidenceType:'document'},
      {stepId:'a4',label:'Submit for review',required:true,evidenceType:'confirmation'}
    ],
    closeout:[
      {stepId:'o1',label:'Verify execution completed',required:true,evidenceType:'confirmation'},
      {stepId:'o2',label:'Record outcome result',required:true,evidenceType:'outcome'},
      {stepId:'o3',label:'Document value realized',required:true,evidenceType:'note'},
      {stepId:'o4',label:'Close claim',required:true,evidenceType:'confirmation'}
    ],
    portal_sales:[
      {stepId:'s1',label:'Review lead qualification',required:true,evidenceType:'note'},
      {stepId:'s2',label:'Prepare proposal',required:true,evidenceType:'document'},
      {stepId:'s3',label:'Send proposal and follow up',required:true,evidenceType:'confirmation'},
      {stepId:'s4',label:'Record win/loss outcome',required:true,evidenceType:'outcome'}
    ]
  };

  function getPlaybookForType(type){
    var key=(type||'').toLowerCase().replace(/[\s-]/g,'_');
    if(PLAYBOOKS[key])return{type:key,steps:JSON.parse(JSON.stringify(PLAYBOOKS[key]))};
    // Try partial match
    for(var k in PLAYBOOKS){if(key.indexOf(k)!==-1||k.indexOf(key)!==-1)return{type:k,steps:JSON.parse(JSON.stringify(PLAYBOOKS[k]))}}
    return{type:'generic',steps:[{stepId:'gen1',label:'Review action requirements',required:true,evidenceType:'note'},{stepId:'gen2',label:'Execute action',required:true,evidenceType:'confirmation'},{stepId:'gen3',label:'Record outcome',required:true,evidenceType:'outcome'}]};
  }

  function getPlaybookForAction(action){
    if(!action)return getPlaybookForType('generic');
    var type=action.type||action.sourceType||'generic';
    if(action.recommendedAction&&action.recommendedAction.indexOf('dispute')!==-1)type='dispute_resolution';
    if(action.recommendedAction&&action.recommendedAction.indexOf('outcome')!==-1)type='closeout';
    if(action.recommendedAction&&action.recommendedAction.indexOf('agreement')!==-1)type='approval_prep';
    if(action.recommendedAction&&action.recommendedAction.indexOf('CRM')!==-1||action.recommendedAction&&action.recommendedAction.indexOf('pipeline')!==-1)type='crm_advancement';
    return getPlaybookForType(type);
  }

  function getPlaybookSteps(type){return getPlaybookForType(type).steps}
  function getPlaybookChecklist(type){return getPlaybookForType(type).steps.filter(function(s){return s.required})}
  function getPlaybookWarnings(type){
    var steps=getPlaybookForType(type).steps;
    var warnings=[];
    for(var i=0;i<steps.length;i++){if(steps[i].warning)warnings.push(steps[i])}
    return warnings;
  }

  window.LIMENExecution.phase10.playbooks={getPlaybookForAction:getPlaybookForAction,getPlaybookForType:getPlaybookForType,getPlaybookSteps:getPlaybookSteps,getPlaybookChecklist:getPlaybookChecklist,getPlaybookWarnings:getPlaybookWarnings};
})();
