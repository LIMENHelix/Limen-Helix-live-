#!/usr/bin/env node
'use strict';

/*
 * Read-only Job 3 audit.
 *
 * A binder declaration is not evidence that its recorded quantity exists.  This
 * audit joins each canonical domain's binder to its own recorder fixture and
 * reports, per channel, source-name matches and the availability of the current
 * and legacy recorded fields.  It never edits fixtures or binder declarations.
 *
 * In particular, an r7 channel with no recordedFieldLegacy is reported as
 * `unreadableLegacy`, not silently filled from v.  That distinction is the
 * reason this is an audit rather than a repair script.
 */

var fs = require('fs');
var path = require('path');
var registry = require('../brain-v2/bind/registry.js');

function finiteNumber(v) { return typeof v === 'number' && isFinite(v); }

function readFixture(d) {
  var fp = registry.fixturePath(d);
  if (!fs.existsSync(fp)) return { ok: false, reason: 'missing fixture' };
  try {
    var doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!doc || !Array.isArray(doc.rows) || !doc.rows.length) {
      return { ok: false, reason: 'fixture has no non-empty rows array' };
    }
    return { ok: true, doc: doc, path: fp };
  } catch (e) {
    return { ok: false, reason: 'fixture unreadable: ' + e.message };
  }
}

function channelAudit(channel, rows) {
  var sourceMatches = 0;
  var currentPresent = 0;
  var legacyPresent = 0;
  var readable = 0;
  var firstCurrent = null;
  var firstLegacy = null;
  var lastCurrent = null;
  var lastLegacy = null;

  rows.forEach(function (row) {
    var sources = Array.isArray(row.src) ? row.src : [];
    sources.forEach(function (source) {
      if (!source || source.n !== channel.name) return;
      sourceMatches++;
      var t = row.t === undefined ? null : row.t;
      if (finiteNumber(source[channel.recordedField])) {
        currentPresent++;
        if (firstCurrent === null) firstCurrent = t;
        lastCurrent = t;
      }
      if (channel.recordedFieldLegacy && finiteNumber(source[channel.recordedFieldLegacy])) {
        legacyPresent++;
        if (firstLegacy === null) firstLegacy = t;
        lastLegacy = t;
      }
      if (finiteNumber(source[channel.recordedField]) ||
          (channel.recordedFieldLegacy && finiteNumber(source[channel.recordedFieldLegacy]))) readable++;
    });
  });

  return {
    key: channel.key,
    name: channel.name,
    liveField: channel.field,
    recordedField: channel.recordedField,
    legacyField: channel.recordedFieldLegacy || null,
    units: channel.units,
    legacyUnits: channel.legacyUnits || null,
    sourceMatches: sourceMatches,
    currentPresent: currentPresent,
    legacyPresent: legacyPresent,
    readable: readable,
    unreadableLegacy: channel.recordedField === 'r7' && !channel.recordedFieldLegacy &&
      sourceMatches > 0 && currentPresent < sourceMatches,
    firstCurrent: firstCurrent,
    lastCurrent: lastCurrent,
    firstLegacy: firstLegacy,
    lastLegacy: lastLegacy
  };
}

function auditDomain(d) {
  var base = { product: d.product, snapshot: d.snapshot, state: 'unavailable' };
  var binderPath = registry.binderPath(d);
  if (!fs.existsSync(binderPath)) {
    base.reason = 'missing binder';
    return base;
  }
  var binder;
  try { binder = require(binderPath); } catch (e) {
    base.reason = 'binder load failed: ' + e.message;
    return base;
  }
  var spec;
  try { spec = binder.spec(); } catch (e) {
    base.reason = 'binder spec failed: ' + e.message;
    return base;
  }
  var fixture = readFixture(d);
  if (!fixture.ok) {
    base.state = 'manifest-only';
    base.channels = spec.channels.length;
    base.reason = fixture.reason;
    return base;
  }
  var channels = spec.channels.map(function (c) { return channelAudit(c, fixture.doc.rows); });
  var r7 = channels.filter(function (c) { return c.recordedField === 'r7'; });
  var legacy = channels.filter(function (c) { return !!c.legacyField; });
  var currentReadable = channels.filter(function (c) { return c.currentPresent > 0; });
  var anyReadable = channels.filter(function (c) { return c.readable > 0; });
  return {
    product: d.product,
    snapshot: d.snapshot,
    state: 'replayable',
    rows: fixture.doc.rows.length,
    channelCount: channels.length,
    r7Channels: r7.length,
    r7WithLegacyFallback: r7.filter(function (c) { return !!c.legacyField; }).length,
    legacyDeclaredChannels: legacy.length,
    channelsWithCurrentData: currentReadable.length,
    channelsWithAnyData: anyReadable.length,
    channelsWithoutAnyData: channels.filter(function (c) { return c.readable === 0; }).map(function (c) { return c.key; }),
    channels: channels
  };
}

