# Sites We Can Scrape / Fetch for Information

Reference for public data sources Claude Code / the LIMEN backend can pull, ordered
by legal safety. Compiled 2026-07-12.

**Read first (the honest ceiling):**
- **Green** = explicitly open data or an official public API/bulk-download. Pull
  freely; respect rate limits. This is where the durable desks should source from.
- **Yellow** = data is public but the site's ToS restricts automated access. Use
  the **official API** if one exists; do not raw-scrape at scale. Personal/low-volume
  fetch is usually tolerated, commercial resale often is not.
- **Not listed on purpose:** anything that requires defeating a login, CAPTCHA,
  paywall, or explicit anti-bot block. That crosses from "scraping public data" into
  circumvention. If a source needs that, it does not belong in a product.
- **The moat is curation, not the raw feed.** Every source below is public; the
  defensible product is the ranking/synthesis on top (own-nothing middleman thesis),
  which is also what keeps you clear of most redistribution clauses.
- Always send a real User-Agent, obey `robots.txt`, cache to avoid re-hammering, and
  prefer bulk/API endpoints over HTML scraping.

Legend: 🟢 green (open/API) · 🟡 yellow (ToS-restricted, use official API) ·
✅ already used in this repo.

---

## 1. Financial / corporate filings 🟢

The kernel + P3 backbone. No key, fully open, generous limits.

| Source | Endpoint | Notes |
|---|---|---|
| **SEC EDGAR** ✅ | `data.sec.gov` (submissions + XBRL frames), `efts.sec.gov` (full-text search), bulk `.zip` | Public domain. Fair-access rule: ≤10 req/s, declare a User-Agent with contact email. The Finance/EDGAR desk core. |
| **SEC full-text search** ✅ | `efts.sec.gov/LATEST/search-index` | Search filing bodies (8-K bankruptcy language, etc.). |
| **Yahoo Finance (unofficial)** ✅ | `query1.finance.yahoo.com/v8/...` | 🟡 No official license; widely used, can break/ratelimit. Fine for signal, not a contract-grade source. |
| **Frankfurter / ECB** 🟢 | `frankfurter.app` | Free FX rates, no key. |

---

## 2. Government open data (US) 🟢

Public-domain by default. The distress/regulation desks live here.

| Source | Endpoint | Domain |
|---|---|---|
| **USAspending.gov** ✅ | REST API | Federal contracts/grants/spending. |
| **Data.gov** | catalog + agency APIs | Cross-domain dataset index. |
| **openFDA** ✅ | `api.fda.gov` | Drug/device adverse events, recalls (Medicine desk). Free, key optional. |
| **ClinicalTrials.gov v2** ✅ | `clinicaltrials.gov/api/v2` | Trials (autism/medicine). |
| **CourtListener / RECAP** 🟢 | `courtlistener.com/api/rest/v4` | Court opinions + PACER docket mirror (Law). Free key raises limits. |
| **Federal Register** | `federalregister.gov/api/v1` | Rules/notices, no key. |
| **GovInfo** | `api.govinfo.gov` | Bills, CFR, congressional record. |
| **FCC / FEC / FTC** | per-agency APIs | Communication / campaign finance / enforcement. |
| **State WARN notices** ✅ | per-state DOL pages | 🟡 mostly HTML; layoffs (Industry desk). Scrape politely, structure varies by state. |
| **NOAA / NWS** | `api.weather.gov` | Weather, no key (key raises climate-data limits). |
| **USGS** | earthquake/water APIs | Environment. |

---

## 3. Economic / labor / demographic 🟢

| Source | Endpoint | Notes |
|---|---|---|
| **FRED** ✅ | `api.stlouisfed.org/fred` | Macro series (key, free). |
| **BLS** | `api.bls.gov/publicAPI/v2` | Employment/CPI (key optional). |
| **Census** ✅ | `api.census.gov` | Demographics (key, free). |
| **World Bank** 🟢 | `api.worldbank.org/v2` | Global indicators, no key. |
| **OECD / Eurostat / IMF** 🟢 | public data APIs | International macro. |
| **BEA** | `apps.bea.gov/api` | GDP/income (key, free). |

