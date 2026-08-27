'use client'

import { useState } from 'react'
import { updateColly } from '@/app/(app)/pesanan/actions'
import { usePropSyncedState } from '@/hooks/use-prop-synced-state'
import { setErrorFromResult } from '@/lib/action-result'

interface CollyEditorProps {
  pesananId: string
  initialValue: number | null
  locked?: boolean
}

/**
 * Owner-only package count, saved on blur like PengirimanEditor. The value is
 * printed next to the courier name on the signature line of both documents:
 * "Exp. Expedisi Jaya ( 3 colly )".
 *
 * The raw input text is held as a string (not a number) — `Number('')` is 0,
 * which re-renders the field as "0" and makes the next mobile keystroke append
 * instead of replace.
 */
export function CollyEditor({ pesananId, initialValue, locked }: CollyEditorProps) {
  const [value, setValue] = usePropSyncedState(initialValue, (v) =>
    v ? String(v) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBlur() {
    const parsed = parseInt(value, 10)
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    // Normalise the field to what will actually be stored ("0"/"abc" -> blank).
    setValue(next ? String(next) : '')
    if (next === initialValue) return
    setSaving(true)
    setError(null)
    // Surfaced rather than swallowed: a silently dropped save looks identical to
    // a value that saved fine but never prints.
    const result = await updateColly(pesananId, next)
    setErrorFromResult(result, setError)
    setSaving(false)
  }

  return (
    <>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={saving || locked}
        placeholder="mis. 3"
        className="border rounded-md px-2 py-1 text-sm h-8 w-20 disabled:opacity-50"
        aria-label="Colly"
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </>
  )
}
