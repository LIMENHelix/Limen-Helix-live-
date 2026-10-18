/**
 * brain-v2/kernel/version.js — the one kernel version string.
 *
 * loop.js stamps restored state with it and packet.js uses it as the default
 * `sourceVersion`. Keeping one value means an internally generated ascending or
 * descending packet cannot claim an older kernel version than the process that
 * produced it after a version bump.
 */
'use strict';

var KERNEL_VERSION = 'brain-v2/kernel/1.0.1';

module.exports = { KERNEL_VERSION: KERNEL_VERSION };