---

## 4. Scientific / medical literature 🟢

| Source | Endpoint | Notes |
|---|---|---|
| **PubMed / NCBI E-utilities** ✅ | `eutils.ncbi.nlm.nih.gov` | Key raises to 10 req/s. |
| **Europe PMC** ✅ | `ebi.ac.uk/europepmc/webservices/rest` | Full-text + open-access, no key. |
| **openAlex** 🟢 | `api.openalex.org` | 250M works, no key, polite pool with email. Best open scholarly graph. |
| **Semantic Scholar** 🟢 | `api.semanticscholar.org` | Free key on request. |
| **Crossref** 🟢 | `api.crossref.org` | DOI metadata, no key. |
| **MedlinePlus / CDC / ICD-11** ✅ | public APIs | Verified free for the autism/ADHD work. |
| **arXiv / bioRxiv** 🟢 | `export.arxiv.org/api` | Preprints, no key. |

---

## 5. Company / entity / people (public records) 🟢🟡

| Source | Endpoint | Notes |
|---|---|---|
| **OpenCorporates** 🟢 | `api.opencorporates.com` | 200M+ companies. Free tier + key. Attribution required. |
| **GLEIF (LEI)** 🟢 | `api.gleif.org` | Legal-entity identifiers, no key. |
| **Wikidata / Wikipedia** 🟢 | `query.wikidata.org/sparql`, REST API | CC0 structured facts. Ideal for entity resolution. |
| **County cadastral / assessor sites** ✅ | per-county | 🟡 the RE owner-enrichment layer; format varies wildly, scrape politely. |

---

## 6. Web-scale search + open corpora 🟢

| Source | How | Notes |
|---|---|---|
| **Claude Code WebSearch / WebFetch** ✅ | built-in tools | The primary general-purpose fetch path. Respects robots by design. |
| **Common Crawl** 🟢 | S3 `commoncrawl.org` | Petabyte open web crawl (WARC/WAT/WET). For bulk mining without hitting live sites. |
| **Wikimedia dumps** 🟢 | `dumps.wikimedia.org` | Full-corpus offline. |
| **GDELT** 🟢 | `api.gdeltproject.org` | Global news events/tone, no key. Strong for cross-domain signal. |
| **Hacker News (Firebase)** 🟢 | `hacker-news.firebaseio.com/v0` | Tech sentiment, no key. |
| **GitHub REST/GraphQL** ✅ | `api.github.com` | Repo/org/dev signal (token raises limits). |

---

## 7. Layoffs / distress trackers 🟡

| Source | Notes |
|---|---|
| **layoffs.fyi** ✅ | 🟡 Airtable-backed; used by the Industry desk. Public but no license — treat as a signal, attribute, don't rebrand as your own dataset. |
| **WARN Tracker aggregators** | 🟡 cross-check against the primary state DOL pages (green). |

---

## Platforms that are NOT free scrape targets (use the paid/official API instead)

These block bots and their ToS forbid scraping. If you need them, go through the
keyed API in `API_KEY_COMPANIES.md`, accept the limits, or skip:

- **Amazon** storefront — use PA-API (gated), never scrape product pages.
- **YouTube / Google Search / Maps** — use the Data/Places APIs.
- **LinkedIn** — actively litigates scraping; no green path.
- **X/Twitter, Reddit, TikTok, Instagram/Facebook** — paid APIs only now; scraping
  violates ToS and is blocked.
- **Zillow / Redfin / MLS** — ToS forbid scraping; use licensed data (BatchData is
  already wired for the RE desks).
- **Glassdoor, Crunchbase, PitchBook, Bloomberg** — paywalled/licensed.

---

## Rule of thumb

Green sources = build durable product on them. Yellow = signal only, always
attribute, prefer the official API. Anything requiring circumvention = out of scope.
The value you sell is the **ranking function over public data**, never the raw feed.
