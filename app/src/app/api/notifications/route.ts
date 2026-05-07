import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 *
 * Query string:
 *   category=opportunity|trend|reminder|platform_update   (optional filter)
 *   include_dismissed=1                                   (default: hide dismissed)
 *   limit=20  offset=0                                    (paginated, max 100)
 *
 * Returns 401 if there's no authenticated session — the dashboard is
 * gated, so the bell shouldn't render before the user signs in. RLS
 * scopes the result to the user's own rows automatically.
 */
const ALLOWED_CATEGORIES = new Set([
  "opportunity",
  "trend",
  "reminder",
  "platform_update",
]);

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const includeDismissed = url.searchParams.get("include_dismissed") === "1";
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1),
    100,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") || "0", 10) || 0,
    0,
  );

  if (category && !ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json(
      {
        error: `unknown category '${category}' — allowed: ${[...ALLOWED_CATEGORIES].join(", ")}`,
      },
      { status: 400 },
    );
  }

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq("category", category);
  if (!includeDismissed) query = query.is("dismissed_at", null);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
