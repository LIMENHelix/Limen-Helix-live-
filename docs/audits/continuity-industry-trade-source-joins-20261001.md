# Industry and Trade source-to-consumer joins

Actual configured parsers now join identified HTTP fixtures through the actual
snapshot assembler, native brains, server packet and keyed durable handoffs.
Industry uses BLS Manufacturing PPI and World Bank Manufacturing; Trade uses
BLS Freight PPI and CISA KEV under the supplyChain runtime alias. No diagnosis,
opportunity, actor, company, asset or counterparty is injected.

| Domain | Valid stress / handoffs | Missing BLS stress / handoffs | Recovery |
|---|---|---|---|
| Industry | 0.66 / 8 | 0.30 / 4 | 0.66 / 8 |
| Trade | 0.78 / 9 | 0.30 / 1 | 0.78 / 9 |

Missing series data is broken/non-live/null and activates existing low-signal
handling. Exact parser identities survive each keyed handoff. Replay creates no
new handoff and preserves stored values. Every actual native opportunity enters
its existing owning consumer decision and is refused as NO_ACTION, with no
provider call or storage mutation:

- Industry: `source-grounded-work-first-WARN-record-required`.
- Trade: `exact-owned-asset-auction-listing-record-required`.

These are candidate-validation refusals, not fabricated durable B10 receipts,
commands, outcomes or revenue. World Bank/BLS periods and CISA records are local
fixture evidence, not authenticated current observations. BLS request state is
reset between scenarios and on exit; no key or provider authority is created.

Focused joined tests and affected existing contracts pass. Runtime remains
unchanged since the 366-pass full checkpoint. Five domains now have actual
parser/assembler-to-native fixture joins; fifteen still require that proof.
Google Docs remains deferred until whole-goal completion.
