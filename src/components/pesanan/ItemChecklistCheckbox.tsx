'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleItemDiambil, toggleItemDicekOwner } from '@/app/(app)/pesanan/actions'

interface ItemChecklistCheckboxProps {
  itemId: string
  pesananId: string
  checked: boolean
  kind: 'helper' | 'owner'
  label: string
}

export function ItemChecklistCheckbox({
  itemId,
  pesananId,
  checked,
  kind,
  label,
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
    const result = kind === 'owner'
      ? await toggleItemDicekOwner(itemId, pesananId, next)
      : await toggleItemDiambil(itemId, pesananId, next)
    if (result?.error) {
      setPending(null)
    }
    setLoading(false)
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none py-1">
      <Checkbox
        checked={value}
        disabled={loading}
        onCheckedChange={(next) => handleChange(next === true)}
        aria-label={label}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </label>
  )
}
