'use strict';

/**
 * Extract source-supplied RSS/Atom title evidence without classifying it.
 * Missing link, date, or publisher stays null; no field is guessed.
 */

function clean(value) {
  return String(value || '').replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&apos;|&#0?39;|&#x27;/gi, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function tag(block, name) {
  var match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match ? clean(match[1]) : null;
}

function link(block) {
  var direct = tag(block, 'link');
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  var atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?\s*>/i);
  var value = atom ? clean(atom[1]) : null;
  return value && /^https?:\/\//i.test(value) ? value : null;
}

function extract(xml, cap) {
  var text = String(xml || '');
  var blocks = text.split(/<(?:item|entry)(?:\s[^>]*)?>/i).slice(1);
  var out = { headlines: [], headlineLinks: [], headlinePublishedAt: [], headlinePublishers: [] };
  var limit = Number.isFinite(cap) ? cap : 5;
  for (var i = 0; i < blocks.length && out.headlines.length < limit; i++) {
    var title = tag(blocks[i], 'title');
    if (!title) continue;
    var dateText = tag(blocks[i], 'pubDate') || tag(blocks[i], 'published') || tag(blocks[i], 'updated');
    var parsed = dateText ? Date.parse(dateText) : NaN;
    var publisher = tag(blocks[i], 'source');
    out.headlines.push(title);
    out.headlineLinks.push(link(blocks[i]));
    out.headlinePublishedAt.push(Number.isFinite(parsed) ? parsed : null);
    out.headlinePublishers.push(publisher || null);
  }
  return out;
}

module.exports = { extract: extract };
