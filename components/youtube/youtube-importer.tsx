'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoCard } from './video-card'

interface YouTubeVideo {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  duration: string
  channelTitle: string
  isImported: boolean
}

export function YouTubeImporter() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVideos = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/youtube/playlist?limit=50')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch videos')
      }

      setVideos(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleImport = async (videoId: string) => {
    const response = await fetch(`/api/youtube/import/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'FCPS School Board' }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to import video')
    }

    // Update local state to mark as imported
    setVideos((prev) =>
      prev.map((v) =>
        v.videoId === videoId ? { ...v, isImported: true } : v
      )
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading videos from YouTube...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load videos</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchVideos}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  const importedCount = videos.filter((v) => v.isImported).length
  const availableCount = videos.length - importedCount

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {videos.length} videos found &middot; {importedCount} imported &middot; {availableCount} available
          </p>
        </div>
        <Button variant="outline" onClick={fetchVideos} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <VideoCard
            key={video.videoId}
            videoId={video.videoId}
            title={video.title}
            thumbnailUrl={video.thumbnailUrl}
            duration={video.duration}
            publishedAt={video.publishedAt}
            isImported={video.isImported}
            onImport={handleImport}
          />
        ))}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos found in the playlist.</p>
        </div>
      )}
    </div>
  )
}
