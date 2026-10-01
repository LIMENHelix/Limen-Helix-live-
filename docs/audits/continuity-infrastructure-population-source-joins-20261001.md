# Infrastructure and Population source joins

The cumulative Industry/Trade source harness additionally runs two owning
profiles through actual configured fetchers, snapshot assembler, native brain,
server packet and existing handoff consumer:

- Infrastructure: World Bank Infrastructure rail-length context and NOAA NWS
  Alerts collection fixtures.
- Population: World Bank Population context and World Bank Fertility fixtures.

All profiles test valid, missing-first-source and recovery. Missing first data
becomes broken/non-live/null and preserves existing low-signal handling. Valid
context data is not promoted to a second stress driver. These two profiles stay
at assembled stress 0.30 / low signal in all three scenarios.

Infrastructure derives no active investment/research handoff from these inputs.
The packet persists and replay adds no handoff. Its first tested boundary is
`native-snapshot-has-no-active-investment-or-research-handoff`. No property
candidate or pressure is manufactured to bypass this boundary. This does not
prove that other Infrastructure source combinations cannot produce a handoff.

Population derives two native handoffs in each scenario. Keyed readback retains
the exact packet/source identity and replay changes no stored values. Its actual
opportunities enter its existing property-interest decision and are refused
with `exact-non-binding-property-interest-record-required`, with no provider call
or state mutation. No property availability, authorization or receipt is inferred.

Industry/Trade's existing cases continue passing. Focused Infrastructure and
Population property-loop regressions also pass. Runtime remains unchanged since
the 366-pass checkpoint; this increment changes fixture tests and evidence only.
Seven domains have actual parser-to-native fixture paths or an exact tested
earlier boundary; thirteen remain. Upstream authenticity and production execution
are unproved. Homestead stays separate. Google Docs remains deferred.
