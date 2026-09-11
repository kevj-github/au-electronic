/**
 * `FormData.get()` returns `FormDataEntryValue | null` (`string | File | null`),
 * but every Server Action reading a plain text field used to blind-cast the
 * result `as string` — a lie when the field is missing (null) or the form
 * somehow submitted a File for that name. The cast makes TypeScript treat it
 * as a definite string either way, so a typo'd field name silently becomes
 * `undefined as string` at the call site instead of a caught error.
 *
 * Reads a text field, returning `''` for a missing/non-string entry — safe
 * for fields already guarded by an `if (!value)` required-field check.
 */
export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/**
 * Same as `getFormString`, but returns `null` instead of `''` for a
 * missing/non-string entry — for fields where "absent" is meaningfully
 * different from "present but blank" (e.g. `upsertPelanggan`'s optional
 * `id`, which selects the insert vs. update branch).
 */
export function getFormStringOrNull(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  return typeof value === 'string' ? value : null
}
