# LIMEN Helix, Lead Generation and Business-Entity Audit ROUND 3

Read-only follow-up to `PER_DOMAIN_AGENT_ARCHITECTURE_AUDIT.md` (round 1) and `..._R2.md` (round 2). Those mapped the ops/sales/gain/lateral/pruning architecture. This round answers a different, narrower question: where do leads actually come from today, and what does the system already recognize as "a business" per domain. No code was changed. Every claim traces to file:line. Compiled 2026-07-15 by four dedicated read-only agents.

Status legend: CONFIRMED / PARTIAL / ABSENT / UNCLEAR.

---

## 1. Executive summary

The lead machinery is real but **empty by default**, and there is **no business-entity layer above the lead**. Concretely:

- **Lead origination is real, thin, and manual.** Every one of the 20 domains has a public front that can POST an inbound lead, and daily scrapers pull genuine distressed-property and distressed-company candidates. But inbound captures land in a separate keyspace from the sales pipeline, and scraper pools only become leads through a manual, admin-key-gated `action=pull`. No cron automates that crossing. There is no third-party lead-gen vendor (no Apollo/Clearbit/ZoomInfo/Hunter; package.json has three dependencies) and no seed script. So the CRM is populated only by real traffic and real scraped candidates that an operator manually pulls in.
- **Round-2's flagged conflict dissolves.** The "dead lead vs never-starve allocator" tension is a **category confusion, not a runtime conflict**. The allocator distributes outreach volume across *plays* (strategy tuples in `sales:plays`); `dead` is a status on *lead* records (`crm:state`). They share no key, field, or join. Nothing in the code today is in conflict; round-2's warning was correctly forward-looking design advice.
- **Economy is the only live autonomous outreach because of wiring, not data.** There are two separate outreach architectures. Economy runs on a bespoke one (`realauction:deals` to `homestead-automail.js` to Lob physical mail) that exists for no other domain. The shared architecture (leadgen desk to `crm:worklist` to autopilot auto-email) is domain-neutral in its plumbing but structurally inert on every desk lead, because desk leads carry no email address for the email actuator to use.
- **There is no business-entity layer.** No schema binds a domain to its offerings, pricing, customers, and revenue. What looks like a per-domain "company" is a label (name + capital-level + free-text note) with zero commercial data. A "customer" is a single status flag (`enrolled`) plus a revenue integer on the prospect record, and that integer never reaches the payment ledger. Only finance has a real monetization data model, and it is finance-as-system-revenue-node, not a domain business.
- **The single most decision-relevant number is not in the repo.** Live lead counts live only in Redis. Per-domain counts are tracked at runtime and resolvable by one admin-keyed GET. So "which domain has leads behind it" cannot be answered from static code; the exact resolving read is given in section 6.

Bottom line for the "which domain first / build a sales agent" decision: building lead sourcing would not duplicate much (there is almost none), and "build the sales agent" and "build the business layer it feeds" are two separate, largely unstarted projects.

---

## 2. Finding 1, where leads currently originate

Five channels checked; results per channel (CONFIRMED unless noted).

**Channel 1, public web forms to `/api/lead`: CONFIRMED, all 20 domains.** `handlers/lead.js` is the single public lead-creation endpoint: `POST /api/lead` requires email + `consent:true` (`lead.js:102-107`), writes `lead:<id>` + `leads_index` via Upstash with a read-back confirm (`:128-135`), contacts no one. Fronts that POST it: the generic `domain-front.html:1098,1151,1164`, which `vercel.json:30-48` rewrites for **18 domains**; plus `sell-before-auction.html:161` (economy), `fitness.html:559` (population), `culture.html:299` (culture), `coming-soon.html:291`. Energy has its own `/energy` front. So all 20 have an inbound path. **Critical gap:** these `lead:*` records are a separate keyspace from the `leadgen:*` sales pipeline and only enter it via a manual `POST /api/leadgen?action=pull {source:'inbound-form'}` (`leadgen.js:270-279,513`).

