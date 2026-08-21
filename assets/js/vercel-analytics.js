/**
 * Vercel Web Analytics Integration
 * 
 * This module initializes Vercel Web Analytics for the site.
 * It uses the @vercel/analytics package to inject the analytics script.
 * 
 * Usage: Include this script in your HTML files:
 * <script type="module" src="/assets/js/vercel-analytics.js"></script>
 */

import { inject } from '../../node_modules/@vercel/analytics/dist/index.mjs';

// Initialize Vercel Web Analytics
inject({
  mode: 'auto',  // Automatically detect development vs production
  debug: false   // Set to true for debug logging
});
