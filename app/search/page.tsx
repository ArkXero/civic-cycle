import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResultsClient } from "./search-results-client";
import type { Metadata } from "next";
import type { MeetingWithSummary } from "@/types";

export const metadata: Metadata = {
  title: "Search",
  description: "Search FCPS School Board meeting summaries",
};

interface SearchResult {
  meetings: MeetingWithSummary[];
  totalPages: number;
  count: number;
}

async function searchMeetings(
  query: string,
  page: number,
): Promise<SearchResult> {
  if (!query.trim()) {
    return { meetings: [], totalPages: 0, count: 0 };
  }

  const supabase = await createClient();
  const pageSize = 9;
  const searchTerms = query.trim().toLowerCase();

  // Search in both meetings (title/transcript) and summaries (summary_text/topics)
  // First, find meeting IDs that match in summaries
  const { data: matchingSummaries } = await supabase
    .from("summaries")
    .select("meeting_id, summary_text, topics");

  // Filter summaries that contain the search terms
  const summaryMatchIds = new Set(
    (matchingSummaries || [])
      .filter((s) => {
        const summary = s as { summary_text: string; topics: string[] };
        const summaryText = summary.summary_text?.toLowerCase() || "";
        const topics = (summary.topics || []).join(" ").toLowerCase();
        return (
          summaryText.includes(searchTerms) || topics.includes(searchTerms)
        );
      })
      .map((s) => (s as { meeting_id: string }).meeting_id),
  );

  // Get all summarized meetings
  const { data: allMeetings } = await supabase
    .from("meetings")
    .select("*")
    .eq("status", "summarized")
    .order("meeting_date", { ascending: false });

  // Filter meetings that match in title, transcript, or have matching summary
  const matchedMeetings = (allMeetings || []).filter((meeting) => {
    const m = meeting as {
      id: string;
      title: string;
      transcript_text: string | null;
    };
    const title = m.title?.toLowerCase() || "";
    const transcript = m.transcript_text?.toLowerCase() || "";

    return (
      title.includes(searchTerms) ||
      transcript.includes(searchTerms) ||
      summaryMatchIds.has(m.id)
    );
  });

  // Apply pagination
  const totalCount = matchedMeetings.length;
  const from = (page - 1) * pageSize;
  const paginatedMeetings = matchedMeetings.slice(from, from + pageSize);

  // Get summaries for paginated meetings
  const meetingIds = paginatedMeetings.map((m) => (m as { id: string }).id);
  let summaries: Record<string, unknown> = {};

  if (meetingIds.length > 0) {
    const { data: summaryData } = await supabase
      .from("summaries")
      .select("*")
      .in("meeting_id", meetingIds);

    summaries = (summaryData || []).reduce(
      (acc, s) => {
        const summary = s as { meeting_id: string };
        acc[summary.meeting_id] = s;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  const transformedMeetings = paginatedMeetings.map((meeting) => {
    const m = meeting as { id: string };
    return Object.assign({}, meeting, {
      summary: summaries[m.id] || null,
    });
  }) as MeetingWithSummary[];

  return {
    meetings: transformedMeetings,
    totalPages: Math.ceil(totalCount / pageSize),
    count: totalCount,
  };
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { meetings, totalPages, count } = await searchMeetings(query, page);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Search Meetings
        </h1>
        <SearchBar initialQuery={query} className="max-w-2xl" />
      </div>

      {query && (
        <Suspense fallback={<SearchLoading />}>
          <SearchResultsClient
            initialResults={meetings}
            initialQuery={query}
            initialPage={page}
            initialTotalPages={totalPages}
            initialTotalCount={count}
          />
        </Suspense>
      )}

      {!query && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Enter a search term to find meetings about topics you care about.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try searching for &quot;budget&quot;, &quot;bell schedules&quot;, or
            &quot;mental health&quot;.
          </p>
        </div>
      )}
    </div>
  );
}

function SearchLoading() {
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
