import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchMeetings } from "@/lib/data/meetings";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)),
    );
    const body = searchParams.get("body") ?? undefined;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Bad request", message: "Search query is required" },
        { status: 400 },
      );
    }

    if (query.length > 200) {
      return NextResponse.json(
        { error: "Bad request", message: "Search query must be 200 characters or fewer" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const result = await searchMeetings(supabase, { query: query.trim(), page, pageSize, body });

    return NextResponse.json({
      data: result.meetings,
      count: result.count,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      query,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
