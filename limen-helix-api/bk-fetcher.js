/**
 * bk-fetcher.js — Bankruptcy Dataset Builder
 *
 * Collects ~500 real Chapter 11 bankruptcies from SEC EDGAR,
 * pulls their pre-bankruptcy quarterly financials (XBRL) and
 * FRED macro context, then saves everything as bk-dataset.json.
 *
 * Usage:
 *   FRED_API_KEY=your_key node bk-fetcher.js
 */

import fetch from "node-fetch";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TARGET_CIKS = 500;
const PAGE_SIZE = 100;
const SEC_DELAY_MS = 125; // ~8 req/sec
const SEC_UA = "LimenHelix limenhelix@gmail.com";
const FRED_KEY = process.env.FRED_API_KEY;

if (!FRED_KEY) {
  console.error("Error: FRED_API_KEY environment variable is required.");
  process.exit(1);
}

const FRED_SERIES = ["T10Y2Y", "STLFSI4", "BAMLH0A0HYM2"];

// XBRL tag mapping — mirrors api/phase_engine.py TAG_MAP
const TAG_MAP = {
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "InterestAndDividendIncomeOperating",
    "InterestIncomeExpenseNet",
    "NoninterestIncome",
  ],
  ocf: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsAndShortTermInvestments",
    "Cash",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ],
  debt: [
    "LongTermDebtNoncurrent",
    "LongTermDebt",
    "LongTermDebtAndCapitalLeaseObligations",
    "DebtCurrent",
    "ShortTermBorrowings",
    "LongTermDebtCurrent",
    "CurrentPortionOfLongTermDebt",
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function padCik(cik) {
  return String(cik).padStart(10, "0");
}

async function secFetch(url) {
  await sleep(SEC_DELAY_MS);
  const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`SEC ${res.status} for ${url}`);
  return res.json();
}

async function fredFetch(url) {
  const res = await fetch(url, { headers: { "User-Agent": SEC_UA } });
  if (!res.ok) throw new Error(`FRED ${res.status} for ${url}`);
  return res.json();
}

/** Find the observation closest to `target` (YYYY-MM-DD) in a sorted array. */
function closestObservation(observations, target) {
  const t = new Date(target).getTime();
  let best = null;
  let bestDist = Infinity;
  for (const obs of observations) {
    if (obs.value === ".") continue; // FRED uses "." for missing
    const d = Math.abs(new Date(obs.date).getTime() - t);
    if (d < bestDist) {
      bestDist = d;
      best = obs;
    }
  }
  return best ? parseFloat(best.value) : null;
}

// ---------------------------------------------------------------------------
// Step 1 — Collect Bankruptcy CIKs from EDGAR full-text search
// ---------------------------------------------------------------------------

