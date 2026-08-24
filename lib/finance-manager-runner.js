'use strict';

/**
 * Provider-gated Finance manager runner.
 *
 * This is the callable seam for one Preview-only manager proposal. It joins
 * the already-built manager context to the source ledger, but it does not
 * release a candidate, write state, call a broker, or submit an order. The
 * default provider is the shared AI orchestrator, so its environment kill
 * switch and token budget remain authoritative. Tests may inject a provider.
 */

var Prompt = require('./finance-manager-prompt.js');
var Adapter = require('./finance-manager-producer-adapter.js');
var Producer = require('./finance-opportunity-producer.js');
var Universe = require('./finance-candidate-universe.js');

var SYSTEM = [
  'You are the LIMEN Finance paper-review manager.',
  'Return exactly one JSON object matching finance-manager-proposal/1.0.',
  'Use only the supplied source-identified context. Do not invent facts.',
  'This is a paper proposal only; never return an order or live execution.'
].join(' ');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

async function defaultProvider(input) {
  var orchestrator = require('./ai-orchestrator.js');
  return orchestrator.call('AUTHOR_PATTERN', {
    system: input.system,
    prompt: input.prompt,
    maxTokens: input.maxTokens || 3000
  });
}

async function run(input, options) {
  input = input || {};
  options = options || {};
  var universe = input.candidateUniverse || null;
  var managerContext = input.managerContext || (universe ? Universe.managerContext(universe) : null);
  var ledger = input.ledger || null;
  var request = Prompt.buildRequest({ managerContext: managerContext });
  if (!request.ok) return { ok: false, status: 'ABSTAINED', reason: request.reason };
  if (!universe && (!ledger || ledger.schemaVersion !== 'finance-input-ledger/1.0' ||
      ['READY_FOR_MANAGER_REVIEW', 'READY_FOR_PAPER_REVIEW'].indexOf(ledger.status) < 0)) {
    return { ok: false, status: 'ABSTAINED', reason: 'finance_input_ledger_not_ready' };
  }
  if (universe && (!universe.candidates || !universe.candidates.length)) return { ok: false, status: 'ABSTAINED', reason: 'candidate_universe_not_ready' };

  var provider = options.provider || defaultProvider;
  var response;
  try {
    response = await provider({
      system: SYSTEM,
      prompt: JSON.stringify(request),
      request: clone(request),
      maxTokens: options.maxTokens || 3000
    });
  } catch (e) {
    return { ok: false, status: 'ABSTAINED', reason: 'finance_manager_provider_failed', detail: String(e && e.message || e) };
  }
  if (!response || response.ok !== true || typeof response.text !== 'string' || !response.text.trim()) {
    return { ok: false, status: 'ABSTAINED', reason: response && response.disabled ? 'finance_manager_ai_disabled' : 'finance_manager_provider_no_response', provider: response && response.provider || null };
  }

  var parsed = Prompt.parseResponse(response.text);
  if (!parsed.ok) return { ok: false, status: 'ABSTAINED', reason: parsed.reason, blockers: parsed.blockers || [] };
  var adapted = Adapter.adapt(parsed);
  if (!adapted.ok) return { ok: false, status: 'ABSTAINED', reason: adapted.reason, blockers: adapted.blockers || [] };
  if (universe) {
    var selected = Universe.select(universe, adapted.proposal.company);
    if (!selected.ok) return selected;
    ledger = selected.candidate.ledger;
  }
  var candidate = Producer.build({ ledger: ledger, proposal: adapted.proposal });
  return {
    ok: candidate.status === 'PAPER_CANDIDATE',
    status: candidate.status,
    proposal: clone(adapted.proposal),
    selectedCompany: clone(adapted.proposal.company),
    candidate: candidate,
    provider: { name: response.provider || null, model: response.model || null, tokensIn: response.tokensIn || null, tokensOut: response.tokensOut || null }
  };
}

module.exports = { SYSTEM: SYSTEM, run: run };
