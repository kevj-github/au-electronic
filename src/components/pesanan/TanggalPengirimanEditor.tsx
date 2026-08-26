'use client'

import { useState } from 'react'
import { updateTanggalPengiriman } from '@/app/(app)/pesanan/actions'

interface TanggalPengirimanEditorProps {
  pesananId: string
  initialValue: string | null
  locked?: boolean
}

export function TanggalPengirimanEditor({ pesananId, initialValue, locked }: TanggalPengirimanEditorProps) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  // Drop the stale mount-time value when RealtimeRefresh pushes a fresh
  // initialValue from another device's save — a useState initialiser only
  // runs once, so without this the field (and a later blur) would keep
  // comparing against a value no longer on the server.
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue)
  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue)
    setValue(initialValue ?? '')
  }

  async function handleBlur() {
    const next = value || null
    if (next === (initialValue ?? null)) return
    setSaving(true)
    await updateTanggalPengiriman(pesananId, next)
    setSaving(false)
  }

  return (
    <input
      type="date"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={saving || locked}
      className="border rounded-md px-2 py-1 text-sm h-8 disabled:opacity-50"
      aria-label="Tanggal pengiriman"
    />
  )
}
