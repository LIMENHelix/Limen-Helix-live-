'use strict';
var Lane = require('../lib/soft-domain-subscriber-lanes.js').get('culture');
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
function createHandler(deps) { return Factory.recovery(Lane, deps); }
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('culture-subscriber-recovery', handler); module.exports.createHandler = createHandler;
