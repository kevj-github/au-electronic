'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { setErrorFromResult, type ActionResult } from '@/lib/action-result'

interface ConfirmDeleteButtonProps {
  /** The element used as the trigger (a `Button` or plain `<button>`), styled by the caller — only its onClick/aria wiring is taken over. */
  renderTrigger: ReactElement
  /** Visible content of the trigger (icon and/or text). */
  triggerLabel: ReactNode
  title: string
  description: string
  confirmLabel?: string
  action: () => Promise<ActionResult | undefined>
  /** Called after a successful delete, e.g. `router.refresh()`. */
  onSuccess?: () => void
}

/**
 * Shared single-step confirmation dialog for row-level destructive actions
 * (delete one pelanggan/pesanan/helper/payment). Deliberately one step, unlike
 * `ClearAllButton`'s two-step dialog — that guards a bulk "delete everything"
 * action, a different risk tier than deleting one row.
 */
export function ConfirmDeleteButton({
  renderTrigger,
  triggerLabel,
  title,
  description,
  confirmLabel = 'Hapus',
  action,
  onSuccess,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(v: boolean) {
    if (loading) return
    setOpen(v)
    if (!v) setError(null)
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    const result = await action()
    setLoading(false)
    if (setErrorFromResult(result, setError)) return
    setOpen(false)
    onSuccess?.()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={renderTrigger}>{triggerLabel}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Menghapus...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
