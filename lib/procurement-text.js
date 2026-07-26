/**
 * lib/procurement-text.js — turn federal contract shorthand into something a person can read.
 *
 * USAspending returns the contracting officer's own description, which is written for other
 * contracting officers. Three things make it unreadable as-is:
 *
 *   1. CLASSIFICATION PREFIXES. "IGF::CL,CT::IGF" and "TAS::89 0240::TAS" are coding flags,
 *      not prose. Sometimes they ARE the whole field, sometimes they are glued to the front of
 *      a real sentence. Both have to be stripped, and a field that is nothing but a code has
 *      to come back null: "not stated" is honest, printing IGF::OT::IGF as the answer to
 *      "what did this buy?" is not.
 *   2. ALL CAPS. Fine on a form, hostile in a paragraph.
 *   3. TRADE ABBREVIATIONS. "LRIP LOT 12" is F-35 production and "SSN 802 LLTM" is submarine
 *      parts ordered years early, but only to someone who already speaks the language. The
 *      whole point of the product is telling people what they are looking at.
 *
 * Expansions only ever ADD words; nothing here changes a number, an amount or a recipient, so
 * the decoded text can never say something the record does not. The caller keeps the raw
 * string alongside it so any claim stays checkable against USAspending.
 */

// Coding flags that top-and-tail a description. Repeated because a field can carry more
// than one, e.g. "TAS::...::TAS IGF::CL::IGF the actual description".
var PREFIX = /^\s*(?:IGF|TAS|MOD|OPTION)\s*::[^:]*::\s*[A-Z]*\s*/i;

// A field that is ONLY a code carries no information.
var NULL_DESC = /^(?:IGF::[A-Z:,]*|TAS::[^:]*::[A-Z]*|N\/?A|NONE|UNKNOWN|TBD|\W*)$/i;

var JARGON = [
  [/\bLRIP\b/gi, 'low-rate initial production'],
  [/\bLLTM\b|\bLONG LEAD TIME MATERIAL\b/gi, 'long-lead parts ordered years ahead'],
  [/\bADVANCE ACQUISITION\b/gi, 'parts bought before the main order'],
  [/\bSSBN\s*(\d+)/gi, 'ballistic-missile submarine hull $1'],
  [/\bSSN\s*(\d+)/gi, 'attack submarine hull $1'],
  [/\bCVN\s*(\d+)/gi, 'aircraft carrier hull $1'],
  [/\bM&O\b/gi, 'management and operation'],
  [/\bPBMC\b/gi, 'performance-based management contract'],
  [/\bIDIQ\b/gi, 'open-ended ordering contract'],
  [/\bFMS\b/gi, 'foreign military sale'],
  [/\bO&M\b/gi, 'operations and maintenance'],
  [/\bRDT&E\b/gi, 'research, development, test and evaluation'],
  [/\bMRO\b/gi, 'maintenance, repair and overhaul'],
  [/\bCLS\b/gi, 'contractor logistics support'],
  [/\bPBL\b/gi, 'performance-based logistics'],
  [/\bSETA\b/gi, 'systems engineering and technical assistance'],
  [/\bNNSA\b/gi, 'National Nuclear Security Administration'],
  [/\bDOE\b/gi, 'Department of Energy']
];

/**
 * @param {string} raw the contracting officer's description
 * @param {number} [max] truncation length, default 220
 * @returns {string|null} readable text, or null when the record genuinely says nothing
 */
function plainDescription(raw, max) {
  var d = String(raw == null ? '' : raw).trim();
  if (!d) return null;

  // strip every leading coding flag, not just the first
  var before;
  do { before = d; d = d.replace(PREFIX, '').trim(); } while (d !== before);

  if (!d || NULL_DESC.test(d)) return null;

  // Case BEFORE expanding. Expanding first strands lowercase phrases among SHOUTED leftovers,
  // because the string is no longer uniformly caps by the time the casing test runs.
  if (d === d.toUpperCase() && /[A-Z]{4}/.test(d)) d = d.toLowerCase();
  JARGON.forEach(function (j) { d = d.replace(j[0], j[1]); });

  // Source text often spells a term out and then gives its abbreviation: "performance-based
  // management contract (PBMC)". Expanding the abbreviation leaves the phrase twice in a row.
  // Collapse "X (X)" back to "X".
  d = d.replace(/([^()]{6,}?)\s*\(\1\)/gi, '$1');

  d = d.replace(/\s{2,}/g, ' ').trim();
  d = d.charAt(0).toUpperCase() + d.slice(1);
  return d.slice(0, max || 220);
}

module.exports = { plainDescription: plainDescription };
