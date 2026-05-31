/**
 * RBAC permission map.
 *
 * Roles:
 *   'owner'   — dealership owner; bypasses all permission checks (full access)
 *   'manager' — dealership manager; broad access including vehicle creation and financials
 *   'sales'   — sales representative; cannot create vehicles, modify pricing/media, or view profit/loss
 */

export type Role = "owner" | "manager" | "sales";

const PERMISSIONS: Record<string, Role[]> = {
  // ── Vehicles ───────────────────────────────────────────────────────────────
  "vehicles:read":             ["manager", "sales"],
  "vehicles:create":           ["manager"],          // add new vehicles (and CSV import)
  "vehicles:write":            ["manager", "sales"], // update non-restricted fields
  "vehicles:pricing:write":    ["manager"],          // modify pricing fields
  "vehicles:media:write":      ["manager"],          // modify images / videos
  "vehicles:financials:read":  ["manager"],          // view profit/loss & total cost
  "vehicles:delete":           ["manager"],
  "vehicles:import":           ["manager"],          // CSV bulk import

  // ── Commission ────────────────────────────────────────────────────────────
  "commission:assign": ["manager", "sales"],

  // ── User management ───────────────────────────────────────────────────────
  "dealer:users:manage": ["manager"],

  // ── Garage Register ───────────────────────────────────────────────────────
  "garage:read":  ["manager", "sales"],
  "garage:write": ["manager"],

  // ── Financing workflow ─────────────────────────────────────────────────────
  "financing:read":   ["manager", "sales"],
  "financing:write":  ["manager"],
  "financing:delete": [],  // owner only (via bypass)
  "financing:export": ["manager"],
  "users:manage":     [],  // owner only (via bypass)
};

/**
 * Returns true if the given role is allowed to perform the action.
 * 'owner' is implicitly allowed everything.
 */
export function can(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}
