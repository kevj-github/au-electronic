'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { setItemJumlahDiambil } from '@/app/(app)/pesanan/actions'

interface HelperItemChecklistProps {
  itemId: string
  qty: number
  jumlahDiambil: number
  disabled?: boolean
}

export function HelperItemChecklist({ itemId, qty, jumlahDiambil, disabled = false }: HelperItemChecklistProps) {
  const [prevJumlah, setPrevJumlah] = useState(jumlahDiambil)
  const [pending, setPending] = useState<number | null>(null)
  const [inputValue, setInputValue] = useState(jumlahDiambil > 0 ? String(jumlahDiambil) : '')
  const [loading, setLoading] = useState(false)

  // Resync pattern (see ItemChecklistCheckbox): drop any stale optimistic value
  // the moment the server-revalidated jumlahDiambil prop changes for any reason.
  if (jumlahDiambil !== prevJumlah) {
    setPrevJumlah(jumlahDiambil)
    setPending(null)
    setInputValue(jumlahDiambil > 0 ? String(jumlahDiambil) : '')
  }

  const value = pending ?? jumlahDiambil
  const checked = qty > 0 && value >= qty

  async function commit(next: number) {
    const clamped = Math.max(0, Math.min(next, qty))
    setPending(clamped)
    setInputValue(clamped > 0 ? String(clamped) : '')
    setLoading(true)
    const result = await setItemJumlahDiambil(itemId, clamped)
    if (result?.error) setPending(null)
    setLoading(false)
  }

  function handleInputChange(raw: string) {
    if (raw === '') { setInputValue(''); return }
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    // Clamp while typing so the field can never display more than what was ordered.
    setInputValue(String(Math.max(0, Math.min(parsed, qty))))
  }

  function handleInputBlur() {
    const parsed = parseInt(inputValue, 10)
    commit(Number.isNaN(parsed) ? 0 : parsed)
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Checkbox
        checked={checked}
        disabled={loading || disabled}
        onCheckedChange={(next) => commit(next === true ? qty : 0)}
        aria-label="Diambil dari etalase"
      />
      <Input
        type="number"
        min="0"
        max={qty}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleInputBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
        }}
        disabled={loading || disabled}
        placeholder="0"
        aria-label="Jumlah diambil"
        className="h-7 w-14 text-xs text-right px-1.5"
      />
    </div>
  )
}
