'use client'

import { useState } from 'react'
import { updatePengiriman } from '@/app/(app)/pesanan/actions'

interface PengirimanEditorProps {
  pesananId: string
  initialValue: string | null
}

/**
 * Owner-only text field for the courier/ekspedisi name (e.g. "Expedisi Jaya").
 * The saved value is written on the "Penerima," signature line of both the PDF
 * and the Epson receipt. Saves on blur, like TanggalPengirimanEditor.
 */
export function PengirimanEditor({ pesananId, initialValue }: PengirimanEditorProps) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function handleBlur() {
    const next = value.trim() || null
    if (next === (initialValue ?? null)) return
    setSaving(true)
    await updatePengiriman(pesananId, next)
    setSaving(false)
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={saving}
      placeholder="mis. Expedisi Jaya"
      className="border rounded-md px-2 py-1 text-sm h-8 disabled:opacity-50"
      aria-label="Pengiriman"
    />
  )
}
