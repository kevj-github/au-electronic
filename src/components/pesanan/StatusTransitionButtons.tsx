'use client'

import { useState } from 'react'
import { updateStatusPesanan } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
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
import type { StatusPesanan } from '@/lib/types'

interface StatusTransitionButtonsProps {
  pesananId: string
  nextStatuses: StatusPesanan[]
  statusLabel: Record<StatusPesanan, string>
}

// What each transition means, so the confirmation spells out the consequence.
const confirmCopy: Record<StatusPesanan, { title: string; description: string }> = {
  selesai: {
    title: 'Tandai pesanan sebagai selesai?',
    description:
      'Pesanan yang selesai akan terkunci — item dan checklist tidak bisa diubah sampai pesanan dibuka kembali.',
  },
  dibatalkan: {
    title: 'Batalkan pesanan ini?',
    description:
      'Pesanan yang dibatalkan akan terkunci — item dan checklist tidak bisa diubah sampai pesanan dibuka kembali.',
  },
  diproses: {
    title: 'Buka kembali pesanan ini?',
    description:
      'Status kembali ke "diproses" dan pesanan bisa diedit lagi.',
  },
}

function ConfirmStatusButton({
  pesananId,
  status,
  label,
}: {
  pesananId: string
  status: StatusPesanan
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDestructive = status === 'dibatalkan'
  const copy = confirmCopy[status]

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) setError(null)
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    const result = await updateStatusPesanan(pesananId, status)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            size="sm"
          />
        }
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-red-500 px-1">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function StatusTransitionButtons({
  pesananId,
  nextStatuses,
  statusLabel,
}: StatusTransitionButtonsProps) {
  return (
    <div className="flex gap-2">
      {nextStatuses.map((next) => (
        <ConfirmStatusButton
          key={next}
          pesananId={pesananId}
          status={next}
          label={statusLabel[next]}
        />
      ))}
    </div>
  )
}
