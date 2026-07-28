# Creator 12 + 13 — Extract

**Verbatim extract** of `NEURO_LEARNING_REFERENCE.md` lines 1703-3031, assembled for reading
without the repo. Nothing is paraphrased, reordered, summarised or added; line numbers below
are the ORIGINAL line numbers in the source document so anything here can be traced back.

Creator 12 is the economics corpus: what financial stress is, how the production indexes
aggregate it, and the network/uncertainty literature. Creator 13 is the synthesis section that
argues stress measurement and neural state estimation are the same estimator, ending at 13.5
with the cue-combination rule stated as an equation.

Source doc is firewalled (`.vercelignore` line 108 covers `docs/research/`), and so is this.

---

## Contents

- **Creator 12 — Economics: Financial Stress Measurement, Aggregation, Network Propagation & Uncertainty**  `L1703`
  - **12.1 Hakkio & Keeton — What Financial Stress Is (the definitional entry)**  `L1719`
  - **12.2 Illing & Liu — Stress as a Continuous Variable, and the Aggregation Horse Race**  `L1742`
  - **12.3 The Production Fed Indexes — KCFSI, STLFSI, CFSI, NFCI**  `L1814`
  - **12.4 Holló, Kremer & Lo Duca — CISS, Aggregation by Time-Varying Correlation**  `L1947`
  - **12.5 Kritzman & Li — The Turbulence Index (Mahalanobis Distance)**  `L2023`
  - **12.6 Kritzman, Li, Page & Rigobon — The Absorption Ratio (Coupling as Fragility)**  `L2062`
  - **12.7 Gabaix — The Granular Origins of Aggregate Fluctuations**  `L2124`
  - **12.8 Acemoglu, Carvalho, Ozdaglar & Tahbaz-Salehi — The Network Origins of Aggregate Fluctuations**  `L2187`
  - **12.9 Diebold & Yilmaz — Connectedness from Forecast-Error Variance Decompositions**  `L2254`
  - **12.10 Billio, Getmansky, Lo & Pelizzon — Granger-Causality Networks and PCAS**  `L2348`
  - **12.11 Baker, Bloom & Davis — Economic Policy Uncertainty from Newspaper Text**  `L2438`
  - **12.12 Bloom — Uncertainty Shocks and the Region of Inaction**  `L2521`
  - **12.13 Jurado, Ludvigson & Ng — Uncertainty as the Unforecastable Component (the critique entry)**  `L2584`
  - **12.14 Loughran & McDonald — Why Generic Word Lists Fail in a Specialized Domain**  `L2661`
  - **12.15 Guttal, Raghavendra, Goel & Hoarau — Critical Slowing Down Does NOT Transfer to Markets**  `L2726`
  - **12.16 Coupling and Attention: Corroborations and Critiques**  `L2751`
- **Creator 13 — The Isomorphism: Stress as Precision-Weighted State Estimation (the LIMEN thread)**  `L2836`
  - **13.1 The shared object — Kalman 1960, and why the gain is inverse-variance weighting**  `L2859`
  - **13.2 The common root — Wiener's cybernetics, "the animal and the machine"**  `L2891`
  - **13.3 The neuroscience adoption — the brain runs the filter**  `L2904`
  - **13.4 The economics adoption — the market's stress index runs the SAME filter**  `L2942`
  - **13.5 The cue-combination bridge — the fusion rule LIMEN needs, stated as an equation**  `L2975`

---

# Creator 12 — Economics: Financial Stress Measurement, Aggregation, Network Propagation & Uncertainty

How economists formally define, construct, aggregate and validate a *stress* measure over a population of
firms or markets. This section exists because the same object (a scalar severity read over a network of
units) is measured in economics with a fifty-year methodological record, several production instruments run
by central banks, and published post-mortems on the ones that failed. The entries split into four projects:
**defining** stress as a continuous variable (12.1-12.2), **aggregating** many indicators into one number
(12.3-12.6), **propagating** shocks from individual units to the aggregate (12.7-12.10), and **measuring
uncertainty from text and volatility**, including the critiques that bound it (12.11-12.16).

Sourcing note: unlike Creators 1-11, these sources are journal articles, so verification was by local text
extraction (`pdftotext -layout` / `pypdf`) from primary PDFs rather than by video-topic confirmation. During
research two fetch-tool PDF *summaries* returned fabricated content (one claimed Illing & Liu used principal
component analysis and LIBOR-OIS spreads, both false and the second anachronistic). Nothing below rests on a
tool summary. Sub-details behind paywalls or 403s are flagged inline.

## 12.1 Hakkio & Keeton — What Financial Stress Is (the definitional entry)
**Mechanism (as stated).** "In most general terms, financial stress can be thought of as an interruption to
the normal functioning of financial markets." The authors then decline to sharpen it further, and say why:
"Agreeing on a more specific definition is not easy, because no two episodes of financial stress are exactly
the same. Still, economists tend to associate certain key phenomena with financial stress. The relative
importance of these phenomena may differ from one episode of financial stress to another. However, every
episode seems to involve at least one of the phenomena, and often all of them." The five phenomena, as the
paper's own section headings: (1) **increased uncertainty about fundamental value of assets**; (2)
**increased uncertainty about behavior of other investors**; (3) **increased asymmetry of information**;
(4) **decreased willingness to hold risky assets** (flight to quality); (5) **decreased willingness to hold
illiquid assets** (flight to liquidity). The logical structure is **disjunctive, not conjunctive** — "at
least one," not all five. This is a family-resemblance definition, not a set of necessary conditions. Two
stated causal orderings: (1)→(2), uncertainty about other investors "tends to arise" when investors are
already uncertain about fundamentals; and (3)→(5), reduced asset liquidity is "often associated with greater
asymmetry of information between buyers."
**Math / Algorithm.** Conceptual. The operationalization is the KCFSI (12.3).
**Key parameters.** The five phenomena; their disjunctive combination; the two stated causal links.
**Primary sources.** Hakkio, Craig S., and William R. Keeton 2009, "Financial Stress: What Is It, How Can It
Be Measured, and Why Does It Matter?" FRB Kansas City *Economic Review* 94(2):5-50. No DOI. RePEc
`fip:fedker:y:2009:i:qi:p:5-50:n:v.94no.2`.
**Confidence.** [paper-verified] — definition, five section headings, disjunctive framing and both causal
orderings read from local extraction of the source PDF.

## 12.2 Illing & Liu — Stress as a Continuous Variable, and the Aggregation Horse Race
**Mechanism (as stated).** The canonical paper treating financial stress as continuous rather than binary.
Abstract, verbatim: "Stress is defined as the force exerted on economic agents by uncertainty and changing
expectations of loss in financial markets and institutions. It is a continuous variable with a spectrum of
values, where extreme values are called financial crises." The operational definition has **three distinct
arguments**: "Stress increases with expected financial loss, with risk (a widening in the distribution of
probable loss), or with uncertainty (lower confidence about the shape of the distribution of probable loss)"
— first moment, second moment, and a Knightian term about the distributional form itself. Two scope limits
the authors state explicitly: stress "is the product of a vulnerable structure and some exogenous shock," so
the index measures *realized stress*, not fragility; and "By definition, the FSI captures the
contemporaneous level of stress and is not expected to have strong predictive power for future stresses or
crises." The index is **ordinal, not cardinal**: "The value of the index is likely to change when the sample
period is altered, but the ordinal ranking of two events should remain the same." Their stated reason binary
crisis dummies fail for developed economies: early-warning models "have not been successfully applied to
highly developed countries, owing to the rarity of crises in large mature markets."
**Math / Algorithm.** Five weighting families × three variable sets = 15 candidate indexes, each scored
against an external label. *Variance-equal*: z_jt = (x_jt − x̄_j)/σ_j, then arithmetic (1/J)Σ_j z_jt or
geometric (Π_j z_jt)^(1/J) chained monthly (the geometric variant requires positive values, so "half of the
observations must be ignored"). *Credit weights*: w_jt = C_m(j),t / Σ_m C_m,t, chain-linked, total credit =
bank credit + corporate bonds + government bonds + equities + USD credit; "For markets with more than one
stress proxy, the corresponding weight is split evenly." *Sample CDF*: u_jt = F̂_j(x_jt) = (1/T)Σ_s 1{x_js ≤
x_jt}, mapped to percentiles 1-99; stated rationale: "The transformed variables are unit-free and implicitly
reflect all the moments of their distributions, provided they are time stationary, regardless of whether the
distribution is normal" — the stationarity proviso is theirs and is load-bearing. *Factor analysis*: first
principal component. Probit/logit implicit weights were considered and rejected (fn. 31) because both sides
of the regression would be the same concept measured two ways.
Evaluation: with X the stress measure, τ the threshold, C the survey label,
Type I = Pr(X < τ | C = 1) ("failure rate"); Type II = Pr(X > τ | C = 0) ("false positive rate"),
τ = median + 1σ per Eichengreen-Rose-Wyplosz, evaluated monthly.
**The external label, which is the methodologically important part.** Not news-scraped. Stage 1: "The list of
events was drawn from a review of every Bank of Canada Annual Report since 1977 and every Monetary Policy
Report since 1995. Events were included if they were explicitly identified as having had a significant impact
on Canadian markets" → 40 ranked events. Stage 2: 40 questionnaires to "a former governor, three governing
council members, eight senior bank officers, twelve bank officers, and three analysts," ranking 1-3.
Labelled sample: **55 of 276 months stressful**, base rate 19.9%.
**Results (Table 5, Type I / Type II, percent).** Standard variables: variance-equal arithmetic 15/41;
variance-equal geometric 22/43; **credit weights 13/33 (winner)**; sample CDF 22/42; factor analysis 45/41.
Refined variables: 22/38, 25/38, 27/36, 44/48, 42/42. GARCH variables: 27/40, 32/41, 33/41, 25/38, 44/42.
Benchmarks: Bank Credit Analyst FSI 35/46; Bordo-Dueker-Wheelock 64/15. Four robust findings: **factor
analysis is worst in all three variable sets** (45/42/44) and correlates only 57% with the others;
**"refined" model-adjusted variables are worse than raw ones** (the Elfner fair-value adjustment to the
corporate spread alone "increases the Type I error by 20 percentage points"); **binary crisis dummies from
the early-warning literature are catastrophic** (Demirgüç-Kunt & Detragiache 100/0, Kaminsky-Reinhart 88/0 —
near-zero false positives achieved by essentially never firing); and **method choice barely matters among the
top three** (cross-correlations during stress: variance-equal-arithmetic vs credit 99%, vs sample CDF 94%).
Threshold sensitivity: raising τ to +2σ "increases Type I errors by 8.6 percentage points on average, and
reduces Type II errors by 6 percentage points on average… The choice of τ does not significantly alter the
ordinal ranking of the measures."
**Selection rationale, in the authors' stated order.** Interpretability, economically meaningful weights,
lowest errors — error performance is listed *last*: "Since it performs well and is simple to interpret and
communicate, we suggest that it be used as the FSI for Canada."
**The shipped index differs from the paper's recommendation.** Six months later the same authors published an
operational hybrid in the Bank of Canada *Financial System Review* (Dec 2003), composing the two axes:
FSI_t = Σ_j w_jt [∫_{−∞}^{x_j} f(x_jt) dx_jt] × 100 — "The daily value of each variable is first weighted by
its sample cumulative distribution function… Next, each variable is weighted by the relative size of the
market to which it pertains." Transformation and weighting are **orthogonal axes, composed**, which the flat
five-item list in the working paper obscures. Realized weights, 11 Sept 2003, nine variables: 12.7 / 9.7 /
11.3 / 12.7 / 9.1 / 10.5 / 11.3 / 11.3 / 11.3 percent. The authors' own caveat: "The weighting of the
components by their shares in credit involves a certain arbitrariness. Thus, one cannot claim that this index
has the optimal weights for measuring stress. It should be noted, however, that the weights are approximately
equal across the components." Credit weighting won the horse race and lands within **1.6 points of equal
weighting** (nine variables at equal weight = 11.1%).
**Primary sources.** Illing, Mark, and Ying Liu 2006, "Measuring financial stress in a developed country: An
application to Canada," *Journal of Financial Stability* 2(3):243-265, DOI 10.1016/j.jfs.2006.06.002. Working
paper: Bank of Canada WP 2003-14 (June 2003), DOI 10.34989/swp-2003-14, titled "An Index of Financial Stress
for Canada." Operational index: Bank of Canada *Financial System Review*, December 2003.
**Confidence.** [paper-verified] for all methodology, the Table 5 grid (independently extracted twice), the
survey design and the FSR hybrid — all from WP 2003-14 read in full plus two Bank of Canada restatements.
[unverified]: whether the published 2006 article carries **9 or 11** variables — Bank of Canada documents
enumerate nine, the ECB CISS paper says eleven, and ScienceDirect returned 403. Does not affect any
structural claim.

## 12.3 The Production Fed Indexes — KCFSI, STLFSI, CFSI, NFCI
**Mechanism (as stated).** Four central-bank instruments that answer the same question with materially
different machinery. Compared here because the divergences are informative and two of the four have publicly
documented failures.

**KCFSI (Kansas City).** 11 monthly variables → first principal component, explaining **61.4%** of total
variation (Feb 1990 - Mar 2009). Variables and PC1 coefficients: TED spread 0.099; 2-yr swap spread 0.116;
off-the-run/on-the-run 10-yr Treasury spread 0.107; Aaa/10-yr Treasury 0.107; Baa/Aaa 0.125; high-yield/Baa
0.124; consumer ABS/5-yr Treasury 0.130; negative stock-Treasury return correlation 0.081; VIX 0.129; bank
idiosyncratic volatility 0.130; cross-section dispersion of bank stock returns 0.116. Two structural notes:
all five Hakkio-Keeton phenomena are covered but **not evenly** — flight-to-liquidity and flight-to-quality
carry four variables each, while "uncertainty about fundamental value" and "uncertainty about other
investors" are never separately identified and are always jointly assigned to the same two volatility
measures; and the **coefficients are nearly flat** (0.081-0.130, a 1.6× range on a standardized scale), so
PCA weighting here is close to equal weighting.
Math, fn. 19 verbatim: choose {FSI_t} and {a_k} to minimize SSE = Σ_{k,t}(X_kt − a_k FSI_t)² subject to
Σ_t FSI_t²/(T−1) = 1. "As shown in Theil, the values of a_1…a_11 solving this problem are the elements of the
first eigenvector of the sample correlation matrix of the 11 variables. Also, FSI_t = (a_1/√λ)X_1t + … +
(a_11/√λ)X_11t for all t, where λ is the first eigenvalue for the sample correlation matrix." Correlation
matrix, not covariance (a consequence of pre-standardizing).
**Rolling-window instability, stated by the authors:** because sample mean and SD are re-estimated as the
window extends, adding low-stress months mechanically shrinks all standardized values and forces rescaling of
every coefficient. The paper notes a sample change made some months "no longer considered high-stress." The
KCFSI is **ordinal within a vintage and not comparable across vintages**.
2018 revision (Cook & Doh, KC Fed *Macro Bulletin*, Oct 24 2018): TED spread replaced by (DTCC GCF Treasury
repo − 3-mo T-bill), with repo history backfilled in two stages — regress DTCC on the NY Fed survey rate,
RR = a + b·RR^S + e, splice at 2005, then back out 1990-1998 from the statistical relationship to the other
KCFSI inputs. **Live KCFSI since Nov 2018 contains two layers of imputed data in one of its 11 inputs.**

**STLFSI (St. Louis).** 18 weekly series (7 interest rates, 6 yield spreads, 5 other) → first principal
component. The 7/6/5 partition is invariant across all four vintages; membership is not. Seven-step
construction: 18 series from Dec 31 1993; de-mean; divide by sample SD; PCA; scale coefficients so index
SD = 1; multiply; sum. z_i,t = (x_i,t − x̄_i)/σ_i, STLFSI_t = Σ_{i=1}^{18} ℓ̃_1i z_i,t with sd 1, mean 0.
"The average value of the index, which begins in late 1993, is designed to be zero. Thus, zero is viewed as
representing normal financial market conditions." Normalization window is the **entire history**, so the
sample contains 2008 and 2020 and "zero" silently re-centers with every new observation. **Units are standard
deviations, not basis points** (a common secondary-source error). Version lineage: v1→v2 (Mar 2020) switched
from levels to **daily changes** in interest rates and stock prices, "The primary reason is that interest
rates have trended lower and stock prices have trended higher, on average" — a detrending fix, because levels
of trending series contaminate PC1 with a secular factor. v2→v3 (Jan 2022) LIBOR retirement, two of six
spreads affected, correlation with v2 = 0.99. v3→v4 (Nov 2022) backward- to forward-looking SOFR,
correlation v3-v4 = 0.993 to Jan 2022, diverging after Feb 2022 as the FOMC tightened.

