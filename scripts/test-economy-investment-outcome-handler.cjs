'use strict';
const assert=require('node:assert/strict');
const Handler=require('../handlers/economy-investment-outcome-observer.js');
const Decision=require('../lib/economy-investment-decision.js');
const Executor=require('../lib/economy-investment-executor.js');
const Learning=require('../lib/autofire-learning.js');
function memory(){const values=new Map(),lists=new Map();return{values,lists,assertDurable(){},get:async k=>structuredClone(values.get(k)||null),set:async(k,v)=>{values.set(k,structuredClone(v));return true;},setIfAbsent:async(k,v)=>{if(values.has(k))return false;values.set(k,structuredClone(v));return true;},lpush:async(k,v)=>{const a=lists.get(k)||[];a.unshift(structuredClone(v));lists.set(k,a);return a.length;},ltrim:async(k,a,b)=>lists.set(k,(lists.get(k)||[]).slice(a,b+1)),lrange:async(k,a,b)=>structuredClone((lists.get(k)||[]).slice(a,b+1))};}
async function invoke(deps){let body;const res={setHeader(){},end:b=>body=JSON.parse(b)};await Handler.createHandler({...deps,cronAuth:{enforce:()=>true}})({method:'GET'},res);return{code:res.statusCode,body};}
(async()=>{
let reads=0,writes=0;
const unsafe={assertDurable(){},get:async()=>null,lrange:async k=>k===Executor.LOG_KEY?[{status:'COMMAND_RECEIPTED',commandId:'LOCAL-unsaved',brokerCommandId:'LOCAL-broker'}]:[],lpush:async()=>{writes++;throw Error('unjoined evidence attempted history write');},ltrim:async()=>true};
const refused=await invoke({store:unsafe,b14:{reconcile:async()=>{reads++;return{commandId:'LOCAL-foreign',intent:{ownerDomain:'economy',symbol:'ACME',benchmarkSymbol:'SPY'}};}},broker:{accountSnapshot:async()=>{reads++;return{positions:[]};},quote:async()=>{reads++;return{last:1};}}});
assert.equal(reads,0,'unsaved command reached provider');assert.equal(writes,0);assert.equal(refused.body.abstentions[0].reason,'economy-command-causal-join-invalid');
const store=memory(),started=Date.now()-31*86400000;
const evidence=[0,1].map(i=>({title:'LOCAL issuer '+i,url:'https://fixture.invalid/economy/'+i,feedName:'LOCAL-feed-'+i,recordedAt:new Date(started).toISOString()}));
const candidate=Decision.candidate({requestId:'LOCAL-investment',symbol:'ACME',issuerName:'LOCAL issuer',side:'buy',maxNotionalUsd:100,riskLimitPct:8,benchmarkSymbol:'SPY',thesisId:'LOCAL-thesis',brainOpportunityId:'LOCAL-opportunity',feedEvidence:evidence,paperOnly:true,liveMoney:false});
const cognition={ts:started,c:{domain:'economy',immune:{immuneState:'clear'},awareness:{humanReviewRequired:false},brainOrgans:{autonomousInternalEmission:{emittedCount:1},resourceMetabolism:{state:'AVAILABLE',gates:{mayRunInternalCycle:true}}},serverPacket:{schemaVersion:'civilization-domain-packet/1.0',domainId:'economy',packetId:'LOCAL-packet',generatedAt:new Date(started).toISOString(),sourceIdentity:{producer:'brain-cognition-refresh/1'},truth:{feedHealth:{live:2},opportunities:[{id:'LOCAL-opportunity',path:'INVESTABLE',held:false}]}}}};
const titles=evidence.map(e=>({d:'economy',f:e.feedName,t:started,items:[{ti:e.title,au:e.url,tr:false}]}));
const decision=await Decision.decide(store,candidate,started,{cognition,titleSets:titles,maxNotionalUsd:150});assert.equal(decision.status,'RELEASED');
let intent;
const executorBroker={quote:async symbol=>({symbol,last:symbol==='SPY'?500:10,bid:10,ask:10}),accountSnapshot:async()=>({accountId:'LOCAL-account',totalCash:1000,positions:[]})};
const b14={createPreview:async(_store,_broker,value)=>{intent=structuredClone(value);return{previewId:'LOCAL-preview',confirmationSummary:'LOCAL-confirm'};},submitApproved:async()=>{
 const value={schemaVersion:1,commandId:'LOCAL-broker-command',emittedAt:new Date(started).toISOString(),intent,tag:'LOCAL-tag',efference:{schemaVersion:1,variables:[{predictedDelta:10}]},receipt:{orderId:'LOCAL-order',receivedAt:new Date(started).toISOString()},accountBefore:{accountId:'LOCAL-account',positions:[]},status:'RECONCILED_TERMINAL',order:{id:'LOCAL-order',tag:'LOCAL-tag',symbol:'ACME',side:'buy',status:'filled',executedQuantity:10,averageFillPrice:10,transactionAt:new Date(started).toISOString()},reafference:{matchedSelfEffect:{executedQuantity:10,averageFillPrice:10}},reconciliation:{interveningTrades:0,actualFees:0}};
 await store.set('tradier_b14_command:'+value.commandId,value);return value;}};
const owned=await Executor.execute({store,candidate,decision,now:started,broker:executorBroker,b14,motorAuthorization:{authorize:async()=>({authorized:true,receiptId:'LOCAL-motor'})},env:{ECONOMY_INVESTMENT_PAPER_ORDER_ENABLED:'1',ECONOMY_INVESTMENT_RECOVERY_ENABLED:'1'},maxNotionalUsd:150,dailyNotionalBudgetUsd:200,dailyOrderCap:2});assert.equal(owned.status,'COMMAND_RECEIPTED');
const historyKey='economy_investment_observation:'+owned.brokerCommandId;
await store.lpush(historyKey,{snapshotId:'LOCAL-initial',observedAt:new Date(started).toISOString(),accountId:'LOCAL-account',symbol:'ACME',positionQuantity:10,positionMarketValue:100,benchmarkSymbol:'SPY',benchmarkValue:500});
const storePath=require.resolve('../lib/autofire-efference-store.js'),outcomePath=require.resolve('../handlers/limen-outcome.js');
const previousStore=require.cache[storePath],previousOutcome=require.cache[outcomePath],previousFetch=global.fetch;
const oldUrl=process.env.UPSTASH_REDIS_REST_URL,oldToken=process.env.UPSTASH_REDIS_REST_TOKEN;
const redisLists=new Map();
process.env.UPSTASH_REDIS_REST_URL='https://fixture.invalid/redis';process.env.UPSTASH_REDIS_REST_TOKEN='LOCAL-fixture-token';
require.cache[storePath]={id:storePath,filename:storePath,loaded:true,exports:store};delete require.cache[outcomePath];
global.fetch=async(url,options)=>{assert.equal(url,'https://fixture.invalid/redis');const cmd=JSON.parse(options.body);let result;
 if(cmd[0]==='GET')result=null;
 else if(cmd[0]==='LPUSH'){const rows=redisLists.get(cmd[1])||[];rows.unshift(cmd[2]);redisLists.set(cmd[1],rows);result=rows.length;}
 else if(cmd[0]==='LRANGE')result=(redisLists.get(cmd[1])||[]).slice(cmd[2],cmd[3]<0?undefined:cmd[3]+1);
 else if(cmd[0]==='LTRIM'){redisLists.set(cmd[1],(redisLists.get(cmd[1])||[]).slice(cmd[2],cmd[3]+1));result='OK';}
 else if(cmd[0]==='INCRBY'||cmd[0]==='INCRBYFLOAT')result=1;
 else throw Error('unexpected fixture Redis command '+cmd[0]);return{ok:true,json:async()=>({result})};};
const actualOutcome=require(outcomePath);
try {
let reconciles=0,quotes=0,records=0,observedSource=null;const eventIds=new Set();
const observerBroker={accountSnapshot:async()=>{quotes++;return{accountId:'LOCAL-account',positions:[{symbol:'ACME',quantity:10,marketValue:90}]};},quote:async symbol=>{quotes++;return{symbol,last:symbol==='SPY'?500:9};}};
const outcome={recordAutonomousOutcome:async event=>{records++;observedSource=structuredClone(event.sourceIdentity);assert.equal(event.ownerDomain,'economy');assert.equal(event.actionId,owned.actionId);assert.equal(event.outcomeData.executionMode,'paper');assert.equal(event.outcomeData.brokerOrderId,owned.brokerOrderId);const result=await actualOutcome.recordAutonomousOutcome(event);if(result.event)eventIds.add(result.event.eventId);return result;}};
const deps={store,broker:observerBroker,b14:{reconcile:async()=>{reconciles++;return store.get('tradier_b14_command:'+owned.brokerCommandId);}},outcome};
const savedOwn=await store.get(Executor.commandKey(owned.commandId)),savedAction=await store.get(Executor.actionKey(owned.actionId)),savedCause=await store.get(Learning.causeKey(owned.actionId)),savedDecision=await store.get(Decision.key(owned.decisionReceiptId)),savedB14=await store.get('tradier_b14_command:'+owned.brokerCommandId);
for(const [key,original,changes] of [
 [Executor.commandKey(owned.commandId),savedOwn,[{ownerDomain:'technology'},{status:'AMBIGUOUS'},{durableReceiptReadbackVerified:false},{learningCauseDurable:false},{paperOnly:false},{liveMoney:true},{symbol:'WRONG'}]],
 [Executor.actionKey(owned.actionId),savedAction,[{schemaVersion:'foreign/1'},{brokerOrderId:'WRONG'},{status:'DISPATCHING'}]],
 [Decision.key(owned.decisionReceiptId),savedDecision,[{ownerDomain:'technology'},{actionId:'WRONG'},{evidenceHash:'WRONG'},{paperOnly:false},{liveMoney:true}]],
 [Learning.causeKey(owned.actionId),savedCause,[{domain:'technology'},{episodeId:'WRONG'},{ticker:'WRONG'}]],
 ['tradier_b14_command:'+owned.brokerCommandId,savedB14,[{commandId:'WRONG'},{receipt:{orderId:'WRONG'}},{intent:{...savedB14.intent,ownerDomain:'technology'}}]]]){
 for(const change of changes){await store.set(key,{...original,...change});const before=JSON.stringify(Array.from(store.values)),oldCalls=reconciles+quotes,oldRecords=records;const result=await invoke(deps);assert.equal(result.body.abstentions[0].reason,'economy-command-causal-join-invalid');assert.equal(reconciles+quotes,oldCalls);assert.equal(records,oldRecords);assert.equal(JSON.stringify(Array.from(store.values)),before);}
 await store.set(key,original);
}
for(const change of [{commandId:'WRONG'},{intent:{...savedB14.intent,actionId:'WRONG'}},{receipt:{orderId:'WRONG'}},{order:{...savedB14.order,id:'WRONG'}}]){
 const oldQuotes=quotes,oldRecords=records;const result=await invoke({...deps,b14:{reconcile:async()=>({...savedB14,...change})}});assert.equal(result.body.abstentions[0].reason,'economy-reconciled-command-identity-mismatch');assert.equal(quotes,oldQuotes);assert.equal(records,oldRecords);
}
const wrongSource=await invoke({...deps,broker:{...observerBroker,accountSnapshot:async()=>({accountId:'WRONG',positions:[]})}});assert.equal(wrongSource.body.abstentions[0].reason,'economy-observation-source-identity-mismatch');
for(const symbol of ['SPY','ACME']){const oldRecords=records;const result=await invoke({...deps,broker:{...observerBroker,quote:async requested=>({symbol:requested===symbol?'WRONG':requested,last:500})}});assert.equal(result.body.abstentions[0].reason,'economy-observation-source-identity-mismatch');assert.equal(records,oldRecords);}
const badReadback=Object.create(store);badReadback.lrange=async(k,a,b)=>{const rows=await store.lrange(k,a,b);return k===historyKey?rows.map(r=>({...r,accountId:'WRONG'})):rows;};
const readbackFailure=await invoke({...deps,store:badReadback});assert.equal(readbackFailure.code,503);assert.match(readbackFailure.body.failures[0].error,/snapshot readback invalid/);assert.equal(records,0);
// Persisted foreign and future history cannot supply the measurement or inflate drawdown.
await store.lpush(historyKey,{snapshotId:'LOCAL-foreign',observedAt:new Date(Date.now()+60000).toISOString(),accountId:'WRONG',symbol:'WRONG',positionQuantity:10,positionMarketValue:100000,benchmarkSymbol:'WRONG',benchmarkValue:99999});
const good=await invoke(deps);assert.equal(good.code,200,JSON.stringify(good.body));assert.equal(good.body.recorded,1);assert.equal(eventIds.size,1);assert.equal((await Learning._load(store,'economy')).processedOutcomeIds.length,1);
const repeat=await invoke(deps);assert.equal(repeat.body.recorded,0);assert.equal(eventIds.size,1);assert.equal((await Learning._load(store,'economy')).processedOutcomeIds.length,1);
const actualReconcile=await invoke({...deps,b14:require('../lib/tradier-b14.js'),broker:{...observerBroker,getOrder:async()=>structuredClone(savedB14.order)}});assert.equal(actualReconcile.code,200,JSON.stringify(actualReconcile.body));assert.equal(actualReconcile.body.recorded,0);
const learnedState=await Learning._load(store,'economy');assert.equal(learnedState.companyPatterns['ticker:ACME'].episodes[0].outcome,'FAILURE');
const durableEvent=JSON.parse(redisLists.get('limen:outcome_events:tradier-command:'+owned.brokerCommandId)[0]);
console.log('economy outcome handler: durable own command/cause/B14 join, independent paper result, negative refusal and replay passed');
assert.deepEqual(durableEvent.sourceIdentity,observedSource,'actual recorder lost independent source identity');
console.log('actual recorder return boundary',JSON.stringify({processed:learnedState.processedOutcomeIds.length,externalSignals:learnedState.externalLearning.resolvedCount,sourceRetained:!!durableEvent.sourceIdentity}));
} finally {global.fetch=previousFetch;if(oldUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=oldUrl;if(oldToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=oldToken;if(previousStore)require.cache[storePath]=previousStore;else delete require.cache[storePath];if(previousOutcome)require.cache[outcomePath]=previousOutcome;else delete require.cache[outcomePath];}

})().catch(e=>{console.error(e);process.exit(1);});
