import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelperItemChecklist } from './HelperItemChecklist'
import { setItemJumlahDiambil } from '@/app/(app)/pesanan/item-mutation-actions'

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  setItemJumlahDiambil: vi.fn(),
}))

const mockSetJumlah = vi.mocked(setItemJumlahDiambil)

beforeEach(() => {
  mockSetJumlah.mockReset()
})

describe('HelperItemChecklist', () => {
  it('renders the input value and unchecked checkbox from props', () => {
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={2} />)
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(2)
    expect(screen.getByLabelText('Diambil dari etalase')).not.toBeChecked()
  })

  it('shows the checkbox checked when jumlahDiambil already meets qty', () => {
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={5} />)
    expect(screen.getByLabelText('Diambil dari etalase')).toBeChecked()
  })

  it('shows an empty input for a zero jumlahDiambil', () => {
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} />)
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(null)
  })

  it('checking the box commits the full qty', async () => {
    mockSetJumlah.mockResolvedValue({})
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} />)

    await user.click(screen.getByLabelText('Diambil dari etalase'))

    expect(screen.getByLabelText('Diambil dari etalase')).toBeChecked()
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(5)
    await waitFor(() => expect(mockSetJumlah).toHaveBeenCalledWith('i1', 5))
  })

  it('unchecking the box commits 0', async () => {
    mockSetJumlah.mockResolvedValue({})
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={5} />)

    await user.click(screen.getByLabelText('Diambil dari etalase'))

    await waitFor(() => expect(mockSetJumlah).toHaveBeenCalledWith('i1', 0))
    expect(screen.getByLabelText('Diambil dari etalase')).not.toBeChecked()
  })

  it('typing then blurring commits the typed value, clamped to qty', async () => {
    mockSetJumlah.mockResolvedValue({})
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} />)

    const input = screen.getByLabelText('Jumlah diambil')
    await user.type(input, '9')
    // Clamped while typing so it can never exceed qty.
    expect(input).toHaveValue(5)

    await user.tab()
    await waitFor(() => expect(mockSetJumlah).toHaveBeenCalledWith('i1', 5))
  })

  it('blurring an empty input commits 0', async () => {
    mockSetJumlah.mockResolvedValue({})
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={3} />)

    const input = screen.getByLabelText('Jumlah diambil')
    await user.clear(input)
    await user.tab()

    await waitFor(() => expect(mockSetJumlah).toHaveBeenCalledWith('i1', 0))
  })

  it('reverts the checkbox but leaves the typed input text as-is when the commit fails', async () => {
    mockSetJumlah.mockResolvedValue({ error: 'Gagal.' })
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} />)

    await user.click(screen.getByLabelText('Diambil dari etalase'))

    await waitFor(() => expect(screen.getByLabelText('Diambil dari etalase')).not.toBeChecked())
    // The optimistic overlay for `checked`/`value` rolls back, but the input
    // text (a separate piece of state) is not explicitly reverted — matches
    // the pre-refactor behavior, so the user still sees what they attempted.
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(5)
  })

  it('drops stale input/checkbox state when jumlahDiambil changes from another source', () => {
    const { rerender } = render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={2} />)
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(2)

    rerender(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={4} />)
    expect(screen.getByLabelText('Jumlah diambil')).toHaveValue(4)
    expect(screen.getByLabelText('Diambil dari etalase')).not.toBeChecked()
  })

  it('pressing Enter blurs the input, committing the value', async () => {
    mockSetJumlah.mockResolvedValue({})
    const user = userEvent.setup()
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} />)

    const input = screen.getByLabelText('Jumlah diambil')
    await user.type(input, '3{Enter}')

    await waitFor(() => expect(mockSetJumlah).toHaveBeenCalledWith('i1', 3))
  })

  it('disables both controls while disabled prop is set', () => {
    render(<HelperItemChecklist itemId="i1" qty={5} jumlahDiambil={0} disabled />)
    expect(screen.getByLabelText('Jumlah diambil')).toBeDisabled()
    expect(screen.getByLabelText('Diambil dari etalase')).toHaveAttribute('aria-disabled', 'true')
  })
})
