'use client'

import { memo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { setItemJumlahDiambil } from '@/app/(app)/pesanan/item-mutation-actions'
import { useOptimisticAction } from '@/hooks/use-optimistic-action'
import { usePropSyncedState } from '@/hooks/use-prop-synced-state'

interface HelperItemChecklistProps {
  itemId: string
  qty: number
  jumlahDiambil: number
  disabled?: boolean
}

function HelperItemChecklistImpl({ itemId, qty, jumlahDiambil, disabled = false }: HelperItemChecklistProps) {
  const { value, commit: commitValue, loading } = useOptimisticAction(jumlahDiambil, (next) =>
    setItemJumlahDiambil(itemId, next)
  )
  // The typed text is its own state, not derived from `value`: while the user
  // is mid-edit it can be an intermediate string `value` can't represent
  // (e.g. "1" en route to "15"). Resynced to the server value the same way
  // `value` is (see usePropSyncedState), and explicitly set again on commit
  // below so it reflects the just-submitted number immediately.
  const [inputValue, setInputValue] = usePropSyncedState(jumlahDiambil, (v) =>
    v > 0 ? String(v) : ''
  )

  const checked = qty > 0 && value >= qty

  async function commit(next: number) {
    const clamped = Math.max(0, Math.min(next, qty))
    setInputValue(clamped > 0 ? String(clamped) : '')
    await commitValue(clamped)
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

/**
 * Memoised for the same reason as `ItemChecklistCheckbox`: the parent owns the
 * price inputs, so every keystroke re-rendered each row's picker — including
 * the local `inputValue` state a helper may be mid-edit in. All props are
 * primitives, so the default shallow comparison applies.
 */
export const HelperItemChecklist = memo(HelperItemChecklistImpl)
