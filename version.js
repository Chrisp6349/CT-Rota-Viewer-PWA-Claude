/**
 * version.js
 * ----------
 * THE single source of truth for the app version.
 *
 * Bump this ONE number when releasing a change. It drives:
 *   - the version shown in the footer (index.html)
 *   - the service worker's cache name, which is what makes devices
 *     fetch the new files instead of serving the old cached ones
 *
 * `self` works in both a normal page (where it equals window) and
 * inside the service worker (where window doesn't exist), which is
 * what lets both share this file.
 */

self.APP_VERSION = "3.2.1";
