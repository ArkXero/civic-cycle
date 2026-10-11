export default function MeetingsLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-6 md:py-14">
      <div className="mb-10 space-y-4">
        <div className="h-3 w-56 rounded bg-muted animate-pulse" />
        <div className="h-12 w-64 rounded bg-muted animate-pulse" />
        <div className="h-5 w-96 max-w-full rounded bg-muted animate-pulse" />
      </div>

      <div className="border-t-2 border-rule">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse border-b border-border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}
