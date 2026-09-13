'use strict';

/**
 * Soft 3 + Civic lanes on the shared G0 actuator rail.
 * This is topology, not a brain. It never selects an action or grants authority.
 */

var Valve = require('./civilization-valve-registry.js');

var SOFT3 = ['culture', 'religion', 'education'];
var CIVIC = ['law', 'population', 'governance', 'intelligence'];
var SCOPE = SOFT3.concat(CIVIC);

var LANES = Object.freeze({
  culture: Object.freeze({
    productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
    valveId: 'culture:hero-image', contractId: 'culture-motor/1',
    decisionContract: 'media-artifact-decision/1', budgetId: 'culture-media-budget/1',
    receiptClass: 'asset-receipt', outcomeClass: 'usage-engagement-or-conversion',
    rollbackClass: 'replace-or-remove',
    binder: 'brain-v2/bind/culture.js', brain: 'assets/js/domain-brains/culture-brain.js',
    decisionFile: 'lib/culture-hero-decision.js', executorFile: 'lib/culture-hero-executor.js',
    observerFile: 'lib/culture-hero-outcome-observer.js', recoveryFile: 'lib/culture-hero-recovery.js',
    learningFile: 'lib/culture-hero-learning.js', cycleRoute: 'hero-image',
    observerRoute: 'culture-hero-outcome-observer', recoveryRoute: 'culture-hero-recovery',
    desk: 'Royalty X-Ray', deskTool: 'culture-markets',
    commissioningKind: 'reversible', provider: 'xai-image-or-paper-catalog',
    observerIdentity: 'culture-hero-public-asset-observer/1',
    adapterId: 'culture-hero-paper-adapter/1', observerAdapterId: 'culture-hero-public-read/1'
  }),
  religion: Object.freeze({
    productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email',
    valveId: 'religion:subscriber-email', contractId: 'religion-motor/1',
    decisionContract: 'direct-message-decision/1', budgetId: 'religion-email-budget/1',
    receiptClass: 'delivery-provider-receipt', outcomeClass: 'delivery-click-reply-or-unsubscribe',
    rollbackClass: 'suppress-or-correct',
    binder: 'brain-v2/bind/religion.js', brain: 'assets/js/domain-brains/religion-brain.js',
    decisionFile: 'lib/religion-subscriber-decision.js', executorFile: 'lib/religion-subscriber-executor.js',
    observerFile: 'lib/religion-subscriber-outcome-observer.js', recoveryFile: 'lib/religion-subscriber-recovery.js',
    learningFile: 'lib/religion-subscriber-learning.js', cycleRoute: 'subscriber-digest',
    observerRoute: 'religion-subscriber-outcome-observer', recoveryRoute: 'religion-subscriber-recovery',
    desk: 'Form 990', deskTool: 'religion-tools',
    commissioningKind: 'bounded-irreversible', provider: 'resend-or-owned-destination',
    observerIdentity: 'religion-subscriber-mail-observer/1',
    adapterId: 'religion-subscriber-paper-adapter/1', observerAdapterId: 'religion-subscriber-independent-read/1'
  }),
  education: Object.freeze({
    productDomain: 'education', ownerDomain: 'education', lane: 'research-papers',
    valveId: 'education:research-papers', contractId: 'education-motor/1',
    decisionContract: 'research-artifact-decision/1', budgetId: 'education-research-budget/1',
    receiptClass: 'artifact-receipt', outcomeClass: 'citation-use-or-falsification',
    rollbackClass: 'withdraw-or-correct',
    binder: 'brain-v2/bind/education.js', brain: 'assets/js/domain-brains/education-brain.js',
    decisionFile: 'lib/research-paper-developmental-authority.js', executorFile: 'handlers/limen-worker-autofire.js',
    observerFile: 'lib/research-evaluation-observer.js', recoveryFile: 'lib/research-artifact-recovery.js',
    learningFile: 'lib/autofire-learning.js', cycleRoute: 'limen-worker-autofire',
    observerRoute: 'limen-research-evaluation-observer', recoveryRoute: 'research artifact withdrawal',
    desk: 'College Scorecard', deskTool: 'education-tools',
    commissioningKind: 'reversible', provider: 'internal-research-artifact-or-paper',
    observerIdentity: 'education-research-evaluation-observer/1',
    adapterId: 'education-research-paper-adapter/1', observerAdapterId: 'education-evaluation-read/1'
  }),
  law: Object.freeze({
    productDomain: 'law', ownerDomain: 'law', lane: 'automail',
    valveId: 'law:automail', contractId: 'law-motor/1',
    decisionContract: 'physical-message-decision/1', budgetId: 'law-automail-budget/1',
    receiptClass: 'mail-provider-receipt', outcomeClass: 'delivery-or-response',
    rollbackClass: 'cancel-before-tender-or-suppress',
    binder: 'brain-v2/bind/law.js', brain: 'assets/js/domain-brains/law-brain.js',
    decisionFile: 'lib/law-automail-decision.js', executorFile: 'lib/law-automail-executor.js',
    observerFile: 'lib/law-automail-outcome-observer.js', recoveryFile: 'lib/law-automail-recovery.js',
    learningFile: 'lib/law-automail-learning.js', cycleRoute: 'homestead-automail',
    observerRoute: 'law-automail-outcome-observer', recoveryRoute: 'law-automail-recovery',
    desk: 'Federal Register', deskTool: 'law-tools',
    commissioningKind: 'bounded-irreversible', provider: 'lob-or-paper-letter',
    observerIdentity: 'law-automail-delivery-observer/1',
    adapterId: 'law-automail-paper-adapter/1', observerAdapterId: 'law-automail-independent-read/1'
  }),
  population: Object.freeze({
    productDomain: 'population', ownerDomain: 'population', lane: 'real-estate',
    valveId: 'population:real-estate', contractId: 'population-motor/1',
    decisionContract: 'property-transaction-decision/1', budgetId: 'population-real-estate-budget/1',
    receiptClass: 'counterparty-receipt', outcomeClass: 'accept-decline-or-close',
    rollbackClass: 'withdraw-or-terminate-under-policy',
    binder: 'brain-v2/bind/population.js', brain: 'assets/js/domain-brains/population-brain.js',
    decisionFile: 'lib/population-real-estate-decision.js', executorFile: 'lib/population-real-estate-executor.js',
    observerFile: 'lib/population-real-estate-observer.js', recoveryFile: 'lib/population-real-estate-recovery.js',
    learningFile: 'lib/population-real-estate-learning.js', cycleRoute: 'population-real-estate-cycle',
    observerRoute: 'population-real-estate-inbound', recoveryRoute: 'population-real-estate-recovery',
    desk: 'County / ZIP', deskTool: 'population-tools',
    commissioningKind: 'bounded-irreversible', provider: 'resend-or-owned-destination',
    observerIdentity: 'population-real-estate-inbound-observer/1',
    adapterId: 'population-real-estate-paper-adapter/1', observerAdapterId: 'population-real-estate-independent-read/1'
  }),
  governance: Object.freeze({
    productDomain: 'governance', ownerDomain: 'governance', lane: 'publication',
    valveId: 'governance:publication', contractId: 'governance-motor/1',
    decisionContract: 'public-artifact-decision/1', budgetId: 'governance-publication-budget/1',
    receiptClass: 'publication-receipt', outcomeClass: 'reach-engagement-or-conversion',
    rollbackClass: 'unpublish-or-correct',
    binder: 'brain-v2/bind/governance.js', brain: 'assets/js/domain-brains/governance-brain.js',
    decisionFile: 'lib/governance-publication-decision.js', executorFile: 'lib/governance-publication-executor.js',
    observerFile: 'lib/governance-publication-observer.js', recoveryFile: 'lib/governance-publication-recovery.js',
    learningFile: 'lib/governance-publication-learning.js', cycleRoute: 'governance-publication-cycle',
    observerRoute: 'governance-publication-outcome-observer', recoveryRoute: 'governance-publication-recovery',
    desk: 'Awards / UEI', deskTool: 'governance-tools',
    commissioningKind: 'reversible', provider: 'owned-public-article-or-paper',
    observerIdentity: 'governance-publication-public-observer/1',
    adapterId: 'governance-publication-paper-adapter/1', observerAdapterId: 'governance-publication-independent-read/1'
  }),
  intelligence: Object.freeze({
    productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot',
    valveId: 'intelligence:autopilot', contractId: 'intelligence-motor/1',
    decisionContract: 'bounded-command-decision/1', budgetId: 'intelligence-autopilot-budget/1',
    receiptClass: 'command-receipt', outcomeClass: 'independent-world-measurement',
    rollbackClass: 'kill-and-compensate',
    binder: 'brain-v2/bind/intelligence.js', brain: 'assets/js/domain-brains/intelligence-brain.js',
    decisionFile: 'lib/intelligence-autopilot-decision.js', executorFile: 'lib/intelligence-autopilot-executor.js',
    observerFile: 'lib/intelligence-autopilot-outcome-observer.js', recoveryFile: 'lib/intelligence-autopilot-recovery.js',
    learningFile: 'lib/intelligence-autopilot-learning.js', cycleRoute: 'autopilot',
    observerRoute: 'intelligence-autopilot-outcome-observer', recoveryRoute: 'intelligence-autopilot-recovery',
    desk: 'OFAC SDN', deskTool: 'intelligence-tools',
    commissioningKind: 'bounded-irreversible', provider: 'resend-or-owned-destination',
    observerIdentity: 'intelligence-autopilot-mail-observer/1',
    adapterId: 'intelligence-autopilot-paper-adapter/1', observerAdapterId: 'intelligence-autopilot-independent-read/1'
  })
});

function get(domain) {
  var id = String(domain || '').toLowerCase();
  return LANES[id] || null;
}
function scoped(domain) { return SCOPE.indexOf(String(domain || '').toLowerCase()) >= 0; }
function all() { return SCOPE.map(function (id) { return LANES[id]; }); }
function valveLine(domain) {
  var spec = get(domain);
  return spec ? Valve.get(spec.valveId) : null;
}

module.exports = {
  SOFT3: SOFT3.slice(), CIVIC: CIVIC.slice(), SCOPE: SCOPE.slice(),
  LANES: LANES, get: get, scoped: scoped, all: all, valveLine: valveLine
};
