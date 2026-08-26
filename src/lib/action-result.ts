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
