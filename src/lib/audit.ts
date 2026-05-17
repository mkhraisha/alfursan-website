import { getAdminClient } from "./supabase-admin";

/**
 * Write an append-only audit log entry.
 *
 * For vehicle/user actions, pass the VIN or user ID as `entityRef`.
 * For financing actions, pass the application UUID as `entityRef` and
 * optionally `applicationId` for the FK constraint.
 */
export async function writeAudit(params: {
  action: string;
  adminEmail: string;
  entityRef: string;
  applicationId?: string;
  ipHash?: string;
}): Promise<void> {
  const db = getAdminClient();
  const { error } = await db.from("application_audit").insert({
    application_id:  params.applicationId ?? null,
    application_ref: params.entityRef,
    action:          params.action,
    admin_email:     params.adminEmail,
    ip_hash:         params.ipHash ?? null,
  });
  if (error) {
    // Audit failures are non-fatal but should be logged
    console.error("[audit] Failed to write audit log", error);
  }
}