var result = registry.DOMAINS.map(auditDomain);
var gaps = [];
result.forEach(function (domain) {
  if (domain.state !== 'replayable') return;
  domain.channels.forEach(function (channel) {
    if (channel.sourceMatches <= channel.readable) return;
    var kind;
    if (channel.recordedField === 'r7' && !channel.legacyField) {
      kind = 'r7-history-without-fallback';
    } else if (channel.recordedField === 'r7' && channel.legacyField) {
      kind = 'mixed-era-partial';
    } else {
      kind = 'current-field-missing';
    }
    gaps.push({
      id: 'RECORDED_FIELD_GAP:' + domain.snapshot + ':' + channel.key,
      domain: domain.product,
      snapshot: domain.snapshot,
      channel: channel.key,
      source: channel.name,
      recordedField: channel.recordedField,
      legacyField: channel.legacyField,
      units: channel.units,
      legacyUnits: channel.legacyUnits,
      gapKind: kind,
      rows: domain.rows,
      sourceMatches: channel.sourceMatches,
      currentPresent: channel.currentPresent,
      legacyPresent: channel.legacyPresent,
      readable: channel.readable,
      status: 'open',
      requiredAction: 'Re-open the recorder/source contract. Resolve by repairing the source or recorder, or by adding a separately reviewed fallback with explicit units and cadence; otherwise record an explicit abstention. Never substitute a different quantity silently.',
      priority: kind === 'r7-history-without-fallback' ? 1 : 2
    });
  });
});
var summary = {
  totalDomains: result.length,
  replayable: result.filter(function (r) { return r.state === 'replayable'; }).length,
  manifestOnly: result.filter(function (r) { return r.state === 'manifest-only'; }).length,
  unavailable: result.filter(function (r) { return r.state === 'unavailable'; }).length,
  r7Channels: result.reduce(function (n, r) { return n + (r.r7Channels || 0); }, 0),
  r7WithLegacyFallback: result.reduce(function (n, r) { return n + (r.r7WithLegacyFallback || 0); }, 0),
  r7WithoutLegacyFallback: result.reduce(function (n, r) {
    return n + Math.max(0, (r.r7Channels || 0) - (r.r7WithLegacyFallback || 0));
  }, 0),
  channelsWithReplayGaps: gaps.length
};

if (process.argv.indexOf('--write-queue') !== -1) {
  var queuePath = path.join(__dirname, '..', 'assets', 'data', 'deep', 'recorded-field-coverage-queue.json');
  var queue = {
    generatedAt: new Date().toISOString(),
    readOnlyAudit: true,
    builtFrom: [
      'brain-v2/bind/registry.js',
      'brain-v2/bind/*.js',
      'brain-v2/fixtures/*-recorder.json'
    ],
    note: 'Open replayability tasks only. No fallback, value, diagnosis, stress, or activation is created by this queue.',
    totalTasks: gaps.length,
    byGapKind: gaps.reduce(function (counts, task) {
      counts[task.gapKind] = (counts[task.gapKind] || 0) + 1;
      return counts;
    }, {}),
    tasks: gaps
  };
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n');
  console.log('wrote ' + queuePath + ' (' + gaps.length + ' open replayability tasks)');
}

if (process.argv.indexOf('--json') !== -1) {
  process.stdout.write(JSON.stringify({ summary: summary, domains: result }, null, 2) + '\n');
} else {
  console.log('Recorded-field coverage audit (read-only)');
  console.log('domains: ' + summary.totalDomains +
    ' replayable=' + summary.replayable +
    ' manifest-only=' + summary.manifestOnly +
    ' unavailable=' + summary.unavailable);
  console.log('r7 channels: ' + summary.r7Channels +
    ' with legacy fallback=' + summary.r7WithLegacyFallback +
    ' without fallback=' + summary.r7WithoutLegacyFallback);
  result.forEach(function (r) {
    if (r.state !== 'replayable') {
      console.log(r.product + ' [' + r.snapshot + '] ' + r.state + ': ' + r.reason);
      return;
    }
    console.log(r.product + ' [' + r.snapshot + '] rows=' + r.rows +
      ' channels=' + r.channels.length +
      ' current=' + r.channelsWithCurrentData + '/' + r.channels.length +
      ' any=' + r.channelsWithAnyData + '/' + r.channels.length +
      ' r7=' + r.r7Channels + '/' + r.channels.length +
      ' fallback=' + r.r7WithLegacyFallback);
    r.channels.filter(function (c) { return c.unreadableLegacy || c.readable === 0; })
      .forEach(function (c) {
        console.log('  ' + c.key + ': matches=' + c.sourceMatches +
          ' current=' + c.currentPresent + ' legacy=' + c.legacyPresent +
          ' recorded=' + c.recordedField +
          (c.legacyField ? ' legacyField=' + c.legacyField : ' NO_LEGACY_FALLBACK') +
          (c.readable === 0 ? ' UNREADABLE' : ''));
      });
  });
}
