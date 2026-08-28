'use client'

import { useState } from 'react'
import { createPembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatThousandsInput, parseThousandsInput } from '@/lib/utils'
import { setErrorFromResult } from '@/lib/action-result'
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
  const [jumlahRaw, setJumlahRaw] = useState(String(sisaTagihan > 0 ? sisaTagihan : ''))

  // Re-seed the prefill every time the dialog opens rather than only at mount.
  //
  // This component is rendered whenever `sisaTagihan > 0`, so a *partial*
  // payment leaves it mounted with its state intact while the page revalidates
  // to a smaller balance. A mount-only prefill therefore offered the ORIGINAL
  // balance again on the second payment, and one unnoticed Simpan overpaid the
  // order. (A full payment unmounts the component, so only the partial flow —
  // the one `bayar_sebagian` exists for — was exposed.)
  //
  // Keyed on the open transition, not on `sisaTagihan`, so a balance change
  // arriving via Realtime while the dialog is open cannot clobber what the
  // owner is currently typing. Adjusting state during render is the
  // React-recommended form and converges: `prevOpen` matches immediately after.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setJumlahRaw(String(sisaTagihan > 0 ? sisaTagihan : ''))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPembayaran(pesananId, new FormData(e.currentTarget))
    if (!setErrorFromResult(result, setError)) setOpen(false)
    setLoading(false)
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
              type="text"
              inputMode="numeric"
              value={formatThousandsInput(jumlahRaw)}
              onChange={(e) => setJumlahRaw(parseThousandsInput(e.target.value))}
              required
            />
            <input type="hidden" name="jumlah" value={jumlahRaw} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metode">Metode Pembayaran</Label>
            <Select name="metode" defaultValue="tunai" required>
              <SelectTrigger id="metode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
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
