'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Factory = require('./product-domain-research-capability.js');
var handler = Factory.createHandler('medicine', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('medicine-research-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('medicine', Object.assign({ cronAuth: CronAuth }, deps || {})); };
