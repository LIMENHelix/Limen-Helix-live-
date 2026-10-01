# Finance branch-content failure visibility

LOCAL/FIXTURE, building on e406c14b. The existing Finance LOAD BRANCH consumer
tries its static domain JSON first and, for a non-success HTTP response, the
existing fetch-portal fallback. Previously a static 404 and fallback 500 were
reduced to “Failed to load branch,” hiding both attempted locations and reasons.

The actual-consumer VM regression reproduced that failure before the patch.
The patched consumer displays the encoded static path, its HTTP status when a
fallback is attempted, fallback path, and final HTTP/network/JSON error. Failure
text is escaped. Existing close/reopen retry and static-first behavior remain.
The focused test passes static 404/fallback 500, populated static recovery without
fallback, and escaped network failure. The twenty-domain index regression passes.

Only the Finance loader's request bookkeeping and failure message changed.
No source JSON, brains, neurology, authority or provider configuration changed.
The existing fallback handler was inspected as a token-backed GitHub content
read; no real fallback/API/provider request was made. This test supplies fixture
responses and establishes no current live content or production rendering.

Read-only parsed-function inventory of all twenty existing LOAD BRANCH handlers
found Agriculture, Infrastructure and Trade use the API directly; the other
seventeen use static-first/API fallback. Future error reporting must preserve
those distinct request paths instead of assuming all loaders match Finance.

Repository/boot and harness checks passed (session 10365, exit 0). Full unit
checks finished with 370 passed, 1 external-corpus prerequisite skip, 0 failed
in 247.3 seconds (session 46683, exit 0). Broader continuity Done remains unproven and Google
Docs deferred. Next inspect remaining domain LOAD BRANCH consumers and schema
handling without changing source data or assuming a successful empty result.