**CFSI (Cleveland) — uses credit weights, not PCA, and was withdrawn.** Four schemes were tested — "equal
weights; equal variance weights; credit weights; and principal component weights" — and credit weights
selected: "the CFSI calibration using credit weights to be optimal under competing weighting methods… In
addition to statistical optimality, the CFSI calibration using dynamic credit weights is conceptually
appealing since it lends economic significance to the different FSI components." Their stated objection to
PCA is a direct critique of the STLFSI design: "weighting based on a single component creates a fixed set of
weights for all dates in the analysis, **forcing market relationships to hold in the data when reality shows
they may not**." Transformation is empirical CDF at component level, z-score at index level:
FSI_t = 100 · Σ_j w_j,t CDF_j(x_j,t), CDFs over 4,237 daily observations (26 Sep 1991 - 31 Mar 2009), three
series rank-inverted (weighted dollar crashes, stock market crashes, Treasury yield-curve spread — "Flat or
inverted yield curves signal slow growth"). Credit weights w_i,q = Flow_i,q / Σ_k Flow_k,q from Fed Z.1 Flow
of Funds, recomputed **quarterly**. Grades are empirically chosen z-cutoffs maximizing ROC / Somers' D, not a
priori percentiles; WP 12-37 (Sept 2011), probit Z = −1.344444 + 0.370646·CFSI: expansion Z ≤ −0.70 (5.4%
systemic-stress probability), normal −0.70 to 0.57 (12.8%), moderate 0.57-1.84 (25.4%), significant Z ≥ 1.84
(38.0%). WP 11-30 used grade 4 at **2.38**, not 1.84 — thresholds are not stable across vintages. Component
count grew from **11 components / 4 markets** (WP 11-30) to **16 / 6** (WP 12-37, adding real estate and
securitization).
**Discontinued 2016.** Standing advisory banner on every Cleveland Fed CFSI PDF: "This article is based in
whole or in part on the CFSI… an indicator that was discontinued by the Federal Reserve Bank of Cleveland in
2016 due to the discovery of errors in the indicator's construction. **These errors overestimated stress in
the real estate and securitization markets.**" Last observation 2016-05-05. The errors were precisely in the
five variables added in the six-market expansion — the thinnest-data markets. The original 11-component
four-market core did not contain them.

**NFCI (Chicago).** **105 financial indicators currently**, but **100** in both Brave & Butters papers ("Our
100 financial indicators consist of 47 weekly, 29 monthly, and 24 quarterly variables"), so any equation or
weight taken from 2011/2012 describes a 100-indicator panel. Categories: "Risk indicators capture volatility
and funding risk in the financial sector, while credit indicators are composed of measures of credit
conditions, and leverage indicators consist of debt and equity measures." Subsystem breakdown exists only for
the 2011 vintage: money markets 28, debt and equity markets 27, banking system 45; variance decomposition
banking 41% / money markets 30% / debt-equity 29%.
Model: X_t = ΓF_t + ε_t, F_t = AF_{t−1} + ν_t, "where F_t represents a 1 × T latent factor capturing a
time-variation in the N × T matrix of standardized financial indicators X_t, Γ is their N × 1 vector of
loadings onto this factor, A is the transition matrix describing the evolution of the factor's AR(p) dynamics
with **p = 15 weeks** (corresponding to roughly one quarter)." Identification "is achieved only up to scale."
Estimator is **Doz-Giannone-Reichlin quasi-maximum-likelihood, not Stock-Watson**: "it requires one pass
through the Kalman filter and smoother, and then reestimation of the system matrices—Z, T, H, and Q—using
ordinary least squares at each iteration," convergence at 10⁻⁶ relative log-likelihood change, "generally
within 150 iterations"; Stock-Watson PCA-EM supplies starting values only. Mixed frequency via Harvey (1989)
accumulators as implemented by Aruoba-Diebold-Scotti: three accumulators for monthly averages, monthly sums
and quarterly sums; sum accumulator S_{t+1} = s_t S_t + f_{t+1}, s_t = 0 at the last base-frequency period
within the lower frequency, else 1. Ragged edges via Durbin-Koopman selection matrices: Z* = W_t Z,
H* = W_t H W_t′. Normalized to mean 0, sd 1 over a sample extending back to **1971** (subindexes use **1973**
— the 2017 revision extended NFCI/ANFCI history without re-basing the subindexes).
**Adjusted NFCI changed in 2017.** Old (2011-2017): two-step, each indicator regressed on current and lagged
CFNAI-MA3 and 3-month PCE inflation with BIC-selected lags, standardized residuals then fed to the factor
model. Current: simultaneous, X_t = ΓF_t + βZ_t + ε_t, with **Z_t containing four series** — CFNAI-MA3,
3-month PCE inflation, the **unemployment rate gap** (U-3 minus CBO natural rate), and **3-month KR-CRB
commodity price inflation** (added "to ensure that we do not put too much weight on the impact of commodity
price spikes on inflation"). Lag orders now fixed (15 weeks / 3 months / 1 quarter), not BIC-selected.
Because β is estimated jointly with Γ, the ANFCI is **not "NFCI minus macro" — the weights themselves
differ**: "the ANFCI tends to put less weight (in absolute terms) on credit indicators and a little more
weight on both risk and leverage indicators than the NFCI." Attribution of the 2017 revision: 80% new
simultaneous procedure, 12% unemployment gap, 8% commodity inflation. Subindexes are a restricted-loadings
re-smoothing, not a separate estimation (zero out λ for excluded variables, one more Kalman pass with the
final EM system matrices). Empirical character: "Risk is a coincident, Credit a lagging, and Leverage a
leading indicator of financial stress."

**Comparison table.**

| | KCFSI | Illing-Liu | STLFSI | CFSI | NFCI |
|---|---|---|---|---|---|
| Aggregation | PCA (PC1) | credit weights | PCA (PC1) | credit weights, quarterly dynamic | dynamic factor, QML-EM |
| Component transform | z-score | z-score (WP) / CDF (shipped) | z-score | empirical CDF | z-score |
| Weights over time | static | chain-linked | static | dynamic | static loadings, Kalman-smoothed factor |
| Index scale | mean 0, sd 1 | 0-100 | mean 0, sd 1 | CDF-weighted ×100, reported as z | mean 0, sd 1 |
| Frequency | monthly | daily | weekly | daily (10-obs MA) | weekly, mixed-frequency inputs |
| Validated against | narrative episodes | expert survey, Type I/II | — | expert survey, ROC/Somers' D | crisis prediction |
| Status | live | superseded | live (v4) | **discontinued 2016 (errors)** | live |

**Key parameters.** Component counts 11 / 9 / 18 / 11→16 / 100→105. Normalization windows: Feb 1990-Mar 2009
(KCFSI), Dec 1993-present (STLFSI), Sep 1991-Mar 2009 (CFSI CDFs), 1971 (NFCI). NFCI AR order p = 15 weeks.
**Primary sources.** KCFSI: Hakkio & Keeton 2009 (above); Cook, Thomas R., and Taeyoung Doh 2018, "Revamping
the Kansas City Financial Stress Index Using the Treasury Repo Rate," KC Fed *Macro Bulletin*, Oct 24 2018.
STLFSI: Kliesen, Kevin L., and Douglas C. Smith 2010, "Measuring financial market stress," FRB St. Louis
*Economic Synopses* 2010(2). CFSI: Oet, Eiben, Bianco, Gramlich & Ong 2011, FRB Cleveland WP 11-30R3, DOI
10.26509/frbc-wp-201130r3; Oet, Bianco, Gramlich & Ong 2012, WP 12-37, DOI 10.26509/frbc-wp-201237 (cite this
for the 16-component list); Oet, Dooley & Ong 2015, *Risks* 3(3):420-444, DOI 10.3390/risks3030420 (note the
author list changes across the three). NFCI: Brave, Scott, and R. Andrew Butters 2011, *Economic Perspectives*
(FRB Chicago) 35(1):22-43; Brave & Butters 2012, *International Journal of Central Banking* 8(2):191-239;
Brave, Scott A., and **David Kelley** 2017, "Introducing the Chicago Fed's New Adjusted National Financial
Conditions Index," *Chicago Fed Letter* No. 386; FRB Chicago 2025, "Changes to the NFCI and ANFCI," June 2
2025 technical report.
**Confidence.** [paper-verified] for all construction methods, coefficient tables, version lineages, the CFSI
discontinuation banner and the NFCI model equations, from local extraction. [unverified]: the exact v3/v4
STLFSI SOFR spread labels (`stlfsi-key.pdf` returned 403); the ℓ̃_1 = ℓ_1/√λ_1 divisor for STLFSI is an
algebraic reconstruction — the Fed states the target (index sd = 1), not the divisor. [partially-verified]:
per-category NFCI counts (risk 36 / credit 33 / leverage 36) are arithmetic on the official indicator-list
PDF, not published figures.

## 12.4 Holló, Kremer & Lo Duca — CISS, Aggregation by Time-Varying Correlation
**Mechanism (as stated).** Abstract, verbatim: "The main methodological innovation of the CISS is the
application of basic portfolio theory to the aggregation of five market-specific subindices created from a
total of 15 individual financial stress measures. The aggregation accordingly takes into account the
time-varying cross-correlations between the subindices. As a result, the CISS puts relatively more weight on
situations in which stress prevails in several market segments at the same time, capturing the idea that
financial stress is more systemic and thus more dangerous for the economy as a whole if financial instability
spreads more widely across the whole financial system." Two channels: the **"horizontal view"** (the
time-varying correlation matrix — "The stronger financial stress is correlated across subindices, the more
widespread is the state of financial instability") and the **"vertical view"** (subindex weights set by each
segment's measured impact on the real economy).
**Math / Algorithm.** *Step 1, raw indicator transform (empirical CDF / order statistics), Eq. (1a):* for
ordered sample x_(1) ≤ … ≤ x_(n), z_t = F_n(x_t) = r/n for x_[r] ≤ x_t < x_[r+1], r = 1…n−1; = 1 for
x_t ≥ x_[n]. Ties take the average of the involved ranks. Output unit-free, ordinal, range (0,1].
*Step 1b, recursive real-time version, Eq. (1b):* z_{n+T} = r/(n+T), on an expanding ordered sample, one new
observation at a time. Non-recursive (1a) applies to the pre-recursion period 8 Jan 1999 - 4 Jan 2002;
everything thereafter is recursive through 24 June 2011.
*Stated rationale for rejecting z-scores:* standardization "implicitly assumes variables to be normally
distributed," and expanding-sample means and standard deviations "can be subject to large revisions if more
and more outliers are added to the sample." *Stated rationale for rejecting PCA as the aggregator:* "PCA
itself is sensitive to outliers (as it minimises squared distances from the multidimensional mean)."
*Step 2, subindices:* simple arithmetic mean of the three stress factors per segment, s_i,t = (1/3)Σ_j z_i,j,t,
equal weight within segment deliberately, "to underscore their presumed complementary information." Footnote
9 explains why correlation weights were **not** used inside subindices: "the contribution of changes in
subindices to changes in the composite indicator would be too much reduced while changes in correlations
would tend to dominate."
*Step 3, portfolio-theoretic aggregation, Eq. (2) — the core formula:*

    CISS_t = (w ∘ s_t)′ C_t (w ∘ s_t)

with w the vector of **constant** subindex weights, s_t the vector of subindices, **∘ the Hadamard product**
(elementwise, so weights multiply subindex levels *before* the quadratic form), and C_t the 5×5 symmetric
matrix of time-varying cross-correlations with ones on the diagonal (Eq. 3). CISS is continuous, unit-free,
bounded on (0,1].
*Step 4, EWMA estimation of C_t, Eq. (4):* σ_ij,t = λσ_ij,t−1 + (1−λ)s̃_i,t s̃_j,t; σ²_i,t = λσ²_i,t−1 +
(1−λ)s̃²_i,t; ρ_ij,t = σ_ij,t/(σ_i,t σ_j,t), with **s̃_i,t = (s_i,t − 0.5)** — demeaned by the *theoretical*
median of 0.5, not a sample mean. Because the inputs are CDF ranks, the result is "broadly interpreted as a
time-varying variant of Spearman's rank correlation coefficient" and "simply indicates whether the historical
ranking of the level of stress in two market segments is relatively similar or dissimilar at any point in
time — rather than being an economic prediction of correlation risk as in Value-at-Risk frameworks."
**The structural property.** "The square of the simple arithmetic average of the five subindices … emerges as
a special case within the general formula, namely when all subindices were perfectly correlated." That
squared weighted average "actually serves as an **upper boundary** for the CISS." In normal times
correlations are "quite diverse and relatively moderate such that the CISS assumes much lower levels in
'normal times' than the simple-average composite indicator." A **"volatility-equivalent CISS"** is available
as the square root of Eq. (2) (analogous to portfolio standard deviation vs variance); the authors prefer the
variance-equivalent form because "it more strongly differentiates between episodes of stress and calmer
periods." The index decomposes cleanly into per-subindex contributions plus a total cross-correlation
contribution, computed as the difference between CISS and the squared weighted average.
**Key parameters.** λ = **0.93**, constant, "close to the average level of the smoothing parameter estimated
recursively within a simple specification of a five-dimensional IGARCH model for the demeaned subindices"
(fn. 14); robustness tested at 0.89 / 0.93 / 0.97 with differences "generally rather small." Initialization:
covariances and volatilities set at pre-recursion-period averages at t = 0. **5 segments, 15 indicators**
(exactly 3 per segment). Euro-area subindex weights: money market 15%, bond market 15%, equity market 25%,
financial intermediaries 30%, FX 15%, set from "cumulated impulse responses" of industrial production growth
across "a variety of different specifications of standard linear VAR models"; equal weights (20% each)
produce "not very large" differences. Weekly, 8 Jan 1999 - 24 June 2011. The 15 indicators (Table 1): *money
market* — realised volatility of 3-mo Euribor, Euribor − 3-mo French T-bill spread, MFI emergency lending
(marginal lending facility ÷ total reserve requirements); *bond* — realised volatility of the German 10Y
benchmark index, A-rated non-financial corporate vs government yield spread (7Y), 10-year interest rate swap
spread; *equity* — realised volatility of the Datastream non-financial index, **CMAX** = 1 − x_t/max[x ∈
(x_{t−j} | j = 0…T)] with **T = 104** (2-year moving window, weekly), and a stock-bond correlation term (weekly
average of the difference between the 4-year/1,040-business-day and 4-week/20-business-day correlation of
daily log returns of the total stock index and the 10Y Bund price index, floored at zero); *financial
intermediaries* — realised volatility of the **idiosyncratic** bank-sector equity return (OLS residual of
daily log bank return on log market return, moving 522-business-day window), A-rated financial vs
non-financial yield spread (7Y), and CMAX × book-price ratio for financials (both CDF-transformed first,
multiplied, then square-rooted); *FX* — realised volatility of EUR vs USD, JPY and GBP.
**Primary sources.** Holló, Dániel, Manfred Kremer, and Marco Lo Duca 2012, "CISS — A Composite Indicator of
Systemic Stress in the Financial System," ECB Working Paper Series No. 1426, March 2012 (Macroprudential
Research Network / MaRs).
**Confidence.** [paper-verified] — all equations, λ, the 15-indicator table, the upper-bound property and both
rejection rationales read from local extraction of the ECB PDF. [unverified]: the numeric threshold-VAR
"systemic crisis level" of the CISS, and the VAR specifications behind the 15/15/25/30/15 weights, are
described in the paper but were not in the extracted sections.

## 12.5 Kritzman & Li — The Turbulence Index (Mahalanobis Distance)
**Mechanism (as stated).** "We define financial turbulence as a condition in which asset prices, given their
historical patterns of behavior, behave in an uncharacteristic fashion, including extreme price moves,
decoupling of correlated assets, and convergence of uncorrelated assets. Financial turbulence often coincides
with excessive risk aversion, illiquidity, and devaluation of risky assets." Three trigger modes in one
scalar: extreme moves, decoupling, and convergence. A set of moves that are individually unremarkable can be
highly turbulent if the *joint configuration* violates the historical covariance structure.
**Math / Algorithm.** Mahalanobis (1936) distance. Eq. (1): d = (y − μ)Σ⁻¹(y − μ)′. Applied to returns, Eq.
(2): **d_t = (y_t − μ)Σ⁻¹(y_t − μ)′**, with d_t the scalar turbulence for period t, y_t the 1×n vector of
asset returns, μ the 1×n sample average of historical returns, Σ the n×n sample covariance. Row-vector
convention; it is the *squared* Mahalanobis distance. "The Mahalanobis distance is scale independent … The
characteristic deviations are scaled by the covariance matrix."
**Key parameters.** **Σ and μ are full-sample, not rolling** — "The average vector μ and covariance matrix Σ
in Equation 2 were calculated for the full sample from January 1980 to January 2009," a deliberate choice so
the benchmark is the entire history. n = 6 asset classes for the headline index, monthly (US stocks, non-US
stocks, US bonds, non-US bonds, commodities, US real estate). Turbulent-day threshold: the **10 percent most
turbulent days**. Parallel indices for global assets, US assets, US sectors, currencies, US fixed income, US
Treasury notes, US credit.
**Key findings.** *Turbulence is highly persistent* (Table 1, normalized average daily turbulence following
first arrival above the 10th-percentile threshold; percentile rank in parentheses): global assets 2.31(7) /
2.22(8) / 2.13(8) at 5/10/20 days, threshold 1.93; US assets 2.98(5)/2.90(5)/2.79(6), threshold 1.95; US
sectors 3.12(5)/3.04(6)/2.87(6), 2.03; currencies 2.08(8)/1.93(9)/1.80(11), 1.83; US fixed income
4.05(4)/3.85(5)/3.60(5), 2.12; US Treasury notes 3.19(5)/3.13(6)/2.96(6), 2.00; US credit
4.17(4)/4.09(4)/3.69(4), 1.61. "Markets tend to remain turbulent for up to a month or longer once turbulence
begins." The index is **coincident, not predictive**; persistence is what makes a coincident reading
actionable. *Returns to risk are substantially lower during turbulent periods irrespective of the source of
turbulence* (Figure 5, annualized daily, 4 Jan 1993 - 31 Dec 2008, across World Equities, Small−Large,
Growth−Value, naive Carry Trade and Hedge Funds): all turbulent-period bars negative, all nonturbulent
positive. *Motivating asymmetric-correlation statistic* (fn. 1): when both US and non-US equities return more
than one SD **above** their means, correlation = **−17%**; when both return more than one SD **below**,
correlation = **+76%** (monthly S&P 500 and MSCI World ex US, Jan 1970 - Feb 2008).
**Priority note.** "Chow, Jacquier, Lowrey, and Kritzman (1999) introduced a mathematical measure of
financial turbulence"; this paper extends it.
**Primary sources.** Kritzman, Mark, and Yuanzhen Li 2010, "Skulls, Financial Turbulence, and Risk
Management," *Financial Analysts Journal* 66(5):30-41.
**Confidence.** [paper-verified] for equations, parameters, Table 1 and the asymmetric-correlation statistic.
[unverified]: the Table 2 turbulent-sample VaR column (pdftotext scrambled it; only the full-sample row
7.77 / 10.12 / 12.86 is confirmed).

## 12.6 Kritzman, Li, Page & Rigobon — The Absorption Ratio (Coupling as Fragility)
**Mechanism (as stated).** "The absorption ratio captures the extent to which markets are unified or tightly
coupled. A high value for the absorption ratio corresponds to a high level of systemic risk, because it
implies the sources of risk are more unified. A low absorption ratio indicates less systemic risk, because it
implies the sources of risk are more disparate." The authors explicitly separate fragility from realized
loss: "We should not expect high systemic risk necessarily to lead to asset depreciation or financial
turbulence. It is simply an indication of market fragility in the sense that a shock is more likely to
propagate quickly and broadly when sources of risk are tightly coupled."
**Math / Algorithm.** Eq. (1): AR = Σ_{i=1}^{n} σ²_{E_i} / Σ_{j=1}^{N} σ²_{A_j}, with N the number of
assets, n the number of eigenvectors used, σ²_{E_i} the "variance of the i-th eigenvector, sometimes called
eigenportfolio," and σ²_{A_j} the "variance of the j-th asset." In prose: "the fraction of the total variance
of a set of assets explained or absorbed by a finite set of eigenvectors."
Eq. (2), the standardized shift: **ΔAR = (AR_15Day − AR_1Year)/σ**, with σ the standard deviation of the
one-year absorption ratio. ⚠ **Internal inconsistency in the paper:** the prose preceding Eq. (2) describes
AR_1Year − AR_15Day, the reverse of the printed equation. Equation (2) as printed is the one consistent with
the rest of the paper (a spike = positive ΔAR = subsequent losses).
**Key parameters.** Covariance/eigenvector window **500 days**, trailing, overlapping. Number of eigenvectors
**fixed at approximately 1/5 of the number of assets** — for US equities, 51 MSCI USA industries → **n = 10**.
The authors concede the choice is arbitrary (fn. 7: "We could instead calculate the number of eigenvectors
required to explain a fixed percentage of variance, but for no particular reason we chose to fix the number
of eigenvectors"; fn. 11: "In principle, we should condition the number of eigenvectors on the rank of the
covariance. Because the covariance matrices in our analysis are nearly full rank, we are effectively doing
this"). Variances exponentially weighted, **half-life 250 days** (half the window). Main sample 1 Jan 1998 -
31 Jan 2010; shift/drawdown results to 10 May 2010. Global version: 42 countries, Feb 1995 - Dec 2009, AR
ranges 65-85%. A Herfindahl index over per-eigenvector variance shares was tested and rejected as
"significantly less informative than our method."
**Absorption ratio ≠ average correlation.** "One might suspect that the average correlation of the assets
used to estimate the absorption ratio provides the same indication of market unity, but it does not. Unlike
the absorption ratio, the average correlation fails to account for the relevance of the asset correlations
that make up the average." Constructed counterexample (Exhibits 5-6): correlation rises between two
**high-volatility** assets while falling between two **low-volatility** assets; average correlation
*decreases* slightly, absorption ratio *increases* sharply. "The key distinction is that the absorption ratio
accounts for the relative importance of each asset's contribution to systemic risk whereas the average
correlation does not."
**Key findings.** *Drawdowns preceded by an AR spike* (Exhibit 8, 1σ shift, 1/1/1998-5/10/2010): 1-day
horizon 84.85% / 87.69% / 70.81% for the 1% / 2% / 5% worst; 1-week 84.85% / 83.08% / 75.78%; 1-month
**100.00%** / 98.46% / 89.44%. "All of the 1% worst monthly drawdowns were preceded by a one-standard
deviation spike in the absorption ratio." The authors' own qualifier, which is the one to carry: "We should
not conclude from this exhibit that a spike in the absorption ratio reliably leads to a significant drawdown
in stock prices. In many instances, stocks performed well following a spike in the absorption ratio. We would
be correct to conclude, though, that a spike in the absorption ratio is a **near necessary condition** for a
significant drawdown, just not a sufficient condition." *Subsequent returns* (Exhibit 9, annualized): after a
1σ increase −8.28% / −8.44% / −5.86% at 1 day / 1 week / 1 month, after a 1σ decrease +9.27% / +10.06% /
+12.16%, differences −17.56 / −18.50 / −18.02. *Market-timing test* (Exhibit 10, MSCI USA + Treasuries, daily
rules with 1-day lag, baseline 50/50, go 0/100 if ΔAR > +1σ and 100/0 if ΔAR < −1σ): 1.72 trades per year,
turnover 86.01%, return 9.58% vs 5.08%, risk 11.50% vs 10.89%, **return/risk 0.83 vs 0.47**. *AR leads
turbulence* (Exhibit 17): synchronizing on the 10% most turbulent 30-day periods of the MSCI USA index
(1 Jan 1997 - 10 Jan 2010), "Prior to turbulent events in the stock market, the median of the standardized
shift in the absorption ratio increased beginning about **40 days in advance** of the event, and continued to
rise throughout the turbulent periods. It then fell following the conclusion of the turbulent episodes."
**Architectural relationship to 12.5.** Turbulence is the *shock magnitude* measure; the absorption ratio is
the *conductivity* measure, and it leads turbulence by roughly 40 days. The authors position them as
complements, not substitutes.
**Primary sources.** Kritzman, Mark, Yuanzhen Li, Sebastien Page, and Roberto Rigobon 2011, "Principal
Components as a Measure of Systemic Risk," *The Journal of Portfolio Management* 37(4):112-126. Working paper:
MIT Sloan WP 4785-10, 28 June 2010; SSRN 1633027.
**Confidence.** [paper-verified] for mechanism, parameters, all exhibits and the near-necessary-not-sufficient
qualifier, from the MIT Sloan WP. [partially-verified]: JPM volume 37, issue 4, start page 112 confirmed from
the publisher URL; end page 126 from secondary citations only. The Eq. (1) numerator/denominator arrangement
is inferred from the verbatim symbol definitions and prose (the rendered equation glyph was not
text-extractable), which are unambiguous. [unverified]: the housing-market AR construction.

## 12.7 Gabaix — The Granular Origins of Aggregate Fluctuations
**Mechanism (as stated).** Idiosyncratic firm-level shocks do not average out, because the firm size
distribution is fat-tailed. Verbatim: "This paper points out that when firm size is power-law distributed,
the conditions under which one derives the central limit theorem break down and other mathematics apply. In
the central case of Zipf's law, aggregate volatility decays according to **1/ln N, rather than 1/√N**. The
strong 1/√N diversification is replaced by a much milder one that decays according to 1/ln N." The reason
large firms matter is an explicit volatility assumption (Gibrat's law for variances): the standard deviation
of a firm's percentage growth rate is independent of its size. "If Walmart doubles its number of supermarkets
and thus its size, its variance is not divided by 2, as would be the case if Walmart were the amalgamation of
many independent supermarkets. Instead, the newly acquired supermarkets inherit the Walmart shocks." A second
CLT failure: because GDP contains some very large firms, "the Lindeberg-Feller theorem does not apply," so
GDP fluctuations are typically **not Gaussian** even asymptotically.
**Math / Algorithm.** Islands economy ΔS_{i,t+1}/S_it = σ_i ε_{i,t+1}, Y_t = Σ S_it. Then
σ_GDP = [Σ_i σ_i²(S_it/Y_t)²]^{1/2} (eq. 3); with all σ_i = σ, σ_GDP = σ·h (eq. 4) where
**h = [Σ_i (S_it/Y_t)²]^{1/2}** (eq. 5), "the herfindahl" — note h is the **square root** of the sales
Herfindahl and the weights are **sales/GDP**, not value-added shares. Following Hulten (1978),
dTFP/TFP = Σ_i (sales_i/GDP)dπ_i (eq. 15), so σ_TFP = h·σ_π (eq. 17); with an endogenous factor-usage
multiplier μ, **σ_GDP = μ σ_π h** (eq. 20).
*Proposition 1* (thin tails, finite variance): σ_GDP ~ (E[S²]^{1/2}/E[S])·σ/√N.
*Proposition 2* (power law P(S > x) = a x^{−ζ}, exponent ζ ≥ 1), as N → ∞:
σ_GDP ~ (v_ζ/ln N)·σ for **ζ = 1** (eq. 8, Zipf); ~ (v_ζ/N^{1−1/ζ})·σ for **1 < ζ < 2** (eq. 9);
~ (v_ζ/N^{1/2})·σ for **ζ ≥ 2** (eq. 10). v_ζ is a *random variable* whose distribution depends on neither N
nor σ (for ζ ≤ 2 it is the square root of a stable Lévy distribution with exponent ζ/2; for ζ > 2 a
constant); "~" means convergence in distribution after scaling. Conditions: the tail index must satisfy
ζ < 2 for the failure to bite (ζ > 2 ⟺ finite variance of firm size ⟺ classical 1/√N). The knife-edge ζ = 1
requires separate treatment because E[S] = ∞, handled via Lévy's theorem with a_N = N, b_N = N ln N, giving
Y = Σ S_i ~ N ln N (eq. 14) and top-firm share S₁/Y = 1/ln N. Underlying scaling intuition, which generalizes
to any node-size problem: typical largest unit S₁ = N^{1/ζ}, k-th largest S_k = (N/k)^{1/ζ}, so top-K share
∝ N^{−(1−1/ζ)}. Appendix A (Lévy's theorem, Durrett 1996 p.153): for i.i.d. X with P(|X| > x) = x^{−ζ}L(x),
ζ ∈ (0,2), the sum scales as **N^{1/ζ}, not N^{1/2}**.
*Granular residual*, ideal (eq. 31) and empirical (eq. 32): Γ*_t = Σ_{i=1}^{K}(S_{i,t−1}/Y_{t−1})ε_it;
Γ_t = Σ_{i=1}^{K}(S_{i,t−1}/Y_{t−1})ε̂_it with ε̂_it = g_it − β̂′X_it. Productivity proxy
z_it = ln(sales_it/employees_it) (eq. 29), g_it = z_it − z_{i,t−1}. Two operational forms subtract a
cross-firm mean (eq. 33) or an industry mean (eq. 34). Theory link g_Yt = μΓ*_t. Proposition 4 gives
identification conditions requiring that observables X span the common-factor structure; Gabaix is explicit
that without a parametric restriction there is no solution (Manski 1993 reflection problem).
**Key parameters.** Firm-size power-law exponent ζ = **1.059 ± 0.054** (Axtell 2001, US Census) ⟹ Zipf.
Firm-level volatility σ_π = **12%/yr** (sales per employee; 12% sales, 14% employees). Cross-firm correlation
among the top 100: 0.023 / 0.073 / 0.033, "most variation is idiosyncratic." Sales Herfindahl h, US 2008 =
**5.3%** (Compustat); 22% average across countries. Multiplier μ = **2.6** (average of 1.8, 4.5, 1.5; Frisch
elasticity 2). Implied σ_TFP = 12% × 5.3% = 0.63%; implied σ_GDP = 2.6 × 12% × 5.3% = **1.7%** against an
observed ~1-2%. Simulated median h under Zipf at N = 10⁶ = **12%**, versus 0.1% if firms were equal-sized.
Sample: Compustat annual **1951-2008**, K = 100 largest by prior-year sales, Q = 100 or 1000, **excluding
oil/energy/finance**, 3-digit SIC industries, demeaned growth winsorized at 20%.
**Headline result.** Abstract, verbatim: "The idiosyncratic movements of the largest 100 firms in the United
States appear to explain about **one-third** of variations in output growth." The "one-third" summarizes a
range, not a single estimate. Table I (simple demeaning, 1952-2008): per-capita GDP growth on Γ_t, adjusted
R² = 0.239 (1 lag) and 0.346 (2 lags); Solow residual 0.233 / 0.239. Table II (industry-demeaned): GDP growth
adjusted R² = 0.332 / **0.477**; Solow 0.335. Predictive (Tables III/IV): lagged Γ alone adjusted R² =
**18.5%**; oil (Hamilton) + money (Romer-Romer) shocks = 10.9%; term spread = 23.1%; all predictors together
= 34.1%; Γ's incremental adjusted R² over everything else = **14.9%**. Gabaix labels this "tentative," and
flags a small-sample errors-in-variables bias that *lowers* measured R² relative to the true R², biasing
against his own hypothesis. Caveat to carry: if only aggregate shocks mattered these R² would be zero, so the
result rejects a representative-firm framework, but the reflection problem (large firms volatile *because of*
aggregate shocks) is controlled parametrically, not identified. Narrative validation (Table V) attributes
specific years to specific firms: 1952 U.S. Steel strike, 1955-57 GM/Ford price war, 1970-71 GM strike, 1974
GM fuel-economy hit, 1983 IBM PC, 1996 AT&T spin-off of NCR/Lucent, 2000 GE, 2002 Walmart. Walmart's 2001
share of US GDP was 2.2%, near GM's 3% peak (1956) and U.S. Steel's 2.8% (1917).
**Primary sources.** Gabaix, Xavier 2011, "The Granular Origins of Aggregate Fluctuations," *Econometrica*
79(3):733-772, DOI 10.3982/ECTA8769.
**Confidence.** [paper-verified] — all propositions, scaling rates, parameters and regression results read
from the author's PDF (identical pagination to the journal).

## 12.8 Acemoglu, Carvalho, Ozdaglar & Tahbaz-Salehi — The Network Origins of Aggregate Fluctuations
**Mechanism (as stated).** Input-output linkages are a propagation channel. The diversification argument
survives symmetry (no linkages, or every sector relying equally on all others) and fails under **asymmetry**
in the roles sectors play as suppliers. Two distinct causes of slow decay: **first-order interconnections** (a
sector supplying disproportionately many others transmits directly) and **higher-order interconnections**
(cascades reaching customers of customers). Headline structural claim: "the 'sparseness' of the input-output
matrix is unrelated to the nature of aggregate fluctuations" — what matters is asymmetry. Ring networks and
binary trees, though sparse and intuitively fragile, diversify at exactly √n.
**Math / Algorithm.** Cobb-Douglas Long-Plosser economy x_i = z_i^α ℓ_i^α Π_j x_ij^{(1−α)w_ij}, Σ_j w_ij = 1,
α = labor share, ε_i ≡ log z_i independent across sectors. **Influence vector** (eq. 4) and aggregate output
(eq. 3): y ≡ log(GDP) = **v′ε**, with **v ≡ (α/n)[I − (1−α)W′]⁻¹𝟙**, where [I − (1−α)W′]⁻¹ is the **Leontief
inverse** and v is a **Bonacich centrality** vector. *Relation to Domar weights:* the authors show (eq. 5)
that v **is the sales vector**, v_i = p_i x_i / Σ_j p_j x_j, the equilibrium sales share — the exact bridge to
12.7. One caveat they flag (fn. 12): unlike Hulten's formula, log shocks are multiplied by **sales shares,
not sales divided by value added**, because their shocks are Harrod-neutral whereas Hulten's are
Hicks-neutral. Weighted **outdegree** d_i ≡ Σ_j w_ji = share of sector i's output in the economy's input
supply. Under their Assumption 1 all weighted **indegrees equal 1**, which they verify approximates US data,
so the entire action is in the out-degree distribution: out-degree = how much of a supplier you are =
systemic importance.
Aggregate volatility scaling (eq. 6): (var y_n)^{1/2} = Θ(‖v_n‖₂). If ‖v_n‖₂ is bounded away from zero (star
network: ‖v_n‖₂ = Θ(1)) the law of large numbers fails outright. *Theorem 1*: y_n/‖v_n‖₂ → N(0,σ²) under
normality, or under a tail-dominance condition plus ‖v_n‖_∞/‖v_n‖₂ → 0; if that ratio does not vanish and
shocks are non-normal, the limiting distribution is **non-normal** with finite variance — the network
determines not only the rate but the shape.
*First-order.* With CV_n = (1/d̄_n)[(1/(n−1))Σ_i(d_i − d̄_n)²]^{1/2}: Theorem 2 gives (var y_n)^{1/2} =
Ω((1/n)√(Σ_i(d_i^n)²)) (eq. 7) and = Ω((1 + CV_n)/√n) (eq. 8). Corollary 1, power-law out-degree with shape
β ∈ (1,2): (var y_n)^{1/2} = Ω(n^{−(β−1)/β − δ}) for any δ > 0.
*Second-order.* Definition 3 (eq. 9): **τ₂(W_n) ≡ Σ_i Σ_{j≠i} Σ_{k≠i,j} w^n_ji w^n_ki d^n_j d^n_k**,
measuring the extent to which **high-degree sectors share common suppliers** (their Ford/GM/Chrysler
example). Provably not recoverable from the degree sequence: Example 2 constructs two economies with
identical degree sequences for all n where τ₂ = Θ(n²) versus 0, giving ‖v_n‖₂ = Θ(1) versus Θ(n^{−1/4}).
Theorem 3 (eq. 10): (var y_n)^{1/2} = Ω(1/√n + CV_n/√n + √τ₂(W_n)/n). Second-order degree
q^n_i ≡ Σ_j d^n_j w^n_ji (eq. 11); Corollary 2, power-law second-order degrees with shape ζ ∈ (1,2):
(var y_n)^{1/2} = Ω(n^{−(ζ−1)/ζ − δ}). When both first- and second-order degrees are power law, **the binding
bound is set by min{β, ζ}**.
*Converse.* Theorem 4: a sequence is *balanced* if max_i d_i^n = Θ(1); for balanced economies there exists
ᾱ ∈ (0,1) such that for α ≥ ᾱ, (var y_n)^{1/2} = **Θ(1/√n)** exactly. This generalizes Dupor (1999) and is
the source of the sparseness-irrelevance claim.
**Key parameters (BEA detailed benchmark input-output, 1972-2002).** Estimated by the Gabaix-Ibragimov (2011)
modified log-rank/log-size regression (OLS log-CCDF is downward biased in small samples), tail = top 20% of
sectors. β̂ (first-order): 1.38 / 1.38 / 1.35 / 1.37 / 1.32 / 1.43 / 1.46 across the seven benchmark years,
average **1.38**. ζ̂ (second-order): 1.14 / 1.15 / 1.10 / 1.14 / 1.15 / 1.27 / 1.30, average **1.18**. Sector
counts 483 / 524 / 529 / 510 / 476 / 474 / 417. Standard errors 0.18-0.23 (β̂), 0.15-0.20 (ζ̂). Cross-checks:
Nadaraya-Watson implied slopes 1.28 / 1.17; Clauset-Shalizi-Newman Hill-type ML 1.39 / 1.14. **The
second-order tail is always heavier than the first-order.** Implied decay: ζ̂ = 1.18 ⟹ volatility decays no
faster than **n^{−0.15}**; β̂ = 1.38 ⟹ n^{−0.28}. Both far slower than n^{−0.5}. Average intermediate input
share 0.55, stable. ‖v_n‖₂ ≈ 0.088-0.098 at the detailed level, roughly **twice** 1/√n_d, i.e. linkages at
least double the impact of sectoral shocks. Moving from 84 summary to 483 detailed sectors, diversification
predicts a 58% decline in ‖v‖₂; the observed decline is ~29%. Back-of-envelope with the NBER productivity
database (459 four-digit SIC manufacturing industries, 1958-2005, detrended, average sectoral TFP sd 0.058):
a balanced structure would give 0.058/√2295 ≈ 0.001, while the n^{−0.15} rate gives ≈ **0.018**, "in the
ballpark of the approximately 2% standard deviation of U.S. GDP" — the authors call this "merely suggestive."
Top five by first-order degree (2002): management of companies, wholesale trade, real estate, electric power,
iron and steel mills. Top five by second-order degree: management of companies, wholesale trade, real estate,
advertising, monetary authorities and depository credit intermediation.
**Stated generalization.** The results apply to any model with the representation ỹ = W̃ỹ + ε̃, where ỹ is a
vector of outputs/actions of n units, W̃ captures interactions and ε̃ independent shocks. The authors state
this explicitly as the license to port the machinery outside input-output economics. They also state the
relationship to 12.7 directly: "The intersectoral network in our model plays the same role as the firm size
distribution in Gabaix's analysis" — but the network version is more informative, because sizes are *derived*
from interactions rather than assumed, and the network additionally pins down sectoral **comovement**.
**Primary sources.** Acemoglu, Daron, Vasco M. Carvalho, Asuman Ozdaglar, and Alireza Tahbaz-Salehi 2012,
"The Network Origins of Aggregate Fluctuations," *Econometrica* 80(5):1977-2016, DOI 10.3982/ECTA9623.
**Confidence.** [paper-verified] from the MIT-hosted PDF of the published article. Note the authors' own
caution that n^{−0.15} is a **lower bound extrapolated** from the estimated second-order tail index under an
explicitly "speculative" scale-free assumption at finer disaggregation than the BEA data provides.

## 12.9 Diebold & Yilmaz — Connectedness from Forecast-Error Variance Decompositions
**Mechanism (as stated).** Connectedness is defined as **shares of forecast error variance in variable i
attributable to shocks in variable j, for i ≠ j**. The MA coefficients contain the dynamics, but hundreds of
coefficients are "typically fruitless" to read directly, so a transformation is needed, and variance
decompositions achieve it. Their slogan: "The key is i ≠ j." In 2014 the structural claim becomes explicit:
"variance decompositions **are** networks. More precisely, the variance decomposition matrix D, which defines
our connectedness table and all associated connectedness measures, is a network adjacency matrix A."
**Math / Algorithm.** Covariance-stationary N-variable VAR(p) x_t = Σ_i Φ_i x_{t−i} + ε_t, ε ~ (0,Σ) iid;
MA x_t = Σ_i A_i ε_{t−i} with A_i = Φ₁A_{i−1} + … + Φ_p A_{i−p}, A₀ = I_N.
*2009 (Cholesky).* x_t = A(L)u_t with A(L) = Θ(L)Q⁻¹, u_t = Qε_t, E(u_t u_t′) = I, Q⁻¹ the unique
lower-triangular Cholesky factor. S = 100 · [Σ_{h=0}^{H−1} Σ_{i≠j} a²_{h,ij}] / [Σ_{h=0}^{H−1} tr(A_h A_h′)].
**Ordering dependence** is the acknowledged flaw: "DY relies on Cholesky-factor identification of VARs, so
the resulting variance decompositions can be dependent on variable ordering. One would prefer a spillover
measure invariant to ordering." Nuance often misquoted: "We often find that **total** connectedness is robust
to Cholesky ordering … **Directional** connectedness, however, is sometimes more sensitive to Cholesky
ordering, which enhances the appeal of GVDs." GVDs are not assumption-free either (fn. 2 of the 2014 paper
notes they assume normality of shock distributions).
*Generalized (KPPS) variance decomposition* (Koop-Pesaran-Potter 1996; Pesaran-Shin 1998). Mechanism as
stated: "Instead of attempting to orthogonalize shocks, the generalized approach allows correlated shocks but
accounts for them appropriately using the historically observed distribution of the errors. As the shocks to
each variable are not orthogonalized, the sum of contributions to the variance of forecast error … is not
necessarily equal to one."

    θ^g_ij(H) = σ_jj⁻¹ · Σ_{h=0}^{H−1}(e_i′ A_h Σ e_j)²  /  Σ_{h=0}^{H−1}(e_i′ A_h Σ A_h′ e_i)

with Σ the covariance matrix of ε, e_j a selection vector, and **σ_jj the j-th diagonal element of Σ (a
variance)**. ⚠ **Implementation discrepancy worth recording:** the March-2010 working paper prints σ_ii⁻¹ and
calls it "the standard deviation of the error term for the i-th equation." That is wrong, and the same
authors say so — 2014 fn. 4: "Note the typo in the original paper of Pesaran and Shin (1998), p. 20. They
write σ⁻¹_{ii} but should have written σ⁻¹_{jj}." Implement **σ_jj = Σ[j][j]**, a variance.
Normalization (row sums ≠ 1 under GVD): θ̃^g_ij(H) = θ^g_ij(H)/Σ_j θ^g_ij(H), so Σ_j θ̃^g_ij = 1 and
Σ_{i,j} θ̃^g_ij = N. Total: S^g(H) = 100·[Σ_{i≠j} θ̃^g_ij(H)]/N; 2014 decimal form C^H = (1/N)Σ_{i≠j} d^H_ij.
Exactness caveat (2012 fn. 7): under GVD the "off-diagonal over total" identity is **approximate**; under
Cholesky it is exact — which is why the 2014 paper calls the block an *approximate* variance decomposition
matrix.
Directional measures: FROM others to i, S^g_{i←·}(H) = 100·[Σ_{j≠i}θ̃^g_ij]/[Σ_j θ̃^g_ij] (row sum, = 1);
TO others from i, S^g_{·←i}(H) = 100·[Σ_{j≠i}θ̃^g_ji]/[Σ_j θ̃^g_ji] (column sum, unconstrained); NET = TO −
FROM; NET PAIRWISE S^g_ij(H) = 100·[θ̃^g_ij/Σ_k θ̃^g_ik − θ̃^g_ji/Σ_k θ̃^g_jk]. Because "to" denominators are
column sums, **"to others" can exceed 100 while "from others" cannot** — this asymmetry is the point of the
2012 title ("Better to Give than to Receive").
*Network mapping.* D departs from a classical adjacency matrix in three ways the authors enumerate: entries
are weights in [0,1] not 0/1; links are directed so A is generally **not symmetric**; row sums are
constrained to 1 so the diagonal A_ii = 1 − Σ_{j≠i}A_ij is **not zero**. From-degree δ^from_i = Σ_{j≠i}A_ij,
support [0,1]; to-degree δ^to_j = Σ_{i≠j}A_ij, support [0,N]. Verbatim: "our total directional connectedness
measures C_{i←·} and C_{·←j} are precisely the from-degrees and to-degrees … our total connectedness measure
C is simply the **mean degree** of the network D," motivated via the Erdős-Rényi diameter approximation
s_max ~ ln N / ln E(δ). Their trade analogy: pairwise directional ≈ bilateral imports/exports, net pairwise ≈
bilateral trade balances, total directional ≈ total exports/imports, net total directional ≈ a country's
trade balance, total connectedness ≈ total world exports.
**Key parameters.** Formal dependence C(x, H, A(L), M(L;θ)) — reference universe, horizon, true dynamics,
approximating model; time-varying estimate Ĉ_t(x, H, M_{t−w:t}(θ̂)). Two warnings worth carrying:
"Connectedness measurements generally will not, and should not, be robust to choice of reference universe,"
and "there is no reason why connectedness should be 'robust' to H" — longer H lets lagged/contagion-style
connectedness appear that short H cannot see. They suggest anchoring H to a decision (H = 10 "would cohere
with the 10-day value at risk (VaR) required under the Basel accord"). Rolling window: "a uniform one-sided
estimation window of width w, sweeping through the sample," with the cost that "Rolling windows do, however,
require choice of window width w, in a manner precisely analogous to bandwidth choice in density estimation";
expanding windows are rejected as too slow to adapt. Specifications: 2009 — 19 global equity markets, weekly
returns + Garman-Klass range volatilities, Jan 1992-Nov 2007, VAR(2) by Schwarz, Cholesky, H = 10 weeks,
w = **200 weeks**. 2012 — 4 US asset classes, daily Parkinson range volatility, Jan 1999-Jan 2010, 2771 obs,
VAR(4), H = 10 days, w = **200 days**. 2014 — 13 US financial institutions, daily log realized volatility
from 5-minute TAQ returns (78 intervals/day), May 1999-Apr 2010, VAR(3), H = **12 days**, w = **100 days**.
Parkinson estimator σ̃²_it = 0.361[ln(P^max_it) − ln(P^min_it)]².
**Key findings.** *2009:* "almost forty percent of forecast error variance comes from spillovers, both for
returns (36 percent) and volatilities (40 percent)." The central result is a **divergence in dynamics**:
"return spillovers display a gently increasing trend but no bursts, whereas volatility spillovers display no
trend but clear bursts." Many well-known events produced large volatility spillovers while none produced
return spillovers. *2012:* full-sample total volatility spillover only **12.6%**; stocks the largest net
transmitter (+5.05), FX a net receiver (−2.8); the rolling index runs 10-20% for most of the sample and "by
far exceed[s] the thirty percent level, during the global financial crisis of 2007-2009," in four waves.
*2014:* full-sample total connectedness **78.3%**. The structurally important finding is the **asymmetry
between the to- and from-degree distributions**: "the spread of the 'from' degree distribution is noticeably
less than that of the 'to' degree distribution." From-degree spans **12 points** (70% Fannie/Freddie to 82%
Wells Fargo/PNC); to-degree spans **53 points** (53% Fannie Mae to **106% Citigroup**). "While the financial
stocks are largely similar in terms of receiving volatility shocks from others, they are highly
differentiated as transmitters." Net leaders Citigroup +26.5, BofA +18.8, AmEx +13.0, JPM +8.9; net receivers
AIG −18.7, PNC −18.2, Fannie Mae −17.4, Goldman −15.2, BNY Mellon −9.9. A dynamic finding that cuts against
the naive reading: "even though for each stock the 'from' connectedness reached the highest levels during the
2007-08 crisis, we do **not** observe such a level shift in the 'to' and 'net' connectedness measures over
the same period" — instead the "to" distribution becomes **more right-skewed** in crisis, a few firms
transmitting very heavily.
**Primary sources.** Diebold, F.X. & Yilmaz, K. 2009, "Measuring Financial Asset Return and Volatility
Spillovers, with Application to Global Equity Markets," *Economic Journal* 119(534):158-171, DOI
10.1111/j.1468-0297.2008.02208.x. 2012, "Better to Give than to Receive: Predictive Directional Measurement
of Volatility Spillovers," *International Journal of Forecasting* 28(1):57-66. 2014, "On the Network Topology
of Variance Decompositions: Measuring the Connectedness of Financial Firms," *Journal of Econometrics*
182(1):119-134. 2015, *Financial and Macroeconomic Connectedness: A Network Approach to Measurement and
Monitoring*, Oxford University Press.
**Confidence.** [paper-verified] for all equations and findings, read in the authors' **working-paper
versions** (NBER WP 13811, Koç-TÜSİAD ERF WP 1001 rev. March 2010, NBER WP 17490). [unverified]: published
typesetting, page numbers and published equation numbering were not diffed against these; whether the
published IJF version corrected the σ_ii/σ_jj slip; the 2015 OUP book (bibliographic details only, no text
read, no claim made about contents).

## 12.10 Billio, Getmansky, Lo & Pelizzon — Granger-Causality Networks and PCAS
**Mechanism (as stated).** Direct exposure and leverage data across sectors is proprietary and unavailable to
any single regulator, so connectedness must be inferred **indirectly from statistical properties of market
returns**. Two complementary channels: PCA captures *contemporaneous commonality* (few components explaining
most variance ⟹ shared risk exposures), Granger causality captures *lagged, directional spillover*. Granger
causality in monthly returns should be zero under informational efficiency; its presence is attributed to VaR
constraints, transaction costs, borrowing constraints, information-processing costs and short-sale
restrictions, which also prevent it from being arbitraged away.
**Math / Algorithm.** *PCA layer.* With R_S = Σ_i R_i and z_k ≡ (R_k − μ_k)/σ_k: σ_S² = Σ_iΣ_j σ_iσ_j E[z_iz_j]
(1); z_i = Σ_k L_ik ζ_k with E[ζ_kζ_l] = λ_k if k = l else 0 (2,3); E[z_iz_j] = Σ_k L_ik L_jk λ_k (4);
σ_S² = Σ_iΣ_jΣ_k σ_iσ_j L_ik L_jk λ_k (5). **Cumulative Risk Fraction** (6): Ω ≡ Σ_{k=1}^{N}λ_k,
ω_n ≡ Σ_{k=1}^{n}λ_k, **h_n ≡ ω_n/Ω ≥ H**. **PCAS** (7-8): PCAS_{i,n} = ½·(σ_i²/σ_S²)·(∂σ_S²/∂σ_i²)|_{h_n≥H}
= Σ_{k=1}^{n}(σ_i²/σ_S²)L²_ik λ_k |_{h_n≥H}. Note PCAS is **conditional on h_n ≥ H**: only defined when a
strong common component is present.
*Granger layer, bivariate VAR(1)* (9): R^i_{t+1} = a_i R^i_t + b_ij R^j_t + e^i_{t+1} and symmetrically; j
Granger-causes i iff b_ij ≠ 0, feedback if both; lag length by **BIC**, inference by **F-tests**.
*Heteroskedasticity correction* (the main upgrade over the 2010 working paper): a per-institution GARCH(1,1)
baseline R^i_t = μ_i + σ_it ε^i_t, σ²_it = ω_i + α_i(R^i_{t−1} − μ_i)² + β_i σ²_{it−1} (10), conditioned on
the system information set (11), with the Granger test then run on **standardized returns
R̃^i_t = R^i_t/σ̂_it** (12). Hedge-fund autocorrelation additionally filtered with Getmansky-Lo-Makarov (2004)
as robustness.
*Network statistics*, all conditional on DGC ≥ K: **DGC ≡ [1/(N(N−1))]Σ_iΣ_{j≠i}(j→i)** (14);
#Out (j→S) = [1/(N−1)]Σ_{i≠j}(j→i), #In (S→j) = [1/(N−1)]Σ_{i≠j}(i→j), #In+Out = the average of the two (15);
sector-conditional versions with M = 4 types and normalizer (M−1)N/M (16-18); Closeness
(j —C→ i) = (j→k₁)(k₁→k₂)···(k_{C−1}→i) (19), C_ji = min_C{C ∈ [1,N−1] : (j —C→ i) = 1} set to N−1 if no
path (20), C_jS = [1/(N−1)]Σ_{i≠j}C_ji(j —C→ i) (21); Eigenvector centrality [A]_ji = (j→i) (22),
Av = v at eigenvalue 1 (23), v_j = Σ_i [A]_ji v_i (24). Note the direction: **v_j sums the centralities of
institutions caused by j**, so it scores transmission, not reception. Uniqueness by Perron-Frobenius.
*Nonlinear layer.* Two-state Markov-switching R_{j,t} = μ_j(Z_{j,t}) + σ_j(Z_{j,t})u_{j,t} (25); joint chain
Y_t ≡ (Z_h,t, Z_b,t) (26-27); non-causality restrictions (28-30) tested by **likelihood-ratio tests**
(Billio & Di Sanzo 2009). Because of parameter count these run on **four value-weighted sector indexes'
S&P-500-residual returns, not the 100 individual firms**.
*Illiquidity.* Following Lo (2002) and Getmansky-Lo-Makarov (2004), **first-order return autocorrelation ρ₁
is the illiquidity proxy**. Leverage proxy = (Total Assets − Equity Market Value)/Equity Market Value.
**Key parameters.** Four sectors (hedge funds, banks, broker/dealers, insurers), **monthly returns only**,
**Jan 1994 - Dec 2008**. Hedge funds from TASS Tremont (8,770 funds, Live + Defunct); banks/brokers/insurers
from CRSP, SIC 6000-6199 / 6200-6299 / 6300-6499. The 25 largest per sector by average AUM or market cap
**during the time period considered**, so selection is re-done inside each window and the 100-institution
panel changes over time. N = 100, M = 4, **9,900 directed pairs**. Rolling window **36 months** (60-month
robustness), **145 overlapping windows**. Edge significance **5%**. DGC threshold K = **0.055**, the 95th
percentile of a Monte Carlo null (100 independent series, 500 reps; null centered at 0.052, 90% mass in
[0.049, 0.055]). CRF thresholds H = **33.74% (n=1), 74.48% (n=10), 91.67% (n=20)**.
**Key findings.** *Directionality:* "the returns of banks and insurers seem to have more significant impact
on the returns of hedge funds and broker/dealers than vice versa," an asymmetry that "became highly
significant prior to the Financial Crisis of 2007-2009." Quantified for 2006-2008: banks → hedge funds =
**23% of possible connections, 142 significant links**; hedge funds → banks = **5%, 31 links**. Alongside
this, "hedge funds may be the 'canary in the cage' that first experience losses when financial crises hit."
The published JFE abstract narrows it to asymmetry "with banks playing a much more important role in
transmitting shocks than other financial institutions." *Connectedness rises before and during crises:* total
significant connections 583 (6%) in 1994-1996 → 856 (9%) in 1996-1998 (+50%, just before/during LTCM) → 611
(6%) in 2002-2004 → **1,244 (13%) in 2006-2008**, the sample maximum. *PCA:* PC1 ranges **24-43%**, peaking
at 43% in August 1998 and again October 2008; over 2007-2009 PC1 = 37% and the first 10 PCs = 83%. Sample
averages PC1 = 33%, PC1-10 = 74%, PC1-20 = 91%. Correlation of GARCH system variance with CRF = 0.41; of h₁
with number of connections = 0.50; of system variance with connections = 0.43 — related but not redundant,
and they diverge in 2001-2006. *Out-of-sample:* two 36-month estimation windows (Oct 2002-Sep 2005, Jul
2004-Jun 2007), crisis window Jul 2007-Dec 2008, dependent variable the rank of Max%Loss. **Significant:
#Out, #Out-to-Other, #In+Out-Other, Closeness, Eigenvector Centrality, PCAS. Not significant: #In,
#In-from-Other.** The stated interpretation is the finding to carry: the firms that lost most were those that
**affected** others, not those affected by others. Oct02-Sep05 univariate: PCAS 1 β = 0.35 (t = 3.46),
Out-to-Other β = 0.32 (t = 3.11), Out / Closeness β = 0.23 (t = 2.23), Eigenvector Centrality β = 0.24
(t = 2.31). Multivariate (controlling leverage, size, ρ₁, PCAS 1): network measures survive, **size is never
significant**, leverage is positively related to Max%Loss; R² 0.19-0.27 and 0.08-0.17. Top-ranked on Out /
Out-to-Other: Wells Fargo, Bank of America, Citigroup, Fannie Mae, UBS, Lehman Brothers Holdings, Wachovia,
Bank of New York, AIG, Washington Mutual. Granger-network measures are **not** consistently correlated with
realized contemporaneous tail risk during the crisis while PCAS measures are, which the authors read as
Granger measures capturing *non-contemporaneous* loss spillover. *Illiquidity:* asset-weighted autocorrelation
was negative for all institutions in the first four windows and turned positive for all four sectors in
2006-2008, read as maximum illiquidity coinciding with maximum connectivity. *Nonlinear:* nonlinear tests find
**more** interconnectedness than linear, supporting Danielsson-Shin-Zigrand endogenous volatility feedback.
**Two corrections recorded to prevent misquotation.** (a) **The paper makes no numeric lead-time claim.**
There is no "N months of warning" statement anywhere; only the qualitative claim that the measures "may be
useful out-of-sample indicators of systemic risk." A lead time can be *inferred* from the design (the earlier
estimation window ends Sept 2005, roughly 22 months before the crisis window opens; the later ends June 2007,
1 month ahead) but is not asserted. Structurally, 36-month rolling windows of monthly data floor the
responsiveness at months, not days. (b) **1994-1996 is the paper's tranquil baseline, not a crisis.** Any
"1994 crisis" attribution to this paper is unsupported.
**Version discrepancy.** NBER WP 16223 (July 2010), titled "Econometric Measures of *Systemic Risk*…", is a
substantially different paper and a frequent source of misquotation. There PCA is applied to only **four
sector indexes**, so PC1 = **77% (1994-2000) / 83% (2001-2008)** and PC1+PC2 = 92%, not the 24-43% of the JFE
version. Anyone citing "the first principal component explains 83%" is citing the working paper's index-level
result, not the published firm-level one. The NBER draft also has **no CRF, no PCAS, no DGC, no formal eqs.
14-24**.
**Primary sources.** Billio, Monica, Mila Getmansky, Andrew W. Lo, and Loriana Pelizzon 2012, "Econometric
measures of connectedness and systemic risk in the finance and insurance sectors," *Journal of Financial
Economics* 104(3):535-559, DOI 10.1016/j.jfineco.2011.12.010.
**Confidence.** [paper-verified] from the accepted-manuscript version (SSRN 1963216 / Ca' Foscari WP
21/WP/2011) read in full; journal citation confirmed via RePEc. [unverified]: typeset JFE page and equation
numbering (ScienceDirect returned 403); Online Appendices O.1-O.4, including the co-kurtosis derivation
relating PCAS to multivariate tail dynamics.

## 12.11 Baker, Bloom & Davis — Economic Policy Uncertainty from Newspaper Text
**Mechanism (as stated).** Newspaper coverage is treated as a *sampling instrument on discourse*, not as a
direct reading of the economy. The claim is deliberately modest: that the frequency with which journalists
jointly invoke the economy, policy and uncertainty tracks the intensity of societal concern about economic
policy uncertainty. The authors never claim the index measures uncertainty itself, and they validate against
human readers of the same articles rather than against economic outcomes.
**Math / Algorithm.** *Search rule.* Ten newspapers (USA Today, Miami Herald, Chicago Tribune, Washington
Post, LA Times, Boston Globe, SF Chronicle, Dallas Morning News, NYT, WSJ), digital archives from January
1985. An article counts only if it contains a term from **all three** sets (strict conjunction):
**Uncertainty** — "uncertainty" or "uncertain"; **Economy** — "economic" or "economy"; **Policy** —
"Congress", "deficit", "Federal Reserve", "legislation", "regulation", or "White House". Variants
("uncertainties", "regulatory", "the Fed") included. For the long-span historical indexes back to 1900 the E
set adds "business", "industry", "commerce", "commercial" and the P set adds "tariff" and "war". Scale check:
**only 0.5 percent of all articles in the ten papers satisfy the E and U criteria at all** — the triple is a
very narrow filter.
*Normalization, verbatim, with T1 the standardization interval and T2 the normalization interval:* "(i)
Compute the times-series variance, σ²_i, in the interval T1 for each paper i. (ii) Standardize X_it by
dividing through by the standard deviation σ_i for all t. This operation yields for each paper a series Y_it
with unit standard deviation in the interval T1. (iii) Compute the mean over newspapers of Y_it in each month
to obtain the series Z_t. (iv) Compute M, the mean value of Z_t in the interval T2. (v) Multiply Z_t by
(100/M) for all t to obtain the normalized EPU time-series index." For the US index both T1 and T2 are
**1985-2009**. Compactly:

    X_it  = EPU_it / TotalArticles_it        scale by outlet volume  ← "share, not count"
    Y_it  = X_it / sd_{T1}(X_i)              unit sd PER PAPER, before averaging
    Z_t   = (1/10) Σ_i Y_it                  average across papers
    EPU_t = Z_t · (100 / mean_{T2}(Z))       rescale to mean 100 (cosmetic)

The authors' stated reason for step (i): "An obvious difficulty with these raw counts is that the overall
volume of articles varies across newspapers and time." Three properties: division by outlet volume happens
**per outlet per period**, not globally; unit-variance standardization happens **per outlet before
averaging**, so a high-variance outlet cannot dominate; and the final 100 is **cosmetic only**. Where a
platform will not report a total, they substitute a neutral denominator: "search platform limitations
preclude us from scaling by the count of all articles. In these cases, we instead scale by the count of
articles containing the common and neutral term 'today'."
**Validation, including the human audit.** Six months developing the process, eighteen months running it.
Supervised teams read and coded **12,009 articles** spanning **1900-2012** from eight newspapers, preceded by
a **2,000-article pilot** with about 20 percent double-coded which produced a **65-page audit guide** used
for training. Each auditor did at least 100 trial codings outside the sample plus one-on-one review. Articles
were presented in **randomized order** so auditor learning effects would not be confounded with differences
across papers or over time. About **one quarter of articles were assigned to multiple auditors**. Sampling was
deliberately *not* random over all articles — they sample from the universe already satisfying E and U, since
only 0.5% pass, and the audit exists to select and evaluate the **P** term set.
*How the audit picked the terms.* Auditors recorded which policy terms appeared in EPU-relevant passages,
yielding 15 candidates. The authors then evaluated **approximately 32,000 term-set permutations** of four or
more terms, generating a computer label EPU_C for every audited article and comparing to the human label
EPU_H, selecting the set **minimizing the gross error rate, defined as the sum of the false positive and
false negative rates**. "Tax" is the instructive rejection: it materially lowered false negatives but raised
false positives more.
*Measured agreement.* **Correlation 0.86** between human and computer EPU indexes, quarterly, 1985-2012;
**0.93** annual, 1900-2010. And the property that actually licenses the index: net error (computer minus
human) correlates **−0.02** with quarterly real GDP growth and **0.004** with the true human EPU rate — the
classifier's error is not systematically larger in booms or busts and does not scale with the level of
uncertainty. The term set was chosen with **no use of time-series variation**, so 0.86 is a genuine
out-of-criterion check.
*Other validations.* Left- vs right-leaning newspaper subsets (split by the Gentzkow-Shapiro slant index)
correlate **0.92**. Correlation with **VIX is 0.58**. Swapping the P set for "stock price"/"equity
price"/"stock market" produces a news index correlating **0.73 with VIX**. Beige Book policy-uncertainty
mentions correlate 0.54; policy-triggered large daily stock jumps 0.78 annually; Jurado-Ludvigson-Ng
correlates **0.42** with EPU.
**Key parameters.** 10 newspapers; 3-set strict conjunction; T1 = T2 = 1985-2009; 12,009 audited articles;
~32,000 term-set permutations; 0.5% base pass rate on E∧U. The daily NewsBank index (~1,500 papers)
correlates 0.85 with the 10-paper monthly index, but the authors warn "because papers enter and leave the
NewsBank archive, and its count of newspapers expands greatly over time, compositional shifts potentially
distort the longer term behavior."
**Limits the authors acknowledge.** Only **5 percent** of EPU_H = 1 articles mainly discuss *declines* in
policy uncertainty — "apparently, reporters and editors do not regard falling uncertainty as particularly
newsworthy." The index is roughly **20-to-1 asymmetric toward detecting rises over falls**. EPU is on average
**16 log points higher during the month of a national election** (t = 5.3, 12 countries, 62 elections), and
the share of articles about *who* will make policy **triples in presidential election years** — calendar
composition, not economic severity.
**Primary sources.** Baker, Scott R., Nicholas Bloom, and Steven J. Davis 2016, "Measuring Economic Policy
Uncertainty," *Quarterly Journal of Economics* 131(4):1593-1636, DOI 10.1093/qje/qjw024. NBER WP 21633. Audit
guide: policyuncertainty.com/Audit_Guide.pptx.
**Confidence.** [paper-verified] from full text extraction of the published QJE PDF and the authors' NBER
version. **Verified absent** (checked by grep, recorded because their absence is itself informative): the
paper reports **no numeric gross error rate, false positive rate or false negative rate** anywhere in the
main text, and reports **no inter-rater agreement among the human auditors** despite double-coding 25
percent — treat any specific accuracy percentage quoted elsewhere as unverified. Also verified absent: **no
discussion anywhere of the news hole, editorial crowd-out, attention/salience bias, declining circulation, or
newsroom staffing** as threats to the index. The scaling step handles volume drift mechanically, but the
paper never engages the attention-bias critique on its own terms.

## 12.12 Bloom — Uncertainty Shocks and the Region of Inaction
**Mechanism (as stated).** Firms face **nonconvex adjustment costs** — partial irreversibility (capital
resale loss, per-capita hiring and firing costs) plus fixed disruption costs, both entering via indicator
functions. These generate a **region of inaction** in (A/K, A/L) space with A a composite business-conditions
index. Verbatim: "Firms only hire and invest when business conditions are sufficiently good, and only fire
and disinvest when they are sufficiently bad. When uncertainty is higher, this region of inaction expands,
firms become more cautious in responding to business conditions." The investment band is wider than the
hiring band because capital adjustment costs are larger. Magnitude of the real-options wedge: moving from low
to high uncertainty is equivalent to a **25 percent wage cut** for the marginal hiring decision and a **700
basis point interest rate cut** for the marginal investment decision. *Second effect, policy
ineffectiveness:* after the shock the thresholds jump outward, so no units sit near a threshold and the
economy goes insensitive to prices. Feeding in the actual estimated factor-price responses (interest rates
down up to 1.1 points, prices down 0.5 percent, wages down 0.3 percent) produces almost no immediate output
effect, peaking at 3-5 months when the shock has already faded. Since the shock is worth ~700bp, a 110bp cut
cannot pull the thresholds back. His conclusion: "This cautions against using first-moment policy levers to
respond to the second-moment component of shocks."
**Math / Algorithm.** *The measure is the VXO, not the VIX* — implied volatility on a hypothetical
at-the-money **S&P100** option, **30 days to expiration**, from **1986** onward. Before 1986 the series is the
**monthly standard deviation of daily S&P500 returns, normalized to the same mean and variance as the VXO
over the 1986-onward overlap**; the two correlate **0.874** on the overlap. Figure 1 caps monthly values at 50
for display; true peaks are 58.2 (Black Monday) and 64.4 (credit crunch).
*Shock identification:* months where volatility exceeds **1.65 standard deviations above the Hodrick-Prescott
detrended mean**, **λ = 129,600**. The 1.65 is the 5 percent one-tailed level treating each month as
independent. The threshold is applied to the *detrended* series while Figure 1 plots the raw one.
*VAR:* monthly, **June 1962 - June 2008**, Cholesky-identified, 8 variables ordered log S&P500, volatility
shock indicator, Fed Funds rate, log average hourly earnings, log CPI, hours, log employment, log industrial
production; all HP-detrended with λ = 129,600 except the 0/1 indicator; **12 lags**.
**Key parameters.** **17 shocks** in the published Econometrica paper; the 2007 NBER working paper lists
**16** (the credit crunch is the addition) — do not treat the versions as interchangeable. Proxy validation
(Table I), volatility regressed on four independent dispersion measures normalized to unit sd: firm pretax
profit growth dispersion **0.532**, firm stock return dispersion **0.543**, industry TFP growth dispersion
**0.429**, Livingston GDP forecast dispersion **0.614** — so the average 2.47 sd volatility rise after a shock
maps to a 1.31 sd rise in the cross-sectional spread of profit growth.
**Key findings.** Stated magnitudes: "Industrial production displays a rapid fall of around 1% within 4
months, with a subsequent recovery and rebound from 7 months after the shock," significant at 5 percent. The
paper prints **no separate numeric magnitude for employment**, saying only "similar." Orthogonalized IRF
values recovered from the author's own replication data (`irf.dta`, specification `kitchen`), industrial
production / employment: month 2 −0.90 / −0.49; **month 4 −0.98 (IP trough) / −0.60**; **month 5 −0.69 /
−0.68 (employment trough)**; month 7 +0.10 / −0.20; **month 9 +1.15 (IP peak) / +0.14**; month 13 +0.93 /
**+0.33 (employment peak)**. The IP overshoot (+1.15) actually exceeds the initial drop (−0.98) in absolute
terms, which the paper's "milder long-run overshoot" understates.
*The contrast that does the identification work:* a 1 percent Fed Funds impulse produces "a much more
persistent drop and recovery of up to 0.7% over the subsequent 2 years," with the introduction putting
first-moment dynamics at 2-3 years. Second- and first-moment shocks have **qualitatively different shapes** —
sharp drop plus rebound plus overshoot within ~6 months, versus a slow persistent decline over years. Bad
news alone cannot generate the overshoot. Bloom also orders stock *levels* first in the VAR so levels are
pre-controlled, reports low correlations between the volatility indicator and detrended stock levels (−0.192
main, −0.136 exogenous subsample, −0.340 continuous volatility index), and re-runs on war/oil/terror events
only. *Two mechanisms, separated:* the *uncertainty* effect (expectations, instant, drop and return to trend)
and the *volatility* effect (realized, delayed, level overshoot via a right-skewed cross-sectional density
making hiring locally convex) are decoupled in Figure 9. "The uncertainty drop always precedes the volatility
overshoot."
**Primary sources.** Bloom, Nicholas 2009, "The Impact of Uncertainty Shocks," *Econometrica* 77(3):623-685,
DOI 10.3982/ECTA6248.
**Confidence.** [paper-verified] for mechanism, VXO splice, HP λ, VAR specification and stated magnitudes,
from the published typeset PDF plus the author's replication package. **Replication-derived, not printed in
the article:** the exact IRF values above (figures only in the paper) and the VAR lag length of 12 (from the
working paper and `lags(1(1)12)` in the code). **Unresolved discrepancy:** the text refers to "the 10
exogenous shocks arising from wars, OPEC shocks, and terror events" but Table A.1 sums to 9 (Terror 3, War 4,
Oil 2) — do not present 10 as derivable from the table. **Verified absent:** no discussion anywhere of risk
aversion, risk premia or the variance risk premium as a confound for implied volatility, and no explicit
caveat on volatility being endogenous to the real economy. Those objections belong to 12.13.

## 12.13 Jurado, Ludvigson & Ng — Uncertainty as the Unforecastable Component (the critique entry)
**Mechanism (as stated).** The premise: "what matters for economic decision making is not whether particular
economic indicators have become more or less variable or disperse per se, but rather whether the economy has
become more or less predictable; that is, less or more uncertain." The central objection, verbatim:

> "The proper measurement of uncertainty requires removing the forecastable component E[y_jt+h | I_t] before
> computing conditional volatility. **Failure to do so will lead to estimates that erroneously categorize
> forecastable variations as 'uncertain.'** Thus, uncertainty in a series is not the same as the conditional
> volatility of the raw series where, for example, a constant mean is removed: it is important to remove the
> entire forecastable component. While this point may seem fairly straightforward, it is worth noting that
> almost all measures of stock market volatility (realized or implied) or cross-sectional dispersion
> currently used in the literature do not take this into account."

**A quantity can be highly variable and perfectly predictable, and that variability is not uncertainty.**
Mechanism-specific objections: stock volatility moves with leverage, risk aversion and sentiment without any
change in fundamentals uncertainty; the VIX "has a large component that appears driven by factors associated
with time-varying risk-aversion rather than economic uncertainty" (citing Bekaert-Hoerova-Duca, not their own
decomposition); cross-sectional dispersion can move purely from heterogeneous factor loadings or
heterogeneous cyclicality, and "has no forward looking component; it is the same for all horizons";
forecaster disagreement "could be more reflective of differences in opinion than of uncertainty." Second
conceptual point: macro uncertainty is not the uncertainty in any one series but "a measure of the common
variation in uncertainty across many series," since purely idiosyncratic variance would not move aggregates.
**Math / Algorithm.** Eq. (1): **U_jt(h) = sqrt( E[ (y_j,t+h − E[y_j,t+h | I_t])² | I_t ] )** — the
conditional expectation of the **squared forecast error**, not the conditional volatility of the raw series.
Aggregate uncertainty U_t(h) = E_w[U_jt(h)], eq. (2). Construction: **132 macro series + 147 financial series
= 279** used to estimate factors, 1960:1-2011:12, estimates 1960:7-2011:12 (618 observations). **Critical
asymmetry:** uncertainty is computed from the **132 macro series only**; the 147 financial series enter as
*predictors*, never as uncertainty targets. Stated reason (fn. 8): otherwise "their greater volatility will
dominate the uncertainty measure and we will get back an aggregate financial market volatility variable as
uncertainty." Factors: static principal components, Bai-Ng (2002) criterion selects **12 factors** explaining
~54 percent of variation (first three: 37, 8, 3 percent). Forecasting model: factor-augmented diffusion index
regression including **squares of the first factor and factors extracted from squared raw data**; Bai-Ng
(2008) hard thresholding retains a predictor only if |t| > **2.575**; four lags of the dependent variable
always included. Stochastic volatility on the forecast-error residuals, **AR(1) in log volatility**,
log(σ_t)² = α + β log(σ_{t−1})² + τη_t, by **Bayesian MCMC** (R `stochvol`), chosen over GARCH specifically
because SV "permits the construction of a shock to the second moment that is independent of innovations to
y_j itself." Aggregation: **equal-weighted average** (eq. 12), with a first-principal-component alternative
giving similar results. Horizons h = 1, 3, 12 months.
**Key findings.** *Rarity:* "consider the 17 uncertainty dates defined in Bloom (2009)... By contrast, in a
sample extending from 1960:7 to 2011:12, our measure of macro uncertainty exceeds (or comes close to
exceeding) 1.65 standard deviations from its mean a total of only **49 (out of 618) months**, each of which
are bunched into three deep recession episodes" — **1973-74, 1981-82, 2007-09**. Two honesty caveats: at
h = 3 and h = 12 it is only *two* episodes; and under Bloom's own HP-trend convention rather than the
unconditional mean, theirs yields 5 episodes rather than 3, still against Bloom's 17. *Persistence* (Table 1,
monthly): their measure **AR(1) 0.99, half-life 53.58 months**; VXO **AR(1) 0.85, half-life 4.13 months**;
cross-sectional stock return dispersion 0.70 and 1.92 months. More persistent than every proxy at every
frequency tested. *Correlation with VXO 0.45* (figure note; text says "around 0.5"); correlation with
industrial production growth −0.62/−0.61/−0.57 versus VXO's −0.32. *Real effects are substantially LARGER,
not smaller* — 11-variable monthly VAR, 12 lags, Cholesky with uncertainty ordered **last** (the conservative
ordering), maximum share of forecast error variance (Table 3): U_t(12) production **28.54**, employment
**31.00**, hours **12.34**; VXO **6.93 / 7.64 / 2.32**. "Uncertainty shocks are associated with **over four
times** the variation in production and employment and **over five times** the variation in hours compared to
VXO shocks." Effects persist past 60 months; Fed Funds shocks in the same VAR explain at most 28.96 percent
of production, so uncertainty is roughly as important as monetary policy shocks. *Dispersion proxies fail
even the sign test:* shocks to firm profit dispersion and to GDP forecast dispersion make production and
employment **rise**. *A direct hit on 12.12:* they find no statistically significant volatility overshoot for
any measure including VXO, and fn. 22 states: "After a careful inspection of the code kindly provided by
Bloom, we find that **contrary to a statement in the paper, Bloom (2009) HP filters all data in the VAR for
these impulse responses except the VXO Index.**" Their objection is that the HP filter uses whole-sample
information, so observation timing becomes hard to interpret — structurally the same objection as their
forecastable-component critique: **do not let information unavailable at time t leak into your time-t
measure.**
**Key parameters.** 132 macro + 147 financial = 279 series; 618 observations; 12 factors; t-threshold 2.575;
h = 1, 3, 12; 49/618 high-uncertainty months; half-life 53.58 months.
**Primary sources.** Jurado, Kyle, Sydney C. Ludvigson, and Serena Ng 2015, "Measuring Uncertainty,"
*American Economic Review* 105(3):1177-1216, DOI 10.1257/aer.20131193.
**Confidence.** [paper-verified] from the full published AER text. **Scope correction recorded to prevent
over-citation:** there is **no empirical comparison of JLN to the EPU index anywhere in the paper** — no
correlation, no VAR, no figure, no table. BBD is cited once in a footnote list, and news-based measures
appear substantively exactly once, in the opening list of proxies ("the appearance of certain
'uncertainty-related' key words in news publications"). Their general critique plainly *applies* to a news
keyword count (it has no forward-looking component and removes no forecastable variation), but **that
extension is inference, not their published claim.** Two further cautions: the rarity result is partly a
consequence of the aggregation choice (they excluded the 147 financial series precisely because those would
dominate), and they state that their results "are silent on whether uncertainty is the cause or effect" of
declines.

## 12.14 Loughran & McDonald — Why Generic Word Lists Fail in a Specialized Domain
**Mechanism (as stated).** "We find that almost three-fourths (**73.8%**) of the negative word counts
according to the Harvard list are attributable to words that are typically not negative in a financial
context." Nuance most citations get wrong: 73.8% is a fraction of the negative word **count** (token
occurrences in the corpus), not of distinct list entries — cite it as occurrence-weighted misclassification.
**Two distinct damage mechanisms**, carefully separated: (1) **Attenuation** — misclassified words
uncorrelated with the outcome (tax, liability) "simply add noise to the measurement of tone and thus
attenuate the estimated regression coefficients." (2) **Type I error** — words like "mine" or "cancer" "could
introduce type I errors into the analysis to the extent that they proxy for industry segments or firm
attributes," so part of the apparent power of a generic list in prior work may be the list silently proxying
for industry. Concrete cases: "mine" is the most common Harvard negative word for precious metals and coal,
and in Coeur d'Alene Mines' 1999 10-K alone "accounts for over 25% of all the H4N-Inf negative word counts";
"cancer" ranks tenth in pharmaceuticals; "capital" is "by far the most common negative word" for banking. The
top seven Harvard negatives in 10-Ks (tax, costs, loss, capital, cost, expense, expenses) account for over a
quarter of all negative counts. Zipf's law is invoked explicitly as the structural reason a handful of words
dominates any list.
**Math / Algorithm.** Term weighting, Eq. (1), §II.E. With N total documents, df_i documents containing word
i, tf_i,j the raw count of word i in document j, and a_j the average word count in document j:

    w_i,j = [ (1 + log(tf_i,j)) / (1 + log(a_j)) ] × log(N / df_i)   if tf_i,j ≥ 1;  0 otherwise

