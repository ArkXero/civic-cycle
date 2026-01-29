import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
      ),
    );
    const body = searchParams.get("body");

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Bad request", message: "Search query is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
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
    let meetingsQuery = supabase
      .from("meetings")
      .select("*")
      .eq("status", "summarized")
      .order("meeting_date", { ascending: false });

    if (body) {
      meetingsQuery = meetingsQuery.eq("body", body);
    }

    const { data: allMeetings, error } = await meetingsQuery;

    if (error) {
      console.error("Error searching meetings:", error);
      return NextResponse.json(
        { error: "Search failed", message: error.message },
        { status: 500 },
      );
    }

    // Filter meetings that match in title, transcript, or have matching summary
    const meetingsList = (allMeetings || []).filter((meeting) => {
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
    const totalCount = meetingsList.length;
    const from = (page - 1) * pageSize;
    const paginatedMeetings = meetingsList.slice(from, from + pageSize);

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

    // Combine meetings with their summaries
    const transformedMeetings = paginatedMeetings.map((meeting) => {
      const m = meeting as { id: string };
      return Object.assign({}, meeting, {
        summary: summaries[m.id] || null,
      });
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return NextResponse.json({
      data: transformedMeetings,
      count: totalCount,
      page,
      pageSize,
      totalPages,
      query,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
