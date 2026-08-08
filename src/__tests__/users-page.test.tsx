/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UsersPage from "../components/admin/UsersPage";

const USERS = [
  { id: "u1", email: "owner@alfursanauto.ca", role: "owner", commission_percentage: null, is_active: true, created_at: "2026-01-01T00:00:00Z" },
  { id: "u2", email: "sales@alfursanauto.ca", role: "sales", commission_percentage: 10, is_active: false, created_at: "2026-02-01T00:00:00Z" },
];

describe("UsersPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => USERS,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads and renders the user list", async () => {
    render(<UsersPage />);
    expect(await screen.findByText("owner@alfursanauto.ca")).toBeInTheDocument();
    expect(screen.getByText("sales@alfursanauto.ca")).toBeInTheDocument();
    // Inactive user row shows "Inactive" status dot.
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an empty state when there are no users", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });
    render(<UsersPage />);
    expect(await screen.findByText(/No users found\./i)).toBeInTheDocument();
  });

  it("shows an error toast when the initial load fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<UsersPage />);
    expect(await screen.findByText(/Failed to load users/i)).toBeInTheDocument();
  });

  it("invites a new user via the add-user form", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => USERS }) // initial load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "u3", email: "new@alfursanauto.ca", role: "sales", commission_percentage: null, is_active: true, created_at: "2026-08-01T00:00:00Z" }),
      });

    render(<UsersPage />);
    await screen.findByText("owner@alfursanauto.ca");

    fireEvent.change(screen.getByPlaceholderText("user@example.com"), { target: { value: "new@alfursanauto.ca" } });
    fireEvent.click(screen.getByRole("button", { name: /Invite/i }));

    expect(await screen.findByText(/invited as sales/i)).toBeInTheDocument();
    expect(screen.getByText("new@alfursanauto.ca")).toBeInTheDocument();
  });
});
