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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Meeting Summaries
        </h1>
        <p className="text-muted-foreground mb-4">
          Browse AI-generated summaries of {district.boardBodyLabel} meetings.
          {count > 0 && ` ${count} meeting${count !== 1 ? "s" : ""} available.`}
        </p>
        <div className="mb-4">
          <ViewingDistrict districtId={districtId} />
        </div>
        <SearchBar
          placeholder="Search meetings..."
          className="max-w-xl mb-4"
          districtId={districtId}
        />
        <MeetingFilters
          currentBody={body}
          topicGroups={topicGroups}
          selectedTopics={selectedTopics}
        />
      </div>

      <Suspense fallback={<MeetingsLoading />}>
        <MeetingListClient
          initialMeetings={meetings}
          initialPage={page}
          initialTotalPages={totalPages}
        />
      </Suspense>
    </div>
  );
}

function MeetingsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-64 bg-card rounded-lg border border-border animate-pulse"
        />
      ))}
    </div>
  );
}
