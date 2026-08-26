'use strict';

/** Culture-local policy for LIMEN's non-evidentiary visual artifacts. */
var crypto = require('node:crypto');

var SUBJECT = {
  agriculture: 'vast farmland under low dramatic light, irrigation lines receding to the horizon',
  communication: 'communication towers and dish arrays silhouetted against a dark dusk sky',
  culture: 'an empty concert hall in low light, seats and stage in deep shadow',
  defense: 'a shipyard at night, cranes and hulls in silhouette under sodium light',
  economy: 'a dense financial district at dusk seen from above, lights beginning to show',
  education: 'a university library interior at night, long shelves receding into shadow',
  energy: 'high-voltage transmission towers marching across dark open country at dusk',
  environment: 'old-growth forest in heavy mist, deep greens, light falling in shafts',
  finance: 'a bank vault door and marble hall in low dramatic light',
  governance: 'neoclassical government architecture at dusk, columns in deep shadow',
  industry: 'a heavy manufacturing floor at night, steel structure and machinery in silhouette, sparks and low amber light',
  infrastructure: 'a long suspension bridge in fog at blue hour, cables receding',
  intelligence: 'a dark operations room, wall of dim screens, no readable text',
  law: 'a courtroom interior in low light, empty bench and gallery, deep shadow',
  medicine: 'a hospital corridor at night, low clinical light receding into darkness',
  population: 'an aerial view of dense housing at dusk, warm window lights in a grid',
  religion: 'a cathedral interior in near darkness, one shaft of light through high windows',
  science: 'a large research instrument in a darkened laboratory, cool blue light',
  technology: 'a server hall in low light, rows receding, cool blue and deep shadow',
  trade: 'a container port at night, stacked containers and gantry cranes under floodlight'
};

var STYLE = 'Cinematic wide landscape photograph, 16:9, muted desaturated palette, deep shadows, ' +
  'dark overall exposure suitable as a background behind white text, subject centred, ' +
  'no text, no words, no lettering, no watermark, no people in the foreground, ' +
  'no logos, photographic realism, shallow contrast.';

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function prompt(domain) { return SUBJECT[domain] ? SUBJECT[domain] + '. ' + STYLE : null; }
function candidate(domain, model, reason) {
  var body = prompt(domain);
  if (!body) return null;
  return {
    schemaVersion: 'culture-hero-candidate/1.0',
    productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
    assetDomain: domain, model: String(model || ''), prompt: body,
    promptHash: hash(body), reason: reason || 'missing-public-hero',
    policyIdentity: { kind: 'culture-local-canonical-hero-policy', version: '1.0', policyHash: hash(JSON.stringify(SUBJECT) + STYLE) },
    decorativeOnly: true, evidenceClaim: false, liveMoney: false
  };
}
function validate(value) {
  var expected = value && candidate(value.assetDomain, value.model, value.reason);
  return !!(expected && value.schemaVersion === expected.schemaVersion && value.productDomain === 'culture' &&
    value.ownerDomain === 'culture' && value.lane === 'hero-image' && value.prompt === expected.prompt &&
    value.promptHash === expected.promptHash && value.policyIdentity &&
    value.policyIdentity.policyHash === expected.policyIdentity.policyHash && value.decorativeOnly === true &&
    value.evidenceClaim === false);
}

module.exports = { SUBJECT: SUBJECT, STYLE: STYLE, prompt: prompt, candidate: candidate, validate: validate, hash: hash };
