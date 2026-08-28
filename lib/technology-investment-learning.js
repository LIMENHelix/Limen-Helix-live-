'use strict';

var Learning = require('./autofire-learning.js');

async function recordCommand(store, candidate, decision, command, emittedAt) {
  return Learning.recordProductInvestmentCommand(store, {
    domain: 'technology',
    candidate: candidate,
    decision: decision,
    command: command,
    emittedAt: emittedAt
  });
}

module.exports = { recordCommand: recordCommand };
