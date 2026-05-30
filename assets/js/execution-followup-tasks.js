/**
 * execution-followup-tasks.js — Follow-Up Task Engine
 * Generates next actions from claims, outcomes, leads, portfolio.
 * Exposes: window.LIMENExecution.phase5.tasks
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  var K='LIMEN_EXECUTION_TASKS';
  function load(){try{return JSON.parse(localStorage.getItem(K)||'[]')}catch(e){return[]}}
  function save(d){try{localStorage.setItem(K,JSON.stringify(d))}catch(e){}}
  function create(t){var all=load();var task={id:'task_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),sourceType:t.sourceType||'claim',sourceId:t.sourceId||'',domain:t.domain||'',title:t.title||'',actionLabel:t.actionLabel||'',status:'open',priority:t.priority||'medium',dueAt:t.dueAt||Date.now()+7*864e5,createdAt:Date.now(),notes:t.notes||''};all.push(task);save(all);return task}
  function fromClaim(c){var tasks=[];if(c.status==='claimed')tasks.push(create({sourceType:'claim',sourceId:c.id,domain:c.domain,title:c.title,actionLabel:'Start execution checklist',priority:'high',dueAt:Date.now()+3*864e5}));if(c.status==='approved')tasks.push(create({sourceType:'claim',sourceId:c.id,domain:c.domain,title:c.title,actionLabel:'Execute and record outcome',priority:'high',dueAt:Date.now()+7*864e5}));return tasks}
  function fromOutcome(o){if(o.result==='success'&&o.type==='patent')return[create({sourceType:'outcome',sourceId:o.id,domain:o.domain,title:o.title,actionLabel:'Track 12-month conversion deadline',priority:'medium',dueAt:Date.now()+330*864e5})];return[]}
  function fromLead(l){if(l.status==='qualified')return[create({sourceType:'lead',sourceId:l.id,domain:l.domain||'',title:l.name||l.company||'Lead',actionLabel:'Prepare proposal',priority:'medium',dueAt:Date.now()+5*864e5})];return[]}
  function fromPortfolio(p){if(p.status==='distressed')return[create({sourceType:'portfolio',sourceId:p.id,domain:p.domain,title:p.name,actionLabel:'Review kernel signal and decide action',priority:'critical',dueAt:Date.now()+1*864e5})];return[]}
  function getOpen(){return load().filter(function(t){return t.status==='open'})}
  function getByPriority(){var o=getOpen();var order={critical:0,high:1,medium:2,low:3};o.sort(function(a,b){return(order[a.priority]||9)-(order[b.priority]||9)});return o}
  function complete(id){var all=load();for(var i=0;i<all.length;i++){if(all[i].id===id){all[i].status='done';all[i].completedAt=Date.now();save(all);return all[i]}}return null}
  function skip(id){var all=load();for(var i=0;i<all.length;i++){if(all[i].id===id){all[i].status='skipped';save(all);return all[i]}}return null}
  window.LIMENExecution.phase5.tasks={create:create,createFromClaim:fromClaim,createFromOutcome:fromOutcome,createFromLead:fromLead,createFromPortfolio:fromPortfolio,getOpenTasks:getOpen,getByPriority:getByPriority,completeTask:complete,skipTask:skip};
})();
