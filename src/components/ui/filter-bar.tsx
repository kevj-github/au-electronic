'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface FilterBarOption<T extends string> {
  value: T
  label: string
}

interface FilterBarProps<T extends string> {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  selectValue: T
  onSelectChange: (value: T) => void
  selectOptions: FilterBarOption<T>[]
}

export function FilterBar<T extends string>({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  selectValue,
  onSelectChange,
  selectOptions,
}: FilterBarProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      <select
        value={selectValue}
        onChange={(e) => onSelectChange(e.target.value as T)}
        className="border rounded-md px-3 py-2 text-sm"
      >
        {selectOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
