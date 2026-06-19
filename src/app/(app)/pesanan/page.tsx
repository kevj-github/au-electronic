import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OrderList } from '@/components/pesanan/OrderList'
import { Button } from '@/components/ui/button'

export default async function PesananPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: pesananList } = await supabase
    .from('pesanan')
    .select(`
      *,
      pelanggan(nama),
      items:item_pesanan(subtotal),
      pembayaran(jumlah)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pesanan</h2>
          <p className="text-sm text-muted-foreground">
            {pesananList?.length ?? 0} pesanan
          </p>
        </div>
        <Link href="/pesanan/baru">
          <Button>+ Pesanan Baru</Button>
        </Link>
      </div>
      <OrderList pesananList={pesananList ?? []} />
    </div>
  )
}
