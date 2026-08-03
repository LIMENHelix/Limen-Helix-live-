/**
 * HALTED PROTOTYPE — intentionally not an adapter.
 *
 * The experimental implementation was rejected because it treated local `_enrichment`
 * metadata as source provenance and collapsed distinct evidence vocabularies. The code is
 * retained in Git history at c7db1bf5. Keeping it importable here would make one careless
 * require enough to reactivate behavior the corpus measurements refuted.
 */
'use strict';

throw new Error(
  'HALTED_PROTOTYPE: brain-v2/corpus/adapter.js was rejected; use artifact-index.js and ' +
  'raw-claim-store.js. See CORPUS_CONTRACT.md and commit c7db1bf5 for the archived experiment.'
);
