export default function MeetingLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="animate-pulse space-y-6">
        {/* Back button placeholder */}
        <div className="h-10 w-40 bg-muted rounded" />

        {/* Header */}
        <div>
          <div className="h-4 w-48 bg-muted rounded mb-3" />
          <div className="h-8 w-3/4 bg-muted rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        </div>

        {/* Summary card */}
        <div className="h-64 bg-muted rounded-lg" />

        {/* Key decisions card */}
        <div className="h-48 bg-muted rounded-lg" />

        {/* Action items card */}
        <div className="h-40 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
