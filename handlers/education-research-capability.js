'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Factory = require('./product-domain-research-capability.js');
var handler = Factory.createHandler('education', { cronAuth: CronAuth });
module.exports = require('../lib/heartbeat').wrap('education-research-capability', handler);
module.exports.createHandler = function (deps) { return Factory.createHandler('education', Object.assign({ cronAuth: CronAuth }, deps || {})); };
