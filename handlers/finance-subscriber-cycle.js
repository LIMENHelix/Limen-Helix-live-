'use strict';

/** Finance-owned scheduled entrypoint into the paid-subscriber coordinator. */
var SubscriberDigest = require('./subscriber-digest.js');

module.exports = function handler(req, res) {
  req.query = Object.assign({}, req.query || {}, { motorDomain: 'finance' });
  return SubscriberDigest(req, res);
};
