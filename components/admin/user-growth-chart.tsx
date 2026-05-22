'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatChartDateKey } from '@/components/admin/dashboard-format'

type Range = '7d' | '30d' | '90d' | 'all'

type UserGrowthPoint = {
  date: string
  new_signups: number
  cumulative: number
}

type UserGrowthResponse = {
  range: Range
  points: UserGrowthPoint[]
}

const ranges: Array<{ value: Range; label: string }> = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

const chartConfig = {
  new_signups: {
    label: 'New signups',
    color: 'var(--chart-1)',
  },
  cumulative: {
    label: 'Cumulative',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

function currentDateKey() {
  return new Date().toISOString().slice(0, 10)
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function signupFooter(points: UserGrowthPoint[], range: Range) {
  if (range === 'all') {
    const monthKey = new Date().toISOString().slice(0, 7)
    const thisMonth = points.find((point) => point.date === monthKey)?.new_signups ?? 0
    return `+${thisMonth} this month`
  }

  const start = startOfUtcDay(new Date())
  start.setUTCDate(start.getUTCDate() - 6)
  const startKey = start.toISOString().slice(0, 10)
  const thisWeek = points
    .filter((point) => point.date >= startKey && point.date <= currentDateKey())
    .reduce((sum, point) => sum + point.new_signups, 0)

  return `+${thisWeek} this week`
}

export function UserGrowthChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [range, setRange] = useState<Range>('30d')
  const [points, setPoints] = useState<UserGrowthPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/admin/analytics/user-growth?range=${range}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) throw new Error('fetch failed')

      const data = await res.json() as UserGrowthResponse
      setPoints(data.points)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    const controller = new AbortController()
    void fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData, refreshKey, retryKey])

  const footer = useMemo(() => signupFooter(points, range), [points, range])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">User Growth</CardTitle>
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
            <TabsList className="h-8">
              {ranges.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="h-7 px-2.5 text-xs">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">Failed to load user growth.</p>
            <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
              <AreaChart data={points} margin={{ left: 4, right: 4, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={formatChartDateKey}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={32}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={36}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatChartDateKey(String(label))}
                      formatter={(value, name) => (
                        <>
                          <span className="text-muted-foreground">
                            {name === 'new_signups' ? 'New signups' : 'Cumulative'}
                          </span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {Number(value).toLocaleString()}
                          </span>
                        </>
                      )}
                    />
                  }
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="new_signups"
                  stroke="var(--color-new_signups)"
                  fill="var(--color-new_signups)"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--color-cumulative)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">{footer}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
