'use strict';

/**
 * Single source of truth for the order lifecycle finite state machine.
 * Maps each status to the array of statuses it may legally transition to.
 * `delivered` and `cancelled` are terminal (empty arrays).
 */
const TRANSITIONS = Object.freeze({
  pending: Object.freeze(['paid', 'cancelled']),
  paid: Object.freeze(['shipped', 'cancelled']),
  shipped: Object.freeze(['delivered']),
  delivered: Object.freeze([]),
  cancelled: Object.freeze([]),
});

const ALL_STATUSES = Object.freeze(Object.keys(TRANSITIONS));

function isValidStatus(status) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, status);
}

function isLegalTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function getTransitionTable() {
  const table = {};
  for (const status of ALL_STATUSES) {
    table[status] = [...TRANSITIONS[status]].sort();
  }
  return table;
}

module.exports = {
  TRANSITIONS,
  ALL_STATUSES,
  isValidStatus,
  isLegalTransition,
  getTransitionTable,
};
