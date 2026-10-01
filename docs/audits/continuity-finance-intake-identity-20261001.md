# Finance intake keyed identity — 2026-10-01

Base ee8dc33a. LOCAL/FIXTURE evidence. The existing Finance reader consumes durable server packets, not the civilization handoff index. Its previous validation accepted a structurally valid Agriculture packet returned for the indexed Energy packet key. The regression failed before repair (two records accepted, expected zero). The reader now checks packet.packetId against the index identity before classifying opportunities or emissions and emits packet-key-identity-mismatch on failure.

Changed runtime: lib/finance-domain-intake.js only. Regression: scripts/test-finance-domain-emission-loop.cjs. Existing all-twenty native feed test proves nineteen non-Finance packets reach the same read-only intake; Finance excludes its own packet. No provider call, decision, command, order, consequence or revenue is established by this intake.

Inspection of lib/finance-source-universe.js shows company context is attached only through explicit payload ticker/symbol/company/instrument identity. Missing company identity is an honest downstream boundary; no ticker is injected into native opportunities to simulate a joined decision. Next inspect the native opportunities' actual company evidence and existing owning decision path, or proceed to another domain's appropriate intake where that evidence is absent. Shared inventory/upstream-source gaps remain open.

Protected brain, neurology, phase/capital, portal JSON, provider adapters and production configuration unchanged. All paused files and worktrees preserved. Full goal active; Google Docs deferred.

Validation: focused pre-fix regression failed; repaired Finance emission-loop and native20 feed/intake tests pass. Fresh npm test: 362 passed, 1 existing external-corpus skip, 0 failed (227.2s), including repository/harness checks. git diff --check passes.
