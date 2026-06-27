'use client'

import { useState } from 'react'
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

interface ClearAllButtonProps {
  label: string
  description: string
  action: () => Promise<{ error?: string } | undefined>
}

export function ClearAllButton({ label, description, action }: ClearAllButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) { setStep(1); setError(null) }
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    const result = await action()
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    setOpen(false)
    setStep(1)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{label}?</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={() => setStep(2)}>
                Lanjutkan
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Terakhir</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini <strong>tidak dapat dibatalkan</strong>. Semua data akan hilang permanen.
                Apakah Anda benar-benar yakin?
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className="text-sm text-red-500 px-1">{error}</p>}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStep(1)} disabled={loading}>
                Batal
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
