# Dysregulation -> Proven Intervention Library (INTERNAL)

Internal reference. Firewalled via `docs/research/`. Built 2026-07-12. The treatment-protocol scaffold for the AUTONOMOUS regulator: it keys each dysregulation type to the influencer tactic that is actually PROVEN to work, plus the Claude Code skill that renders it. Companions: `torti-tools-and-skills-map.md`, `saraev-net-new-vs-torti.md`, `domain-L1-money-map.md`. Memory: `torti-regulation-skills-business-layer.md`.

## The vision (operator, 2026-07-12)
The SYSTEM is fully autonomous. It senses regulation/dysregulation per domain from live-event feeds, SPAWNS a business to regulate the domain (nervous system), runs it, and RETIRES or MUTATES it as the domain changes. The neuro->business mapping is the STEERING/direction+action layer, not the product ("a minor view of a more in-depth process"). This table = the intervention library the engine selects from. Patterns get reweighted by real data once the operator finishes building the domains into brains ("we will soon see the patterns when I'm done with domains").

Connects to existing repo assets: brain-node->business generator (`brain-node-business-mapping.json` + `cross-node-opportunity.js`, live-stress wired) and the proven autonomic rebuild loop. Standing gap was "generates ideas, not productized / pattern quality." THIS closes it: each idea-type now maps to a validated instrument + the skill to build it.

## The control loop
`live-events feed -> classify domain dysregulation -> select proven intervention (this table) -> Claude Code builds+runs deployable portion -> monitor feed -> retire/mutate when domain signal changes`. Self-improves via auto-research (Karpathy): metric = dysregulation-signal delta, change = intervention variant, assessment = the live feed. Fully autonomous EXCEPT the residue below.

## The library (proof-gated: only tactics with real influencer validation)

### 1. Afferent-sensing failure (can't feel its own inputs)
- Proven directive: procedural scrape/capture pipeline. Saraev "start at the end, verify you can get the data first"; scrape-leads skill did 1,000 leads in 87s. ANTI-catalog rule: never put AI at the first human contact (destroys conversion) -> capture is back-end/procedural only.
- Skills: `enrichlead`, `leadtriage`, `ticketdeflector`, scrape-leads, Chrome DevTools MCP (API-less capture).
- Autonomous: FULL (the capture pipeline runs itself).

### 2. Salience + latency (senses but responds too slow / can't prioritize)
- Proven directive: speed-to-lead <5 min = 100x conversion (Torti + Saraev, backed by real closed deals: $4.5k, $18k systems). The RANKING function is the moat.
- Skills: `prospect`, `sequenceload`, `callprep`; kernel ranking; cost-aware-llm-pipeline for cheap-rank/expensive-act routing.
- Directive: "the money is in the follow-up"; "lead gen is a button, press it as fast as possible."
- Autonomous: sense+rank+alert = auto. RESIDUE: the actual call/close is human.

### 3. Memory/retrieval (stored potential sits inert)
- Proven directive: lead reactivation (Torti's personal-favorite offer, real results); follow-up-nurture skill clears the whole follow-up queue every morning in one command (Saraev).
- Skills: `crmcleanup`, `crmmaintenance`, `follow-up-nurture`, `knowledgesynthesis`, `memorymanagement`.
- Directive: reoccurring revenue = solve the NEXT problem for the same client (raise LTV) vs hunt new.
- Autonomous: FULL (the nurture/reactivation runs on a cron).

### 4. Efferent-output (can't express / act)
- Proven directive: content-repurposing engine ($1-2k, decoupled generate->drip, Saraev); proposal-generation ("I've made over $200,000 selling this exact system," Saraev); graphic-design agent (replaces $82k designer); parasite distribution (scrape winners -> research-twist -> re-voice -> auto-drip, "sell for $1,500 a pop").
- Skills: `contentcreation`, `draftcontent`, `contentstrategy`, `canvacreator`, parasite pipeline.
- Directive: "form over function" (over-invest in the demo/visuals); "one scrape -> omni-channel fan-out"; TANGIBLE deliverable always (doc/PDF/dashboard/notification).
- Autonomous: HIGHEST (parasite/content systems are literally auto-drip).

### 5. Homeostasis / allocation (misallocates resources)
- Proven directive: invoice/payment recovery (deliverable = recovered money, $5-10k/mo, Saraev); hiring/screening system (Torti + Saraev); value-based pricing = allocate PRICE to VALUE not hours (cost-saving = hrs x rate x 52 x 20-25%; uplift = ann.rev x 10%).
- Skills: `invoicechase`, `recruitingpipeline`, `companalysis`, `marginanalyzer`, `capacityplan`, `planpayroll`.
- Directive: "don't automate high-value touchpoints"; place automation force at high-leverage NON-client-facing points.
- Autonomous: invoice-recovery auto; hiring/allocation needs a human gate.

### 6. Immune / guard (threat / compliance / boundary)
- Proven directive: monitor/alert desks; compliance/risk AUDIT as a REPORT-not-code (Torti EU-AI-Act); customer-support triage ONLY as procedural back-end (Saraev's Amazon refund-equation, works 99.9999% because it's a deterministic threshold), never AI front-line; legal safety = "violation != guilt," strictly descriptive with sources.
- Skills: `compliancecheck`, `legalriskassessment`, `riskassessment`, `tickettriage` (procedural), `security-review`; git-guardrails + `.env`-guard hook.
- Autonomous: monitoring/alerting = auto (the guard fires on threshold). RESIDUE: the legal/defamation boundary needs a human/licensed sign.

### 7. Diagnostic-readout (blind to its own state)
- Proven directive: the paid AUDIT as the front door (Torti's single highest-leverage tactic, used in his live $9.5k close; $300 = a commitment FILTER discounted off the project); pulse/ROI report as anti-churn ("clients care about numbers, not your dashboard"); the interoception readout = LIMEN's north star.
- Skills: `businesspulse`, `customerpulse`, `builddashboard`, `metricsreview`, `deep-research`, `digest`.
- Directive: "sell the outcome, don't say AI"; audit de-risks the close and maps the upsell.
- Autonomous: the readout GENERATION is auto. RESIDUE: SELLING the audit is human (the first sales conversation).

## Meta-directives (govern the whole engine, not one function)
- Reliability: TEMPLATE 90% yourself, let AI fill 10% (Saraev) -> deterministic rails, businesses pay for predictability not flexibility.
- Build quality: fan-out/fan-in with Sonnet-research/Opus-synthesis; fresh-context/different-model QA + security agent BEFORE any deploy; anti-monoculture failover (agents.md mirror).
- Self-improvement: auto-research (Karpathy) loop around the whole regulator (proven at Shopify scale, 53% faster). This IS "see the patterns" made mechanical.
- Anti-catalog (what the engine must NOT spawn): AI at first human contact (receptionist/setter/closer/front-line support destroy conversion); full-autonomy email responders; basic FAQ chatbots; giant all-in-one agents (1-5% failure != 1% revenue loss). Every spawn must emit a tangible deliverable and improve a pipeline that ALREADY makes money.

## The irreducible residue (autonomy concentrates it, does not remove it)
The loop autonomously does sense -> classify -> select -> build -> run -> monitor. Two cells stay human/licensed and just get concentrated: (1) the FIRST human sale per new buyer relationship; (2) the regulated-advice / trust boundary (no investment/legal/clinical advice; OSINT-only; aggregate-only; neutrality). Design the engine so these are the ONLY points a human or a licensed party must touch.

## Status
PARKED until domains are built into brains. This is the treatment-protocol scaffold; priors here get reweighted by real dysregulation signal once domains produce it.
