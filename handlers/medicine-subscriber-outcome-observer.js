'use strict';
var Lane = require('../lib/soft-domain-subscriber-lanes.js').get('medicine');
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
function createHandler(deps) { return Factory.observer(Lane, deps); }
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('medicine-subscriber-outcome-observer', handler); module.exports.createHandler = createHandler;
