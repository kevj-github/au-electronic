'use client'

import { deleteHelper } from '@/app/(app)/pengaturan/actions'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

interface DeleteHelperButtonProps {
  userId: string
}

export function DeleteHelperButton({ userId }: DeleteHelperButtonProps) {
  return (
    <ConfirmDeleteButton
      renderTrigger={
        <button
          type="button"
          className="text-xs text-destructive/70 hover:text-destructive disabled:opacity-50"
        />
      }
      triggerLabel="Hapus"
      title="Hapus akun helper ini?"
      description="Tindakan ini tidak dapat dibatalkan."
      action={() => deleteHelper(userId)}
    />
  )
}
