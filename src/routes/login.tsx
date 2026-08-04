import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck, Users } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";
import { getOrCreateCustomerRole } from "@/lib/customer-role-linking";
import { getAudience, AUDIENCE_INFO, ROLE_HOST, type Role } from "@/lib/subdomain";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign In — C-Tech Service Portal" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Which "door" (subdomain) is this? Drives branding + who may sign in here.
  const audience = useMemo(() => getAudience(), []);
  const audienceInfo = audience === "any" ? null : AUDIENCE_INFO[audience];
  const isAdminDoor = audienceInfo?.kind === "admin";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const normalizedEmail = email.trim();
      const { data, error: signInError } = await supabaseFleet.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError || !data.user) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      const { data: roleRow, error: roleError } = await supabaseFleet
        .from("user_roles")
        .select("role, customer_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (roleError) {
        await supabaseFleet.auth.signOut();
        setError("Account not yet activated. Contact your fleet manager.");
        setLoading(false);
        return;
      }

      const linkedRoleRow = await getOrCreateCustomerRole(
        data.user.id,
        data.user.email ?? normalizedEmail,
        roleRow,
      );

      if (!linkedRoleRow) {
        await supabaseFleet.auth.signOut();
        setError("Account not activated. Contact your administrator.");
        setLoading(false);
        return;
      }

      const role = linkedRoleRow.role as Role | string;

      // Subdomain door enforcement: on a scoped door, only its audience may enter.
      if (audienceInfo) {
        if (role === audienceInfo.allowedRole) {
          navigate({ to: audienceInfo.landingPath });
        } else {
          await supabaseFleet.auth.signOut();
          const host = ROLE_HOST[role as Role];
          setError(
            host
              ? `This is the ${audienceInfo.label} sign-in. Your account isn't for this page — please sign in at ${host}.`
              : "This account isn't activated for this sign-in page. Contact your administrator.",
          );
          setLoading(false);
        }
        return;
      }

      // Unscoped door ("any" — localhost/preview/apex): route by role as before.
      if (role === "admin") {
        navigate({ to: "/admin/select" });
      } else if (role === "fleet_manager") {
        navigate({ to: "/dashboard" });
      } else if (role === "customer") {
        navigate({ to: "/my-car" });
      } else {
        await supabaseFleet.auth.signOut();
        setError("Account not activated. Contact your administrator.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const normalizedEmail = email.trim();
    setError(null);
    setNotice(null);
    if (!normalizedEmail) {
      setError("Enter your email address first, then request a password reset.");
      return;
    }
    setResetLoading(true);
    const { error: resetError } = await supabaseFleet.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      if (resetError.code === "over_email_send_rate_limit") {
        setError("Too many reset emails were requested. Please wait a few minutes, then try again.");
      } else {
        setError("Password reset is not available for that email address.");
      }
    } else {
      setNotice("If this email exists, a password reset link has been sent.");
    }
    setResetLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 text-white"
        style={{ backgroundImage: "linear-gradient(135deg, #0F1E3A 0%, #1E3464 100%)" }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(201,162,39,0.35) 0%, rgba(201,162,39,0) 70%)" }}
        />
        <div className="relative z-10"><CTechLogo variant="light" size="md" /></div>
        <div className="relative z-10 max-w-lg">
          <span className="inline-block text-[11px] font-semibold uppercase px-3 py-1.5 rounded-md mb-8"
            style={{ color: "#C9A227", backgroundColor: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.25)", letterSpacing: "0.18em" }}>
            {audienceInfo ? `${audienceInfo.label}${isAdminDoor ? " · Staff" : ""}` : "Service Portal"}
          </span>
          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
            <span className="text-white">C-Tech Automotive</span><br />
            <span style={{ color: "#C9A227" }}>Next Level Automotive Excellence</span>
          </h1>
          <p className="mt-6 text-base text-white/70 leading-relaxed max-w-md">
            Your Automotive expert partner in Bulacan.<br />
            <span className="text-white/50 text-sm mt-2 block">
              Real-time visibility into every vehicle. Service history at your fingertips.
            </span>
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-8 text-sm text-white/60">
          <div className="flex items-center gap-2"><ShieldCheck size={16} style={{ color: "#C9A227" }} /><span>Secure access</span></div>
          <div className="flex items-center gap-2"><Users size={16} style={{ color: "#C9A227" }} /><span>Trusted by fleets</span></div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-full lg:w-1/2 flex flex-col" style={{ backgroundImage: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)" }}>
        <div className="lg:hidden p-6 border-b border-stone-200/60"><CTechLogo variant="dark" size="sm" /></div>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-6 inline-block text-sm text-stone-500 hover:text-stone-800 transition">← Back to Home</Link>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#0F1E3A" }}>Welcome back</h2>
            <p className="mt-2 text-stone-600">
              {audienceInfo
                ? isAdminDoor
                  ? `${audienceInfo.label} — staff sign-in`
                  : `Sign in to the ${audienceInfo.label}`
                : "Sign in to your portal"}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

              <div>
                <label htmlFor="email" className="block text-[11px] font-semibold uppercase text-stone-500 mb-2" style={{ letterSpacing: "0.12em" }}>
                  Email Address
                </label>
                <input
                  id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading}
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 focus:border-[#0F1E3A] transition disabled:opacity-60"
                  placeholder="you@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[11px] font-semibold uppercase text-stone-500 mb-2" style={{ letterSpacing: "0.12em" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                    className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 pr-11 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 focus:border-[#0F1E3A] transition disabled:opacity-60"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-400 hover:text-stone-700 transition" tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={handleForgotPassword} disabled={loading || resetLoading}
                  className="-mr-3 rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-stone-200/70 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ color: "#0F1E3A" }}>
                  {resetLoading ? "Sending…" : "Forgot password?"}
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="group w-full flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-semibold text-white transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#0F1E3A" }}>
                {loading
                  ? (<><Loader2 size={18} className="animate-spin" /><span>Signing in…</span></>)
                  : (<><span>Sign In</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" /></>)}
              </button>

              {!isAdminDoor && (
                <p className="text-center text-sm text-stone-600 pt-2">
                  Not a client yet?{" "}
                  <Link to="/request-access" className="font-semibold hover:underline" style={{ color: "#C9A227" }}>
                    Request access
                  </Link>
                </p>
              )}
            </form>

            <div className="mt-10 flex flex-col items-center justify-center gap-1.5 text-xs text-stone-400">
              <div className="flex items-center gap-2"><Lock size={12} /><span>Secured by C-Tech Automotive · Philippines</span></div>
              <div>📍 Sto. Cristo, Pulilan, Bulacan</div>
              <div>Mon-Sat 8AM-5PM · 0998-151-6245</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
