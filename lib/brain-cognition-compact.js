'use strict';

function num(value) {
  return typeof value === 'number' ? value : null;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function val(value) {
  return value != null ? value : null;
}

// Domain brains may represent the review gate as either a boolean or a list of
// review items. An empty list means that no review is required; Boolean([])
// would incorrectly inhibit every such domain at the transport boundary.
function reviewRequired(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

function compact(cognition) {
  if (!cognition || typeof cognition !== 'object') return null;
  var model = cognition.model || {};
  var immune = cognition.immune || {};
  var awareness = cognition.awareness || {};
  var conscience = cognition.conscience || {};
  var intuition = cognition.intuition || {};

  return {
    domain: cognition.domain || null,
    model: {
      cycle: num(model.cycle),
      predictionError: num(model.predictionError),
      predictedStress: num(model.predictedStress),
      regulation: val(model.regulation && typeof model.regulation === 'object'
        ? model.regulation.state
        : model.regulation)
    },
    immune: {
      immuneState: val(immune.immuneState),
      severity: num(immune.severity),
      antigenCount: arr(immune.antigens).length,
      quarantines: val(immune.quarantines),
      blockedFromTraversal: val(immune.blockedFromTraversal)
    },
    awareness: {
      selfNarrative: val(awareness.selfNarrative),
      humanReviewRequired: reviewRequired(awareness.humanReviewRequired)
    },
    conscience: {
      conscienceState: val(conscience.conscienceState),
      artifactReadinessDecision: val(conscience.artifactReadinessDecision),
      blockedClaims: arr(conscience.blockedClaims).slice(0, 4)
    },
    intuition: {
      hunches: arr(intuition.hunches).slice(0, 3)
    }
  };
}

module.exports = {
  compact: compact,
  reviewRequired: reviewRequired
};
