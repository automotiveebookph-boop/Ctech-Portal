import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";

// Landing page for staff login links. Messenger's in-app browser preloads
// links, which used to burn Supabase's one-time verify link before the person
// tapped it. Here the one-time code is only spent when they press Continue.
export const Route = createFileRoute("/activate")({
  head: () => ({ meta: [{ title: "Set up your login — C-Tech Automotive" }] }),
  validateSearch: (s: Record<string, unknown>): { th?: string; type?: string } => ({
    th: typeof s.th === "string" ? s.th : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
  component: ActivatePage,
});

function ActivatePage() {
  const { th, type } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!th) return;
    setBusy(true);
    setError(null);
    await supabaseFleet.auth.signOut(); // don't mix with whoever was signed in on this phone
    const { error: err } = await supabaseFleet.auth.verifyOtp({ token_hash: th, type: type === "invite" ? "invite" : "recovery" });
    if (err) {
      setError("This link was already used or has expired. Ask for a new link.");
      setBusy(false);
      return;
    }
    navigate({ to: "/reset-password" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12">
      <div className="w-full max-w-md">
        <CTechLogo variant="dark" size="sm" />
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-[#0F1E3A]">Set up your login</h1>
        <p className="mt-2 text-stone-600">Tap Continue to create your password for the C-Tech app.</p>
        {!th ? (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">This link is incomplete. Ask for a new link.</div>
        ) : (
          <>
            {error && <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button
              onClick={() => void go()}
              disabled={busy}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F1E3A] py-4 text-base font-semibold text-white disabled:opacity-70"
            >
              {busy && <Loader2 size={18} className="animate-spin" />}
              Continue
            </button>
            <p className="mt-4 text-center text-xs text-stone-500">Tip: open this in Chrome (⋮ → Open in Chrome) so you stay signed in.</p>
          </>
        )}
      </div>
    </main>
  );
}
