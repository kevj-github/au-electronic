'use client'

import { deletePembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

interface DeletePaymentButtonProps {
  pembayaranId: string
}

export function DeletePaymentButton({ pembayaranId }: DeletePaymentButtonProps) {
  return (
    <ConfirmDeleteButton
      renderTrigger={
        <button
          type="button"
          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
        />
      }
      triggerLabel="Hapus"
      title="Hapus pembayaran ini?"
      description="Tindakan ini tidak dapat dibatalkan."
      action={() => deletePembayaran(pembayaranId)}
    />
  )
}
