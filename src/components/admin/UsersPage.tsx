import { useState, useEffect, useCallback } from "react";

type UserProfile = {
  id: string;
  email: string;
  role: "admin" | "sales" | "owner" | "manager" | "staff";
  commission_percentage: number | null;
  is_active: boolean;
  created_at: string;
};

type Toast = { id: number; msg: string; ok: boolean };

const ROLE_COLOR: Record<string, string> = {
  owner:   "#7c3aed",
  admin:   "#1a7f4b",
  manager: "#3b82f6",
  sales:   "#f59e0b",
  staff:   "#64748b",
};

const DMS_ROLES = ["admin", "sales"] as const;

let toastId = 0;

export default function UsersPage() {
  const [users, setUsers]     = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts]   = useState<Toast[]>([]);

  // Add user form state
  const [email, setEmail]     = useState("");
  const [role, setRole]       = useState<"admin" | "sales">("sales");
  const [commission, setCommission] = useState("");
  const [adding, setAdding]   = useState(false);

  // Inline edit state
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editRole, setEditRole]           = useState<"admin" | "sales">("sales");
  const [editCommission, setEditCommission] = useState("");
  const [saving, setSaving]               = useState(false);

  function toast(msg: string, ok = true) {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dealer/users");
    if (res.ok) {
      setUsers(await res.json());
    } else {
      toast("Failed to load users", false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const body: Record<string, unknown> = { email: email.trim().toLowerCase(), role };
    if (commission !== "") body.commission_percentage = parseFloat(commission);

    const res = await fetch("/api/dealer/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      toast(`${data.email} invited as ${data.role}`);
      setEmail("");
      setCommission("");
      setRole("sales");
      setUsers((u) => [data, ...u]);
    } else {
      toast(data.error ?? "Failed to invite user", false);
    }
    setAdding(false);
  }

  function startEdit(u: UserProfile) {
    setEditingId(u.id);
    setEditRole(u.role === "admin" || u.role === "sales" ? u.role : "sales");
    setEditCommission(u.commission_percentage != null ? String(u.commission_percentage) : "");
  }

  async function saveEdit(u: UserProfile) {
    setSaving(true);
    const body: Record<string, unknown> = { role: editRole };
    body.commission_percentage = editCommission !== "" ? parseFloat(editCommission) : null;

    const res = await fetch(`/api/dealer/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      toast("User updated");
      setUsers((users) => users.map((x) => (x.id === u.id ? { ...x, ...data } : x)));
      setEditingId(null);
    } else {
      toast(data.error ?? "Failed to update user", false);
    }
    setSaving(false);
  }

  async function toggleActive(u: UserProfile) {
    const res = await fetch(`/api/dealer/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    const data = await res.json();
    if (res.ok) {
      toast(u.is_active ? "User deactivated" : "User reactivated");
      setUsers((users) => users.map((x) => (x.id === u.id ? { ...x, ...data } : x)));
    } else {
      toast(data.error ?? "Failed to update user", false);
    }
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return (
    <div>
      <style>{`
        .up-header { margin-bottom: 20px; }
        .up-header h1 { font-size: 24px; font-weight: 800; color: #1a1d23; }
        .up-header p { color: #99a1b2; font-size: 14px; margin-top: 4px; }

        .up-card {
          background: #fff;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .up-card__title {
          font-size: 11px;
          font-weight: 700;
          color: #99a1b2;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 14px;
        }
        .up-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .up-field { display: flex; flex-direction: column; gap: 4px; }
        .up-label { font-size: 11px; font-weight: 600; color: #99a1b2; text-transform: uppercase; }
        .up-input, .up-select {
          padding: 9px 12px;
          border: 1px solid #e4e7ec;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          color: #1a1d23;
          background: #fff;
          min-width: 0;
        }
        .up-input { flex: 1; min-width: 200px; }
        .up-input:focus, .up-select:focus { outline: 2px solid #B92111; border-color: transparent; }
        .up-select { cursor: pointer; }
        .up-hint { font-size: 12px; color: #99a1b2; margin-top: 8px; }

        .up-btn {
          padding: 9px 18px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border: none;
          white-space: nowrap;
          align-self: flex-end;
        }
        .up-btn--primary { background: #1a1d23; color: #fff; }
        .up-btn--primary:hover:not(:disabled) { opacity: 0.85; }
        .up-btn--ghost { background: transparent; border: 1px solid #e4e7ec; color: #1a1d23; }
        .up-btn--ghost:hover:not(:disabled) { background: #f8f9fb; }
        .up-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .up-section {
          background: #fff;
          border: 1px solid #e4e7ec;
          border-radius: 10px;
          overflow: hidden;
        }
        .up-table-wrap { overflow-x: auto; }
        .up-empty { padding: 20px; color: #99a1b2; font-size: 14px; }
        .up-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .up-table th {
          text-align: left;
          padding: 10px 16px;
          font-size: 11px;
          font-weight: 700;
          color: #99a1b2;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e4e7ec;
        }
        .up-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f0f2f5;
          color: #1a1d23;
          vertical-align: middle;
        }
        .up-table tr:last-child td { border-bottom: none; }
        .up-row--inactive td { opacity: 0.5; }

        .up-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .up-dot {
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .up-dot::before { content: "●"; font-size: 8px; }
        .up-dot--active { color: #1a7f4b; }
        .up-dot--active::before { color: #1a7f4b; }
        .up-dot--inactive { color: #99a1b2; }
        .up-dot--inactive::before { color: #99a1b2; }

        .up-actions { display: flex; gap: 10px; align-items: center; }
        .up-link {
          background: none; border: none; padding: 0;
          cursor: pointer; font-size: 13px; font-weight: 500;
          font-family: inherit; color: #3b82f6;
        }
        .up-link:hover { text-decoration: underline; }
        .up-link--danger { color: #B92111; }
        .up-link--muted { color: #99a1b2; }

        .up-inline-edit { display: flex; gap: 6px; align-items: center; }
        .up-inline-input {
          padding: 4px 8px;
          border: 1px solid #e4e7ec;
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
          width: 80px;
        }
        .up-inline-select {
          padding: 4px 6px;
          border: 1px solid #e4e7ec;
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
        }

        .up-toasts {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 9999;
        }
        .up-toast {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          animation: slideIn 0.2s ease;
        }
        .up-toast--ok { background: #d1fae5; color: #065f46; }
        .up-toast--err { background: #fee2e2; color: #7f1d1d; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .up-spinner { display: inline-block; }
      `}</style>

      {/* Toasts */}
      <div className="up-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`up-toast ${t.ok ? "up-toast--ok" : "up-toast--err"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      <div className="up-header">
        <h1>Team Users</h1>
        <p>Manage who can access this portal and their roles.</p>
      </div>

      {/* Add user form */}
      <div className="up-card">
        <div className="up-card__title">Invite User</div>
        <form onSubmit={handleAdd}>
          <div className="up-row">
            <div className="up-field" style={{ flex: 1, minWidth: 200 }}>
              <label className="up-label">Email</label>
              <input
                type="email"
                className="up-input"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="up-field">
              <label className="up-label">Role</label>
              <select
                className="up-select"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "sales")}
              >
                {DMS_ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="up-field">
              <label className="up-label">Commission %</label>
              <input
                type="number"
                className="up-input"
                placeholder="e.g. 10"
                min={0}
                max={100}
                step={0.1}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                style={{ width: 110 }}
              />
            </div>
            <button type="submit" className="up-btn up-btn--primary" disabled={adding}>
              {adding ? "Inviting…" : "Invite"}
            </button>
          </div>
          <p className="up-hint">User will receive a magic-link invitation email.</p>
        </form>
      </div>

      {/* Users table */}
      <div className="up-section">
        <div className="up-table-wrap">
          {loading ? (
            <div className="up-empty">Loading…</div>
          ) : users.length === 0 ? (
            <div className="up-empty">No users found.</div>
          ) : (
            <table className="up-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Commission %</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingId === u.id;
                  const color = ROLE_COLOR[u.role] ?? "#64748b";
                  return (
                    <tr key={u.id} className={u.is_active ? "" : "up-row--inactive"}>
                      <td style={{ fontWeight: 500 }}>{u.email}</td>
                      <td>
                        {isEditing ? (
                          <select
                            className="up-inline-select"
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as "admin" | "sales")}
                          >
                            {DMS_ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="up-badge"
                            style={{ background: `${color}22`, color }}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            className="up-inline-input"
                            value={editCommission}
                            min={0}
                            max={100}
                            step={0.1}
                            placeholder="—"
                            onChange={(e) => setEditCommission(e.target.value)}
                          />
                        ) : (
                          u.commission_percentage != null
                            ? `${u.commission_percentage}%`
                            : <span style={{ color: "#99a1b2" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`up-dot ${u.is_active ? "up-dot--active" : "up-dot--inactive"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmt(u.created_at)}</td>
                      <td>
                        <div className="up-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="up-link"
                                onClick={() => saveEdit(u)}
                                disabled={saving}
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                className="up-link up-link--muted"
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="up-link" onClick={() => startEdit(u)}>
                                Edit
                              </button>
                              <button
                                className={`up-link ${u.is_active ? "up-link--danger" : ""}`}
                                onClick={() => toggleActive(u)}
                              >
                                {u.is_active ? "Deactivate" : "Reactivate"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
