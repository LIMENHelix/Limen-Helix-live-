'use strict';
var fs = require('fs');
var path = require('path');
var PIPE = require('../lib/domain-authoring-pipeline.js');
var ROOT = path.join(__dirname, '..');
var DOMAIN_ROOT = path.join(ROOT, 'assets', 'data', 'domains');
var domains = process.argv.slice(2).filter(function (x) { return x.indexOf('--') !== 0; });
if (!domains.length) domains = ['science', 'medicine', 'finance'];
var write = process.argv.indexOf('--write') >= 0;
domains.forEach(function (domain) {
  var result = PIPE.build(domain, DOMAIN_ROOT, 120);
  if (write) {
    fs.writeFileSync(path.join(ROOT, 'assets', 'data', 'deep', domain + '-portal-quality-index.json'), JSON.stringify(result.quality, null, 2) + '\n');
    fs.writeFileSync(path.join(ROOT, 'assets', 'data', 'deep', domain + '-certified-cortex-index.json'), JSON.stringify(result.cortex, null, 2) + '\n');
    fs.writeFileSync(path.join(ROOT, 'assets', 'data', 'deep', domain + '-authoring-queue.json'), JSON.stringify(result.queue, null, 2) + '\n');
  }
  console.log(JSON.stringify({ domain: domain, sourceFiles: PIPE.domainFiles(DOMAIN_ROOT, domain).length, sampled: result.quality.sampledTotal, classifications: result.quality.classificationTotals, tasks: result.queue.totalTasks, wrote: write }));
});
