'use strict';
var CronAuth = require('../lib/cron-auth.js');
var handler = require('./product-domain-business-capability.js').createHandler('population', { cronAuth: CronAuth });
var wrapped = require('../lib/heartbeat').wrap('population-real-estate-capability', handler);
wrapped.createHandler = require('./product-domain-business-capability.js').createHandler;
module.exports = wrapped;
