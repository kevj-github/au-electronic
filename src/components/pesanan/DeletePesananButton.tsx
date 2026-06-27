'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import { deletePesanan } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'

interface DeletePesananButtonProps {
  pesananId: string
}

export function DeletePesananButton({ pesananId }: DeletePesananButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const result = await deletePesanan(pesananId)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? '...' : 'Hapus'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 shrink-0"
      onClick={() => setConfirming(true)}
      aria-label="Hapus pesanan"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}
