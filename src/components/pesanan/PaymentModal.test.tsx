import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentModal } from './PaymentModal'

/**
 * The payment amount field prefills with the outstanding balance. That prefill
 * is seeded from the `sisaTagihan` prop, and the component stays mounted across
 * payments — it is rendered whenever `sisaTagihan > 0`, so a *partial* payment
 * leaves it on screen with its state intact. A full payment unmounts it, so
 * only the partial-payment flow is exposed, which is precisely the flow the app
 * has a `bayar_sebagian` status for.
 *
 * If the prefill is not refreshed, reopening the dialog after a partial payment
 * offers the original balance again and one unnoticed Simpan overpays the order.
 */

const createPembayaran = vi.fn(async () => ({}) as { error?: string })

vi.mock('@/app/(app)/pesanan/[id]/payment-actions', () => ({
  createPembayaran: (...a: unknown[]) => createPembayaran(...(a as [])),
}))

const amountField = () => screen.getByLabelText('Jumlah (Rp)') as HTMLInputElement
const openDialog = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '+ Catat Pembayaran' }))

/** The hidden input that actually carries the value into the FormData. */
const submittedAmount = () =>
  (document.querySelector('input[name="jumlah"]') as HTMLInputElement)?.value

beforeEach(() => {
  createPembayaran.mockReset().mockResolvedValue({})
})

describe('payment amount prefill', () => {
  it('prefills with the outstanding balance, formatted', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={500000} />)

    await openDialog(user)

    expect(amountField().value).toBe('500.000')
    expect(submittedAmount()).toBe('500000')
  })

  it('prefills the NEW balance after a partial payment reduced it', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PaymentModal pesananId="p1" sisaTagihan={500000} />)

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    // The order page revalidates and re-renders with the reduced balance while
    // this component stays mounted (sisaTagihan is still > 0).
    rerender(<PaymentModal pesananId="p1" sisaTagihan={300000} />)
    await openDialog(user)

    expect(amountField().value).toBe('300.000')
    expect(submittedAmount()).toBe('300000')
  })

  it('resets an abandoned edit when the dialog is reopened', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={500000} />)

    await openDialog(user)
    await user.clear(amountField())
    await user.type(amountField(), '123')
    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await openDialog(user)

    expect(amountField().value).toBe('500.000')
  })

  it('keeps only digits as the user types', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={0} />)

    await openDialog(user)
    await user.type(amountField(), 'ab12c3')

    expect(amountField().value).toBe('123')
    expect(submittedAmount()).toBe('123')
  })

  it('starts empty when there is no outstanding balance', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={0} />)

    await openDialog(user)

    expect(amountField().value).toBe('')
  })
})

describe('payment submission', () => {
  it('submits the raw digits, not the formatted display value', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={0} />)

    await openDialog(user)
    await user.type(amountField(), '1500000')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    const [pesananId, formData] = createPembayaran.mock.calls[0] as unknown as [string, FormData]
    expect(pesananId).toBe('p1')
    // "1.500.000" would fail the action's Number() validation.
    expect(formData.get('jumlah')).toBe('1500000')
  })

  it('closes on success', async () => {
    const user = userEvent.setup()
    render(<PaymentModal pesananId="p1" sisaTagihan={500000} />)

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.queryByLabelText('Jumlah (Rp)')).not.toBeInTheDocument()
  })

  it('surfaces the error and stays open on failure', async () => {
    const user = userEvent.setup()
    createPembayaran.mockResolvedValue({ error: 'Jumlah pembayaran tidak valid.' })
    render(<PaymentModal pesananId="p1" sisaTagihan={500000} />)

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByText('Jumlah pembayaran tidak valid.')).toBeInTheDocument()
    expect(amountField()).toBeInTheDocument()
  })
})
