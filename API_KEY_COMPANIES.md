# Third-Party Companies That Use API Keys

Reference for keyed APIs usable from Claude Code / the LIMEN backend, ordered by
revenue relevance. Compiled 2026-07-12.

**Read first (the honest ceiling):**
- "Revenue" APIs split two ways: (a) **payout APIs** that pay you (affiliate,
  ad-share, POD, payments) and (b) **data APIs** you resell as curated
  intelligence (own-nothing middleman model). Both need a key.
- Payout APIs are **gated behind an approved account plus real activity.** Amazon
  PA-API revokes access if you do not make sales; affiliate networks require an
  approved publisher account per merchant. A key alone is not access.
- Every API here has a **Terms of Service that restricts how you store, cache,
  and redisplay the data.** Reselling raw feed is usually prohibited; selling
  *curation/analysis* on top is the defensible line (matches the own-nothing
  thesis). Verify per-provider before productizing.
- Pricing/tier notes are **approximate as of the Jan 2026 cutoff — verify current
  terms before you build against them.**

Legend: ✅ = key already referenced in this repo · ⬜ = available, not yet wired ·
🔒 = gated behind approved account/activity.

---

## 1. Direct-payout: affiliate, commerce, print-on-demand

These pay you money directly.

| Company | Env var | Free? | Revenue mechanism | Notes |
|---|---|---|---|---|
| **Amazon Product Advertising API (PA-API 5.0)** ✅🔒 | `AMAZON_PAAPI_KEY` (+ secret + associate tag) | Free key | Affiliate commission on referred sales | Must be an approved Amazon Associate; **access revoked without qualifying sales in ~180d**. Rate-limited to 1 req/s until sales ramp. Product data cannot be stored >24h per ToS. |
| **Commission Junction (CJ Affiliate)** ✅🔒 | `CJ_API_KEY` | Free | Affiliate commission across thousands of merchants | Per-merchant approval. Product feed + link APIs. |
| **ClickBank** ✅🔒 | `CLICKBANK_API_KEY`, `CLICKBANK_CLERK_KEY` | Free | Affiliate on digital products (high commission %) | Marketplace API + analytics API. |
| **Printful** ✅ | `PRINTFUL_API_KEY` | Free | POD margin (you set retail over base cost) | Order + catalog + mockup API. Real fulfillment; needs product + storefront. |
| **eBay Partner Network / Browse API** ⬜🔒 | `EBAY_APP_ID` | Free tier | Affiliate commission | Browse/Buy APIs; EPN approval needed for payout. |
| **Walmart / Impact / Awin / Rakuten / ShareASale** ⬜🔒 | `IMPACT_API_KEY`, `AWIN_API_KEY`, `RAKUTEN_API_KEY`, `SHAREASALE_API_KEY` | Free | Affiliate networks (per-merchant) | Each is a network aggregating many merchants; one integration = many programs. |
| **Etsy Open API** ⬜🔒 | `ETSY_API_KEY` | Free tier | Affiliate (via Awin) or your own shop | Listing/shop APIs. |
| **Shopify Admin/Partner API** ⬜ | `SHOPIFY_API_KEY` | Paid platform | Your own store ops + app revenue | For running a storefront, not affiliate. |
| **Gumroad** ⬜ | `GUMROAD_API_KEY` | Free | Sell your own digital products | Simple sale API; good for info-products (fits L1 capital rung). |

**YouTube note:** the **YouTube Data API v3** (`YOUTUBE_API_KEY`, a Google Cloud
key, free quota 10k units/day) gives you *metadata* — video stats, channel data,
search. It does **not** pay you. Direct YouTube revenue = AdSense/YPP, which has
**no public payout API**; you read earnings via the AdSense/YouTube Analytics API
(OAuth, your own channel only). So YouTube is a **research/monetization-signal**
source, not a payout API.

---

## 2. Payments + payout infrastructure

| Company | Env var | Notes |
|---|---|---|
| **Stripe** ✅ | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Charges, subscriptions, Connect. Live on AllAccessKC per system memory. The actual money rail. |
| **PayPal / Braintree** ⬜ | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | Alt checkout. |

---

## 3. AI / LLM providers (cost centers, not revenue — but power the product)

| Company | Env var | Status |
|---|---|---|
| **Anthropic (Claude)** ✅ | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Auto-spend **killed** (TOKENS_PER_TICK=0) per memory; re-enable deliberately. |
| **OpenAI** ✅ | `OPENAI_API_KEY`, `OPENAI_API_KEY_D3B` | Wired. |
| **xAI (Grok)** ✅ | `XAI_API_KEY`, `GROK_API_KEY`, `XAI_API_KEY_D3C` | Wired. |

---

## 4. Financial + market data (resell as curated intelligence)

These are the backbone of the P3/kernel desks. Free tiers are generous.

