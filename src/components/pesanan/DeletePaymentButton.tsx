'use client'

import { useState } from 'react'
import { deletePembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'

interface DeletePaymentButtonProps {
  pembayaranId: string
  pesananId: string
}

export function DeletePaymentButton({ pembayaranId, pesananId }: DeletePaymentButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setError(null)
    setLoading(true)
    const result = await deletePembayaran(pembayaranId, pesananId)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
      >
        Hapus
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </span>
  )
}
