/**
 * domain-console-v2.js — authoritative brain-v2 renderer for every domain console.
 *
 * Reads the persisted, bounded /api/domain-brain projection. It does not instantiate the
 * legacy browser brain and does not recompute diagnoses in the browser.
 */
(function () {
  'use strict';

  var iso = window.LIMENDomainIsolator;
  if (!iso || !iso.isDomainScoped()) return;

  var domain = iso.getResolvedKey ? iso.getResolvedKey() : iso.getActiveDomain();
  var label = iso.getDomainLabel ? iso.getDomainLabel() : domain;
  var target = null;
  var timer = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function num(value, digits) {
    return typeof value === 'number' && isFinite(value) ? value.toFixed(digits == null ? 2 : digits) : '—';
  }

  function when(value) {
    if (typeof value !== 'number') return 'not yet recorded';
    try { return new Date(value).toLocaleString(); } catch (e) { return 'unknown'; }
  }

  function badge(text, color) {
    return '<span style="display:inline-block;border:1px solid '+color+'66;color:'+color+
      ';padding:2px 7px;border-radius:2px;font-size:.28rem;letter-spacing:1px">'+esc(text)+'</span>';
  }

  function card(title, value, note, color) {
    return '<div style="border:1px solid rgba(201,169,78,.13);background:rgba(8,9,12,.58);padding:10px;min-height:70px">'+
      '<div style="font-size:.25rem;letter-spacing:1.4px;color:#807868">'+esc(title)+'</div>'+
      '<div style="font-size:.66rem;color:'+(color||'#e8e3d9')+';margin:4px 0">'+esc(value)+'</div>'+
      '<div style="font-size:.28rem;color:rgba(200,195,184,.48);line-height:1.45">'+esc(note||'')+'</div></div>';
  }

  function section(title, body) {
    return '<section style="margin-top:14px"><div style="font-size:.29rem;letter-spacing:2px;color:#C9A94E;'+
      'border-bottom:1px solid rgba(201,169,78,.18);padding-bottom:5px;margin-bottom:8px">'+esc(title)+'</div>'+body+'</section>';
  }

  function operatorFocus(data) {
    var read = data.state || {};
    var state = read.state || {};
    var dys = read.dysregulation || {};
    var findings = read.findings || [];
    var blind = read.blind || [];
    if (!data.ok) return 'The last brain-v2 cycle failed. Inspect the recorded error before using this domain read.';
    if (!data.ready) return 'Wait for the next persisted brain-v2 cycle; there is no measured readout yet.';
    if (state.abstained) {
      return blind.length
        ? 'Restore or verify the blind channels first: the brain withheld a fused state because the evidence was insufficient.'
        : 'The brain withheld a fused state. Inspect the stated abstention before drawing a domain conclusion.';
    }
    if (findings.length) {
      return 'Investigate the evidence behind ' + findings.map(function (f) { return f.id; }).join(', ') +
        ' and verify the named trigger channels before taking an operator action.';
    }
    if (dys.detected) {
      return 'The fused state is outside its declared regulation band without a declared finding. Review the strongest drivers and the unmapped evidence.';
    }
    return 'No declared finding fired in the latest measured cycle. Monitor the strongest departures and any relationship disagreement.';
  }

  function renderSensors(read) {
    var sensors = (read && read.sensors) || [];
    if (!sensors.length) return '<div style="color:#807868;font-size:.32rem">No sensor summary in this cycle.</div>';
    var rows = sensors.map(function (s) {
      var z = s.departure && typeof s.departure.z === 'number' ? num(s.departure.z, 2)+'σ' : '—';
      var col = s.fusable ? '#5ab5a0' : '#e8954e';
      return '<tr><td>'+esc(s.key||'—')+'</td><td style="color:'+col+'">'+esc(s.fusable?'FUSABLE':(s.state||'BLIND'))+
        '</td><td>'+esc(z)+'</td><td>'+esc(s.liveness||'—')+'</td><td>'+esc(s.why||'')+'</td></tr>';
    }).join('');
    return '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:.29rem;line-height:1.5">'+
      '<thead><tr style="color:#807868;text-align:left"><th>CHANNEL</th><th>STATE</th><th>DEPARTURE</th><th>LIVENESS</th><th>WHY</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>';
  }

  function renderFindings(read) {
    var fired = (read && read.findings) || [];
    var candidates = (read && read.candidates) || [];
    var html = '';
    if (fired.length) {
      html += fired.map(function (f) {
        return '<div style="border-left:2px solid #e85454;padding:7px 9px;margin:5px 0;background:rgba(232,84,84,.05)">'+
          '<div style="font-size:.36rem;color:#e8e3d9">'+esc(f.id)+'</div>'+
          '<div style="font-size:.28rem;color:#a9a294">triggered by '+esc((f.triggeredBy||[]).join(', ')||'declared predicate')+
          (f.basis?' · '+esc(f.basis):'')+'</div></div>';
      }).join('');
    } else {
      html += '<div style="font-size:.32rem;color:#5ab5a0">No declared finding fired in the latest measured cycle.</div>';
    }
    var unevaluated = candidates.filter(function (c) { return c.triggerSource === 'unevaluated'; });
    if (unevaluated.length) {
      html += '<details style="margin-top:8px"><summary style="font-size:.29rem;color:#C9A94E;cursor:pointer">'+
        unevaluated.length+' finding(s) could not be evaluated</summary>'+
        '<div style="margin-top:6px">'+unevaluated.map(function (c) {
          return '<div style="font-size:.27rem;color:#807868;margin:3px 0">'+esc(c.id)+' · '+esc(c.why||'')+'</div>';
        }).join('')+'</div></details>';
    }
    return html;
  }

  function renderRelationships(data, read) {
    var cmp = data.relationships;
    var div = (read && read.divergence) || {};
    var html = '<div style="font-size:.31rem;color:#c8c3b8;margin-bottom:7px">'+
      esc(div.why || (cmp ? 'Cadence-aligned relationship evidence is available below.' : 'No relationships are declared for this domain.'))+
      '</div>';
    if (div.divergences && div.divergences.length) {
      html += div.divergences.map(function (d) {
        return '<div style="font-size:.29rem;border-left:2px solid #e8954e;padding:5px 8px;margin:4px 0">'+
          esc((d.channels||[]).join(' ↔ '))+' · '+esc(d.latent||'declared latent')+' · '+num(d.standardizedGap,2)+' se</div>';
      }).join('');
    }
    if (Array.isArray(cmp) && cmp.length) {
      html += '<details><summary style="font-size:.28rem;color:#807868;cursor:pointer">comparability evidence ('+cmp.length+')</summary>'+
        '<pre style="white-space:pre-wrap;font-size:.24rem;color:#807868">'+esc(JSON.stringify(cmp,null,2))+'</pre></details>';
    }
    return html;
  }

  function render(data) {
    if (!target) return;
    var read = data.state || null;
    var state = read && read.state || {};
    var dys = read && read.dysregulation || {};
    var fn = data.domainFunction || {};
    var obs = fn.observations || {};
    var predictions = data.predictions || {};
    var calibration = data.calibration || {};
    var measured = data.ok && data.ready && !state.abstained;
    var status = !data.ok ? badge('CYCLE ERROR','#e85454') :
      !data.ready ? badge('WAITING FOR V2 CYCLE','#e8954e') :
      state.abstained ? badge('ABSTAINED','#e8954e') : badge('MEASURED','#5ab5a0');

    var html = '<div style="font-family:IBM Plex Mono,monospace;color:#c8c3b8;padding:12px 14px 30px">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid rgba(201,169,78,.22);padding-bottom:10px">'+
      '<div><div style="font-size:.29rem;letter-spacing:2px;color:#807868">AUTHORITATIVE DOMAIN RUNTIME</div>'+
      '<div style="font-size:.74rem;letter-spacing:2px;color:#e8e3d9">'+esc(label.toUpperCase())+' · BRAIN V2</div>'+
      '<div style="font-size:.27rem;color:#807868;margin-top:4px">cycle '+esc(read&&read.cycle||'—')+' · '+esc(when(read&&read.cycleAt||data.finishedAt))+'</div></div>'+status+'</div>';

    html += section('OPERATOR FOCUS',
      '<div style="border:1px solid rgba(90,181,160,.25);background:rgba(90,181,160,.05);padding:10px;font-size:.34rem;line-height:1.6;color:#e8e3d9">'+
      esc(operatorFocus(data))+'</div>');

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:7px;margin-top:12px">'+
      card('FUSED DEPARTURE', state.abstained?'WITHHELD':num(state.departure,2)+'σ',
        state.why || 'precision-weighted departure from this domain’s own baselines', measured?'#5ab5a0':'#e8954e')+
      card('CONFIDENCE', num(state.confidence,2), 'reported by the brain-v2 fused state')+
      card('OBSERVATIONS', String(obs.admitted||0), String(obs.rejected||0)+' rejected this cycle')+
      card('FINDINGS', String((read&&read.findings||[]).length), dys.detected?'dysregulation detected':'latest declared predicates')+
      card('PREDICTIONS', String(predictions.open||0)+' open', String(predictions.resolved||0)+' resolved in restored registry')+
      card('CALIBRATION', calibration.status||'—', String(calibration.scoredOutcomes||calibration.outcomes||'—')+' scored outcomes')+
      '</div>';

    html += section('EVIDENCE CHANNELS', renderSensors(read));
    html += section('DECLARED FINDINGS', renderFindings(read));
    html += section('RELATIONSHIPS & DIVERGENCE', renderRelationships(data, read));

    var prov = data.provenance || {};
    html += section('RUN PROVENANCE',
      '<div style="font-size:.29rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:5px">'+
      '<div>rows applied <b>'+esc(data.rowsApplied==null?'—':data.rowsApplied)+'</b></div>'+
      '<div>channels read <b>'+esc(prov.channelsRead==null?'—':prov.channelsRead)+'</b></div>'+
      '<div>source identities <b>'+esc(prov.withObservationId==null?'—':prov.withObservationId)+'</b></div>'+
      '<div>runtime <b>'+esc(data.runtime||'brain-v2')+'</b></div></div>');

    if (data.error) html += section('CYCLE ERROR','<div style="font-size:.3rem;color:#e85454">'+esc(data.error)+'</div>');
    target.innerHTML = html;
  }

  function load() {
    fetch('/api/domain-brain?domain=' + encodeURIComponent(domain), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('brain-v2 read returned HTTP ' + response.status);
        return response.json();
      })
      .then(render)
      .catch(function (error) {
        if (!target) return;
        target.innerHTML = '<div style="padding:18px;color:#e85454;font-family:monospace">'+
          '<div style="font-size:.42rem">BRAIN V2 READ UNAVAILABLE</div>'+
          '<div style="font-size:.3rem;margin-top:8px">'+esc(error.message)+'</div></div>';
      });
  }

  function start() {
    target = document.getElementById('clarity-view');
    if (!target) return;
    target.innerHTML = '<div style="padding:20px;color:#807868;font-family:monospace">READING '+esc(label.toUpperCase())+' BRAIN V2…</div>';
    load();
    timer = setInterval(function () { if (!document.hidden) load(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.LIMENDomainConsoleV2 = {
    authority: 'brain-v2',
    domain: domain,
    refresh: load,
    stop: function () { if (timer) clearInterval(timer); }
  };
})();
