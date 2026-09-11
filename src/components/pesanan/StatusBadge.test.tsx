// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'
import type { StatusPesanan } from '@/lib/types'

describe('StatusBadge', () => {
  const cases: Array<{
    status: StatusPesanan
    label: string
    variantClass: string
  }> = [
    { status: 'diproses', label: 'Diproses', variantClass: 'bg-primary' },
    { status: 'selesai', label: 'Selesai', variantClass: 'bg-secondary' },
    { status: 'dibatalkan', label: 'Dibatalkan', variantClass: 'bg-destructive/10' },
  ]

  for (const { status, label, variantClass } of cases) {
    it(`renders "${label}" with the ${status} variant styling`, () => {
      render(<StatusBadge status={status} />)

      const badge = screen.getByText(label)
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain(variantClass)
    })
  }

  it('maps each status to a visually distinct variant', () => {
    const classNames = cases.map(({ status }) => {
      const { container, unmount } = render(<StatusBadge status={status} />)
      const className = container.querySelector('span')?.className ?? ''
      unmount()
      return className
    })

    expect(new Set(classNames).size).toBe(cases.length)
  })
})
