#!/usr/bin/env node
'use strict';

/**
 * test-command-board-empty-frontier.js — a valid full rebuild with zero
 * ELIGIBLE_NOW companies must publish an empty board, not leave stale rows.
 *
 * Resume no-ops remain no-ops; invalid frontier input and atomic write failure
 * leave the previous output untouched.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const board = require('../scripts/build-command-board');

const ROOT = path.join(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-cb-empty-'));
const out = path.join(dir, 'feed.json');
const SENTINEL = JSON.stringify({ companies: [{ c: 'old', t: 'OLD' }] });

function frontier(companies) {
  return {
    _universe_total: companies.length,
    _processed_total: companies.length,
    companies
  };
}
function eligible(cik) {
  return { cik, ticker: 'T' + cik, name: 'Co ' + cik, envelope_status: 'ELIGIBLE_NOW' };
}
async function validScore(cik) {
  return {
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true },
    validation_status: 'validated',
    kernel_id: 'limen_backtest.py',
    dominant_phase: 'p4',
    composite_score: 0.5,
    alert: false,
    history_quarters: 40
  };
}
async function noScore() { throw new Error('scorer must not be called'); }

(async function () {
  try {
    // ── Full rebuild, zero eligible: stale output replaced with empty ─────
    fs.writeFileSync(out, SENTINEL);
    const zeroPlan = board.planCommandBoard(
      frontier([{ cik: '1', ticker: 'ONE', name: 'One', envelope_status: 'STALE' }]),
      [], { batch: 0, thing0Migration: true });
    assert.strictEqual(zeroPlan.eligible.length, 0);
    const full = await board.executePlan(zeroPlan, {
      outputPath: out, atomic: false, thing0Migration: true,
      fullRebuild: true, delayMs: 0, scoreFn: noScore
    });
    assert.strictEqual(full.wrote, true, JSON.stringify(full));
    const empty = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepStrictEqual(empty.companies, []);
    assert.strictEqual(empty._total, 0);
    assert.strictEqual(empty._expected, 0);
    assert.strictEqual(empty._scored, 0);
    assert.strictEqual(empty._errors, 0);
    assert.strictEqual(empty._removed, 0);
    assert.ok(empty._generated, 'empty board lacks current metadata');

    // ── Resume with fully current membership: byte-stable no-op ───────────
    fs.writeFileSync(out, SENTINEL);
    const completeRow = {
      c: '1', t: 'T1', n: 'Co 1',
      t0: { qualification_status: 'qualified', permits_thing1_use: true },
      vs: 'validated', kid: 'limen_backtest.py'
    };
    const resumePlan = board.planCommandBoard(
      frontier([eligible('1')]), [completeRow], { batch: 0, thing0Migration: true });
    assert.strictEqual(resumePlan.queue.length, 0);
    assert.strictEqual(resumePlan.removedCount, 0);
    const resume = await board.executePlan(resumePlan, {
      outputPath: out, atomic: false, thing0Migration: true,
      fullRebuild: false, delayMs: 0, scoreFn: noScore
    });
    assert.strictEqual(resume.wrote, false);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), SENTINEL,
      'resume no-op rewrote the output');

    // ── Malformed / incomplete frontier fails before touching output ──────
    fs.writeFileSync(out, SENTINEL);
    assert.throws(function () {
      board.planCommandBoard({ _universe_total: 2, _processed_total: 1, companies: [] }, [], {});
    }, /incomplete/);
    assert.throws(function () {
      board.planCommandBoard({
        _universe_total: 2, _processed_total: 2,
        companies: [eligible('1'), eligible('1')]
      }, [], {});
    }, /duplicate frontier CIK/);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), SENTINEL);

    // ── Atomic write failure preserves the old output ─────────────────────
    fs.writeFileSync(out, SENTINEL);
    const originalRename = fs.renameSync;
    fs.renameSync = function () { throw new Error('rename boom'); };
    try {
      await assert.rejects(board.executePlan(zeroPlan, {
        outputPath: out, atomic: true, thing0Migration: true,
        fullRebuild: true, delayMs: 0, scoreFn: noScore
      }), /rename boom/);
    } finally {
      fs.renameSync = originalRename;
    }
    assert.strictEqual(fs.readFileSync(out, 'utf8'), SENTINEL,
      'atomic failure damaged the previous output');

    // ── Full rebuild with eligible rows still scores and writes ───────────
    fs.writeFileSync(out, SENTINEL);
    const scoringPlan = board.planCommandBoard(
      frontier([eligible('1')]), [], { batch: 0, thing0Migration: true });
    assert.strictEqual(scoringPlan.queue.length, 1);
    const scored = await board.executePlan(scoringPlan, {
      outputPath: out, atomic: true, thing0Migration: true,
      fullRebuild: true, delayMs: 0, scoreFn: validScore
    });
    assert.strictEqual(scored.wrote, true);
    const scoredOut = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(scoredOut._total, 1);
    assert.strictEqual(scoredOut._scored, 1);
    assert.strictEqual(scoredOut.companies[0].c, '1');

    // ── Dry run reports zero rows and writes nothing ──────────────────────
    fs.writeFileSync(out, SENTINEL);
    const logs = [];
    const originalLog = console.log;
    console.log = function () { logs.push(Array.prototype.join.call(arguments, ' ')); };
    let dry;
    try {
      dry = await board.executePlan(zeroPlan, {
        outputPath: out, atomic: false, thing0Migration: true,
        fullRebuild: true, dryRun: true, delayMs: 0, scoreFn: noScore
      });
    } finally {
      console.log = originalLog;
    }
    assert.strictEqual(dry.wrote, false);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), SENTINEL);
    assert.ok(logs.some(function (l) { return /empty board with 0 rows/.test(l); }),
      'dry run did not report the empty result');

    // ── Batch semantics unchanged ─────────────────────────────────────────
    const batchPlan = board.planCommandBoard(
      frontier([eligible('1'), eligible('2')]), [], { batch: 1, thing0Migration: true });
    assert.strictEqual(batchPlan.queue.length, 1);
    assert.strictEqual(batchPlan.order.length, 2);

    console.log('command board empty frontier: full zero-eligible writes empty; resume no-op stable; invalid input and atomic failure preserve output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(function (e) { console.error(e.stack || e); process.exit(1); });
