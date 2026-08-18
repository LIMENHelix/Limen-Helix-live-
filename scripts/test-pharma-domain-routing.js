#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'assets', 'data');
const EXPECTED = new Map([
  ['901832', 'astrazeneca'],
  ['10456', 'baxter_international'],
  ['1776985', 'biontech'],
  ['882095', 'gilead_sciences'],
  ['730272', 'repligen'],
]);

const normCik = (value) => String(value ?? '').replace(/^0+/, '') || '0';
const cb = JSON.parse(fs.readFileSync(path.join(DATA, 'command-board-data.json'), 'utf8'));
const operatorRefs = JSON.parse(fs.readFileSync(path.join(DATA, 'operator-references.json'), 'utf8'));
const cbByCik = new Map((cb.companies || []).map((row) => [normCik(row.c), row]));
const refsByCik = new Map((operatorRefs.companies || []).map((row) => [normCik(row.cik), row]));

let assertions = 0;
for (const [cik, slug] of EXPECTED) {
  const portal = JSON.parse(fs.readFileSync(path.join(DATA, 'companies', `${slug}.json`), 'utf8'));
  assert.strictEqual(portal.domainId, 'medicine', `${slug} portal domain`);
  assertions++;
  assert.strictEqual(cbByCik.get(cik)?.d, 'medicine', `${slug} Command Board domain`);
  assertions++;
  if (refsByCik.has(cik)) {
    assert.strictEqual(refsByCik.get(cik).domain, 'medicine', `${slug} operator-reference domain`);
    assertions++;
  }
}

console.log(`pharma domain routing: ${assertions}/${assertions} assertions passed`);