Their reading: the first term "attenuates the impact of high frequency words with a log transformation"
(*loss* appears 1.79 million times, *aggravates* 10 times; the collective impact of *loss* is surely not
179,000 times greater); the second "modifies the impact of a word based on its commonality" (*loss* appears
in over 90 percent of documents so the idf term cuts it by more than 90 percent, while *aggravates* is
multiplied by roughly eight). The a_j document-length denominator is **their modification** to textbook
tf-idf, added because "since we are comparing different documents, length matters."
**Key parameters.** Sample: 50,115 10-K filings, 1994-2008, 8,341 firms, ~2.5 billion words. **Six** lists in
the 2011 paper (constraining was added later): Fin-Neg **2,337**; Fin-Pos **353**; Fin-Unc **285**; Fin-Lit
**731**; modal-strong 19; modal-weak 27; H4N-Inf (their inflected Harvard) 4,187 from 2,005 roots. The
uncertainty list, closest to a stress use case, verbatim: "The Fin-Unc list includes words denoting
uncertainty, with emphasis on the general notion of imprecision rather than exclusively focusing on risk. The
list includes 285 words, such as approximate, contingency, depend, fluctuate, indefinite, uncertain, and
variability." Weak modal words (could, depending, might, possibly) are a genuinely **separate** list, so
epistemic hedging via modality is measured apart from lexical imprecision. The lists overlap heavily and the
authors warn against using them jointly due to collinearity.
**Key findings.** Validation by 60 quarterly Fama-MacBeth regressions, Newey-West errors, 48 industry
dummies, controls for size, book-to-market, turnover, pre-filing alpha, institutional ownership, NASDAQ.
**Fin-Unc is the strongest single list for filing-period returns**, coefficient −42.026 (t = −4.13), beating
Fin-Neg (−19.538, t = −2.64) — uncertainty outperformed negativity, which is underappreciated. **The result
that should change how the paper is read:** under proportional weighting the generic Harvard list is
insignificant for filing returns (t = −1.35) while Fin-Neg is significant (t = −2.64), but under tf-idf
weighting **both become significant and essentially identical** (−0.003, t = −3.16 versus −0.003, t = −3.11).
Their words: "The term weighting method, however, mitigates the noise in both measures, especially for the
H4N-Inf measure, to an extent that the Fin-Neg list does not dominate." So **term weighting, not the
dictionary swap, is what recovers statistical power**; the residual case for the domain-specific list is the
type I error / industry-proxy argument, not incremental explanatory power. Most citations get this backwards.
Other results: post-event return volatility is positive and significant for **all** lists under tf-idf, the
strongest and most uniform result in the paper; abnormal trading volume positive and significant. Two nulls
they report plainly: the **long-short trading strategy produces no significant alpha**, and restricting to
the **MD&A section does not improve signal** over the full 10-K.
**The most transferable warning.** Their standardized-unexpected-earnings result has the **opposite sign**
from Tetlock, Saar-Tsechansky & Macskassy (2008) on news. Their explanation is authorship: "More negative
words used by independent journalists indicate pessimism... When insiders are the document's authors, more
negative words... point to more positive subsequent earnings surprises." So **lexicon transfer across domains
fails on vocabulary, and transfer across authorship roles can fail on sign, even when the vocabulary holds.**
The summary sentence: "financial researchers should be cautious when relying on word classification schemes
derived outside the domain of business usage. Applying nonbusiness word lists to accounting and finance
topics can lead to a high misclassification rate and spurious correlations. All textual analysis ultimately
stands or falls by the categorization procedures."
**Primary sources.** Loughran, Tim, and Bill McDonald 2011, "When Is a Liability Not a Liability? Textual
Analysis, Dictionaries, and 10-Ks," *Journal of Finance* 66(1):35-65, DOI 10.1111/j.1540-6261.2010.01625.x.
**Confidence.** [paper-verified] from the full published typeset text, including the corrected 2011 list
counts (285 uncertainty, 731 litigious — later versions differ, and 297/871 are later-version numbers).

