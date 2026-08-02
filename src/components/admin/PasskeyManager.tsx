import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
  supabaseUrl: string;
  supabaseKey: string;
};

type Passkey = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export function fmtDate(iso?: string) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Turns a `supabase.auth.passkey.list()` result into either a passkey list or
 * an error message — pulled out as a pure function so this branch can be unit
 * tested without a DOM (a prior refactor silently dropped the API call here,
 * leaving the Account page stuck on "Loading…" forever).
 */
export function parsePasskeyListResult(
  result: { data: Passkey[] | null; error: { message?: string } | null }
): { passkeys: Passkey[]; error: string | null } {
  if (result.error) {
    return { passkeys: [], error: result.error.message ?? "Failed to load passkeys" };
  }
  return { passkeys: result.data ?? [], error: null };
}

export default function PasskeyManager({ supabaseUrl, supabaseKey }: Props) {
  const [supabase] = useState(() =>
    createClient(supabaseUrl, supabaseKey, { auth: { experimental: { passkey: true } } })
  );
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const supportsWebAuthn = typeof window !== "undefined" && "PublicKeyCredential" in window;

  function show(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadPasskeys() {
    const result = await supabase.auth.passkey.list();
    const { passkeys: list, error } = parsePasskeyListResult(result);
    setPasskeys(list);
    setLoadError(error);
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setHasSession(false);
          return;
        }
        setHasSession(true);
        setEmail(data.session.user.email ?? null);
        await loadPasskeys();
      } catch (err) {
        // Guard against any unexpected throw (e.g. a misconfigured client) so
        // the page never gets stuck on "Loading…" with no explanation.
        setHasSession(true);
        setPasskeys([]);
        setLoadError(err instanceof Error ? err.message : "Failed to load passkeys");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registerPasskey() {
    setRegistering(true);
    try {
      const { data, error } = await supabase.auth.registerPasskey();
      if (error || !data) {
        show(error?.message ?? "Failed to register passkey", false);
        return;
      }
      show("Passkey registered!", true);
      await loadPasskeys();
    } finally {
      setRegistering(false);
    }
  }

  async function deletePasskey(id: string) {
    if (!confirm("Remove this passkey? You will no longer be able to sign in with it.")) return;
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (error) {
      show(error.message ?? "Failed to remove passkey", false);
      return;
    }
    show("Passkey removed.", true);
    await loadPasskeys();
  }

  return (
    <div className="pk-wrap">
      {toast && <div className={`pk-toast ${toast.ok ? "pk-toast--ok" : "pk-toast--err"}`}>{toast.msg}</div>}

      <h1>Passkeys</h1>
      <p className="pk-sub">
        Sign in to the admin portal without a magic link, using your device's built-in authentication
        (fingerprint, face, or security key) — a passkey is tied to the device/browser you register it
        from, so add one on every device you regularly sign in with.
        {email && <> Managing passkeys for <strong>{email}</strong>.</>}
      </p>

      {hasSession === false && (
        <div className="pk-notice">
          We couldn't verify your sign-in session for passkey management. Please{" "}
          <a href="/admin/signout/?next=/admin/">sign out and back in</a>, then return to this page.
        </div>
      )}

      {!supportsWebAuthn && (
        <div className="pk-notice">
          This browser doesn't support passkeys. Try a recent version of Chrome, Safari, or Edge.
        </div>
      )}

      {loadError && (
        <div className="pk-notice">
          Couldn't load your passkeys: {loadError}. This usually means passkeys aren't enabled on this
          Supabase project yet, or the connection to Supabase failed.{" "}
          <button type="button" className="pk-retry" onClick={loadPasskeys}>Retry</button>
        </div>
      )}

      {hasSession && (
        <>
          <button
            type="button"
            className="btn-save"
            onClick={registerPasskey}
            disabled={registering || !supportsWebAuthn}
          >
            {registering ? "Waiting for passkey…" : "+ Add a Passkey"}
          </button>

          <div className="pk-list">
            {passkeys === null && !loadError && <p className="pk-empty">Loading…</p>}
            {passkeys !== null && passkeys.length === 0 && (
              <p className="pk-empty">
                No passkeys registered yet. Click "+ Add a Passkey" above to create one for this device.
              </p>
            )}
            {passkeys && passkeys.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Added</th>
                    <th>Last used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {passkeys.map((pk) => (
                    <tr key={pk.id}>
                      <td>{pk.friendly_name || "Unnamed passkey"}</td>
                      <td>{fmtDate(pk.created_at)}</td>
                      <td>{fmtDate(pk.last_used_at)}</td>
                      <td>
                        <button type="button" className="btn-danger" onClick={() => deletePasskey(pk.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <style>{`
        .pk-wrap { font-family: 'Inter', sans-serif; max-width: 700px; }
        .pk-wrap h1 { font-size: 22px; font-weight: 800; color: #1a1d23; margin-bottom: 6px; }
        .pk-sub { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
        .pk-notice {
          background: #fef2f1; color: #b92111; border: 1px solid #fca5a5;
          border-radius: 8px; padding: 12px 16px; font-size: 14px; margin-bottom: 20px;
        }
        .pk-notice a { color: #b92111; font-weight: 600; }
        .pk-retry {
          background: none; border: none; color: #b92111; font-weight: 700;
          font-size: 14px; cursor: pointer; text-decoration: underline; padding: 0;
        }
        .pk-list { margin-top: 20px; }
        .pk-empty { font-size: 14px; color: #99a1b2; }
        .pk-list table {
          width: 100%; border-collapse: collapse; font-size: 13px;
          background: #fff; border: 1px solid #e4e7ec; border-radius: 8px; overflow: hidden;
        }
        .pk-list th {
          text-align: left; padding: 8px 14px; font-weight: 700; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.04em; color: #99a1b2;
          border-bottom: 1px solid #e4e7ec;
        }
        .pk-list td { padding: 10px 14px; color: #374151; }
        .btn-save {
          padding: 8px 20px; background: #b92111; color: #fff; border: none;
          border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .btn-save:hover:not(:disabled) { background: #9e1c0e; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-danger {
          padding: 5px 12px; background: #fef2f1; color: #b92111; border: 1px solid #fca5a5;
          border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .btn-danger:hover { background: #fee2e2; }
        .pk-toast {
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .pk-toast--ok  { background: #ecfdf5; color: #1a7f4b; border: 1px solid #86efac; }
        .pk-toast--err { background: #fef2f1; color: #b92111; border: 1px solid #fca5a5; }
      `}</style>
    </div>
  );
}
