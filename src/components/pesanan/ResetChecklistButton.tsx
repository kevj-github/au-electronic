'use client'

import { useState } from 'react'
import { resetChecklist } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ResetChecklistButtonProps {
  pesananId: string
  target: 'helper' | 'owner'
  label: string
  confirmTitle: string
  confirmDescription: string
}

export function ResetChecklistButton({
  pesananId,
  target,
  label,
  confirmTitle,
  confirmDescription,
}: ResetChecklistButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setLoading(true)
    setError(null)
    const result = await resetChecklist(pesananId, target)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setLoading(false)
    setOpen(false)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
          {label}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={loading}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}
