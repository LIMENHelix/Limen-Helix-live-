#!/usr/bin/env node
'use strict';

/* Regenerate the deployable Finance identity projection from the full portal
   registry. Only exact SEC CIK, canonical slug, name, and public ticker cross
   the boundary; no fuzzy or title-derived company inference is admitted. */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets', 'data', 'company-registry.json');
const targetPath = path.join(root, 'assets', 'data', 'finance-company-identities.json');
const raw = fs.readFileSync(sourcePath, 'utf8');
const canonicalSource = raw.replace(/\r\n/g, '\n');
const source = JSON.parse(raw);
const byCik = {};

for (const cik of Object.keys(source.byCik || {}).sort()) {
  const company = source.byCik[cik];
  if (!company || !company.slug || !company.ticker || company.ticker === 'PRIVATE') continue;
  byCik[cik] = { slug: company.slug, name: company.name || null, ticker: company.ticker };
}

const output = {
  schemaVersion: 'finance-company-identities/1.0',
  generatedAt: new Date().toISOString(),
  source: {
    path: 'assets/data/company-registry.json',
    /* Git checks out LF on Linux and CRLF on Windows. Provenance identifies the
       tracked content, not the workstation's line-ending representation. */
    sha256: crypto.createHash('sha256').update(canonicalSource, 'utf8').digest('hex')
  },
  count: Object.keys(byCik).length,
  byCik
};

fs.writeFileSync(targetPath, JSON.stringify(output, null, 2) + '\n');
console.log('wrote ' + output.count + ' exact public Finance identities to ' + targetPath);
