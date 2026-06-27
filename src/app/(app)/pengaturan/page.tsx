import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
import { AddHelperForm } from '@/components/pengaturan/AddHelperForm'
import { DeleteHelperButton } from '@/components/pengaturan/DeleteHelperButton'
import { PesananLockToggle } from '@/components/pengaturan/PesananLockToggle'
import { ClearAllButton } from '@/components/pengaturan/ClearAllButton'
import { clearAllPesanan, clearAllPelanggan } from '@/app/(app)/pengaturan/actions'
import type { User } from '@/lib/types'

export default async function PengaturanPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const [{ data: userList }, { data: lockSetting }] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }).returns<User[]>(),
    supabase.from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>(),
  ])
  const pesananLocked = lockSetting?.value === 'true'

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="users" />
      <div>
        <h2 className="text-lg font-semibold">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Kelola akun owner dan helper toko.</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Daftar Akun</h3>
        <div className="border rounded-lg divide-y">
          {(userList ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{u.nama}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {u.role === 'owner' ? 'Owner' : 'Helper'}
                </span>
                {u.role === 'helper' && <DeleteHelperButton userId={u.id} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Kontrol Pesanan</h3>
        <PesananLockToggle locked={pesananLocked} />
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div>
          <h3 className="font-medium">Hapus Data</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tindakan ini permanen dan tidak dapat dibatalkan.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ClearAllButton
            label="Hapus Semua Pesanan"
            description="Semua pesanan beserta item dan pembayarannya akan dihapus permanen dari database."
            action={clearAllPesanan}
          />
          <ClearAllButton
            label="Hapus Semua Pelanggan"
            description="Semua data pelanggan akan dihapus. Pesanan yang terhubung akan tetap ada namun tidak lagi tertaut ke pelanggan."
            action={clearAllPelanggan}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">Tambah Akun</h3>
        <AddHelperForm />
      </div>
    </div>
  )
}