## 12.15 Guttal, Raghavendra, Goel & Hoarau — Critical Slowing Down Does NOT Transfer to Markets
**Mechanism (as stated).** A direct test of whether the Scheffer-style early-warning framework (Creator 10)
holds in financial markets. Three indicators were tested: **lag-1 autocorrelation** (the canonical
critical-slowing-down indicator), **variance** of detrended residuals, and **power spectral density at low
frequencies** (average spectrum up to 1/8 of all frequencies).
**Math / Algorithm.** Standard EWS estimation on detrended residuals over rolling windows; markets DJI, S&P
500, NASDAQ (crashes of 1929, 1987, 2000, 2008, plus 1-minute high-frequency data) and DAX, FTSE (2000,
2008).
**Key findings.** *What failed:* "autocorrelation at lag-1 … a key measure of critical slowing down, showed
either no or weak trends" before any crash. Their conclusion is that financial crashes "are not critical
transitions that occur in the vicinity of a tipping point." *What worked:* "All markets showed strong trends
of rising variability, quantified by time series variance and spectral function at low frequencies, prior to
crashes," and "all important recorded stock market crises in DJI were preceded by EWS in variance and power
spectrum at least three months in advance." *False alarms:* **seven** — rising variability occurred without a
subsequent crash seven times.
**Key parameters.** Three indicators; five indices; four US crash episodes plus two European; low-frequency
spectral band = up to 1/8 of all frequencies; ≥3-month lead for the variance/spectrum signals; 7 false
positives.
**Primary sources.** Guttal, Vishwesha, Srinivas Raghavendra, Nikunj Goel, and Quentin Hoarau 2016, "Lack of
Critical Slowing Down Suggests that Financial Meltdowns Are Not Critical Transitions, yet Rising Variability
Could Signal Systemic Risk," *PLOS ONE* 11(1):e0144198, DOI 10.1371/journal.pone.0144198.
**Confidence.** [paper-verified] via the publisher page. Recorded here because it **bounds Creator 10**: the
autocorrelation/critical-slowing-down formulation specifically does not transfer to financial markets, while
the variance formulation does, with a stated false-alarm rate.

