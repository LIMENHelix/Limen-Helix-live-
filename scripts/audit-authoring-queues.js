/**
 * Read-only Job 3 substrate audit.
 *
 * It measures the current authoring-queue surface without creating tasks or
 * treating a generated portal as evidence. Run from the repository root:
 *   node scripts/audit-authoring-queues.js
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');
var DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy',
  'environment','finance','governance','industry','infrastructure','intelligence','law','medicine',
  'population','religion','science','technology','trade'];
var AGGREGATE = { agriculture: 'p2_agri.json' };

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { return { _readError: err.message }; }
}

var rows = DOMAINS.map(function (domain) {
  var queueFile = path.join(DEEP, domain + '-authoring-queue.json');
  var queue = fs.existsSync(queueFile) ? readJson(queueFile) : null;
  var aggregateName = AGGREGATE[domain] || (domain + '.json');
  var aggregateFile = path.join(ROOT, 'assets', 'data', 'domains', aggregateName);
  var deepFiles = fs.existsSync(DEEP)
    ? fs.readdirSync(DEEP).filter(function (name) { return name.indexOf(domain + '-') === 0 && name.endsWith('.json'); })
    : [];
  return {
    domain: domain,
    queueExists: !!queue,
    queueTasks: queue && typeof queue.totalTasks === 'number' ? queue.totalTasks : null,
    queueGeneratedAt: queue ? (queue.generatedAt || null) : null,
    aggregateExists: fs.existsSync(aggregateFile),
    deepJsonFiles: deepFiles.length,
    admission: queue && queue.admission ? queue.admission : null
  };
});

var populated = rows.filter(function (row) { return row.queueTasks > 0; });
var empty = rows.filter(function (row) { return row.queueTasks === 0; });
console.log(JSON.stringify({
  readOnly: true,
  domains: rows.length,
  populatedQueues: populated.length,
  emptyQueues: empty.length,
  totalQueuedTasks: populated.reduce(function (sum, row) { return sum + row.queueTasks; }, 0),
  rows: rows
}, null, 2));
