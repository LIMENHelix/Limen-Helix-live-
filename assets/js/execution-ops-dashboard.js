/**
 * execution-ops-dashboard.js — Global Ops Dashboard Widget
 * Compact summary for execution-capable surfaces.
 * Exposes: window.LIMENExecution.phase5.opsDashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase5=window.LIMENExecution.phase5||{};
  function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}
  function render(){
    var aq=window.LIMENExecution.phase5.actionQueue;var wl=window.LIMENExecution.phase5.workload;var esc2=window.LIMENExecution.phase5.escalation;var pm=window.LIMENExecution.phase5.portfolioMonitor;var crm=window.LIMENExecution.phase5.crm;
    var actions=aq?aq.getTop(5):[];var workload=wl?wl.getStatus():'?';var escalations=esc2?esc2.getSeverityCounts():{};var pfSummary=pm?pm.getSummary():{};var crmTotals=crm?crm.getValueTotals():{};
    var wlColor=workload==='CLEAR'?'#5ab5a0':workload==='LOADED'?'#C9A94E':workload==='HEAVY'?'#e85454':'#e85454';
    var h='<div style="font-family:\'IBM Plex Mono\',monospace;padding:8px 10px;border:1px solid rgba(201,169,78,0.06);border-radius:3px;background:rgba(0,0,0,0.1);margin-top:8px">';
    h+='<div style="font-size:0.24rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;font-weight:600;margin-bottom:4px">OPS DASHBOARD</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:0.28rem">';
    h+='<span style="color:'+wlColor+'">Workload: <b>'+workload+'</b></span>';
    h+='<span style="color:#807868">Actions: <b style="color:#d0c8b8">'+actions.length+'</b></span>';
    if(escalations.critical)h+='<span style="color:#e85454">Escalations: <b>'+escalations.critical+'</b></span>';
    if(pfSummary.distressed)h+='<span style="color:#e85454">Distressed: <b>'+pfSummary.distressed+'</b></span>';
    if(crmTotals.pipeline)h+='<span style="color:#C9A94E">Pipeline: <b>$'+(crmTotals.pipeline||0).toLocaleString()+'</b></span>';
    h+='<a href="/operator-sop" target="_blank" style="color:rgba(201,169,78,0.3);text-decoration:none;font-size:0.22rem;border:1px solid rgba(201,169,78,0.08);padding:1px 4px;border-radius:1px">SOP</a>';
    h+='<a href="/policy-procedures" target="_blank" style="color:rgba(201,169,78,0.3);text-decoration:none;font-size:0.22rem;border:1px solid rgba(201,169,78,0.08);padding:1px 4px;border-radius:1px">POLICY</a>';
    h+='</div>';
    // Top actions
    if(actions.length>0){h+='<div style="margin-top:4px">';for(var i=0;i<actions.length;i++)h+='<div style="font-size:0.26rem;color:#908878;padding:1px 0">\u25B8 '+esc(actions[i].label)+'</div>';h+='</div>'}
    h+='</div>';return h;
  }
  function mount(container){if(!container)return;var div=document.createElement('div');div.innerHTML=render();container.appendChild(div)}
  window.LIMENExecution.phase5.opsDashboard={render:render,mount:mount};
})();
