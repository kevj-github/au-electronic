import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

describe('ThemeToggle', () => {
  it('adds the dark class and persists it when toggled from light', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByLabelText('Ganti tema terang/gelap'))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('removes the dark class and persists it when toggled from dark', async () => {
    document.documentElement.classList.add('dark')
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByLabelText('Ganti tema terang/gelap'))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('still toggles the class when localStorage throws', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByLabelText('Ganti tema terang/gelap'))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    setItem.mockRestore()
  })
})
