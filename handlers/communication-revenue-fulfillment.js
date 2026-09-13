'use strict';
var Lane = require('../lib/soft-domain-subscriber-lanes.js').get('communication');
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
function createHandler(deps) { return Factory.fulfillment(Lane, deps); }
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('communication-revenue-fulfillment', handler); module.exports.createHandler = createHandler;
