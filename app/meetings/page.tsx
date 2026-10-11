import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMeetingList } from "@/lib/data/meetings";
import { getPreferredDistrictId } from "@/lib/account-profile";
import { getSchoolDistrict } from "@/lib/school-districts";
import { getApprovedTopicHierarchy } from "@/lib/data/topics";
import { MeetingListClient } from "./meeting-list-client";
import { SearchBar } from "@/components/search/search-bar";
import { MeetingFilters } from "@/components/meetings/meeting-filters";
import { ViewingDistrict } from "@/components/school-district/viewing-district";
import { loadMotionDigests } from "@/lib/data/motion-digests";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meetings",
  description: "Browse school board meeting summaries",
};

interface MeetingsPageProps {
  searchParams: Promise<{
    page?: string;
    body?: string;
    districtId?: string;
    topic?: string | string[];
    status?: string | string[];
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function MeetingsPage({
  searchParams,
}: MeetingsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const body = params.body;
  const selectedTopics = Array.isArray(params.topic)
    ? params.topic
    : params.topic
      ? [params.topic]
      : [];
  const selectedStatuses = (Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : []).filter((status) => ["pending", "processing", "summarized", "failed"].includes(status));
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom ?? "") ? params.dateFrom : undefined;
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(params.dateTo ?? "") ? params.dateTo : undefined;

  const supabase = await createClient();
  const districtId = await getPreferredDistrictId(supabase, params.districtId);
  const district = getSchoolDistrict(districtId);
  const [{ meetings, totalPages, count }, topicGroups] = await Promise.all([
    getMeetingList(supabase, {
      page,
      body,
      pageSize: 9,
      districtId,
      topicSlugs: selectedTopics,
      statusFilter: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      dateFrom,
      dateTo,
    }),
    getApprovedTopicHierarchy(supabase),
  ]);
  const digests = await loadMotionDigests(meetings.map((meeting) => meeting.id));

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-6 md:py-14">
      <header className="mb-10 space-y-5">
        <p className="docket">
          {district.boardBodyLabel}
          {count > 0 && ` · ${count.toLocaleString()} meeting${count !== 1 ? "s" : ""} on record`}
        </p>
        <h1 className="text-[clamp(2.25rem,5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-foreground">
          Meetings
        </h1>
        <p className="max-w-[60ch] text-[16px] text-muted-foreground">
          Every board meeting, newest first, with how the votes went. Open one to read the
          summary and the full motion record.
        </p>
        <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:gap-4">
          <SearchBar
            placeholder="Search meetings, motions, topics…"
            className="w-full max-w-xl"
            districtId={districtId}
          />
          <ViewingDistrict districtId={districtId} />
        </div>
        <MeetingFilters
          currentBody={body}
          topicGroups={topicGroups}
          selectedTopics={selectedTopics}
        />
      </header>

      <Suspense fallback={<MeetingsLoading />}>
        <MeetingListClient
          initialMeetings={meetings}
          initialPage={page}
          initialTotalPages={totalPages}
          digests={digests}
        />
      </Suspense>
    </div>
  );
}

function MeetingsLoading() {
  return (
    <div className="border-t-2 border-rule">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-28 animate-pulse border-b border-border bg-muted/40" />
      ))}
    </div>
  );
}
