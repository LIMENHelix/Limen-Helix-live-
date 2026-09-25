'use strict';

/** Finance-owned scheduled entrypoint into the paid-subscriber coordinator. */
var SubscriberDigest = require('./subscriber-digest.js');

function handler(req, res) {
  req.query = Object.assign({}, req.query || {}, { motorDomain: 'finance' });
  return SubscriberDigest(req, res);
}

// The delegated subscriber-digest keeps its own global guard. This wrapper
// gives the scheduled Finance entrypoint a distinct observed heartbeat too.
module.exports = require('../lib/heartbeat').wrap('finance-subscriber-cycle', handler);
