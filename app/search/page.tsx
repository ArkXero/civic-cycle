import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { searchMeetings } from "@/lib/data/meetings";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResultsClient } from "./search-results-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "Search FCPS School Board meeting summaries",
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const { meetings, totalPages, count } = query.trim()
    ? await searchMeetings(await createClient(), { query: query.trim(), page, pageSize: 9 })
    : { meetings: [], totalPages: 0, count: 0 };

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