**Channel 2, third-party lead-gen / enrichment: PARTIAL.** No vendor lead-gen SDK exists: `package.json` has only `docx`, `hono`, `jsdom`; grep for Apollo/Clearbit/ZoomInfo/Hunter/LinkedIn/PhantomBuster/Instantly/Smartlead/People-Data-Labs returns only data-file false positives (ABSENT, High). What exists, all key-gated: `handlers/skip-trace.js` calls BatchData (`skip-trace.js:20-22`) to enrich phone/email/mailing address onto existing RE deals (enrichment, not origination); `lib/deal-enrich.js` adds free FL/OH/TX cadastral owner data to RE deals (enrichment); `leadgen.js` scrape adapters `google-places` (`GOOGLE_PLACES_API_KEY`, `:282-309`, the one true keyed lead creator), `web-scrape` (free, operator-supplied URL, `:312-332`), `serp` (defined, no pull adapter), `twilio-inbound` (stub, `:82`).

**Channel 3, import/seed/CSV/bulk-load: PARTIAL.** A live manual import exists: `POST /api/leadgen?action=import` accepts leads/csv/text, caps 2000, dedups, key-gated (`leadgen.js:246-265,494-507`). **No automated seed/bulk-load script exists** (ABSENT, High): grep of `scripts/*` for lead/CRM writes found none. The only seeded `sales:companies` data is 8 hardcoded venture stubs (`DEFAULT_COMPANIES`, `leadgen.js:54-63`), which are the operator's own ventures, not prospects. Leads are never synthetic; only sales-funnel *stats* carry sim events (`leadgen.js:236-239`).

**Channel 4, scraping / scheduled-fetch as candidates: CONFIRMED as ranked pools, only 2 wired to convert.** Daily GitHub Actions write distress candidate pools in their own keyspaces: `realauction:deals` (`scripts/realauction-scrape.js:344`), `finance:distress` (via `handlers/finance-distress-ingest.js:25`), `energy:distress` (`handlers/energy-distress-ingest.js:23`), the WARN/industry pool (`handlers/industry-ingest.js`), public-notice. These are ranked lists, not leads. They become `leadgen:*` leads only through two wired desk-pull adapters and only on a manual operator pull: `pullHomesteadDesk` (economy, `leadgen.js:336-357`) and `pullFinanceDesk` (finance, `:362-376`). `energy:distress`, the WARN pool, and public-notice have **no pull adapter** (`:509-518`). No cron or workflow ever calls `action=pull` (grep of workflows + `vercel.json` = zero).

**Channel 5, bottom line:** today's leads are **real prospects** (genuine inbound captures + real scraped distress candidates), never seeded or synthetic. But the CRM is **empty by default**, because both feeders (inbound forms and scraper pools) require a manual operator pull to cross into the `leadgen:*` pipeline, and only 2 of ~5 scraper pools are even wired to convert.

---

## 3. Finding 2, how `crm.js` manages the lead lifecycle

**Two record shapes in two keyspaces (CONFIRMED).** The birth record `leadgen:lead:<id>` (`makeLead`, `leadgen.js:122-139`) has `status` hardcoded to `'new'` and **never transitions** there. The working record `crm:state:<leadId>` (`crm.js:327-333`) holds the real lifecycle.

**Status state machine: PARTIAL (a guarded machine with a manual backdoor).** 11 statuses (`STATUSES`, `crm.js:50`): `new, working, appointment, showed, no-show, cancelled, enrolled, lost, referred, unresponsive, dead`. Transitions are action-guarded (`touch` to appointment/working/dead `:349-352`; `send-email` new to working `:380`; `show-outcome` `:432`; `close` won/lost to enrolled/lost `:461-462`; `refer` `:479`), **except** `action=status` (`:487-495`), an unguarded any-to-any override validated only by set membership. `remove` (`:497-503`) deletes the CRM working copy but leaves the leadgen birth record alive.

**`dead` is human-set only and fully reversible (CONFIRMED).** It is set by exactly two paths, both human POST behind the admin key: `touch` with outcome dead/not-interested (`crm.js:351`) or `status=dead` (`:492`). No cron/worker sets it; autopilot only advances new to working (`autopilot.js:158`). It carries no tombstone, no TTL; `action=status` moves it back to any state. The leadgen record is untouched by any status change.

