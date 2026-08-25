#!/usr/bin/env node
'use strict';

var AUDIT = require('../lib/product-domain-brain-audit.js');
var report = AUDIT.audit();

console.log('PRODUCT DOMAIN BRAINS — ' + report.measuredAt);
console.log('Layer: ' + report.layer + ' (not brain-v2/kernel)');
console.log('');
console.log('DOMAIN\tRUNTIME\tBYTES\tCORE\tAUTHORITY\tMISSING');
report.domains.forEach(function (row) {
  console.log([
    row.product,
    row.runtime || '-',
    row.bytes,
    row.coreComplete ? 'PASS' : 'GAP',
    row.authorityGaps.length ? 'GAP:' + row.authorityGaps.join(',') : 'PASS',
    row.missing.join(',') || '-'
  ].join('\t'));
});
console.log('');
console.log(report.coreComplete + '/' + report.domains.length + ' separate product brains satisfy the common core');
console.log(report.authorityParityComplete + '/' + report.domains.length + ' expose implemented-or-explicitly-inhibited authority parts');
if (process.argv.indexOf('--json') >= 0) console.log(JSON.stringify(report, null, 2));
if (process.argv.indexOf('--require-complete') >= 0 &&
    (report.coreComplete !== report.domains.length || report.authorityParityComplete !== report.domains.length)) process.exit(1);
