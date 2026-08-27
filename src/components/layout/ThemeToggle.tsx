'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

// No client state needed to pick the icon: both are always rendered and CSS
// (`dark:` variants, driven by the `.dark` class the inline script in
// layout.tsx sets before paint) decides which one is visible. That avoids a
// hydration mismatch entirely, since the server-rendered markup is identical
// regardless of theme.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const next = !root.classList.contains('dark')
    root.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // localStorage can throw in private-browsing/storage-restricted contexts;
      // the toggle still works for the current page load, it just won't persist.
    }
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Ganti tema terang/gelap">
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  )
}
