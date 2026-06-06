/**
 * affiliate-injector.js — turns generated content into EARNING content.
 *
 * Reads assets/data/affiliate-config.json. For each content artifact:
 *   - builds Amazon Associates search links from AMAZON_ASSOC_TAG (works alone),
 *   - tags any bare amazon.com URLs already in the body,
 *   - wraps bare merchant URLs with their network's deeplink template (when configured),
 *   - appends a single disclosed "Recommended" block listing the affiliate links.
 *
 * It NEVER invents products or claims. It only adds tracked links for the content's
 * own topic, and only when a tag/template exists. FTC disclosure is injected upstream
 * by stream-ops produce(); this module presents links under a disclosed block.
 */
const fs = require('node:fs');
const path = require('node:path');

const CONFIG = path.join(__dirname, '..', 'assets', 'data', 'affiliate-config.json');

function _config() { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { return { networks: {}, merchants: [] }; } }
function _query(content, stream) {
  const t = (content && content.title) || (stream && (stream.name || stream.id)) || 'tools';
  return encodeURIComponent(String(t).replace(/[^\w\s-]/g, '').trim().split(/\s+/).slice(0, 6).join(' '));
}
function _tmpl(s, vars) { return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; }); }

// add/replace ?tag= on a raw amazon URL
function _tagAmazonUrl(url, param, tag) {
  if (url.indexOf(param + '=') > -1) return url.replace(new RegExp(param + '=[^&\\s]*'), param + '=' + tag);
  return url + (url.indexOf('?') > -1 ? '&' : '?') + param + '=' + tag;
}

function inject(content, stream, opts) {
  opts = opts || {};
  content = Object.assign({}, content);
  const cfg = _config();
  const nets = cfg.networks || {};
  const slots = (content.linkSlots || []).join(',');
  const wantAffiliate = /amazon|affiliate/.test(slots) || (stream && (stream.category === 'affiliate'));
  const links = [];
  let body = content.body || '';

  // 1) Amazon search link from tag (works with just the env tag)
  const az = nets.amazon;
  const azTag = az && az.tagEnv && process.env[az.tagEnv];
  if (wantAffiliate && az && az.enabled && azTag) {
    const url = _tmpl(az.searchTemplate, { q: _query(content, stream), tag: azTag });
    links.push({ network: 'amazon', text: 'Shop related picks on Amazon', url: url });
  }

  // 2) tag bare amazon URLs already present in the body
  if (az && azTag) {
    body = body.replace(/https?:\/\/(?:www\.)?(?:amazon\.com|amzn\.to)\/[^\s)]+/g, function (m) {
      return _tagAmazonUrl(m, az.urlTagParam || 'tag', azTag);
    });
  }

  // 3) wrap configured merchant URLs with their network deeplink template
  (cfg.merchants || []).forEach(function (mch) {
    if (mch._example || !mch.domain) return;
    const net = nets[mch.network];
    if (!net || !net.enabled || !net.deeplinkTemplate) return;
    const re = new RegExp('https?:\\/\\/(?:www\\.)?' + mch.domain.replace(/\./g, '\\.') + '\\/[^\\s)]+', 'g');
    body = body.replace(re, function (m) {
      const wrapped = _tmpl(net.deeplinkTemplate, { url: encodeURIComponent(m), tag: process.env[net.tagEnv] || '', campaign: net.campaign || '' });
      links.push({ network: mch.network, text: mch.name, url: wrapped });
      return wrapped;
    });
  });

  // 4) append a single disclosed Recommended block
  if (links.length) {
    let block = '\n\n— Recommended (affiliate — we may earn a commission):';
    links.forEach(function (l) { block += '\n• ' + l.text + ': ' + l.url; });
    body += block;
  }

  content.body = body;
  return { content: content, links: links, count: links.length };
}

module.exports = { inject };
