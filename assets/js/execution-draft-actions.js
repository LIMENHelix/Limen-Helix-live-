/**
 * execution-draft-actions.js — Reversible Draft-Action Layer
 * Creates draft actions before final confirmation.
 * Storage: LIMEN_EXECUTION_DRAFT_ACTIONS
 * Exposes: window.LIMENExecution.phase10.drafts
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};
  var SK='LIMEN_EXECUTION_DRAFT_ACTIONS';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function createDraftAction(payload){
    var drafts=_load();
    var draft={
      id:'DFT-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      draftType:payload.draftType||'generic',
      sourceType:payload.sourceType||'',
      sourceId:payload.sourceId||'',
      domain:payload.domain||'',
      title:payload.title||'Draft action',
      proposedChange:payload.proposedChange||{},
      rationale:payload.rationale||'',
      riskLevel:payload.riskLevel||'LOW',
      reversible:payload.reversible!==false,
      status:'draft',
      createdAt:Date.now(),
      appliedAt:null,
      discardedAt:null
    };
    drafts.push(draft);_save(drafts);return draft;
  }

  function getDraftActions(){return _load().filter(function(d){return d.status==='draft'})}

  function getDraftActionById(id){
    var drafts=_load();
    for(var i=0;i<drafts.length;i++){if(drafts[i].id===id)return drafts[i]}
    return null;
  }

  function applyDraftAction(id){
    var drafts=_load();
    for(var i=0;i<drafts.length;i++){
      if(drafts[i].id===id&&drafts[i].status==='draft'){
        // Must pass human confirmation
        var conf=window.LIMENExecution.phase10.confirmation;
        if(conf&&conf.requiresHumanConfirm({requiresHumanConfirm:true})){
          drafts[i].status='pending_confirmation';
          _save(drafts);
          // Open confirmation
          var entry=conf.openConfirmationModal({
            id:drafts[i].id,title:drafts[i].title,rationale:drafts[i].rationale,riskLevel:drafts[i].riskLevel,
            sourceType:drafts[i].sourceType,sourceId:drafts[i].sourceId,recommendedAction:'Apply draft: '+drafts[i].title,requiresHumanConfirm:true,domain:drafts[i].domain
          },function(){
            var d2=_load();
            for(var j=0;j<d2.length;j++){if(d2[j].id===id){d2[j].status='applied';d2[j].appliedAt=Date.now();_save(d2);break}}
          },function(){
            var d2=_load();
            for(var j=0;j<d2.length;j++){if(d2[j].id===id){d2[j].status='draft';_save(d2);break}}
          });
          return{draft:drafts[i],confirmation:entry};
        }
        drafts[i].status='applied';drafts[i].appliedAt=Date.now();
        _save(drafts);return{draft:drafts[i]};
      }
    }
    return null;
  }

  function discardDraftAction(id){
    var drafts=_load();
    for(var i=0;i<drafts.length;i++){
      if(drafts[i].id===id&&(drafts[i].status==='draft'||drafts[i].status==='pending_confirmation')){
        drafts[i].status='discarded';drafts[i].discardedAt=Date.now();
        _save(drafts);return drafts[i];
      }
    }
    return null;
  }

  window.LIMENExecution.phase10.drafts={createDraftAction:createDraftAction,getDraftActions:getDraftActions,getDraftActionById:getDraftActionById,applyDraftAction:applyDraftAction,discardDraftAction:discardDraftAction};
})();
