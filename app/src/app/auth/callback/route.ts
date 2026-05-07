import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles the redirect that lands here from:
//   - Email confirmation links (signup, magic links)
//   - Password reset links
//   - OAuth provider returns (Google / Apple / Microsoft)
//
// Supabase appends `?code=...`; we exchange it for a session, which sets
// the auth cookies, then forward the user to `next` (or /welcome).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/welcome";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
