import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'

describe('ConfirmDeleteButton', () => {
  it('does not call action until the dialog is confirmed', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({}))

    render(
      <ConfirmDeleteButton
        renderTrigger={<button type="button" />}
        triggerLabel="Hapus"
        title="Hapus item ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        action={action}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    expect(action).not.toHaveBeenCalled()

    expect(await screen.findByText('Hapus item ini?')).toBeInTheDocument()

    const confirmButtons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  })

  it('cancelling the dialog does not call the action', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({}))

    render(
      <ConfirmDeleteButton
        renderTrigger={<button type="button" />}
        triggerLabel="Hapus"
        title="Hapus item ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        action={action}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus item ini?')

    await user.click(screen.getByRole('button', { name: 'Batal' }))

    await waitFor(() => expect(screen.queryByText('Hapus item ini?')).not.toBeInTheDocument())
    expect(action).not.toHaveBeenCalled()
  })

  it('shows an error and keeps the dialog open when the action fails', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({ error: 'Gagal menghapus.' }))
    const onSuccess = vi.fn()

    render(
      <ConfirmDeleteButton
        renderTrigger={<button type="button" />}
        triggerLabel="Hapus"
        title="Hapus item ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        action={action}
        onSuccess={onSuccess}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus item ini?')

    const confirmButtons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(await screen.findByText('Gagal menghapus.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByText('Hapus item ini?')).toBeInTheDocument()
  })

  it('calls onSuccess and closes the dialog when the action succeeds', async () => {
    const user = userEvent.setup()
    const action = vi.fn(async () => ({}))
    const onSuccess = vi.fn()

    render(
      <ConfirmDeleteButton
        renderTrigger={<button type="button" />}
        triggerLabel="Hapus"
        title="Hapus item ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        action={action}
        onSuccess={onSuccess}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    await screen.findByText('Hapus item ini?')

    const confirmButtons = screen.getAllByRole('button', { name: 'Hapus' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Hapus item ini?')).not.toBeInTheDocument())
  })
})