## 12.16 Coupling and Attention: Corroborations and Critiques
**Mechanism (as stated).** Two clusters of results that bound the entries above rather than adding a new
instrument: independent corroborations that **rising cross-correlation signals fragility**, and critiques
establishing that **news coverage volume tracks attention, not severity**.

*Rising correlation as an early-warning signal.* **Zheng, Podobnik, Feng & Li (2012)**: PCA on 10 Dow Jones
Supersector indexes, monthly returns March 2000 - June 2012, on a **moving 12-month window** (compared
against 36-month); the indicator is the **rate of change of PC1, not its level** — "The larger the peak in
the change of PC1, the higher is the systemic risk." Window length is load-bearing and they say why: "Market
crashes are associated with large shocks, but if window size is too large, large shocks are overridden by all
other signals." With 12-month windows "the steepest increase of PC1 occurred in August 2007," the month the
interbank market froze, preceding the December 2007 recession onset; the European replication peaked February
2008, "a few months later … it took time for the crisis to spread from US to Europe." **Patro, Qi & Sun
(2013)**: daily stock return correlations and default correlations among the 22 largest bank holding
companies and investment banks, 1988-2008; an increasing trend in stock return correlation among banks with
**no comparable trend among non-banks**, and — mechanistically important — the increases are largely driven
by rising correlation between banks' **idiosyncratic** risks, not common factor exposure.

