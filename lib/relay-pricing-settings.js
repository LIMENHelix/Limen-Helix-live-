// Atomic settings + CJ listing repricing. Never touches orders or supplier records.
const defaults = require('./relay-autonomy').DEFAULTS;
const KEYS = ['limen:relay_margin', 'limen:relay:store:listings', 'limen:relay:autonomy', 'limen:relay:pricing:last-change'];
const CAS = "for i=1,3 do local v=redis.call('GET',KEYS[i]) or '' if v~=ARGV[i] then return 0 end end " +
  "redis.call('SET',KEYS[4],ARGV[6]) redis.call('SET',KEYS[1],ARGV[4]) " +
  "if ARGV[7]=='1' then redis.call('SET',KEYS[2],ARGV[5]) end return 1";
async function redis(args) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Database unavailable');
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN},
    body:JSON.stringify(args), signal:AbortSignal.timeout(10000)
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error('Database operation failed');
  return j.result;
}
function parsed(raw, fallback) { return raw == null ? fallback : JSON.parse(raw); }
function priceFor(cost, markup, config) {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const dollar = Number(config.minMarginUsd), pct = Number(config.minMarginPct);
  if (!Number.isFinite(dollar) || dollar < 0 || !Number.isFinite(pct) || pct < 0 || pct >= 1) throw new Error('Invalid pricing floor');
  return Math.ceil((Math.max(cost * (1 + markup), cost + dollar, cost / (1 - pct)) - 1e-9) * 100) / 100;
}
function plan(listings, markup, config, reprice) {
  const next = {...listings}, changes = [];
  let skipped = 0;
  if (reprice) for (const l of Object.values(listings)) {
    if (l.status !== 'active' || l.sourceMarketplace !== 'cj') continue;
    const price = priceFor(l.sourceCost, markup, config);
    if (price === null || !Number.isFinite(l.price)) { skipped++; continue; }
    next[l.id] = {...l, price, marginAtListing:markup};
    if (l.price !== price) changes.push({id:l.id,title:l.title,before:l.price,after:price});
  }
  return {next,changes,skipped};
}
async function current() {
  const raw = await redis(['GET',KEYS[0]]);
  const margin = parsed(raw,0.35);
  if (!Number.isFinite(margin)) throw new Error('Invalid stored markup');
  return {margin,source:raw == null?'default':'db',scope:'CJ Sourced Finds'};
}
async function change(markup, reprice, save) {
  for (let attempt=0;attempt<4;attempt++) {
    const raw = await redis(['MGET',...KEYS.slice(0,3)]);
    if (!Array.isArray(raw) || raw.length!==3) throw new Error('Invalid database response');
    const listings = parsed(raw[1],{});
    if (!listings || Array.isArray(listings) || typeof listings!=='object') throw new Error('Invalid listings');
    const config = {...defaults,...parsed(raw[2],{})};
    const p = plan(listings,markup,config,reprice);
    const result = {ok:true,margin:markup,reprice,changed:p.changes.length,skipped:p.skipped,changes:p.changes,
      minMarginUsd:config.minMarginUsd,minMarginPct:config.minMarginPct};
    if (!save) return {...result,preview:true};
    const backup = JSON.stringify({at:new Date().toISOString(),markup:parsed(raw[0],null),listings:reprice?listings:null,changes:p.changes});
    const written = await redis(['EVAL',CAS,'4',...KEYS,...raw.map(v=>v==null?'':v),JSON.stringify(markup),JSON.stringify(p.next),backup,reprice?'1':'0']);
    if (Number(written)===1) return {...result,saved:true};
  }
  throw new Error('Pricing changed concurrently');
}
module.exports = {current,change,priceFor,plan,CAS};
