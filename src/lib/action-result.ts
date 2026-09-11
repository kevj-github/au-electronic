/**
 * Shared return shape for Server Actions: an optional `error` plus whatever
 * success-only fields the action needs (e.g. `ActionResult<{ pesananId?: string }>`).
 *
 * Always use this instead of an ad hoc inline object type, and always name it
 * explicitly as the function's return type rather than relying on inference.
 * TypeScript only synthesises the implicit `error?: undefined` / `pesananId?:
 * undefined` members of an *inferred* return union when every return is a
 * fresh object literal. The moment one branch returns a guard's result
 * variable instead of a literal, the inferred union narrows and every
 * `result.error` at the call site becomes a compile error in an apparently
 * unrelated file. `npm run build` and `npm run typecheck` surface this;
 * `npm run test:run` and `npm run lint` do not.
 */
export type ActionResult<T extends object = object> = { error?: string } & T

/**
 * The ~10 call sites that display a Server Action's error all repeated
 * `if (result?.error) { setError(result.error); ... }` by hand — the same
 * `?.`-guarded read `require-owner.ts`'s callers were warned about
 * elsewhere, just for error display instead of authorization. Centralizing
 * it here means a future change to how a missing/malformed result is
 * treated only needs to happen once.
 *
 * Returns whether `result` was an error, so callers that need to bail out
 * write `if (setErrorFromResult(result, setError)) return`. Not used by
 * components that roll back optimistic state on error with nothing else to
 * show (`ItemChecklistCheckbox`, `HelperItemChecklist`) — but a component
 * *can* combine both: `useOptimisticAction`'s `commit` already rolls back on
 * error and also returns the result, so a caller that wants a visible message
 * too (`PesananLockToggle`) just passes that result straight through here.
 */
export function setErrorFromResult(
  result: { error?: string } | undefined,
  setError: (message: string | null) => void,
): boolean {
  if (result?.error) {
    setError(result.error)
    return true
  }
  return false
}
