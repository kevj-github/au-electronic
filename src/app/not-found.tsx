import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 px-4 text-center">
      <h2 className="text-lg font-semibold">Halaman tidak ditemukan</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Halaman yang Anda cari tidak ada atau sudah dipindahkan.
      </p>
      <Button render={<Link href="/pesanan" />}>Kembali ke Pesanan</Button>
    </div>
  )
}
