export default function MeetingsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-64 bg-muted rounded animate-pulse mb-2" />
        <div className="h-5 w-96 bg-muted rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-64 bg-card rounded-lg border border-border animate-pulse"
          />
        ))}
      </div>
    </div>
  )
}
