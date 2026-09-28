'use strict';
// Syntactic eligibility only, not scientific verification. Browser copies in
// Finance and the console are exercised against the same regression vectors.
function isEvidenceText(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    !/\b(?:todo|tbd|placeholder)\b|\b(?:citation|reference|source|implementation|steps?)[\s_-]+(?:needed|required|missing|pending|not[\s_-]+(?:provided|available|found))\b|^(?:n\/?a|none|null|unknown|pending)$/i.test(value.trim());
}
function hasAffirmativeProvenance(cite, steps) {
  return isEvidenceText(cite) && cite.trim().length > 3 &&
    Array.isArray(steps) && steps.length > 0 && steps.every(isEvidenceText);
}
module.exports = { isEvidenceText, hasAffirmativeProvenance };
