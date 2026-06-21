import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddHelperForm } from '@/components/pengaturan/AddHelperForm'
import { DeleteHelperButton } from '@/components/pengaturan/DeleteHelperButton'
import type { User } from '@/lib/types'

export default async function PengaturanPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: userList } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true })
    .returns<User[]>()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Kelola akun helper toko.</p>
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

      <div className="space-y-3">
        <h3 className="font-medium">Tambah Helper</h3>
        <AddHelperForm />
      </div>
    </div>
  )
}
