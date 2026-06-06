/**
 * corpus.js — IP-safe grounding from the operator's real LIMEN documents.
 *
 * Loads assets/data/corpus.json (distilled, public-facing source cards) and gives
 * the producer grounding text + an IP firewall instruction so generated content is
 * backed by the author's actual framework WITH references — never the patent specifics.
 */
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'assets', 'data', 'corpus.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { cards: [], _meta: {} }; }
}

// pick the card whose domains best match the requested domain/topic; else the first
function select(stream, brand) {
  const c = load();
  const cards = c.cards || [];
  if (!cards.length) return null;
  const want = ((brand && brand.domain) || (stream && stream.category) || '').toLowerCase();
  if (want) {
    const hit = cards.find(function (card) { return (card.domains || []).some(function (d) { return want.indexOf(d) > -1 || d.indexOf(want) > -1; }); });
    if (hit) return hit;
  }
  return cards[0];
}

// compact grounding block for prompt injection
function groundingText(card) {
  if (!card) return '';
  let g = 'SOURCE: ' + card.title + ' (domains: ' + (card.domains || []).join(', ') + ')\n';
  g += 'Thesis: ' + card.thesis + '\n';
  if (card.concepts && card.concepts.length) g += 'Key concepts:\n- ' + card.concepts.join('\n- ') + '\n';
  if (card.crossDomainExamples) {
    g += 'Cross-domain examples:\n';
    for (const k in card.crossDomainExamples) { if (Object.prototype.hasOwnProperty.call(card.crossDomainExamples, k)) g += '- ' + k + ': ' + card.crossDomainExamples[k] + '\n'; }
  }
  if (card.references && card.references.length) g += 'Cite these (real frameworks):\n- ' + card.references.join('\n- ') + '\n';
  if (card.safeQuotes && card.safeQuotes.length) g += 'Verbatim-OK quotes (use exactly, attribute to LIMEN Helix):\n- "' + card.safeQuotes.join('"\n- "') + '"\n';
  if (card.guards && card.guards.length) g += 'GUARDS:\n- ' + card.guards.join('\n- ') + '\n';
  return g;
}

function ipGuard() {
  const m = (load()._meta || {});
  return m.ipFirewall || 'PUBLIC CONCEPTUAL LAYER ONLY — never emit proprietary formulas or patent specifics; educational, not professional advice.';
}

module.exports = { load, select, groundingText, ipGuard };
