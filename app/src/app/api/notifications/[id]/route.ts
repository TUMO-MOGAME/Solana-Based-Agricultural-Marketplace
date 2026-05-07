import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * PATCH /api/notifications/[id]
 *
 * Body: { read?: boolean, bookmarked?: boolean, dismissed?: boolean }
 *
 * Each flag is a toggle — `true` stamps the corresponding `*_at` field
 * with NOW(), `false` clears it (NULL). Send any subset; omitted fields
 * stay untouched. RLS makes this a no-op for any row the caller doesn't
 * own.
 *
 * Examples:
 *   { "read": true }                          → mark as read
 *   { "read": false, "bookmarked": true }     → un-read AND bookmark
 *   { "dismissed": true }                     → soft-delete
 */
type PatchBody = {
  read?: boolean;
  bookmarked?: boolean;
  dismissed?: boolean;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const update: Record<string, string | null> = {};
  const now = new Date().toISOString();
  if (typeof body.read === "boolean") {
    update.read_at = body.read ? now : null;
  }
  if (typeof body.bookmarked === "boolean") {
    update.bookmarked_at = body.bookmarked ? now : null;
  }
  if (typeof body.dismissed === "boolean") {
    update.dismissed_at = body.dismissed ? now : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "body must set at least one of read / bookmarked / dismissed" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // RLS will surface as "no rows" rather than a permission error — handle
    // both as 404 since the user shouldn't see whether someone else's row
    // exists.
    if (error.code === "PGRST116" /* no rows returned */) {
      return NextResponse.json({ error: "notification not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notification: data });
}
