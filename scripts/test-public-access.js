#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = cp.execFileSync(
  'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.html'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
).split('\0').filter(Boolean);

assert(html.length > 3000, 'precondition: expected the generated portal corpus');

const oldInlineGate = "sessionStorage.getItem('limen_access')!=='granted'";
const redirectGate = "window.location.replace('/?return='";
const keypadGate = /(?:localStorage\.getItem\('limen_gate'\)|id=["'](?:directGate|codeGate)["'])/;
const offenders = [];

for (const rel of html) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (text.includes(oldInlineGate) || text.includes(redirectGate) || keypadGate.test(text)) offenders.push(rel);
}

assert.deepStrictEqual(offenders, [], 'no HTML page may redirect through or overlay the retired access gate');

for (const rel of [
  'assets/js/auth-gate.js',
  'assets/js/gate-master.js',
  'assets/js/gate-finance.js',
  'assets/js/gate-infrastructure.js'
]) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert(!text.includes(redirectGate), rel + ' must not redirect a page');
}

const topbar = fs.readFileSync(path.join(ROOT, 'assets/js/limen-topbar.js'), 'utf8');
assert(!topbar.includes("sessionStorage.getItem('limen_access')"), 'topbar navigation must not depend on access state');
assert(topbar.includes("menu.setAttribute('role', 'menu')"), 'public navigation menu still renders');

for (const rel of ['law_portal.html', 'company-portal.html', 'helix-report.html', 'business.html', 'provider-portal.html']) {
  assert(fs.existsSync(path.join(ROOT, rel)), rel + ' exists');
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert(!text.includes(oldInlineGate), rel + ' is directly viewable');
  assert(!keypadGate.test(text), rel + ' has no access-code overlay');
}

// Removing the presentation gate must not weaken actual protected powers.
const shadow = fs.readFileSync(path.join(ROOT, 'handlers/brain-shadow.js'), 'utf8');
assert(shadow.includes('BRAIN_SHADOW_TOKEN'), 'brain operator read remains token-gated');
assert(shadow.includes('CRON_SECRET'), 'brain execution remains cron-secret-gated');

const adminAuth = fs.readFileSync(path.join(ROOT, 'handlers/admin-auth.js'), 'utf8');
assert(adminAuth.includes('ADMIN_MASTER'), 'admin credential validation remains server-side');

for (const rel of [
  'assets/js/gate-master.js',
  'assets/js/gate-finance.js',
  'assets/js/gate-infrastructure.js'
]) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert(text.includes('var GATED ='), rel + ' still scopes protected API calls');
  assert(text.includes('window.fetch = function'), rel + ' still supplies credentials at the action boundary');
}

console.log('public access gate retired across ' + html.length + ' HTML files; protected action boundaries preserved');
