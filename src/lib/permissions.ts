/**
 * RBAC permission map.
 *
 * Adding a new DMS module (vehicles, leads, settings) only requires:
 *   1. Add permission keys to PERMISSIONS below.
 *   2. Call can(role, 'newmodule:action') at the top of each new route.
 * No middleware changes needed.
 */

export type Role = "owner" | "manager" | "staff";

/**
 * Maps each permission key to the roles that are allowed to perform it.
 * Roles listed here are the MINIMUM required — owner always inherits all permissions.
 */
const PERMISSIONS: Record<string, Role[]> = {
  "financing:read":   ["owner", "manager", "staff"],
  "financing:write":  ["owner", "manager"],
  "financing:delete": ["owner"],
  "financing:export": ["owner", "manager"],
  "users:manage":     ["owner"],
};

/**
 * Returns true if the given role is allowed to perform the action.
 * Owner is implicitly allowed everything regardless of the map.
 */
export function can(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}
