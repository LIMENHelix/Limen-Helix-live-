# Communication and Intelligence source continuity

Evidence level: LOCAL/FIXTURE. No external fetch, publication, email, spending or production mutation.

The cumulative parser harness now covers Communication's configured BBC World News and World Bank Internet Users sources, and Intelligence's CISA Advisories and CISA KEV sources. It runs their actual parsers, snapshot assembler and native brains without injecting diagnoses or opportunities. Valid, unavailable-first-source and recovery cases retain exact source identities in packets and keyed handoffs; duplicate consumption creates no additional handoffs.

Communication remains low-signal at stress 0.3 with two handoffs in each case. Its existing social decision refuses native opportunities with `candidate-identity-missing`, `released: false` and `liveMoney: false`. This early refusal does not expose a `providerCalled` field; the test asserts its actual contract and unchanged memory store rather than inventing that field.

Intelligence has two handoffs at stress 0.3. Valid and recovery inputs are not low-signal; unavailable advisories are broken/null and low-signal. Its existing autopilot decision refuses with `exact-lead-email-action-required` and `providerCalled: false`.

The cumulative harness and both domain loop regressions pass, as does diff checking. Runtime code is unchanged; the last full runtime checkpoint remains 366 passing, one external-corpus skip and zero failures. Nine domains now have actual parser-to-native fixture paths or exact earlier boundaries; eleven remain. Separate domain loop regressions do not prove that this native source packet reaches an independent live consequence and returned afferent. Whole-goal UI, routing/return and inventory completion remain outstanding. Google Docs remains deferred until the full goal is Done.
