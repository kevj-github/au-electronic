'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deletePelanggan } from '@/app/(app)/pelanggan/actions'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

interface DeletePelangganButtonProps {
  pelangganId: string
}

export function DeletePelangganButton({ pelangganId }: DeletePelangganButtonProps) {
  const router = useRouter()

  return (
    <ConfirmDeleteButton
      renderTrigger={
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive shrink-0"
          aria-label="Hapus pelanggan"
        />
      }
      triggerLabel={<Trash2 className="size-3.5" />}
      title="Hapus pelanggan?"
      description="Data pelanggan akan dihapus. Pesanan yang terkait akan tetap ada dengan nama pelanggan tersimpan."
      action={() => deletePelanggan(pelangganId)}
      onSuccess={() => router.refresh()}
    />
  )
}
