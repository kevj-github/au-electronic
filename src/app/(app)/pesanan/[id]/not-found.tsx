import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PesananNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
      <h2 className="text-lg font-semibold">Pesanan tidak ditemukan</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Pesanan ini mungkin sudah dihapus atau tautannya salah.
      </p>
      <Button render={<Link href="/pesanan" />}>Kembali ke Pesanan</Button>
    </div>
  )
}
