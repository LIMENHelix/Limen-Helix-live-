#!/usr/bin/env node
/**
 * rebuild-engine-outputs-local.cjs — regenerate the inline engineOutputs on
 * every bridged portal JSON using the market-data-backed generator.
 *
 * The company-portal page reads engineOutputs straight from the static portal
 * JSON (company-portal-ui.js loads assets/data/companies/<slug>.json). The old
 * inline outputs were placeholder-contaminated (investment/research suppressed).
 * This rewrites them with the fixed generator: real numbers for US EDGAR filers
 * (live Yahoo price + EDGAR fundamentals → phase-conditioned valuation), honest
 * qualitative for the rest. Writes back to the JSON; commit + push = the fix
 * goes live on limenhelix.com.
 *
 *   node scripts/rebuild-engine-outputs-local.cjs --only bynd
 *   node scripts/rebuild-engine-outputs-local.cjs --limit 20
 *   node scripts/rebuild-engine-outputs-local.cjs --all
 */
const fs = require('node:fs');
const path = require('node:path');
const { getMarketData } = require('../lib/market-data.js');
const gen = require('../lib/engine-output-generator.js');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const PLACEHOLDER_RE = /\$?\[[A-Z][A-Z0-9_]{1,80}\]/g;

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf('--' + n); return i === -1 ? d : args[i + 1]; };
const ONLY = getArg('only', null);
const LIMIT = parseInt(getArg('limit', ONLY ? '1' : (args.includes('--all') ? '100000' : '20')), 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  if (ONLY) files = files.filter(f => f === ONLY + '.json' || f.replace(/\.json$/, '') === ONLY);

  let done = 0, real = 0, qual = 0, skipped = 0, contaminated = 0, failed = 0;
  for (const f of files) {
    if (done >= LIMIT) break;
    let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { failed++; continue; }
    const bridges = p.bridgeReadings && p.bridgeReadings.matched;
    if (!bridges || !bridges.length) { skipped++; continue; }   // no bridges ⇒ no artifacts

    let md = null;
    try { md = await getMarketData(p); } catch (e) { md = null; }
    let eo;
    try { eo = gen.generateForPortal(p, { marketData: md }); } catch (e) { console.log('  GEN FAIL ' + f + ': ' + e.message); failed++; continue; }
    if (!eo) { skipped++; continue; }

    // safety gate: never write a contaminated artifact back
    const hits = (JSON.stringify(eo).match(PLACEHOLDER_RE) || []);
    if (hits.length) { console.log('  ✗ CONTAMINATED ' + f + ': ' + [...new Set(hits)].slice(0, 6).join(' ')); contaminated++; continue; }

    p.engineOutputs = eo;
    fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
    const hasReal = md && md.ok;
    if (hasReal) real++; else qual++;
    done++;
    if (done % 20 === 0) console.log('  ...' + done + ' rebuilt (' + real + ' real / ' + qual + ' qualitative)');
    await sleep(140);   // EDGAR politeness (<10 req/s) + Yahoo
  }
  console.log('\nrebuild done: ' + done + ' rebuilt (' + real + ' real numbers / ' + qual + ' qualitative), ' +
    skipped + ' skipped(no bridge), ' + contaminated + ' contaminated(not written), ' + failed + ' failed');
})();
