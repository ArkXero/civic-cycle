'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarDays,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateTime, timeAgo } from '@/components/admin/dashboard-format'

type UserDetail = {
  id: string
  email: string
  display_name: string | null
  role: 'user' | 'admin'
  created_at: string
  last_sign_in_at: string | null
  alert_preferences: Array<{
    keyword: string
    is_active: boolean
    bodies: string[]
  }>
  emails_sent: number
}

export function UserDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null)
      setError(false)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function fetchDetail() {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) throw new Error('fetch failed')

        const data = await res.json() as UserDetail
        setDetail(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    void fetchDetail()

    return () => controller.abort()
  }, [open, retryKey, userId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            {detail?.email ?? 'Signup, role, alert, and delivery history'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">Failed to load user details.</p>
            <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                icon={<User className="w-4 h-4 text-muted-foreground" />}
                label="Display name"
                value={detail.display_name ?? <span>&mdash;</span>}
              />
              <DetailItem
                icon={detail.role === 'admin'
                  ? <ShieldCheck className="w-4 h-4 text-green-500" />
                  : <ShieldOff className="w-4 h-4 text-muted-foreground" />
                }
                label="Role"
                value={
                  <Badge variant={detail.role === 'admin' ? 'default' : 'outline'}>
                    {detail.role}
                  </Badge>
                }
              />
              <DetailItem
                icon={<CalendarDays className="w-4 h-4 text-muted-foreground" />}
                label="Signed up"
                value={`${formatDateTime(detail.created_at)} (${timeAgo(detail.created_at)})`}
              />
              <DetailItem
                icon={<Mail className="w-4 h-4 text-muted-foreground" />}
                label="Emails sent"
                value={detail.emails_sent.toLocaleString()}
              />
              <DetailItem
                icon={<RefreshCw className="w-4 h-4 text-muted-foreground" />}
                label="Last sign-in"
                value={detail.last_sign_in_at
                  ? `${formatDateTime(detail.last_sign_in_at)} (${timeAgo(detail.last_sign_in_at)})`
                  : 'Never'
                }
              />
              <DetailItem
                icon={<Bell className="w-4 h-4 text-muted-foreground" />}
                label="Active alerts"
                value={detail.alert_preferences.length.toLocaleString()}
              />
            </div>

            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Alert Preferences</h3>
                </div>
                <Badge variant="outline">{detail.alert_preferences.length} active</Badge>
              </div>
              {detail.alert_preferences.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No active alert preferences.</p>
              ) : (
                <ul className="divide-y">
                  {detail.alert_preferences.map((pref, index) => (
                    <li key={`${pref.keyword}-${index}`} className="space-y-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium">{pref.keyword}</p>
                        <Badge variant={pref.is_active ? 'default' : 'outline'}>
                          {pref.is_active ? 'active' : 'inactive'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pref.bodies.length > 0 ? (
                          pref.bodies.map((body) => (
                            <Badge key={body} variant="outline" className="font-normal">
                              {body}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">All meeting bodies</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 min-w-0 text-sm font-medium">{value}</div>
    </div>
  )
}
