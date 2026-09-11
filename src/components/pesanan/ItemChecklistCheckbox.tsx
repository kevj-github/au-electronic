'use client'

import { memo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleItemDicekOwner } from '@/app/(app)/pesanan/item-mutation-actions'
import { useOptimisticAction } from '@/hooks/use-optimistic-action'

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
  const { value, commit, loading } = useOptimisticAction(checked, (next) =>
    toggleItemDicekOwner(itemId, next)
  )

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none py-1">
      <Checkbox
        checked={value}
        disabled={loading || disabled}
        onCheckedChange={(next) => commit(next === true)}
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
