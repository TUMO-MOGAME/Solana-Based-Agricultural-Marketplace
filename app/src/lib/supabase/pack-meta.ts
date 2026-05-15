// Pack metadata persistence — crop name + hectares for a given GrowPack PDA.
//
// Why this exists:
//   The on-chain GrowPack stores money state (bundle cost, repayment, status,
//   insurance threshold). It deliberately does NOT store the crop name or
//   hectares — those are descriptive metadata that don't drive any on-chain
//   logic. Storing them on Solana would add bytes + rent to every pack.
//
//   But the Apply form asks the farmer for them, and the dashboard wants
//   to show "Maize · 2 ha" honestly. So we keep them in Supabase, keyed by
//   the pack PDA.
//
// Demo-mode safety:
//   When Supabase is not configured, every function here no-ops gracefully:
//   saves return false (write didn't happen, caller decides what to do),
//   fetches return null (caller renders the empty state). The on-chain
//   flow is never blocked by Supabase being down.

import { createSupabaseBrowserClient, isSupabaseConfigured } from "./client";

export type Crop = "Maize" | "Wheat" | "Soybean" | "Sorghum" | "Beans";

export interface PackMeta {
  packPda: string;
  crop: Crop;
  hectares: number;
  seasonId: number;
  createdAt: string;
}

export interface SavePackMetaInput {
  packPda: string;
  crop: Crop;
  hectares: number;
  seasonId: number;
}

/**
 * Persist crop + hectares for a freshly-created pack. Returns true on
 * success, false if Supabase is not configured OR the write failed (caller
 * can choose to show a non-blocking warning). On-chain state remains
 * canonical regardless of the return value.
 */
export async function savePackMeta(input: SavePackMetaInput): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("pack_meta").insert({
      pack_pda: input.packPda,
      farmer_id: user.id,
      crop: input.crop,
      hectares: input.hectares,
      season_id: input.seasonId,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Fetch the metadata for a single pack PDA, or null if absent. */
export async function fetchPackMeta(packPda: string): Promise<PackMeta | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("pack_meta")
      .select("pack_pda, crop, hectares, season_id, created_at")
      .eq("pack_pda", packPda)
      .maybeSingle();
    if (error || !data) return null;
    return {
      packPda: data.pack_pda,
      crop: data.crop as Crop,
      hectares: Number(data.hectares),
      seasonId: data.season_id,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

/** Fetch every pack the current farmer has metadata for, newest first. */
export async function fetchPackMetaForFarmer(): Promise<PackMeta[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("pack_meta")
      .select("pack_pda, crop, hectares, season_id, created_at")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({
      packPda: row.pack_pda,
      crop: row.crop as Crop,
      hectares: Number(row.hectares),
      seasonId: row.season_id,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
