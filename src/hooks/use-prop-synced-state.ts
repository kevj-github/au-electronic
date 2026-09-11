import { useState, type Dispatch, type SetStateAction } from 'react'

/**
 * useState that also resyncs to an external prop: when `prop` changes to a
 * new value (e.g. a fresh initialValue pushed by RealtimeRefresh from
 * another device's save), the returned state resets to `transform(prop)`.
 * A useState initialiser only runs once, so without this render-phase
 * compare the state would keep comparing against a prop value no longer
 * current on the server.
 */
export function usePropSyncedState<P, V>(
  prop: P,
  transform: (prop: P) => V,
): [V, Dispatch<SetStateAction<V>>] {
  const [value, setValue] = useState(() => transform(prop))
  const [prevProp, setPrevProp] = useState(prop)
  if (prop !== prevProp) {
    setPrevProp(prop)
    setValue(transform(prop))
  }
  return [value, setValue]
}
