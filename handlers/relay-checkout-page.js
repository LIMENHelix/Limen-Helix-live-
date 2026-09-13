/**
 * relay-checkout-page.js — real checkout bridge for a Relay Supply search result.
 *
 * /relay sends searched items here with ?searchId=...&itemId=.... The previous page was
 * an MVP simulator that never called the demand-purchase backend. This page collects the
 * evidence the real route requires and then redirects to the genuine Stripe URL returned
 * by /api/relay-demand-purchase.
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'GET only' }));
  }

  let q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (_) {}
  const searchId = String(q.searchId || '');
  const itemId = String(q.itemId || '');
  if (!searchId || !itemId) {
    res.statusCode = 302;
    res.setHeader('Location', '/relay');
    return res.end('Missing sourced item; returning to Relay Supply');
  }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relay Supply · Complete order</title><style>
:root{--bg:#f7f8fa;--card:#fff;--ink:#111827;--soft:#6b7280;--line:#e5e7eb;--blue:#2563eb;--warn:#92400e;--warnbg:#fffbeb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:620px;margin:36px auto;padding:0 18px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.top a{text-decoration:none;color:var(--soft)}h1{margin:0;font-size:1.55rem}.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}.sub{color:var(--soft);font-size:.86rem;margin:4px 0 16px}.field{display:block;margin:10px 0}.field span{display:block;font-size:.75rem;color:var(--soft);margin-bottom:4px}.field input{width:100%;font-size:16px;border:1px solid var(--line);border-radius:8px;padding:10px 11px}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.policy{background:var(--warnbg);border:1px solid #f0b429;border-radius:9px;padding:12px;margin-top:14px;font-size:.82rem}.policy label{display:flex;gap:9px;align-items:flex-start}.policy input{width:18px;height:18px;margin-top:2px}.pay{width:100%;border:0;border-radius:9px;background:var(--blue);color:#fff;font-weight:800;padding:12px;margin-top:14px;cursor:pointer}.pay:disabled{opacity:.5;cursor:not-allowed}.msg{font-size:.82rem;color:var(--soft);margin-top:10px;text-align:center}.err{color:#991b1b}@media(max-width:600px){.row{grid-template-columns:1fr}.wrap{margin-top:18px}}</style></head><body><div class="wrap"><div class="top"><h1>Relay Supply</h1><a href="/relay">← Back to store</a></div><div class="card"><b>Complete your sourced-item order</b><p class="sub">Relay will re-check the supplier, shipping cost and price for this address before creating payment. Nothing is charged on this page.</p>
<label class="field"><span>Full name</span><input id="name" autocomplete="name"></label><label class="field"><span>Email for order updates</span><input id="email" type="email" autocomplete="email"></label><label class="field"><span>Street address</span><input id="line1" autocomplete="address-line1"></label><label class="field"><span>Apartment / suite (optional)</span><input id="line2" autocomplete="address-line2"></label><div class="row"><label class="field"><span>City</span><input id="city" autocomplete="address-level2"></label><label class="field"><span>State</span><input id="state" autocomplete="address-level1"></label></div><div class="row"><label class="field"><span>ZIP</span><input id="zip" autocomplete="postal-code"></label><label class="field"><span>Country</span><input id="country" value="US" autocomplete="country"></label></div><div class="policy"><label><input id="accept" type="checkbox"><span id="policyText">I confirm the Relay final-sale terms. <a href="/api/relay?view=policy" target="_blank" rel="noopener">Read the terms</a>.</span></label></div><button class="pay" id="pay" disabled>Re-check item & continue to Stripe →</button><div class="msg" id="msg"></div></div></div><script>
var SEARCH_ID=${JSON.stringify(searchId)}, ITEM_ID=${JSON.stringify(itemId)};var $=function(id){return document.getElementById(id)};var BUYER='supply_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);$('accept').addEventListener('change',function(){$('pay').disabled=!this.checked});fetch('/api/relay?view=policy&format=json').then(function(r){return r.json()}).then(function(p){if(p&&p.confirmLabel)$('policyText').firstChild.nodeValue=p.confirmLabel+' '}).catch(function(){});$('pay').addEventListener('click',async function(){var addr={name:$('name').value.trim(),line1:$('line1').value.trim(),line2:$('line2').value.trim(),city:$('city').value.trim(),state:$('state').value.trim(),postalCode:$('zip').value.trim(),country:($('country').value.trim()||'US').toUpperCase()};var email=$('email').value.trim();if(!addr.name||!addr.line1||!addr.city||!addr.state||!addr.postalCode||!email){$('msg').className='msg err';$('msg').textContent='Complete your name, email and shipping address.';return}var b=$('pay');b.disabled=true;b.textContent='Re-checking supplier and price…';$('msg').textContent='';try{var r=await fetch('/api/relay-demand-purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({searchId:SEARCH_ID,itemId:ITEM_ID,buyerId:BUYER,buyerEmail:email,shippingAddress:addr,policyAccepted:true})});var j=await r.json();if(j.ok&&j.url){window.location.href=j.url;return}throw new Error(j.message||j.error||'This item cannot be ordered right now')}catch(e){$('msg').className='msg err';$('msg').textContent=e.message;b.disabled=false;b.textContent='Try again →'}});</script></body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
};
