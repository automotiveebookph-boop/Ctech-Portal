import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Smartphone } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";

export const Route = createFileRoute("/admin/walkin/team")({
  component: TeamPage,
});

type Staff = { id: string; full_name: string; email: string | null; shop_role: string; active: boolean; auth_user_id: string | null };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", technician: "Technician" };

// Owner screen: give each technician their own login for the Home Service
// phone app. "Get login link" returns a one-time link to send by Messenger/SMS.
function TeamPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; url: string; kind: string } | null>(null);

  async function load() {
    const { data } = await supabaseFleet.from("staff").select("id, full_name, email, shop_role, active, auth_user_id").order("shop_role").order("full_name");
    const rows = (data ?? []) as Staff[];
    setStaff(rows);
    setEmails(Object.fromEntries(rows.map((s) => [s.id, s.email ?? ""])));
  }
  useEffect(() => { void load(); }, []);

  async function saveEmail(s: Staff) {
    const email = (emails[s.id] ?? "").trim().toLowerCase();
    if (email === (s.email ?? "")) return;
    const { error, count } = await supabaseFleet.from("staff").update({ email: email || null }, { count: "exact" }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    if (!count) { toast.error("Only the owner or an admin can change staff emails."); return; }
    toast.success(`Saved ${s.full_name}'s email`);
    void load();
  }

  async function getLink(s: Staff) {
    setBusy(s.id);
    const { data, error } = await supabaseFleet.functions.invoke("staff-login-link", { body: { staff_id: s.id } });
    setBusy(null);
    // Non-2xx responses arrive as `error`; the readable message is in its body.
    let err = (data as { error?: string } | null)?.error ?? null;
    if (error) {
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      err = body?.error ?? error.message;
    }
    if (err) { toast.error(err); return; }
    const d = data as { link: string; kind: string };
    setLink({ name: s.full_name, url: d.link, kind: d.kind });
    void load();
  }

  function copyMessage() {
    if (!link) return;
    const msg = `Hi ${link.name}! 👋 Ito ang link para ma-set mo ang password mo sa C-Tech Home Service app:\n${link.url}\n\nPagkatapos, mag-sign in sa https://staff.ctechautomotiveph.com gamit ang email mo. Gamitin sa Chrome sa phone mo. 🔧`;
    navigator.clipboard.writeText(msg).then(() => toast.success("Message copied — paste it in Messenger"), () => toast.error("Couldn't copy"));
  }

  return (
    <>
      <header className="border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
        <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Team &amp; logins</h1>
        <p className="mt-0.5 text-sm text-stone-500">Give technicians their own login for the Home Service phone app.</p>
      </header>

      <main className="space-y-4 p-4 md:p-8">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>How it works:</strong> enter the technician's email → tap <strong>Get login link</strong> → send them the message.
            They open it on their Android phone, set a password, then sign in at <strong>staff.ctechautomotiveph.com</strong> in Chrome.
            Technicians only see the Home Service screen. Links can be used once; tap again for a new one (also works to reset a forgotten password).
          </div>
        </div>

        <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {staff.map((s) => {
            const canLogin = s.shop_role === "technician" && s.active;
            return (
              <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-[140px]">
                  <div className="font-semibold" style={{ color: "#0F1E3A" }}>{s.full_name}</div>
                  <div className="text-xs text-stone-500">
                    {ROLE_LABEL[s.shop_role] ?? s.shop_role}{!s.active ? " · inactive" : ""}
                    {s.auth_user_id ? <span className="ml-1.5 font-semibold text-emerald-700">· has login</span> : null}
                  </div>
                </div>
                <input
                  type="email"
                  value={emails[s.id] ?? ""}
                  onChange={(e) => setEmails((m) => ({ ...m, [s.id]: e.target.value }))}
                  onBlur={() => void saveEmail(s)}
                  placeholder="technician@email.com"
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
                {canLogin ? (
                  <button disabled={busy === s.id} onClick={() => void getLink(s)} className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
                    <KeyRound className="h-4 w-4" /> {busy === s.id ? "Creating…" : s.auth_user_id ? "New login link" : "Get login link"}
                  </button>
                ) : (
                  <span className="text-xs text-stone-500 sm:w-[150px] sm:text-right">{s.shop_role === "technician" ? "Inactive" : "Uses the admin login"}</span>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {link && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-1 text-lg font-bold" style={{ color: "#0F1E3A" }}>Login link for {link.name}</h2>
            <p className="mb-3 text-sm text-stone-600">{link.kind === "invite" ? "New login created." : "Password-reset link (they already have a login)."} Send this to {link.name} only — anyone with the link can set the password.</p>
            <div className="mb-4 break-all rounded-lg bg-stone-50 p-3 font-mono text-xs text-stone-600">{link.url}</div>
            <div className="flex flex-col gap-2">
              <button onClick={copyMessage} className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white" style={{ backgroundColor: "#0F1E3A" }}>
                <Copy className="h-4 w-4" /> Copy message for Messenger
              </button>
              <button onClick={() => setLink(null)} className="rounded-lg py-2 text-sm text-stone-600 hover:bg-stone-100">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
