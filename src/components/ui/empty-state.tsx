interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <p className="text-sm text-muted-foreground border rounded-lg p-4">
      {message}
    </p>
  )
}
