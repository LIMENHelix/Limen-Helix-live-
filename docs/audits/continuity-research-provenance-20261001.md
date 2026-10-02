# Science paper routing provenance checkpoint

Status: LOCAL/FIXTURE validation; full continuity goal remains incomplete.

The owner clarified that all research papers go to Science. The existing worker already performs this routing. No domain brain, protected policy, phase engine, source data, motor gate or worker routing was changed in this checkpoint.

The existing durable selection bridge previously retained explicit routing provenance only for Agriculture. A failing actual-worker test reproduced the missing originating domain for Medicine papers. The bridge now records observation-only origin metadata for identified native Science, Medicine, Education and Environment paper candidates routed to Science. Unsupported origins and missing packet identities do not acquire this metadata. Existing Agriculture behavior is preserved.

The existing read-only research trace now exposes the stored origin on its decision after validating its owner, source packet, source artifact, source identity and observation-only status. Corrupt provenance produces an unavailable readout. Older receipts remain readable with a null origin; no historical origin is inferred. The existing observatory displays the escaped origin beside the decision and packet.

Focused verification covers durable readback and replay, unchanged input candidates, unsupported/incomplete metadata, corrupt routing owner/packet/authority/origin, legacy receipts and read-only access. Actual-worker fixtures verify that Medicine, Education and Environment paper candidates request Science motor authorization and create no command or network request while Science is held. The fixture helper was corrected because its earlier Education and Environment labels constructed Science candidates. Earlier claims for those two actual-handler origins were therefore too broad; the corrected cases now pass.

Results before full-suite completion: 12 autofire tests passed; 18 research tests passed; the observatory rendering check and Agriculture routing check passed. Full-suite and repository/harness results must be recorded from their terminal handles before this checkpoint is committed or pushed.

Limits: these tests do not prove live provider capability, an independent native outcome, revenue, returned learning or source-domain console visibility of Science's records. The Science decision view exposes provenance; it does not make the originating domain a research executor. Google Docs remains deferred until the original goal is Done.

Validation sequence: the first full run finished with 377 passed, one prerequisite skip and one pre-fix native-spine fixture failure in 296.6s. Two fixture decisions had equal timestamps, making the latest-record assertion depend on lexical IDs. The fixture now orders them at sourceAt and sourceAt+1; corrected evidence regeneration passed. A fresh final full suite passed against the corrected files: 378 passed, one external-corpus prerequisite skip, zero failed in 268.9s, exit 0. Repository/harness checks passed, including 350 module boots. The prior failure log remains preserved separately.
