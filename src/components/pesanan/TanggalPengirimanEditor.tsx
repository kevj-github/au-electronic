'use client'

import { useState } from 'react'
import { updateTanggalPengiriman } from '@/app/(app)/pesanan/order-lifecycle-actions'
import { usePropSyncedState } from '@/hooks/use-prop-synced-state'

interface TanggalPengirimanEditorProps {
  pesananId: string
  initialValue: string | null
  locked?: boolean
}

export function TanggalPengirimanEditor({ pesananId, initialValue, locked }: TanggalPengirimanEditorProps) {
  const [value, setValue] = usePropSyncedState(initialValue, (v) => v ?? '')
  const [saving, setSaving] = useState(false)

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
