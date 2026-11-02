import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { initialAuthHash, supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — C-Tech Fleet Portal" },
      {
        name: "description",
        content: "Set a new C-Tech Fleet Portal password.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [isInvite, setIsInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Read the hash captured before the Supabase client cleared it.
    const hash = new URLSearchParams((initialAuthHash || window.location.hash).replace(/^#/, ""));
    const type = hash.get("type");
    if (hash.get("error") || hash.get("error_code")) {
      setLinkError(
        hash.get("error_code") === "otp_expired"
          ? "This link was already used or has expired. Ask for a new link."
          : hash.get("error_description")?.replace(/\+/g, " ") ?? "This link is invalid. Ask for a new link.",
      );
      return;
    }
    setIsInvite(type === "invite");
    if (type === "recovery" || type === "invite" || hash.get("access_token")) setReady(true);

    // The link signs the person in; an active session means they may set a password.
    supabaseFleet.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = supabaseFleet.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION"))) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabaseFleet.auth.updateUser({
      password,
    });

    if (updateError) {
      setError("This reset link is invalid or has expired.");
      setLoading(false);
      return;
    }

    // Already signed in by the link — send them straight to their own screen.
    setNotice("Password saved! Opening your portal…");
    const { data: { user } } = await supabaseFleet.auth.getUser();
    const { data: roleRow } = user
      ? await supabaseFleet.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
      : { data: null };
    const dest =
      roleRow?.role === "technician" ? "/tech"
      : roleRow?.role === "admin" ? "/admin/select"
      : roleRow?.role === "fleet_manager" ? "/dashboard"
      : roleRow?.role === "customer" ? "/my-car"
      : "/login";
    setTimeout(() => navigate({ to: dest }), 900);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12">
      <div className="w-full max-w-md">
        <CTechLogo variant="dark" size="sm" />
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-[#0F1E3A]">
          {isInvite ? "Set your password" : "Reset password"}
        </h1>
        <p className="mt-2 text-stone-600">
          {isInvite
            ? "Welcome to C-Tech Fleet Portal! Create a password to activate your account."
            : "Create a new portal password."}
        </p>

        {linkError ? (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{linkError}</div>
        ) : !ready ? (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Open this page from the {isInvite ? "invitation" : "password reset"} link you were sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            )}

            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-[11px] font-semibold uppercase text-stone-500"
                style={{ letterSpacing: "0.12em" }}
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 pr-11 text-stone-900 placeholder:text-stone-400 transition focus:border-[#0F1E3A] focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 transition hover:text-stone-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-[11px] font-semibold uppercase text-stone-500"
                style={{ letterSpacing: "0.12em" }}
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 transition focus:border-[#0F1E3A] focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F1E3A] py-4 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {isInvite ? "Activate My Account" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}