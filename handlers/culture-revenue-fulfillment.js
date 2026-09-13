'use strict';
var Lane = require('../lib/soft-domain-subscriber-lanes.js').get('culture');
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
function createHandler(deps) { return Factory.fulfillment(Lane, deps); }
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('culture-revenue-fulfillment', handler); module.exports.createHandler = createHandler;
