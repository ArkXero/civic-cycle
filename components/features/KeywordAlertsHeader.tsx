"use client";

import { AnimatedList } from "@/components/ui/animated-list";

interface Notification {
  name: string;
  description: string;
  icon: string;
  color: string;
  time: string;
}

const notifications: Notification[] = [
  { name: "New Summary", description: "Feb 14 Board Meeting published", icon: "📋", color: "#1A8A9A", time: "2m ago" },
  { name: "Keyword Match", description: "\"budget\" found in Jan 28 Meeting", icon: "🔔", color: "#F5A623", time: "5m ago" },
  { name: "Keyword Match", description: "\"curriculum\" found in Jan 14 Meeting", icon: "🔔", color: "#F5A623", time: "12m ago" },
  { name: "New Summary", description: "Dec 10 Board Meeting published", icon: "📋", color: "#1A8A9A", time: "1h ago" },
];

const repeatedNotifications = Array.from({ length: 5 }, () => notifications).flat();

function NotificationCard({ name, description, icon, color, time }: Notification) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-sm"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{time}</span>
    </div>
  );
}

export default function KeywordAlertsHeader() {
  return (
    <div className="relative h-48 w-full overflow-hidden">
      <AnimatedList delay={1500}>
        {repeatedNotifications.map((n, i) => (
          <NotificationCard key={`${n.name}-${i}`} {...n} />
        ))}
      </AnimatedList>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card dark:from-[#0f2535]" />
    </div>
  );
}
