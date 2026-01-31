import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
      ),
    );
    const body = searchParams.get("body");

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from("meetings")
      .select(
        `
        *,
        summary:summaries(*)
      `,
        { count: "exact" },
      )
      .order("meeting_date", { ascending: false });

    // Apply body filter if provided
    if (body) {
      query = query.eq("body", body);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: meetings, error, count } = await query;

    if (error) {
      console.error("Error fetching meetings:", error);
      return NextResponse.json(
        { error: "Failed to fetch meetings", message: error.message },
        { status: 500 },
      );
    }

    // Transform the data to flatten the summary relationship
    const transformedMeetings =
      meetings?.map((meeting) => {
        const meetingWithSummary = meeting as { summary?: unknown[] };
        return Object.assign({}, meeting, {
          summary: meetingWithSummary.summary?.[0] || null,
        });
      }) || [];

    const totalPages = Math.ceil((count || 0) / pageSize);

    return NextResponse.json({
      data: transformedMeetings,
      count: count || 0,
      page,
      pageSize,
      totalPages,
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
