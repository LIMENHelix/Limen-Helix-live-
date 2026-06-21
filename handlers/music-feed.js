/**
 * handlers/music-feed.js — free, real-time-ish music news for Wave Radar.
 *
 * Pulls a handful of public RSS feeds (hip-hop + general music), merges newest-first,
 * and caches the result in ONE Redis doc (wave:news, 15-min TTL) so a page view is
 * ~1 read (Redis request volume = the cost risk, same discipline as the radar).
 * No API keys, no library — RSS is parsed with small regexes (tolerant of CDATA/atom).
 */
const db = require('../lib/limen-db');

const FEEDS = [
  { src: 'XXL',           url: 'https://www.xxlmag.com/feed/',                        tag: 'hiphop' },
  { src: 'AllHipHop',     url: 'https://allhiphop.com/feed/',                         tag: 'hiphop' },
  { src: 'Billboard',     url: 'https://www.billboard.com/feed/',                     tag: 'charts' },
  { src: 'Rolling Stone', url: 'https://www.rollingstone.com/music/music-news/feed/', tag: 'music'  },
  { src: 'Stereogum',     url: 'https://stereogum.com/feed',                          tag: 'music'  },
  { src: 'Consequence',   url: 'https://consequence.net/feed/',                       tag: 'music'  }
];
const TTL_MS = 15 * 60 * 1000;

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8217;|&#8216;|&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tag(block, name) { const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i')); return m ? m[1] : ''; }

async function fetchFeed(f) {
  try {
    const r = await fetch(f.url, { headers: { 'user-agent': 'Mozilla/5.0 (LimenWaveRadar)', accept: 'application/rss+xml,application/xml,text/xml,*/*' } });
    if (!r.ok) return [];
    const xml = await r.text();
    return xml.split(/<item[ >]/i).slice(1, 10).map(block => {
      const title = decode(tag(block, 'title'));
      let link = decode(tag(block, 'link'));
      if (!link) { const m = block.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
      const date = tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'published');
      const ts = date ? (Date.parse(date) || 0) : 0;
      return { title: title.slice(0, 160), link: (link || '').trim(), src: f.src, tag: f.tag, ts: ts };
    }).filter(x => x.title && /^https?:\/\//.test(x.link));
  } catch (e) { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300');

  let doc = null; try { doc = await db.get('wave:news'); } catch (e) {}
  if (doc && doc.t && (Date.now() - doc.t) < TTL_MS && Array.isArray(doc.items) && doc.items.length) {
    res.statusCode = 200; return res.end(JSON.stringify({ ok: true, updated: doc.t, items: doc.items, cached: true }));
  }

  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = [];
  results.forEach(items => { for (const it of items) all.push(it); });
  all.sort((a, b) => b.ts - a.ts);
  const items = all.slice(0, 28);

  if (items.length) { doc = { t: Date.now(), items: items }; try { await db.set('wave:news', doc); } catch (e) {} }
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: items.length > 0, updated: (doc && doc.t) || Date.now(), items: items, cached: false }));
};
