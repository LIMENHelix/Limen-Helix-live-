'use strict';

/** Convert persisted headline-title sets into ledger observations. */

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }

function assemble(titleSets, domain) {
  var observations = [];
  var abstentions = [];
  list(titleSets).forEach(function (set, setIndex) {
    if (!set || !text(set.t) || !text(set.f) || !text(set.hh) || !Array.isArray(set.items)) {
      abstentions.push({ index: setIndex, reason: 'title_set_missing_record_identity' });
      return;
    }
    set.items.forEach(function (item, itemIndex) {
      var hasIdentity = item && text(item.au);
      var hasTime = item && text(item.pa);
      var hasPublisher = item && text(item.pl);
      var hasTitle = item && text(item.ti);
      if (!hasIdentity || !hasTime || !hasPublisher || !hasTitle) {
        abstentions.push({ setIndex: setIndex, itemIndex: itemIndex, reason: 'title_missing_url_time_publisher_or_text' });
        return;
      }
      observations.push({
        sourceIdentity: {
          kind: 'headline-title',
          value: String(domain || set.d || 'unknown') + ':' + set.f + ':' + set.hh + ':' + (item.i == null ? itemIndex : item.i)
        },
        sourceRecordId: item.au,
        canonicalUrl: item.au,
        recordedAt: set.t,
        sourceUpdatedAt: item.pa,
        title: item.ti,
        publisher: item.pl,
        feedName: set.f,
        contentKind: set.ck || 'headline_title',
        publisherLabel: item.pl,
        publisherIndependence: 'unassessed'
      });
    });
  });
  return { observations: observations, abstentions: abstentions };
}

module.exports = { assemble: assemble };
