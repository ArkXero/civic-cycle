'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  CircleDollarSign,
  FileText,
  Mail,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Area } from '@/components/charts/area'
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip'
import type { TooltipRow } from '@/components/charts/tooltip/tooltip-content'
import { ComposedChart } from '@/components/charts/composed-chart'
import { Grid } from '@/components/charts/grid'
import { Line } from '@/components/charts/line'
import { SeriesBar } from '@/components/charts/series-bar'
import { XAxis } from '@/components/charts/x-axis'
import { YAxis } from '@/components/charts/y-axis'
import { fmtTokens, fmtUsdMicros, timeAgo } from '@/components/admin/dashboard-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  AdminAnalyticsRange,
  AdminAnalyticsResponse,
} from '@/types/admin-analytics'

const ranges: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]

const chartColors = {
  primary: 'var(--chart-line-primary)',
  secondary: 'var(--chart-line-secondary)',
  accent: 'var(--chart-3)',
  dark: 'var(--chart-4)',
  muted: 'var(--chart-5)',
  destructive: 'var(--destructive)',
}

function chartDate(key: string) {
  return new Date(`${key}${/^\d{4}-\d{2}$/.test(key) ? '-01' : ''}T12:00:00`)
}

function rangeDescription(range: AdminAnalyticsRange) {
  if (range === 'all') return 'across all recorded activity'
  return `in the last ${range.replace('d', ' days')}`
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) {
    return <span>All recorded data</span>
  }

  const change = percentChange(current, previous)
  if (change === null) {
    return <span>New activity this period</span>
  }

  const positive = change >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(change).toFixed(0)}% {positive ? 'up' : 'down'}
    </span>
  )
}

function MetricCard({
  label,
  value,
  detail,
  delta,
  icon,
}: {
  label: string
  value: string
  detail: string
  delta?: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/95">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          </div>
          <div className="rounded-xl border bg-muted/45 p-2.5 text-primary">{icon}</div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{detail}</span>
          {delta && <span className="font-medium text-foreground/75">{delta}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  description,
  empty,
  children,
}: {
  title: string
  description: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="min-w-0 border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              No activity was recorded for this range.
            </p>
          </div>
        ) : children}
      </CardContent>
    </Card>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard analytics" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/35" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-96 animate-pulse rounded-xl border bg-muted/25" />
        ))}
      </div>
    </div>
  )
}

