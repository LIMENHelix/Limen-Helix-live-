# Relay Admin Login Setup

The Relay marketplace now includes a secure admin authentication system for accessing the control panel from any page.

## Overview

- **Control Panel**: `/relay-marketplace-control.html` — main dashboard for marketplace owners
- **Admin Login Component**: `/relay-admin-login.html` — reusable login widget
- **Default Admin Key**: `relay-admin-demo` (set via `RELAY_ADMIN_KEY` env var)

## Setup

### 1. Environment Variable

Set your admin key in the Vercel environment variables:

```
RELAY_ADMIN_KEY=your-secure-admin-key
```

Default fallback (development): `relay-admin-demo`

### 2. Access Control Panel Directly

Navigate to `/relay-marketplace-control.html` and enter your admin key when prompted.

### 3. Add Admin Login to Other Pages

Include the admin login component on any Relay page to provide quick access to the control panel:

```html
<!-- In your Relay marketplace page <head> -->
<link rel="stylesheet" href="/relay-admin-login.html">

<!-- Or load the component inline in your page -->
<script>
  fetch('/relay-admin-login.html')
    .then(r => r.text())
    .then(html => {
      // Extract just the <script> and <style>
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Add styles
      const styles = doc.querySelectorAll('style');
      styles.forEach(s => document.head.appendChild(s.cloneNode(true)));
      
      // Add HTML
      const container = doc.querySelector('.admin-login-container');
      document.body.appendChild(container.cloneNode(true));
      const modal = doc.querySelector('.admin-login-modal');
      document.body.appendChild(modal.cloneNode(true));
      
      // Add script
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(s => {
        if (s.textContent && !s.src) {
          eval(s.textContent);
        }
      });
    });
</script>
```

Or simpler, just include it as an iframe (note: won't share sessionStorage):

```html
<iframe src="/relay-admin-login.html" style="border: none; width: 0; height: 0;"></iframe>
```

## API Endpoints

### Verify Admin Key

```
GET /api/relay-marketplace?action=verify-admin-key&key=YOUR_KEY
→ { ok: true/false }
```

### Admin-Protected Actions

All admin operations require passing the `key` parameter:

**GET requests:**
```
GET /api/relay-marketplace?action=marketplace-stats&marketplaceId=X&key=ADMIN_KEY
GET /api/relay-marketplace?action=list-payouts&marketplaceId=X&key=ADMIN_KEY
```

**POST requests:**
```
POST /api/relay-marketplace
{
  "action": "update-payout",
  "payoutId": "X",
  "status": "approved",
  "key": "ADMIN_KEY"
}
```

## Authentication Flow

1. User visits `/relay-marketplace-control.html`
2. Login modal appears if not authenticated
3. User enters admin key
4. Client verifies key with `/api/verify-admin-key` endpoint
5. On success, key is stored in `sessionStorage.relay-admin-key`
6. Control panel loads and displays marketplace data
7. All subsequent API calls include the stored key
8. Logout clears the session key

## Security Notes

- Admin key is stored in `sessionStorage` (cleared when browser tab closes)
- All admin operations are verified server-side (client-side storage is UI only)
- HTTPS should be enforced in production
- Use strong, random admin keys (not `relay-admin-demo`)
- Consider rotating keys periodically
