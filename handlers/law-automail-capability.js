'use strict';
var CronAuth = require('../lib/cron-auth.js');
var handler = require('./product-domain-business-capability.js').createHandler('law', { cronAuth: CronAuth });
var wrapped = require('../lib/heartbeat').wrap('law-automail-capability', handler);
wrapped.createHandler = require('./product-domain-business-capability.js').createHandler;
module.exports = wrapped;
