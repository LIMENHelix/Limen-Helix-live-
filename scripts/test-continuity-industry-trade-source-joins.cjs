'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Module = require('node:module'), acorn = require('acorn');
const root = path.resolve(__dirname, '..'), filename = path.join(root, 'handlers/domain-snapshot.js');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testBuildDomain = buildDomain;module.exports.testWBPopulation = fetchWorldBankPopulation;module.exports.testWBInternetUsers = fetchWBInternetUsers;module.exports.testReligionNews = fetchRSSReligion;module.exports.testReligionEvents = fetchRSSReligionEvents;', filename);
const H = mod.exports, Packet = require('../lib/civilization-server-packet.js'), Consumer = require('../lib/civilization-handoff-consumer.js');
const harness = fs.readFileSync(path.join(__dirname, 'test-continuity-feed-spine.cjs'), 'utf8');
const helper = acorn.parse(harness, { ecmaVersion: 'latest' }).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'sandbox');
const sandbox = new Function('global', harness.slice(helper.start, helper.end) + ';return sandbox();');
const profiles = [
  { domain: 'industry', runtime: 'industry', brain: 'LIMENIndustryBrain', series: 'PCUOMFG--OMFG--', first: 'BLS Manufacturing PPI', second: 'World Bank Manufacturing',
    fetchFirst: H._fetchBLSManufacturing, fetchSecond: H._fetchWBManufacturing, family: 'crm', blocker: 'source-grounded-work-first-WARN-record-required' },
  { domain: 'trade', runtime: 'supplyChain', brain: 'LIMENSupplyChainBrain', series: 'PCU484121484121', first: 'BLS Freight PPI', second: 'CISA KEV',
    fetchFirst: H._fetchBLSFreight, fetchSecond: H._fetchCISAKEV, family: 'auction', blocker: 'exact-owned-asset-auction-listing-record-required' },
  { domain: 'infrastructure', runtime: 'infrastructure', brain: 'LIMENInfrastructureBrain', first: 'World Bank Infrastructure', second: 'NOAA NWS Alerts',
    firstIndicator: 'IS.RRS.TOTL.KM', fetchFirst: H._fetchWorldBankInfra, fetchSecond: H._fetchNOAANWSAlerts, family: 'real-estate', blocker: 'exact-non-binding-property-interest-record-required' },
  { domain: 'population', runtime: 'population', brain: 'LIMENPopulationBrain', first: 'World Bank Population', second: 'World Bank Fertility',
    firstIndicator: 'SP.POP.TOTL', fetchFirst: H.testWBPopulation, fetchSecond: H._fetchWorldBankFertility, family: 'real-estate', blocker: 'exact-non-binding-property-interest-record-required' },
  { domain: 'communication', runtime: 'communication', brain: 'LIMENCommunicationBrain', first: 'BBC World News', second: 'World Bank Internet Users',
    fetchFirst: H._fetchBBCWorldNews, fetchSecond: H.testWBInternetUsers, family: 'social', blocker: 'candidate-identity-missing' },
  { domain: 'intelligence', runtime: 'intelligence', brain: 'LIMENIntelligenceBrain', first: 'CISA Advisories', second: 'CISA KEV',
    fetchFirst: H._fetchCISAAdvisories, fetchSecond: H._fetchCISAKEV, family: 'autopilot', blocker: 'exact-lead-email-action-required' },
  { domain: 'economy', runtime: 'economy', brain: 'LIMENEconomyBrain', first: 'World Bank GDP Growth', second: 'World Bank Inflation',
    firstIndicator: 'NY.GDP.MKTP.KD.ZG', fetchFirst: H._fetchWorldBankGDPGrowth, fetchSecond: H._fetchWorldBankInflation, family: 'investment', blocker: 'exact-paper-investment-record-required' },
  { domain: 'energy', runtime: 'energy', brain: 'LIMENEnergyBrain', first: 'NOAA NWS Alerts', second: 'CISA KEV',
    fetchFirst: H._fetchNOAANWSAlerts, fetchSecond: H._fetchCISAKEV, family: 'investment', blocker: 'exact-paper-investment-record-required' },
  { domain: 'technology', runtime: 'technology', brain: 'LIMENTechnologyBrain', first: 'Hacker News', second: 'CISA KEV',
    fetchFirst: H._fetchHackerNews, fetchSecond: H._fetchCISAKEV, family: 'investment', blocker: 'exact-paper-investment-record-required' },
  { domain: 'law', runtime: 'law', brain: 'LIMENLawBrain', first: 'CISA KEV', second: 'SEC Enforcement Actions',
    fetchFirst: H._fetchCISAKEV, fetchSecond: H._fetchSECEnforcement, family: 'automail', blocker: 'exact-address-content-and-lead-time-required' },
  { domain: 'religion', runtime: 'religion', brain: 'LIMENReligionBrain', first: 'RSS Religion News', second: 'RSS Religion Events',
    fetchFirst: H.testReligionNews, fetchSecond: H.testReligionEvents, family: 'subscriber', blocker: 'paid-subscriber-candidate-invalid' },
  { domain: 'education', runtime: 'education', brain: 'LIMENEducationBrain', first: 'World Bank Tertiary', second: 'OpenAlex Institutions',
    firstIndicator: 'SE.TER.ENRR', fetchFirst: H._fetchWorldBankTertiary, fetchSecond: H._fetchOpenAlex, family: 'research-intake', blocker: 'owning-domain-semantic-identity-invalid' },
  { domain: 'environment', runtime: 'environment', brain: 'LIMENEnvironmentBrain', first: 'NOAA Alerts', second: 'USGS Earthquakes',
    fetchFirst: H._fetchNOAAAlerts, fetchSecond: H._fetchUSGSEarthquakes, family: 'research-intake', blocker: 'owning-domain-semantic-identity-invalid' },
  { domain: 'science', runtime: 'research', brain: 'LIMENResearchBrain', first: 'PubMed', second: 'arXiv All',
    fetchFirst: H._fetchPubMed, fetchSecond: H._fetchArXivAll, family: 'research-intake', blocker: 'owning-domain-semantic-identity-invalid' },
  { domain: 'medicine', runtime: 'health', brain: 'LIMENHealthBrain', first: 'openFDA Recalls', second: 'PubMed',
    fetchFirst: H._fetchFDARecalls, fetchSecond: H._fetchPubMed, family: 'research-intake', blocker: 'owning-domain-semantic-identity-invalid' }
];
const originalFetch = global.fetch;
(async () => {
  const results = [];
  for (const p of profiles) for (const scenario of ['valid', 'first-source-unavailable', 'recovery']) {
    H._resetBLSRequestState(); const requests = [];
    global.fetch = async url => {
      const u = String(url); requests.push(u); let body;
      if (u === 'https://feeds.bbci.co.uk/news/world/rss.xml' || u === 'https://www.cisa.gov/cybersecurity-advisories/all.xml' ||
          u === 'https://www.sec.gov/news/pressreleases.rss' || u.startsWith('https://news.google.com/rss/search?')) {
        const missing = scenario === 'first-source-unavailable' && (p.domain === 'communication' || p.domain === 'intelligence' ||
          p.domain === 'religion' && decodeURIComponent(u).includes('religious conflict'));
        if (missing && p.domain === 'religion') return { ok: false, status: 503, text: async () => { throw new Error('LOCAL/FIXTURE source unavailable'); } };
        body = missing ? '' : '<rss><channel>' + Array.from({ length: 20 }, (_, i) =>
          '<item><title>LOCAL/FIXTURE critical ICS advisory ' + i + '</title><link>https://fixture.invalid/item/' + i + '</link><pubDate>' + new Date().toUTCString() + '</pubDate></item>').join('') + '</channel></rss>';
      }
      else if (u.includes('api.bls.gov')) body = { status: 'REQUEST_SUCCEEDED', Results: { series: scenario === 'first-source-unavailable' ? [] :
        [{ seriesID: p.series, data: [{ year: '2026', period: 'M09', value: '150' }] }] } };
      else if (u.includes('api.worldbank.org')) {
        const missing = scenario === 'first-source-unavailable' && p.firstIndicator && u.includes(p.firstIndicator);
        const fertility = u.includes('SP.DYN.TFRT.IN');
        body = [{ page: 1 }, [{ date: '2024', value: missing ? null : fertility ? 1.5 : p.domain === 'population' ? 340000000 : p.domain === 'communication' ? 35 : 8 },
          { date: '2023', value: missing ? null : fertility ? 1.6 : 9 }]];
      }
      else if (u === 'https://hacker-news.firebaseio.com/v0/topstories.json') body = scenario === 'first-source-unavailable' ? null : Array.from({ length: 120 }, (_, i) => 900000 + i);
      else if (u.startsWith('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?')) body = p.domain === 'science' && scenario === 'first-source-unavailable' ? '' : '<eSearchResult><Count>1000000</Count></eSearchResult>';
      else if (u.startsWith('https://export.arxiv.org/api/query?')) body = '<feed><updated>2026-09-30T12:00:00Z</updated><opensearch:totalResults>2200000</opensearch:totalResults></feed>';
      else if (u.startsWith('https://api.fda.gov/drug/enforcement.json?')) body = scenario === 'first-source-unavailable' ? null : { meta: { last_updated: '2026-09-30', results: { total: 65 } } };
      else if (u.includes('api.openalex.org')) body = { results: [{ id: 'https://openalex.org/I123456', works_count: 1000000, updated_date: '2026-09-30' }] };
      else if (u.includes('earthquake.usgs.gov')) body = { metadata: { generated: Date.now() }, features: [{ id: 'LOCAL-FIXTURE-earthquake', properties: { mag: 6.2, time: Date.now(), updated: Date.now() } }] };
      else if (u.includes('api.weather.gov')) body = scenario === 'first-source-unavailable' && ['energy', 'environment'].includes(p.domain) ? null : { updated: new Date().toISOString(), features:
        Array.from({ length: 60 }, (_, i) => ({ id: 'LOCAL/FIXTURE-alert-' + i, properties: { event: 'Flood Warning', severity: 'Severe' } })) };
      else { assert(u.includes('www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'));
        body = p.domain === 'law' && scenario === 'first-source-unavailable' ? null : { catalogVersion: 'LOCAL-FIXTURE', count: 18, dateReleased: new Date().toISOString(), vulnerabilities:
          Array.from({ length: 18 }, (_, i) => ({ cveID: 'CVE-2026-' + (2000 + i), dateAdded: new Date().toISOString().slice(0, 10), knownRansomwareCampaignUse: 'Known' })) }; }
      return { ok: true, status: 200, json: async () => body, text: async () => body };
    };
    const first = await p.fetchFirst(), second = await p.fetchSecond(); assert(second);
    assert.equal(first === null, scenario === 'first-source-unavailable', p.domain + ':' + scenario);
    const snapshot = H.testBuildDomain(p.runtime, [{ name: p.first, data: first }, { name: p.second, data: second }]);
    if (!first) { assert.equal(snapshot.sources[0].classification, 'broken'); assert.equal(snapshot.sources[0].value, null); assert(snapshot.lowSignal); }
    const sb = sandbox(global); sb.LIMENDomains = { [p.runtime]: snapshot };
    sb.fetch = async url => {
      const relative = String(url).split('?')[0].replace(/^\//, ''), target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep) || !relative.endsWith('.json') || !fs.existsSync(target)) return { ok: false, status: 404 };
      const body = JSON.parse(fs.readFileSync(target, 'utf8')); return { ok: true, status: 200, json: async () => body };
    };
    vm.createContext(sb);
    for (const name of ['domain-identity.js', 'limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js',
      'domain-brains/domain-brain-base.js', 'domain-brains/portal-content-resolver.js', 'domain-brains/inter-brain-bus.js',
      'domain-brains/domain-change-log.js', 'domain-brains/' + p.domain + '-brain.js'])
      vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'), sb, { filename: name });
    const brain = sb[p.brain]; await brain.cycle();
    const packet = Packet.fromBrainState(p.domain, brain.state, { snapshotId: 'fixture-' + p.domain + '-' + scenario, fetchedAt: Date.now() },
      'fixture-institutional-source-join', new Date().toISOString(), { feedSourceEvidence: Packet.feedSourceEvidence(p.domain, snapshot) });
    assert.equal(packet.truth.feedSourceEvidence.sources[0].sourceUpdatedAt, first && first.sourceUpdatedAt);
    const values = new Map(), indexes = new Map(), clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
    const store = { packetIndexKey: 'packets', handoffIndexKey: 'handoffs', packetKey: id => 'packet:' + id, handoffKey: id => 'handoff:' + id,
      setNx: async (k, v) => { if (values.has(k)) return false; values.set(k, clone(v)); return true; }, get: async k => clone(values.get(k)),
      members: async k => Array.from(indexes.get(k) || []), add: async (k, v) => { const a = indexes.get(k) || new Set(); a.add(v); indexes.set(k, a); return a.size; } };
    const consumer = Consumer.createConsumer({ store }), consumed = await consumer.consumePacket(packet); assert(consumed.ok);
    if (['industry', 'trade'].includes(p.domain)) assert(consumed.handoffsCreated > 0);
    else if (consumed.handoffsCreated === 0) assert.equal(packet.truth.opportunities.filter(o => Packet.ACTIVE_LANES.includes(o.lane)).length, 0);
    for (const id of await store.members('handoffs')) assert.deepEqual((await store.get(store.handoffKey(id))).feedSourceEvidence, packet.truth.feedSourceEvidence);
    const before = JSON.stringify(Array.from(values)), Decision = p.family === 'research-intake' ? null : require('../lib/' + p.domain + '-' + p.family + '-decision.js');
    const checks = [];
    if (p.family === 'research-intake') {
      const intake = require('../lib/domain-research-candidate.js').build({ c: { serverPacket: packet, serverPacketPersistence: consumed } }, p.domain, Date.parse(packet.generatedAt));
      assert.equal(intake.status, 'ABSTAINED'); assert.equal(intake.candidate, null); assert.equal(intake.reason, p.blocker);
      checks.push({ status: intake.status, reason: intake.reason });
    }
    for (const opportunity of packet.truth.opportunities) {
      if (p.family === 'research-intake') continue;
      if (p.family === 'investment' && opportunity.path !== 'INVESTABLE') continue;
      const refusal = await Decision.decide(store, opportunity, Date.parse(packet.generatedAt));
      assert.equal(refusal.status, 'NO_ACTION'); assert.deepEqual(refusal.blockers, [p.blocker]);
      if (['communication', 'religion'].includes(p.domain)) { assert.equal(refusal.released, false); assert.equal(refusal.liveMoney, false); }
      else if (p.family === 'investment') { assert.equal(Decision.candidate(opportunity), null); assert.equal(refusal.liveMoney, false); }
      else assert.equal(refusal.providerCalled, false);
      checks.push({ opportunityId: opportunity.id, blockers: refusal.blockers });
    }
    if (p.family === 'investment' && checks.length === 0) assert.equal(packet.truth.opportunities.filter(o => o.path === 'INVESTABLE').length, 0);
    assert.equal((await consumer.consumePacket(packet)).handoffsCreated, 0); assert.equal(JSON.stringify(Array.from(values)), before);
    results.push({ domain: p.domain, runtime: p.runtime, scenario, requests, sources: packet.truth.feedSourceEvidence,
      stress: snapshot.stress, lowSignal: snapshot.lowSignal, packetId: packet.packetId, handoffs: consumed.handoffsCreated, checks,
      nextBoundary: p.family === 'investment' && checks.length === 0 ? 'native-snapshot-has-no-investable-opportunity' :
        consumed.handoffsCreated ? p.blocker : 'native-snapshot-has-no-active-investment-or-research-handoff' });
  }
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(root, 'docs/audits/continuity-industry-trade-source-joins.json'),
    JSON.stringify({ level: 'LOCAL/FIXTURE', externalFetches: false, injectedDiagnoses: false, injectedOpportunities: false, results }, null, 2) + '\n');
  console.log(JSON.stringify(results.map(({ domain, scenario, stress, lowSignal, handoffs }) => ({ domain, scenario, stress, lowSignal, handoffs }))));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; H._resetBLSRequestState(); });
