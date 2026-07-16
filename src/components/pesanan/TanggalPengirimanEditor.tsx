'use client'

import { useState } from 'react'
import { updateTanggalPengiriman } from '@/app/(app)/pesanan/actions'

interface TanggalPengirimanEditorProps {
  pesananId: string
  initialValue: string | null
}

export function TanggalPengirimanEditor({ pesananId, initialValue }: TanggalPengirimanEditorProps) {
  const [value, setValue] = useState(initialValue ?? '')
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
      disabled={saving}
      className="border rounded-md px-2 py-1 text-sm h-8 disabled:opacity-50"
      aria-label="Tanggal pengiriman"
    />
  )
}
