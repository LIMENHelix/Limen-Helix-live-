# Claude Code Skills — skills.sh scrape

Sources: [skills.sh — search "claude code"](https://www.skills.sh/?q=claude+code) + Anthropic's official GitHub repos
Scraped: 2026-07-12 · **355 skills total** — 100 from the skills.sh top-100 (11 repos) plus **255 additional official Anthropic skills** (see the second half of this doc)

Install any skill with the skills.sh CLI:

```
npx skills add https://github.com/<owner>/<repo> --skill '<Skill Name>'
# example:
npx skills add https://github.com/anthropics/claude-code --skill 'Skill Development'

# or install a whole repo's skills at once:
npx skills add https://github.com/anthropics/claude-code
```

Each skill's `SKILL.md` lives in its source GitHub repo (linked per section).

---

## Top skills by installs

| Installs | Skill | Repo |
|---:|---|---|
| 122k | `git-guardrails-claude-code` | mattpocock/skills |
| 16k | `agent-development` | anthropics/claude-code |
| 15k | `skill-development` | anthropics/claude-code |
| 11k | `security-review` | affaan-m/everything-claude-code |
| 10k | `plugin-structure` | anthropics/claude-code |
| 10k | `plugin-settings` | anthropics/claude-code |
| 10k | `writing-hookify-rules` | anthropics/claude-code |
| 9.9k | `golang-patterns` | affaan-m/everything-claude-code |
| 8.7k | `coding-standards` | affaan-m/everything-claude-code |
| 8.7k | `claude-opus-4-5-migration` | anthropics/claude-code |
| 8.6k | `backend-patterns` | affaan-m/everything-claude-code |
| 8.6k | `frontend-patterns` | affaan-m/everything-claude-code |
| 8.4k | `golang-testing` | affaan-m/everything-claude-code |
| 8.1k | `story-long-write` | worldwonderer/oh-story-claudecode |
| 8.1k | `story-deslop` | worldwonderer/oh-story-claudecode |
| 8k | `story-long-analyze` | worldwonderer/oh-story-claudecode |
| 8k | `story-short-write` | worldwonderer/oh-story-claudecode |
| 7.9k | `story-long-scan` | worldwonderer/oh-story-claudecode |
| 7.9k | `story-short-analyze` | worldwonderer/oh-story-claudecode |
| 7.9k | `browser-cdp` | worldwonderer/oh-story-claudecode |

---

## All skills by repository

### affaan-m/everything-claude-code
[github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) · 70 skills · 416k installs

- **`security-review`** — 11k installs
  Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive security checklist and patterns.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'security-review'`
- **`golang-patterns`** — 9.9k installs
  Go-specific design patterns and best practices including functional options, small interfaces, dependency injection, concurrency patterns, error handling, and package organization. Use when working with Go code to apply idiomatic Go patterns.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'golang-patterns'`
- **`coding-standards`** — 8.7k installs
  Baseline cross-project coding conventions for naming, readability, immutability, and code-quality review. Use detailed frontend or backend skills for framework-specific patterns.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'coding-standards'`
- **`backend-patterns`** — 8.6k installs
  Backend architecture patterns, API design, database optimization, and server-side best practices for Node.js, Express, and Next.js API routes.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'backend-patterns'`
- **`frontend-patterns`** — 8.6k installs
  Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'frontend-patterns'`
- **`golang-testing`** — 8.4k installs
  Go testing best practices including table-driven tests, test helpers, benchmarking, race detection, coverage analysis, and integration testing patterns. Use when writing or improving Go tests.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'golang-testing'`
- **`springboot-patterns`** — 7.6k installs
  Spring Boot architecture patterns, REST API design, layered services, data access, caching, async processing, and logging. Use for Java Spring Boot backend work.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'springboot-patterns'`
- **`continuous-learning-v2`** — 7.4k installs
  Sistema de aprendizaje basado en instintos que observa sesiones mediante hooks, crea instintos atómicos con puntuación de confianza y los evoluciona en skills/comandos/agentes. v2.1 agrega instintos con alcance de proyecto para prevenir contaminación entre proyectos.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'continuous-learning-v2'`
- **`postgres-patterns`** — 7.1k installs
  PostgreSQL database patterns for query optimization, schema design, indexing, and security. Quick reference for common patterns, index types, data types, and anti-pattern detection. Based on Supabase best practices.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'postgres-patterns'`
- **`django-patterns`** — 7k installs
  Django architecture patterns, REST API design with DRF, ORM best practices, caching, signals, middleware, and production-grade Django apps.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'django-patterns'`
- **`python-patterns`** — 7k installs
  Python-specific design patterns and best practices including protocols, dataclasses, context managers, decorators, async/await, type hints, and package organization. Use when working with Python code to apply Pythonic patterns.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'python-patterns'`
- **`tdd-workflow`** — 6.8k installs
  Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including unit, integration, and E2E tests.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'tdd-workflow'`
- **`docker-patterns`** — 6.7k installs
  Docker and Docker Compose patterns for local development, container security, networking, volume strategies, and multi-service orchestration. Use when setting up containerized development environments or reviewing Docker configurations.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'docker-patterns'`
- **`java-coding-standards`** — 6.6k installs
  Java coding standards for Spring Boot and Quarkus services: naming, immutability, Optional usage, streams, exceptions, generics, CDI, reactive patterns, and project layout. Automatically applies framework-specific conventions.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'java-coding-standards'`
- **`video-editing`** — 6.5k installs
  AI-assisted video editing workflows for cutting, structuring, and augmenting real footage. Covers the full pipeline from raw capture through FFmpeg, Remotion, ElevenLabs, fal.ai, and final polish in Descript or CapCut. Use when the user wants to edit video, cut footage, create vlogs, or build video content.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'video-editing'`
- **`django-security`** — 6.5k installs
  Django security best practices, authentication, authorization, CSRF protection, SQL injection prevention, XSS prevention, and secure deployment configurations.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'django-security'`
- **`springboot-security`** — 6.4k installs
  Spring Security best practices for authn/authz, validation, CSRF, secrets, headers, rate limiting, and dependency security in Java Spring Boot services.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'springboot-security'`
- **`prompt-optimizer`** — 6.3k installs
  日本語翻訳：このファイルは prompt-optimizer 用の日本語翻訳が必要です
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'prompt-optimizer'`
- **`article-writing`** — 6.2k installs
  Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form content in a distinctive voice derived from supplied examples or brand guidance. Use when the user wants polished written content longer than a paragraph, especially when voice consistency, structure, and credibility matter.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'article-writing'`
- **`cpp-coding-standards`** — 6.2k installs
  C++ coding standards based on the C++ Core Guidelines (isocpp.github.io). Use when writing, reviewing, or refactoring C++ code to enforce modern, safe, and idiomatic practices.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'cpp-coding-standards'`
- **`market-research`** — 6.1k installs
  Conduct market research, competitive analysis, investor due diligence, and industry intelligence with source attribution and decision-oriented summaries. Use when the user wants market sizing, competitor comparisons, fund research, technology scans, or research that informs business decisions.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'market-research'`
- **`strategic-compact`** — 6.1k installs
  Suggests manual context compaction at logical intervals to preserve context through task phases rather than arbitrary auto-compaction.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'strategic-compact'`
- **`springboot-tdd`** — 6k installs
  Desarrollo guiado por pruebas para Spring Boot usando JUnit 5, Mockito, MockMvc, Testcontainers y JaCoCo. Usar al agregar funcionalidades, corregir bugs o refactorizar.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'springboot-tdd'`
- **`android-clean-architecture`** — 6k installs
  Android と Kotlin Multiplatform プロジェクトのクリーンアーキテクチャパターン — モジュール構造、依存関係ルール、UseCase、Repository、データ層パターン。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'android-clean-architecture'`
- **`database-migrations`** — 5.9k installs
  Database migration best practices for schema changes, data migrations, rollbacks, and zero-downtime deployments across PostgreSQL, MySQL, and common ORMs (Prisma, Drizzle, Django, TypeORM, golang-migrate). Use when planning or implementing database schema changes.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'database-migrations'`
- **`continuous-learning`** — 5.9k installs
  [OBSOLETO - usar continuous-learning-v2] Extractor de skill por hook Stop v1 heredado. v2 es un superconjunto estricto con aprendizaje basado en instintos, con alcance de proyecto y hooks confiables. No invocar v1; dirigir solicitudes de aprendizaje continuo, aprendizaje de sesión y extracción de patrones a continuous-learning-v2.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'continuous-learning'`
- **`security-scan`** — 5.9k installs
  AgentShield を使用して、Claude Code の設定（.claude/ ディレクトリ）のセキュリティ脆弱性、設定ミス、インジェクションリスクをスキャンします。CLAUDE.md、settings.json、MCP サーバー、フック、エージェント定義をチェックします。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'security-scan'`
- **`e2e-testing`** — 5.9k installs
  Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, artifact management, and flaky test strategies.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'e2e-testing'`
- **`django-tdd`** — 5.9k installs
  Django testing strategies with pytest-django, TDD methodology, factory_boy, mocking, coverage, and testing Django REST Framework APIs.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'django-tdd'`
- **`liquid-glass-design`** — 5.8k installs
  日本語翻訳：このファイルは liquid-glass-design 用の日本語翻訳が必要です
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'liquid-glass-design'`
- **`deployment-patterns`** — 5.8k installs
  Deployment workflows, CI/CD pipeline patterns, Docker containerization, health checks, rollback strategies, and production readiness checklists for web applications. Use when setting up deployment infrastructure or planning releases.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'deployment-patterns'`
- **`jpa-patterns`** — 5.7k installs
  JPA/Hibernate patterns for entity design, relationships, query optimization, transactions, auditing, indexing, pagination, and pooling in Spring Boot.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'jpa-patterns'`
- **`eval-harness`** — 5.7k installs
  Formal evaluation framework for Claude Code sessions implementing eval-driven development (EDD) principles
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'eval-harness'`
- **`laravel-patterns`** — 5.7k installs
  Patrones de arquitectura Laravel, routing/controladores, Eloquent ORM, capas de servicio, colas, eventos, caché y API resources para aplicaciones en producción.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'laravel-patterns'`
- **`laravel-security`** — 5.7k installs
  Buenas prácticas de seguridad en Laravel para autenticación/autorización, validación, CSRF, asignación masiva, subida de archivos, secretos, limitación de velocidad y despliegue seguro.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'laravel-security'`
- **`clickhouse-io`** — 5.7k installs
  ClickHouse database patterns, query optimization, analytics, and data engineering best practices for high-performance analytical workloads.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'clickhouse-io'`
- **`cpp-testing`** — 5.6k installs
  Use only when writing/updating/fixing C++ tests, configuring GoogleTest/CTest, diagnosing failing or flaky tests, or adding coverage/sanitizers.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'cpp-testing'`
- **`iterative-retrieval`** — 5.5k installs
  サブエージェントのコンテキスト問題を解決するために、コンテキスト取得を段階的に洗練するパターン
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'iterative-retrieval'`
- **`configure-ecc`** — 5.5k installs
  Everything Claude Code のインタラクティブなインストーラー — スキルとルールの選択とインストールをユーザーレベルまたはプロジェクトレベルのディレクトリへガイドし、パスを検証し、必要に応じてインストールされたファイルを最適化します。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'configure-ecc'`
- **`verification-loop`** — 5.5k installs
  A comprehensive verification system for Claude Code sessions.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'verification-loop'`
- **`search-first`** — 5.5k installs
  Research-before-coding workflow. Search for existing tools, libraries, and patterns before writing custom code. Systematizes the "search for existing solutions before implementing" approach. Use when starting new features or adding functionality.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'search-first'`
- **`nutrient-document-processing`** — 5.5k installs
  Nutrient DWS API を使用してドキュメントの処理、変換、OCR、抽出、編集、署名、フォーム入力を行います。PDF、DOCX、XLSX、PPTX、HTML、画像に対応しています。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'nutrient-document-processing'`
- **`agent-harness-construction`** — 5.4k installs
  AI エージェントのアクション空間、ツール定義、観測フォーマットを設計・最適化して完了率を向上させます。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'agent-harness-construction'`
- **`django-verification`** — 5.4k installs
  Verification loop for Django projects: migrations, linting, tests with coverage, security scans, and deployment readiness checks before release or PR.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'django-verification'`
- **`springboot-verification`** — 5.4k installs
  Bucle de verificación para proyectos Spring Boot: build, análisis estático, pruebas con cobertura, escaneos de seguridad y revisión de diff antes del lanzamiento o PR.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'springboot-verification'`
- **`cost-aware-llm-pipeline`** — 5.3k installs
  LLM APIの使用量のコスト最適化パターン — タスクの複雑さによるモデルルーティング、予算追跡、リトライロジック、プロンプトキャッシング。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'cost-aware-llm-pipeline'`
- **`agentic-engineering`** — 5.3k installs
  Operate as an agentic engineer using eval-first execution, decomposition, and cost-aware model routing. Use when AI agents perform most implementation work and humans enforce quality and risk controls.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'agentic-engineering'`
- **`codebase-onboarding`** — 5.3k installs
  不慣れなコードベースを分析し、アーキテクチャマップ、主要なエントリポイント、規約、スターターCLAUDE.mdを含む構造化オンボーディングガイドを生成します。新しいプロジェクトに参加するか、リポでClaude Codeを初めてセットアップする場合に使用します。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'codebase-onboarding'`
- **`rust-testing`** — 5.3k installs
  Rust testing patterns including unit tests, integration tests, async testing, property-based testing, mocking, and coverage. Follows TDD methodology.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'rust-testing'`
- **`deep-research`** — 5.2k installs
  Multi-source deep research using firecrawl and exa MCPs. Searches the web, synthesizes findings, and delivers cited reports with source attribution. Use when the user wants thorough research on any topic with evidence and citations.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'deep-research'`
- **`autonomous-loops`** — 5.2k installs
  Patterns and architectures for autonomous Claude Code loops — from simple sequential pipelines to RFC-driven multi-agent DAG systems.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'autonomous-loops'`
- **`kotlin-coroutines-flows`** — 5.2k installs
  Android および KMP 向けの Kotlin コルーチンと Flow パターン — 構造化並行性、Flow オペレーター、StateFlow、エラーハンドリング、テスト。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'kotlin-coroutines-flows'`
- **`content-hash-cache-pattern`** — 5.1k installs
  Cache expensive file processing results using SHA-256 content hashes — path-independent, auto-invalidating, with service layer separation.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'content-hash-cache-pattern'`
- **`ai-first-engineering`** — 5.1k installs
  AI エージェントが大量の実装出力を生成するチームのためのエンジニアリング運用モデル。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'ai-first-engineering'`
- **`swiftui-patterns`** — 5.1k installs
  @Observableを使用した状態管理、ビュー合成、ナビゲーション、パフォーマンス最適化、モダンなiOS/macOS UIのベストプラクティスを備えたSwiftUIアーキテクチャパターン。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'swiftui-patterns'`
- **`regex-vs-llm-structured-text`** — 5.1k installs
  構造化テキストの解析に正規表現と大規模言語モデルのどちらを使うかを選択するための意思決定フレームワーク——まず正規表達式から始め、信頼度の低いエッジケースにのみ大規模言語モデルを追加する。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'regex-vs-llm-structured-text'`
- **`investor-materials`** — 5k installs
  Create and update pitch decks, one-pagers, investor memos, accelerator applications, financial models, and fundraising materials. Use when the user needs investor-facing documents, projections, use-of-funds tables, milestone plans, or materials that must stay internally consistent across multiple fundraising assets.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'investor-materials'`
- **`laravel-tdd`** — 5k installs
  Desarrollo guiado por pruebas para Laravel con PHPUnit y Pest, factories, pruebas de base de datos, fakes y objetivos de cobertura.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'laravel-tdd'`
- **`kotlin-patterns`** — 5k installs
  Idiomatic Kotlin patterns, best practices, and conventions for building robust, efficient, and maintainable Kotlin applications with coroutines, null safety, and DSL builders.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'kotlin-patterns'`
- **`swift-actor-persistence`** — 5k installs
  Thread-safe data persistence in Swift using actors — in-memory cache with file-backed storage, eliminating data races by design.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'swift-actor-persistence'`
- **`swift-protocol-di-testing`** — 5k installs
  Protocol-based dependency injection for testable Swift code — mock file system, network, and external APIs using focused protocols and Swift Testing.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'swift-protocol-di-testing'`
- **`continuous-agent-loop`** — 5k installs
  品質ゲート、評価、リカバリーコントロールを備えた継続的な自律エージェントループのパターン。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'continuous-agent-loop'`
- **`rust-patterns`** — 5k installs
  Idiomatic Rust patterns, ownership, error handling, traits, concurrency, and best practices for building safe, performant applications.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'rust-patterns'`
- **`investor-outreach`** — 5k installs
  Draft cold emails, warm intro blurbs, follow-ups, update emails, and investor communications for fundraising. Use when the user wants outreach to angels, VCs, strategic investors, or accelerators and needs concise, personalized, investor-facing messaging.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'investor-outreach'`
- **`compose-multiplatform-patterns`** — 4.9k installs
  KMPプロジェクト向けのCompose MultiplatformおよびJetpack Composeパターン — 状態管理、ナビゲーション、テーマ設定、パフォーマンス、プラットフォーム固有のUI。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'compose-multiplatform-patterns'`
- **`foundation-models-on-device`** — 4.9k installs
  デバイス上基盤モデルの実装パターン、量子化、最適化、およびプライバシーを考慮した推論。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'foundation-models-on-device'`
- **`everything-claude-code-conventions`** — 4.8k installs
  Conventions collection from the everything-claude-code marketplace: coding standards and conventions applied across Claude Code projects.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'everything-claude-code-conventions'`
- **`claude-devfleet`** — 4.5k installs
  Claude DevFleet経由でマルチエージェントコーディングタスクをオーケストレーション — プロジェクトを計画し、分離された作業ツリー内で平行エージェントを派遣し、進捗を監視し、構造化レポートを読む。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'claude-devfleet'`
- **`code-tour`** — 3.5k installs
  CodeTour `.tour`ファイルを作成 — ペルソナターゲット、ステップバイステップウォークスルー（実際のファイルとラインアンカー付き）。オンボーディングツアー、アーキテクチャウォークスルー、PRツアー、RCAツアー、構造化「これがどのように機能するかを説明」リクエストに使用。
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'code-tour'`
- **`everything-claude-code`** — 2.7k installs
  Development conventions and patterns for everything-claude-code. JavaScript project with conventional commits.
  Install: `npx skills add https://github.com/affaan-m/everything-claude-code --skill 'everything-claude-code'`

### mattpocock/skills
[github.com/mattpocock/skills](https://github.com/mattpocock/skills) · 1 skill · 122k installs

- **`git-guardrails-claude-code`** — 122k installs
  Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execute. Use when user wants to prevent destructive git operations, add git safety hooks, or block git push/reset in Claude Code.
  Install: `npx skills add https://github.com/mattpocock/skills --skill 'git-guardrails-claude-code'`

### worldwonderer/oh-story-claudecode
[github.com/worldwonderer/oh-story-claudecode](https://github.com/worldwonderer/oh-story-claudecode) · 13 skills · 100k installs

- **`story-long-write`** — 8.1k installs
  长篇网文写作。从大纲到正文，辅助长篇网络小说的创作，包括世界观、人物、情节线管理。触发方式：/story-long-write、/写长篇、「帮我开书」「写大纲」「日更」「续写」「继续写」「修改第X章」「回炉」「重写第X章」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-long-write'`
- **`story-deslop`** — 8.1k installs
  网文去AI味。检测并清除文本中的AI写作痕迹，让文字回归自然、非模板化。触发方式：/story-deslop、/去AI味、「去AI味」「这篇太AI了」「网文去AI味」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-deslop'`
- **`story-long-analyze`** — 8k installs
  长篇网文拆文。深度拆解爆款长篇小说的黄金三章、人设架构、爽点设计、节奏控制。单一深度拆解管道：跑完黄金三章（Stage 1）后产出快速预览报告并询问是否继续全量拆解，确认后从 Stage 2 续跑逐章摘要、聚合分析、设定关系、汇总报告，全程产物落盘 拆文库/{书名}/。触发方式：/story-long-analyze、/长篇拆文、「帮我拆这本书」「拆这本书」「分析黄金三章」「深度拆解」「完整拆解」「系统拆解」或提供小说文本文件路径——全部进入同一管道。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-long-analyze'`
- **`story-short-write`** — 8k installs
  短篇网文写作。辅助短篇小说创作，从构思到成稿，聚焦情绪拉扯与节奏把控。触发方式：/story-short-write、/写短篇、「帮我写一篇短篇」「写个盐言故事」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-short-write'`
- **`story-long-scan`** — 7.9k installs
  长篇网文扫榜。分析起点、番茄、晋江等平台排行榜数据，提炼市场趋势与热门题材。触发方式：/story-long-scan、/长篇扫榜、「长篇什么火」「起点排行」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-long-scan'`
- **`story-short-analyze`** — 7.9k installs
  短篇网文拆文。拆解爆款短篇小说（番茄短篇 / 故事会 / 知乎盐选 / 追妻 / 世情 / 重生 / 虐渣等通俗题材）的故事核、结构、情感线、反转设计、写作手法、共鸣层次。单一全量拆解管道：跑完 Stage 2-6 产出完整拆文报告，落盘到 拆文库/{书名}/，下游 story-short-write 同时读拆文报告 + 情节节点 + 写作手法 + 原文 + _meta.json 写下一篇。触发方式：/story-short-analyze、/短篇拆文、「拆短篇」「拆这篇短文」「短篇拆文」「精细拆解短篇」「8000 字短篇拆解」「番茄短篇拆文」「故事会拆解」「盐言故事拆解」「分析这篇短篇」——均进入同一管道。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-short-analyze'`
- **`browser-cdp`** — 7.9k installs
  Use this skill when you need to control a Chrome browser via CDP (Chrome DevTools Protocol) to reuse existing login sessions. Covers: launching Chrome in debug mode, opening URLs, waiting for page load, evaluating JavaScript, taking snapshots, and extracting auth tokens. Trigger phrases: browser automation, CDP, agent-browser, 浏览器操作, 操作浏览器, Chrome CDP, 复用登录态, extract token from browser.
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'browser-cdp'`
- **`story-short-scan`** — 7.9k installs
  短篇网文扫榜。分析知乎盐言、七猫、黑岩、点众等平台热门短篇数据，捕捉风口题材。触发方式：/story-short-scan、/短篇扫榜、「短篇什么火」「知乎故事排行」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-short-scan'`
- **`story-cover`** — 7.6k installs
  小说封面生成。根据书名、作者名自动分析题材风格，调用 GPT-Image-2 直接生成含标题和署名的专业级网文封面。触发方式：/story-cover、/封面、「帮我做个封面」「生成封面图」「做个小说封面」「封面设计」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-cover'`
- **`story`** — 7.2k installs
  网络小说工具箱主入口。根据用户需求自动路由到对应 skill；当用户意图不明确时触发，由路由逻辑分发到具体的扫榜/拆文/写作/去AI味/封面/导入/审查 skill。触发方式：/story、$story、/网文、「我想写小说」「帮我写书」「写网文」「检查更新」「有新版本吗」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story'`
- **`story-setup`** — 7.2k installs
  网文写作工具集基础设施部署。为 Claude Code / OpenCode / Codex / OpenClaw 提供内置适配；Web AI / 通用 Agent 可走 skills + AGENTS.md 文件模式。触发方式：/story-setup、$story-setup、「准备写书」「帮我搭一下环境」「配置写作项目」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-setup'`
- **`story-review`** — 7.2k installs
  多视角对抗式审查。full/lean 模式在已部署 reviewer agents 时并行 spawn；缺失/异常 agents 或 spawn 失败时自动降级 solo，参考文件不可读时使用内置 rubric fallback。触发方式：/story-review、/审查、「审查一下」「帮我审一下」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-review'`
- **`story-import`** — 6.9k installs
  逆向导入已有小说。将已写好的小说（半成品或完本）反向解析为标准项目目录结构，兼容 story-long-write / story-short-write 后续写作流程；内部复用 story-long-analyze / story-short-analyze 的拆解管道，按篇幅自动分流。触发方式：/story-import、「导入小说」「反向解析」「导入」「把我的书导进来」。
  Install: `npx skills add https://github.com/worldwonderer/oh-story-claudecode --skill 'story-import'`

### anthropics/claude-code
[github.com/anthropics/claude-code](https://github.com/anthropics/claude-code) · 6 skills · 70k installs

- **`agent-development`** — 16k installs
  This skill should be used when the user asks to "create an agent", "add an agent", "write a subagent", "agent frontmatter", "when to use description", "agent examples", "agent tools", "agent colors", "autonomous agent", or needs guidance on agent structure, system prompts, triggering conditions, or agent development best practices for Claude Code plugins.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'Agent Development'`
- **`skill-development`** — 15k installs
  This skill should be used when the user wants to "create a skill", "add a skill to plugin", "write a new skill", "improve skill description", "organize skill content", or needs guidance on skill structure, progressive disclosure, or skill development best practices for Claude Code plugins.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'Skill Development'`
- **`plugin-structure`** — 10k installs
  This skill should be used when the user asks to "create a plugin", "scaffold a plugin", "understand plugin structure", "organize plugin components", "set up plugin.json", "use ${CLAUDE_PLUGIN_ROOT}", "add commands/agents/skills/hooks", "configure auto-discovery", or needs guidance on plugin directory layout, manifest configuration, component organization, file naming conventions, or Claude Code plugin architecture best practices.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'Plugin Structure'`
- **`plugin-settings`** — 10k installs
  This skill should be used when the user asks about "plugin settings", "store plugin configuration", "user-configurable plugin", ".local.md files", "plugin state files", "read YAML frontmatter", "per-project plugin settings", or wants to make plugin behavior configurable. Documents the .claude/plugin-name.local.md pattern for storing plugin-specific configuration with YAML frontmatter and markdown content.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'Plugin Settings'`
- **`writing-hookify-rules`** — 10k installs
  Guidance for creating hookify rules: use when the user asks to create/write/configure a hookify rule or needs help with hookify rule syntax and patterns.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'writing hookify rules'`
- **`claude-opus-4-5-migration`** — 8.7k installs
  Migrate prompts and code from Claude Sonnet 4.0, Sonnet 4.5, or Opus 4.1 to Opus 4.5. Use when the user wants to update their codebase, prompts, or API calls to use Opus 4.5. Handles model string updates and prompt adjustments for known Opus 4.5 behavioral differences. Does NOT migrate Haiku 4.5.
  Install: `npx skills add https://github.com/anthropics/claude-code --skill 'claude-opus-4-5-migration'`

### jeffallan/claude-skills
[github.com/jeffallan/claude-skills](https://github.com/jeffallan/claude-skills) · 2 skills · 8.2k installs

- **`code-reviewer`** — 4.4k installs
  Analyzes code diffs and files to identify bugs, security vulnerabilities (SQL injection, XSS, insecure deserialization), code smells, N+1 queries, naming issues, and architectural concerns, then produces a structured review report with prioritized, actionable feedback. Use when reviewing pull requests, conducting code quality audits, identifying refactoring opportunities, or checking for security issues. Invoke for PR reviews, code quality checks, refactoring suggestions, review code, code quality. Complements specialized skills (security-reviewer, test-master) by providing broad-scope review across correctness, performance, maintainability, and test coverage in a single pass.
  Install: `npx skills add https://github.com/jeffallan/claude-skills --skill 'code-reviewer'`
- **`code-documenter`** — 3.8k installs
  Generates, formats, and validates technical documentation — including docstrings, OpenAPI/Swagger specs, JSDoc annotations, doc portals, and user guides. Use when adding docstrings to functions or classes, creating API documentation, building documentation sites, or writing tutorials and user guides. Invoke for OpenAPI/Swagger specs, JSDoc, doc portals, getting started guides.
  Install: `npx skills add https://github.com/jeffallan/claude-skills --skill 'code-documenter'`

### dotneet/claude-code-marketplace
[github.com/dotneet/claude-code-marketplace](https://github.com/dotneet/claude-code-marketplace) · 1 skill · 7.7k installs

- **`typescript-react-reviewer`** — 7.7k installs
  Expert code reviewer for TypeScript + React 19 applications. Use when reviewing React code, identifying anti-patterns, evaluating state management, or assessing code maintainability. Triggers: code review requests, PR reviews, React architecture evaluation, identifying code smells, TypeScript type safety checks, useEffect abuse detection, state management review.
  Install: `npx skills add https://github.com/dotneet/claude-code-marketplace --skill 'typescript-react-reviewer'`

### nodnarbnitram/claude-code-extensions
[github.com/nodnarbnitram/claude-code-extensions](https://github.com/nodnarbnitram/claude-code-extensions) · 1 skill · 5.8k installs

- **`tauri-v2`** — 5.8k installs
  Tauri v2+ cross-platform app development with Rust backend. Use when configuring tauri.conf.json, implementing Rust commands (#[tauri::command]), setting up IPC patterns (invoke, emit, channels), configuring permissions/capabilities, troubleshooting build issues, or deploying desktop/mobile apps. Triggers on Tauri, src-tauri, invoke, emit, capabilities.json.
  Install: `npx skills add https://github.com/nodnarbnitram/claude-code-extensions --skill 'tauri-v2'`

### digitalsamba/claude-code-video-toolkit
[github.com/digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) · 1 skill · 5k installs

- **`ffmpeg`** — 5k installs
  Video and audio processing with FFmpeg. Use for format conversion, resizing, compression, audio extraction, and preparing assets for Remotion. Triggers include converting GIF to MP4, resizing video, extracting audio, compressing files, or any media transformation task.
  Install: `npx skills add https://github.com/digitalsamba/claude-code-video-toolkit --skill 'ffmpeg'`

### stanleychanh/tushare-finance-skill-for-claude-code
[github.com/stanleychanh/tushare-finance-skill-for-claude-code](https://github.com/stanleychanh/tushare-finance-skill-for-claude-code) · 1 skill · 5k installs

- **`tushare-finance`** — 5k installs
  Fetch Chinese financial-market data (A-shares, HK, US stocks, funds, futures, bonds) via 220+ Tushare Pro endpoints: quotes, financial statements, macro indicators (GDP/CPI).
  Install: `npx skills add https://github.com/stanleychanh/tushare-finance-skill-for-claude-code --skill 'tushare-finance'`

### thedotmack/claude-mem
[github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) · 1 skill · 3.8k installs

- **`claude-code-plugin-release`** — 3.8k installs
  Release automation for a Claude Code plugin (claude-mem): versioning and publishing a plugin release.
  Install: `npx skills add https://github.com/thedotmack/claude-mem --skill 'claude-code-plugin-release'`

### vercel/vercel-deploy-claude-code-plugin
[github.com/vercel/vercel-deploy-claude-code-plugin](https://github.com/vercel/vercel-deploy-claude-code-plugin) · 3 skills · 257 installs

- **`deploy`** — 101 installs
  Deploy applications to Vercel. Use when the user says "deploy", "deploy to Vercel", "push to production", "deploy my app", or "go live".
  Install: `npx skills add https://github.com/vercel/vercel-deploy-claude-code-plugin --skill 'deploy'`
- **`logs`** — 95 installs
  View Vercel deployment logs. Use when the user says "show logs", "check logs", "vercel logs", or "what went wrong with the deployment".
  Install: `npx skills add https://github.com/vercel/vercel-deploy-claude-code-plugin --skill 'logs'`
- **`setup`** — 61 installs
  Set up Vercel CLI and project configuration. Use when the user says "set up Vercel", "configure Vercel", "link to Vercel", or "vercel init".
  Install: `npx skills add https://github.com/vercel/vercel-deploy-claude-code-plugin --skill 'setup'`

---

_Descriptions pulled from each skill's SKILL.md frontmatter on GitHub. Install counts and ranking reflect skills.sh at scrape time._


---

# Missing skills — trustworthy official sources

Added 255 skills not present in the skills.sh top-100 above, enumerated directly from Anthropic's own GitHub repositories (highest trust, low risk — vetted by Anthropic). Descriptions are from each skill's `SKILL.md` frontmatter.

Repos scraped:
- [github.com/anthropics/skills](https://github.com/anthropics/skills)
- [github.com/anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)

Reference for discovery (community-curated — vet each entry before installing, since a skill can run commands in your environment):
[hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) ·
[ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) ·
[travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) ·
[karanb192/awesome-claude-skills](https://github.com/karanb192/awesome-claude-skills)

## anthropics/skills
Core reusable Agent Skills: document creation, design, artifacts, API help. · 18 skills
- **`algorithmic-art`** — Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original…
  `npx skills add https://github.com/anthropics/skills --skill 'algorithmic-art'`
- **`brand-guidelines`** — Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.
  `npx skills add https://github.com/anthropics/skills --skill 'brand-guidelines'`
- **`canvas-design`** — Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying…
  `npx skills add https://github.com/anthropics/skills --skill 'canvas-design'`
- **`claude-api`** — Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration. TRIGGER — read BEFORE opening the target file; don't skip because it "looks like a…
  `npx skills add https://github.com/anthropics/skills --skill 'claude-api'`
- **`doc-coauthoring`** — Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content. This workflow helps users efficiently…
  `npx skills add https://github.com/anthropics/skills --skill 'doc-coauthoring'`
- **`docx`** — Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', or requests to produce professional documents with…
  `npx skills add https://github.com/anthropics/skills --skill 'docx'`
- **`frontend-design`** — Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
  `npx skills add https://github.com/anthropics/skills --skill 'frontend-design'`
- **`internal-comms`** — A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports…
  `npx skills add https://github.com/anthropics/skills --skill 'internal-comms'`
- **`mcp-builder`** — Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in…
  `npx skills add https://github.com/anthropics/skills --skill 'mcp-builder'`
- **`pdf`** — Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks…
  `npx skills add https://github.com/anthropics/skills --skill 'pdf'`
- **`pptx`** — Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file (even if the extracted…
  `npx skills add https://github.com/anthropics/skills --skill 'pptx'`
- **`skill-creator`** — Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with…
  `npx skills add https://github.com/anthropics/skills --skill 'skill-creator'`
- **`slack-gif-creator`** — Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack.
  `npx skills add https://github.com/anthropics/skills --skill 'slack-gif-creator'`
- **`template`** — Replace with description of the skill and when Claude should use it.
  `npx skills add https://github.com/anthropics/skills --skill 'template-skill'`
- **`theme-factory`** — Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can…
  `npx skills add https://github.com/anthropics/skills --skill 'theme-factory'`
- **`web-artifacts-builder`** — Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui…
  `npx skills add https://github.com/anthropics/skills --skill 'web-artifacts-builder'`
- **`webapp-testing`** — Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
  `npx skills add https://github.com/anthropics/skills --skill 'webapp-testing'`
- **`xlsx`** — Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file (e.g., adding columns, computing formulas…
  `npx skills add https://github.com/anthropics/skills --skill 'xlsx'`

## anthropics/claude-plugins-official
Official plugin marketplace — dev tooling, skill/plugin authoring, integrations. · 25 skills

### claude-code-setup
- **`claude-automation-recommender`** — Analyze a codebase and recommend Claude Code automations (hooks, subagents, skills, plugins, MCP servers). Use when user asks for automation recommendations, wants to optimize their Claude Code setup, mentions improving Claude Code…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'claude-automation-recommender'`

### claude-md-management
- **`claude-md-improver`** — Audit and improve CLAUDE.md files in repositories. Use when user asks to check, audit, update, improve, or fix CLAUDE.md files. Scans for all CLAUDE.md files, evaluates quality against templates, outputs quality report, then makes…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'claude-md-improver'`

### cwc-makers
- **`cardputer-buddy`** — Iterate on the Cardputer-Adv MicroPython app bundle (Claude Buddy, Snake, Hello) after the device is already provisioned via m5-onboard. Use when the user wants to add a new app, push a single changed .py without re-flashing, watch…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'cardputer-buddy'`
- **`m5-onboard`** — End-to-end onboarding for a freshly-plugged-in M5Stack ESP32 device (Cardputer, Cardputer-Adv, Core, CoreS3, Stick) — detect on USB, flash UIFlow 2.0 firmware, and install the Claude Buddy MicroPython app bundle. Use whenever the user…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'm5-onboard'`

### discord
- **`access`** — Manage Discord channel access — approve pairings, edit allowlists, set DM/group policy. Use when the user asks to pair, approve someone, check who's allowed, or change policy for the Discord channel.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'access'`
- **`configure`** — Set up the Discord channel — save the bot token and review access policy. Use when the user pastes a Discord bot token, asks to configure Discord, asks "how do I set this up" or "who can reach me," or wants to check channel status.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'configure'`

### example-plugin
- **`example-command`** — An example user-invoked skill that demonstrates frontmatter options and the skills/<name>/SKILL.md layout
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'example-command'`
- **`example-skill`** — This skill should be used when the user asks to "demonstrate skills", "show skill format", "create a skill template", or discusses skill development patterns. Provides a reference template for creating Claude Code plugin skills.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'example-skill'`

### frontend-design
- **`frontend-design`** — Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'frontend-design'`

### hookify
- **`writing-rules`** — This skill should be used when the user asks to "create a hookify rule", "write a hook rule", "configure hookify", "add a hookify rule", or needs guidance on hookify rule syntax and patterns.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'writing-hookify-rules'`

### imessage
- **`access`** — Manage iMessage channel access — approve pairings, edit allowlists, set DM/group policy. Use when the user asks to pair, approve someone, check who's allowed, or change policy for the iMessage channel.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'access'`
- **`configure`** — Check iMessage channel setup and review access policy. Use when the user asks to configure iMessage, asks "how do I set this up" or "who can reach me," or wants to know why texts aren't reaching the assistant.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'configure'`

### math-olympiad
- **`math-olympiad`** — Solve competition math problems (IMO, Putnam, USAMO, AIME) with adversarial verification that catches errors self-verification misses. Uses pure reasoning, then a fresh-context verifier attacks the proof for specific failure patterns.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'math-olympiad'`

### mcp-server-dev
- **`build-mcp-app`** — This skill should be used when the user wants to build an "MCP app", add "interactive UI" or "widgets" to an MCP server, "render components in chat", build "MCP UI resources", make a tool that shows a "form", "picker", "dashboard" or…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'build-mcp-app'`
- **`build-mcp-server`** — This skill should be used when the user asks to "build an MCP server", "create an MCP", "make an MCP integration", "wrap an API for Claude", "expose tools to Claude", "make an MCP app", or discusses building something with the Model…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'build-mcp-server'`
- **`build-mcpb`** — This skill should be used when the user wants to "package an MCP server", "bundle an MCP", "make an MCPB", "ship a local MCP server", "distribute a local MCP", discusses ".mcpb files", mentions bundling a Node or Python runtime with…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'build-mcpb'`

### playground
- **`playground`** — Creates interactive HTML playgrounds — self-contained single-file explorers that let users configure something visually through controls, see a live preview, and copy out a prompt. Use when the user asks to make a playground, explorer…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'playground'`

### plugin-dev
- **`command-development`** — This skill should be used when the user asks to "create a slash command", "add a command", "write a custom command", "define command arguments", "use command frontmatter", "organize commands", "create command with file references"…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'command-development'`
- **`hook-development`** — This skill should be used when the user asks to "create a hook", "add a PreToolUse/PostToolUse/Stop hook", "validate tool use", "implement prompt-based hooks", "use ${CLAUDE_PLUGIN_ROOT}", "set up event-driven automation", "block…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'hook-development'`
- **`mcp-integration`** — This skill should be used when the user asks to "add MCP server", "integrate MCP", "configure MCP in plugin", "use .mcp.json", "set up Model Context Protocol", "connect external service", mentions "${CLAUDE_PLUGIN_ROOT} with MCP", or…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'mcp-integration'`

### project-artifact
- **`project-artifact`** — Generate and publish a project status artifact — an opinionated, tabbed status page for a project too big for one update (overview & success criteria, the workstream sequence, next steps, plus background, plan, risks & open questions…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'project-artifact'`

### session-report
- **`session-report`** — Generate an explorable HTML report of Claude Code session usage (tokens, cache, subagents, skills, expensive prompts) from ~/.claude/projects transcripts.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'session-report'`

### skill-creator
- **`skill-creator`** — Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with…
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'skill-creator'`

### telegram
- **`access`** — Manage Telegram channel access — approve pairings, edit allowlists, set DM/group policy. Use when the user asks to pair, approve someone, check who's allowed, or change policy for the Telegram channel.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'access'`
- **`configure`** — Set up the Telegram channel — save the bot token and review access policy. Use when the user pastes a Telegram bot token, asks to configure Telegram, asks "how do I set this up" or "who can reach me," or wants to check channel status.
  `npx skills add https://github.com/anthropics/claude-plugins-official --skill 'configure'`

## anthropics/knowledge-work-plugins
Open-source knowledge-worker plugins grouped by business function. · 212 skills

### apollo
- **`enrich-lead`** — Instant lead enrichment. Drop a name, company, LinkedIn URL, or email and get the full contact card with email, phone, title, company intel, and next actions.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'enrich-lead'`
- **`prospect`** — Full ICP-to-leads pipeline. Describe your ideal customer in plain English and get a ranked table of enriched decision-maker leads with emails and phone numbers.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'prospect'`
- **`sequence-load`** — Find leads matching criteria and bulk-add them to an Apollo outreach sequence. Handles enrichment, contact creation, deduplication, and enrollment in one flow.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'sequence-load'`

### bio-research
- **`instrument-data-to-allotrope`** — Convert laboratory instrument output files (PDF, CSV, Excel, TXT) to Allotrope Simple Model (ASM) JSON format or flattened 2D CSV. Use this skill when scientists need to standardize instrument data for LIMS systems, data lakes, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'instrument-data-to-allotrope'`
- **`nextflow-development`** — Run nf-core bioinformatics pipelines (rnaseq, sarek, atacseq) on sequencing data. Use when analyzing RNA-seq, WGS/WES, or ATAC-seq data—either local FASTQs or public datasets from GEO/SRA. Triggers on nf-core, Nextflow, FASTQ analysis…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'nextflow-development'`
- **`scientific-problem-selection`** — This skill should be used when scientists need help with research problem selection, project ideation, troubleshooting stuck projects, or strategic scientific decisions. Use this skill when users ask to pitch a new research idea, work…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'scientific-problem-selection'`
- **`scvi-tools`** — Deep learning for single-cell analysis using scvi-tools. This skill should be used when users need (1) data integration and batch correction with scVI/scANVI, (2) ATAC-seq analysis with PeakVI, (3) CITE-seq multi-modal analysis with…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'scvi-tools'`
- **`single-cell-rna-qc`** — Performs quality control on single-cell RNA-seq data (.h5ad or .h5 files) using scverse best practices with MAD-based filtering and comprehensive visualizations. Use when users request QC analysis, filtering low-quality cells, assessing…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'single-cell-rna-qc'`
- **`start`** — Set up your bio-research environment and explore available tools. Use when first getting oriented with the plugin, checking which literature, drug-discovery, or visualization MCP servers are connected, or surveying available analysis…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'start'`

### brand-voice
- **`brand-voice-enforcement`** — This skill applies brand guidelines to content creation. It should be used when the user asks to "write an email", "draft a proposal", "create a pitch deck", "write a LinkedIn post", "draft a presentation", "write a Slack message"…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'brand-voice-enforcement'`
- **`discover-brand`** — This skill orchestrates autonomous discovery of brand materials across enterprise platforms (Notion, Confluence, Google Drive, Box, SharePoint, Figma, Gong, Granola, Slack). It should be used when the user asks to "discover brand…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'discover-brand'`
- **`guideline-generation`** — This skill generates, creates, or builds brand voice guidelines from source materials. It should be used when the user asks to "generate brand guidelines", "create a style guide", "extract brand voice", "create guidelines from calls"…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'guideline-generation'`

### common-room
- **`account-research`** — Research a company using Common Room data. Triggers on 'research [company]', 'tell me about [domain]', 'pull up signals for [account]', 'what's going on with [company]', or any account-level question.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'account-research'`
- **`call-prep`** — Prepare for a customer or prospect call using Common Room signals. Triggers on 'prep me for my call with [company]', 'prepare for a meeting with [company]', 'what should I know before talking to [company]', or any call preparation request.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'call-prep'`
- **`compose-outreach`** — Generate personalized outreach messages using Common Room signals. Triggers on 'draft outreach to [person]', 'write an email to [name]', 'compose a message for [contact]', or any outreach drafting request.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'compose-outreach'`
- **`contact-research`** — Research a specific person using Common Room data. Triggers on 'who is [name]', 'look up [email]', 'research [contact]', 'is [name] a warm lead', or any contact-level question.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'contact-research'`
- **`prospect`** — Build targeted account or contact lists using Common Room's Prospector. Triggers on 'find companies that match [criteria]', 'build a prospect list', 'find contacts at [type of company]', 'show me companies hiring [role]', or any…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'prospect'`
- **`weekly-prep-brief`** — Generate a comprehensive weekly briefing for all external calls in the next 7 days. Triggers on 'weekly prep brief', 'prepare my week', 'what calls do I have this week', 'Monday prep', or any weekly planning request.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'weekly-prep-brief'`

### cowork-plugin-management
- **`cowork-plugin-customizer`** — Customize a Claude Code plugin for a specific organization's tools and workflows. Use when: customize plugin, set up plugin, configure plugin, tailor plugin, adjust plugin settings, customize plugin connectors, customize plugin skill…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'cowork-plugin-customizer'`
- **`create-cowork-plugin`** — Guide users through creating a new plugin from scratch in a cowork session. Use when users want to create a plugin, build a plugin, make a new plugin, develop a plugin, scaffold a plugin, start a plugin from scratch, or design a plugin.…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'create-cowork-plugin'`

### customer-support
- **`customer-escalation`** — Package an escalation for engineering, product, or leadership with full context. Use when a bug needs engineering attention beyond normal support, multiple customers report the same issue, a customer is threatening to churn, or an issue…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'customer-escalation'`
- **`customer-research`** — Multi-source research on a customer question or topic with source attribution. Use when a customer asks something you need to look up, investigating whether a bug has been reported before, checking what was previously told to a specific…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'customer-research'`
- **`draft-response`** — Draft a professional customer-facing response tailored to the situation and relationship. Use when answering a product question, responding to an escalation or outage, delivering bad news like a delay or won't-fix, declining a feature…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'draft-response'`
- **`kb-article`** — Draft a knowledge base article from a resolved issue or common question. Use when a ticket resolution is worth documenting for self-service, the same question keeps coming up, a workaround needs to be published, or a known issue should…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'kb-article'`
- **`ticket-triage`** — Triage and prioritize a support ticket or customer issue. Use when a new ticket comes in and needs categorization, assigning P1-P4 priority, deciding which team should handle it, or checking whether it's a duplicate or known issue…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'ticket-triage'`

### data
- **`analyze`** — Answer data questions -- from quick lookups to full analyses. Use when looking up a single metric, investigating what's driving a trend or drop, comparing segments over time, or preparing a formal data report for stakeholders.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'analyze'`
- **`build-dashboard`** — Build an interactive HTML dashboard with charts, filters, and tables. Use when creating an executive overview with KPI cards, turning query results into a shareable self-contained report, building a team monitoring snapshot, or needing…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-dashboard'`
- **`create-viz`** — Create publication-quality visualizations with Python. Use when turning query results or a DataFrame into a chart, selecting the right chart type for a trend or comparison, generating a plot for a report or presentation, or needing an…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'create-viz'`
- **`data-context-extractor`** — Generate or improve a company-specific data analysis skill by extracting tribal knowledge from analysts. BOOTSTRAP MODE - Triggers: "Create a data context skill", "Set up data analysis for our warehouse", "Help me create a skill for our…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'data-context-extractor'`
- **`data-visualization`** — Create effective data visualizations with Python (matplotlib, seaborn, plotly). Use when building charts, choosing the right chart type for a dataset, creating publication-quality figures, or applying design principles like…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'data-visualization'`
- **`explore-data`** — Profile and explore a dataset to understand its shape, quality, and patterns. Use when encountering a new table or file, checking null rates and column distributions, spotting data quality issues like duplicates or suspicious values, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'explore-data'`
- **`sql-queries`** — Write correct, performant SQL across all major data warehouse dialects (Snowflake, BigQuery, Databricks, PostgreSQL, etc.). Use when writing queries, optimizing slow SQL, translating between dialects, or building complex analytical…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'sql-queries'`
- **`statistical-analysis`** — Apply statistical methods including descriptive stats, trend analysis, outlier detection, and hypothesis testing. Use when analyzing distributions, testing for significance, detecting anomalies, computing correlations, or interpreting…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'statistical-analysis'`
- **`validate-data`** — QA an analysis before sharing -- methodology, accuracy, and bias checks. Use when reviewing an analysis before a stakeholder presentation, spot-checking calculations and aggregation logic, verifying a SQL query's results look right, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'validate-data'`
- **`write-query`** — Write optimized SQL for your dialect with best practices. Use when translating a natural-language data need into SQL, building a multi-CTE query with joins and aggregations, optimizing a query against a large partitioned table, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'write-query'`

### design
- **`accessibility-review`** — Run a WCAG 2.1 AA accessibility audit on a design or page. Trigger with "audit accessibility", "check a11y", "is this accessible?", or when reviewing a design for color contrast, keyboard navigation, touch target size, or screen reader…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'accessibility-review'`
- **`design-critique`** — Get structured design feedback on usability, hierarchy, and consistency. Trigger with "review this design", "critique this mockup", "what do you think of this screen?", or when sharing a Figma link or screenshot for feedback at any…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'design-critique'`
- **`design-handoff`** — Generate developer handoff specs from a design. Use when a design is ready for engineering and needs a spec sheet covering layout, design tokens, component props, interaction states, responsive breakpoints, edge cases, and animation…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'design-handoff'`
- **`design-system`** — Audit, document, or extend your design system. Use when checking for naming inconsistencies or hardcoded values across components, writing documentation for a component's variants, states, and accessibility notes, or designing a new…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'design-system'`
- **`research-synthesis`** — Synthesize user research into themes, insights, and recommendations. Use when you have interview transcripts, survey results, usability test notes, support tickets, or NPS responses that need to be distilled into patterns, user…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'research-synthesis'`
- **`user-research`** — Plan, conduct, and synthesize user research. Trigger with "user research plan", "interview guide", "usability test", "survey design", "research questions", or when the user needs help with any aspect of understanding their users through…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'user-research'`
- **`ux-copy`** — Write or review UX copy — microcopy, error messages, empty states, CTAs. Trigger with "write copy for", "what should this button say?", "review this error message", or when naming a CTA, wording a confirmation dialog, filling an empty…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'ux-copy'`

### engineering
- **`architecture`** — Create or evaluate an architecture decision record (ADR). Use when choosing between technologies (e.g., Kafka vs SQS), documenting a design decision with trade-offs and consequences, reviewing a system design proposal, or designing a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'architecture'`
- **`code-review`** — Review code changes for security, performance, and correctness. Trigger with a PR URL or diff, "review this before I merge", "is this code safe?", or when checking a change for N+1 queries, injection risks, missing edge cases, or error…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'code-review'`
- **`debug`** — Structured debugging session — reproduce, isolate, diagnose, and fix. Trigger with an error message or stack trace, "this works in staging but not prod", "something broke after the deploy", or when behavior diverges from expected and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'debug'`
- **`deploy-checklist`** — Pre-deployment verification checklist. Use when about to ship a release, deploying a change with database migrations or feature flags, verifying CI status and approvals before going to production, or documenting rollback triggers ahead…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'deploy-checklist'`
- **`documentation`** — Write and maintain technical documentation. Trigger with "write docs for", "document this", "create a README", "write a runbook", "onboarding guide", or when the user needs help with any form of technical writing — API docs…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'documentation'`
- **`incident-response`** — Run an incident response workflow — triage, communicate, and write postmortem. Trigger with "we have an incident", "production is down", an alert that needs severity assessment, a status update mid-incident, or when writing a blameless…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'incident-response'`
- **`standup`** — Generate a standup update from recent activity. Use when preparing for daily standup, summarizing yesterday's commits and PRs and ticket moves, formatting work into yesterday/today/blockers, or structuring a few rough notes into a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'standup'`
- **`system-design`** — Design systems, services, and architectures. Trigger with "design a system for", "how should we architect", "system design for", "what's the right architecture for", or when the user needs help with API design, data modeling, or service…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'system-design'`
- **`tech-debt`** — Identify, categorize, and prioritize technical debt. Trigger with "tech debt", "technical debt audit", "what should we refactor", "code health", or when the user asks about code quality, refactoring priorities, or maintenance backlog.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'tech-debt'`
- **`testing-strategy`** — Design test strategies and test plans. Trigger with "how should we test", "test strategy for", "write tests for", "test plan", "what tests do we need", or when the user needs help with testing approaches, coverage, or test architecture.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'testing-strategy'`

### enterprise-search
- **`digest`** — Generate a daily or weekly digest of activity across all connected sources. Use when catching up after time away, starting the day and wanting a summary of mentions and action items, or reviewing a week's decisions and document updates…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'digest'`
- **`knowledge-synthesis`** — Combines search results from multiple sources into coherent, deduplicated answers with source attribution. Handles confidence scoring based on freshness and authority, and summarizes large result sets effectively.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'knowledge-synthesis'`
- **`search`** — Search across all connected sources in one query. Trigger with "find that doc about...", "what did we decide on...", "where was the conversation about...", or when looking for a decision, document, or discussion that could live in chat…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'search'`
- **`search-strategy`** — Query decomposition and multi-source search orchestration. Breaks natural language questions into targeted searches per source, translates queries into source-specific syntax, ranks results by relevance, and handles ambiguity and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'search-strategy'`
- **`source-management`** — Manages connected MCP sources for enterprise search. Detects available sources, guides users to connect new ones, handles source priority ordering, and manages rate limiting awareness.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'source-management'`

### finance
- **`audit-support`** — Support SOX 404 compliance with control testing methodology, sample selection, and documentation standards. Use when generating testing workpapers, selecting audit samples, classifying control deficiencies, or preparing for internal or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'audit-support'`
- **`close-management`** — Manage the month-end close process with task sequencing, dependencies, and status tracking. Use when planning the close calendar, tracking close progress, identifying blockers, or sequencing close activities by day.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'close-management'`
- **`financial-statements`** — Generate financial statements (income statement, balance sheet, cash flow) with period-over-period comparison and variance analysis. Use when preparing a monthly or quarterly P&L, closing the books and need to flag material variances…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'financial-statements'`
- **`journal-entry`** — Prepare journal entries with proper debits, credits, and supporting detail. Use when booking month-end accruals (AP, payroll, prepaid), recording depreciation or amortization, posting revenue recognition or deferred revenue adjustments…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'journal-entry'`
- **`journal-entry-prep`** — Prepare journal entries with proper debits, credits, and supporting documentation for month-end close. Use when booking accruals, prepaid amortization, fixed asset depreciation, payroll entries, revenue recognition, or any manual…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'journal-entry-prep'`
- **`reconciliation`** — Reconcile accounts by comparing GL balances to subledgers, bank statements, or third-party data. Use when performing bank reconciliations, GL-to-subledger recs, intercompany reconciliations, or identifying and categorizing reconciling…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'reconciliation'`
- **`sox-testing`** — Generate SOX sample selections, testing workpapers, and control assessments. Use when planning quarterly or annual SOX 404 testing, pulling a sample for a control (revenue, P2P, ITGC, close), building a testing workpaper template, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'sox-testing'`
- **`variance-analysis`** — Decompose financial variances into drivers with narrative explanations and waterfall analysis. Use when analyzing budget vs. actual, period-over-period changes, revenue or expense variances, or preparing variance commentary for leadership.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'variance-analysis'`

### human-resources
- **`comp-analysis`** — Analyze compensation — benchmarking, band placement, and equity modeling. Trigger with "what should we pay a [role]", "is this offer competitive", "model this equity grant", or when uploading comp data to find outliers and retention risks.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'comp-analysis'`
- **`draft-offer`** — Draft an offer letter with comp details and terms. Use when a candidate is ready for an offer, assembling a total comp package (base, equity, signing bonus), writing the offer letter text itself, or prepping negotiation guidance for the…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'draft-offer'`
- **`interview-prep`** — Create structured interview plans with competency-based questions and scorecards. Trigger with "interview plan for", "interview questions for", "how should we interview", "scorecard for", or when the user is preparing to interview…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'interview-prep'`
- **`onboarding`** — Generate an onboarding checklist and first-week plan for a new hire. Use when someone has a start date coming up, building the pre-start task list (accounts, equipment, buddy), scheduling Day 1 and Week 1, or setting 30/60/90-day goals…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'onboarding'`
- **`org-planning`** — Headcount planning, org design, and team structure optimization. Trigger with "org planning", "headcount plan", "team structure", "reorg", "who should we hire next", or when the user is thinking about team size, reporting structure, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'org-planning'`
- **`people-report`** — Generate headcount, attrition, diversity, or org health reports. Use when pulling a headcount snapshot for leadership, analyzing turnover trends by team, preparing diversity representation metrics, or assessing span of control and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'people-report'`
- **`performance-review`** — Structure a performance review with self-assessment, manager template, and calibration prep. Use when review season kicks off and you need a self-assessment template, writing a manager review for a direct report, prepping rating…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'performance-review'`
- **`policy-lookup`** — Find and explain company policies in plain language. Trigger with "what's our PTO policy", "can I work remotely from another country", "how do expenses work", or any plain-language question about benefits, travel, leave, or handbook rules.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'policy-lookup'`
- **`recruiting-pipeline`** — Track and manage recruiting pipeline stages. Trigger with "recruiting update", "candidate pipeline", "how many candidates", "hiring status", or when the user discusses sourcing, screening, interviewing, or extending offers.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'recruiting-pipeline'`

### legal
- **`brief`** — Generate contextual briefings for legal work — daily summary, topic research, or incident response. Use when starting your day and need a scan of legal-relevant items across email, calendar, and contracts, when researching a specific…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'brief'`
- **`compliance-check`** — Run a compliance check on a proposed action, product feature, or business initiative, surfacing applicable regulations, required approvals, and risk areas. Use when launching a feature that touches personal data, when marketing or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'compliance-check'`
- **`legal-response`** — Generate a response to a common legal inquiry using configured templates, with built-in escalation checks for situations that shouldn't use a templated reply. Use when responding to data subject requests, litigation hold notices, vendor…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'legal-response'`
- **`legal-risk-assessment`** — Assess and classify legal risks using a severity-by-likelihood framework with escalation criteria. Use when evaluating contract risk, assessing deal exposure, classifying issues by severity, or determining whether a matter needs senior…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'legal-risk-assessment'`
- **`meeting-briefing`** — Prepare structured briefings for meetings with legal relevance and track resulting action items. Use when preparing for contract negotiations, board meetings, compliance reviews, or any meeting where legal context, background research…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'meeting-briefing'`
- **`review-contract`** — Review a contract against your organization's negotiation playbook — flag deviations, generate redlines, provide business impact analysis. Use when reviewing vendor or customer agreements, when you need clause-by-clause analysis against…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'review-contract'`
- **`signature-request`** — Prepare and route a document for e-signature — run a pre-signature checklist, configure signing order, and send for execution. Use when a contract is finalized and ready to sign, when verifying entity names, exhibits, and signature…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'signature-request'`
- **`triage-nda`** — Rapidly triage an incoming NDA and classify it as GREEN (standard approval), YELLOW (counsel review), or RED (full legal review). Use when a new NDA arrives from sales or business development, when screening for embedded non-solicits…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'triage-nda'`
- **`vendor-check`** — Check the status of existing agreements with a vendor across all connected systems — CLM, CRM, email, and document storage — with gap analysis and upcoming deadlines. Use when onboarding or renewing a vendor, when you need a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'vendor-check'`

### marketing
- **`brand-review`** — Review content against your brand voice, style guide, and messaging pillars, flagging deviations by severity with specific before/after fixes. Use when checking a draft before it ships, when auditing copy for voice consistency and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'brand-review'`
- **`campaign-plan`** — Generate a full campaign brief with objectives, audience, messaging, channel strategy, content calendar, and success metrics. Use when planning a product launch, lead-gen push, or awareness campaign, when you need a week-by-week content…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'campaign-plan'`
- **`competitive-brief`** — Research competitors and generate a positioning and messaging comparison with content gaps, opportunities, and threats. Use when building sales battlecards, when finding positioning gaps and messaging angles competitors haven't claimed…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'competitive-brief'`
- **`content-creation`** — Draft marketing content across channels — blog posts, social media, email newsletters, landing pages, press releases, and case studies. Use when writing any marketing content, when you need channel-specific formatting, SEO-optimized…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'content-creation'`
- **`draft-content`** — Draft blog posts, social media, email newsletters, landing pages, press releases, and case studies with channel-specific formatting and SEO recommendations. Use when writing any marketing content, when you need headline or subject line…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'draft-content'`
- **`email-sequence`** — Design and draft multi-email sequences with full copy, timing, branching logic, exit conditions, and performance benchmarks. Use when building onboarding, lead nurture, re-engagement, win-back, or product launch flows, when you need a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'email-sequence'`
- **`performance-report`** — Build a marketing performance report with key metrics, trend analysis, wins and misses, and prioritized optimization recommendations. Use when wrapping a campaign, when preparing weekly, monthly, or quarterly channel summaries for…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'performance-report'`
- **`seo-audit`** — Run a comprehensive SEO audit — keyword research, on-page analysis, content gaps, technical checks, and competitor comparison. Use when assessing a site's SEO health, when finding keyword opportunities and content gaps competitors own…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'seo-audit'`

### operations
- **`capacity-plan`** — Plan resource capacity — workload analysis and utilization forecasting. Use when heading into quarterly planning, the team feels overallocated and you need the numbers, deciding whether to hire or deprioritize, or stress-testing whether…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'capacity-plan'`
- **`change-request`** — Create a change management request with impact analysis and rollback plan. Use when proposing a system or process change that needs approval, preparing a change record for CAB review, documenting risk and rollback steps before a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'change-request'`
- **`compliance-tracking`** — Track compliance requirements and audit readiness. Trigger with "compliance", "audit prep", "SOC 2", "ISO 27001", "GDPR", "regulatory requirement", or when the user needs help tracking, preparing for, or documenting compliance activities.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'compliance-tracking'`
- **`process-doc`** — Document a business process — flowcharts, RACI, and SOPs. Use when formalizing a process that lives in someone's head, building a RACI to clarify who owns what, writing an SOP for a handoff or audit, or capturing the exceptions and edge…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'process-doc'`
- **`process-optimization`** — Analyze and improve business processes. Trigger with "this process is slow", "how can we improve", "streamline this workflow", "too many steps", "bottleneck", or when the user describes an inefficient process they want to fix.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'process-optimization'`
- **`risk-assessment`** — Identify, assess, and mitigate operational risks. Trigger with "what are the risks", "risk assessment", "risk register", "what could go wrong", or when the user is evaluating risks associated with a project, vendor, process, or decision.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'risk-assessment'`
- **`runbook`** — Create or update an operational runbook for a recurring task or procedure. Use when documenting a task that on-call or ops needs to run repeatably, turning tribal knowledge into exact step-by-step commands, adding troubleshooting and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'runbook'`
- **`status-report`** — Generate a status report with KPIs, risks, and action items. Use when writing a weekly or monthly update for leadership, summarizing project health with green/yellow/red status, surfacing risks and decisions that need stakeholder…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'status-report'`
- **`vendor-review`** — Evaluate a vendor — cost analysis, risk assessment, and recommendation. Use when reviewing a new vendor proposal, deciding whether to renew or replace a contract, comparing two vendors side-by-side, or building a TCO breakdown and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'vendor-review'`

### pdf-viewer
- **`view-pdf`** — Interactive PDF viewer. Use when the user wants to open, show, or view a PDF and collaborate on it visually — annotate, highlight, stamp, fill form fields, place signature/initials, or review markup together. Not for summarization or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'view-pdf'`

### product-management
- **`competitive-brief`** — Create a competitive analysis brief for one or more competitors or a feature area. Use when informing product strategy or feature prioritization, building sales battle cards, prepping board or investor materials, or deciding where to…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'competitive-brief'`
- **`metrics-review`** — Review and analyze product metrics with trend analysis and actionable insights. Use when running a weekly, monthly, or quarterly metrics review, investigating a sudden spike or drop, comparing performance against targets, or turning raw…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'metrics-review'`
- **`product-brainstorming`** — Brainstorm product ideas, explore problem spaces, and challenge assumptions as a thinking partner. Use when exploring a new opportunity, generating solutions to a product problem, stress-testing an idea, or when a PM needs to think out…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'product-brainstorming'`
- **`roadmap-update`** — Update, create, or reprioritize your product roadmap. Use when adding a new initiative and deciding what moves to make room, shifting priorities after new information comes in, moving timelines due to a dependency slip, or building a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'roadmap-update'`
- **`sprint-planning`** — Plan a sprint — scope work, estimate capacity, set goals, and draft a sprint plan. Use when kicking off a new sprint, sizing a backlog against team availability (accounting for PTO and meetings), deciding what's P0 vs. stretch, or…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'sprint-planning'`
- **`stakeholder-update`** — Generate a stakeholder update tailored to audience and cadence. Use when writing a weekly or monthly status for leadership, announcing a launch, escalating a risk or blocker, or translating the same progress into exec-brief…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'stakeholder-update'`
- **`synthesize-research`** — Synthesize user research from interviews, surveys, and feedback into structured insights. Use when you have a pile of interview notes, survey responses, or support tickets to make sense of, need to extract themes and rank findings by…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'synthesize-research'`
- **`write-spec`** — Write a feature spec or PRD from a problem statement or feature idea. Use when turning a vague idea or user request into a structured document, scoping a feature with goals and non-goals, defining success metrics and acceptance…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'write-spec'`

### productivity
- **`memory-management`** — Two-tier memory system that makes Claude a true workplace collaborator. Decodes shorthand, acronyms, nicknames, and internal language so Claude understands requests like a colleague would. CLAUDE.md for working memory, memory/ directory…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'memory-management'`
- **`start`** — Initialize the productivity system and open the dashboard. Use when setting up the plugin for the first time, bootstrapping working memory from your existing task list, or decoding the shorthand (nicknames, acronyms, project codenames)…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'start'`
- **`task-management`** — Simple task management using a shared TASKS.md file. Reference this when the user asks about their tasks, wants to add/complete tasks, or needs help tracking commitments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'task-management'`
- **`update`** — Sync tasks and refresh memory from your current activity. Use when pulling new assignments from your project tracker into TASKS.md, triaging stale or overdue tasks, filling memory gaps for unknown people or projects, or running a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'update'`

### sales
- **`account-research`** — Research a company or person and get actionable sales intel. Works standalone with web search, supercharged when you connect enrichment tools or your CRM. Trigger with "research [company]", "look up [person]", "intel on [prospect]"…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'account-research'`
- **`call-prep`** — Prepare for a sales call with account context, attendee research, and suggested agenda. Works standalone with user input and web research, supercharged when you connect your CRM, email, chat, or transcripts. Trigger with "prep me for my…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'call-prep'`
- **`call-summary`** — Process call notes or a transcript — extract action items, draft follow-up email, generate internal summary. Use when pasting rough notes or a transcript after a discovery, demo, or negotiation call, drafting a customer follow-up…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'call-summary'`
- **`competitive-intelligence`** — Research your competitors and build an interactive battlecard. Outputs an HTML artifact with clickable competitor cards and a comparison matrix. Trigger with "competitive intel", "research competitors", "how do we compare to…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'competitive-intelligence'`
- **`create-an-asset`** — Generate tailored sales assets (landing pages, decks, one-pagers, workflow demos) from your deal context. Describe your prospect, audience, and goal — get a polished, branded asset ready to share with customers.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'create-an-asset'`
- **`daily-briefing`** — Start your day with a prioritized sales briefing. Works standalone when you tell me your meetings and priorities, supercharged when you connect your calendar, CRM, and email. Trigger with "morning briefing", "daily brief", "what's on my…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'daily-briefing'`
- **`draft-outreach`** — Research a prospect then draft personalized outreach. Uses web research by default, supercharged with enrichment and CRM. Trigger with "draft outreach to [person/company]", "write cold email to [prospect]", "reach out to [name]".
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'draft-outreach'`
- **`forecast`** — Generate a weighted sales forecast with best/likely/worst scenarios, commit vs. upside breakdown, and gap analysis. Use when preparing a quarterly forecast call, assessing gap-to-quota from a pipeline CSV, deciding which deals to commit…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'forecast'`
- **`pipeline-review`** — Analyze pipeline health — prioritize deals, flag risks, get a weekly action plan. Use when running a weekly pipeline review, deciding which deals to focus on this week, spotting stale or stuck opportunities, auditing for hygiene issues…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'pipeline-review'`

### slack
- **`slack-messaging`** — Guidance for composing well-formatted, effective Slack messages using mrkdwn syntax
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'slack-messaging'`
- **`slack-search`** — Guidance for effectively searching Slack to find messages, files, channels, and people
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'slack-search'`

### small-business
- **`business-pulse`** — Produces a one-page cross-functional business snapshot for SMB owners — cash position (QuickBooks), sales trend (PayPal/Square), pipeline movement (HubSpot), this week's commitments (Calendar), urgent watch-list items (Gmail/Slack), and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'business-pulse'`
- **`call-list`** — Ranks the top-5 leads most worth calling today, supplies talking points from email history, blocks time on the calendar, and drafts follow-up messages. Accepts optional count and date arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'call-list'`
- **`canva-creator`** — Takes an approved content brief and executes a campaign end-to-end: builds the posting calendar, generates Canva designs for social posts, drafts caption and email copy, and stages social sends in HubSpot. Canva is used for social posts…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'canva-creator'`
- **`cash-flow-snapshot`** — Reads AR/AP, historical cash timing, and known fixed costs from QuickBooks, PayPal, Stripe, or Square — or a CSV upload — and produces a 30/60/90-day cash flow forecast with percentage-variance confidence bands and named risk flags.…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'cash-flow-snapshot'`
- **`close-month`** — Closes the month — reconciles QB vs payment processors, flags gaps, writes P&L narrative, exports close packet. Accepts optional month and save-to arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'close-month'`
- **`content-strategy`** — Analyzes sales data from PayPal and QuickBooks to find top performers and slow movers, layers in seasonality, and produces a prioritized 30-day content brief: what to push, what offers to run, what to hold. Strategic output only — no…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'content-strategy'`
- **`contract-review`** — Lightweight NDA, MSA, and vendor contract review for SMBs without legal on staff. Reads contracts from local files, Gmail attachments, or DocuSign envelopes; flags non-standard terms; explains risks in plain English; and outputs a…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'contract-review'`
- **`crm-cleanup`** — Scans HubSpot for stale deals, duplicate contacts, and missing fields, then fixes what the owner approves. Accepts optional scope argument for deals, contacts, or all.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'crm-cleanup'`
- **`crm-maintenance`** — Keeps HubSpot current without the owner opening it: creates and updates contacts and deals from email and calendar context, logs notes and calls, and flags stale records. The "stop doing data entry" skill. Use when the user asks to…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'crm-maintenance'`
- **`customer-pulse`** — Aggregates PayPal disputes, HubSpot feedback and tickets, and email sentiment (plus pasted or exported Google/Yelp reviews) into a themes report with verbatim evidence and a "do these three things this week" list. Use when the user asks…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'customer-pulse'`
- **`customer-pulse-check`** — Synthesizes themes from PayPal disputes, HubSpot tickets, and review exports into a top-3 fixable issues list with drafted response templates. Accepts optional since-date argument.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'customer-pulse-check'`
- **`friday-brief`** — Delivers the Friday end-of-week pulse — revenue vs prior week, top sellers, wins and watches. Accepts optional lookback window of 7 or 14 days.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'friday-brief'`
- **`handle-complaint`** — Handles an incoming customer complaint end-to-end — pulls context, drafts a response, and suggests an operational fix. Accepts optional email or ticket ID argument.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'handle-complaint'`
- **`invoice-chase`** — Drafts overdue-invoice reminder emails from QuickBooks and PayPal data, matched to each customer's payment history and tone (gentle for good customers, firm for repeat late payers). Sends via PayPal with owner approval; non-PayPal…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'invoice-chase'`
- **`job-post-builder`** — Builds end-to-end hiring packets — job post, structured interview guide with scoring rubric, and offer letter template — from a hiring brief. Triggers on: "help me hire", "we're hiring for", "write a job post", "job description", "JD"…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'job-post-builder'`
- **`lead-triage`** — Scores inbound HubSpot leads by engagement signals, company fit, and urgency markers to produce a "call these 5 today" list with talking points, drafts the follow-ups, and blocks Calendar time. Use when the user asks to prioritize…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'lead-triage'`
- **`margin-analyzer`** — Analyzes unit economics by product or service using PayPal merchant insights and QuickBooks cost data, benchmarks against inflation and cost changes, and shows pricing-scenario data (e.g. "a 5% increase historically correlates with ~3%…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'margin-analyzer'`
- **`monday-brief`** — Generates a one-page Monday morning briefing — cash, sales, pipeline, week ahead, top three to-dos. Accepts optional post destination and save-to arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'monday-brief'`
- **`month-end-prep`** — Walks an SMB owner through month-end close: reconciles QuickBooks against PayPal (and Square/Stripe) settlements, flags uncategorized transactions, suspicious duplicates, and missing receipts, then writes a plain-English P&L narrative…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'month-end-prep'`
- **`month-heads-up`** — Runs on the 25th — shows the next 30-day cash-flow outlook and flags anything that needs attention before month-end. Accepts optional 30 or 60 day horizon.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'month-heads-up'`
- **`plan-payroll`** — Forecasts cash, ranks overdue invoices, and stages PayPal reminders so the owner can confidently run payroll. Accepts optional horizon and payroll-date arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'plan-payroll'`
- **`price-check`** — Produces a margin-by-product table and three pricing-scenario data views so the owner can see the full financial picture before making a pricing decision. Accepts optional product name argument.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'price-check'`
- **`quarterly-review`** — Generates a full QBR narrative — revenue trend, margin trend, customer health, top opportunities and risks — as a presentation-ready PDF or deck. Accepts optional quarter and save-to arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'quarterly-review'`
- **`review-contract`** — Reviews a contract in plain English, surfaces red flags with severity ratings, and produces a marked-up docx/PDF with suggested redlines. Accepts optional file path or DocuSign envelope ID.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'review-contract'`
- **`run-campaign`** — Runs an end-to-end marketing campaign — sales analysis, content brief, Canva assets, HubSpot send. Accepts optional lookback and channel arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'run-campaign'`
- **`sales-brief`** — Surfaces top and bottom sellers, identifies seasonality patterns, and produces a 2-week content brief to push winners and clear slow movers. Accepts optional lookback window of 30, 60, or 90 days.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'sales-brief'`
- **`smb-onboard`** — Claude as the trainer. Walks an SMB owner through connecting their first two tools, runs one recipe to prove immediate value, interviews them about their business (industry, size, top three headaches), stores that context persistently…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'smb-onboard'`
- **`smb-router`** — The front door to the Small Business plugin. Listens to what the owner needs right now — vague or specific — and routes them to the best skill or slash command for the moment. Also serves as a guide: explains what's available, suggests…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'smb-router'`
- **`tax-prep`** — Prepares tax-season materials — quarterly estimated tax calculation or year-end 1099 prep — and produces an accountant handoff packet. Accepts optional mode and year arguments.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'tax-prep'`
- **`tax-season-organizer`** — Prepares tax-season materials for small business owners — framed as deliverables for their accountant, not tax advice. Two modes: (1) quarterly estimated tax calculation — pulls YTD net income from QuickBooks and calculates the federal…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'tax-season-organizer'`
- **`ticket-deflector`** — Reads a forwarded customer email or ticket, pulls order/refund status from PayPal and account history from HubSpot, drafts a tone-matched reply in the owner's writing voice, and can issue a PayPal refund with explicit owner approval.…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'ticket-deflector'`

### zoom-plugin
- **`android`** — Zoom Contact Center SDK for Android. Use for native Android chat/video/ZVA/scheduled callback integrations, campaign mode, service lifecycle, and rejoin handling.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'contact-center/android'`
- **`android`** — Zoom Meeting SDK for Android native apps. Use when embedding Zoom meetings in Android with default/custom UI, PKCE + SDK auth, join/start flows, and Meeting SDK API integration.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-android'`
- **`android`** — Zoom Video SDK for Android native apps. Use when building custom Android video experiences with full UI control, session tokens, raw media options, and event-driven participant state.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-android'`
- **`android`** — Zoom Virtual Agent Android integration via WebView. Use for Java/Kotlin bridge callbacks, native URL handling, support_handoff relay, and lifecycle-safe embedding.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'virtual-agent/android'`
- **`build-zoom-bot`** — Build a Zoom meeting bot, recorder, or real-time media workflow. Use when joining meetings programmatically, processing live media or transcripts, or combining Meeting SDK, RTMS, and backend services.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-bot'`
- **`build-zoom-meeting-app`** — Build or embed a Zoom meeting flow. Use when implementing Meeting SDK joins, web or mobile meeting embeds, meeting lifecycle flows, or when deciding between Meeting SDK and Video SDK.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-meeting-app'`
- **`choose-zoom-approach`** — Choose the right Zoom architecture for a use case. Use when deciding between REST API, Webhooks, WebSockets, Meeting SDK, Video SDK, Zoom Apps SDK, Zoom MCP, Phone, Contact Center, or a hybrid approach.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'choose-zoom-approach'`
- **`client-view`** — Zoom Meeting SDK Web - Client View. Full-page Zoom meeting experience with the familiar Zoom interface. Uses ZoomMtg global singleton with callback-based API. Ideal for quick integration with minimal customization. Provides the same UI…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-web-client-view'`
- **`cobrowse-sdk`** — Reference skill for Zoom Cobrowse SDK. Use after routing to a collaborative-support workflow when implementing browser co-browsing, annotation tools, privacy masking, remote assist, or PIN-based session sharing.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-cobrowse-sdk'`
- **`component-view`** — Zoom Meeting SDK Web - Component View. Embeddable Zoom meeting components with Promise-based API for flexible integration. Ideal for React/Vue/Angular apps and custom layouts. Uses ZoomMtgEmbedded with async/await patterns and…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-web-component-view'`
- **`contact-center`** — Reference skill for Zoom Contact Center. Use after routing to a contact-center workflow when implementing app, web, or native integrations; engagement context and state handling; campaigns; callbacks; or version-drift troubleshooting.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-contact-center-app'`
- **`debug-zoom`** — Debug a broken Zoom integration by isolating the failure point and routing into the right Zoom references. Use when auth, API, webhook, SDK, or MCP behavior is failing and you need a ranked hypothesis list plus verification steps.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'debug-zoom'`
- **`debug-zoom-integration`** — Debug broken Zoom implementations quickly. Use when auth, webhooks, SDK joins, MCP transport, or real-time media workflows are failing and you need to isolate the layer before proposing a fix.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'debug-zoom-integration'`
- **`design-mcp-workflow`** — Design a Zoom MCP workflow for Claude. Use when deciding whether Zoom MCP fits a task, when planning tool-based AI workflows, or when separating MCP responsibilities from REST API responsibilities.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'design-mcp-workflow'`
- **`electron`** — Zoom Meeting SDK for Electron desktop applications. Use when embedding Zoom meetings in an Electron app with the Node addon wrapper, JWT auth, join/start flows, settings controllers, and raw data integration.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-electron'`
- **`flutter`** — Zoom Video SDK for Flutter. Use when building custom video session apps in Flutter with flutter_zoom_videosdk, event-driven architecture, session lifecycle handling, and mobile platform integration patterns.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-flutter'`
- **`general`** — Cross-product Zoom reference skill. Use after the workflow is clear when you need shared platform guidance, app-model comparisons, authentication context, scopes, marketplace considerations, or API-vs-MCP routing.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-general'`
- **`ios`** — Zoom Contact Center SDK for iOS. Use for native iOS chat/video/ZVA/scheduled callback integrations, app lifecycle bridging, rejoin flow, and callback handling.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'contact-center/ios'`
- **`ios`** — Zoom Meeting SDK for iOS native apps. Use when embedding Zoom meetings in iOS with default/custom UI, PKCE + SDK auth, host start with ZAK, and mobile lifecycle handling.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-ios'`
- **`ios`** — Zoom Video SDK for iOS native apps. Use when building custom iOS video sessions with full UI control, token-based session auth, and event-driven media/participant flows.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-ios'`
- **`ios`** — Zoom Virtual Agent iOS integration via WKWebView. Use for Swift/Objective-C script injection, message handlers, support_handoff relay, and URL routing policies.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'virtual-agent/ios'`
- **`linux`** — Zoom Meeting SDK for Linux - C++ headless meeting bots with raw audio/video access, transcription, recording, and AI integration for server-side automation
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'meeting-sdk/linux'`
- **`linux`** — Zoom Video SDK for Linux - C++ headless bots, raw audio/video capture/injection, Qt/GTK integration, Docker support
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'video-sdk/linux'`
- **`macos`** — Zoom Meeting SDK for macOS native apps. Use when embedding Zoom meetings in macOS with default/custom UI, PKCE + SDK auth, host start/join flows, and desktop meeting feature controllers.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-macos'`
- **`macos`** — Zoom Video SDK for macOS native desktop apps. Use when building custom macOS video sessions with native UI control, tokenized join, and desktop-oriented media/device workflows.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-macos'`
- **`meeting-sdk`** — Reference skill for Zoom Meeting SDK. Use after routing to a meeting-embed workflow when implementing real Zoom meeting joins, platform-specific SDK behavior, auth and join flows, waiting room issues, or meeting bot patterns.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-meeting-sdk-app'`
- **`oauth`** — Reference skill for Zoom authentication. Use after routing to an auth workflow when choosing app credentials, grant types, scopes, token refresh behavior, or debugging Zoom OAuth failures.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-oauth'`
- **`phone`** — Reference skill for Zoom Phone. Use after routing to a phone workflow when implementing OAuth, Phone APIs, webhooks, Smart Embed events, URI schemes, CRM or CTI dialers, or call handling automation.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-phone-integration'`
- **`plan-zoom-integration`** — Turn a Zoom integration idea into an implementation plan with architecture, auth, and delivery milestones. Use when you need a practical build plan, phased delivery sequence, risk list, and next-step recommendation.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'plan-zoom-integration'`
- **`plan-zoom-product`** — Choose the right Zoom building surface for a use case and explain the tradeoffs clearly. Use when deciding between REST API, Webhooks, WebSockets, Meeting SDK, Video SDK, Zoom Apps SDK, Phone, Contact Center, or MCP for a specific…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'plan-zoom-product'`
- **`probe-sdk`** — Reference skill for Zoom Probe SDK. Use after routing to a preflight workflow when testing browser compatibility, media permissions, audio or video diagnostics, and network readiness before users join.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'probe-sdk'`
- **`react-native`** — Zoom Meeting SDK for React Native. Use when embedding Zoom meetings in React Native iOS/Android apps with @zoom/meetingsdk-react-native, JWT auth, join/start flows, platform setup, and native bridge troubleshooting.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-react-native'`
- **`react-native`** — Zoom Video SDK for React Native. Use when building custom mobile video session experiences with @zoom/react-native-videosdk, event listeners, helper-based APIs, and backend JWT token flows.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-react-native'`
- **`rest-api`** — Reference skill for Zoom REST API. Use after choosing an API-based workflow when you need endpoint selection, resource-management patterns, OAuth requirements, rate-limit awareness, or API error debugging.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-rest-api-app'`
- **`rivet-sdk`** — Reference skill for Zoom Rivet SDK. Use after routing to a Rivet-based server workflow when implementing auth handling, webhook consumers, API wrappers, multi-module composition, or Lambda receiver patterns.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'rivet-sdk'`
- **`rtms`** — Reference skill for Zoom RTMS. Use after routing to a live-media workflow when processing real-time audio, video, chat, transcripts, screen share, or contact-center voice streams.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-rtms'`
- **`scribe`** — Reference skill for Zoom AI Services Scribe. Use after routing to a transcription workflow when handling uploaded or stored media, Build-platform JWT auth, fast mode transcription, batch jobs, or transcript pipeline design.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'scribe'`
- **`setup-zoom-mcp`** — Decide when Zoom MCP is the right fit and produce a safe setup plan for Claude. Use when planning AI workflows over Zoom data, deciding between MCP and REST, or defining a hybrid MCP architecture.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'setup-zoom-mcp'`
- **`setup-zoom-oauth`** — Implement Zoom authentication correctly. Use when setting up app credentials, choosing an OAuth grant, requesting scopes, handling token refresh, or debugging auth failures.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'setup-zoom-oauth'`
- **`start`** — Start here for any Zoom integration or app idea. Use when you need to choose the right Zoom surface, shape the architecture, or route into the correct implementation skill without reading the whole Zoom doc set first.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'start'`
- **`team-chat`** — Reference skill for Zoom Team Chat. Use after routing to a chat workflow when building user-scoped messaging integrations, chatbot experiences, rich cards, buttons, slash commands, or chat webhooks.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-team-chat-app'`
- **`ui-toolkit`** — Reference skill for Zoom Video SDK UI Toolkit. Use after routing to a web video workflow when you want prebuilt React UI instead of building a fully custom Video SDK interface.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'ui-toolkit/web'`
- **`unity`** — Zoom Video SDK for Unity wrapper integrations. Use when building custom Unity-based video session experiences and mapping Unity scene/UI state to Video SDK events.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-video-sdk-unity'`
- **`unreal`** — Zoom Meeting SDK for Unreal Engine wrapper integrations. Use when building Unreal projects that embed Zoom meetings with C++ and Blueprint wrappers, including wrapper-to-SDK mapping concerns.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-unreal'`
- **`video-sdk`** — Reference skill for Zoom Video SDK. Use after routing to a custom-session workflow when the user needs full control over the video experience rather than an actual Zoom meeting.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-video-sdk-app'`
- **`virtual-agent`** — Reference skill for Zoom Virtual Agent. Use after routing to a virtual-agent workflow when implementing web embeds, Android or iOS wrapper integrations, knowledge-base sync, lifecycle handling, or troubleshooting.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'build-zoom-virtual-agent'`
- **`web`** — Zoom Contact Center SDK for Web. Use for web chat/video/campaign embeds, engagement event handling, app-context integrations, and Smart Embed postMessage workflows.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'contact-center/web'`
- **`web`** — Zoom Meeting SDK for Web - Embed Zoom meeting capabilities into web applications. Two integration options: Client View (full-page, familiar Zoom UI) and Component View (embeddable, Promise-based API). Includes SharedArrayBuffer setup…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-web'`
- **`web`** — Zoom Video SDK for Web - JavaScript/TypeScript integration for browser-based video sessions, real-time communication, screen sharing, recording, and live transcription
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'video-sdk/web'`
- **`web`** — Zoom Virtual Agent SDK for web embeds. Use for campaign or entry ID chat launch, event-driven controls, user context updates, and CSP-safe deployment.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'virtual-agent/web'`
- **`webhooks`** — Reference skill for Zoom webhooks. Use after routing to an event-driven workflow when implementing subscriptions, signature verification, delivery handling, retries, or event-type selection.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'setup-zoom-webhooks'`
- **`websockets`** — Reference skill for Zoom WebSockets. Use after routing to a low-latency event workflow when persistent connections, faster event delivery, or security constraints make WebSockets preferable to webhooks.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'setup-zoom-websockets'`
- **`whiteboard`** — Guidance for the bundled Zoom Whiteboard MCP connector. Use for Whiteboard MCP auth, endpoints, ID mapping, and tool workflows such as list_whiteboards and get_a_whiteboard. Prefer this skill when the request is specifically about…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-mcp/whiteboard'`
- **`windows`** — Zoom Meeting SDK for Windows - Native C++ SDK for embedding Zoom meetings into Windows desktop applications. Supports custom UI architecture with raw video/audio data, headless bots, and deep integration with meeting features. Includes…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-meeting-sdk-windows'`
- **`windows`** — Zoom Video SDK for Windows - C++ integration for video sessions, raw audio/video capture, screen sharing, recording, and real-time communication
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'video-sdk/windows'`
- **`zoom-apps-sdk`** — Reference skill for Zoom Apps SDK. Use after routing to an in-client app workflow when building web apps that run inside Zoom meetings, webinars, the main client, or Zoom Phone.
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-apps-sdk'`
- **`zoom-mcp`** — Guidance for the bundled Zoom MCP connectors. Use after routing to an MCP workflow when planning or troubleshooting tool-based access to meetings, recordings, meeting assets, or transcripts. Route Zoom Docs requests to the dedicated…
  `npx skills add https://github.com/anthropics/knowledge-work-plugins --skill 'zoom-mcp'`
