'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value !== null) onSelectChange(value)
        }}
        items={Object.fromEntries(selectOptions.map((o) => [o.value, o.label]))}
      >
        <SelectTrigger className="w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
