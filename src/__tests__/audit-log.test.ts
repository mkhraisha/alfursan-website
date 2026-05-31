import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/audit");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import { writeAudit } from "../lib/audit";
import type { RequestUser } from "../lib/request-user";

import { POST as vehiclesPOST } from "../pages/api/vehicles/index";
import { PATCH as vinPATCH, DELETE as vinDELETE } from "../pages/api/vehicles/[vin]/index";
import { POST as expensesPOST } from "../pages/api/vehicles/[vin]/expenses/index";
import { DELETE as expenseDELETE } from "../pages/api/vehicles/[vin]/expenses/[expenseId]";
import { POST as docsPOST } from "../pages/api/vehicles/[vin]/documents/index";
import { DELETE as docDELETE } from "../pages/api/vehicles/[vin]/documents/[docId]";
import { PATCH as commissionPATCH } from "../pages/api/vehicles/[vin]/commission";
import { POST as usersPOST } from "../pages/api/dealer/users";
import { PATCH as userPATCH } from "../pages/api/dealer/users/[userId]";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN: RequestUser = { email: "admin@test.com", role: "manager", userId: "user-uuid-1" };
const VIN        = "1HGCM82633A004352";
const EXPENSE_ID = "exp-uuid-1";
const DOC_ID     = "doc-uuid-1";
const USER_ID    = "user-uuid-2";

const VEHICLE = {
  vin: VIN, make: "Honda", model: "Civic", year: 2020,
  purchase_price: 10_000, advertised_price_cargurus: 14_000,
  sale_price: null, commission_user_id: null,
  images_json: [], videos_json: [],
};

