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
import { CostTimelineChart } from '@/components/admin/cost-timeline-chart'
import { UserDetailDialog } from '@/components/admin/user-detail-dialog'
import { UserGrowthChart } from '@/components/admin/user-growth-chart'
import { fmtCost, fmtTokens, timeAgo } from '@/components/admin/dashboard-format'
import {
  FileText,
  Users,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  Search,
  Cpu,
  LayoutDashboard,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import type { AdminUser } from '@/app/api/admin/users/route'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  meetings: {
    total: number
    thisMonth: number
    pending: number
    failed: number
    summarized: number
    stuckProcessing: number
    failedLast24h: number
  }
  alerts: {
    totalActive: number
    newThisMonth: number
    emailsSentThisMonth: number
  }
  api: {
    callsThisMonth: number
    inputTokens: number
    outputTokens: number
    costCents: number
  }
  recentActivity: Array<{
    id: number
    action: string
    description: string
    created_at: string
    metadata?: Record<string, unknown>
  }>
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ActivityIcon({ action }: { action: string }) {
  switch (action) {
    case 'meeting_imported':
      return <FileText className="w-4 h-4 text-blue-500 shrink-0" />
    case 'summary_generated':
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
    case 'summary_failed':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
    case 'email_sent':
      return <Mail className="w-4 h-4 text-purple-500 shrink-0" />
    case 'api_error':
      return <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
    case 'user_promoted':
      return <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
    case 'user_demoted':
      return <ShieldOff className="w-4 h-4 text-red-500 shrink-0" />
    default:
      return <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
  }
}

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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [usersLoading, setUsersLoading] = useState(true)
  const [roleActionId, setRoleActionId] = useState<string | null>(null)
  const [chartRefreshKey, setChartRefreshKey] = useState(0)
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

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(false)
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/health'),
      ])
      if (!statsRes.ok || !healthRes.ok) throw new Error('fetch failed')
      const [statsData, healthData] = await Promise.all([
        statsRes.json(),
        healthRes.json(),
      ])
      setStats(statsData)
      setHealth(healthData)
      setChartRefreshKey((key) => key + 1)
    } catch {
      setError(true)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshUsers()])
  }, [refresh, refreshUsers])

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
      await Promise.all([refreshUsers(), refresh(false)])
    } catch {
      alert('Failed to promote user. Please try again.')
    } finally {
      setRoleActionId(null)
    }
  }, [refresh, refreshUsers])

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
      await Promise.all([refreshUsers(), refresh(false)])
    } catch {
      alert('Failed to demote user. Please try again.')
    } finally {
      setRoleActionId(null)
    }
  }, [refresh, refreshUsers])

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
    void refresh()
    void refreshUsers()
    const interval = setInterval(() => {
      void refresh(false)
    }, 60_000)
    return () => clearInterval(interval)
  }, [refresh, refreshUsers])

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !stats || !health) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-destructive">Failed to load dashboard data.</p>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const { meetings, alerts, api, recentActivity } = stats

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading || usersLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Top stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Meetings"
          value={meetings.total}
          sub={`+${meetings.thisMonth} this month`}
          icon={<FileText className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="Summarized"
          value={meetings.summarized}
          sub={`${meetings.failed} failed`}
          icon={<CheckCircle className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="Active Alerts"
          value={alerts.totalActive}
          sub={`+${alerts.newThisMonth} this month`}
          icon={<Users className="w-4 h-4 text-muted-foreground" />}
        />
        <StatCard
          label="API Cost (MTD)"
          value={fmtCost(api.costCents)}
          sub={`${api.callsThisMonth} API call${api.callsThisMonth !== 1 ? 's' : ''}`}
          icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
        />
      </div>

      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Import status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              icon={<AlertCircle className="w-4 h-4 text-yellow-500" />}
              label="Pending"
              count={meetings.pending}
              colorClass="text-yellow-600"
            />
            <StatusRow
              icon={<XCircle className="w-4 h-4 text-red-500" />}
              label="Failed"
              count={meetings.failed}
              colorClass="text-red-600"
            />
            <StatusRow
              icon={<CheckCircle className="w-4 h-4 text-green-500" />}
              label="Summarized"
              count={meetings.summarized}
              colorClass="text-green-600"
            />
            {meetings.stuckProcessing > 0 && (
              <StatusRow
                icon={<AlertCircle className="w-4 h-4 text-orange-500" />}
                label="Stuck processing (>15m)"
                count={meetings.stuckProcessing}
                colorClass="text-orange-600"
              />
            )}
            {meetings.failedLast24h > 0 && (
              <StatusRow
                icon={<XCircle className="w-4 h-4 text-red-500" />}
                label="Failed (last 24h)"
                count={meetings.failedLast24h}
                colorClass="text-red-600"
              />
            )}
            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="/admin/boarddocs">Go to BoardDocs Importer</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System health */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">System Health</CardTitle>
              <Badge variant={health.allHealthy ? 'default' : 'destructive'}>
                {health.allHealthy ? 'All Operational' : 'Issues Detected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.services.map((svc) => (
              <div key={svc.service} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {svc.status === 'healthy'
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />
                  }
                  <span className="text-sm capitalize">
                    {svc.service.replace(/_/g, ' ')}
                  </span>
                  {svc.error && (
                    <span className="text-xs text-destructive truncate max-w-[140px]" title={svc.error}>
                      — {svc.error}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {svc.responseTime}ms
                </span>
              </div>
            ))}
            {health.lastSuccessfulImport && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Last import: {timeAgo(health.lastSuccessfulImport.created_at)}
                {' '}—{' '}
                <span className="italic truncate">{health.lastSuccessfulImport.title}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── API usage ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Claude API — Month to Date</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-500 tabular-nums">
                {fmtTokens(api.inputTokens)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Input tokens</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500 tabular-nums">
                {fmtTokens(api.outputTokens)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Output tokens</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500 tabular-nums">
                {fmtCost(api.costCents)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total cost</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Analytics timelines ───────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <UserGrowthChart refreshKey={chartRefreshKey} />
        <CostTimelineChart refreshKey={chartRefreshKey} />
      </div>

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

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Email / alert stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Email Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums">{alerts.totalActive}</p>
                <p className="text-xs text-muted-foreground mt-1">Active alerts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500 tabular-nums">
                  +{alerts.newThisMonth}
                </p>
                <p className="text-xs text-muted-foreground mt-1">New this month</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500 tabular-nums">
                  {alerts.emailsSentThisMonth}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Emails sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {recentActivity.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3">
                    <ActivityIcon action={entry.action} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function StatusRow({
  icon,
  label,
  count,
  colorClass,
}: {
  icon: React.ReactNode
  label: string
  count: number
  colorClass: string
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant="outline" className={colorClass}>
        {count}
      </Badge>
    </div>
  )
}
