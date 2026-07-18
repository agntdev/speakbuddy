// Injectable clock for time-based features. Tests can override `now` via
// `setClock()` to drive deterministic behavior (streaks, cutoffs, reminders).

let clockFn: () => Date = () => new Date();

/** Return the current time (injectable for tests). */
export function now(): Date {
  return clockFn();
}

/** Override the clock (test-only). Pass `undefined` to restore real time. */
export function setClock(fn?: () => Date): void {
  clockFn = fn ?? (() => new Date());
}
