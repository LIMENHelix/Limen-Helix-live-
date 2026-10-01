# Finance drill-deeper availability and recovery

Local implementation evidence; no deployment or generated source data.

The prior Finance operator correctly labeled missing branch indexes unavailable,
but discarded the HTTP/network reason and permanently cached a failed fetch until
page reload. The exact Finance index was among the 47 static paths previously
confirmed absent in both checkouts and HTTP 404 in the live HEAD probe.

The existing Finance consumer now displays the exact asset path and escaped
failure reason. Closing and reopening the drill retries the read. Successful
indexes remain cached. A branches value that is not an array is unavailable,
instead of appearing to be an empty successful search.

Focused VM execution of the actual loader and drill handler reproduced the
pre-fix failure (the unavailable message lacked the asset path). The repaired
test covers HTTP 404, retry and recovery, a valid empty index, successful cache,
malformed branches and HTML escaping of a network error. It passed locally.
Repository parsing/boot and harness checks passed. Full unit verification
finished with 368 passed, 1 external-corpus prerequisite skip, 0 failed in
247.3 seconds (session 34937, exit 0), including the new Finance regression.

Other domains still use their existing failure-cache behavior; this change
claims only Finance. No branch JSON, brains, neurology, providers, production
configuration or authority were changed. Missing files remain missing; retry
cannot create them. UI/browser rendering and production behavior are unverified.

Next: review the remaining domain consumers against the same availability and
recovery requirement before changing them.
