#!/usr/bin/env node
'use strict';
var fs=require('node:fs'),assert=require('node:assert/strict'),Decision=require('../lib/trade-auction-decision.js'),Executor=require('../lib/trade-auction-executor.js'),Observer=require('../lib/trade-auction-observer.js'),Recovery=require('../lib/trade-auction-recovery.js'),Learning=require('../lib/trade-auction-learning.js');
function memory(){var d=new Map(),l=new Map();return{assertDurable:function(){return true;},get:async function(k){return d.has(k)?JSON.parse(JSON.stringify(d.get(k))):null;},set:async function(k,v){d.set(k,JSON.parse(JSON.stringify(v)));return true;},setIfAbsent:async function(k,v){if(d.has(k))return false;d.set(k,JSON.parse(JSON.stringify(v)));return true;},lpush:async function(k,v){var a=l.get(k)||[];a.unshift(JSON.parse(JSON.stringify(v)));l.set(k,a);return a.length;},ltrim:async function(k,a,b){l.set(k,(l.get(k)||[]).slice(a,b+1));return true;},lrange:async function(k,a,b){return JSON.parse(JSON.stringify((l.get(k)||[]).slice(a,b+1)));}};}
(async function(){var store=memory(),now=Date.now(),cognition={ts:now,c:{domain:'supplyChain',immune:{immuneState:'clear'},awareness:{humanReviewRequired:false},brainOrgans:{autonomousInternalEmission:{holdReason:null,emittedCount:1},resourceMetabolism:{state:'AVAILABLE',gates:{mayRunInternalCycle:true}}},serverPacket:{schemaVersion:'civilization-domain-packet/1.0',domainId:'supplyChain',packetId:'trade_packet_1',generatedAt:new Date(now).toISOString(),sourceIdentity:{producer:'brain-cognition-refresh/1'},truth:{feedHealth:{live:8},opportunities:[{id:'trade-inventory-001',path:'RESEARCHABLE',held:false}]}}}};
var candidate=Decision.candidate({listingRequestId:'trade-listing-001',marketplaceId:'market-001',sellerId:'seller-001',assetRef:'owned-equipment-001',title:'Owned equipment auction preview',description:'Public price discovery for an owned equipment asset. No order or payment is accepted by this listing.',category:'equipment',condition:'used',quantity:1,reservePriceUsd:7500,auctionEndsAt:new Date(now+7*86400000).toISOString(),brainOpportunityId:'trade-inventory-001',evidenceId:'asset-rights-record-001',assetRightsConfirmed:true,bindingSaleAuthorized:false,orderAcceptanceAuthorized:false,paymentAuthorized:false});assert(candidate);assert.equal(Decision.validateCandidate(candidate),true);assert.equal(Decision.candidate({listingRequestId:'x'}),null);
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = memory(), candidateBefore = JSON.stringify(candidate);
  for (var routeCase of [
    ['PASS', { immuneState: 'clear' }],
    ['HOLD', { immuneState: 'clear', quarantines: ['unresolved-domain-evidence'] }],
    ['QUARANTINE', { immuneState: 'alert', candidateScoped: true, integrityThreat: true }],
    ['REJECT', null]
  ]) {
    var routeCognition = JSON.parse(JSON.stringify(cognition)); routeCognition.c.immune = routeCase[1];
    var routed = await Decision.decide(routeStore, candidate, now, { cognition: routeCognition, maxReserveUsd: 10000 });
    assert.equal(routed.immuneRouting.route, routeCase[0]);
    assert.equal(routed.immuneRouting.candidatePreserved, true);
    var readonlyRouteStore = Object.create(routeStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
      readonlyRouteStore[method] = async function () { throw Error('route read attempted write'); };
    });
    readonlyRouteStore.lrange = async function (key, start, end) {
      return key === Decision.LOG_KEY ? [routed] : routeStore.lrange(key, start, end);
    };
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'trade', now);
    assert.equal(routeTrace.status, 'RECORDED');
    assert.equal(routeTrace.decision.id, routed.decisionReceiptId);
    assert.equal(routeTrace.decision.immuneRoute, routeCase[0]);
    assert.equal(routeTrace.command, null);
    assert.equal(routeTrace.externalActionAuthorized, false);
    var routeElement = { innerHTML: '' }, routeWindow = { addEventListener: function () {} };
    require('node:vm').runInNewContext(fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8'), {
      window: routeWindow, Date: Date, setInterval: function () {},
      document: { readyState: 'loading', addEventListener: function () {}, getElementById: function () { return routeElement; } },
      fetch: async function (url) { return { ok: true, json: async function () {
        return url.includes('brain-cognition') ? { cognition: { 'trade': { ts: now, c: { businessTrace: routeTrace } } } } : {};
      } }; }
    });
    await routeWindow.LIMENExecutionObservatory.refresh();
    assert(routeElement.innerHTML.includes(routed.decisionReceiptId));
    assert(routeElement.innerHTML.includes(routeCase[0]));
    assert.equal(routed.status, routeCase[0] === 'PASS' ? 'RELEASED' : 'NO_ACTION');
    assert.equal(Decision.validateReceipt(routed, candidate, now), routeCase[0] === 'PASS');
    assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed);
    assert.deepEqual(await Decision.decide(routeStore, candidate, now, { cognition: routeCognition, maxReserveUsd: 10000 }), routed, 'immutable route replay');
    if (routeCase[0] !== 'PASS') {
      var reconsidered = await Decision.decide(routeStore, candidate, now + 1, { cognition: cognition, maxReserveUsd: 10000 });
      assert.equal(reconsidered.immuneRouting.route, 'PASS');
      assert.notEqual(reconsidered.decisionReceiptId, routed.decisionReceiptId);
      assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed, 'reconsideration preserves prior route');
      var refused = await Executor.execute({ store: routeStore, candidate: candidate, decision: routed, now: now + 1,
        motorAuthorization: { authorize: async function () { throw Error('non-PASS reached motor'); } },
        marketplace: { createListing: async function () { throw Error('non-PASS reached transport'); } } });
      assert.equal(refused.reason, 'trade-auction-exact-b10-decision-required');
      assert.equal(refused.accepted, 0);
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(memory(), candidate, now, { cognition: cognition, maxReserveUsd: 10000 });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize a listing');