function req(url: string, method = "POST", body?: unknown) {
  return new Request(`https://alfursanauto.ca${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getRequestUser as Mock).mockResolvedValue(ADMIN);
});

// ── Helpers to build focused Supabase mock chains ─────────────────────────────

/** single(): resolves once */
function single(data: unknown, error: unknown = null) {
  return vi.fn().mockResolvedValue({ data, error });
}

/** Basic insert chain: from(t).insert().select().single() */
function insertChain(data: unknown) {
  const singleFn = single(data);
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  return { insert: insertFn };
}

/** Basic select-by-eq chain: from(t).select().eq().single() */
function selectEqChain(data: unknown, error: unknown = null) {
  const singleFn = single(data, error);
  const eq2Fn    = vi.fn().mockReturnValue({ single: singleFn });
  const eqFn     = vi.fn().mockReturnValue({ single: singleFn, eq: eq2Fn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  return { select: selectFn };
}

/** update().eq().select().single() */
function updateChain(data: unknown) {
  const singleFn = single(data);
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const eqFn     = vi.fn().mockReturnValue({ select: selectFn, error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
  return { update: updateFn };
}

/** delete().eq() → resolves { error: null } */
function deleteChain() {
  const eqFn     = vi.fn().mockResolvedValue({ error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: eqFn });
  return { delete: deleteFn };
}

// ── vehicle_created ───────────────────────────────────────────────────────────

describe("audit: vehicle_created", () => {
  it("calls writeAudit with vehicle_created after successful POST /api/vehicles", async () => {
    const { insert } = insertChain(VEHICLE);
    (getAdminClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ insert }) });

    const res = await vehiclesPOST({
      request: req("/api/vehicles", "POST", { vin: VIN, make: "Honda", model: "Civic", year: 2020, body_type: "sedan" }),
    } as never);

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "vehicle_created",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── vehicle_updated ───────────────────────────────────────────────────────────

describe("audit: vehicle_updated", () => {
  it("calls writeAudit with vehicle_updated after successful PATCH /api/vehicles/:vin", async () => {
    const updatedVehicle = { ...VEHICLE, colour: "Red" };
    const expEqFn     = vi.fn().mockResolvedValue({ data: [], error: null });
    const expSelectFn = vi.fn().mockReturnValue({ eq: expEqFn });
    const vehicleUpd  = updateChain(updatedVehicle);

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicles")         return vehicleUpd;
        if (table === "vehicle_expenses") return { select: expSelectFn };
        return {};
      }),
    });

    const res = await vinPATCH({
      params:  { vin: VIN },
      request: req(`/api/vehicles/${VIN}`, "PATCH", { colour: "Red" }),
    } as never);

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "vehicle_updated",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── vehicle_deleted ───────────────────────────────────────────────────────────

describe("audit: vehicle_deleted", () => {
  it("calls writeAudit with vehicle_deleted after successful DELETE /api/vehicles/:vin", async () => {
    const delObj = deleteChain();
    (getAdminClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue(delObj) });

    const res = await vinDELETE({
      params:  { vin: VIN },
      request: req(`/api/vehicles/${VIN}`, "DELETE"),
    } as never);

    expect(res.status).toBe(204);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "vehicle_deleted",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── expense_added ─────────────────────────────────────────────────────────────

describe("audit: expense_added", () => {
  it("calls writeAudit with expense_added after POST /api/vehicles/:vin/expenses", async () => {
    const EXPENSE = { id: EXPENSE_ID, category: "repair", description: "Fix brakes", amount: 500 };
    const vehicleChain  = selectEqChain({ vin: VIN });
    const expenseInsert = insertChain(EXPENSE);

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicles")         return vehicleChain;
        if (table === "vehicle_expenses") return expenseInsert;
        return {};
      }),
    });

    const res = await expensesPOST({
      params:  { vin: VIN },
      request: req(`/api/vehicles/${VIN}/expenses`, "POST", { category: "repair", description: "Fix brakes", amount: 500 }),
    } as never);

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "expense_added",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── expense_deleted ───────────────────────────────────────────────────────────

describe("audit: expense_deleted", () => {
  it("calls writeAudit with expense_deleted after DELETE /api/vehicles/:vin/expenses/:id", async () => {
    const existsChain = selectEqChain({ id: EXPENSE_ID });
    const delChain    = deleteChain();

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicle_expenses") return { ...existsChain, ...delChain };
        return {};
      }),
    });

    const res = await expenseDELETE({
      params:  { vin: VIN, expenseId: EXPENSE_ID },
      request: req(`/api/vehicles/${VIN}/expenses/${EXPENSE_ID}`, "DELETE"),
    } as never);

    expect(res.status).toBe(204);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "expense_deleted",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── document_uploaded ─────────────────────────────────────────────────────────

describe("audit: document_uploaded", () => {
  it("calls writeAudit with document_uploaded after POST /api/vehicles/:vin/documents", async () => {
    const DOC = { id: DOC_ID, document_type: "safety_inspection", file_path: "vehicles/VIN/docs/safety.pdf" };
    const vehicleChain = selectEqChain({ vin: VIN });
    const docInsert    = insertChain(DOC);

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicles")          return vehicleChain;
        if (table === "vehicle_documents") return docInsert;
        return {};
      }),
    });

    const res = await docsPOST({
      params:  { vin: VIN },
      request: req(`/api/vehicles/${VIN}/documents`, "POST", {
        document_type: "safety_inspection",
        file_path:     "vehicles/VIN/docs/safety.pdf",
      }),
    } as never);

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "document_uploaded",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── document_deleted ──────────────────────────────────────────────────────────

describe("audit: document_deleted", () => {
  it("calls writeAudit with document_deleted after DELETE /api/vehicles/:vin/documents/:id", async () => {
    const existsChain = selectEqChain({ id: DOC_ID });
    const delChain    = deleteChain();

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "vehicle_documents") return { ...existsChain, ...delChain };
        return {};
      }),
    });

    const res = await docDELETE({
      params:  { vin: VIN, docId: DOC_ID },
      request: req(`/api/vehicles/${VIN}/documents/${DOC_ID}`, "DELETE"),
    } as never);

    expect(res.status).toBe(204);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "document_deleted",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── commission_assigned ───────────────────────────────────────────────────────

describe("audit: commission_assigned", () => {
  it("calls writeAudit with commission_assigned after PATCH /api/vehicles/:vin/commission", async () => {
    const COMMISSION_USER_ID = "c0ffee00-beef-4000-a000-000000000001";
    const profileData  = { id: COMMISSION_USER_ID, is_active: true, commission_percentage: 10 };
    const vehicleAfterUpdate = { ...VEHICLE, commission_user_id: COMMISSION_USER_ID, commission_percentage: 10 };

    const profileEq2Fn = vi.fn().mockReturnValue({ single: single(profileData) });
    const profileEqFn  = vi.fn().mockReturnValue({ single: single(profileData), eq: profileEq2Fn });
    const profileSelectFn = vi.fn().mockReturnValue({ eq: profileEqFn });

    const updateEqFn   = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: single(vehicleAfterUpdate) }) });
    const updateFn     = vi.fn().mockReturnValue({ eq: updateEqFn });

    const expEqFn  = vi.fn().mockResolvedValue({ data: [], error: null });
    const expSelFn = vi.fn().mockReturnValue({ eq: expEqFn });

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles")    return { select: profileSelectFn };
        if (table === "vehicles")         return { update: updateFn };
        if (table === "vehicle_expenses") return { select: expSelFn };
        return {};
      }),
    });

    const res = await commissionPATCH({
      params:  { vin: VIN },
      request: req(`/api/vehicles/${VIN}/commission`, "PATCH", { commission_user_id: COMMISSION_USER_ID }),
    } as never);

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "commission_assigned",
      adminEmail: ADMIN.email,
      entityRef:  VIN,
    });
  });
});

// ── user_created ──────────────────────────────────────────────────────────────

describe("audit: user_created", () => {
  it("calls writeAudit with user_created after POST /api/dealer/users", async () => {
    const AUTH_USER_ID = "auth-uuid-new";
    const PROFILE = { id: AUTH_USER_ID, email: "new@test.com", role: "sales", commission_percentage: null, is_active: true };

    const dupCheckFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const dupEqFn    = vi.fn().mockReturnValue({ single: dupCheckFn });
    const dupSelFn   = vi.fn().mockReturnValue({ eq: dupEqFn });

    const profSingle  = single(PROFILE);
    const profSelFn   = vi.fn().mockReturnValue({ single: profSingle });
    const profInsertFn = vi.fn().mockReturnValue({ select: profSelFn });

    let callCount = 0;
    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          callCount++;
          return callCount === 1
            ? { select: dupSelFn }
            : { insert: profInsertFn };
        }
        return {};
      }),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: { id: AUTH_USER_ID } }, error: null }),
        },
      },
    });

    const res = await usersPOST({
      request: req("/api/dealer/users", "POST", { email: "new@test.com", role: "sales" }),
    } as never);

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "user_created",
      adminEmail: ADMIN.email,
      entityRef:  AUTH_USER_ID,
    });
  });
});

// ── user_updated ──────────────────────────────────────────────────────────────

describe("audit: user_updated", () => {
  it("calls writeAudit with user_updated for non-disable PATCH /api/dealer/users/:id", async () => {
    const UPDATED_USER = { id: USER_ID, email: "u@test.com", role: "manager", commission_percentage: 12, is_active: true, disabled_at: null };
    const existsChain = selectEqChain({ id: USER_ID });
    const updateObj   = updateChain(UPDATED_USER);

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ ...existsChain, ...updateObj }),
    });

    const res = await userPATCH({
      params:  { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { commission_percentage: 12 }),
    } as never);

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "user_updated",
      adminEmail: ADMIN.email,
      entityRef:  USER_ID,
    });
  });
});

// ── user_disabled ─────────────────────────────────────────────────────────────

describe("audit: user_disabled", () => {
  it("calls writeAudit with user_disabled when PATCH sets is_active: false", async () => {
    const DISABLED_USER = { id: USER_ID, email: "u@test.com", role: "sales", commission_percentage: null, is_active: false, disabled_at: new Date().toISOString() };

    // Count chain for last-active-manager guard (returns count=1 → not the last one)
    const countNeqFn = vi.fn().mockResolvedValue({ count: 1, error: null });
    const countEqFn  = vi.fn().mockReturnValue({ neq: countNeqFn });
    const countInFn  = vi.fn().mockReturnValue({ eq: countEqFn });
    const countSelFn = vi.fn().mockReturnValue({ in: countInFn });

    const updateObj = updateChain(DISABLED_USER);

    (getAdminClient as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: countSelFn, ...updateObj }),
    });

    const res = await userPATCH({
      params:  { userId: USER_ID },
      request: req(`/api/dealer/users/${USER_ID}`, "PATCH", { is_active: false }),
    } as never);

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAudit)).toHaveBeenCalledWith({
      action:     "user_disabled",
      adminEmail: ADMIN.email,
      entityRef:  USER_ID,
    });
  });
});
