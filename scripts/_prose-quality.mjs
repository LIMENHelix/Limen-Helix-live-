/**
 * Shared functional-network prose checks and deterministic repairs.
 *
 * Keep factual completion out of this module. A missing or fragmentary note
 * needs source-backed authoring; only punctuation defects that preserve every
 * word are safe to repair automatically.
 */

export function proseFlagsForNote(note) {
  const issues = [];
  const t = String(note || '').trim();
  if (!t) { issues.push('empty'); return issues; }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 18) issues.push('too-short');
  if (!/[.!?]$/.test(t)) issues.push('no-terminal-punct');
  if (/[a-z]$/.test(t) && words.length < 50) issues.push('lowercase-final');
  if (/\b([a-z]{2,})\1{2,}\b/i.test(t)) issues.push('repeat-token');
  if (words.length >= 30 && !/[.;,]/.test(t)) issues.push('run-on');
  if (words.length < 25 && !/^[A-Z]/.test(t)) issues.push('fragment-start');
  if (/\b(?:and|of|for|with|by|to|in|on|the|a|an)$/i.test(t)) issues.push('trailing-stopword');
  if (/\.{2,}\s*$/.test(t)) issues.push('trailing-ellipsis');
  if (/^\.\s+(?=[A-Z0-9])/.test(t)) issues.push('leading-punctuation');
  return issues;
}

export function repairSafeProsePunctuation(note) {
  const original = String(note == null ? '' : note);
  let value = original;
  const repairs = [];

  // A leading period followed by a sentence is a serialization/generation
  // artifact. Removing it changes no words and supplies no missing content.
  const withoutLeadingPeriod = value.replace(/^(\s*)\.\s+(?=[A-Z0-9])/, '$1');
  if (withoutLeadingPeriod !== value) {
    value = withoutLeadingPeriod;
    repairs.push('remove-leading-period');
  }

  // Exactly two terminal periods are duplicated punctuation. Three or more
  // may be an intentional ellipsis and remain operator-only.
  const withoutDuplicateTerminalPeriod = value.replace(/(?<!\.)\.\.(\s*)$/, '.$1');
  if (withoutDuplicateTerminalPeriod !== value) {
    value = withoutDuplicateTerminalPeriod;
    repairs.push('collapse-duplicate-terminal-period');
  }

  return { original, value, repairs };
}
