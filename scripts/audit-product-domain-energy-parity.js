#!/usr/bin/env node
'use strict';

var report = require('../lib/product-domain-energy-parity-audit.js').audit();
console.log(JSON.stringify(report, null, 2));
if (report.summary.separateBrains !== 20 || report.summary.commonPhysiologyImplemented !== 20) process.exitCode = 1;
