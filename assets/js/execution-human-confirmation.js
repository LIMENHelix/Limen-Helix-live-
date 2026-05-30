/**
 * execution-human-confirmation.js — Human-Confirmed Autonomy Flow
 * State-changing recommendations require explicit human confirmation.
 * Exposes: window.LIMENExecution.phase10.confirmation
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  var _pending=[];
  var _confirmed=[];
  var _cancelled=[];

  function requiresHumanConfirm(action){
    if(!action)return false;
    return action.requiresHumanConfirm!==false;
  }

  function openConfirmationModal(action,onConfirm,onCancel){
    if(!action)return;
    var entry={
      id:'CONF-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      action:action,
      actionSummary:action.title||action.recommendedAction||'Unnamed action',
      rationale:action.rationale||'No rationale provided',
      riskLevel:action.riskLevel||'LOW',
      affectedObjects:[action.sourceType+':'+action.sourceId],
      expectedResult:action.recommendedAction||'State change',
      reversible:action.sourceType==='draft'||action.sourceType==='crm',
      openedAt:Date.now(),
      status:'pending',
      onConfirm:onConfirm||null,
      onCancel:onCancel||null
    };
    _pending.push(entry);
    return entry;
  }

  function confirmRecommendedAction(confirmationId){
    for(var i=0;i<_pending.length;i++){
      if(_pending[i].id===confirmationId){
        var entry=_pending.splice(i,1)[0];
        entry.status='confirmed';entry.confirmedAt=Date.now();
        _confirmed.push(entry);
        // Log decision event
        var dm=window.LIMENExecution.phase9&&window.LIMENExecution.phase9.decisionMemory;
        if(dm)dm.recordDecisionEvent({entityType:entry.action.sourceType,entityId:entry.action.sourceId,domain:entry.action.domain,type:entry.action.type,decisionType:'human_confirmed_action',status:'confirmed',rationale:entry.rationale});
        if(typeof entry.onConfirm==='function')entry.onConfirm(entry);
        return entry;
      }
    }
    return null;
  }

  function cancelRecommendedAction(confirmationId){
    for(var i=0;i<_pending.length;i++){
      if(_pending[i].id===confirmationId){
        var entry=_pending.splice(i,1)[0];
        entry.status='cancelled';entry.cancelledAt=Date.now();
        _cancelled.push(entry);
        if(typeof entry.onCancel==='function')entry.onCancel(entry);
        return entry;
      }
    }
    return null;
  }

  function getPendingConfirmations(){return _pending.slice()}

  window.LIMENExecution.phase10.confirmation={requiresHumanConfirm:requiresHumanConfirm,openConfirmationModal:openConfirmationModal,confirmRecommendedAction:confirmRecommendedAction,cancelRecommendedAction:cancelRecommendedAction,getPendingConfirmations:getPendingConfirmations};
})();