**The allocator "conflict" is resolved: DIFFERENT OBJECTS (CONFIRMED, High).** `sales-engine.js allocate()` (`:178-198`) distributes outreach volume across **plays**, grouped by `segment = transitionId|dealSize|trigger` (`:117,182`), sourced from `sales:plays` (`sales.js:201-203`). A play has no lead fields and no status. `dead` is a status on a **lead** in `crm:state`. There is no key, field, or join connecting a lead's status to a play's allocation. The one real coupling is one-directional and additive: working a lead mirrors an event into the funnel *aggregate* `sales:agg` (`crm.js:100-137`), a separate structure from `sales:plays`; marking a lead dead simply stops generating new mirror events, never decrements a play. So round-2's "unresolved conflict between dead and never-starve" was a conflation of two unrelated objects. **This revises round-2 (and round-1 §6):** there is no existing collision; the earlier note was forward-looking advice for a hypothetical pruning agent (retire leads = compatible with `dead`; kill plays = would fight the allocator floor), and neither pruning agent exists.

---

## 4. Finding 3, why economy is the only domain with live autonomous outreach

**Mechanism: two separate outreach architectures (CONFIRMED).**
- **Architecture A (bespoke, economy-only):** `realauction:deals` to `handlers/homestead-automail.js` to Lob physical letters. A repo-wide grep for `automail|api.lob.com|lobSend` returns exactly one handler (`homestead-automail.js`). It reads economy data directly (`:118`), and its letter template is RE-hardcoded ("court sale scheduled," "no-obligation cash offer," "I am not your lender," `:22-32`), unusable for another domain without a rewrite. Physical mail because RE owners are reachable only by mailing address.
- **Architecture B (shared, domain-agnostic):** leadgen desk to `crm:worklist` to `handlers/autopilot.js` auto-email. The worklist is a single global key (`autopilot.js:35`), iterated regardless of domain; `domainGate(state)` is a literal pass-through `return {allow:true}` (`:70`).

**Why economy only: reasons (b) wiring + (d) full stack, NOT (a) data.** Finance has a real parallel feed (`finance:distress`), so data is not the differentiator (reason (a) ABSENT). Economy is unique because it is the only domain with the full acquisition-to-reachable-recipient-to-send stack: disposition/buyer-match (`lib/buyers.js` via `homestead.js:43`), skip-trace + cadastral producing a **mailing address** (`skip-trace.js:50-55`), servicer-lockbox filtering (`homestead.js:64-122`), and the bespoke Lob handler. **The load-bearing fact:** even the shared autopilot cannot deliver autonomous outreach for anyone, because `canAuto` requires an email channel (`autopilot.js:196`) and desk leads carry no email (`pullHomesteadDesk` and `pullFinanceDesk` build leads with no email/phone, `leadgen.js:343-356,367-374`). So economy's real autonomy is Architecture A (mail), and Architecture B is inert on every desk lead.

**Cost to light up a second domain: DATA + WIRING, not a config flip.** The autopilot email plumbing is already domain-neutral (so round-1's "domainGate stub" is real but not the true gate), but it is a dead path: no desk lead has a contact channel. Lighting up domain #2 requires (1) DATA: leads with a working contact channel, which no desk currently produces, and (2) WIRING: a domain-appropriate outreach actuator, which exists only as the economy-bespoke Lob handler. For finance specifically, the distressed companies have no contact info and the matched funds carry only a homepage URL (`distress-funds.js:8-20`), so there is no recipient. For industry, it is one step further back: industry is not even a leadgen desk source (`SOURCE_DEFS` has only homestead-desk and finance-desk, `leadgen.js:84-86`).

**Finance "partial" = funnel-wired, not outreach-wired (CONFIRMED).** Finance has the intake and ranking half (a `finance-desk` leadgen source with a working `pullFinanceDesk` adapter, a desk view with disposition match `finance-distress.js:18`, and access to the global worklist) but none of the reach half: no contact enrichment yields a reachable recipient, no send handler exists (no finance-automail; CRM/autopilot email both require a valid email that finance leads lack). The missing span between finance-partial and economy-full is precisely **contact enrichment + a domain outreach actuator**.

---

## 5. Finding 4, what the system recognizes as "a business" per domain

**Verdict: a per-domain business-entity layer does NOT exist. ABSENT (High).** The system models prospects/leads, external companies it surveils as targets, and one domain's (finance's) own monetization portfolio. It does not model "a business per domain" as an object with offerings + pricing + customers + P&L.

