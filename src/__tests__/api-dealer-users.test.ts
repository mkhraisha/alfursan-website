import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";

import { GET as usersGET, POST as usersPOST } from "../pages/api/dealer/users";
import { PATCH as userPATCH } from "../pages/api/dealer/users/[userId]";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_USER: RequestUser = { email: "admin@example.com", role: "manager", userId: "admin-1" };
const SALES_USER: RequestUser = { email: "sales@example.com", role: "sales", userId: "sales-1" };

const PROFILE = {
  id:                   "user-uuid-1",
  email:                "newuser@example.com",
  role:                 "sales",
  commission_percentage: 5,
  is_active:            true,
  created_at:           "2026-05-17T00:00:00Z",
};

function req(url: string, method = "GET", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  (getRequestUser as Mock).mockResolvedValue(null);
});

// ── GET /api/dealer/users ─────────────────────────────────────────────────────

describe("GET /api/dealer/users", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await usersGET({ request: req("/api/dealer/users") } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales role", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await usersGET({ request: req("/api/dealer/users") } as never);
    expect(res.status).toBe(403);
  });

  it("returns user list for admin", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const orderFn  = vi.fn().mockResolvedValue({ data: [PROFILE], error: null });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res = await usersGET({ request: req("/api/dealer/users") } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe("newuser@example.com");
  });

  it("returns 500 on DB error", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const orderFn  = vi.fn().mockResolvedValue({ data: null, error: { message: "db err" } });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res = await usersGET({ request: req("/api/dealer/users") } as never);
    expect(res.status).toBe(500);
  });
});

// ── POST /api/dealer/users ────────────────────────────────────────────────────

describe("POST /api/dealer/users", () => {
  const VALID_BODY = { email: "newuser@example.com", role: "sales", commission_percentage: 5 };

  it("returns 401 when unauthenticated", async () => {
    const res = await usersPOST({ request: req("/api/dealer/users", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales role", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await usersPOST({ request: req("/api/dealer/users", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid body (bad email)", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const res = await usersPOST({
      request: req("/api/dealer/users", "POST", { email: "not-an-email", role: "sales" }),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 409 when email already exists", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: { id: "existing-id" }, error: null });
    const eqFn     = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selectFn }) });

    const res = await usersPOST({ request: req("/api/dealer/users", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(409);
  });

  it("returns 201 + profile on success", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    // email uniqueness check → not found
    const singleFn    = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn        = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn    = vi.fn().mockReturnValue({ eq: eqFn });

    // insert chain
    const insertSingleFn = vi.fn().mockResolvedValue({ data: PROFILE, error: null });
    const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingleFn });
    const insertFn       = vi.fn().mockReturnValue({ select: insertSelectFn });

    // from() called for the check and then for the insert
    let callCount = 0;
    (getAdminClient as Mock).mockReturnValue({
      from: () => {
        callCount++;
        if (callCount === 1) return { select: selectFn };
        return { insert: insertFn };
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: { id: "user-uuid-1" } },
            error: null,
          }),
        },
      },
    });

    const res = await usersPOST({ request: req("/api/dealer/users", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("newuser@example.com");
    expect(body.role).toBe("sales");
  });

  it("returns 500 when Auth invite fails", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    const singleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn     = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: () => ({ select: selectFn }),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "invite failed" },
          }),
        },
      },
    });

    const res = await usersPOST({ request: req("/api/dealer/users", "POST", VALID_BODY) } as never);
    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/dealer/users/[userId] ─────────────────────────────────────────

