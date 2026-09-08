import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so a caller relying
  // on it never returning (Home has no `return` after the call) matches
  // production control flow.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

beforeEach(() => {
  redirect.mockClear()
})

describe('Home', () => {
  it('redirects to /login', async () => {
    const { default: Home } = await import('./page')
    expect(() => Home()).toThrow('NEXT_REDIRECT:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
