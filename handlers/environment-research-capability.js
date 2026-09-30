'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Factory = require('./product-domain-research-capability.js');
var handler = Factory.createHandler('environment', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('environment-research-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('environment', Object.assign({ cronAuth: CronAuth }, deps || {})); };
