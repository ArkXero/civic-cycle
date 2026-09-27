import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeetingList } from "@/lib/data/meetings";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import { getPreferredDistrictId } from "@/lib/account-profile";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)),
    );
    const body = searchParams.get("body") ?? undefined;
    const topicSlugs = searchParams.getAll("topic");
    const statuses = searchParams
      .getAll("status")
      .filter((status) => ["pending", "processing", "summarized", "failed"].includes(status));
    const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("dateFrom") ?? "")
      ? searchParams.get("dateFrom") ?? undefined
      : undefined;
    const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("dateTo") ?? "")
      ? searchParams.get("dateTo") ?? undefined
      : undefined;

    const supabase = await createClient();
    const districtId = await getPreferredDistrictId(supabase, searchParams.get("districtId"));
    const result = await getMeetingList(supabase, {
      page,
      pageSize,
      body,
      districtId,
      topicSlugs,
      statusFilter: statuses.length > 0 ? statuses : undefined,
      dateFrom,
      dateTo,
    });

    return NextResponse.json({
      data: result.meetings,
      count: result.count,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