describe("PATCH /api/dealer/users/[userId]", () => {
  const USER_ID = "user-uuid-1";

  it("returns 401 when unauthenticated", async () => {
    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { role: "manager" }),
    } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for sales role", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES_USER);
    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { role: "manager" }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 422 for empty body", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", {}),
    } as never);
    expect(res.status).toBe(422);
  });

  it("returns 404 when user not found", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn     = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ update: updateFn }) });

    // Use "sales" — a manager (rank 1) can assign roles below their own rank
    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { role: "sales" }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("disabling user sets disabled_at and returns 200", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const disabledProfile = { ...PROFILE, is_active: false, disabled_at: "2026-05-17T00:00:00Z" };

    // Count chain for last-active-manager guard (returns count=1 → not the last one)
    const countNeqFn  = vi.fn().mockResolvedValue({ count: 1, error: null });
    const countEqFn   = vi.fn().mockReturnValue({ neq: countNeqFn });
    const countInFn   = vi.fn().mockReturnValue({ eq: countEqFn });
    const countSelFn  = vi.fn().mockReturnValue({ in: countInFn });

    // Update chain
    const singleFn    = vi.fn().mockResolvedValue({ data: disabledProfile, error: null });
    const updateSelFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn        = vi.fn().mockReturnValue({ select: updateSelFn });
    const updateFn    = vi.fn().mockReturnValue({ eq: eqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: () => ({ select: countSelFn, update: updateFn }),
    });

    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { is_active: false }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(false);
    expect(body.disabled_at).toBeTruthy();

    const updateArg = updateFn.mock.calls[0][0];
    expect(updateArg.is_active).toBe(false);
    expect(updateArg.disabled_at).toBeTruthy();
  });

  it("re-enabling user clears disabled_at", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const enabledProfile = { ...PROFILE, is_active: true, disabled_at: null };
    const singleFn = vi.fn().mockResolvedValue({ data: enabledProfile, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn     = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ update: updateFn }) });

    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { is_active: true }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(true);
    expect(body.disabled_at).toBeNull();

    const updateArg = updateFn.mock.calls[0][0];
    expect(updateArg.disabled_at).toBeNull();
  });

  it("updating role only returns 200", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    // Manager can assign "sales" (rank 0 < manager rank 1)
    const updatedProfile = { ...PROFILE, role: "sales" };
    const singleFn = vi.fn().mockResolvedValue({ data: updatedProfile, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn     = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ update: updateFn }) });

    const res = await userPATCH({
      params: { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { role: "sales" }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("sales");
  });
});

// ── Security: role escalation prevention ─────────────────────────────────────

describe("PATCH /api/dealer/users/[userId] — role escalation prevention", () => {
  const TARGET_ID = "user-uuid-target";

  it("returns 403 when manager tries to assign owner role", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const res = await userPATCH({
      params:  { userId: TARGET_ID },
      request: req(`/api/dealer/users/${TARGET_ID}`, "PATCH", { role: "owner" }),
    } as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/role equal to or higher/i);
  });

  it("returns 403 when manager tries to assign manager role (same rank)", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const res = await userPATCH({
      params:  { userId: TARGET_ID },
      request: req(`/api/dealer/users/${TARGET_ID}`, "PATCH", { role: "manager" }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 400 when manager tries to disable their own account", async () => {
    // ADMIN_USER.userId === "admin-1" matches the target userId
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);
    const res = await userPATCH({
      params:  { userId: "admin-1" },
      request: req("/api/dealer/users/admin-1", "PATCH", { is_active: false }),
    } as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/own account/i);
  });

  it("returns 400 when disabling the last active manager", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    // Count query returns 0 — no other active managers/owners remain
    const neqFn    = vi.fn().mockResolvedValue({ count: 0, error: null });
    const eqActFn  = vi.fn().mockReturnValue({ neq: neqFn });
    const inFn     = vi.fn().mockReturnValue({ eq: eqActFn });
    const selFn    = vi.fn().mockReturnValue({ in: inFn });
    (getAdminClient as Mock).mockReturnValue({ from: () => ({ select: selFn }) });

    const res = await userPATCH({
      params:  { userId: TARGET_ID },
      request: req(`/api/dealer/users/${TARGET_ID}`, "PATCH", { is_active: false }),
    } as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/last active manager/i);
  });
});

// ── Security: Auth user rollback on profile insert failure ────────────────────

describe("POST /api/dealer/users — Auth rollback on insert failure", () => {
  it("calls deleteUser on the Auth account when user_profiles insert fails", async () => {
    (getRequestUser as Mock).mockResolvedValue(ADMIN_USER);

    // Duplicate-email check: no existing user
    const singleFn    = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn        = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn    = vi.fn().mockReturnValue({ eq: eqFn });

    // Insert fails
    const insertSingleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } });
    const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingleFn });
    const insertFn       = vi.fn().mockReturnValue({ select: insertSelectFn });

    const deleteUserFn = vi.fn().mockResolvedValue({ data: null, error: null });

    let callCount = 0;
    (getAdminClient as Mock).mockReturnValue({
      from: () => {
        callCount++;
        if (callCount === 1) return { select: selectFn };
        return { insert: insertFn };
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: { id: "orphan-auth-uuid" } }, error: null,
          }),
          deleteUser: deleteUserFn,
        },
      },
    });

    const res = await usersPOST({
      request: req("/api/dealer/users", "POST", { email: "fail@example.com", role: "sales" }),
    } as never);

    expect(res.status).toBe(500);
    expect(deleteUserFn).toHaveBeenCalledWith("orphan-auth-uuid");
  });
});
