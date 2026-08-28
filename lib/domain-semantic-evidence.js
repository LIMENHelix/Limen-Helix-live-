'use strict';

/** Convert one domain's persisted headline-title sets into ledger observations. */

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (text(value)) {
    var parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function assemble(titleSets, domain) {
  var observations = [];
  var abstentions = [];
  list(titleSets).forEach(function (set, setIndex) {
    var recordedAt = set && timestamp(set.t);
    if (!set || !recordedAt || !text(set.f) || set.hh == null || !Array.isArray(set.items)) {
      abstentions.push({ index: setIndex, reason: 'title_set_missing_record_identity' });
      return;
    }
    set.items.forEach(function (item, itemIndex) {
      var hasIdentity = item && text(item.au);
      var sourceUpdatedAt = item && timestamp(item.pa);
      // `pl` is the publisher label supplied by the feed. If that tag is
      // absent, the feed name remains a label, not an independence verdict.
      var hasPublisher = item && (text(item.pl) || text(set.f));
      var hasTitle = item && text(item.ti);
      if (!hasIdentity || !hasPublisher || !hasTitle) {
        abstentions.push({ setIndex: setIndex, itemIndex: itemIndex, reason: 'title_missing_url_publisher_or_text' });
        return;
      }
      observations.push({
        sourceIdentity: {
          kind: 'headline-title',
          value: String(domain || set.d || 'unknown') + ':' + set.f + ':' + String(set.hh) + ':' + (item.i == null ? itemIndex : item.i)
        },
        // `au` is the aggregator's per-item redirect. It is a durable record
        // identity and usable retrieval URL, but it is not a publisher-issued
        // canonical URL. Keep that distinction explicit across the bridge.
        sourceRecordId: item.au,
        aggregatorItemUrl: item.au,
        canonicalUrl: null,
        recordedAt: recordedAt,
        sourceUpdatedAt: sourceUpdatedAt,
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
