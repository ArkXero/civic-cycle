import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMeetingList } from "@/lib/data/meetings";
import { MeetingListClient } from "./meeting-list-client";
import { SearchBar } from "@/components/search/search-bar";
import { MeetingFilters } from "@/components/meetings/meeting-filters";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meetings",
  description: "Browse FCPS School Board meeting summaries",
};

interface MeetingsPageProps {
  searchParams: Promise<{ page?: string; body?: string }>;
}

export default async function MeetingsPage({
  searchParams,
}: MeetingsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const body = params.body;

  const supabase = await createClient();
  const { meetings, totalPages, count } = await getMeetingList(supabase, { page, body, pageSize: 9 });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Meeting Summaries
        </h1>
        <p className="text-muted-foreground mb-4">
          Browse AI-generated summaries of FCPS School Board meetings.
          {count > 0 && ` ${count} meeting${count !== 1 ? "s" : ""} available.`}
        </p>
        <SearchBar placeholder="Search meetings..." className="max-w-xl mb-4" />
        <MeetingFilters currentBody={body} />
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
