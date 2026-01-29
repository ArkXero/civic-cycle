import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function MeetingNotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">Meeting Not Found</h1>
      <p className="text-muted-foreground mb-6">
        The meeting you&apos;re looking for doesn&apos;t exist or may have been removed.
      </p>
      <Button asChild>
        <Link href="/meetings">Browse All Meetings</Link>
      </Button>
    </div>
  )
}