var canonicalCognition = structuredClone(cognition); canonicalCognition.c.serverPacket.domainId = 'trade';
assert.equal(Decision.validBrain(canonicalCognition, now), true);
var fetchedDecision = await Decision.decide(memory(), candidate, now, { maxReserveUsd: 10000, redisGet: async function (key) {
  assert.equal(key, 'limen:brain:cognition:trade'); return canonicalCognition;
} });
assert.equal(fetchedDecision.status, 'RELEASED');
var foreignPacket = structuredClone(canonicalCognition); foreignPacket.c.serverPacket.domainId = 'industry';
assert.equal(Decision.validBrain(foreignPacket, now), false);

var noCap=await Decision.decide(memory(),candidate,now,{cognition:cognition});assert(noCap.blockers.includes('trade-auction-reserve-cap-not-configured'));var held=await Decision.decide(memory(),candidate,now,{cognition:cognition,maxReserveUsd:1000});assert(held.blockers.includes('trade-auction-reserve-exceeds-cap'));var decision=await Decision.decide(store,candidate,now,{cognition:cognition,maxReserveUsd:10000});assert.equal(decision.status,'RELEASED');assert.equal(decision.paymentAuthorized,false);
var listings={},calls=0,marketplace={createListing:async function(v){calls++;assert(await store.get(Learning.causeKey(decision.actionId)));assert.equal(v.saleMode,'auction');assert.equal(v.paymentAuthorized,false);var x=Object.assign({id:'listing-001',status:'active'},v);listings[x.id]=x;return x;},updateListing:async function(id,u){listings[id]=Object.assign(listings[id],u);return listings[id];}},motorN=0,motor={authorize:async function(){motorN++;return{authorized:true,receiptId:'trade_motor_'+motorN};}};
var command=await Executor.execute({store:store,candidate:candidate,decision:decision,now:now+1,motorAuthorization:motor,operationCostUsd:0,dailyBudgetUsd:0,dailyListingCap:1,marketplace:marketplace});assert.equal(command.status,'LISTED');assert.equal(command.durableReceiptReadbackVerified,true);assert.equal(command.bindingSaleAuthorized,false);assert.equal(command.orderAcceptanceAuthorized,false);assert.equal(command.paymentAuthorized,false);assert.equal(calls,1);var replay=await Executor.execute({store:store,candidate:candidate,decision:decision,now:now+2,motorAuthorization:motor,operationCostUsd:0,dailyBudgetUsd:0,dailyListingCap:1,marketplace:marketplace});assert.equal(replay.replayed,true);assert.equal(calls,1);
function publicFetch(){var active=Object.values(listings).filter(function(x){return x.status==='active';});return Promise.resolve({ok:true,status:200,json:async function(){return{ok:true,listings:active};}});}var observation=await Observer.observe(store,command,publicFetch,'https://example.test');assert.equal(observation.status,'PUBLIC_LISTING_PRESENCE_OBSERVED');assert.equal(observation.independentOfCreateResponse,true);assert.equal(observation.orderObserved,false);assert.equal(observation.saleObserved,false);var learned=await Learning.recordObservation(store,observation);assert.equal(learned.signal.normalizedCredit,0);assert.equal((await Learning.readForBrain(store)).learningGate.ready,false);var returned=await Decision.decide(store,candidate,now+2,{cognition:cognition,maxReserveUsd:10000});assert.equal(returned.status,'NO_ACTION');assert(returned.blockers.includes('trade-returned-outcome-requires-reassessment'));assert.equal(returned.returnedOutcome.status,'OBSERVED');assert.equal(returned.returnedOutcome.signalOutcome,'public-listing-present-no-order-or-sale');assert.equal(returned.returnedOutcome.normalizedCredit,0);assert.equal(returned.returnedOutcome.effect,'CONSUMED_AS_SUPPLY_CHAIN_AFFERENT');assert.notEqual(returned.decisionReceiptId,decision.decisionReceiptId,'returned consequence must change the next decision receipt identity');
var recovery=await Recovery.recover({store:store,command:command,observation:observation,now:now+3,motorAuthorization:motor,marketplace:marketplace,observePublicAbsence:function(c){return Observer.publicAbsent(publicFetch,c,'https://example.test');}});assert.equal(recovery.status,'CLOSED_VERIFIED');assert.equal(recovery.strictSuppressionReadback,true);assert.equal(recovery.independentPublicAbsenceVerified,true);var suppressed=await Executor.execute({store:store,candidate:candidate,decision:decision,now:now+4,motorAuthorization:motor,operationCostUsd:0,dailyBudgetUsd:0,dailyListingCap:1,marketplace:marketplace});assert.equal(suppressed.reason,'trade-auction-asset-suppressed');assert.equal(calls,1);console.log('trade auction: sovereign owned-asset decision, capped B14 listing, public observation, zero-credit learning, and close recovery passed');
await require('./assert-business-trace.cjs')(store,'supplyChain',command,'OWNED-LISTING',now+1000,'trade_packet_1');
var trace=await require('../lib/product-domain-business-trace-readout.js').read(store,'trade',now+1000);assert.equal(trace.ownerDomain,'supplyChain');assert.equal(trace.command.listingOnly,true);
var original=await store.get(Executor.commandKey(command.commandId));await store.set(Executor.commandKey(command.commandId),Object.assign({},original,{paymentAuthorized:true}));assert.equal((await require('../lib/product-domain-business-trace-readout.js').read(store,'trade',now+1000)).reason,'command-readback-invalid');await store.set(Executor.commandKey(command.commandId),original);
})().catch(function(e){console.error(e);process.exit(1);});
