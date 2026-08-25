#!/usr/bin/env node
'use strict';

var audit = require('../lib/product-domain-business-executor-audit.js').audit();
console.log(JSON.stringify(audit, null, 2));
