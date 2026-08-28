/**
 * Test each handler require to find which one is broken
 */

const fs = require('fs');
const path = require('path');

const handlersToTest = [
  'admin-auth',
  'sales',
  'leadgen',
  'relay-margin',
  'relay-autonomous-scraper',
  'relay-autonomous-control',
  'wave-radar',
  'music-feed',
  'capital-engine',
  'energy-agent',
  'domain-agent',
  'master-agent',
  'stripe-webhook',
  'finance-preview',
  'brain-cognition',
];

console.log('Testing handler requires...\n');

let passed = 0;
let failed = 0;
const failedHandlers = [];

handlersToTest.forEach(name => {
  try {
    const handler = require(`./handlers/${name}`);
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}\n`);
    failed++;
    failedHandlers.push({ name, error: e.message });
  }
});

console.log(`\n========================================`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failedHandlers.length > 0) {
  console.log(`\nFailed handlers:`);
  failedHandlers.forEach(h => {
    console.log(`  - ${h.name}: ${h.error}`);
  });
}
