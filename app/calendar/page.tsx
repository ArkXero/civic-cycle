import { createClient } from "@/lib/supabase/server";
import { dedupeMeetingsBySourceUrl } from "@/lib/data/meetings";
import { getPreferredDistrictId } from "@/lib/account-profile";
import { getSchoolDistrict, type SchoolDistrictId } from "@/lib/school-districts";
import { MeetingCalendar, type CalendarEvent } from "@/components/ui/meeting-calendar";
import { ViewingDistrict } from "@/components/school-district/viewing-district";
import { parseDateAsLocal } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar",
  description: "View school board meetings on a calendar",
};

async function getAllMeetings(districtId: SchoolDistrictId) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("meetings")
    .select("id, title, meeting_date, body, status, source, source_url")
    .eq("district_id", districtId)
    .order("meeting_date", { ascending: false });
  return dedupeMeetingsBySourceUrl((data ?? []) as CalendarMeeting[]);
}

interface CalendarMeeting {
  id: string;
  title: string;
  meeting_date: string;
  body: string;
  status: string;
  source?: string | null;
  source_url?: string | null;
}

function toCalendarEvent(meeting: CalendarMeeting): CalendarEvent {
  const start = parseDateAsLocal(meeting.meeting_date);
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

interface CalendarPageProps {
  searchParams: Promise<{ districtId?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const districtId = await getPreferredDistrictId(supabase, params.districtId);
  const district = getSchoolDistrict(districtId);
  const meetings = await getAllMeetings(districtId);
  const events = meetings.map(toCalendarEvent);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Meeting Calendar</h1>
        <p className="text-muted-foreground mb-4">
          View upcoming and past {district.boardBodyLabel} meetings.
          {events.length > 0 &&
            ` ${events.length} meeting${events.length !== 1 ? "s" : ""} scheduled.`}
        </p>
        <ViewingDistrict districtId={districtId} />
      </div>
      <MeetingCalendar events={events} defaultView="month" />
    </div>
  );
}
