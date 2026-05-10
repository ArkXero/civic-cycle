import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeetingById } from "@/lib/data/meetings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const meeting = await getMeetingById(supabase, id);

    if (!meeting) {
      return NextResponse.json(
        { error: "Not found", message: "Meeting not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
