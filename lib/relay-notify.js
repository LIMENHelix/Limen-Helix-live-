/**
 * relay-notify.js — tell the operator, once, that an order needs placing by hand.
 *
 * WHY THIS IS RELAY'S OWN SENDER AND NOT lib/crm-send.
 * The firewall (scripts/test-relay-firewall.js, F1) allows core Relay to import Relay
 * modules, node builtins and lib/limen-db, and nothing else. crm-send is outside that line.
 * Punching a hole in the firewall for an email would be a worse trade than the dozen lines
 * of Resend POST duplicated here: the firewall exists so Relay cannot grow tendrils into
 * the rest of the system, and an alert is not a good enough reason to start.
 *
 * WHAT IT CARRIES, and why that is correct here. The supplier URL, the variant, the
 * quantity, the authorised maximum cost, and the buyer's full shipping address. That is
 * internal detail and customer PII, and it is exactly what a human needs to place the order
 * at CJ by hand. It is safe only because it goes to ONE operator address and nowhere else,
 * so the recipient list is the whole control. This is the opposite of the customer-facing
 * refusal text, which must leak none of it.
 *
 * FAILS SILENT, ALWAYS. The manual task is the durable record; this is a convenience on top
 * of it. A missing key, a missing address or a Resend outage must never turn a filed task
 * into a failed one, because the task is what stops a paid order going quiet.
 */
const FROM = () => process.env.RELAY_NOTIFY_FROM || '';
const TO = () => process.env.RELAY_NOTIFY_TO || '';
const KEY = () => process.env.RESEND_API_KEY || '';

function configured() { return !!(FROM() && TO() && KEY()); }

function _money(n) {
  const v = parseFloat(n);
  return isFinite(v) ? '$' + v.toFixed(2) : 'unknown';
}

function _addr(a) {
  if (!a || typeof a !== 'object') return 'NO ADDRESS ON THE TASK — do not ship blind';
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postalCode].filter(Boolean).join(', '),
    a.country
  ].filter(Boolean).join('\n');
}

/**
 * The body a human can work from without opening anything else. Deliberately plain text:
 * this gets read on a phone, at speed, and the only thing that matters is that the variant
 * and the address are unambiguous.
 */
function buildBody(task, consoleUrl) {
  return [
    'A Relay order needs placing at the supplier by hand.',
    '',
    'WHAT TO ORDER',
    '  product   ' + (task.sourceUrl || 'no source URL on the task'),
    '  variant   ' + (task.sourceId || 'NOT RECORDED — check the listing before ordering'),
    '  item      ' + (task.title || '(untitled)'),
    '  quantity  ' + (task.quantity || 1),
    '  do not pay more than ' + _money(task.maxCost),
    '',
    'SHIP TO',
    _addr(task.shipTo).split('\n').map(function (l) { return '  ' + l; }).join('\n'),
    '',
    'WHY IT STOPPED',
    '  ' + (task.reason || 'no reason recorded'),
    '',
    'WHEN YOU HAVE ORDERED IT',
    '  Close the task in the console with the supplier order number, or it stays on the',
    '  attention count forever.',
    '  task    ' + (task.id || 'unknown'),
    '  order   ' + (task.orderId || 'unknown'),
    consoleUrl ? '  console ' + consoleUrl : ''
  ].filter(function (l) { return l !== ''; }).join('\n');
}

/**
 * Send, or decline quietly. Returns a small report so a caller that wants to log it can,
 * and never throws.
 */
async function notifyManualTask(task, opts) {
  opts = opts || {};
  try {
    if (!task || !task.id) return { sent: false, reason: 'no task' };
    if (!configured()) {
      return { sent: false, reason: 'not configured (RELAY_NOTIFY_TO / RELAY_NOTIFY_FROM / RESEND_API_KEY)' };
    }
    const subject = 'Relay: order needs hand-placing — ' + _money(task.maxCost) +
                    ', ' + (task.quantity || 1) + ' item' + ((task.quantity || 1) === 1 ? '' : 's');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM(),
        to: [TO()],
        subject: subject,
        text: buildBody(task, opts.consoleUrl)
      })
    });
    if (!r || !r.ok) {
      return { sent: false, reason: 'resend rejected it: ' + ((r && r.status) || 'no response') };
    }
    return { sent: true, to: TO() };
  } catch (e) {
    return { sent: false, reason: 'send failed: ' + (e && e.message) };
  }
}

module.exports = { notifyManualTask, buildBody, configured };
