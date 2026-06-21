'use client'

import { useState } from 'react'
import { createPembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format } from 'date-fns'

interface PaymentModalProps {
  pesananId: string
  sisaTagihan: number
}

export function PaymentModal({ pesananId, sisaTagihan }: PaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPembayaran(pesananId, new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setOpen(false)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ Catat Pembayaran</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jumlah">Jumlah (Rp)</Label>
            <Input
              id="jumlah"
              name="jumlah"
              type="number"
              min="1"
              defaultValue={sisaTagihan}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metode">Metode Pembayaran</Label>
            <select
              id="metode"
              name="metode"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dibayar_pada">Tanggal Bayar</Label>
            <Input
              id="dibayar_pada"
              name="dibayar_pada"
              type="date"
              defaultValue={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan (opsional)</Label>
            <Input id="catatan" name="catatan" placeholder="Catatan..." />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
