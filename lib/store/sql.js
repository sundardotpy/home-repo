// Shared SQL plumbing for the store modules: error mapping and the "no rows" case.

import { conflict, invalid, notFound } from '../errors.js';

/**
 * Translate a driver error into a sentinel using Postgres SQLSTATE values.
 */
export function mapErr(err) {
  if (!err) return err;
  switch (err.code) {
    case '23505': return conflict(err.constraint ?? ''); // unique_violation
    case '23503': return notFound(err.constraint ?? ''); // foreign_key_violation
    case '23514': return invalid(err.constraint ?? '');  // check_violation
    default: return err;
  }
}

/** Throws not-found when a query returns no rows. */
export function one(result) {
  if (!result.rows || result.rows.length === 0) throw notFound();
  return result.rows[0];
}

/** Same, but with the caller's own context in the error. */
export function oneOr(result, detail) {
  if (!result.rows || result.rows.length === 0) throw notFound(detail);
  return result.rows[0];
}
