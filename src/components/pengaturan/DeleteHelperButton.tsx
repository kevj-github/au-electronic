'use client'

import { useState } from 'react'
import { deleteHelper } from '@/app/(app)/pengaturan/actions'

interface DeleteHelperButtonProps {
  userId: string
}

export function DeleteHelperButton({ userId }: DeleteHelperButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Hapus akun helper ini? Tindakan ini tidak dapat dibatalkan.')) {
      return
    }
    setError(null)
    setLoading(true)
    const result = await deleteHelper(userId)
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
