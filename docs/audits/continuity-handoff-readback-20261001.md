# Packet/handoff readback repair — 2026-10-01

Base `fe1f56ca`. LOCAL/FIXTURE evidence. Inspection of the next native handoff boundary reproduced a durability defect: after SET NX returned an existing packet, the consumer processed a changed input without comparing it to the stored source packet. That could create new handoffs under an older packet identity. The regression failed before the repair.

The existing consumer now requires keyed packet readback matching the validated input before indexing the packet or processing opportunities. It also requires keyed handoff readback matching its source packet before indexing or counting creation. Missing or mismatched records produce PACKET_READBACK_MISMATCH or HANDOFF_READBACK_MISMATCH. Existing records remain preserved. No new motor, dispatcher, authority, owner, provider or neurology was added.

Tests prove exact replay suppression, changed-payload refusal, missing packet readback, missing handoff readback, and original malformed-input/store failure behavior. Fixture stores now retain/read the same values rather than returning null regardless of a write. The twenty-domain native source/brain/packet/handoff test uses the same strict readback API. Its malformed-identity case uses a distinct negative-fixture cycle so it tests the opportunity boundary rather than colliding with the valid packet.

Changed paths: `lib/civilization-handoff-consumer.js`, its existing consumer test and the native feed-spine integration test, plus evidence documents. Focused consumer and handler checks and the twenty-domain native integration pass. Protected brain, phase/capital, provider adapters, portal JSON, production configuration, canonical paused changes and worktrees are preserved. No external action occurred.

Next: continue the now-confirmed native handoff through the existing domain-owned intake/motor at the first safe boundary. Full-goal handoff-to-motor, upstream source and route-provenance gaps remain unproven. Google Docs remains deferred.

Validation complete: fresh full suite **362 passed, 1 skipped, 0 failed** in 218.2 seconds, including final consumer and native integration regressions. Existing unavailable external-corpus skip. Repository/harness and diff checks pass.