*News volume tracks attention, not severity.* **Brochet, Mueller & Rauh (2025)** is the sharpest result and
produces a **sign flip**: "the standard text-based EPU index systematically declines during armed conflict
periods"; "the index declines significantly by 11 points during armed conflict"; "this decline is driven not
by reduced uncertainty, but by a **crowding out of reporting on economics and policy**"; "while U counts
spike during conflict, mentions of E and P drop sharply." And: "The pattern is not a feature of our
international news corpus but holds in the original EPU data as well." A properly scaled, human-audited,
peer-reviewed index **moves the wrong direction** under topic crowd-out. **Bae, Jo & Shim (2025)**, a formal
replication: "shocks to the index do not significantly affect the economy during the period from September
2008 to December 2019," and "this pattern is unique to the Economic Policy Uncertainty measure."
**Ghirelli, Pérez & Urtasun (2019)** document spurious EPU spikes "that cannot be associated to any relevant
policy-related historical event." **Chen, Huang, Huang & Chen (2021)**: "over 40% of news articles with the
selected keywords are not related to the EPU" (Taiwanese corpus, non-BBD keyword sets, so transfer is
imperfect). **Gentzkow, Kelly & Taddy (2019)**, the discipline survey: "there is no ground truth data on the
actual level of policy uncertainty reflected in particular articles," and they independently corroborate the
EPU scaling procedure. **Gentzkow & Shapiro (2010)**: newspaper content is a demand-driven product — "Firms
respond strongly to consumer preferences, which account for roughly 20 percent of the variation in measured
slant in our sample. By contrast, the identity of a newspaper's owner explains far less." Coverage reflects
what readers want, which is an attention process, not a severity process. **Da, Engelberg & Gao (2011)**,
attention measures reverse: "a one standard deviation increase in ASVI this week leads to a positive price
change of more than 30 basis points... during the subsequent two weeks. This initial positive price pressure
is almost completely reversed by the end of the year." Attention predicts reversible price pressure, not
fundamentals. **Google Trends as an alternative is unstable**: Cebrián & Domènech (2024) — "the same query
produces different results that can widely change from day to day"; Eichenauer, Indergand, Martínez & Sax
(2022) — "raw data are frequency-inconsistent: daily data fail to capture long-run trends. This issue has
gone unnoticed in the literature"; Rovetta (2024) — "Google Trends improvements have altered the RSV
historical trends."
**Primary sources.** Zheng, Z., B. Podobnik, L. Feng, and B. Li 2012, "Changes in cross-correlations as an
indicator for systemic risk," *Scientific Reports* 2:888, DOI 10.1038/srep00888 (open access). Patro, Dilip
K., Min Qi, and Xian Sun 2013, "A simple indicator of systemic risk," *Journal of Financial Stability*
9:105-116. Brochet, Mueller & Rauh 2025, "Uncovering Economic Policy Uncertainty During Conflict," Cambridge
Working Papers in Economics 2551. Bae, Jo & Shim 2025, "Does Economic Policy Uncertainty differ from other
uncertainty measures? Replication of Baker, Bloom, and Davis (2016)," *Canadian Journal of Economics*
58(1):40-74. Ghirelli, Pérez & Urtasun 2019, *Economics Letters* 182:64-67. Chen, Huang, Huang & Chen, CIKM
'21. Gentzkow, Kelly & Taddy 2019, "Text as Data," *Journal of Economic Literature* 57(3):535-574. Gentzkow &
Shapiro 2010, "What Drives Media Slant? Evidence from U.S. Daily Newspapers," *Econometrica* 78(1):35-71. Da,
Engelberg & Gao 2011, "In Search of Attention," *Journal of Finance* 66(5):1461-1499. Cebrián & Domènech
2024, *Technological Forecasting and Social Change* 202:123318. Eichenauer, Indergand, Martínez & Sax 2022,
*Economic Inquiry* 60(2):694-705. Rovetta 2024, *International Journal of Medical Informatics* 190:105563.
Ahir, Bloom & Furceri, World Uncertainty Index, NBER WP 29763 (**not** Davis — a common misattribution).
**Confidence.** [paper-verified] for Zheng et al. (via PMC full text), the EPU critiques, Gentzkow-Shapiro,
and the Google Trends instability findings. **Brochet, Mueller & Rauh is [paper-verified but NOT peer
reviewed]** — cite as emerging. [partially-verified]: Patro/Qi/Sun and Da/Engelberg/Gao (abstract or
near-final-draft level only). **[unverified], explicitly not retrieved this pass, do NOT cite from this
document:** the classical attention literature — Cutler, Poterba & Summers (*Journal of Portfolio Management*
1989), Shiller "Narrative Economics" (*AER* 2017), Tetlock (*JF* 2007; *RFS* 2011), Huberman & Regev (*JF*
2001), and Eisensee & Strömberg (*QJE* 2007, the news-pressure/crowd-out instrument). The Eisensee-Strömberg
mechanism is the one most wanted and the one not confirmed; its structural claim is however independently
corroborated by Brochet-Mueller-Rauh above, so the crowd-out mechanism itself is on solid footing even though
the disaster-relief magnitudes are not. **Also verified absent after full search, do not use:** any paper
showing newspaper slant *drifting over time* biases EPU, any paper linking declining circulation or newsroom
staffing to index bias, and any published Comment or Reply on BBD 2016. BBD's own slant check is a static
whole-sample correlation of 0.92, which is **not** a test of drift.

