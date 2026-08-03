/**
 * Server-side (SSR-only) data access for the public vehicle pages
 * (WordPress migration Part 5): homepage, search, sold, and the individual
 * listing page all call these instead of `getCars`/`getCarBySlug` from
 * `src/lib/wordpress.ts`.
 *
 * Queries Supabase directly with the admin client rather than the pages
 * self-fetching `GET /api/vehicles` over HTTP — same underlying query and
 * the exact same visibility rule (WordPress migration Part 3), just without
 * an extra network round-trip since this already runs server-side. Never
 * import this from a client-hydrated component (`client:load` React) — it
 * uses the service-role Supabase client.
 */

import { getAdminClient } from "./supabase-admin";
import { PUBLIC_COLUMNS, soldVisibilityCutoff, isPubliclyVisible } from "./vehicles";
import type { PublicVehicle } from "./public-vehicle-view";

/**
 * All publicly visible vehicles (WordPress migration Part 3's rule:
 * photography done, and not a sale older than 30 days), newest first.
 * Feeds the homepage, search page, and the "related listings" section of
 * the individual listing page.
 */
export async function fetchPublicVehicles(): Promise<PublicVehicle[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("vehicles")
    .select(PUBLIC_COLUMNS)
    .eq("photography_status", "done")
    .or(`status.is.null,status.neq.sold,sale_date.gte.${soldVisibilityCutoff()}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[public-vehicles] fetchPublicVehicles:", error);
    return [];
  }

  return (data ?? []) as PublicVehicle[];
}

/**
 * Only the "recently sold" slice (sold within the last 30 days) — the
 * public "Recently Sold" page's own query, since a sold vehicle blends in
 * with the general listing above rather than being excluded from it.
 */
export async function fetchRecentlySoldVehicles(): Promise<PublicVehicle[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("vehicles")
    .select(PUBLIC_COLUMNS)
    .eq("photography_status", "done")
    .eq("status", "sold")
    .gte("sale_date", soldVisibilityCutoff())
    .order("sale_date", { ascending: false });

  if (error) {
    console.error("[public-vehicles] fetchRecentlySoldVehicles:", error);
    return [];
  }

  return (data ?? []) as PublicVehicle[];
}

/**
 * A single publicly visible vehicle by VIN, or null if it doesn't exist or
 * isn't currently visible (mirrors `GET /api/vehicles/:vin`'s unauthenticated
 * branch — 404-equivalent either way, so a non-visible vehicle isn't
 * distinguishable from a nonexistent one).
 */
export async function fetchPublicVehicleByVin(
  vin: string,
): Promise<PublicVehicle | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("vehicles")
    .select(`${PUBLIC_COLUMNS}, status, photography_status, sale_date`)
    .eq("vin", vin)
    .single();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const visible = isPubliclyVisible(
    row as { photography_status: string | null; status: string | null; sale_date: string | null },
  );
  if (!visible) return null;

  const { status: _status, photography_status: _photo, sale_date: _saleDate, ...publicRow } = row;
  return publicRow as unknown as PublicVehicle;
}
