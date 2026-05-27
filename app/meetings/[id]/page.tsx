import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMeetingById } from "@/lib/data/meetings";
import { MeetingDetail } from "@/components/meetings/meeting-detail";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MeetingPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const meeting = await getMeetingById(supabase, id);

  if (!meeting) {
    return { title: "Meeting Not Found" };
  }

  return {
    title: meeting.title,
    description: `Summary of ${meeting.body} meeting on ${formatDate(meeting.meeting_date)}`,
  };
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [meeting, { data: { user } }] = await Promise.all([
    getMeetingById(supabase, id),
    supabase.auth.getUser(),
  ]);

  if (!meeting) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <MeetingDetail meeting={meeting} isAuthenticated={!!user} />
    </div>
  );
}
