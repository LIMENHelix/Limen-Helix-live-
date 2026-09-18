const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const presentation = require('../lib/relay-product-presentation');
const categories = require('../assets/js/relay-sourced-presentation');
const feed = require('../handlers/relay-shopify-catalog');
function response() { return { statusCode: 200, headers: {}, setHeader(k,v){this.headers[k]=v;}, end(body){this.body=body;} }; }
async function run() {
  for (const file of ['pages/relay-home.html','pages/relay-store.html']) {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], { filename: file });
  }
  const normalized = presentation.normalize({
    title: 'Soft tee', variant: 'Black-XL', material:'["Cotton"]',
    description:'<p>Size: XL</p><table><tr><th>Chest</th><td>110 cm</td></tr></table><script>steal()</script><img src="https://evil.example/tracker"><img src="https://cf.cjdropshipping.com/size.jpg">',
    image: 'javascript:alert(1)', sourceCost: 4
  });
  assert.equal(normalized.variant,'Black-XL');
  assert.equal(normalized.material,'Cotton');
  assert.match(normalized.description,/Chest \| 110 cm/);
  assert.doesNotMatch(normalized.description,/steal|script/);
  assert.deepEqual(normalized.detailImages,['https://cf.cjdropshipping.com/size.jpg']);
  assert.equal(normalized.image,null);
  assert.equal(normalized.sourceCost,undefined);
  assert.equal(categories.category({title:'LED Strip Lights — Black-90cm',category:'other'}),'Lighting');
  assert.equal(categories.category({title:'Pet Grooming Brush — Blue',category:'other'}),'Pet care');
  assert.equal(categories.category({title:'Unknown item',category:'other'}),'Everyday finds');
  assert.deepEqual(categories.parts({title:'T-shirt — Black-XL'}),{title:'T-shirt',variant:'Black-XL'});
  const raw = { handle:'safe-tee',title:'Tee',vendor:'Supplier',images:[{src:'https://cdn.shopify.com/tee.jpg'}],variants:[{available:true,price:'20'},{available:false,price:'1'}],options:[{name:'Size',values:['XL']}],cost:2 };
  const product = feed.product(raw);
  assert.equal(product.price,20);
  assert.equal(product.cost,undefined);
  assert.equal(product.url,'https://0abp5n-dy.myshopify.com/products/safe-tee');
  assert.equal(feed.product({...raw,handle:'../../admin'}),null);
  assert.equal(feed.product({...raw,variants:[{available:false,price:'20'}]}),null);
  global.fetch = async url => {
    assert.ok(String(url).startsWith('https://0abp5n-dy.myshopify.com/collections/'));
    if(String(url).includes('/coffee/')) throw new Error('network');
    return {ok:true,json:async()=>({products:[raw]})};
  };
  let res = response(); await feed({method:'GET'},res);
  const data = JSON.parse(res.body);
  assert.equal(data.collections.length,4);
  assert.equal(data.collections[0].available,false);
  assert.equal(data.collections[1].products.length,1);
  // Product detail endpoint is bound to an active listing; arbitrary supplier IDs cannot be queried.
  const storePath=require.resolve('../lib/relay-store'),cjPath=require.resolve('../lib/relay-cj');
  let calls=0;
  require.cache[storePath]={id:storePath,filename:storePath,loaded:true,exports:{getListing:async id=>id==='valid'?{id,status:'active',quantity:1,sourceProvider:'cj',sourceId:'vid-1'}:null}};
  require.cache[cjPath]={id:cjPath,filename:cjPath,loaded:true,exports:{productDetails:async vid=>{calls++;assert.equal(vid,'vid-1');return {variant:'Black-XL',description:'Cotton tee',sourceCost:2,sourceUrl:'private'};}}};
  const details=require('../handlers/relay-product-details');
  res=response(); await details({method:'GET',url:'/api/relay?view=product-details&id=unknown'},res); assert.equal(res.statusCode,404); assert.equal(calls,0);
  res=response(); await details({method:'POST',url:'/api/relay?id=valid'},res); assert.equal(res.statusCode,405); assert.equal(calls,0);
  res=response(); await details({method:'GET',url:'/api/relay?id=valid'},res); assert.equal(res.statusCode,200); assert.equal(calls,1); assert.doesNotMatch(res.body,/sourceCost|sourceUrl|private/);
  res=response(); await details({method:'GET',url:'/api/relay?id=valid'},res); assert.equal(calls,1);
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.equal(config.rewrites.find(r=>r.source==='/relay').destination,'/pages/relay-home.html');
  assert.equal(config.redirects.find(r=>r.source==='/relay-sourced').destination,'/api/relay?view=store');
  assert.equal(config.redirects.find(r=>r.source==='/shop').destination,'https://0abp5n-dy.myshopify.com/');
  console.log('PASS: read-only feeds, product sanitization, variant integrity, unavailable data fallback, private-data boundary and route configuration');
}
run().catch(e=>{console.error(e);process.exit(1);});
