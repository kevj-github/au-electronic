'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deletePesanan } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

interface DeletePesananButtonProps {
  pesananId: string
}

export function DeletePesananButton({ pesananId }: DeletePesananButtonProps) {
  const router = useRouter()

  return (
    <ConfirmDeleteButton
      renderTrigger={
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 shrink-0"
          aria-label="Hapus pesanan"
        />
      }
      triggerLabel={<Trash2 className="size-3.5" />}
      title="Hapus pesanan?"
      description="Semua barang dan pembayaran terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan."
      action={() => deletePesanan(pesananId)}
      onSuccess={() => router.refresh()}
    />
  )
}
