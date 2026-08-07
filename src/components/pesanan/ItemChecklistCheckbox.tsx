'use client'

import { memo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleItemDicekOwner } from '@/app/(app)/pesanan/actions'

interface ItemChecklistCheckboxProps {
  itemId: string
  checked: boolean
  kind: 'owner'
  label: string
  disabled?: boolean
  showLabel?: boolean
}

function ItemChecklistCheckboxImpl({
  itemId,
  checked,
  label,
  disabled = false,
  showLabel = true,
}: ItemChecklistCheckboxProps) {
  const [prevChecked, setPrevChecked] = useState(checked)
  const [pending, setPending] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  // Adjust state during render (React-recommended pattern) instead of a useEffect
  // resync: any time the server-revalidated `checked` prop changes for any reason
  // — our own toggle confirming, or someone else's action (e.g. a checklist reset)
  // — drop the stale optimistic value immediately instead of trusting it just
  // because it happens to equal the old `checked`.
  if (checked !== prevChecked) {
    setPrevChecked(checked)
    setPending(null)
  }

  const value = pending ?? checked

  async function handleChange(next: boolean) {
    setPending(next)
    setLoading(true)
    const result = await toggleItemDicekOwner(itemId, next)
    if (result?.error) {
      setPending(null)
    }
    setLoading(false)
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none py-1">
      <Checkbox
        checked={value}
        disabled={loading || disabled}
        onCheckedChange={(next) => handleChange(next === true)}
        aria-label={label}
      />
      {showLabel && <span className="text-sm text-muted-foreground">{label}</span>}
    </label>
  )
}

/**
 * Memoised because `ItemsSection` owns the price-input state for every row, so
 * a single keystroke there re-renders the whole item list — and the list is
 * rendered twice over (a `sm:hidden` card list and a `hidden sm:block` table,
 * both always mounted). Without this, typing one digit re-rendered every
 * checkbox on the order, each re-running its render-phase optimistic-state
 * resync.
 *
 * Every prop is a primitive, so the default shallow comparison is correct and
 * no `useCallback` is needed at the call sites.
 */
export const ItemChecklistCheckbox = memo(ItemChecklistCheckboxImpl)
