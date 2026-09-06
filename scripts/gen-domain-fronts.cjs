#!/usr/bin/env node
/**
 * scripts/gen-domain-fronts.cjs — build the per-domain static fronts.
 *
 *   node scripts/gen-domain-fronts.cjs
 *
 * WHY THIS EXISTS. Every domain front was served from one file, domain-front.html, with the
 * title and description written by JavaScript at runtime. Google may eventually run that JS;
 * Facebook, X, LinkedIn, Reddit and Discord never do. So all 18 fronts served an identical
 * <title>LIMEN Helix</title> with zero og: tags, every share rendered a blank card, and to a
 * crawler the site looked like 18 duplicates of one page. Verified live on 2026-07-25.
 *
 * A serverless function cannot fix this here: vercel.json excludes *.html from the api bundle,
 * so a handler cannot read the template at runtime. Static shells are also strictly better for
 * crawlers (no JS execution, no function latency, CDN-cacheable).
 *
 * WHAT IT EMITS
 *   assets/css/domain-front.css        the shared <style>, extracted once
 *   assets/js/domain-front-app.js      the shared app <script>, extracted once
 *   <route>.html  x18                  thin shells: per-domain <head> + shared body markup
 *
 * The extraction is the point: shells carry ONLY per-domain metadata, so ordinary edits to
 * behaviour go to the shared .js and require NO regeneration. Re-run this only when the head
 * template, the body markup, or the CONFIG copy changes.
 *
 * SOURCE OF TRUTH is still domain-front.html. Edit that, then re-run this.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'domain-front.html');
const SITE = 'https://limenhelix.com';

const html = fs.readFileSync(SRC, 'utf8');

// ── split the template ─────────────────────────────────────────────────────
const styleM = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleM) throw new Error('no <style> block found');
const css = styleM[1];

// the app script is the only inline <script> with no src and no type
const appM = html.match(/\r?\n<script>\r?\n([\s\S]*?)\r?\n<\/script>\r?\n<\/body>/);
if (!appM) throw new Error('no trailing inline <script> found');
const appJs = appM[1];

// everything between <body> and the app script: shader block, external scripts, markup
const bodyM = html.match(/<body>([\s\S]*?)\r?\n<script>\r?\n[\s\S]*?<\/script>\r?\n<\/body>/);
if (!bodyM) throw new Error('could not isolate body markup');
const bodyMarkup = bodyM[1];

// fonts / preconnect, reused verbatim so the shells look identical to the original
const fontsM = html.match(/(<link rel="preconnect"[\s\S]*?rel="stylesheet">)/);
const fonts = fontsM ? fontsM[1] : '';

// ── per-domain config, read from the app itself so there is ONE source of truth ──
const cfgM = appJs.match(/var CONFIG = (\{[\s\S]*?\n\});/);
if (!cfgM) throw new Error('could not read CONFIG from the app script');
const CONFIG = eval('(' + cfgM[1] + ')');

// Which image represents each domain. environment has no <domain>.jpg and uses the Yosemite
// hero; population ships as .webp. Everything else follows <domain>.jpg.
function ogImage(route) {
  if (route === 'environment') return 'yosemite.jpg';
  if (fs.existsSync(path.join(ROOT, 'assets/img', route + '.jpg'))) return route + '.jpg';
  if (fs.existsSync(path.join(ROOT, 'assets/img', route + '.webp'))) return route + '.webp';
  return 'agriculture.jpg';
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function head(route, c) {
  const url = SITE + '/' + route;
  const title = c.name + ' · LIMEN Helix';
  const desc = String(c.lead || '').slice(0, 300);
  const img = SITE + '/assets/img/' + ogImage(route);
  const tools = (c.tools || []).join(', ');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: desc,
    url: url,
    inLanguage: 'en-US',
    isPartOf: { '@type': 'WebSite', name: 'LIMEN Helix', url: SITE },
    primaryImageOfPage: { '@type': 'ImageObject', contentUrl: img },
    publisher: { '@type': 'Organization', name: 'LIMEN Helix Transformation Sciences', url: SITE },
    about: { '@type': 'Thing', name: c.name.replace(' Watch', '') },
    keywords: tools
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="LIMEN Helix" />
<meta property="og:locale" content="en_US" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:alt" content="${esc(c.name)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${img}" />
${fonts}
<link rel="stylesheet" href="/assets/css/domain-front.css" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>`;
}

// ── write shared assets ────────────────────────────────────────────────────
fs.mkdirSync(path.join(ROOT, 'assets/css'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/css/domain-front.css'),
  '/* GENERATED by scripts/gen-domain-fronts.cjs from domain-front.html. Do not hand-edit. */\n' + css);
fs.writeFileSync(path.join(ROOT, 'assets/js/domain-front-app.js'),
  '/* GENERATED by scripts/gen-domain-fronts.cjs from domain-front.html. Do not hand-edit. */\n' + appJs);

// Soft-domain desks (religion, education) are hand-owned product pages.
// Regenerating them would wipe the free tool → paid Watch path. Culture is
// already absent from CONFIG, so it is not written here.
const PRODUCTIZED_FRONTS = new Set(['religion', 'education']);

// ── write the per-domain shells ────────────────────────────────────────────
const routes = Object.keys(CONFIG);
const written = [];
const skipped = [];
for (const route of routes) {
  if (PRODUCTIZED_FRONTS.has(route)) {
    skipped.push(route);
    continue;
  }
  const c = CONFIG[route];
  const out = head(route, c) + bodyMarkup + '\n<script src="/assets/js/domain-front-app.js"></script>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(ROOT, route + '.html'), out);
  written.push({ route, bytes: out.length, title: c.name });
}

