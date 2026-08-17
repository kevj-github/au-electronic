import { cn } from '@/lib/utils'

/**
 * Hand-written rather than pulled from `shadcn add`: Skeleton wraps no Base UI
 * primitive, so the generated file would be this same single div and the
 * `render=` prop conventions do not apply.
 *
 * `aria-hidden` because the shape is decoration — the surrounding container
 * carries the announcement, so a screen reader hears "Memuat pesanan" once
 * instead of a dozen meaningless boxes.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}
