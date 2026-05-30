/**
 * execution-guided-sequences.js — Guided Execution Sequences
 * Turns recommended actions + playbooks into guided workflows.
 * Storage: LIMEN_EXECUTION_GUIDED_SEQUENCES
 * Exposes: window.LIMENExecution.phase10.guided
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};
  var SK='LIMEN_EXECUTION_GUIDED_SEQUENCES';

  function _load(){try{return JSON.parse(localStorage.getItem(SK))||[]}catch(e){return[]}}
  function _save(d){try{localStorage.setItem(SK,JSON.stringify(d))}catch(e){}}

  function startGuidedSequence(action){
    var sequences=_load();
    var pb=window.LIMENExecution.phase10.playbooks;
    var playbook=pb?pb.getPlaybookForAction(action):{type:'generic',steps:[]};
    var stepStates={};
    for(var i=0;i<playbook.steps.length;i++){stepStates[playbook.steps[i].stepId]='pending'}
    var seq={
      id:'SEQ-'+Date.now()+'-'+Math.random().toString(36).substr(2,5),
      actionId:action.id||'',
      sourceType:action.sourceType||'',
      sourceId:action.sourceId||'',
      playbookType:playbook.type,
      steps:playbook.steps,
      startedAt:Date.now(),
      currentStep:0,
      stepStates:stepStates,
      status:'active'
    };
    sequences.push(seq);_save(sequences);return seq;
  }

  function getActiveSequence(){
    var seqs=_load();
    for(var i=seqs.length-1;i>=0;i--){if(seqs[i].status==='active')return seqs[i]}
    return null;
  }

  function advanceSequenceStep(seqId){
    var seqs=_load();
    for(var i=0;i<seqs.length;i++){
      if(seqs[i].id===seqId&&seqs[i].status==='active'){
        var s=seqs[i];
        if(s.currentStep<s.steps.length){
          s.stepStates[s.steps[s.currentStep].stepId]='completed';
          s.currentStep++;
          if(s.currentStep>=s.steps.length)s.status='completed';
          _save(seqs);return s;
        }
      }
    }
    return null;
  }

  function pauseSequence(seqId){
    var seqs=_load();
    for(var i=0;i<seqs.length;i++){if(seqs[i].id===seqId){seqs[i].status='paused';_save(seqs);return seqs[i]}}
    return null;
  }

  function cancelSequence(seqId){
    var seqs=_load();
    for(var i=0;i<seqs.length;i++){if(seqs[i].id===seqId){seqs[i].status='cancelled';_save(seqs);return seqs[i]}}
    return null;
  }

  function completeSequence(seqId){
    var seqs=_load();
    for(var i=0;i<seqs.length;i++){if(seqs[i].id===seqId){seqs[i].status='completed';_save(seqs);return seqs[i]}}
    return null;
  }

  function getSequenceHistory(){return _load()}

  window.LIMENExecution.phase10.guided={startGuidedSequence:startGuidedSequence,getActiveSequence:getActiveSequence,advanceSequenceStep:advanceSequenceStep,pauseSequence:pauseSequence,cancelSequence:cancelSequence,completeSequence:completeSequence,getSequenceHistory:getSequenceHistory};
})();
