/**
 * Generate the browser copy of the phase registry from lib/phase-spec.js.
 *
 * lib/phase-spec.js remains the source of truth. The browser cannot require a
 * Node module, so this small generated asset is loaded before domain-offers.js
 * on the domain surfaces. Keeping generation explicit prevents the product
 * renderer from silently growing a second P0-P10 vocabulary.
 */
var fs = require('fs');
var path = require('path');
var spec = require('../lib/phase-spec.js');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'assets', 'js', 'phase-registry.js');
var primary = spec.PHASES.map(function (p) {
  return {
    code: p.code, title: p.title, state: p.state,
    neuralLabel: p.neuralLabel, conceptEvidence: p.conceptEvidence,
    aliases: p.aliases, meaning: p.meaning, delivers: p.delivers, signal: p.signal
  };
});

var registry = {
  version: 1,
  primary: primary,
  variants: spec.VARIANTS,
  shape: {}
};
primary.forEach(function (p) {
  registry.shape[p.code.toLowerCase()] = spec.cadenceShape(p.code);
});

var header = [
  '/**',
  ' * assets/js/phase-registry.js — GENERATED. Do not edit by hand.',
  ' *',
  ' * Source of truth: lib/phase-spec.js',
  ' * Regenerate:     node scripts/gen-phase-registry.cjs',
  ' *',
  ' * This browser-safe copy carries both product labels and conceptual homology',
  ' * labels. Conceptual evidence status is metadata, not a runtime proof claim.',
  ' */',
  '(function (root) {',
  '  root.LIMEN_PHASE_REGISTRY = ' + JSON.stringify(registry, null, 2) + ';',
  '})(window);',
  ''
].join('\n');

fs.writeFileSync(OUT, header, 'utf8');
console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + primary.length + ' primary phases, ' + Object.keys(spec.VARIANTS).length + ' variants');
