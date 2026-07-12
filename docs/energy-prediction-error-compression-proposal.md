# Energy — Prediction-Error Compression (concrete proposal)

**Source (only):** LIMEN Helix Neurology Reference — XIII.5 (predictive coding: top-down
predictions descend, bottom-up **prediction errors** ascend, **only the mismatch propagates
upward**; forward=error, backward=prediction), XIII.7 (neuromodulation/gain sets SNR/precision),
and the Neuro↔Business Cross-Reference **unified rule** (prediction-error → **management-by-
exception**) + Chart C `PREDICTION_ERROR_COMPRESSION` (lesion: **executive overload** OR
**premature over-filtering**).
**Domain:** Energy. **Contract:** additive; read-only; **never writes** `energy.json`; defaults
to a **no-op**; and it **summarizes** the compressed items rather than dropping them (the
document's "matches are summarized away," not deleted).

## The mechanism (grounded)

> XIII.5: the cortex is a hierarchical generative machine — predictions descend, **prediction
> errors ascend, and only the mismatch propagates upward.** ⟨fractal-critical: "prediction error
> drives update" is the candidate unified rule.⟩

So compression = for each signal headed "upward," propagate it only if its **error** (observed −
predicted) is large enough to matter; everything else is folded into a **summary**. That is
management-by-exception made mechanical.

**Precision weighting (XIII.7 enhancement, flagged):** an error can be weighted by the
**precision** (reliability) of its prediction — a low-precision prediction yields a less-trusted
error. Default precision = 1 (neutral), so the base behavior is pure mismatch propagation.

## The two-pole guard (from the cross-ref)

The threshold is the single knob and it must sit **between** two lesions:
- **too low → executive overload** (everything propagates; no compression).
- **too high → premature over-filtering** (real surprises suppressed).

The healthy value is neither extreme. The document gives **no number** — it is operator-set.

## The Energy analog + concrete demo

Energy actions currently push everything "up" with no exception-filtering. This adds a compressor
that, given a stream of Energy signals with an observed and a predicted value, propagates only the
surprising ones and summarizes the rest.

**Concrete demo on real Energy data (read-only):** treat each of the 62 `edges` in `energy.json`
as a signal, predict every edge's weight with a **baseline predictor** (the mean edge weight),
and compress by deviation from that baseline. Only the edges whose weight deviates beyond the
threshold propagate "up"; the rest collapse into a summary (count + mean error). This is a faithful
management-by-exception pass over actual Energy numbers, computed on a copy.

## Parameters — operator-set where the document gives no value

| Param | Meaning | Default | Basis |
|---|---|---|---|
| `threshold` | min weighted \|error\| to propagate | `0` (→ everything propagates = no-op) | XIII.5 mismatch gate; value operator-set (between the two lesions) |
| `precision` | reliability weight on the error (scalar or per-id) | `1` (neutral) | XIII.7 gain/SNR; enhancement, off by default |
| `predictor` | `'given'` (use signal.predicted) / `'baseline'` (use `baseline`) | `'given'` | which prediction to compare against |
| `baseline` | prediction used when `predictor='baseline'` | `null` | operator- or data-supplied |

## Safeguards

- **Default is a no-op** (`threshold=0`): nothing is filtered until deliberately configured.
- **Summarize, not delete:** compressed signals are returned as a `summary` (count, mean error),
  so nothing is silently lost — the document's "summarized away," and it prevents the
  over-filtering lesion from becoming invisible.
- **No-prediction is surfaced, not hidden:** a signal with no available prediction is propagated
  and listed under `noPrediction` — you cannot compress against a prediction you don't have.
- **Read-only:** operates on a copy of supplied values; **never reads or writes** `energy.json`
  as a side effect.

## Honest gaps (flagged, not filled)

1. **Energy has no baked-in predicted/expected values or time series.** Prediction-error
   compression needs a prediction to compare against; `energy.json` supplies only static
   structure. The compressor therefore requires a caller-supplied prediction or a baseline
   predictor. Adding forecasts/expected-values to Energy data is a separate authoring item.
2. **The threshold is not in the source document** → operator-set, defaulted to a no-op. Not
   fabricated. It must be tuned between the overload and over-filtering lesions.
3. **Hierarchy wiring** (which Energy signals report to which level "up") is in neither document
   → the compressor is level-agnostic; the caller decides what stream feeds it.

## Reference implementation

`assets/js/energy-prediction-error-compressor.js` — a pure `compress(signals, params)` plus a
`baselinePredictor(values)` helper. Defaults make it a verified no-op.
