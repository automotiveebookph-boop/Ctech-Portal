import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = hash.get("type");
    const accessToken = hash.get("access_token");
    setReady(type === "recovery" || Boolean(accessToken));
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

    await supabaseFleet.auth.signOut();
    setNotice("Password updated. Redirecting to sign in…");
    setTimeout(() => navigate({ to: "/" }), 900);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12">
      <div className="w-full max-w-md">
        <CTechLogo variant="dark" size="sm" />
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-[#0F1E3A]">
          Reset password
        </h1>
        <p className="mt-2 text-stone-600">Create a new portal password.</p>

        {!ready ? (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Open this page from the password reset link sent to your email.
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
              Update password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}