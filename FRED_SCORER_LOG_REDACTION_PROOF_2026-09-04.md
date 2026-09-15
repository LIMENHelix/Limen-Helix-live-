# FRED Scorer Credential-Redaction Proof — 2026-09-04

## Before measurement

Exact production deployment `dpl_5CErEb4QvwuioTnYY2ko5Ts6LjiQ` produced 50 unique sampled
credential-bearing log events in a bounded 15-minute query. Every sampled event came from
`/api/limen/score`; response statuses included both 200 and 404. The burst occurred between
`1788577539934` and `1788577540036`.

The cause was not the encrypted Vercel environment: `FRED_API_KEY` exists for Preview and
Production. The scorer wrapper ignored it and invoked the validated kernel's legacy acquisition
function, whose exception rendering included the complete query URL. The same byte-locked file
also contains the historical key, so it must not be modified without invalidating the validated
kernel.

## Bounded repair

`api/fred_delta.py` is an acquisition adapter, not a scoring-kernel change. It:

- reads the caller-supplied deployment credential;
- passes the credential through `requests` parameters rather than composing a URL;
- preserves the legacy FEDFUNDS monthly-to-quarterly-delta calculation;
- reports only a bounded HTTP status or generic network/JSON failure; and
- returns `{}` on acquisition failure, preserving the existing best-effort behavior.

`api/limen.py` now supplies `FRED_API_KEY` to that adapter. The protected/validated kernel is
unchanged. Before editing, its SHA-256 was
`3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20`, exactly matching
`VALIDATION_LOCK.json`. That historical lock signs the file's Windows CRLF representation; the
regression normalizes the logically identical LF checkout used by GitHub Actions back to CRLF
before comparing, so the invariant is portable without changing either source or lock.

## Deterministic proof

```text
node scripts/test-limen-fred-adapter.cjs
limen FRED adapter: env credential used, quarterly delta preserved, logs secret-free
```

The test covers success, HTTP 400, a network exception whose hidden text contains a credential,
and the missing-key path. It also verifies that the runtime wrapper no longer calls
`lbt.fetch_fred()`.

```text
python -c "import api.limen as m; print(m.health()); print(m.fetch_fred_delta.__module__)"
{'status': 'ok', 'kernel_id': 'limen_backtest.py', 'validation_status': 'validated'}
fred_delta

npm test
repository check passed
  javascript parsed : 2009
  json parsed       : 4963 (2 skipped over the size cap)
  cron targets      : 52
  canonical nodes   : 123
running 258 test files
257 passed, 1 skipped, 0 failed, 197.4s
```

The one skip is the explicit external-corpus prerequisite in
`brain-v2/test/corpus-foundation.js`; `LIMEN_CORPUS_ROOT` was unavailable.

## Production acceptance

UNMEASURED before deployment. Acceptance requires exact head/merge SHA CI and Vercel provenance,
a known-good scorer request, a FRED status line that contains no URL or credential, zero
credential-bearing `/api/limen/score` log events after deployment, and a post-deploy confirmation
that the kernel hash still equals the validation lock.

The historical key embedded in the validated file has been present in Git history and must be
rotated at the FRED account. Rotation is external and therefore remains explicitly UNMEASURED.