- **The `sales:companies` registry is a bare label.** Shape `{id, name, domain, level, note}` (`leadgen.js:54-63,458-473`), 8 defaults. No offerings, no products, no pricing, no customers; `domain` is an attribution tag. This is the closest thing to a company object and it carries zero commercial data.
- **The only real offering/pricing data is `assets/data/capital-engine.json`, and it is finance-as-system-revenue-node, not per-domain.** It holds 3 priced content products (book $19, two guides $29/$24, `:117-121`) whose `domains` tags are none of the 20 LIMEN domains, and ~35 monetization streams all tagged `domain:"finance"` (`:57-100`), mostly `setup`/`needs-key`/`pre-revenue` with an explicit "illustrative placeholders" meta (`:11`).
- **`venture-engine.js`/`ventures.js` is a template generator, not a stored entity** (archetype scaffolds with no real pricing or customers, regenerated per call). **`valuation.js` and `assets/data/companies/*.json` price external securities**, the objects of the distress engine, not LIMEN businesses. `assets/data/schemas/` holds one schema, a research cube, not a business model.

**Customer vs lead: PARTIAL, status-flag only.** `close` (`crm.js:454-467`) sets `status='enrolled'` and stamps `revenueCents` on the same lead record. There is no separate customer/account object, no MRR, no subscription, no renewal. A grep for customer/subscriber/mrr/subscription/account confirms absence of any paying-relationship entity. **Critical disconnect:** the `enrolled` revenue is mirrored into the funnel *counter* (`crm.js:464`) and never touches `stripe-rail` or `finance-ledger`. So "a lead converted" and "money arrived" are two unlinked systems.

**Payment inventory:** `stripe-rail` (inbound only, outflow HALT, finance-tagged, `stripe-rail.js:47-104`); `products` (the 3 content guides, the only path a customer buys a LIMEN-owned product, `products.js:27-52`); `relay-checkout`/`relay-margin` (the separate Relay broker storefront, `relay-checkout.js:37-78`); `finance-ledger` (records and computes, never moves money, `finance-ledger.js:8,23-81`). None is wired to a domain's leads converting to revenue.

**Two separate unstarted projects: CONFIRMED.** No object binds leads to offerings to revenue; the two revenue records (`crm` funnel counter vs `finance:ledger`) never meet; the business is generated on demand, not owned; per-domain P&L does not exist (`finance-ledger.summary()` aggregates by streamId, not domain). So "build the sales agent" (scaffolded-but-unwired per rounds 1-2) and "build the business layer beneath it" (essentially unbuilt) are distinct.

---

## 6. Per-domain readiness table

The decision-driving view. "Inbound capture" = a public front that POSTs `/api/lead` (all 20 have one). "Desk/scraper source" = a scheduled feed of candidates for that domain. "Funnel-wired" = a leadgen pull adapter that turns candidates into `leadgen:*` leads. "Live autonomous send" = an armed outreach actuator. "Business-entity data" = any offering/pricing/customer model above the lead. Lead counts are runtime-only (section 7).

| Domain | Inbound capture | Desk/scraper candidate source | Funnel-wired (pull adapter) | Live autonomous send | Business-entity data | Confidence |
|---|---|---|---|---|---|---|
| economy | Yes | Yes, `realauction:deals` + skip-trace/cadastral | **Yes** (`pullHomesteadDesk`) | **Yes** (Lob mail, armed) | Label only (homestead) | High |
| finance | Yes | Yes, `finance:distress` (EDGAR) | **Yes** (`pullFinanceDesk`) | No (no contact channel) | **PARTIAL** (capital-engine.json, system-scoped) | High |
| industry | Yes | Yes, WARN pool (no pull adapter) | No | No | Label only (industry-desk) | High |
| energy | Yes | Yes, `energy:distress` (no pull adapter) | No | No | None | High |
| technology | Yes | No | No | No | Label only (killswitch) | High |
| population | Yes | No | No | No | Label only (tension) | High |
| medicine | Yes | No | No | No | Label only (heartland) | High |
| agriculture | Yes | No | No | No | None | High |
| communication | Yes | No | No | No | None | High |
| culture | Yes | No | No | No | None | High |
| defense | Yes | No | No | No | None | High |
| education | Yes | No | No | No | None | High |
| environment | Yes | No | No | No | None | High |
| governance | Yes | No | No | No | None | High |
| infrastructure | Yes | No | No | No | None | High |
| intelligence | Yes | No | No | No | None | High |
| law | Yes | No | No | No | None | High |
| religion | Yes | No | No | No | None | High |
| science | Yes | No | No | No | None | High |
| trade | Yes | No | No | No | None | High |

