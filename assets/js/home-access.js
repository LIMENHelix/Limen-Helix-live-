(function () {
  'use strict';
  var overlay = document.getElementById('ov');
  var trigger = document.getElementById('operator-open');
  var previousFocus = null;
  trigger.addEventListener('click', function () {
    overlay.classList.add('show');
    document.getElementById('ovPw').focus();
  });
  // Keep keyboard navigation within the existing access dialog while it is open.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab' || !overlay.classList.contains('show')) return;
    var controls = overlay.querySelectorAll('button, input');
    var first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  new MutationObserver(function () {
    if (overlay.classList.contains('show')) {
      previousFocus = overlay.contains(document.activeElement) ? trigger : document.activeElement;
    } else {
      (previousFocus && previousFocus !== document.body ? previousFocus : trigger).focus();
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
})();
