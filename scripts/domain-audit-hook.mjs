#!/usr/bin/env node
// PostToolUse hook wrapper: reads the hook JSON on stdin, and regenerates the
// domain structure audit only when an assets/js/<domain>-*.js engine file changed.
// Silent + non-blocking by design: any problem exits 0 so it never disrupts editing.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOMAINS = 'agriculture|communication|culture|defense|economy|education|energy|environment|finance|governance|industry|infrastructure|intelligence|law|medicine|population|religion|science|technology|trade';
// only true per-domain engine files: assets/js/<domain>-<role>.js (path normalized to /)
const RE = new RegExp(`assets/js/(${DOMAINS})-[a-z0-9-]*\\.js$`, 'i');

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let file = '';
  try {
    const j = JSON.parse(raw || '{}');
    file = j?.tool_input?.file_path || j?.tool_response?.filePath || '';
  } catch { return; }

  if (!RE.test(String(file).replace(/\\/g, '/'))) return;

  // import() needs a file:// URL on Windows, not a bare C:\ path
  await import(pathToFileURL(path.join(HERE, 'domain-structure-audit.mjs')).href);
}

main().catch(err => { process.stderr.write(`[domain-audit-hook] ${err?.message || err}\n`); })
  .finally(() => process.exit(0));
