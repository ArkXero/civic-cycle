import { createClient } from "@/lib/supabase/server";
import { MeetingCalendar, type CalendarEvent } from "@/components/ui/meeting-calendar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar",
  description: "View FCPS School Board meetings on a calendar",
};

async function getAllMeetings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, body, status")
    .order("meeting_date", { ascending: false });
  return data ?? [];
}

function toCalendarEvent(meeting: {
  id: string;
  title: string;
  meeting_date: string;
  body: string;
  status: string;
}): CalendarEvent {
  const start = new Date(meeting.meeting_date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    id: meeting.id,
    title: meeting.title,
    startTime: start,
    endTime: end,
    color: meeting.body === "FCPS School Board" ? "blue" : "purple",
    category: meeting.body,
  };
}

export default async function CalendarPage() {
  const meetings = await getAllMeetings();
  const events = meetings.map(toCalendarEvent);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Meeting Calendar</h1>
        <p className="text-muted-foreground">
          View upcoming and past FCPS School Board meetings.
          {events.length > 0 &&
            ` ${events.length} meeting${events.length !== 1 ? "s" : ""} scheduled.`}
        </p>
      </div>
      <MeetingCalendar events={events} defaultView="month" />
    </div>
  );
}
