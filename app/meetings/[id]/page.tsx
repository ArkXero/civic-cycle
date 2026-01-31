import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MeetingDetail } from "@/components/meetings/meeting-detail";
import type { Metadata } from "next";
import type { MeetingWithSummary } from "@/types";

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MeetingPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select("title, body, meeting_date")
    .eq("id", id)
    .single();

  if (error || !data) {
    return {
      title: "Meeting Not Found",
    };
  }

  const meeting = data as { title: string; body: string; meeting_date: string };

  return {
    title: meeting.title,
    description: `Summary of ${meeting.body} meeting on ${new Date(meeting.meeting_date).toLocaleDateString()}`,
  };
}

async function getMeeting(id: string): Promise<MeetingWithSummary | null> {
  const supabase = await createClient();

  // Get meeting
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .single();

  if (meetingError || !meeting) {
    return null;
  }

  // Get summary separately
  const { data: summaries } = await supabase
    .from("summaries")
    .select("*")
    .eq("meeting_id", id)
    .limit(1);

  return Object.assign({}, meeting, {
    summary: summaries?.[0] || null,
  }) as MeetingWithSummary;
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    notFound();
  }

  // Check if user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <MeetingDetail meeting={meeting} isAuthenticated={!!user} />
    </div>
  );
}
