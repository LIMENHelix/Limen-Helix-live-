# Finance Portal — Human Sign-Off Enumeration

<!-- AUTHORITY: OWNER_CONFIRMED (entity name) — see DOCUMENT_AUTHORITY.md -->
> **AUTHORITY NOTE, added 2026-08-02, resolved the same day.** The legal entity named here —
> `LIMEN Helix Transformational Sciences LLC` — is **correct and owner-confirmed**.
> `docs/MASTER_CONTEXT.md` carried a different name ("LIMEN Helix LLC") and has been corrected.
> Verify the exact registered spelling against the filing before this appears on anything binding.



The autonomous engine builds, proposes, routes, and produces on its own. It **halts** at every point
below, where a human signature is legally required. This is the connective tissue between
"the system runs itself" and "the system can run itself tomorrow without tripping a regulator."

## Sign-off model (current)
- **Mode:** SINGLE-SIGNATURE.
- **Signer:** Chris Hubbel, Managing Member, LIMEN Helix Transformational Sciences LLC.
- **Rule:** Every item flagged `signoffRequired=true` in `capital-engine.json` halts and waits for the
  signer. Nothing money-moving or legally-binding executes autonomously.
- **Future:** migrate to THRESHOLD-TIERED — auto-approve below an operator-set dollar ceiling, halt
  above it. Ceilings to be defined later. Until then, treat the ceiling as **$0** (everything halts).

Scope of this enumeration: **LLC + Chapel + Finance Portal as the first real domain instance.**

---

## 1. Entity & banking (one-time, foundational)
| # | Halt point | Why human | Status |
|---|---|---|---|
| 1.1 | LLC operating agreement / member resolutions | Legal formation | confirm |
| 1.2 | EIN on file; bank account in LLC name | Banking KYC | confirm |
| 1.3 | Banking resolution authorizing Stripe payouts to the LLC account | Moves real money | **blocked-on-human** |

## 2. Stripe rail (unlocks every `[$]` stream)
| # | Halt point | Why human | Status |
|---|---|---|---|
| 2.1 | Activate Stripe account for live charges | TOS + identity | needs-key |
| 2.2 | Enable payouts/transfers (Stripe Connect sub-accounts per domain) | Moves real money | **blocked-on-human** |
| 2.3 | Each Connect sub-account onboarding (per domain instance) | KYC per entity | per-instance |

## 3. Tax (set templates once, reuse at every instantiation)
| # | Halt point | Why human |
|---|---|---|
| 3.1 | Intercompany agreement templates (management fee / IP license / services) — governs how a domain-company's cash flows up to the parent and where it's taxed | Transfer pricing |
| 3.2 | W-9 / W-8 collection from any contractor or affiliate payer | IRS reporting |
| 3.3 | Sales-tax / nexus determination for digital goods (Etsy, Gumroad, courses) | State tax law |
| 3.4 | Quarterly estimated tax filings | Tax filing |

## 4. Securities & investment lane
| # | Halt point | Why human |
|---|---|---|
| 4.1 | **Any actual order placement** in the investment lane | Fiduciary act — engine PROPOSES only; paper-trade until signed |
| 4.2 | Reg D 506(b) filings, investor docs | Securities law |
| 4.3 | Anything crossing into specific investment advice for compensation | Investment Advisers Act of 1940 |

## 5. 501(c)(3) firewall (non-negotiable)
| # | Halt point | Why human |
|---|---|---|
| 5.1 | Any flow of for-profit earnings toward the Chapel | UBIT / private inurement — for-profit revenue flows through the LLC, **never** into the nonprofit unrestricted |
| 5.2 | Chapel hosting the LIMEN site is fine; earnings commingling is not | Same |

## 6. Per-stream account creation & compliance (each is a human act)
| # | Halt point | Why human |
|---|---|---|
| 6.1 | Creating each external account (Amazon Associates, YouTube, TikTok, Etsy, Gumroad, Beehiiv, Printful…) and accepting its **Terms of Service** | No AI may accept TOS or pass KYC |
| 6.2 | Affiliate-program enrollment + **FTC affiliate disclosure** on content | FTC rules |
| 6.3 | **AI-content disclosure** labels (TikTok/Meta/YouTube synthetic-media rules) | Platform policy |
| 6.4 | Likeness / trademark / copyright clearance in any generated media | IP liability |

## 7. Contracts & debt (Tier 4–5)
| # | Halt point | Why human |
|---|---|---|
| 7.1 | Any contract execution (vendor, listing customer above a set size, acquisition LOI/APA) | Binding agreement |
| 7.2 | Debt instruments — SBA 7(a), personal guarantee | Wet signature; lights up the SBA lane |
| 7.3 | Capital outlay above the (future) threshold | Money movement |

---

## What the engine does WITHOUT a signature (autonomous)
Build pages and pipelines · generate content/assets/media · propose stream priorities and capital
routes · run market-data and AI passes (budget-gated) · report connector readiness · paper-trade /
model · queue everything above for the signer. **It stops at the signature line, every time.**

> Operator note: the system surfaces each halt in the Approval Queue at `/capital-engine`. Clearing a
> queue item = your signature. When threshold-tiered mode is defined, items below the ceiling will
> auto-clear and stop appearing here.
