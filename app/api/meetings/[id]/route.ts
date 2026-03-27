import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // First get the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();

    if (meetingError) {
      if (meetingError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Not found", message: "Meeting not found" },
          { status: 404 },
        );
      }
      console.error("Error fetching meeting:", meetingError);
      return NextResponse.json(
        { error: "Failed to fetch meeting" },
        { status: 500 },
      );
    }

    if (!meeting) {
      return NextResponse.json(
        { error: "Not found", message: "Meeting not found" },
        { status: 404 },
      );
    }

    // Then get the summary separately
    const { data: summaries } = await supabase
      .from("summaries")
      .select("*")
      .eq("meeting_id", id)
      .limit(1);

    // Explicitly type and construct the response
    const transformedMeeting = Object.assign({}, meeting, {
      summary: summaries?.[0] || null,
    });

    return NextResponse.json(transformedMeeting);
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
