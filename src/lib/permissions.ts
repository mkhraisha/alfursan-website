/**
 * RBAC permission map.
 *
 * Roles:
 *   Legacy financing workflow: 'owner' | 'manager' | 'staff'
 *   DMS (Dealer Management System): 'admin' | 'sales'
 *
 * 'owner' and 'admin' bypass all permission checks (full access).
 * All other roles are checked against the PERMISSIONS map below.
 */

export type Role = "owner" | "manager" | "staff" | "admin" | "sales";

const PERMISSIONS: Record<string, Role[]> = {
  // ── Financing workflow (existing) ──────────────────────────────────────────
  "financing:read":   ["owner", "manager", "staff", "admin", "sales"],
  "financing:write":  ["owner", "manager", "admin"],
  "financing:delete": ["owner", "admin"],
  "financing:export": ["owner", "manager", "admin"],
  "users:manage":     ["owner", "admin"],

  // ── DMS: Vehicles ──────────────────────────────────────────────────────────
  "vehicles:read":   ["owner", "manager", "staff", "admin", "sales"],
  "vehicles:write":  ["owner", "manager", "staff", "admin", "sales"],
  "vehicles:delete": ["owner", "admin"],

  // ── DMS: Commission ────────────────────────────────────────────────────────
  "commission:assign": ["owner", "manager", "staff", "admin", "sales"],

  // ── DMS: User management ───────────────────────────────────────────────────
  "dealer:users:manage": ["owner", "admin"],

  // ── DMS: Garage Register ───────────────────────────────────────────────────
  "garage:read":  ["owner", "manager", "staff", "admin", "sales"],
  "garage:write": ["owner", "manager", "admin"],

  // ── DMS: CSV Import ────────────────────────────────────────────────────────
  "vehicles:import": ["owner", "manager", "staff", "admin", "sales"],
};

/**
 * Returns true if the given role is allowed to perform the action.
 * 'owner' and 'admin' are implicitly allowed everything.
 */
export function can(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "owner" || role === "admin") return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}
