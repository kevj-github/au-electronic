import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProdukList } from '@/components/produk/ProdukList'
import { Button } from '@/components/ui/button'
import type { Produk, User } from '@/lib/types'

export default async function ProdukPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()

  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: produkList } = await supabase
    .from('produk')
    .select('*')
    .order('nama')
    .returns<Produk[]>()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Katalog Produk</h2>
          <p className="text-sm text-muted-foreground">
            {produkList?.length ?? 0} produk terdaftar
          </p>
        </div>
        <Link href="/produk/baru">
          <Button>+ Tambah Produk</Button>
        </Link>
      </div>
      <ProdukList produkList={produkList ?? []} isOwner />
    </div>
  )
}
