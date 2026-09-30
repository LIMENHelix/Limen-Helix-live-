'use strict';
var Factory = require('./product-domain-tradier-capability.js');
var CronAuth = require('../lib/cron-auth.js');
var handler = Factory.createHandler('energy', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('energy-investment-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('energy', deps); };