### Verification note (Creator 12)
All sixteen entries rest on local text extraction (`pdftotext -layout` / `pypdf`) of primary PDFs, not on
fetch-tool summaries. This is not a stylistic preference: during research **two fetch-tool PDF summaries
returned fabricated content**, one asserting that Illing & Liu used principal component analysis and
LIBOR-OIS spreads — false, and anachronistic in the second case. Any future extension of this section should
assume tool-generated summaries of paywalled economics PDFs are unreliable and verify against extracted text.
Items that could not be confirmed are flagged inline as `[partially-verified]` or `[unverified]` rather than
smoothed over, and four entries additionally record **verified absences** (claims a paper does *not* make),
because in this literature the absent claim is frequently the one attributed to the paper by others: BBD
report no numeric error rates and never discuss attention bias; Bloom never discusses risk premia as a
confound; JLN never empirically compare to EPU; Billio et al. make no numeric lead-time claim and treat
1994-1996 as a tranquil baseline, not a crisis.


# Creator 13 — The Isomorphism: Stress as Precision-Weighted State Estimation (the LIMEN thread)

This section is different from Creators 1-12. Those record mechanisms as their authors state them, one field at a
time. This one documents the **single mathematical object that appears in both the neuroscience of Creators 1-9 and
the economics of Creator 12**, because that shared object is the thread the whole LIMEN stress model runs on. The
claim, stated once and then sourced:

> **Stress is a latent state. The channels that report on it (in the brain: sensory afferents; in a market: the
> indicators; in LIMEN: node-numbers and news) are noisy sensors. Both the brain and the economist estimate that
> hidden state by the SAME operation — recursive optimal estimation that weights each sensor by its reliability
> (precision = inverse variance = Kalman gain). Reliability-weighting is not a metaphor shared across the two
> fields; it is the identical algebra, and both fields adopted it from the same control-theory root.**

**HONESTY BANNER, read before citing.** No single published paper asserts, in one sentence, that "the brain's state
estimator and the economist's dynamic-factor estimator are the same object." The three research passes behind this
section searched for that sentence and did not find it; presenting a quotation to that effect would be fabrication.
What IS paper-verified, and what this section rests on, is the weaker but sufficient set of facts that force the
conclusion: (i) both fields write the identical state-space pair; (ii) both estimate the latent state with the
identical inverse-variance gain; (iii) each field, in its own literature, names the Kalman filter explicitly as the
estimator it adopted. The isomorphism is therefore LIMEN's **synthesis grounded in shared equations**, not a claim
lifted from a source. That distinction is the difference between a defensible thesis and a fabricated authority, and
it is kept throughout.

