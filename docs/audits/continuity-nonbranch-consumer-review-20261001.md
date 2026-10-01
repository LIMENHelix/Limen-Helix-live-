# Missing nonbranch data consumer review

Level: LOCAL/SOURCE ONLY. Base: `77dcf17c`. Full continuity goal remains incomplete.

The adjacent JSON captures all 27 missing nonbranch references, current consumer file hashes and line-numbered excerpts. This is source evidence, not execution, source validation or production proof. No brain, portal data, source corpus or configuration changed.

Confirmed distinctions:

- Finance credit/liquidity absence clears its portal and exposes `loaded: false`, empty sublayer diagnoses/treatments/packets and an explicit non-binding research note (finance-brain.js:2078–2101).
- Agriculture crop-cycle/food-security absence clears its supplemental diagnoses and packets but still exposes a calendar-derived phase; that phase must not be mistaken for loaded food-security evidence (agriculture-brain.js:2189–2215).
- Education and Industry loaders use existing `_handAuthoredLearningOutcomes` and `_handAuthoredProductionCapacity` fallbacks on HTTP absence or rejection. Both label the fallback `sourceMode: 'hand-authored'`; missing files do not imply an empty layer (education-brain.js:1091–1110; industry-brain.js:1076–1096).
- Trade's builder uses existing `FREIGHT_FLOW_DIAGNOSES` when its portal is absent (trade-brain.js:1914–1944). Its empty-layer branch alone therefore does not prove absent-data behavior.
- Intelligence's missing collection index falls back to `intelligence_collection.json`; that fallback is not in the missing-reference list. The first missing file alone does not establish collection unavailability (intelligence-brain.js:1451–1477).
- Agriculture's runtime imports the substrate module and calls `validateIncompleteCircuit`, which operates on supplied issue circuits without loading the missing substrate JSON (agriculture-brain.js:1275,1323; agriculture-neuro-substrate.js:56–67). The separate `getSubstrate`, `failureClassForIssue` and `ratioPreservationRule` APIs do load that JSON. A missing JSON does not by itself disable the synchronous circuit validator.

Next: inspect the other captured loaders, trace each fallback/absent layer into packet, opportunity and operator projections, and identify any loss of provenance before changing an authorized consumer. Do not generalize Finance's behavior, label hand-authored fallback as fresh source evidence, fabricate missing JSON, or infer execution authority from diagnostic labels. Existing 372-pass/1-skip runtime checkpoint is unchanged; no new runtime tests claimed. Google Docs stays deferred until the full definition of done is satisfied.
