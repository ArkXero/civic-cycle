import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getMeetingById } from "@/lib/data/meetings";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { MeetingDetail } from "@/components/meetings/meeting-detail";
import type { Metadata } from "next";

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MeetingPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const meeting = await getMeetingById(supabase, id);

  if (!meeting) {
    return { title: "Meeting Not Found" };
  }

  return {
    title: meeting.title,
    description: `Summary of ${meeting.body} meeting on ${new Date(meeting.meeting_date).toLocaleDateString()}`,
  };
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id } = await params;
  const supabase = createAdminClient();
  const [meeting, currentUser] = await Promise.all([
    getMeetingById(supabase, id),
    getCurrentUser(),
  ]);

  if (!meeting) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <MeetingDetail meeting={meeting} isAuthenticated={!!currentUser} />
    </div>
  );
}
