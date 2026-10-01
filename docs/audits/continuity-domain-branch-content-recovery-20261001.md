# Domain branch-content availability and successful recovery

LOCAL/FIXTURE, following b514da81. Actual-consumer VM tests reproduced nineteen
missing API failure locations and Finance accepting malformed activations as an
empty success. Existing requests are preserved: Agriculture, Infrastructure and
Trade are API-direct; the other seventeen are static-first with API fallback.

Existing LOAD BRANCH handlers now show attempted encoded paths, failed static
HTTP status when applicable, and escaped final HTTP/network/JSON error. All
twenty reject missing or non-array activations as invalid branch content.
Successful content rendering and a valid empty array remain distinct results.

Populated recovery uncovered a pre-existing undefined pid in the source-portal
button of Communication, Defense, Energy, Governance, Intelligence and
Technology. Those loaders take portalDomainId; two pid references per loader
were corrected to that actual parameter. HEAD Energy inspection confirmed the
defect predated this repair. The six successful fixtures failed before that
correction and passed afterward.

All twenty actual loader functions pass the new matrix: original request path,
404/500 failure evidence, close/reopen populated recovery, no fallback after
static success, invalid activation shape, escaped network error and valid empty
content. Finance's prior content test passes. Parsed-AST comparison confirms no
code outside the twenty existing LOAD BRANCH handlers changed. Diff checks pass.
Repository/boot and harness checks passed (session 54628, exit 0). Full unit
checks finished with 371 passed, 1 external-corpus prerequisite skip, 0 failed
in 308.0 seconds (session 53734, exit 0).

No real API/provider calls, source JSON, brains, neurology, source corpus,
phase/capital logic or production configuration changes. UI/browser rendering
and deployment remain unverified. Full continuity Done remains unproven and
Google Docs deferred.

Next: inspect rendered source-portal result locations
and remaining missing-data consumers without generating protected data.
