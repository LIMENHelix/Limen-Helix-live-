'use strict';
var Factory = require('./product-domain-tradier-capability.js');
var CronAuth = require('../lib/cron-auth.js');
var handler = Factory.createHandler('economy', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('economy-investment-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('economy', deps); };
