'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Factory = require('./product-domain-research-capability.js');
var handler = Factory.createHandler('science', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('science-research-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('science', Object.assign({ cronAuth: CronAuth }, deps || {})); };
