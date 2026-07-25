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
const appM = html.match(/\n<script>\n([\s\S]*?)\n<\/script>\n<\/body>/);
if (!appM) throw new Error('no trailing inline <script> found');
const appJs = appM[1];

// everything between <body> and the app script: shader block, external scripts, markup
const bodyM = html.match(/<body>([\s\S]*?)\n<script>\n[\s\S]*?<\/script>\n<\/body>/);
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

// ── write the per-domain shells ────────────────────────────────────────────
const routes = Object.keys(CONFIG);
const written = [];
for (const route of routes) {
  const c = CONFIG[route];
  const out = head(route, c) + bodyMarkup + '\n<script src="/assets/js/domain-front-app.js"></script>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(ROOT, route + '.html'), out);
  written.push({ route, bytes: out.length, title: c.name });
}

console.log('shared css : assets/css/domain-front.css (' + css.length + ' bytes)');
console.log('shared app : assets/js/domain-front-app.js (' + appJs.length + ' bytes)');
console.log('shells     : ' + written.length);
written.forEach(w => console.log('  ' + (w.route + '.html').padEnd(22) + String(w.bytes).padStart(7) + ' bytes  ' + w.title));
console.log('\nNEXT: point vercel.json rewrites at these files and add them to sitemap.xml.');