// Economy keeps the generated Watch shell. Homestead Desk is a section +
// /economy/homestead, not a Soft-desk rewrite. Re-apply the hook so a regen
// does not drop the free Read or the $4 checkout.
if (!PRODUCTIZED_FRONTS.has('economy')) {
  const econPath = path.join(ROOT, 'economy.html');
  let econ = fs.readFileSync(econPath, 'utf8');
  if (econ.indexOf('id="homesteadDesk"') === -1) {
    if (!/homestead-desk\.css/.test(econ)) {
      econ = econ.replace(
        '<link rel="stylesheet" href="/assets/css/domain-front.css" />',
        '<link rel="stylesheet" href="/assets/css/domain-front.css" />\n<link rel="stylesheet" href="/assets/css/homestead-desk.css" />'
      );
    }
    if (econ.indexOf('id="homesteadHeroLink"') === -1) {
      econ = econ.replace(
        '<div class="cap-note" id="capNote">Free. We email you when this domain moves. No spam, unsubscribe anytime.</div>',
        '<div class="cap-note" id="capNote">Free. We email you when this domain moves. No spam, unsubscribe anytime.</div>\n      <p class="hs-hero-link" id="homesteadHeroLink"><a href="/economy/homestead">Homestead Desk · sell before auction</a><span> Free educational read. Not legal advice.</span></p>'
      );
    }
    econ = econ.replace('<section id="checkoutSection">',
      '<section id="homesteadDesk" class="hs-card" style="margin:18px 0">\n' +
      '      <div class="hs-kicker">Homestead Desk</div>\n' +
      '      <h2>Sell before auction</h2>\n' +
      '      <p class="hs-plain">Free Homestead Read: ZIP or street to an educational stage clock. We do not invent auction dates. Not legal or financial advice.</p>\n' +
      '      <div class="hs-grid">\n' +
      '        <div>\n' +
      '          <label for="hsQ">ZIP or street address</label>\n' +
      '          <input id="hsQ" type="text" placeholder="64111 or 1200 Main St, Kansas City, MO" autocomplete="street-address">\n' +
      '        </div>\n' +
      '        <div>\n' +
      '          <label for="hsNotice">What did you receive?</label>\n' +
      '          <select id="hsNotice">\n' +
      '            <option value="unsure">Not sure / just looking</option>\n' +
      '            <option value="none">Nothing filed that I know of</option>\n' +
      '            <option value="late">Late notices / collection calls</option>\n' +
      '            <option value="nod">Notice of Default (or equivalent)</option>\n' +
      '            <option value="sale">Sale / auction notice</option>\n' +
      '            <option value="sold">I think it already sold</option>\n' +
      '          </select>\n' +
      '        </div>\n' +
      '      </div>\n' +
      '      <button class="hs-btn" id="hsGo" type="button">Read this place →</button>\n' +
      '      <div id="hsOut"></div>\n' +
      '      <p style="margin-top:14px"><a href="/economy/homestead">Open the full Homestead Desk →</a></p>\n' +
      '      <div class="hs-card" id="deskWaitlist" style="margin:16px 0 0">\n' +
      '        <h2>Watch this ZIP - free</h2>\n' +
      '        <p class="hs-plain">Desk Alerts (~$19 / mo) are not live. We will not charge until we can send them. The $4 Economy Watch is live today.</p>\n' +
      '        <label for="hsName">Name</label>\n' +
      '        <input id="hsName" type="text" placeholder="your name" maxlength="200" autocomplete="name">\n' +
      '        <div style="margin-top:10px"><label for="hsEmail">Email</label>\n' +
      '        <input id="hsEmail" type="email" placeholder="you@email.com" maxlength="200" autocomplete="email"></div>\n' +
      '        <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13px;text-transform:none;letter-spacing:0">\n' +
      '          <input type="checkbox" id="hsConsent" checked style="width:auto;margin-top:3px"> I agree to be contacted about Homestead Desk.\n' +
      '        </label>\n' +
      '        <button class="hs-btn" id="hsWaitBtn" type="button">Watch this ZIP - free</button>\n' +
      '        <div class="hs-waitstat" id="hsWaitStat"></div>\n' +
      '      </div>\n' +
      '      <div class="hs-disc">Educational information only. Not legal, financial, tax, or emergency advice. Confirm every date with the county. Crisis: 988 or 211.</div>\n' +
      '    </section>\n\n    <section id="checkoutSection">');
    if (econ.indexOf('homestead-desk.js') === -1) {
      econ = econ.replace(
        '<script src="/assets/js/domain-front-app.js"></script>\n</body>',
        '<script src="/assets/js/domain-front-app.js"></script>\n' +
        '<script src="/assets/js/homestead-desk.js"></script>\n' +
        '<script src="/assets/js/homestead-chat.js"></script>\n' +
        '<script>\n(function () {\n  if (window.LIMEN_HOMESTEAD) {\n    window.LIMEN_HOMESTEAD.boot({\n      injectHero: false,\n      waitlist: { interest: \'homestead-desk-waitlist\', sourcePage: \'/economy\' }\n    });\n  }\n})();\n</script>\n</body>'
      );
    }
    fs.writeFileSync(econPath, econ);
    const row = written.find(function (w) { return w.route === 'economy'; });
    if (row) row.bytes = econ.length;
  }
}

console.log('shared css : assets/css/domain-front.css (' + css.length + ' bytes)');
console.log('shared app : assets/js/domain-front-app.js (' + appJs.length + ' bytes)');
console.log('shells     : ' + written.length + (skipped.length ? '  skipped productized: ' + skipped.join(', ') : ''));
written.forEach(w => console.log('  ' + (w.route + '.html').padEnd(22) + String(w.bytes).padStart(7) + ' bytes  ' + w.title));
console.log('\nNEXT: point vercel.json rewrites at these files and add them to sitemap.xml.');
