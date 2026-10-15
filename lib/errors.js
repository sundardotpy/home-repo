// Sentinel errors the API layer maps onto HTTP status codes.
//
// Each sentinel carries its context through `decorate` and `kindOf` below.

export class StoreError extends Error {
  constructor(kind, detail = '') {
    super(detail ? `${kind}: ${detail}` : kind);
    this.name = 'StoreError';
    this.kind = kind;
    this.detail = detail;
  }
}

export const ErrNotFound = 'not found';
export const ErrConflict = 'conflict';
export const ErrNotEmpty = 'not empty';
export const ErrCycle = 'would create a cycle';
export const ErrInvalid = 'invalid';
export const ErrRoomCross = 'storage unit belongs to a different room';

export function notFound(detail = '') {
  return new StoreError(ErrNotFound, detail);
}

export function notEmpty(detail = '') {
  return new StoreError(ErrNotEmpty, detail);
}

export function conflict(detail = '') {
  return new StoreError(ErrConflict, detail);
}

export function invalid(detail = '') {
  return new StoreError(ErrInvalid, detail);
}

export function cycle(detail = '') {
  return new StoreError(ErrCycle, detail);
}

export function roomCross(detail = '') {
  return new StoreError(ErrRoomCross, detail);
}

/** True when err is (or reports) the given sentinel kind. */
export function isKind(err, kind) {
  return err instanceof StoreError && err.kind === kind;
}
