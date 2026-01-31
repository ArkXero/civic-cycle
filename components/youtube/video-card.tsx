'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Calendar, Clock, Check, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VideoCardProps {
  videoId: string
  title: string
  thumbnailUrl: string
  duration: string
  publishedAt: string
  isImported: boolean
  onImport: (videoId: string) => Promise<void>
}

export function VideoCard({
  videoId,
  title,
  thumbnailUrl,
  duration,
  publishedAt,
  isImported,
  onImport,
}: VideoCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [imported, setImported] = useState(isImported)

  const handleImport = async () => {
    setIsLoading(true)
    try {
      await onImport(videoId)
      setImported(true)
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formattedDate = new Date(publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No thumbnail
          </div>
        )}
        {duration && (
          <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">
            {duration}
          </Badge>
        )}
        {imported && (
          <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
            <Check className="h-3 w-3 mr-1" />
            Imported
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-medium text-sm line-clamp-2 mb-2" title={title}>
          {title}
        </h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleImport}
          disabled={imported || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : imported ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Imported
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Import Meeting
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
