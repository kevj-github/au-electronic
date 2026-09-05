'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Pelanggan } from '@/lib/types'

/**
 * OrderForm's "pick from the list, or type a new name" pelanggan picker:
 * either `pelangganId` is set (chosen from the `<Select>` or a suggestion) or
 * `namaPelanggan` is a freehand-typed name with its own autocomplete dropdown
 * against the same list — never both, picking one clears the other.
 *
 * `pelangganId`/`namaPelanggan` are exposed as plain values (not just derived
 * behaviour) because the form's own `isDirty` check needs to read them
 * directly, alongside its other fields.
 */
export function usePelangganAutocomplete(pelangganList: Pelanggan[]) {
  const [pelangganId, setPelangganId] = useState('')
  const [namaPelanggan, setNamaPelanggan] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Single source of truth for the picker's display label per pelanggan, so
  // SelectItem's popup text and SelectValue's trigger text (which Base UI does
  // not derive from rendered children — it shows the raw value unless given an
  // explicit label) can't drift apart.
  const pelangganLabel = useCallback(
    (p: Pelanggan) =>
      `${p.nama}${p.alamat ? ` — ${p.alamat}` : ''} (${p.tipe === 'grosir' ? 'Grosir' : 'Retail'})`,
    []
  )
  const pelangganLabelsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pelangganList) map.set(p.id, pelangganLabel(p))
    return map
  }, [pelangganList, pelangganLabel])
  const labelFor = useCallback(
    (id: string) => pelangganLabelsById.get(id) ?? id,
    [pelangganLabelsById]
  )

  const suggestions = useMemo(() => {
    const q = namaPelanggan.trim().toLowerCase()
    if (!q || pelangganId) return []

    return pelangganList
      .filter((p) => p.nama.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.nama.toLowerCase().startsWith(q) ? 0 : 1
        const bStarts = b.nama.toLowerCase().startsWith(q) ? 0 : 1
        return aStarts - bStarts || a.nama.localeCompare(b.nama)
      })
      .slice(0, 8)
  }, [namaPelanggan, pelangganId, pelangganList])

  // Chosen from the <Select> dropdown: clears whatever was typed.
  const selectPelanggan = useCallback((value: string | null) => {
    setPelangganId(value ?? '')
    if (value) setNamaPelanggan('')
  }, [])

  // Typed into the freehand name input: clears any prior selection and drives
  // the suggestion dropdown open/closed as the field goes from empty to not.
  const onNamaPelangganChange = useCallback((value: string) => {
    setNamaPelanggan(value)
    if (value) {
      setPelangganId('')
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }, [])

  const onNamaPelangganFocus = useCallback(() => {
    if (namaPelanggan.trim()) setShowSuggestions(true)
  }, [namaPelanggan])

  const onNamaPelangganBlur = useCallback(() => setShowSuggestions(false), [])

  // Clicking a suggestion resolves it the same way an explicit <Select> pick
  // does — pelangganId set, typed name cleared.
  const selectSuggestion = useCallback((p: Pelanggan) => {
    setPelangganId(p.id)
    setNamaPelanggan('')
    setShowSuggestions(false)
  }, [])

  /**
   * Resolve what the user picked/typed into the pair `createPesanan` expects.
   * A typed name that exactly matches an existing pelanggan (case/whitespace
   * insensitive) links to that pelanggan instead of creating a free-text name,
   * so a customer typed instead of picked from the list still lands on their
   * existing record.
   */
  const resolve = useCallback((): {
    pelanggan_id: string | null
    nama_pelanggan: string | null
  } => {
    const namaInput = namaPelanggan.trim()
    const matched = !pelangganId
      ? pelangganList.find((p) => p.nama.trim().toLowerCase() === namaInput.toLowerCase())
      : null
    const resolvedPelangganId = pelangganId || matched?.id || null

    return {
      pelanggan_id: resolvedPelangganId,
      nama_pelanggan: resolvedPelangganId ? null : namaInput || null,
    }
  }, [pelangganId, namaPelanggan, pelangganList])

  return {
    pelangganId,
    namaPelanggan,
    showSuggestions,
    suggestions,
    labelFor,
    selectPelanggan,
    onNamaPelangganChange,
    onNamaPelangganFocus,
    onNamaPelangganBlur,
    selectSuggestion,
    resolve,
  }
}
