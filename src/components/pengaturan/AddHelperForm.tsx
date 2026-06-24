'use client'

import { useRef, useState } from 'react'
import { createUser } from '@/app/(app)/pengaturan/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AddHelperForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createUser(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      formRef.current?.reset()
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="nama">Nama</Label>
        <Input id="nama" name="nama" placeholder="Nama akun" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="email@contoh.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimal 6 karakter"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          defaultValue="helper"
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="helper">Helper</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Menyimpan...' : 'Tambah Akun'}
      </Button>
    </form>
  )
}
