export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getRequestUser } from "../../../lib/request-user";
import { can } from "../../../lib/permissions";
import {
  vehicleCreateSchema,
  PUBLIC_COLUMNS,
  calcTotalCost,
  calcProfitLoss,
  calcCommission,
  calcDaysOnLot,
  soldVisibilityCutoff,
} from "../../../lib/vehicles";
import { writeAudit } from "../../../lib/audit";
import { PUBLIC_VEHICLES_CACHE_TAG } from "../../../lib/vercel-cache";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── GET /api/vehicles ──────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  const isAuthenticated = user !== null;
  const db = getAdminClient();

  const url = new URL(request.url);
  const rawLimit  = parseInt(url.searchParams.get("limit")  ?? "10", 10);
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "0",  10);
  const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
  const sortRaw = url.searchParams.get("sort") ?? "created_at:desc";
  const [rawSortCol, sortDir] = sortRaw.split(":");
  const ALLOWED_SORT_COLS = new Set(["created_at", "make", "model", "year", "advertised_price_cargurus", "purchase_date", "status"]);
  const sortCol = ALLOWED_SORT_COLS.has(rawSortCol) ? rawSortCol : "created_at";
  const ascending = sortDir !== "desc";

  // Public (unauthenticated) requests only ever see the public column set — a
  // dedicated branch here (rather than a shared, conditionally-selected query)
  // keeps each `.select()` call a single string literal, which Supabase's
  // type-level query parser needs to infer a real row type instead of falling
  // back to a ParserError (see PR #68).
  //
  // Public visibility (WordPress migration Part 3): at least one photo must
  // actually be uploaded, and a 'sold' vehicle must not be older than 30
  // days. Every other status (including no status set at all) is included
  // as long as photos exist — mirrors isPubliclyVisible() in lib/vehicles.ts,
  // expressed as a DB filter so pagination/count stay correct. Checks
  // `images_json` directly rather than `photography_status` — the latter is
  // a staff-managed "have we photographed this car" flag set independently
  // of whether those photos were ever uploaded into the DMS, so it can be
  // 'done' with zero photos on file. `status.is.null` is listed explicitly
  // because SQL's <> doesn't match NULL the way JS's !== does — without it,
  // a vehicle with no status set would be wrongly excluded. `status`/
  // `sale_date` are filtered on here but never selected (not in
  // PUBLIC_COLUMNS), so the actual status is never exposed to the caller.
  //
  // `?sold=true` (WordPress migration Part 5, the public "Recently Sold"
  // page) flips this to the opposite slice: only vehicles that *are* sold
  // within the same 30-day window, instead of everything else. It's a
  // separate query rather than a client-side filter because `status`/
  // `sale_date` are never part of the response body an unauthenticated
  // caller receives — there'd be nothing in the payload to filter on.
  if (!isAuthenticated) {
    const onlySold = url.searchParams.get("sold") === "true";
    let publicQuery = db
      .from("vehicles")
      .select(PUBLIC_COLUMNS, { count: "exact" })
      .order(sortCol ?? "created_at", { ascending })
      .range(offset, offset + limit - 1)
      .neq("images_json", "[]");

    publicQuery = onlySold
      ? publicQuery.eq("status", "sold").gte("sale_date", soldVisibilityCutoff())
      : publicQuery.or(`status.is.null,status.neq.sold,sale_date.gte.${soldVisibilityCutoff()}`);

    const { data: vehicles, error, count } = await publicQuery;

    if (error) {
      console.error("[GET /api/vehicles]", error);
      return json({ error: "Database error" }, 500);
    }

    return new Response(JSON.stringify({ data: vehicles ?? [], total: count ?? 0 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        // Lets the admin "Refresh Public Cache" button (src/pages/api/admin/refresh-cache.ts)
        // invalidate this response on Vercel's CDN via the tag-based purge API,
        // instead of waiting out the 5-minute max-age.
        "Vercel-Cache-Tag": PUBLIC_VEHICLES_CACHE_TAG,
      },
    });
  }

  // Build query (authenticated — full columns + filters)
  let query = db
    .from("vehicles")
    .select("*, commission_user:user_profiles!commission_user_id(commission_percentage)", { count: "exact" })
    .order(sortCol ?? "created_at", { ascending })
    .range(offset, offset + limit - 1);

  const ownership = url.searchParams.get("ownership_status");
  const photo     = url.searchParams.get("photography_status");
  const minPrice  = url.searchParams.get("min_price");
  const maxPrice  = url.searchParams.get("max_price");
  const minYear   = url.searchParams.get("min_year");
  const maxYear   = url.searchParams.get("max_year");
  const status    = url.searchParams.get("status"); // single value
  const bodyType  = url.searchParams.get("body_type");

  const minPriceValue = minPrice ? parseFloat(minPrice) : Number.NaN;
  const maxPriceValue = maxPrice ? parseFloat(maxPrice) : Number.NaN;
  const minYearValue = minYear ? parseInt(minYear, 10) : Number.NaN;
  const maxYearValue = maxYear ? parseInt(maxYear, 10) : Number.NaN;

  if (ownership) query = query.eq("ownership_status", ownership);
  if (photo) query = query.eq("photography_status", photo);
  if (Number.isFinite(minPriceValue)) query = query.gte("advertised_price_cargurus", minPriceValue);
  if (Number.isFinite(maxPriceValue)) query = query.lte("advertised_price_cargurus", maxPriceValue);
  if (Number.isFinite(minYearValue)) query = query.gte("year", minYearValue);
  if (Number.isFinite(maxYearValue)) query = query.lte("year", maxYearValue);
  if (status) query = query.eq("status", status);
  if (bodyType) query = query.eq("body_type", bodyType);

  const { data: vehicles, error, count } = await query;

  if (error) {
    console.error("[GET /api/vehicles]", error);
    return json({ error: "Database error" }, 500);
  }

  // For authenticated requests, enrich with computed fields
  if (!vehicles?.length) {
    return json({ data: [], total: 0 });
  }

  // Fetch expense totals in one query
  const vins = vehicles.map((v) => v.vin);
  const { data: expenses } = await db
    .from("vehicle_expenses")
    .select("vin, amount")
    .in("vin", vins);

  const expenseByVin: Record<string, number> = {};
  for (const exp of expenses ?? []) {
    expenseByVin[exp.vin] = (expenseByVin[exp.vin] ?? 0) + Number(exp.amount);
  }

  const canSeeFinancials = can(user.role, "vehicles:financials:read");

  const enriched = vehicles.map((v) => {
    const expenseTotal = expenseByVin[v.vin] ?? 0;
    const totalCost    = calcTotalCost(v.purchase_price, expenseTotal);
    const profitLoss   = calcProfitLoss(v.sale_price, totalCost);
    const commissionPct = (v.commission_user as { commission_percentage?: number } | null)?.commission_percentage ?? null;
    const commission   = calcCommission(profitLoss, commissionPct);

    return {
      ...v,
      commission_user: undefined, // flatten — don't expose nested object
      expense_total:   expenseTotal,
      days_on_lot:     calcDaysOnLot(v.purchase_date as string | null),
      ...(canSeeFinancials ? { total_cost: totalCost, profit_loss: profitLoss } : {}),
      commission,
    };
  });

  return json({ data: enriched, total: count ?? enriched.length });
};

// ── POST /api/vehicles ─────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "vehicles:create")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = vehicleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db = getAdminClient();
  const { data, error } = await db
    .from("vehicles")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return json({ error: "A vehicle with this VIN already exists" }, 409);
    if (error.code === "23514") return json({ error: "Invalid field value: check constraints failed" }, 422);
    console.error("[POST /api/vehicles]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "vehicle_created",
    adminEmail: user.email,
    entityRef:  data.vin,
  });

  return json(data, 201);
};