async function collectBankruptcyCIKs() {
  console.log("=== Step 1: Collecting bankruptcy CIKs from EDGAR EFTS ===");

  // cik (stripped of leading zeros) → { fileDate, displayName }
  const cikMap = new Map();
  let from = 0;

  while (cikMap.size < TARGET_CIKS) {
    const url =
      `https://efts.sec.gov/LATEST/search-index?` +
      `q=%22chapter+11%22&forms=8-K` +
      `&dateRange=custom&startdt=2000-01-01&enddt=2023-12-31` +
      `&from=${from}`;

    let data;
    try {
      data = await secFetch(url);
    } catch (e) {
      console.warn(`  EFTS page error at from=${from}: ${e.message}`);
      break;
    }

    const hits = data?.hits?.hits;
    if (!hits || hits.length === 0) {
      console.log(`  No more hits at from=${from}. Total unique CIKs: ${cikMap.size}`);
      break;
    }

    for (const hit of hits) {
      const src = hit._source;
      if (!src) continue;

      // EFTS schema: ciks is an array, file_date is YYYY-MM-DD,
      // display_names is an array of "Company Name (CIK ...)"
      const cikArr = src.ciks || [];
      const fileDate = src.file_date;
      if (cikArr.length === 0 || !fileDate) continue;

      // Use last CIK in array (primary filer), strip leading zeros
      const cik = cikArr[cikArr.length - 1].replace(/^0+/, "");
      if (!cik) continue;

      // Extract display name (strip trailing "(CIK ...)" if present)
      const names = src.display_names || [];
      const rawName = names[names.length - 1] || "";
      const displayName = rawName.replace(/\s*\(CIK.*$/, "").trim();

      if (!cikMap.has(cik)) {
        cikMap.set(cik, { fileDate, displayName });
      } else {
        // Keep earliest bankruptcy date
        if (fileDate < cikMap.get(cik).fileDate) {
          cikMap.set(cik, { fileDate, displayName: displayName || cikMap.get(cik).displayName });
        }
      }
    }

    console.log(`  Page from=${from} → ${hits.length} hits, ${cikMap.size} unique CIKs so far`);
    from += PAGE_SIZE;

    if (from > 10000 && cikMap.size < 50) {
      console.warn("  Very few CIKs found after 10k results — EFTS schema may have changed.");
      break;
    }
  }

  console.log(`  Collected ${cikMap.size} unique bankruptcy CIKs\n`);
  return cikMap; // Map<cik, { fileDate, displayName }>
}

// ---------------------------------------------------------------------------
// Step 2 — Fetch 10-Q filing history for each CIK
// ---------------------------------------------------------------------------

async function fetch10QFilings(cik, bankruptcyDate) {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;

  let data;
  try {
    data = await secFetch(url);
  } catch {
    return { name: null, quarters: [] };
  }

  const name = data.name || data.entityName || null;

  // Gather all filings: recent + overflow files
  let forms = [];
  let dates = [];
  let accessions = [];

  const recent = data.filings?.recent;
  if (recent) {
    forms = forms.concat(recent.form || []);
    dates = dates.concat(recent.filingDate || []);
    accessions = accessions.concat(recent.accessionNumber || []);
  }

  // Load overflow filing files if present
  const overflowFiles = data.filings?.files || [];
  for (const f of overflowFiles) {
    try {
      const overflow = await secFetch(`https://data.sec.gov/submissions/${f.name}`);
      forms = forms.concat(overflow.form || []);
      dates = dates.concat(overflow.filingDate || []);
      accessions = accessions.concat(overflow.accessionNumber || []);
    } catch {
      // skip overflow errors
    }
  }

  // Filter for 10-Q before bankruptcy date, take last 4
  const quarters = [];
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "10-Q" && dates[i] < bankruptcyDate) {
      quarters.push({ filingDate: dates[i], accession: accessions[i] });
    }
  }

  // Sort descending by date, take 4 most recent
  quarters.sort((a, b) => (b.filingDate > a.filingDate ? 1 : -1));
  return { name, quarters: quarters.slice(0, 4) };
}

// ---------------------------------------------------------------------------
// Step 3 — Fetch XBRL financial data from companyfacts
// ---------------------------------------------------------------------------

function extractQuarterlyValue(facts, tagList, filingDate) {
  if (!facts) return null;
  const usGaap = facts["us-gaap"] || {};

  for (const tag of tagList) {
    const concept = usGaap[tag];
    if (!concept) continue;
    // Try USD units first, then plain number
    const units = concept.units?.USD || concept.units?.["USD/shares"] || [];
    // Find quarterly (10-Q) value closest to the filing date
    let best = null;
    let bestDist = Infinity;
    for (const u of units) {
      if (u.form !== "10-Q") continue;
      const filed = u.filed || u.end;
      if (!filed) continue;
      const dist = Math.abs(new Date(filed).getTime() - new Date(filingDate).getTime());
      if (dist < bestDist) {
        bestDist = dist;
        best = u;
      }
    }
    // Only accept if within ~180 days of filing date
    if (best && bestDist < 180 * 86400000) {
      return best.val;
    }
  }
  return null;
}