export function AdminAnalytics({ refreshKey = 0 }: { refreshKey?: number }) {
  const [range, setRange] = useState<AdminAnalyticsRange>('30d')
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch(`/api/admin/analytics?range=${range}`, {
        cache: 'no-store',
        signal,
      })
      if (!response.ok) throw new Error('Failed to load analytics')
      setData(await response.json() as AdminAnalyticsResponse)
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    const controller = new AbortController()
    void fetchAnalytics(controller.signal)
    return () => controller.abort()
  }, [fetchAnalytics, refreshKey, retryKey])

  const chartData = useMemo(() => {
    if (!data) return null
    return {
      processing: data.series.processing.map((point) => ({
        ...point,
        date: chartDate(point.date),
        success_rate: point.succeeded + point.failed === 0
          ? 0
          : point.succeeded * 100 / (point.succeeded + point.failed),
      })),
      users: data.series.users.map((point) => ({ ...point, date: chartDate(point.date) })),
      api: data.series.api.map((point) => ({
        ...point,
        date: chartDate(point.date),
        cost_usd: point.cost_usd_micros / 1_000_000,
      })),
      alerts: data.series.alerts.map((point) => ({ ...point, date: chartDate(point.date) })),
    }
  }, [data])

  if (loading && !data) return <AnalyticsSkeleton />

  if (error || !data || !chartData) {
    return (
      <Card className="border-destructive/35">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center" aria-live="assertive">
          <AlertTriangle className="size-7 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Dashboard analytics could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Health and user controls remain available below.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
            <RefreshCw className="mr-2 size-4" /> Retry analytics
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { kpis, meeting_status: meetingStatus } = data
  const previous = kpis.previous
  const processingEmpty = chartData.processing.every((point) => point.succeeded + point.failed === 0)
  const apiEmpty = chartData.api.every((point) => point.calls === 0)
  const usersEmpty = chartData.users.every((point) => point.new_users === 0)
  const alertsEmpty = chartData.alerts.every((point) => point.sent + point.failed + point.bounced === 0)

  return (
    <section className="space-y-6" aria-labelledby="analytics-heading">
      <div className="flex flex-col gap-4 rounded-xl border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="analytics-heading" className="text-lg font-semibold">Operational analytics</h2>
            {loading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" aria-label="Refreshing analytics" />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Updated {timeAgo(data.as_of)} · {data.timezone.replace('_', ' ')}
          </p>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as AdminAnalyticsRange)}>
          <TabsList className="grid h-auto w-full grid-cols-4 sm:w-auto" aria-label="Analytics date range">
            {ranges.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="px-3 text-xs">
                <span className="sm:hidden">{item.value === 'all' ? 'All' : item.value}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {data.data_quality.unknown_pricing_calls > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            {data.data_quality.unknown_pricing_calls} API call{data.data_quality.unknown_pricing_calls === 1 ? '' : 's'} used an unknown pricing model. Their stored fallback cost is included.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Meetings"
          value={kpis.meetings.total.toLocaleString()}
          detail={`${kpis.meetings.imported.toLocaleString()} imported ${rangeDescription(range)}`}
          icon={<FileText className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Successful runs"
          value={kpis.processing.succeeded.toLocaleString()}
          detail={kpis.processing.success_rate === null
            ? 'No completed runs in range'
            : `${kpis.processing.success_rate.toFixed(1)}% success rate`}
          delta={<Delta current={kpis.processing.succeeded} previous={previous?.processing_succeeded} />}
          icon={<CheckCircle className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="Registered users"
          value={kpis.users.total.toLocaleString()}
          detail={`${kpis.users.new_users.toLocaleString()} joined ${rangeDescription(range)}`}
          delta={<Delta current={kpis.users.new_users} previous={previous?.new_users} />}
          icon={<Users className="size-5" aria-hidden="true" />}
        />
        <MetricCard
          label="AI spend"
          value={fmtUsdMicros(kpis.api.cost_usd_micros)}
          detail={`${kpis.api.calls.toLocaleString()} calls · ${fmtTokens(kpis.api.input_tokens + kpis.api.output_tokens)} tokens`}
          delta={<Delta current={kpis.api.cost_usd_micros} previous={previous?.api_cost_usd_micros} />}
          icon={<CircleDollarSign className="size-5" aria-hidden="true" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Processing activity"
          description="Completed and failed summary runs, with daily success rate."
          empty={processingEmpty}
        >
          <ComposedChart data={chartData.processing} aspectRatio="2 / 1" margin={{ top: 20, right: 52, bottom: 42, left: 42 }} maxBarSize={20}>
            <Grid horizontal />
            <SeriesBar dataKey="succeeded" fill={chartColors.primary} radius={4} />
            <SeriesBar dataKey="failed" fill={chartColors.destructive} radius={4} />
            <Line dataKey="success_rate" yAxisId="right" stroke={chartColors.accent} strokeWidth={2} />
            <XAxis numTicks={5} />
            <YAxis yAxisId="left" formatLargeNumbers />
            <YAxis yAxisId="right" orientation="right" formatValue={(value) => `${Math.round(value)}%`} />
            <ChartTooltip rows={(point): TooltipRow[] => [
              { color: chartColors.primary, label: 'Succeeded', value: Number(point.succeeded) },
              { color: chartColors.destructive, label: 'Failed', value: Number(point.failed) },
              { color: chartColors.accent, label: 'Success rate', value: `${Number(point.success_rate).toFixed(1)}%` },
            ]} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="AI usage and spend"
          description="Every billable attempt is included, including failed calls."
          empty={apiEmpty}
        >
          <ComposedChart data={chartData.api} aspectRatio="2 / 1" margin={{ top: 20, right: 52, bottom: 42, left: 54 }} maxBarSize={22}>
            <Grid horizontal />
            <SeriesBar dataKey="cost_usd" fill={chartColors.primary} radius={4} />
            <Line dataKey="calls" yAxisId="right" stroke={chartColors.accent} strokeWidth={2.25} />
            <XAxis numTicks={5} />
            <YAxis yAxisId="left" formatValue={(value) => `$${value.toFixed(value < 1 ? 2 : 0)}`} />
            <YAxis yAxisId="right" orientation="right" formatLargeNumbers />
            <ChartTooltip rows={(point): TooltipRow[] => [
              { color: chartColors.primary, label: 'Cost', value: fmtUsdMicros(Number(point.cost_usd_micros)) },
              { color: chartColors.accent, label: 'API calls', value: Number(point.calls) },
              { color: chartColors.destructive, label: 'Failed calls', value: Number(point.failed_calls) },
              { color: chartColors.muted, label: 'Meetings', value: Number(point.meetings) },
            ]} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="User growth"
          description="New accounts and the cumulative registered-user total."
          empty={usersEmpty}
        >
          <ComposedChart data={chartData.users} aspectRatio="2 / 1" margin={{ top: 20, right: 52, bottom: 42, left: 42 }} maxBarSize={20}>
            <Grid horizontal />
            <Area dataKey="new_users" fill={chartColors.secondary} fillOpacity={0.2} />
            <Line dataKey="cumulative" yAxisId="right" stroke={chartColors.primary} strokeWidth={2.5} />
            <XAxis numTicks={5} />
            <YAxis yAxisId="left" formatLargeNumbers={false} />
            <YAxis yAxisId="right" orientation="right" formatLargeNumbers={false} />
            <ChartTooltip rows={(point): TooltipRow[] => [
              { color: chartColors.secondary, label: 'New users', value: Number(point.new_users) },
              { color: chartColors.primary, label: 'Total users', value: Number(point.cumulative) },
            ]} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Alert delivery"
          description="Sent, failed, and bounced keyword-alert emails."
          empty={alertsEmpty}
        >
          <ComposedChart data={chartData.alerts} aspectRatio="2 / 1" margin={{ top: 20, right: 28, bottom: 42, left: 42 }} maxBarSize={24} stacked stackGap={1}>
            <Grid horizontal />
            <SeriesBar dataKey="sent" fill={chartColors.primary} radius={3} />
            <SeriesBar dataKey="failed" fill={chartColors.destructive} radius={3} />
            <SeriesBar dataKey="bounced" fill={chartColors.accent} radius={3} />
            <XAxis numTicks={5} />
            <YAxis formatLargeNumbers={false} />
            <ChartTooltip rows={(point): TooltipRow[] => [
              { color: chartColors.primary, label: 'Sent', value: Number(point.sent) },
              { color: chartColors.destructive, label: 'Failed', value: Number(point.failed) },
              { color: chartColors.accent, label: 'Bounced', value: Number(point.bounced) },
            ]} />
          </ComposedChart>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Current meeting state</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Summarized', meetingStatus.summarized, 'text-primary'],
              ['Pending', meetingStatus.pending, 'text-amber-600'],
              ['Processing', meetingStatus.processing, 'text-blue-600'],
              ['Failed', meetingStatus.failed, 'text-destructive'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
                <p className={`text-2xl font-semibold tabular-nums ${color}`}>{Number(value).toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
            {meetingStatus.stuck_processing > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Badge variant="destructive">{meetingStatus.stuck_processing} stuck processing for more than 15 minutes</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Alert snapshot</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-2xl font-semibold tabular-nums">{kpis.alerts.active_rules}</p>
              <p className="mt-1 text-xs text-muted-foreground">Active rules</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-2xl font-semibold tabular-nums">{kpis.alerts.subscribers}</p>
              <p className="mt-1 text-xs text-muted-foreground">Subscribers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity has been recorded.</p>
          ) : (
            <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {data.recent_activity.slice(0, 12).map((entry) => (
                <li key={entry.id} className="flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{entry.description}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{timeAgo(entry.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