## 13.1 The shared object — Kalman 1960, and why the gain is inverse-variance weighting
**Mechanism (as stated).** Kalman's 1960 paper replaces the Wiener-Kolmogorov integral approach with a RECURSIVE
state-space filter that estimates a hidden state x_t from noisy observations y_t. Verbatim opening: "FILTERING is the
process of estimating the current value of a … stochastic signal, using the history … of another (observed)
stochastic process (so-called measurement process) which is correlated with it." His Theorem 2 proves the optimal
estimate is the orthogonal projection of x onto the span of past observations — i.e. the conditional expectation
under Gaussian assumptions.
**Math / Algorithm.** State and observation equations (Kalman's eqs. 16-17, verbatim symbols):
    x(t+1) = Φ(t+1;t) x(t) + u(t)          (state / "message")
    y(t)   = M(t) x(t)                       (observation / "measurement")
Optimal-estimate recursion (eqs. 21-30): x*(t+1|t) = Φ*(t+1;t) x*(t|t−1) + Δ*(t) y(t), with the GAIN
Δ*(t) = Φ(t+1;t) P*(t) M'(t) [M(t) P*(t) M'(t)]⁻¹ and the error-covariance Riccati recursion
P*(t+1) = Φ*(t+1;t) P*(t) Φ'(t+1;t) + Q(t). In the modern (measurement-noise R present) discrete form:
    innovation      v_t = y_t − H x̂_{t|t−1}
    innovation cov   S_t = H P_{t|t−1} Hᵀ + R
    GAIN            K_t = P_{t|t−1} Hᵀ S_t⁻¹
    update          x̂_{t|t} = x̂_{t|t−1} + K_t v_t
**The load-bearing identity.** In the scalar case (H = 1, prediction variance P, measurement variance R):
    K = P / (P + R) = (1/R) / (1/P + 1/R)
so the posterior mean is exactly the **inverse-variance-weighted average** of the prior prediction and the new
measurement. K is the fraction of trust placed on new evidence = its relative precision. A noisy sensor (large R)
gets a small gain. This one line is the entire conceptual content the two fields share.
**Key parameters.** A/Φ (transition), H/M (observation loadings), Q (process-noise cov), R (measurement-noise cov),
P (error cov, Riccati), K/Δ (gain).
**Primary sources.** Kalman, R.E. 1960, "A New Approach to Linear Filtering and Prediction Problems," *Transactions
of the ASME – Journal of Basic Engineering* 82(D):35-45, DOI 10.1115/1.3662552.
**Confidence.** [paper-verified] — eqs. 16-17, 21-30 read visually from a scanned original reprint. One honest
detail recorded: **Kalman's 1960 base observation equation y = Mx has NO measurement-noise term**, so his inverse is
[M P M']⁻¹ with no R; the textbook `+R` form is the later-codified discrete filter (and Kalman-Bucy 1961 for the
noisy continuous case). Both are the same object; R = 0 collapses one to the other. The exact `+R` gain is sourced
verbatim from the economics side (13.4, ADS 2009), where R is present.

## 13.2 The common root — Wiener's cybernetics, "the animal and the machine"
**Mechanism (as stated).** The reason the two fields rhyme is that they descend from one program. Wiener's 1948
*Cybernetics* proposes a single theory of control-and-communication spanning, in the book's own subtitle, "the
Animal and the Machine." Wiener's optimal-linear-prediction theory (Wiener-Kolmogorov, 1940s) is exactly what
Kalman 1960 supersedes — Kalman verbatim names "the Wiener-Kolmogorov theory" as the prevailing approach he
replaces. The lineage is therefore literal, not analogical:
    Wiener 1948 (control uniting animal + machine) → Wiener-Kolmogorov optimal prediction → Kalman 1960 recursive
    state estimator → adopted BY economics (dynamic factor models, 13.4) AND BY neuroscience (13.3).
**Primary sources.** Wiener, Norbert 1948, *Cybernetics: or Control and Communication in the Animal and the
Machine*, MIT Press / Hermann / Wiley. (See also Creator 8, which carries Wiener's regulation lineage.)
**Confidence.** [paper-verified] for the subtitle and the Wiener→Kalman supersession (Kalman names Wiener-Kolmogorov
verbatim). The interpretation that this common root is *why* both later fields converged is LIMEN's synthesis.

## 13.3 The neuroscience adoption — the brain runs the filter
**Mechanism (as stated).** Three independent primary results establish that perceptual and motor inference in the
brain IS optimal state estimation, with precision (inverse variance) playing the role of the Kalman gain.
- **Wolpert, Ghahramani & Jordan 1995** — the cleanest "the CNS uses a Kalman filter" statement. Verbatim: "we chose
  to use a Kalman filter observer, which is a linear dynamical system that produces an estimate of the location of
  the hand by using both the motor outflow and sensory feedback in conjunction with a model of the motor system."
  Their state-update equation is printed with the two terms labelled "Forward model" and "Sensory correction":
      x̂(t) = A x(t) + B u(t) + K(t)[y(t) − C x(t)]
  and verbatim: "The relative contributions of the internal simulation and sensory correction processes to the final
  estimate are modulated by the Kalman gain so as to provide optimal state estimates." The gain shifts weight from
  forward model to sensory feedback as the state estimate's reliability changes — exactly reliability-weighting.
- **Rao & Ballard 1997** — predictive coding formalized as an extended Kalman filter. Verbatim: cortical dynamics
  "assume the form of an extended Kalman filter … which optimally estimates current recognition state by combining
  information from input-driven bottom-up signals and expectation-driven top-down signals," yielding "modeling of the
  visual cortex as a hierarchical Kalman predictor." (The 1999 Nature Neuroscience paper is the same model; Friston
  2005 verbatim confirms it "uses Kalman filtering.")
- **Friston 2005 / 2008 & Bastos et al. 2012** — precision IS the inverse-variance weight on prediction error, and
  reduces to the Kalman gain. Friston 2005 verbatim: "precision is the inverse of variance." Bastos 2012 verbatim:
  "prediction errors are weighted by their precision (inverse variance) … Under linear models, it reduces to linear
  predictive coding, also known as Kalman-Bucy filtering," and precision "controls the postsynaptic sensitivity or
  gain" — i.e. precision-weighting is realized as synaptic gain, the Kalman gain in cortex. Also Todorov & Jordan
  2002, verbatim: optimal motor control requires "an internal state estimate obtained by a forward model (a Kalman
  filter)."
**Math / Algorithm.** Identical to 13.1. In predictive coding the update is gradient descent on precision-weighted
squared prediction error ξ = P·ε (Bastos eq. 1), with P = Σ⁻¹ the precision; under linear-Gaussian assumptions this
is the Kalman filter. In the motor case (Wolpert, Todorov) it is the Kalman observer explicitly.
**Key parameters.** Prediction vs prediction error; precision P (= inverse variance = gain); forward model / top-down
prediction; sensory correction / bottom-up error.
**Primary sources.** Wolpert, Ghahramani & Jordan 1995, *Science* 269(5232):1880-1882. Rao & Ballard 1997, "Dynamic
model of visual recognition…," *Neural Computation* 9(4):721-763; Rao & Ballard 1999, *Nature Neuroscience*
2(1):79-87. Friston 2005, "A theory of cortical responses," *Phil Trans R Soc B* 360(1456):815-836; Friston 2008,
"Hierarchical models in the brain," *PLoS Comput Biol* 4(11):e1000211. Bastos et al. 2012, "Canonical microcircuits
for predictive coding," *Neuron* 76(4):695-711. Todorov & Jordan 2002, *Nature Neuroscience* 5(11):1226-1235.
**Confidence.** [paper-verified] for the Wolpert 1995, Rao & Ballard 1997, Friston 2005, Bastos 2012 and Todorov 2002
verbatim quotes (all read from locally-extracted primary PDF text). [partially-verified] for the internal wording of
Rao & Ballard 1999 (paywalled; corroborated by the 1997 primary and by Friston 2005's verbatim citation of it "using
Kalman filtering").

## 13.4 The economics adoption — the market's stress index runs the SAME filter
**Mechanism (as stated).** The state-space dynamic factor model is the Kalman filter applied to economics: a
low-dimensional LATENT state (business or financial conditions) estimated from many noisy mixed-frequency
indicators, each weighted by its signal reliability. This is not a loose parallel; the estimator is the same object
as 13.1 and 13.3.
- **Aruoba, Diebold & Scotti 2009** — the cleanest exact match to the `K = P Hᵀ(HPHᵀ+R)⁻¹` gain, in a peer-reviewed
  economics paper. Verbatim: "We work with a dynamic factor model, treating business conditions as an unobserved
  variable, related to observed indicators," and the estimator "amounts to a filtering problem with a large amount of
  missing data, which the Kalman filter is optimally designed to handle … we use the Kalman filter and smoother to
  obtain optimal extractions of the latent state of real activity." Their update (eqs. 12-17):
      a_{t|t} = a_t + P_t Z_t' F_t⁻¹ v_t,   v_t = y_t − Z_t a_t − Γ_t w_t,   F_t = Z_t P_t Z_t' + H_t
  so the gain K_t = P_t Z_t' (Z_t P_t Z_t' + H_t)⁻¹ is **identical in form to the Kalman gain** with Z_t ≡ H
  (indicator loadings) and H_t ≡ R (indicator noise). A noisy indicator (large H_t) gets a small gain — inverse-
  variance weighting, the same rule the brain uses in 13.3. Operationalized live as the Philadelphia Fed's ADS
  Business Conditions Index.
- **Doz, Giannone & Reichlin 2011 / 2012** — the estimators behind the Chicago Fed NFCI (Creator 12, §12.3). The 2011
  title is itself the adoption statement: "A two-step estimator for large approximate dynamic factor models **based
  on Kalman filtering**." Both estimate a latent common factor from a large panel of noisy indicators via the Kalman
  filter/smoother (2011 = PCA-initialized two-step; 2012 = QML via the Kalman-filter likelihood + EM). The **NFCI is
  the Kalman-smoothed factor estimate** over ~105 indicators. So the same production stress index catalogued in
  Creator 12 as "dynamic factor, QML-EM" is, precisely, the brain's estimator pointed at markets.
**Math / Algorithm.** Identical to 13.1, with H = indicator loadings, R = indicator-noise covariance. The latent
state is "financial/business conditions"; in LIMEN the latent state is a domain's stress.
**Key parameters.** Latent factor (the stress state); indicator loadings Z/H; indicator-noise covariance H_t/R
(sets each indicator's gain); Kalman-smoothed factor = the published index.
**Primary sources.** Aruoba, Diebold & Scotti 2009, "Real-Time Measurement of Business Conditions," *J. Bus. Econ.
Stat.* 27(4):417-427. Doz, Giannone & Reichlin 2011, *J. Econometrics* 164(1):188-205; 2012, *Rev. Econ. Stat.*
94(4):1014-1024. Chicago Fed NFCI (Brave & Butters; see Creator 12 §12.3). Antecedent: Stock & Watson dynamic factor
/ coincident-index work (1989, 1991, 2002).
**Confidence.** [paper-verified] for ADS 2009 (latent state + Kalman + eqs. 12-17), the DGR citations and titles, and
NFCI = Kalman-smoothed factor. [partially-verified] for the Stock-Watson antecedents (confirmed via ADS's verbatim
citation, originals not re-extracted).

## 13.5 The cue-combination bridge — the fusion rule LIMEN needs, stated as an equation
**Mechanism (as stated).** Between "the brain runs a Kalman filter" and "weight numbers vs news" sits the
cue-combination literature, which gives the two-sensor fusion rule in closed form and proves humans use it. This is
the direct answer to how LIMEN should combine its two channels.
- **Ernst & Banks 2002** — the foundational result. Verbatim: "a general principle, which minimizes variance in the
  final estimate, determines the degree to which vision or haptics dominates. This principle is realized by using
  maximum-likelihood estimation." The fusion formula (their eq. 2, verbatim):
      Ŝ = Σ_i w_i Ŝ_i,   w_i = (1/σ_i²) / (Σ_j 1/σ_j²)
  and the variance-reduction guarantee (eq. 3): σ²_combined = (σ_V² σ_H²)/(σ_V² + σ_H²) < either input. Confirmed
  empirically: measured visual-haptic weights and thresholds matched the MLE prediction, combined threshold always
  below either alone.
- **Alais & Burr 2004** — the audiovisual (ventriloquist) version, and the cleanest demonstration of the LIMEN point
  that the unreliable channel is DOWN-WEIGHTED. Verbatim: "the ventriloquist effect is a specific example of optimal
  combination of visual and auditory spatial cues, where each cue is weighted by an inverse estimate of its
  variability … if the visual estimate is corrupted sufficiently by blurring … vision can become worse than audition,
  and optimal localization correctly predicts that sound will effectively capture sight." Same inverse-variance
  weights (w_A = 1/σ_A², w_V = 1/σ_V²) and same variance reduction.
- **Körding & Wolpert 2004** — the same rule when one "cue" is a learned PRIOR: the optimal estimate is the
  inverse-variance-weighted average of prior mean and sensory evidence, MSE = σ²_s σ²_p/(σ²_s+σ²_p), "always lower
  than … sensory alone." As feedback uncertainty rises, subjects rely more on the prior (F₃,₂₇ = 82.7, p < 0.001).
- **Knill & Pouget 2004** — the "Bayesian brain" framing and the neural implementation. Verbatim: the integrated
  estimate is μ_{V,A} = w_V μ_V + w_A μ_A, "the weights (w) are inversely proportional to the variances of the
  likelihood functions," and neurally, "the variance [is] inversely proportional to the gain of the hill … the cues
  are integrated with weights proportional to their reliability" — reliability = neural gain = inverse variance, the
  same quantity predictive coding calls precision.
**The LIMEN reading.** Numbers = the low-variance interoceptive channel; news = the high-variance exteroceptive/
salience channel. The body does not average or add them; it weights each by 1/σ² and the fused estimate has lower
variance than either. This is why raw feed volume failed (an unreliable channel was allowed to set the level instead
of being gain-scaled by its own noise) and why news demotes to "reference/opportunity" without being discarded (a
high-variance exteroceptive alarm is not ignored, it is precision-gated against interoception). The weighting is not
a stated prior to be guessed (as in grounded-stress.js v2's 0.45/0.30/0.25) — the correct weight for a channel is its
measured inverse variance.
**Primary sources.** Ernst & Banks 2002, *Nature* 415:429-433, DOI 10.1038/415429a. Alais & Burr 2004, *Current
Biology* 14:257-262, DOI 10.1016/j.cub.2004.01.029. Körding & Wolpert 2004, *Nature* 427:244-247, DOI
10.1038/nature02169. Knill & Pouget 2004, "The Bayesian brain…," *Trends Neurosci.* 27(12):712-719, DOI
10.1016/j.tins.2004.10.007.
**Confidence.** [paper-verified] for Ernst & Banks, Körding & Wolpert and Knill & Pouget (verbatim from primary PDF
text). [primary-equivalent] for Alais & Burr (Current Biology paywalled; equations and data quoted verbatim from
Burr & Alais's own *Progress in Brain Research* reproduction). Honest boundary recorded: **none of these four
cue-combination papers contains the word "Kalman"** — the inverse-variance-weighting-IS-Kalman-gain identity is
sourced to Wolpert 1995 and the predictive-coding literature (13.3), not to these four. The cue papers supply the
static two-sensor fusion formula; the Kalman/predictive-coding papers supply its dynamic, recursive form; they are
the same estimator at two levels of generality.

### Verification note (Creator 13)
Three parallel research passes, each verifying against locally-extracted primary PDF text rather than tool summaries
(the same discipline as Creator 12, and for the same reason — earlier fetch-tool summaries fabricated content). The
isomorphism is established by a chain every link of which is paper-verified: Kalman's recursive estimator (13.1) and
its inverse-variance gain; the Wiener root both fields descend from (13.2); the neuroscience adoption naming Kalman
explicitly (13.3, Wolpert/Rao-Ballard/Bastos/Todorov verbatim); the economics adoption naming Kalman explicitly
(13.4, ADS/DGR verbatim, and the NFCI of Creator 12 shown to BE this estimator); and the closed-form two-sensor
fusion rule with its empirical confirmation (13.5, Ernst-Banks verbatim). The ONE thing deliberately NOT claimed is a
single quoted sentence asserting the cross-disciplinary identity — it does not exist in the literature searched, and
the section is explicit that the isomorphism is LIMEN's synthesis grounded in the shared equations, not a borrowed
authority. That is the line between this being the thread the system runs on and this being a fabrication.