Reading the table: **economy** is the only fully wired lane (source + funnel + live send). **Finance** is the clear second (source + funnel, missing only contact enrichment + a send actuator, plus it uniquely has a monetization data model). **Industry and energy** have real candidate feeds but no pull adapter, so they are a wiring step behind finance. The remaining **16 domains** have only the generic inbound form and nothing behind it. No domain except economy has any live outreach, and no domain except finance has any business-entity data.

---

## 7. Evidence appendix (round-3 citations)

**Lead origination:** `handlers/lead.js:90-151`; `handlers/leadgen.js:32,37,43,54-63,75-92,122-139,208-224,246-279,336-376,458-473,483-523`; `handlers/skip-trace.js:9,20-22,50-55,57-64,83`; `lib/deal-enrich.js:18,199-214,324-365,490-534`; `handlers/finance-distress-ingest.js:25`; `handlers/energy-distress-ingest.js:23`; `scripts/realauction-scrape.js:344`; `scripts/edgar-fetch.js:40`; `vercel.json:4-11,30-48`; `domain-front.html:1098,1151,1164`; `sell-before-auction.html:161`; `fitness.html:559`; `culture.html:299`; `coming-soon.html:291`; `package.json:1-8`.

**CRM lifecycle + allocator:** `handlers/crm.js:38-39,50,100-137,150,200-233,311-338,327-333,349-352,362-366,380,391,432,447,454-467,479,487-503`; `handlers/leadgen.js:32,35,122-139,213-224,395-448`; `lib/sales-engine.js:117,128-149,178-198`; `handlers/sales.js:48,62,69,201-203`; `handlers/autopilot.js:158,176-218`.

**Economy-only outreach:** `handlers/homestead-automail.js:5-7,22-32,46-57,67,114-133`; `handlers/autopilot.js:35,70,176-218,196,253,289-296`; `handlers/leadgen.js:84-86,336-357,362-376,509-518`; `handlers/crm.js:311-338,366`; `handlers/skip-trace.js:50-55,83`; `handlers/homestead.js:43,64-122`; `handlers/finance-distress.js:18`; `lib/distress-funds.js:8-24`; `vercel.json:10`.

**Business-entity layer:** `handlers/leadgen.js:37,54-63,440-447,458-480`; `assets/data/capital-engine.json:11,14-22,35-55,57-100,117-121`; `lib/products.js:27-52`; `lib/stripe-rail.js:47-63,79-104`; `handlers/relay-checkout.js:37-78`; `handlers/relay-margin.js:33-45`; `lib/finance-ledger.js:8,23-81`; `handlers/capital-engine.js:214,248`; `handlers/crm.js:50,454-467`; `lib/venture-engine.js:45,130-149`; `handlers/ventures.js:39,44-57`; `lib/valuation.js:64-147`; `assets/data/schemas/treatment-discovery-cell.schema.js`.

---

## 8. Open questions after round 3

1. **Live lead volume per domain (the single most decision-relevant number).** Not in the repo (Redis-only, no seed, no committed export). Per-domain and per-company counts are tracked at runtime in `leadgen:domainstats` (`leadgen.js:35,213-214`). Resolved by one admin-keyed read: `GET /api/leadgen?action=board&key=<SALES_ADMIN_KEY|LEAD_ADMIN_KEY>` (by-domain + by-company counts, `leadgen.js:434-448`); `action=leads` for the total (`:420,430`); `GET /api/crm?action=worklist&key=...` for the current `dead` count (`crm.js:213-233`). Until then, the readiness table's "which domains have leads behind them" is a wiring map, not a volume map. Given that every path into the CRM is a manual pull and no cron automates it, the realistic default volume is near-zero unless the operator has already pulled or real inbound traffic arrived, but that is inference, not a measured count.
2. **Whether keyed adapters are configured.** `google-places` lead creation, BatchData skip-trace, and Lob mail all depend on env keys not in the repo. Presence is exposed by status endpoints (rounds 2-3); values need the Vercel dashboard.
3. **Whether any inbound leads have been pulled into the pipeline.** The inbound-form to leadgen crossing is manual; whether it has ever been run is a runtime fact, resolved by the same `action=board` read (inbound-sourced leads would appear in the domain/company stats).
