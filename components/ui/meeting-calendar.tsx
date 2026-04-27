"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar, Clock, Grid3x3, List, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CalendarEvent {
  id: string
  title: string
  startTime: Date
  endTime: Date
  color: string
  category?: string
  description?: string
}

export interface MeetingCalendarProps {
  events?: CalendarEvent[]
  defaultView?: "month" | "week" | "list"
  className?: string
}

const MEETING_COLORS = [
  { name: "Blue", value: "blue", bg: "bg-blue-500", text: "text-blue-700" },
  { name: "Purple", value: "purple", bg: "bg-purple-500", text: "text-purple-700" },
]

export function MeetingCalendar({
  events = [],
  defaultView = "month",
  className,
}: MeetingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "list">(defaultView)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events
    const query = searchQuery.toLowerCase()
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.category?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query),
    )
  }, [events, searchQuery])

  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const d = new Date(prev)
        if (view === "month") d.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1))
        else if (view === "week") d.setDate(prev.getDate() + (direction === "next" ? 7 : -7))
        return d
      })
    },
    [view],
  )

  const getColorClasses = useCallback((colorValue: string) => {
    return MEETING_COLORS.find((c) => c.value === colorValue) ?? MEETING_COLORS[0]
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsDialogOpen(true)
  }, [])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold sm:text-2xl">
            {view === "month" &&
              currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {view === "week" &&
              `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {view === "list" && "All Meetings"}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Mobile: Select dropdown */}
          <div className="sm:hidden">
            <Select value={view} onValueChange={(value: "month" | "week" | "list") => setView(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Month View
                  </div>
                </SelectItem>
                <SelectItem value="week">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-4 w-4" />
                    Week View
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    List View
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Button group */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border bg-background p-1">
            <Button variant={view === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setView("month")} className="h-8">
              <Calendar className="h-4 w-4" />
              <span className="ml-1">Month</span>
            </Button>
            <Button variant={view === "week" ? "secondary" : "ghost"} size="sm" onClick={() => setView("week")} className="h-8">
              <Grid3x3 className="h-4 w-4" />
              <span className="ml-1">Week</span>
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")} className="h-8">
              <List className="h-4 w-4" />
              <span className="ml-1">List</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search meetings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Views */}
      {view === "month" && (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={handleEventClick}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={handleEventClick}
          getColorClasses={getColorClasses}
        />
      )}
      {view === "list" && (
        <ListView
          events={filteredEvents}
          onEventClick={handleEventClick}
          getColorClasses={getColorClasses}
        />
      )}

      {/* Read-only detail dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>{selectedEvent?.category}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>
                {selectedEvent?.startTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {selectedEvent?.category && (
              <Badge variant="secondary">{selectedEvent.category}</Badge>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
            {selectedEvent && (
              <Button asChild>
                <a href={`/meetings/${selectedEvent.id}`}>View Summary</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventCard({
  event,
  onEventClick,
  getColorClasses,
  variant = "default",
}: {
  event: CalendarEvent
  onEventClick: (event: CalendarEvent) => void
  getColorClasses: (color: string) => { bg: string; text: string }
  variant?: "default" | "compact" | "detailed"
}) {
  const [isHovered, setIsHovered] = useState(false)
  const colorClasses = getColorClasses(event.color)

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  if (variant === "compact") {
    return (
      <div
        onClick={() => onEventClick(event)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative cursor-pointer"
      >
        <div
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium transition-all duration-300",
            colorClasses.bg,
            "text-white truncate animate-in fade-in slide-in-from-top-1",
            isHovered && "scale-105 shadow-lg z-10",
          )}
        >
          {event.title}
        </div>
        {isHovered && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 animate-in fade-in slide-in-from-top-2 duration-200">
            <Card className="border-2 p-3 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-tight">{event.title}</h4>
                  <div className={cn("h-3 w-3 rounded-full flex-shrink-0", colorClasses.bg)} />
                </div>
                {event.category && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {event.category}
                  </Badge>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    )
  }

  if (variant === "detailed") {
    return (
      <div
        onClick={() => onEventClick(event)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "cursor-pointer rounded-lg p-3 transition-all duration-300",
          colorClasses.bg,
          "text-white animate-in fade-in slide-in-from-left-2",
          isHovered && "scale-[1.03] shadow-2xl ring-2 ring-white/50",
        )}
      >
        <div className="font-semibold">{event.title}</div>
        {event.category && <div className="mt-1 text-sm opacity-90">{event.category}</div>}
        <div className="mt-2 flex items-center gap-2 text-xs opacity-80">
          <Clock className="h-3 w-3" />
          {formatTime(event.startTime)}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => onEventClick(event)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative cursor-pointer"
    >
      <div
        className={cn(
          "rounded px-2 py-1 text-xs font-medium transition-all duration-300",
          colorClasses.bg,
          "text-white animate-in fade-in slide-in-from-left-1",
          isHovered && "scale-105 shadow-lg z-10",
        )}
      >
        <div className="truncate">{event.title}</div>
      </div>
      {isHovered && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 animate-in fade-in slide-in-from-top-2 duration-200">
          <Card className="border-2 p-4 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold leading-tight">{event.title}</h4>
                <div className={cn("h-4 w-4 rounded-full flex-shrink-0", colorClasses.bg)} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatTime(event.startTime)}</span>
              </div>
              {event.category && (
                <Badge variant="secondary" className="text-xs">
                  {event.category}
                </Badge>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function MonthView({
  currentDate,
  events,
  onEventClick,
  getColorClasses,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  const days: Date[] = []
  const cur = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const getEventsForDay = (date: Date) =>
    events.filter((e) => {
      const d = new Date(e.startTime)
      return (
        d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear()
      )
    })

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="border-r p-2 text-center text-xs font-medium last:border-r-0 sm:text-sm">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div
              key={index}
              className={cn(
                "min-h-20 border-b border-r p-1 transition-colors last:border-r-0 sm:min-h-24 sm:p-2",
                !isCurrentMonth && "bg-muted/30",
                "hover:bg-accent/50",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs sm:h-6 sm:w-6 sm:text-sm",
                  isToday && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEventClick={onEventClick}
                    getColorClasses={getColorClasses}
                    variant="compact"
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground sm:text-xs">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function WeekView({
  currentDate,
  events,
  onEventClick,
  getColorClasses,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getEventsForDayAndHour = (date: Date, hour: number) =>
    events.filter((e) => {
      const d = new Date(e.startTime)
      return (
        d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear() &&
        d.getHours() === hour
      )
    })

  return (
    <Card className="overflow-auto">
      <div className="grid grid-cols-8 border-b">
        <div className="border-r p-2 text-center text-xs font-medium sm:text-sm">Time</div>
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="border-r p-2 text-center text-xs font-medium last:border-r-0 sm:text-sm">
            <div className="hidden sm:block">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
            <div className="sm:hidden">{day.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
            <div className="text-[10px] text-muted-foreground sm:text-xs">
              {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-8">
        {hours.map((hour) => (
          <React.Fragment key={hour}>
            <div className="border-b border-r p-1 text-[10px] text-muted-foreground sm:p-2 sm:text-xs">
              {hour.toString().padStart(2, "0")}:00
            </div>
            {weekDays.map((day) => {
              const dayEvents = getEventsForDayAndHour(day, hour)
              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="min-h-12 border-b border-r p-0.5 transition-colors hover:bg-accent/50 last:border-r-0 sm:min-h-16 sm:p-1"
                >
                  <div className="space-y-1">
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onEventClick={onEventClick}
                        getColorClasses={getColorClasses}
                        variant="default"
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </Card>
  )
}

function ListView({
  events,
  onEventClick,
  getColorClasses,
}: {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  getColorClasses: (color: string) => { bg: string; text: string }
}) {
  const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  const grouped = sorted.reduce(
    (acc, event) => {
      const key = event.startTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      if (!acc[key]) acc[key] = []
      acc[key].push(event)
      return acc
    },
    {} as Record<string, CalendarEvent[]>,
  )

  return (
    <Card className="p-3 sm:p-4">
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, dateEvents]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground sm:text-sm">{date}</h3>
            <div className="space-y-2">
              {dateEvents.map((event) => {
                const colorClasses = getColorClasses(event.color)
                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="group cursor-pointer rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-2 duration-300 sm:p-4"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={cn("mt-1 h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 flex-shrink-0", colorClasses.bg)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h4 className="font-semibold text-sm group-hover:text-primary transition-colors sm:text-base truncate">
                            {event.title}
                          </h4>
                          {event.category && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              {event.category}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
                          <Clock className="h-3 w-3" />
                          {event.startTime.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground sm:text-base">
            No meetings found
          </div>
        )}
      </div>
    </Card>
  )
}
