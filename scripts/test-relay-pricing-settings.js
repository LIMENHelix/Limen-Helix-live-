const assert = require('node:assert/strict');
// Isolated fixtures; no production credentials or network access.
process.env.UPSTASH_REDIS_REST_URL='https://pricing-test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN='test-only';
process.env.RELAY_ADMIN_KEY='test-admin';
delete process.env.RELAY_MARGIN_KEY; delete process.env.ADMIN_MASTER; delete process.env.ADMIN_MASTER_KEY;
const p=require('../lib/relay-pricing-settings');
const handler=require('../handlers/relay-margin');
const cfg={minMarginUsd:8,minMarginPct:0.18};
assert.equal(p.priceFor(100,.35,cfg),135);
assert.equal(p.priceFor(10,.35,cfg),18);
assert.equal(p.priceFor(100,.05,cfg),121.96);
assert.equal(p.priceFor(null,.35,cfg),null);
assert.equal(p.priceFor(0,.35,cfg),null);
assert.throws(()=>p.priceFor(100,.35,{...cfg,minMarginPct:1}));
const listings={a:{id:'a',title:'CJ',sourceMarketplace:'cj',sourceCost:40,price:80.4,status:'active',sourceId:'exact-variant',quantity:1},
 b:{id:'b',sourceMarketplace:'cj',sourceCost:10,price:20.1,status:'active'},
 c:{id:'c',sourceMarketplace:'cj',sourceCost:null,price:20,status:'active'},
 d:{id:'d',sourceMarketplace:'ebay',sourceCost:20,price:40,status:'active'},
 e:{id:'e',sourceMarketplace:'cj',sourceCost:20,price:40,status:'sold'}};
let state={'limen:relay_margin':'1.01','limen:relay:store:listings':JSON.stringify(listings),'limen:relay:autonomy':JSON.stringify(cfg)};
let calls=0, writes=0, conflicts=0, fail=false;
global.fetch=async(url,options)=>{
 assert.equal(url,'https://pricing-test.invalid'); calls++;
 if(fail)return {ok:true,json:async()=>({error:'unavailable'})};
 const [cmd,...args]=JSON.parse(options.body);let result;
 if(cmd==='GET') result=state[args[0]]??null;
 else if(cmd==='MGET') result=args.map(k=>state[k]??null);
 else if(cmd==='EVAL'){
   const [script,count,...rest]=args;assert.equal(script,p.CAS);assert.equal(count,'4');
   const keys=rest.slice(0,4),values=rest.slice(4);
   assert.deepEqual(keys,['limen:relay_margin','limen:relay:store:listings','limen:relay:autonomy','limen:relay:pricing:last-change']);
   if(conflicts>0){conflicts--;state[keys[1]]=JSON.stringify({...JSON.parse(state[keys[1]]),concurrent:{id:'concurrent',sourceMarketplace:'cj',sourceCost:100,price:200,status:'active'}});result=0;}
   else if(keys.slice(0,3).some((k,i)=>(state[k]??'')!==values[i]))result=0;
   else{state[keys[3]]=values[5];state[keys[0]]=values[3];if(values[6]==='1')state[keys[1]]=values[4];writes++;result=1;}
 }else throw new Error('Unexpected command');
 return {ok:true,json:async()=>({result})};
};
async function request(method,body,url='/api/relay-margin'){
 let status,headers={},value;
 await handler({method,body,url},{set statusCode(v){status=v},setHeader(k,v){headers[k]=v},end(v){value=JSON.parse(v)}});
 assert.equal(headers['Cache-Control'],'no-store');return{status,...value};
}
(async()=>{
 assert.equal((await p.current()).margin,1.01);
 const before=JSON.stringify(state);const preview=await p.change(.35,true,false);
 assert.equal(preview.changed,2);assert.equal(preview.skipped,1);assert.equal(JSON.stringify(state),before);assert.equal(writes,0);
 const unauthCalls=calls;assert.equal((await request('POST',{action:'save',margin:.35,passcode:'wrong'})).status,403);assert.equal(calls,unauthCalls);
 assert.equal((await request('GET',null,'/api/relay-margin?set=0.35&key=test-admin')).status,405);
 for(const bad of [null,'0.35',-.1,2])assert.equal((await request('POST',{action:'save',margin:bad,passcode:'test-admin'})).status,400);
 conflicts=1;
 const result=await request('POST',{action:'save',margin:.35,reprice:true,passcode:'test-admin'});
 assert.equal(result.status,200);assert.equal(result.saved,true);assert.equal(result.changed,3);
 const after=JSON.parse(state['limen:relay:store:listings']);
 assert.equal(after.a.price,54);assert.equal(after.b.price,18);assert.equal(after.concurrent.price,135);
 assert.equal(after.a.sourceId,'exact-variant');assert.equal(after.a.quantity,1);
 assert.deepEqual(after.c,listings.c);assert.deepEqual(after.d,listings.d);assert.deepEqual(after.e,listings.e);
 assert.equal(JSON.parse(state['limen:relay:pricing:last-change']).listings.a.price,80.4);
 assert.equal((await request('GET')).margin,.35);
 const existing=state['limen:relay:store:listings'];await p.change(.4,false,true);assert.equal(state['limen:relay:store:listings'],existing);
 fail=true;assert.equal((await request('POST',{action:'save',margin:.35,passcode:'test-admin'})).status,503);
 console.log('PASS: pricing floors, auth, preview, atomic save/retry, backup, CJ-only scope, order isolation, database failure');
})().catch(e=>{console.error(e);process.exitCode=1});
