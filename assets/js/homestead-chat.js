/**
 * homestead-chat.js — on-page Homestead sales agent launcher.
 * Homestead Read + Economy hero only. No SMS, no voice.
 */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function track(event) {
    if (window.LIMEN_HOMESTEAD && window.LIMEN_HOMESTEAD.track) {
      window.LIMEN_HOMESTEAD.track(event);
    } else {
      try {
        fetch('/api/homestead-events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event: event })
        }).catch(function () {});
      } catch (e) {}
    }
  }

  function mount() {
    if (document.getElementById('hsChatRoot')) return;
    var root = document.createElement('div');
    root.id = 'hsChatRoot';
    root.innerHTML =
      '<button type="button" id="hsChatOpen" class="hs-chat-open" aria-haspopup="dialog">Ask Homestead</button>' +
      '<div id="hsChatPanel" class="hs-chat-panel" hidden>' +
        '<div class="hs-chat-head"><b>Homestead Desk</b>' +
          '<span>On-page only · not legal advice</span>' +
          '<button type="button" id="hsChatClose" class="hs-chat-x" aria-label="Close">×</button></div>' +
        '<div id="hsChatLog" class="hs-chat-log"></div>' +
        '<form id="hsChatForm" class="hs-chat-form">' +
          '<label class="visually-hidden" for="hsChatIn">Message</label>' +
          '<input id="hsChatIn" type="text" maxlength="800" placeholder="Homeowner, agent, or investor?" autocomplete="off" />' +
          '<button type="submit">Send</button>' +
        '</form>' +
        '<div class="hs-chat-foot">988 · 211 · hud.gov/findacounselor · we do not invent dates</div>' +
      '</div>';
    document.body.appendChild(root);

    var panel = document.getElementById('hsChatPanel');
    var log = document.getElementById('hsChatLog');
    var form = document.getElementById('hsChatForm');
    var input = document.getElementById('hsChatIn');
    var messages = [];

    function add(role, text, extra) {
      var d = document.createElement('div');
      d.className = 'hs-msg ' + role;
      d.innerHTML = '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
      if (extra && extra.route && extra.route.url) {
        var a = document.createElement('a');
        a.className = 'hs-msg-cta';
        a.href = extra.route.url;
        a.textContent = extra.route.label || 'Continue';
        if (extra.route.id === 'l1') {
          a.addEventListener('click', function () { track('checkout_start'); });
        }
        d.appendChild(a);
      }
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }

    function open() {
      panel.hidden = false;
      if (!messages.length) {
        add('bot', 'Homestead Desk. Educational only, not legal advice, and I will not invent an auction date.\n\nAre you a homeowner, an agent, or an investor? How soon is this?');
      }
      track('chat_open');
      try { input.focus(); } catch (e) {}
    }
    function close() { panel.hidden = true; }

    document.getElementById('hsChatOpen').addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });
    document.getElementById('hsChatClose').addEventListener('click', close);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      add('user', text);
      messages.push({ role: 'user', content: text });
      fetch('/api/homestead-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      }).then(function (r) { return r.json(); }).then(function (j) {
        var reply = (j && j.reply) || 'Could not reach the desk. Try again.';
        messages.push({ role: 'assistant', content: reply });
        add('bot', reply, j);
        if (j && j.qualified) track('chat_qualified');
      }).catch(function () {
        add('bot', 'Network error. The free Homestead Read still works on this page.');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
