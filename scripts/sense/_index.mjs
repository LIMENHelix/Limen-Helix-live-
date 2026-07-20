// scripts/sense/_index.mjs — registry of every immune cell.
//
// Each organ sense module exports { id, role, order, sense() }.
// The aggregator (scripts/audit-system-vitals.mjs) imports this list
// and runs sense() on every organ. heal-corpus.mjs dispatches by
// (organ.id, issue) when a heal is needed.
//
// To add a new organ:
//   1. Write scripts/sense/organ-<id>.mjs exporting { id, role, order, sense() }
//   2. Add the import + entry below
//   3. (Optional) Register a heal handler in heal-corpus.mjs
//
// Order is the display order on /vitals.html — afferent → cortex → executive → motor.
import * as portalCorpus  from './organ-portal-corpus.mjs';
import * as feeds         from './organ-feeds.mjs';
import * as nodes         from './organ-nodes.mjs';
import * as domains       from './organ-domains.mjs';
import * as connectome    from './organ-connectome.mjs';
import * as civilization  from './organ-civilization.mjs';
import * as kernel        from './organ-kernel.mjs';
import * as masterBrain   from './organ-master-brain.mjs';
import * as propagator    from './organ-propagator.mjs';
import * as patternBus    from './organ-pattern-bus.mjs';
import * as deadLinks     from './organ-dead-links.mjs';
import * as bridge        from './organ-bridge.mjs';
import * as dataflow      from './organ-dataflow.mjs';
import * as energyEstimator from './organ-energy-estimator.mjs';

export const ORGANS = [
  feeds, nodes, domains, dataflow, energyEstimator, portalCorpus, deadLinks, kernel, connectome, civilization, propagator, masterBrain, patternBus, bridge
].sort((a, b) => (a.order || 99) - (b.order || 99));
