# Defense source-to-native-handoff join

The focused test runs the actual configured OFAC Recent Actions HTML and CISA
KEV JSON fetchers, snapshot assembler, Defense brain cycle, server packet and
durable handoff consumer. HTTP bodies and storage are local fixtures; portal
reads use checked-in JSON. No diagnosis or opportunity is injected.

Valid input derives four active diagnoses and eight handoffs. Empty OFAC input
becomes a broken/non-live/null source, with low-signal semantics, and yields
three diagnoses and six handoffs from remaining input. Valid recovery restores
four/eight. Each packet and keyed handoff retains exact parser-produced source
identities and observation-only ownership; exact replay adds no handoff or
stored-value change. CISA fixture count must match its vulnerability collection
for the actual identity helper to identify it.

The next boundary is
`parser-derived-defense-handoff-to-publication-decision-not-joined`.
The earlier native publication-veto test uses different identified snapshot
inputs, so it is not substituted for this join. No provider, publication,
outcome, revenue, publisher authenticity or current production feed is proved.

Focused Defense join and source-collection contracts pass. Runtime code is
unchanged since the 364-pass full checkpoint. Agriculture and Defense now have
actual parser/assembler-to-native fixture joins; eighteen other domains still
require that proof. Google Docs remains deferred until whole-goal completion.
