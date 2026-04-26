import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const publicAlertSelect = 'id, keyword, bodies, is_active, created_at'

const patchBodySchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict();

// DELETE /api/alerts/[id] - Delete an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You must be logged in to delete alerts",
        },
        { status: 401 },
      );
    }

    // Verify ownership using admin client
    const adminClient = createAdminClient();
    const { data: alertData, error: fetchError } = await adminClient
      .from("alert_preferences")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !alertData) {
      return NextResponse.json(
        { error: "Not found", message: "Alert not found" },
        { status: 404 },
      );
    }

    const alertRecord = alertData as { id: string; user_id: string };
    if (alertRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden", message: "You can only delete your own alerts" },
        { status: 403 },
      );
    }

    // Delete the alert
    const { error: deleteError } = await adminClient
      .from("alert_preferences")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting alert:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete alert" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
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

// PATCH /api/alerts/[id] - Update an alert (toggle active status)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You must be logged in to update alerts",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const bodyResult = patchBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Validation error", message: bodyResult.error.issues[0].message },
        { status: 400 },
      );
    }

    const { is_active: isActive } = bodyResult.data;

    // Use a fresh admin client for all database operations
    const adminClient = createAdminClient();

    // First verify the alert exists and belongs to this user
    const { data: alertData, error: fetchError } = await adminClient
      .from("alert_preferences")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !alertData) {
      return NextResponse.json(
        { error: "Not found", message: "Alert not found" },
        { status: 404 },
      );
    }

    const alertRecord = alertData as { id: string; user_id: string };
    if (alertRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden", message: "You can only update your own alerts" },
        { status: 403 },
      );
    }

    const updateClient = createAdminClient();

    const { data: updatedAlert, error: updateError } = await updateClient
      .from("alert_preferences")
      .update({ is_active: isActive })
      .eq("id", id)
      .select(publicAlertSelect)
      .single();

    if (updateError) {
      console.error("Error updating alert:", updateError);
      return NextResponse.json(
        { error: "Failed to update alert" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: updatedAlert });
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
