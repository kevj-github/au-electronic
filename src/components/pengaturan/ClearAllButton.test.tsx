import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClearAllButton } from './ClearAllButton'
import type { ActionResult } from '@/lib/action-result'

describe('ClearAllButton', () => {
  let action: ReturnType<typeof vi.fn<() => Promise<ActionResult | undefined>>>

  beforeEach(() => {
    action = vi.fn()
  })

  function setup(overrides: Partial<{ label: string; description: string }> = {}) {
    const user = userEvent.setup()
    render(
      <ClearAllButton
        label={overrides.label ?? 'Hapus Semua Pelanggan'}
        description={overrides.description ?? 'Semua data pelanggan akan dihapus.'}
        action={action}
      />
    )
    return user
  }

  it('renders the trigger with the given label', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' })).toBeInTheDocument()
  })

  it('opens on step 1 showing the label and description, without calling the action', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))

    expect(await screen.findByText('Hapus Semua Pelanggan?')).toBeInTheDocument()
    expect(screen.getByText('Semua data pelanggan akan dihapus.')).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('does not call the action from step 1 — "Lanjutkan" only advances to step 2', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await screen.findByText('Hapus Semua Pelanggan?')

    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))

    expect(await screen.findByText('Konfirmasi Terakhir')).toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('calls the action only after confirming step 2', async () => {
    action.mockResolvedValue({})
    const user = setup()

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')

    await user.click(screen.getByRole('button', { name: 'Ya, Hapus Semua' }))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  })

  it('closes the dialog after a successful confirm', async () => {
    action.mockResolvedValue({})
    const user = setup()

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')
    await user.click(screen.getByRole('button', { name: 'Ya, Hapus Semua' }))

    await waitFor(() => expect(screen.queryByText('Konfirmasi Terakhir')).not.toBeInTheDocument())
  })

  it('cancelling step 2 closes the dialog entirely without calling the action', async () => {
    // AlertDialogCancel is a dialog Close trigger, so "Batal" on step 2 both
    // resets the step-2-only state (via onOpenChange) and dismisses the
    // dialog — it does not step back to step 1 while staying open.
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')

    await user.click(screen.getByRole('button', { name: 'Batal' }))

    await waitFor(() => expect(screen.queryByText('Konfirmasi Terakhir')).not.toBeInTheDocument())
    expect(screen.queryByText('Hapus Semua Pelanggan?')).not.toBeInTheDocument()
    expect(action).not.toHaveBeenCalled()
  })

  it('reopening after cancelling from step 2 starts back on step 1', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')

    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await waitFor(() => expect(screen.queryByText('Konfirmasi Terakhir')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    expect(await screen.findByText('Hapus Semua Pelanggan?')).toBeInTheDocument()
  })

  it('shows the error and stays on step 2 when the action fails', async () => {
    action.mockResolvedValue({ error: 'Gagal menghapus data.' })
    const user = setup()

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')
    await user.click(screen.getByRole('button', { name: 'Ya, Hapus Semua' }))

    expect(await screen.findByText('Gagal menghapus data.')).toBeInTheDocument()
    expect(screen.getByText('Konfirmasi Terakhir')).toBeInTheDocument()
  })

  it('clears a previous error when the dialog is closed and reopened', async () => {
    action.mockResolvedValue({ error: 'Gagal menghapus data.' })
    const user = setup()

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')
    await user.click(screen.getByRole('button', { name: 'Ya, Hapus Semua' }))
    expect(await screen.findByText('Gagal menghapus data.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await waitFor(() => expect(screen.queryByText('Konfirmasi Terakhir')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')
    expect(screen.queryByText('Gagal menghapus data.')).not.toBeInTheDocument()
  })

  it('disables both buttons on step 2 while the action is in flight', async () => {
    let resolveAction: (v: object) => void = () => {}
    action.mockImplementation(() => new Promise((resolve) => { resolveAction = resolve }))
    const user = setup()

    await user.click(screen.getByRole('button', { name: 'Hapus Semua Pelanggan' }))
    await user.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Konfirmasi Terakhir')
    await user.click(screen.getByRole('button', { name: 'Ya, Hapus Semua' }))

    expect(await screen.findByRole('button', { name: 'Menghapus...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled()

    resolveAction({})
    await waitFor(() => expect(screen.queryByText('Konfirmasi Terakhir')).not.toBeInTheDocument())
  })
})
