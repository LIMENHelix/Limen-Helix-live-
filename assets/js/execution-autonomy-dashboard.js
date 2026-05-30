/**
 * execution-autonomy-dashboard.js — Autonomy Dashboard
 * Renders compact Phase 10 autonomy widgets.
 * Exposes: window.LIMENExecution.phase10.autonomyDashboard
 */
(function(){
  'use strict';
  window.LIMENExecution=window.LIMENExecution||{};window.LIMENExecution.phase10=window.LIMENExecution.phase10||{};

  function _safe(fn,fallback){try{return fn()}catch(e){return fallback}}

  function buildDashboardData(){
    var p10=window.LIMENExecution.phase10;var widgets={};

    if(p10.recommendations)widgets.recommendedActions=_safe(function(){var a=p10.recommendations.getTopRecommendedActions(5);return{count:a.length,top:a.slice(0,3).map(function(x){return{title:x.title,priority:x.priorityScore,risk:x.riskLevel}})}},{});
    if(p10.nextAction)widgets.nextBestAction=_safe(function(){var nba=p10.nextAction.getGlobalNextBestAction();return nba?{title:nba.title,priority:nba._boostedScore||nba.priorityScore,risk:nba.riskLevel}:null},null);
    if(p10.readiness)widgets.readyNow=_safe(function(){return{count:p10.readiness.getActionsReadyNow().length}},{});
    if(p10.decisionSynthesis)widgets.decisionSynthesis=_safe(function(){var b=p10.decisionSynthesis.getDecisionBuckets();return{executeNow:b['EXECUTE NOW'].length,reviewToday:b['REVIEW TODAY'].length,blocked:b['BLOCKED'].length,watch:b['WATCH'].length,defer:b['DEFER'].length}},{});
    if(p10.guided)widgets.guidedSequences=_safe(function(){var active=p10.guided.getActiveSequence();var history=p10.guided.getSequenceHistory();return{activeSequence:active?active.playbookType:null,totalSequences:history.length}},{});
    if(p10.drafts)widgets.draftActions=_safe(function(){return{count:p10.drafts.getDraftActions().length}},{});
    if(p10.confirmation)widgets.pendingConfirmations=_safe(function(){return{count:p10.confirmation.getPendingConfirmations().length}},{});

    return widgets;
  }

  window.LIMENExecution.phase10.autonomyDashboard={buildDashboardData:buildDashboardData};
})();