| Company | Env var | Free tier | Use |
|---|---|---|---|
| **Alpha Vantage** ✅ | `ALPHA_VANTAGE_API_KEY` | 25 req/day free | Equities, FX, fundamentals. |
| **Finnhub** ✅ | `FINNHUB_API_KEY` | 60 req/min free | Quotes, filings, earnings. |
| **FRED (St. Louis Fed)** ✅ | `FRED_API_KEY` | Free, unlimited | Macro/economic series. Public-domain data. |
| **Alpaca** ✅ | `ALPACA_API_KEY_ID` / `_SECRET` | Free paper + live | Brokerage + market data (you can actually trade). |
| **Polygon.io** ⬜ | `POLYGON_API_KEY` | Free tier (5 req/min) | Deep market data. |
| **Financial Modeling Prep** ⬜ | `FMP_API_KEY` | 250 req/day free | Fundamentals, ratios, valuation multiples (relevant to `build-valuation-longs`). |
| **Tiingo / Twelve Data** ⬜ | `TIINGO_API_KEY`, `TWELVE_DATA_API_KEY` | Free tiers | EOD + fundamentals. |

---

## 5. News, web search, enrichment (feed the desks + AI grounding)

| Company | Env var | Free tier | Use |
|---|---|---|---|
| **Tavily** ✅ | `TAVILY_API_KEY` | 1k searches/mo free | AI-optimized web search. |
| **NewsAPI** ✅ | `NEWS_API_KEY` | Dev tier free | Headlines (non-commercial on free tier — check ToS). |
| **Event Registry** ✅ | `EVENT_REGISTRY_API_KEY` | Limited free | Global news events, entity extraction. |
| **Google Places** ✅ | `GOOGLE_PLACES_API_KEY` | $ per call (`GOOGLE_PLACES_COST_CENTS` tracks) | Local business data. Paid. |
| **Last.fm** ✅ | `LASTFM_API_KEY` | Free | Music metadata (Culture/DMAD front). |

---

## 6. Deal-engine enrichment (real estate / direct mail — the broker desks)

| Company | Env var | Notes |
|---|---|---|
| **BatchData** ✅ | `BATCHDATA_API_KEY` | Property + owner data, skip-trace. Paid per lookup. |
| **Skip-trace provider** ✅ | `SKIPTRACE_KEY`, `SKIPTRACE_URL`, `SKIPTRACE_AUTH` | Owner contact enrichment (makes RE deals mailable). |
| **Lob** ✅ | `LOB_API_KEY` | Programmatic direct mail (the mailer-first cadence). Paid per piece. |
| **Resend** ✅ | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email. Note the bare-domain gotcha fixed in CRM. |
| **Beehiiv** ✅ | `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID` | Newsletter platform (has its own ad/referral revenue). |
| **Web3Forms** ✅ | `WEB3FORMS_ACCESS_KEY` | Free form-to-email (lead capture). |

---

## 7. Government / scientific keyed APIs (free — curation layer)

All free with a key; data is public-domain but the key raises rate limits. These
straddle into the scrape file — listed here because they *require* a key.

| Company | Env var | Domain |
|---|---|---|
| **EIA** ✅ | `EIA_API_KEY` | Energy (retiring-generators desk). |
| **US Census** ✅ | `CENSUS_API_KEY` | Demographics. |
| **USDA** ✅ | `USDA_API_KEY` | Agriculture. |
| **NOAA** ✅ | `NOAA_TOKEN` | Weather/climate. |
| **AirNow** ✅ | `AIRNOW_API_KEY` | Air quality. |
| **Congress.gov** ✅ | `CONGRESS_API_KEY` | Legislation. |
| **Regulations.gov** ✅ | `REGULATIONS_GOV_API_KEY` | Federal rulemaking. |
| **PubMed / NCBI** ✅ | `PUBMED_API_KEY` | Medicine (raises rate to 10 req/s). |
| **USPTO** ✅ | `USPTO_API_KEY` | Patents (lane retired, key still present). |
| **UN Population** ✅ | `UN_POPULATION_API_KEY` | Population. |
| **ACLED** ✅ | `ACLED_API_KEY`, `ACLED_EMAIL` | Armed-conflict events (Defense). |
| **BLS** ⬜ | `BLS_API_KEY` | Labor statistics (free, raises limit). |

---

## Infrastructure (not third-party revenue, but keyed)

`UPSTASH_REDIS_REST_URL/TOKEN`, `POSTGRES_URL`, `KV_REST_API_*`, `GITHUB_TOKEN`,
`CRON_SECRET`, plus the internal `*_ADMIN_KEY` gates. See SYSTEM_MAP for these.

---

## Fastest revenue-relevant adds (not yet wired)

1. **Affiliate network breadth** — Impact / Awin / ShareASale one-integration-many-
   merchants, to widen beyond Amazon/CJ/ClickBank already present.
2. **YouTube Data API** — free monetization-signal source for the Culture front.
3. **FMP** — valuation multiples to feed `build-valuation-longs.mjs` directly.
