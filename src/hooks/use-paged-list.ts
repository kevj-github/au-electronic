'use client'

import { useMemo, useState } from 'react'

/**
 * Pages an already-filtered list and resets to page 1 whenever the filters
 * change. `filterKey` should be a value (e.g. `JSON.stringify([...])`) that
 * changes exactly when any filter input changes — the reset is applied
 * during render (React's recommended pattern) rather than in an effect, so
 * it commits in the same pass rather than cascading a second render.
 */
export function usePagedList<T>(filtered: T[], pageSize: number, filterKey: string) {
  const [page, setPage] = useState(1)

  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  return { page, setPage, totalPages, pageRows }
}
