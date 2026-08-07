import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The proxy is the app's front door: it runs before every matched request and
 * decides who gets bounced to /login. It had no coverage, and its failure modes
 * are the kind you only notice in production — an unauthenticated user reaching
 * a page, or a redirect loop on /login itself.
 *
 * It is an optimistic gate, not the authorization boundary (RLS and
 * requireOwner are), so what these pin is the routing decision only.
 */

let sessionUser: { id: string } | null = null

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }),
}))

function request(pathname: string) {
  const url = `https://shop.example${pathname}`
  return {
    nextUrl: new URL(url),
    url,
    cookies: { getAll: () => [], set: () => {} },
  } as unknown as import('next/server').NextRequest
}

/** Where a NextResponse points, or null when it is a pass-through. */
function redirectTarget(res: Response): string | null {
  const location = res.headers.get('location')
  return location ? new URL(location).pathname : null
}

beforeEach(() => {
  sessionUser = null
})

describe('unauthenticated visitors', () => {
  it.each(['/', '/pesanan', '/pesanan/abc', '/dashboard', '/pelanggan', '/pengaturan'])(
    'are redirected to /login from %s',
    async (path) => {
      const { proxy } = await import('./proxy')

      expect(redirectTarget(await proxy(request(path)))).toBe('/login')
    }
  )

  it.each(['/login', '/register'])('are left alone on %s', async (path) => {
    const { proxy } = await import('./proxy')

    // A redirect here would be an infinite loop.
    expect(redirectTarget(await proxy(request(path)))).toBeNull()
  })
})

describe('authenticated visitors', () => {
  beforeEach(() => {
    sessionUser = { id: 'user-1' }
  })

  it.each(['/login', '/register'])('are sent to /pesanan from %s', async (path) => {
    const { proxy } = await import('./proxy')

    expect(redirectTarget(await proxy(request(path)))).toBe('/pesanan')
  })

  it.each(['/pesanan', '/dashboard', '/pelanggan', '/pengaturan', '/pesanan/abc'])(
    'pass through %s',
    async (path) => {
      const { proxy } = await import('./proxy')

      expect(redirectTarget(await proxy(request(path)))).toBeNull()
    }
  )
})

describe('matcher config', () => {
  it('excludes static assets and image optimisation from the auth gate', async () => {
    const { config } = await import('./proxy')
    const [pattern] = config.matcher
    const re = new RegExp(`^${pattern}$`)

    // These must not be gated, or the login page loads without CSS/JS.
    expect(re.test('/_next/static/chunk.js')).toBe(false)
    expect(re.test('/_next/image')).toBe(false)
    expect(re.test('/favicon.ico')).toBe(false)
    expect(re.test('/au-crown.png')).toBe(false)
    expect(re.test('/vercel.svg')).toBe(false)
  })

  it('still gates real pages', async () => {
    const { config } = await import('./proxy')
    const [pattern] = config.matcher
    const re = new RegExp(`^${pattern}$`)

    expect(re.test('/pesanan')).toBe(true)
    expect(re.test('/dashboard')).toBe(true)
    expect(re.test('/pesanan/abc-123')).toBe(true)
  })
})
