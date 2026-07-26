/**
 * lib/phase-map.js — which phases a domain can actually express, and the exact signal.
 *
 * THE RULE, and it is the whole point: a domain earns a phase ONLY when a real signal in that
 * domain IS that phase, as defined in lib/phase-spec.js. Every entry below names the concrete
 * field or value it reads. If a phase is absent from a domain, that is the honest answer and
 * the rung is not sold. Loosening a phase definition so more things qualify, or stretching a
 * signal to fill a gap, destroys the only thing that makes the ladder mean anything.
 *
 * Most domains support four to six of the eleven. None supports all eleven. An incomplete
 * ladder is the correct result.
 *
 * `verified` means the signal was checked against the live source, with the value recorded in
 * `evidence`. Nothing ships as sellable on an unverified signal.
 */

var MAP = {

  // ── LAW — Federal Register ────────────────────────────────────────────────
  // The richest domain by far: federal rulemaking already speaks the arc's grammar, because
  // the document TYPE encodes where in its life a rule is.
  law: {
    source: 'Federal Register API',
    phases: {
      p0: { signal: 'every proposed rule currently open for public comment', field: 'type=PRORULE', verified: true, evidence: '237 open' },
      p1: { signal: 'a rule touching your sector is proposed for the first time', field: 'type=PRORULE, first appearance in your CFR title', verified: true, evidence: '171 proposed in 30d' },
      p2: { signal: 'the recurring flow of what is open in your sector', field: 'cfr_references grouped by title', verified: true, evidence: '20 open in alcohol/tobacco/firearms' },
      p4: { signal: 'a comment period EXTENDED or REOPENED, holding a window open that was closing', field: "action matching /extension|reopening/", verified: true, evidence: '2 in a 100-doc sample' },
      p8: { signal: 'an agency filing a CORRECTION to its own earlier notice, unforced', field: "action matching /correction/", verified: true, evidence: '2 in a 100-doc sample' },
      p9: { signal: 'comment closes within days and no outcome is determined yet', field: 'comments_close_on within 7 days', verified: true, evidence: '28 closing this week' },
      p10: { signal: 'a FINAL rule now in force: what the new normal actually is', field: 'type=RULE', verified: true, evidence: '284 final rules in 30d' }
      // P3 absent: a closing deadline is not a fracture, and nothing in the record marks a rule
      //   as breaking an established pattern. Calling "significant" a fracture would be forcing.
      // P5, P6, P7, P7b absent: no signal for endurance, coordination or separation.
    }
  },

  // ── MEDICINE — openFDA ────────────────────────────────────────────────────
  medicine: {
    source: 'openFDA drug shortages + enforcement',
    phases: {
      p0: { signal: 'every drug currently in FDA-recorded shortage', field: 'status=Current', verified: true, evidence: '73 drugs, 1,175 records' },
      p1: { signal: 'your drug first appears on the shortage list', field: 'generic_name first match, status=Current', verified: true, evidence: 'per-drug search live' },
      p2: { signal: 'the recurring recall and shortage briefing for what you stock', field: 'enforcement report_date flow', verified: true, evidence: 'daily source' },
      p8: { signal: 'a firm recalling its OWN product before being made to', field: 'voluntary_mandated="Voluntary: Firm initiated"', verified: true, evidence: '17,752 voluntary vs 29 FDA-mandated' },
      p10: { signal: 'a shortage that has RESOLVED: the new settled state', field: 'status=Resolved', verified: true, evidence: '25 resolved' }
      // P3 absent: shortage records carry no severity trajectory, so "the pattern broke" cannot
      //   be read from them without inventing a threshold.
      // P4 absent pending check: temporary importation would be genuine external scaffolding,
      //   but it is not a structured field, only free text in shortage_reason.
      // P9 absent: no field expresses a poised, still-open outcome.
    }
  },

  // ── TECHNOLOGY — CISA Known Exploited Vulnerabilities ─────────────────────
  technology: {
    source: 'CISA KEV catalog',
    phases: {
      p0: { signal: 'the full catalogue of flaws with confirmed exploitation', field: 'full KEV', verified: true, evidence: '1,653 entries' },
      p1: { signal: 'something you run enters the exploited catalogue for the first time', field: 'dateAdded, matched to your vendor/product', verified: true, evidence: '26 added in 30d' },
      p2: { signal: 'the recurring exposure brief across your stack', field: 'per-vendor rollup', verified: true, evidence: 'per-vendor search live' },
      p3: { signal: 'a flaw you run gains ransomware linkage: the risk pattern changed', field: 'knownRansomwareCampaignUse', verified: true, evidence: '332 ransomware-linked' },
      p9: { signal: 'past the federal fix-by date and still unfixed: maximal exposure, outcome open', field: 'dueDate in the past', verified: true, evidence: '381 overdue' }
      // P10 absent, and this one is worth stating: KEV has NO "fixed" state. There is no field
      //   that says a flaw was remediated, so a renewal rung here would be fabricated.
      // P4, P5, P6, P7, P8 absent: no signal.
    }
  }

};

/** Phases a domain can genuinely deliver, in arc order. */
function phasesFor(domain) {
  var d = MAP[String(domain || '').toLowerCase()];
  if (!d) return [];
  var order = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p7b', 'p8', 'p9', 'p10'];
  return order.filter(function (p) { return d.phases[p]; })
              .map(function (p) { return Object.assign({ phase: p }, d.phases[p]); });
}

function get(domain, phase) {
  var d = MAP[String(domain || '').toLowerCase()];
  if (!d) return null;
  return d.phases[String(phase || '').toLowerCase()] || null;
}

/** Domains mapped so far. The rest are not yet surveyed and must not be sold on phase claims. */
function mapped() { return Object.keys(MAP); }

module.exports = { MAP: MAP, phasesFor: phasesFor, get: get, mapped: mapped };
