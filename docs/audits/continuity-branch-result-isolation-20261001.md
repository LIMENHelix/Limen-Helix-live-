# Independent simultaneous drill results

At 1421c688, Science browser reproduction showed two result containers sharing
branch-content-fixture: the second load closed the first rather than opening its
own result. Actual rendered-DOM and delegated-handler regression reproduced the
duplicate IDs in Culture, Education, Environment, Industry, Law, Population,
Religion and Science before repair (eight failures).

Each of those existing drill renderers now derives result identity from its
unique drill ID plus branch-row index. The load button carries that result ID;
the existing delegated handler passes it to the loader. Portal identity still
controls the unchanged static/API request. Legacy single-loader invocation keeps
its previous portal-ID fallback. No other domain's motor or data is involved.

The eight-domain DOM test executes actual drill renderer, loader and delegated
click callback, and passes distinct IDs, two independent populated loads,
closing/reopening only the selected result and preserving static request paths.
The twenty-domain branch-content and branch-index matrices pass as well.

Codex in-app browser with complete unchanged operator scripts on the local
console template verified both results visible/recovered, closing proof leaves
anchor visible, and proof retry recovers independently for all eight domains.
Per-domain JSON and screenshot retain LOCAL/FIXTURE qualifiers. No native
cognition, business execution, full application startup or production claim.
Temporary browser tab and fixture server were closed.

Repository/boot and harness checks passed (session 72646, exit 0). Full unit
checks finished with 372 passed, one external-corpus prerequisite skip, zero
failures in 259.1 seconds (session 86698, exit 0).
No protected JSON, source corpus, brains, neurology, phase/capital authority,
providers or production configuration changed. Goal remains active; Docs deferred.

Next inspect remaining result-location/freshness gaps against the original
definition of Done, rather than equating isolated UI fixtures with autonomy.
