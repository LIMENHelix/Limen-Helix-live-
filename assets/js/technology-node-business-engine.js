/**
 * technology-node-business-engine.js — Technology Node-to-Business Assignment Engine
 *
 * TECHNOLOGY DOMAIN ONLY. Full-hierarchy inference layer.
 * 103 operational nodes mapped (20 TECHNOLOGY-TOP + 83 TECHNOLOGY-OPERATIONAL).
 * Excludes the same 20 RI / framework nodes as locked domains.
 *
 * Self-gates: only runs when ?domain=technology
 * Exposes: window.LIMENTechnologyBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'technology') return;

  var STORAGE_KEY = 'limen_technology_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_technology_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  var GENERIC_TREATMENT_PATTERNS = [
    'Deploy Technology Integration Integrated Technology Platform',
    'Deploy KPI Tracking Integrated Technology Platform',
    'Deploy Innovation Pipeline Integrated Technology Platform',
    'Deploy Trend Analysis Integrated Technology Platform',
    'Deploy Scalability Integrated Technology Platform',
    'Deploy Baseline Assessment Integrated Technology Platform',
    'Deploy Reporting Integrated Technology Platform',
    'Deploy Sustainability Integrated Technology Platform',
    'Deploy Cost Optimization Integrated Technology Platform',
    'Deploy Process Improvement Integrated Technology Platform',
    'Deploy Benchmarking Integrated Technology Platform',
    'Deploy Data Collection Integrated Technology Platform',
    'Deploy Delivery Integrated Technology Platform',
    'Deploy Risk Mitigation Integrated Technology Platform',
    'Deploy Resource Planning Integrated Technology Platform',
    'Deploy Execution Integrated Technology Platform',
    'Deploy Stakeholder Coordination Integrated Technology Platform',
    'Deploy Timeline Management Integrated Technology Platform'
  ];
  var _genericSet = {};
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // 20 TECHNOLOGY-TOP (full neuroTranslation) + 83 TECHNOLOGY-OPERATIONAL
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── TECHNOLOGY-TOP NODES (20) — full detail with neuroTranslation ──
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'AI Strategy & Governance', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains working memory and executes goal-directed reasoning across abstract representations.', inBusiness: 'In technology, AI strategy and governance maintains the decision loop between model capabilities, product bets, and risk posture.' },
      function: 'Sets AI and technology strategy across the organization; arbitrates model choice, product bets, and enterprise risk posture',
      dysregulation: 'Strategic drift, shadow AI, ungoverned model rollouts, loss of architectural coherence',
      expectedTypes: [
        { type: 'AI governance platform', reason: 'Credo AI, Holistic AI, Fairly AI \u2014 enterprise AI policy and model registry', confidence: 0.92 },
        { type: 'Enterprise AI strategy consultancy', reason: 'Helps CTOs and CIOs set AI roadmap and risk posture', confidence: 0.88 },
        { type: 'Model risk management software', reason: 'Monitors model behavior, drift, and compliance exposure', confidence: 0.85 },
        { type: 'AI eval / red-team platform', reason: 'Scale AI, Patronus, Arthur \u2014 pre-deployment eval and safety testing', confidence: 0.90 },
        { type: 'Board-level technology advisory', reason: 'Independent technology directors and advisors', confidence: 0.75 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Deployment & Release Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Executes planned motor commands that move the body through the environment.', inBusiness: 'In technology, deployment and release execution translates planned changes into running systems, closing the loop from plan to production.' },
      function: 'Executes code deployments, releases, and infrastructure changes into production',
      dysregulation: 'Deployment failures, rollback loops, release paralysis, deployment anxiety',
      expectedTypes: [
        { type: 'CI/CD platform', reason: 'GitHub Actions, CircleCI, Buildkite, Jenkins \u2014 automated deployment execution', confidence: 0.95 },
        { type: 'Feature flag / progressive delivery', reason: 'LaunchDarkly, Split, Unleash \u2014 safe incremental rollouts', confidence: 0.90 },
        { type: 'Release engineering consultancy', reason: 'Helps platform teams reduce deployment risk and cycle time', confidence: 0.80 },
        { type: 'GitOps / infrastructure-as-code tooling', reason: 'Argo, Flux, Pulumi, Terraform \u2014 declarative deployment state', confidence: 0.88 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Cloud Orchestration & Platform Engineering', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates attention and task control across brain regions in response to changing demands.', inBusiness: 'In technology, cloud orchestration and platform engineering coordinates workloads, identity, and data across distributed systems.' },
      function: 'Orchestrates cloud workloads, identity, networking, and data across the enterprise platform',
      dysregulation: 'Cloud sprawl, cost overruns, vendor lock-in, multi-cloud fragmentation',
      expectedTypes: [
        { type: 'Internal developer platform (IDP)', reason: 'Backstage, Humanitec, Port \u2014 golden paths for engineering teams', confidence: 0.92 },
        { type: 'Multi-cloud orchestration platform', reason: 'Anthos, Azure Arc, Rafay \u2014 workload placement across clouds', confidence: 0.88 },
        { type: 'Cloud cost management (FinOps)', reason: 'Vantage, CloudZero, ProsperOps \u2014 cloud spend governance', confidence: 0.90 },
        { type: 'Kubernetes platform provider', reason: 'Red Hat OpenShift, Rancher, VMware Tanzu', confidence: 0.85 }
      ]
    },
    'NEOCER': {
      fullName: 'Neocerebellum', label: 'Fine-Grained Model Tuning', tier: 'top',
      neuroTranslation: { inNeurology: 'Refines motor and cognitive actions through precise prediction-error correction.', inBusiness: 'In technology, fine-grained model tuning refines AI system outputs by closing the loop on production error signals.' },
      function: 'Performs fine-tuning, RLHF, DPO, and online correction of deployed AI systems',
      dysregulation: 'Reward hacking, catastrophic forgetting, alignment drift, fine-tune regression',
      expectedTypes: [
        { type: 'Model fine-tuning platform', reason: 'Together AI, Anyscale, OpenPipe \u2014 managed fine-tune workflows', confidence: 0.90 },
        { type: 'RLHF / preference data provider', reason: 'Scale, Surge, Invisible \u2014 human feedback at scale', confidence: 0.88 },
        { type: 'Model observability / evaluation', reason: 'Arize, WhyLabs, Fiddler \u2014 production model monitoring', confidence: 0.90 },
        { type: 'Online learning infrastructure', reason: 'Production feedback loops for continuous model improvement', confidence: 0.75 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Threat Detection & Response', tier: 'top',
      neuroTranslation: { inNeurology: 'Initiates rapid defensive responses to perceived threats in the environment.', inBusiness: 'In technology, threat detection and response initiates rapid containment of cyber threats against production systems.' },
      function: 'Detects cybersecurity threats and initiates rapid containment and eradication',
      dysregulation: 'Alert fatigue, dwell time, delayed detection, response paralysis',
      expectedTypes: [
        { type: 'Endpoint detection and response (EDR/XDR)', reason: 'CrowdStrike, SentinelOne, Microsoft Defender \u2014 host-level threat response', confidence: 0.95 },
        { type: 'Managed detection and response (MDR)', reason: 'Arctic Wolf, Red Canary, Expel \u2014 24/7 threat hunting service', confidence: 0.90 },
        { type: 'Security orchestration (SOAR)', reason: 'Palo Alto XSOAR, Splunk SOAR, Tines \u2014 automated response playbooks', confidence: 0.88 },
        { type: 'Threat intelligence platform', reason: 'Recorded Future, Mandiant, Anomali \u2014 external threat feeds', confidence: 0.85 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Consumer Platform / Social Infrastructure', tier: 'top',
      neuroTranslation: { inNeurology: 'Activates during rest and self-referential thought; integrates autobiographical memory and future planning.', inBusiness: 'In technology, consumer platform and social infrastructure operates the ambient default layer users return to throughout the day.' },
      function: 'Operates the consumer platforms, social networks, and ambient services that shape daily digital life',
      dysregulation: 'Platform decay, engagement collapse, trust erosion, attention arms race',
      expectedTypes: [
        { type: 'Consumer social / messaging platform', reason: 'Meta, Snap, TikTok, Discord \u2014 daily-active consumer surfaces', confidence: 0.92 },
        { type: 'Content moderation / trust and safety vendor', reason: 'ActiveFence, Hive, TrustLab \u2014 platform integrity infrastructure', confidence: 0.88 },
        { type: 'Creator economy platform', reason: 'Patreon, Substack, Beehiiv \u2014 direct creator monetization', confidence: 0.78 },
        { type: 'Consumer app publisher', reason: 'Major app-store developers across iOS and Android', confidence: 0.75 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Interconnect & Integration Platforms', tier: 'top',
      neuroTranslation: { inNeurology: 'Connects the brain\u2019s hemispheres, enabling coordinated bilateral function.', inBusiness: 'In technology, interconnect and integration platforms connect disparate systems, enabling coordinated enterprise function.' },
      function: 'Connects heterogeneous enterprise systems through APIs, events, and data pipelines',
      dysregulation: 'Integration debt, schema drift, API sprawl, synchronization failures',
      expectedTypes: [
        { type: 'iPaaS / integration platform', reason: 'MuleSoft, Boomi, Workato \u2014 enterprise system integration', confidence: 0.92 },
        { type: 'API management platform', reason: 'Kong, Apigee, Postman \u2014 API lifecycle and governance', confidence: 0.90 },
        { type: 'Event streaming platform', reason: 'Confluent Kafka, Redpanda, AWS Kinesis \u2014 event-driven architecture', confidence: 0.88 },
        { type: 'Data pipeline / ETL platform', reason: 'Fivetran, Airbyte, dbt Labs \u2014 cross-system data movement', confidence: 0.90 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Network Routing & CDN', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays and gates sensory information between cortical and subcortical regions.', inBusiness: 'In technology, network routing and CDN services relay traffic between users, services, and origin infrastructure.' },
      function: 'Routes and accelerates traffic across the global internet; gates traffic at the edge',
      dysregulation: 'Latency spikes, packet loss, BGP routing leaks, DDoS cascade',
      expectedTypes: [
        { type: 'Content delivery network (CDN)', reason: 'Cloudflare, Fastly, Akamai \u2014 global edge traffic acceleration', confidence: 0.95 },
        { type: 'DNS / routing infrastructure', reason: 'NS1, AWS Route 53, Google Cloud DNS \u2014 authoritative DNS', confidence: 0.88 },
        { type: 'DDoS mitigation vendor', reason: 'Cloudflare, Imperva, Akamai Prolexic \u2014 attack absorption', confidence: 0.85 },
        { type: 'Edge compute platform', reason: 'Cloudflare Workers, Fastly Compute@Edge, AWS Lambda@Edge', confidence: 0.85 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Model Training & Reward Shaping', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes reward prediction and selects actions based on expected value.', inBusiness: 'In technology, model training and reward shaping selects training signals and reward functions that steer AI behavior.' },
      function: 'Trains large models, shapes reward signals, and selects data distributions that steer AI behavior',
      dysregulation: 'Reward model mis-specification, spurious correlation, data contamination, training instability',
      expectedTypes: [
        { type: 'Foundation model training lab', reason: 'OpenAI, Anthropic, Mistral, AI21 \u2014 trains frontier models', confidence: 0.92 },
        { type: 'GPU training infrastructure', reason: 'CoreWeave, Lambda Labs, Voltage Park \u2014 large-scale training compute', confidence: 0.95 },
        { type: 'Training data curation vendor', reason: 'Scale, Surge, Labelbox \u2014 high-quality labeled datasets', confidence: 0.88 },
        { type: 'Distributed training framework', reason: 'Mosaic (Databricks), Ray, Colossal-AI', confidence: 0.82 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Enterprise Data Platforms', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes and consolidates episodic memory for long-term retrieval.', inBusiness: 'In technology, enterprise data platforms encode, consolidate, and retrieve the organization\u2019s durable memory.' },
      function: 'Operates the enterprise data warehouse, lakehouse, and vector databases that hold organizational memory',
      dysregulation: 'Data silos, schema collapse, vector drift, retrieval staleness',
      expectedTypes: [
        { type: 'Cloud data warehouse', reason: 'Snowflake, Databricks, BigQuery, Redshift \u2014 analytic data platform', confidence: 0.95 },
        { type: 'Vector database provider', reason: 'Pinecone, Weaviate, Qdrant, Milvus \u2014 embedding retrieval for RAG', confidence: 0.92 },
        { type: 'Data catalog / lineage tool', reason: 'Alation, Collibra, Atlan \u2014 organizational data knowledge graph', confidence: 0.85 },
        { type: 'Transactional database (OLTP)', reason: 'PostgreSQL managed, CockroachDB, PlanetScale, Neon', confidence: 0.88 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Computer Vision & Pattern Recognition', tier: 'top',
      neuroTranslation: { inNeurology: 'Specializes in recognizing faces, objects, and complex visual patterns.', inBusiness: 'In technology, computer vision and pattern recognition systems detect and classify images, objects, and visual patterns.' },
      function: 'Builds and deploys computer vision systems for recognition, classification, and detection',
      dysregulation: 'Adversarial examples, bias amplification, deepfakes, model poisoning',
      expectedTypes: [
        { type: 'Computer vision platform', reason: 'Clarifai, Roboflow, Encord \u2014 end-to-end vision pipelines', confidence: 0.90 },
        { type: 'Deepfake detection / media authenticity', reason: 'Truepic, Deeptrust, Reality Defender', confidence: 0.85 },
        { type: 'Facial recognition / biometrics vendor', reason: 'Clearview, NEC, Idemia, Paravision', confidence: 0.78 },
        { type: 'Vision eval / benchmark service', reason: 'COCO, ImageNet, domain-specific benchmarks', confidence: 0.75 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Zero-Trust Identity Control', tier: 'top',
      neuroTranslation: { inNeurology: 'Maintains top-down executive control over goal-directed behavior and inhibits inappropriate responses.', inBusiness: 'In technology, zero-trust identity control enforces access policies and inhibits unauthorized actions across the enterprise.' },
      function: 'Enforces identity, authentication, and least-privilege access across users, devices, and services',
      dysregulation: 'Identity sprawl, standing access, token theft, privilege escalation',
      expectedTypes: [
        { type: 'Identity and access management (IAM)', reason: 'Okta, Microsoft Entra, Ping Identity \u2014 enterprise identity', confidence: 0.95 },
        { type: 'Privileged access management (PAM)', reason: 'CyberArk, BeyondTrust, Delinea \u2014 protect high-privilege accounts', confidence: 0.90 },
        { type: 'Zero-trust network access (ZTNA)', reason: 'Zscaler, Netskope, Cloudflare Access', confidence: 0.92 },
        { type: 'Identity governance and administration (IGA)', reason: 'SailPoint, Saviynt, Omada', confidence: 0.82 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Data Pipelines & Streaming', tier: 'top',
      neuroTranslation: { inNeurology: 'Carries signals between hippocampal memory systems and the rest of the brain.', inBusiness: 'In technology, data pipelines and streaming carry signals between systems of record and systems of insight.' },
      function: 'Moves data reliably between operational systems and analytical or ML systems',
      dysregulation: 'Pipeline breaks, schema evolution failures, back-pressure, data loss',
      expectedTypes: [
        { type: 'ELT / data integration platform', reason: 'Fivetran, Airbyte, Stitch \u2014 managed data pipelines', confidence: 0.92 },
        { type: 'Streaming platform', reason: 'Confluent, Redpanda, StreamNative (Pulsar)', confidence: 0.88 },
        { type: 'Change data capture (CDC) tool', reason: 'Debezium, Striim, Arcion', confidence: 0.80 },
        { type: 'Data orchestration (dbt, Dagster, Airflow)', reason: 'dbt Labs, Dagster, Astronomer \u2014 transform orchestration', confidence: 0.88 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Digital Reflection & Analytics', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates self-referential and metacognitive processing, supporting reflection.', inBusiness: 'In technology, digital reflection and analytics systems let the enterprise see itself through telemetry and dashboards.' },
      function: 'Provides analytics, dashboards, and metacognitive telemetry about the enterprise\u2019s own digital behavior',
      dysregulation: 'Metric drift, dashboard sprawl, vanity metrics, alert fatigue',
      expectedTypes: [
        { type: 'Business intelligence platform', reason: 'Looker, Tableau, ThoughtSpot, Mode', confidence: 0.92 },
        { type: 'Product analytics platform', reason: 'Amplitude, Mixpanel, Heap, Posthog', confidence: 0.90 },
        { type: 'Observability / APM platform', reason: 'Datadog, New Relic, Dynatrace, Chronosphere', confidence: 0.95 },
        { type: 'Semantic layer / metrics store', reason: 'Cube, Transform, Malloy \u2014 metrics governance', confidence: 0.80 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum (whole)', label: 'Developer Tools & Fine-Grained Tooling', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates and fine-tunes skilled movements through prediction and error correction.', inBusiness: 'In technology, developer tools and fine-grained tooling coordinate the precise work of building and shipping software.' },
      function: 'Provides the IDEs, linters, test runners, and everyday tools that let developers work precisely',
      dysregulation: 'Tool fragmentation, context switching cost, local dev environment rot',
      expectedTypes: [
        { type: 'IDE / code editor vendor', reason: 'JetBrains, Microsoft (VS Code), Cursor, Replit', confidence: 0.92 },
        { type: 'AI coding assistant', reason: 'GitHub Copilot, Cursor, Codeium, Tabnine \u2014 AI pair programming', confidence: 0.95 },
        { type: 'Code quality / linting tool', reason: 'SonarQube, Snyk Code, DeepSource', confidence: 0.85 },
        { type: 'Dev environment platform', reason: 'GitHub Codespaces, Gitpod, Daytona \u2014 cloud dev environments', confidence: 0.85 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Telemetry & Sensing', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, proprioceptive, and nociceptive input from the body.', inBusiness: 'In technology, telemetry and sensing platforms collect first-party signals from applications, users, and devices.' },
      function: 'Collects structured telemetry, logs, traces, and user sensor data from deployed systems',
      dysregulation: 'Blind spots, sampling bias, cardinality explosion, telemetry cost blowout',
      expectedTypes: [
        { type: 'Logging / log management platform', reason: 'Splunk, Elastic, Grafana Loki, Cribl', confidence: 0.92 },
        { type: 'Tracing / OpenTelemetry vendor', reason: 'Honeycomb, Lightstep, Grafana Tempo', confidence: 0.88 },
        { type: 'Real user monitoring (RUM)', reason: 'Sentry, LogRocket, FullStory', confidence: 0.82 },
        { type: 'IoT telemetry / edge sensing', reason: 'Particle, Losant, Balena \u2014 device telemetry', confidence: 0.75 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Compliance & Policy Enforcement', tier: 'top',
      neuroTranslation: { inNeurology: 'Monitors conflict, errors, and performance, signaling the need for adjustment.', inBusiness: 'In technology, compliance and policy enforcement monitors regulatory, contractual, and policy conflicts and signals remediation.' },
      function: 'Monitors technical and regulatory compliance (SOC 2, ISO 27001, GDPR, HIPAA, FedRAMP, EU AI Act) and enforces policy',
      dysregulation: 'Audit findings, control gaps, policy drift, compliance-as-theater',
      expectedTypes: [
        { type: 'Compliance automation platform', reason: 'Vanta, Drata, Secureframe, Thoropass \u2014 SOC 2 / ISO 27001 automation', confidence: 0.95 },
        { type: 'GRC / audit management', reason: 'AuditBoard, LogicGate, OneTrust \u2014 enterprise GRC', confidence: 0.88 },
        { type: 'Privacy management (GDPR/CCPA)', reason: 'OneTrust, TrustArc, BigID \u2014 privacy compliance', confidence: 0.85 },
        { type: 'AI governance / EU AI Act compliance', reason: 'Credo AI, Holistic AI \u2014 AI regulatory posture', confidence: 0.85 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'User Research & Product Discovery', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multisensory information and supports perspective-taking and theory of mind.', inBusiness: 'In technology, user research and product discovery integrates perspectives from users and stakeholders to build the right thing.' },
      function: 'Conducts user research, product discovery, and qualitative understanding of what users actually want',
      dysregulation: 'Product-market misfit, HiPPO decision-making, survivorship bias, assumption debt',
      expectedTypes: [
        { type: 'User research platform', reason: 'UserTesting, Dovetail, Maze, Lookback', confidence: 0.90 },
        { type: 'Customer feedback / insight tool', reason: 'Productboard, Canny, Cycle', confidence: 0.85 },
        { type: 'Session replay / heatmap', reason: 'FullStory, Hotjar, LogRocket', confidence: 0.82 },
        { type: 'A/B testing / experimentation platform', reason: 'Statsig, Eppo, Optimizely, Amplitude Experiment', confidence: 0.88 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Event Routing & Middleware', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays auditory information from the inner ear to the auditory cortex.', inBusiness: 'In technology, event routing and middleware relay messages from producers to consumers across service boundaries.' },
      function: 'Routes events, messages, and service-to-service communication across the microservice fabric',
      dysregulation: 'Message loss, ordering bugs, poison messages, dead-letter accumulation',
      expectedTypes: [
        { type: 'Message broker / queue', reason: 'RabbitMQ, AWS SQS, Azure Service Bus, Google Pub/Sub', confidence: 0.90 },
        { type: 'Service mesh', reason: 'Istio, Linkerd, Consul Connect \u2014 service-to-service traffic control', confidence: 0.85 },
        { type: 'Event-driven architecture platform', reason: 'EventBridge, Confluent, NATS', confidence: 0.85 },
        { type: 'Webhook / event router', reason: 'Svix, Zapier, n8n, Pipedream', confidence: 0.78 }
      ]
    },
    'UNC': {
      fullName: 'Uncinate Fasciculus', label: 'CRM & Customer Data Platforms', tier: 'top',
      neuroTranslation: { inNeurology: 'Links frontal and temporal lobes, integrating memory with emotional and social context.', inBusiness: 'In technology, CRM and customer data platforms integrate organizational memory with the customer relationship context.' },
      function: 'Operates customer relationship management and customer data platforms that bind sales, support, and marketing',
      dysregulation: 'CRM sprawl, data decay, attribution fragmentation, customer 360 failure',
      expectedTypes: [
        { type: 'CRM platform', reason: 'Salesforce, HubSpot, Microsoft Dynamics', confidence: 0.95 },
        { type: 'Customer data platform (CDP)', reason: 'Segment, mParticle, Rudderstack', confidence: 0.90 },
        { type: 'Customer success platform', reason: 'Gainsight, ChurnZero, Planhat', confidence: 0.85 },
        { type: 'Revenue operations / RevOps tooling', reason: 'Clari, Gong, Outreach \u2014 revenue execution platforms', confidence: 0.82 }
      ]
    },

    // ── TECHNOLOGY-OPERATIONAL NODES (83) — tighter mappings, 2 business types each ──
    'A1':    { fullName: 'Primary Auditory Cortex', label: 'Voice and Speech Interfaces', tier: 'operational', function: 'Processes voice input and speech interfaces for enterprise applications', dysregulation: 'Misrecognition, accent bias, privacy leakage', expectedTypes: [{ type: 'Speech recognition / ASR vendor', reason: 'Deepgram, AssemblyAI, Speechmatics', confidence: 0.85 }, { type: 'Conversational AI / IVR platform', reason: 'Dialpad, Observe.ai, Cresta', confidence: 0.80 }] },
    'ADR':   { fullName: 'Adrenal', label: 'Incident Response Surge Capacity', tier: 'operational', function: 'Provides surge incident response when production systems fail under acute stress', dysregulation: 'Incident fatigue, burnout, pager storms', expectedTypes: [{ type: 'Incident response platform', reason: 'PagerDuty, Opsgenie, FireHydrant, incident.io', confidence: 0.90 }, { type: 'IR retainer / DFIR service', reason: 'Mandiant, CrowdStrike Services, Kroll', confidence: 0.82 }] },
    'AG':    { fullName: 'Angular Gyrus', label: 'Knowledge Graphs and Semantic Layer', tier: 'operational', function: 'Builds knowledge graphs and semantic layers over enterprise data', dysregulation: 'Graph drift, ontology collapse', expectedTypes: [{ type: 'Knowledge graph platform', reason: 'Neo4j, TigerGraph, Amazon Neptune', confidence: 0.80 }, { type: 'Semantic layer / metrics platform', reason: 'Cube, dbt Semantic Layer, AtScale', confidence: 0.78 }] },
    'AI':    { fullName: 'Anterior Insula', label: 'Risk Signal Triage', tier: 'operational', function: 'Triages and prioritizes risk signals across the technology stack', dysregulation: 'Signal fatigue, triage paralysis', expectedTypes: [{ type: 'Security alert triage platform', reason: 'Tines, Torq, D3 Security \u2014 automated alert triage', confidence: 0.82 }, { type: 'Risk quantification platform', reason: 'RiskLens, Axio \u2014 FAIR-based cyber risk', confidence: 0.75 }] },
    'ANT':   { fullName: 'Anterior Thalamus', label: 'Attention and Focus Tools', tier: 'operational', function: 'Provides attention / focus primitives to application UIs', dysregulation: 'Distraction, context collapse', expectedTypes: [{ type: 'Productivity / focus app', reason: 'Todoist, Asana, Notion \u2014 knowledge worker focus tools', confidence: 0.75 }] },
    'ARC':   { fullName: 'Arcuate Fasciculus', label: 'Code-to-Language Translation', tier: 'operational', function: 'Translates between natural language and code (AI coding, docs generation)', dysregulation: 'Hallucinated code, doc drift', expectedTypes: [{ type: 'AI documentation generator', reason: 'Mintlify, Swimm, CodeSee', confidence: 0.78 }, { type: 'Natural language to SQL / code', reason: 'Text-to-SQL tools, AI code search', confidence: 0.78 }] },
    'BDNF':  { fullName: 'Brain-Derived Neurotrophic Factor', label: 'Engineering Learning / Upskilling', tier: 'operational', function: 'Supports continuous engineering learning and skill acquisition', dysregulation: 'Skill atrophy, tech debt learning gap', expectedTypes: [{ type: 'Engineering learning platform', reason: 'Pluralsight, Educative, Coursera for Business', confidence: 0.82 }, { type: 'Corporate training / bootcamp', reason: 'A Cloud Guru, Udemy Business', confidence: 0.75 }] },
    'BLA':   { fullName: 'Basolateral Amygdala', label: 'Threat Learning and Hunting', tier: 'operational', function: 'Learns from threat patterns to anticipate future attacks', dysregulation: 'Threat model rot, obsolete IoCs', expectedTypes: [{ type: 'Threat hunting platform', reason: 'Corelight, Vectra AI, Cybereason', confidence: 0.85 }, { type: 'Threat intelligence feed', reason: 'Recorded Future, Flashpoint, DomainTools', confidence: 0.82 }] },
    'BNST':  { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Sustained Anomaly Monitoring', tier: 'operational', function: 'Watches for sustained low-level anomalies across systems', dysregulation: 'Slow-burn compromises missed', expectedTypes: [{ type: 'User and entity behavior analytics (UEBA)', reason: 'Exabeam, Securonix, Gurucul', confidence: 0.82 }] },
    'BROCA': { fullName: 'Broca\u2019s Area', label: 'Natural Language Generation', tier: 'operational', function: 'Generates natural language in products (LLM-powered)', dysregulation: 'Hallucination, tone drift', expectedTypes: [{ type: 'LLM API provider', reason: 'OpenAI, Anthropic, Google Gemini, Mistral', confidence: 0.95 }, { type: 'NLG / content generation tool', reason: 'Jasper, Copy.ai, Writer', confidence: 0.80 }] },
    'CARD':  { fullName: 'Cardiovascular System', label: 'Core Uptime and Heartbeat', tier: 'operational', function: 'Provides uptime monitoring and heartbeat / health checks for core services', dysregulation: 'Missed outages, false uptime', expectedTypes: [{ type: 'Uptime / synthetic monitoring', reason: 'Pingdom, StatusCake, Checkly, Uptime.com', confidence: 0.88 }, { type: 'Status page / incident comms', reason: 'Statuspage, Status.io, Instatus', confidence: 0.82 }] },
    'CAUD':  { fullName: 'Caudate Nucleus', label: 'Workflow Automation', tier: 'operational', function: 'Automates repetitive engineering and business workflows', dysregulation: 'Automation sprawl, brittle bots', expectedTypes: [{ type: 'Workflow automation platform', reason: 'Zapier, Make, n8n, Workato', confidence: 0.85 }, { type: 'RPA vendor', reason: 'UiPath, Automation Anywhere, Blue Prism', confidence: 0.78 }] },
    'CING':  { fullName: 'Cingulate Cortex (general)', label: 'Engineering Culture and Postmortems', tier: 'operational', function: 'Runs blameless postmortems and engineering culture rituals', dysregulation: 'Blame culture, repeat incidents', expectedTypes: [{ type: 'Postmortem / incident review tool', reason: 'Jeli, FireHydrant, Rootly', confidence: 0.78 }] },
    'CLAUST':{ fullName: 'Claustrum', label: 'Cross-Service Correlation', tier: 'operational', function: 'Correlates events across services to find global patterns', dysregulation: 'Silo blindness', expectedTypes: [{ type: 'Distributed tracing platform', reason: 'Honeycomb, Jaeger, Tempo', confidence: 0.82 }] },
    'CMZ':   { fullName: 'Central Midbrain Zone', label: 'Arousal and Load Shedding', tier: 'operational', function: 'Controls system arousal under load; triggers throttling and load shedding', dysregulation: 'Cascading failures', expectedTypes: [{ type: 'Rate limiting / load shedding', reason: 'Kong rate limit, Envoy, Stripe rate limit libs', confidence: 0.78 }] },
    'CON':   { fullName: 'Cingulo-opercular Network', label: 'Sustained Monitoring Loops', tier: 'operational', function: 'Maintains sustained monitoring loops across long-running systems', dysregulation: 'Drift, slow degradation', expectedTypes: [{ type: 'SLO / reliability platform', reason: 'Nobl9, Blameless SLO, Cortex', confidence: 0.80 }] },
    'DAN':   { fullName: 'Dorsal Attention Network', label: 'Goal-Directed Observability', tier: 'operational', function: 'Directs observability attention toward current goals and SLIs', dysregulation: 'Metric noise, signal blindness', expectedTypes: [{ type: 'SRE / reliability consultancy', reason: 'Helps teams focus observability on the right signals', confidence: 0.72 }] },
    'DISS':  { fullName: 'Dissociation', label: 'Chaos Engineering and Resilience Testing', tier: 'operational', function: 'Deliberately disrupts systems to validate resilience', dysregulation: 'Untested failure modes', expectedTypes: [{ type: 'Chaos engineering platform', reason: 'Gremlin, Chaos Mesh, Harness Chaos', confidence: 0.85 }] },
    'DV':    { fullName: 'Dorsal Vagal Complex', label: 'Graceful Shutdown and Dormancy', tier: 'operational', function: 'Handles graceful degradation and low-power / dormant system modes', dysregulation: 'Hard crashes, data loss', expectedTypes: [{ type: 'Graceful shutdown / lifecycle tooling', reason: 'Kubernetes lifecycle hooks, systemd, supervisord', confidence: 0.72 }] },
    'EC':    { fullName: 'Entorhinal Cortex', label: 'Context Indexing for RAG', tier: 'operational', function: 'Indexes context for retrieval-augmented generation systems', dysregulation: 'Stale retrieval', expectedTypes: [{ type: 'RAG framework / tooling', reason: 'LlamaIndex, LangChain, Haystack', confidence: 0.85 }] },
    'EI':    { fullName: 'Excitatory/Inhibitory Balance', label: 'Rate-Limiting and Quotas', tier: 'operational', function: 'Balances throughput with rate-limiting and quotas', dysregulation: 'Thundering herd, starvation', expectedTypes: [{ type: 'API gateway with rate limiting', reason: 'Kong, Tyk, AWS API Gateway', confidence: 0.80 }] },
    'EMP':   { fullName: 'Empathy Circuit', label: 'Customer Support AI', tier: 'operational', function: 'Provides empathetic customer support via AI and human blended channels', dysregulation: 'Tone-deaf automation', expectedTypes: [{ type: 'AI customer support platform', reason: 'Intercom Fin, Ada, Forethought', confidence: 0.85 }] },
    'ENDO':  { fullName: 'Endocrine System', label: 'Scheduled Background Tasks', tier: 'operational', function: 'Runs scheduled and background batch tasks that maintain system state', dysregulation: 'Cron failures, job drift', expectedTypes: [{ type: 'Job scheduler / cron manager', reason: 'Airflow, Temporal, Prefect, Inngest', confidence: 0.85 }] },
    'ENS':   { fullName: 'Enteric Nervous System', label: 'Autonomous Agent Infrastructure', tier: 'operational', function: 'Runs autonomous long-lived agents that operate without central direction', dysregulation: 'Agent runaway, cost blowup', expectedTypes: [{ type: 'Agent orchestration platform', reason: 'LangGraph, CrewAI, AutoGen', confidence: 0.78 }] },
    'FEF':   { fullName: 'Frontal Eye Field', label: 'Attention Routing / SLOs', tier: 'operational', function: 'Routes operator attention to highest-priority issues', dysregulation: 'Alert fatigue', expectedTypes: [{ type: 'Alert routing / on-call tool', reason: 'PagerDuty routing, Opsgenie policies', confidence: 0.80 }] },
    'GABA_GLU':{ fullName: 'GABA / Glutamate Balance', label: 'Concurrency and Backpressure', tier: 'operational', function: 'Balances concurrent load across services with backpressure', dysregulation: 'Overload collapse', expectedTypes: [{ type: 'Circuit breaker / resilience library', reason: 'Resilience4j, Hystrix, Polly', confidence: 0.72 }] },
    'GBA':   { fullName: 'Gut-Brain Axis', label: 'Data Feedback Loops', tier: 'operational', function: 'Maintains feedback loops between operational data and strategic systems', dysregulation: 'Stale decisioning', expectedTypes: [{ type: 'Reverse ETL platform', reason: 'Hightouch, Census, Grouparoo', confidence: 0.82 }] },
    'GP':    { fullName: 'Globus Pallidus', label: 'Deployment Gating', tier: 'operational', function: 'Gates deployments through policy checks and approvals', dysregulation: 'Gate bypasses, approval theater', expectedTypes: [{ type: 'Deployment approval / policy gate', reason: 'OPA Gatekeeper, Kyverno, Sentinel', confidence: 0.78 }] },
    'HAB':   { fullName: 'Habenula', label: 'Failure Signal Propagation', tier: 'operational', function: 'Propagates failure signals that teach the system what to avoid', dysregulation: 'Repeated failure modes', expectedTypes: [{ type: 'Error tracking platform', reason: 'Sentry, Rollbar, Bugsnag', confidence: 0.88 }] },
    'HPA':   { fullName: 'HPA Axis', label: 'Incident Escalation Chains', tier: 'operational', function: 'Manages multi-tier incident escalation across engineering and leadership', dysregulation: 'Escalation loops', expectedTypes: [{ type: 'Incident escalation tool', reason: 'PagerDuty, Opsgenie escalation policies', confidence: 0.82 }] },
    'HYPO':  { fullName: 'Hypothalamus', label: 'System Homeostasis Controller', tier: 'operational', function: 'Maintains baseline system homeostasis (capacity, cost, performance)', dysregulation: 'Drift from baseline', expectedTypes: [{ type: 'Autoscaling / capacity planner', reason: 'Karpenter, KEDA, Kubernetes HPA/VPA', confidence: 0.85 }] },
    'IC':    { fullName: 'Inferior Colliculus', label: 'Log Ingestion Middleware', tier: 'operational', function: 'Ingests and relays log streams from sources to sinks', dysregulation: 'Dropped logs', expectedTypes: [{ type: 'Log shipper / observability pipeline', reason: 'Fluentd, Vector.dev, Cribl Stream', confidence: 0.85 }] },
    'IPS':   { fullName: 'Intraparietal Sulcus', label: 'Data Engineering and ETL', tier: 'operational', function: 'Executes data engineering and ETL workloads', dysregulation: 'Pipeline drift', expectedTypes: [{ type: 'Data engineering platform', reason: 'dbt, Databricks, Snowflake', confidence: 0.90 }] },
    'LANG':  { fullName: 'Language Network', label: 'Multilingual Localization', tier: 'operational', function: 'Localizes applications across languages and locales', dysregulation: 'Translation drift', expectedTypes: [{ type: 'Localization platform', reason: 'Lokalise, Phrase, Transifex, Crowdin', confidence: 0.82 }] },
    'LAR':   { fullName: 'Laryngeal Cortex', label: 'Outbound Messaging and Notifications', tier: 'operational', function: 'Sends outbound notifications across channels', dysregulation: 'Deliverability failures', expectedTypes: [{ type: 'Notifications / messaging API', reason: 'Twilio, Courier, Knock', confidence: 0.85 }] },
    'LC':    { fullName: 'Locus Coeruleus', label: 'Global Alerting and Norepinephrine', tier: 'operational', function: 'Broadcasts system-wide alerts that demand immediate attention', dysregulation: 'Alert storms', expectedTypes: [{ type: 'Alerting / broadcast platform', reason: 'PagerDuty, VictorOps, xMatters', confidence: 0.82 }] },
    'LGN':   { fullName: 'Lateral Geniculate Nucleus', label: 'Image and Video Pipelines', tier: 'operational', function: 'Ingests and processes image and video streams for downstream vision models', dysregulation: 'Frame loss, codec issues', expectedTypes: [{ type: 'Video infrastructure platform', reason: 'Mux, Cloudflare Stream, AWS Media Services', confidence: 0.80 }] },
    'MAMM':  { fullName: 'Mammillary Bodies', label: 'Long-Term Memory Archive', tier: 'operational', function: 'Archives long-term memory and cold data', dysregulation: 'Retrieval failures', expectedTypes: [{ type: 'Cold storage / archive', reason: 'AWS Glacier, Backblaze B2, Wasabi', confidence: 0.78 }] },
    'MDT':   { fullName: 'Mediodorsal Thalamus', label: 'Decision Gating for AI Actions', tier: 'operational', function: 'Gates AI agent actions through human or policy approval', dysregulation: 'Unsafe autonomy', expectedTypes: [{ type: 'AI guardrails / policy enforcement', reason: 'Guardrails AI, Llama Guard, Protect AI', confidence: 0.82 }] },
    'MICRO': { fullName: 'Microglia', label: 'Vulnerability Scanning and Patching', tier: 'operational', function: 'Scans for vulnerabilities and applies patches across the fleet', dysregulation: 'Unpatched critical vulns', expectedTypes: [{ type: 'Vulnerability scanner', reason: 'Tenable, Qualys, Rapid7, Wiz', confidence: 0.92 }, { type: 'Patch management platform', reason: 'Automox, Kandji, NinjaOne', confidence: 0.82 }] },
    'NAcc':  { fullName: 'Nucleus Accumbens', label: 'Developer Experience and DX Metrics', tier: 'operational', function: 'Measures and rewards developer experience', dysregulation: 'DX decay, attrition', expectedTypes: [{ type: 'DX / engineering analytics', reason: 'LinearB, Jellyfish, Code Climate Velocity', confidence: 0.82 }] },
    'NBM':   { fullName: 'Nucleus Basalis of Meynert', label: 'Release Cadence and Velocity', tier: 'operational', function: 'Sets engineering release cadence and velocity discipline', dysregulation: 'Velocity collapse', expectedTypes: [{ type: 'Engineering intelligence platform', reason: 'Swarmia, Faros AI, Sleuth', confidence: 0.78 }] },
    'NTS':   { fullName: 'Nucleus Tractus Solitarius', label: 'Telemetry Aggregation', tier: 'operational', function: 'Aggregates interoceptive telemetry from many sources into a unified view', dysregulation: 'Noisy metrics', expectedTypes: [{ type: 'Metrics aggregation platform', reason: 'Prometheus, InfluxDB, VictoriaMetrics', confidence: 0.85 }] },
    'OFC':   { fullName: 'Orbitofrontal Cortex', label: 'Unit Economics and Pricing', tier: 'operational', function: 'Evaluates expected value of technical and product choices', dysregulation: 'Negative unit economics', expectedTypes: [{ type: 'Pricing / billing platform', reason: 'Stripe Billing, Chargebee, Orb, Lago', confidence: 0.85 }] },
    'OLF':   { fullName: 'Olfactory System', label: 'Anomaly Detection (ML)', tier: 'operational', function: 'Detects subtle anomalies that pattern-match prior bad states', dysregulation: 'Missed novel attacks', expectedTypes: [{ type: 'Anomaly detection platform', reason: 'Anodot, DataDog Watchdog, Dynatrace Davis', confidence: 0.82 }] },
    'OPIOID':{ fullName: 'Opioid System', label: 'Soothing UX and Delight', tier: 'operational', function: 'Provides UX delight and reduces user frustration', dysregulation: 'User frustration, churn', expectedTypes: [{ type: 'Design system / UX platform', reason: 'Figma, Framer, Storybook', confidence: 0.82 }] },
    'OSC':   { fullName: 'Neural Oscillators', label: 'Scheduled Syncs and Cadence', tier: 'operational', function: 'Maintains scheduled sync rhythms across distributed systems', dysregulation: 'Clock drift', expectedTypes: [{ type: 'Clock synchronization / NTP', reason: 'AWS Time Sync, NTP pools', confidence: 0.65 }] },
    'OXY':   { fullName: 'Oxytocin System', label: 'Trust and Reputation Infrastructure', tier: 'operational', function: 'Builds trust signals between users, systems, and vendors', dysregulation: 'Trust collapse', expectedTypes: [{ type: 'Digital trust / certificate authority', reason: 'DigiCert, Let\u2019s Encrypt, Sectigo', confidence: 0.82 }] },
    'PAG':   { fullName: 'Periaqueductal Gray', label: 'Kill Switches and Lockdown', tier: 'operational', function: 'Provides kill switches and lockdown controls for emergencies', dysregulation: 'Kill-switch failure', expectedTypes: [{ type: 'Emergency access / break-glass tool', reason: 'Teleport, StrongDM, Gravitational', confidence: 0.78 }] },
    'PBN':   { fullName: 'Parabrachial Nucleus', label: 'Capacity Signaling', tier: 'operational', function: 'Signals capacity constraints to upstream systems', dysregulation: 'Silent overload', expectedTypes: [{ type: 'Capacity planning platform', reason: 'CloudZero, Vantage, ProsperOps', confidence: 0.75 }] },
    'PCC':   { fullName: 'Posterior Cingulate Cortex', label: 'Retrospective Analytics', tier: 'operational', function: 'Provides retrospective analytics over historical behavior', dysregulation: 'Historical blindness', expectedTypes: [{ type: 'Time-series analytics / BI', reason: 'Grafana, Looker, Metabase', confidence: 0.80 }] },
    'PI':    { fullName: 'Posterior Insula', label: 'Infrastructure Self-Monitoring', tier: 'operational', function: 'Monitors the infrastructure\u2019s internal state', dysregulation: 'Opaque state', expectedTypes: [{ type: 'Infrastructure monitoring', reason: 'Datadog Infra, Grafana Cloud, Zabbix', confidence: 0.85 }] },
    'PIN':   { fullName: 'Pineal Gland', label: 'Scheduled Batch and Cron', tier: 'operational', function: 'Runs scheduled / time-gated workloads and nightly jobs', dysregulation: 'Missed cron runs', expectedTypes: [{ type: 'Cron monitoring / scheduler', reason: 'Cronitor, Healthchecks.io, Inngest', confidence: 0.78 }] },
    'PIT':   { fullName: 'Pituitary Gland', label: 'Release Broadcast and Changelogs', tier: 'operational', function: 'Broadcasts release information and changelogs to downstream teams', dysregulation: 'Silent releases', expectedTypes: [{ type: 'Release notes / changelog tool', reason: 'LaunchNotes, Changefeed, Beamer', confidence: 0.72 }] },
    'PPN':   { fullName: 'Pedunculopontine Nucleus', label: 'Continuous Integration Runners', tier: 'operational', function: 'Runs continuous integration jobs on commits and PRs', dysregulation: 'CI flakiness', expectedTypes: [{ type: 'CI runner / build farm', reason: 'BuildJet, Namespace, Blacksmith, GitHub runners', confidence: 0.82 }] },
    'PULV':  { fullName: 'Pulvinar', label: 'Attention-Weighted Monitoring', tier: 'operational', function: 'Weights monitoring attention by business criticality', dysregulation: 'Critical path blindness', expectedTypes: [{ type: 'Service catalog / criticality tooling', reason: 'Cortex, OpsLevel, Backstage', confidence: 0.78 }] },
    'PUT':   { fullName: 'Putamen', label: 'Release Habit Formation', tier: 'operational', function: 'Enforces habitual release rhythms and runbook muscle memory', dysregulation: 'Runbook rot', expectedTypes: [{ type: 'Runbook / playbook automation', reason: 'Rundeck, StackStorm, Rootly', confidence: 0.75 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Mood / System Tone Monitoring', tier: 'operational', function: 'Monitors overall system tone and team morale indicators', dysregulation: 'Morale decay', expectedTypes: [{ type: 'Engineering team health survey', reason: 'DX survey, SPACE framework tooling', confidence: 0.70 }] },
    'RF':    { fullName: 'Reticular Formation', label: 'Wake-from-Idle and Cold Starts', tier: 'operational', function: 'Handles wake-from-idle and cold-start behavior for serverless and containers', dysregulation: 'Cold start latency', expectedTypes: [{ type: 'Serverless cold-start optimizer', reason: 'AWS Lambda SnapStart, GCP Cloud Run', confidence: 0.72 }] },
    'RSC':   { fullName: 'Retrosplenial Cortex', label: 'Environment Mapping and CMDB', tier: 'operational', function: 'Maps the enterprise technology environment (assets, configs, relationships)', dysregulation: 'CMDB rot', expectedTypes: [{ type: 'Asset discovery / CMDB', reason: 'Axonius, JupiterOne, Device42', confidence: 0.80 }] },
    'SC':    { fullName: 'Superior Colliculus', label: 'Orient-to-Threat Dashboards', tier: 'operational', function: 'Orients operator attention to new threats quickly', dysregulation: 'Dashboard overload', expectedTypes: [{ type: 'SOC dashboard / SIEM UI', reason: 'Splunk Enterprise Security, Chronicle, Sumo Logic', confidence: 0.80 }] },
    'SEPT':  { fullName: 'Septal Nuclei', label: 'Trust Chains / PKI', tier: 'operational', function: 'Maintains trust chains and PKI across the enterprise', dysregulation: 'Certificate expirations', expectedTypes: [{ type: 'Certificate lifecycle management', reason: 'Venafi, Keyfactor, DigiCert CertCentral', confidence: 0.82 }] },
    'SMA':   { fullName: 'Supplementary Motor Area', label: 'Deployment Preparation', tier: 'operational', function: 'Prepares deployments (pre-flight checks, canaries, staging)', dysregulation: 'Broken pre-flights', expectedTypes: [{ type: 'Pre-deployment validation tool', reason: 'Spinnaker, Argo Rollouts, Harness', confidence: 0.80 }] },
    'SMN':   { fullName: 'Somatomotor Network', label: 'Physical Layer / Data Center Ops', tier: 'operational', function: 'Runs physical data center and bare-metal operations', dysregulation: 'Hardware failures', expectedTypes: [{ type: 'DCIM / data center management', reason: 'Nlyte, Schneider EcoStruxure IT, Sunbird', confidence: 0.72 }] },
    'SN':    { fullName: 'Salience Network', label: 'Priority Anomaly Detection', tier: 'operational', function: 'Surfaces the most salient anomalies to human operators', dysregulation: 'Alert blindness', expectedTypes: [{ type: 'AIOps alert correlation', reason: 'BigPanda, Moogsoft, Zenoss', confidence: 0.80 }] },
    'SNIG':  { fullName: 'Substantia Nigra', label: 'Platform Initiative Momentum', tier: 'operational', function: 'Initiates and sustains platform engineering initiatives', dysregulation: 'Initiative paralysis', expectedTypes: [{ type: 'Platform engineering consultancy', reason: 'Drives platform team rollouts', confidence: 0.72 }] },
    'SNS':   { fullName: 'Sympathetic Nervous System', label: 'Emergency Response Mobilization', tier: 'operational', function: 'Mobilizes all-hands emergency response to severe incidents', dysregulation: 'Emergency fatigue', expectedTypes: [{ type: 'Major incident command platform', reason: 'incident.io, FireHydrant, Rootly', confidence: 0.82 }] },
    'STN':   { fullName: 'Subthalamic Nucleus', label: 'Deployment Hold and Freeze', tier: 'operational', function: 'Halts deployments during incidents and holidays', dysregulation: 'Deployment during freeze', expectedTypes: [{ type: 'Change freeze / deploy lockdown tool', reason: 'Harness, Spinnaker policies, custom gates', confidence: 0.75 }] },
    'STS':   { fullName: 'Superior Temporal Sulcus', label: 'Behavioral Pattern Recognition', tier: 'operational', function: 'Recognizes behavioral patterns in users and systems', dysregulation: 'Fraud missed', expectedTypes: [{ type: 'Fraud detection platform', reason: 'Sift, Signifyd, Forter, Kount', confidence: 0.85 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Reputation and Brand Memory', tier: 'operational', function: 'Maintains reputation and brand context across public-facing systems', dysregulation: 'Brand damage', expectedTypes: [{ type: 'Brand / reputation monitoring', reason: 'Brandwatch, Meltwater, Sprinklr', confidence: 0.78 }] },
    'TrkB':  { fullName: 'Tropomyosin receptor kinase B', label: 'Feature Flag Learning', tier: 'operational', function: 'Enables safe experimentation and learning through feature flags', dysregulation: 'Flag debt', expectedTypes: [{ type: 'Feature flag platform', reason: 'LaunchDarkly, Split, Unleash, GrowthBook', confidence: 0.88 }] },
    'V1':    { fullName: 'Primary Visual Cortex', label: 'Raw Screen and Pixel Capture', tier: 'operational', function: 'Captures raw visual signals (screenshots, recordings)', dysregulation: 'Capture failures', expectedTypes: [{ type: 'Session recording / screen capture', reason: 'FullStory, LogRocket, Hotjar', confidence: 0.80 }] },
    'VAN':   { fullName: 'Ventral Attention Network', label: 'Interrupt Handling', tier: 'operational', function: 'Handles interrupts and urgent attention shifts', dysregulation: 'Ignored interrupts', expectedTypes: [{ type: 'On-call paging / alert tool', reason: 'PagerDuty, Opsgenie, Splunk On-Call', confidence: 0.82 }] },
    'VERM':  { fullName: 'Cerebellar Vermis', label: 'Core Reliability and Reliability Engineering', tier: 'operational', function: 'Runs core reliability engineering practices', dysregulation: 'SLO erosion', expectedTypes: [{ type: 'SRE consultancy / platform', reason: 'Google SRE-aligned consultancies, Reliability Inc', confidence: 0.75 }] },
    'VEST':  { fullName: 'Vestibular System', label: 'Drift Detection', tier: 'operational', function: 'Detects drift between intended and actual system state', dysregulation: 'Config drift', expectedTypes: [{ type: 'Drift detection / state reconciliation', reason: 'Spacelift, env0, Firefly', confidence: 0.78 }] },
    'VP':    { fullName: 'Ventral Pallidum', label: 'Deprecation and Sunsetting', tier: 'operational', function: 'Handles graceful deprecation and sunsetting of services', dysregulation: 'Zombie services', expectedTypes: [{ type: 'Service catalog with deprecation workflows', reason: 'Backstage, OpsLevel, Cortex', confidence: 0.75 }] },
    'VTA':   { fullName: 'Ventral Tegmental Area', label: 'Incentive and Bug Bounty Programs', tier: 'operational', function: 'Incentivizes external researchers and contributors', dysregulation: 'Bug bounty fatigue', expectedTypes: [{ type: 'Bug bounty / crowdsourced security', reason: 'HackerOne, Bugcrowd, Intigriti', confidence: 0.85 }] },
    'VV':    { fullName: 'Ventral Vagal Complex', label: 'Integration Hub', tier: 'operational', function: 'Integrates calm, long-running systems across modes', dysregulation: 'Integration failures', expectedTypes: [{ type: 'Integration hub', reason: 'Zapier, Workato, Tray.io', confidence: 0.78 }] },
    'WERN':  { fullName: 'Wernicke\u2019s Area', label: 'Natural Language Understanding', tier: 'operational', function: 'Understands natural language inputs in products', dysregulation: 'Misunderstood intents', expectedTypes: [{ type: 'NLU / intent recognition platform', reason: 'Rasa, Cohere, Google Dialogflow', confidence: 0.85 }] },
    'mPFC':  { fullName: 'Medial Prefrontal Cortex', label: 'Quality Engineering', tier: 'operational', function: 'Runs quality engineering across product and platform', dysregulation: 'Quality regressions', expectedTypes: [{ type: 'Test automation platform', reason: 'Cypress, Playwright, BrowserStack', confidence: 0.85 }] },
    'rACC':  { fullName: 'Rostral Anterior Cingulate', label: 'Code Review and Quality Feedback', tier: 'operational', function: 'Runs code review and quality feedback across engineering', dysregulation: 'Review-bottleneck', expectedTypes: [{ type: 'Code review / analysis platform', reason: 'CodeRabbit, Graphite, Reviewable', confidence: 0.80 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Policy Enforcement at API Layer', tier: 'operational', function: 'Enforces authorization and policy at the API layer', dysregulation: 'BOLA / access bugs', expectedTypes: [{ type: 'Authorization platform', reason: 'Auth0 FGA, Oso, Cerbos, Permit.io', confidence: 0.82 }] },
    'vmPFC': { fullName: 'Ventromedial Prefrontal Cortex', label: 'Strategic Trade-off Decisions', tier: 'operational', function: 'Makes strategic trade-off decisions across product and platform', dysregulation: 'Analysis paralysis', expectedTypes: [{ type: 'Product / roadmap planning tool', reason: 'Productboard, Aha!, ProductPlan', confidence: 0.78 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveApprovals(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function approvalKey(nodeId, businessType) { return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50); }
  function getApprovalStatus(nodeId, businessType) { return loadApprovals()[approvalKey(nodeId, businessType)] || null; }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) return callback(_hierarchyCache);
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached; _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}
    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('technology');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = { nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {}, nodeLabels: {}, nodeDepths: {}, allActivations: [] };

    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue;
        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;
        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
        }
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
        }
        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) result.nodeDiagnoses[nid][dx[di]] = true;
        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }
    processActivations(topLevel.activations || [], 0);
    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();
    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}
    callback(result);
  }

  function getTechnologyState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('technology');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getTechnologyState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('technology') : null;
      var portal = brain ? brain._portalCache : null;
      if (portal && portal.activations) {
        for (var ai = 0; ai < portal.activations.length; ai++) {
          var act = portal.activations[ai];
          var nid = act.brainNodeId;
          if (!nodeCompanyIndex[nid]) nodeCompanyIndex[nid] = {};
          var cos = act.companies || [];
          for (var ci = 0; ci < cos.length; ci++) {
            var tk = cos[ci].ticker_or_id || cos[ci].name;
            nodeCompanyIndex[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason };
          }
        }
      }
    }

    var mapped = [], missing = [], speculative = [];

    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }

      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;

        var alreadyMapped = false;
        var typeWords = expected.type.toLowerCase().split(/\s+/);
        for (var mi = 0; mi < mappedCompanyNames.length; mi++) {
          var compLower = mappedCompanyNames[mi].toLowerCase();
          var matchCount = 0;
          for (var wi = 0; wi < typeWords.length; wi++) {
            if (typeWords[wi].length > 3 && compLower.indexOf(typeWords[wi]) !== -1) matchCount++;
          }
          if (matchCount >= 2) { alreadyMapped = true; break; }
        }
        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var matchCount2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) matchCount2++;
            }
            if (matchCount2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Technology.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: this business type becomes eligible for future portal path mapping within Technology.';
          else consequence = 'If approved: this business type is recorded as a valid Technology mapping. Requires further validation.';
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) variantState = 'MISSING';
        else if (!alreadyMapped) variantState = 'PROPOSED';
        else variantState = 'MAPPED';

        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey, nodeId: nodeId, nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label, nodeFunction: dir.function, plainFunction: dir.function,
          dysregulation: dir.dysregulation || '', plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason, confidence: expected.confidence,
          nodeActive: nodeActive, alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames, approval: approval,
          approvalRequired: showButtons, variantState: variantState,
          approvalConsequence: consequence, tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) { entry.bucket = 'MAPPED'; mapped.push(entry); }
        else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}, out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);
    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    return approved;
  }

  window.LIMENTechnologyBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    NODE_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  loadFullHierarchy(function () { console.log('[TechnologyBusinessEngine] Hierarchy loaded'); });
  console.log('[TechnologyBusinessEngine] Loaded \u2014 103-node technology business engine');
})();
