'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminAnalytics } from '@/components/admin/admin-analytics'
import { UserDetailDialog } from '@/components/admin/user-detail-dialog'
import { timeAgo } from '@/components/admin/dashboard-format'
import {
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  LayoutDashboard,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import type { AdminUser } from '@/app/api/admin/users/route'

interface ServiceCheck {
  service: string
  status: 'healthy' | 'down'
  responseTime: number
  error?: string
}

interface HealthStatus {
  services: ServiceCheck[]
  lastSuccessfulImport: { created_at: string; title: string } | null
  allHealthy: boolean
}

type RoleFilter = 'all' | 'admin' | 'user'
type SignupSort = 'newest' | 'oldest'

function signupTimestamp(user: AdminUser) {
  const timestamp = new Date(user.created_at).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DashboardClient({
  currentUserId,
  canDemoteAdmins,
}: {
  currentUserId: string
  canDemoteAdmins: boolean
}) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState(false)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [usersLoading, setUsersLoading] = useState(true)
  const [roleActionId, setRoleActionId] = useState<string | null>(null)
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [signupSort, setSignupSort] = useState<SignupSort>('newest')

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      setUsers(null)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const refreshHealth = useCallback(async (showLoading = true) => {
    if (showLoading) setHealthLoading(true)
    setHealthError(false)
    try {
      const response = await fetch('/api/admin/health', { cache: 'no-store' })
      if (!response.ok) throw new Error('fetch failed')
      setHealth(await response.json())
    } catch {
      setHealthError(true)
    } finally {
      if (showLoading) setHealthLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setAnalyticsRefreshKey((key) => key + 1)
    await Promise.all([refreshHealth(), refreshUsers()])
  }, [refreshHealth, refreshUsers])

  const handlePromote = useCallback(async (targetUser: AdminUser) => {
    const confirmed = window.confirm(
      `Promote ${targetUser.email} to admin?\n\nThe role change takes effect on their next login or token refresh.`
    )
    if (!confirmed) return

    setRoleActionId(targetUser.id)
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      })
      if (!res.ok) {
        const body = await res.json()
        alert(`Failed to promote user: ${body.error ?? 'Unknown error'}`)
        return
      }
      await refreshUsers()
      setAnalyticsRefreshKey((key) => key + 1)
    } catch {
      alert('Failed to promote user. Please try again.')
    } finally {
      setRoleActionId(null)
    }
  }, [refreshUsers])

  const handleDemote = useCallback(async (targetUser: AdminUser) => {
    const confirmed = window.confirm(
      `Demote ${targetUser.email} from admin?\n\nThe role change takes effect on their next login or token refresh.`
    )
    if (!confirmed) return

    setRoleActionId(targetUser.id)
    try {
      const res = await fetch('/api/admin/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      })
      if (!res.ok) {
        const body = await res.json()
        alert(`Failed to demote user: ${body.error ?? 'Unknown error'}`)
        return
      }
      await refreshUsers()
      setAnalyticsRefreshKey((key) => key + 1)
    } catch {
      alert('Failed to demote user. Please try again.')
    } finally {
      setRoleActionId(null)
    }
  }, [refreshUsers])

  const openUserDetail = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setDetailOpen(true)
  }, [])

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()

    return (users ?? [])
      .filter((user) => {
        const matchesRole = roleFilter === 'all' || user.role === roleFilter
        const matchesSearch = !query
          || user.email.toLowerCase().includes(query)
          || (user.display_name?.toLowerCase().includes(query) ?? false)

        return matchesRole && matchesSearch
      })
      .sort((a, b) => {
        const diff = signupTimestamp(b) - signupTimestamp(a)
        return signupSort === 'newest' ? diff : -diff
      })
  }, [roleFilter, signupSort, userSearch, users])

  useEffect(() => {
    void refreshHealth()
    void refreshUsers()
    const interval = setInterval(() => {
      void refreshHealth(false)
      setAnalyticsRefreshKey((key) => key + 1)
    }, 60_000)
    return () => clearInterval(interval)
  }, [refreshHealth, refreshUsers])

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={healthLoading || usersLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${healthLoading || usersLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <AdminAnalytics refreshKey={analyticsRefreshKey} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">System health</CardTitle>
            {health && (
              <Badge variant={health.allHealthy ? 'default' : 'destructive'}>
                {health.allHealthy ? 'All operational' : 'Issues detected'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthLoading && !health ? (
            <div className="h-28 animate-pulse rounded-lg bg-muted/35" aria-label="Loading system health" />
          ) : healthError || !health ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/35 px-3 py-3">
              <p className="text-sm text-destructive">System health could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => refreshHealth()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {health.services.map((service) => (
                  <div key={service.service} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {service.status === 'healthy'
                        ? <CheckCircle className="size-4 shrink-0 text-green-600" />
                        : <XCircle className="size-4 shrink-0 text-destructive" />}
                      <span className="truncate text-sm capitalize">{service.service.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">{service.responseTime}ms</span>
                  </div>
                ))}
              </div>
              {health.lastSuccessfulImport && (
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  Last successful import {timeAgo(health.lastSuccessfulImport.created_at)} — {health.lastSuccessfulImport.title}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── User Management ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">User Management</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={refreshUsers} disabled={usersLoading}>
              <RefreshCw className={`w-3 h-3 mr-1.5 ${usersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users ? (
            <p className="text-sm text-destructive">Failed to load users.</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search users"
                    className="pl-9"
                    aria-label="Search users"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                  <SelectTrigger className="w-full" aria-label="Filter users by role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={signupSort} onValueChange={(value) => setSignupSort(value as SignupSort)}>
                  <SelectTrigger className="w-full" aria-label="Sort users by signup date">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredUsers.length === 0 ? (
                <p className="rounded-md border px-3 py-6 text-sm text-muted-foreground">
                  No users match these filters.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-md border px-3 py-2 gap-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => openUserDetail(u.id)}
                      >
                        {u.role === 'admin'
                          ? <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                          : <ShieldOff className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{u.email}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.display_name ?? 'No display name'} • joined {timeAgo(u.created_at)}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                          {u.role}
                        </Badge>
                        {u.role !== 'admin' && u.id !== currentUserId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={roleActionId === u.id}
                            onClick={() => handlePromote(u)}
                          >
                            {roleActionId === u.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              'Promote'
                            )}
                          </Button>
                        )}
                        {canDemoteAdmins && u.role === 'admin' && u.id !== currentUserId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={roleActionId === u.id}
                            onClick={() => handleDemote(u)}
                          >
                            {roleActionId === u.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              'Demote'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Showing {filteredUsers.length} of {users.length} users. Role changes take effect on the user&apos;s next login or token refresh.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <UserDetailDialog
        userId={selectedUserId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedUserId(null)
        }}
      />
    </div>
  )
}
