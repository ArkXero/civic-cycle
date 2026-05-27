'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtCost, formatChartDateKey } from '@/components/admin/dashboard-format'

type Range = '7d' | '30d' | '90d' | 'all'

type CostTimelinePoint = {
  date: string
  cost_cents: number
  summaries: number
}

type CostTimelineResponse = {
  range: Range
  points: CostTimelinePoint[]
  total_cost_cents: number
}

const ranges: Array<{ value: Range; label: string }> = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
]

const chartConfig = {
  cost_cents: {
    label: 'Cost',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function CostTimelineChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const [range, setRange] = useState<Range>('30d')
  const [points, setPoints] = useState<CostTimelinePoint[]>([])
  const [totalCostCents, setTotalCostCents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/admin/analytics/cost-timeline?range=${range}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) throw new Error('fetch failed')

      const data = await res.json() as CostTimelineResponse
      setPoints(data.points)
      setTotalCostCents(data.total_cost_cents)
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

  const footer = useMemo(() => {
    if (range === 'all') return `${fmtCost(totalCostCents)} total`
    const todayCostCents = points.find((point) => point.date === todayKey())?.cost_cents ?? 0
    return `${fmtCost(todayCostCents)} today`
  }, [points, range, totalCostCents])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">API Cost</CardTitle>
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
            <p className="text-sm text-destructive">Failed to load API cost.</p>
            <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
              <BarChart data={points} margin={{ left: 4, right: 4, top: 12, bottom: 0 }}>
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
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={48}
                  tickFormatter={(value) => fmtCost(Number(value))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatChartDateKey(String(label))}
                      formatter={(value, name, item) => (
                        <>
                          <span className="text-muted-foreground">
                            {name === 'cost_cents' ? 'Cost' : String(name)}
                          </span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {fmtCost(Number(value))}
                          </span>
                          {typeof item.payload?.summaries === 'number' && (
                            <span className="ml-2 text-muted-foreground">
                              {item.payload.summaries} summar{item.payload.summaries === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="cost_cents"
                  fill="var(--color-cost_cents)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">{footer}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