async function fetchXBRLData(cik, quarters) {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;

  let data;
  try {
    data = await secFetch(url);
  } catch {
    return null;
  }

  const facts = data.facts;
  if (!facts) return null;

  const results = [];
  for (const q of quarters) {
    results.push({
      filingDate: q.filingDate,
      revenue: extractQuarterlyValue(facts, TAG_MAP.revenue, q.filingDate),
      ocf: extractQuarterlyValue(facts, TAG_MAP.ocf, q.filingDate),
      cash: extractQuarterlyValue(facts, TAG_MAP.cash, q.filingDate),
      debt: extractQuarterlyValue(facts, TAG_MAP.debt, q.filingDate),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Step 4 — Fetch FRED macro context
// ---------------------------------------------------------------------------

// Pre-fetch all FRED series once (2000–2024) so we can look up by date locally
const fredCache = {};

async function prefetchFRED() {
  console.log("=== Step 4 (pre): Fetching FRED macro series ===");
  for (const series of FRED_SERIES) {
    const url =
      `https://api.stlouisfed.org/fred/series/observations?` +
      `series_id=${series}&api_key=${FRED_KEY}&file_type=json` +
      `&observation_start=1999-01-01&observation_end=2024-06-30`;
    try {
      const data = await fredFetch(url);
      fredCache[series] = data.observations || [];
      console.log(`  ${series}: ${fredCache[series].length} observations loaded`);
    } catch (e) {
      console.warn(`  Failed to fetch ${series}: ${e.message}`);
      fredCache[series] = [];
    }
  }
  console.log();
}

function getMacroForDate(filingDate) {
  const macro = {};
  for (const series of FRED_SERIES) {
    macro[series] = closestObservation(fredCache[series] || [], filingDate);
  }
  return macro;
}

// ---------------------------------------------------------------------------
// Step 5 — Main orchestration
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  console.log("Bankruptcy Dataset Fetcher — Starting\n");

  // Step 1
  const cikMap = await collectBankruptcyCIKs();
  if (cikMap.size === 0) {
    console.error("No CIKs collected. Check EDGAR EFTS availability.");
    process.exit(1);
  }

  // Step 4 (pre-fetch FRED so it's ready)
  await prefetchFRED();

  // Steps 2 + 3 — iterate CIKs
  console.log("=== Steps 2–3: Fetching filings + XBRL for each CIK ===\n");
  const companies = [];
  let idx = 0;

  for (const [cik, { fileDate, displayName }] of cikMap) {
    idx++;
    try {
      // Step 2
      const { name, quarters } = await fetch10QFilings(cik, fileDate);
      const companyName = name || displayName || "Unknown";
      if (quarters.length === 0) {
        console.log(`  [${idx}/${cikMap.size}] CIK ${padCik(cik)} — ${companyName} — no 10-Q filings, skipping`);
        continue;
      }

      // Step 3
      const financials = await fetchXBRLData(cik, quarters);
      if (!financials) {
        console.log(`  [${idx}/${cikMap.size}] CIK ${padCik(cik)} — ${companyName} — no XBRL data, skipping`);
        continue;
      }

      // Attach macro context to each quarter
      for (const q of financials) {
        q.macro = getMacroForDate(q.filingDate);
      }

      companies.push({
        cik: padCik(cik),
        name: companyName,
        bankruptcyDate: fileDate,
        quarters: financials,
      });

      const qCount = financials.length;
      console.log(`  [${idx}/${cikMap.size}] CIK ${padCik(cik)} — ${companyName} — ${qCount} quarter(s) found`);
    } catch (e) {
      console.warn(`  [${idx}/${cikMap.size}] CIK ${padCik(cik)} — error: ${e.message}`);
    }
  }

  // Step 5 — save
  const output = {
    meta: {
      generated: new Date().toISOString(),
      count: companies.length,
    },
    companies,
  };

  const writePath = join(__dirname, "bk-dataset.json");
  writeFileSync(writePath, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone. ${companies.length} companies saved to bk-dataset.json (${elapsed} min)`);
}

try {
  await main();
} catch (e) {
  console.error("Fatal error:", e);
  // Attempt partial save
  try {
    writeFileSync(
      join(__dirname, "bk-dataset.json"),
      JSON.stringify({ meta: { generated: new Date().toISOString(), error: e.message }, companies: [] }, null, 2)
    );
    console.log("Partial (empty) dataset saved.");
  } catch {
    // nothing more we can do
  }
  process.exit(1);
}
