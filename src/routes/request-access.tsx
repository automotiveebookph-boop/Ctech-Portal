import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";

export const Route = createFileRoute("/request-access")({
  head: () => ({
    meta: [{ title: "Request Access — C-Tech Automotive" }],
  }),
  component: RequestAccessPage,
});

function RequestAccessPage() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", vehicle_info: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: dbError } = await supabaseFleet.from("contact_requests").insert([form]);
    setLoading(false);
    if (dbError) {
      setError("Something went wrong. Please try again or call us directly.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundImage: "linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)" }}>
      {/* LEFT */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 text-white"
        style={{ backgroundImage: "linear-gradient(135deg, #0F1E3A 0%, #1E3464 100%)" }}>
        <div className="relative z-10"><CTechLogo variant="light" size="md" /></div>
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold leading-tight text-white">Join the C-Tech client portal</h2>
          <p className="mt-4 text-white/60 text-base leading-relaxed">
            Get full visibility into your vehicle's service history, upcoming maintenance, and easy online booking — all in one place.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/70">
            {[
              "Full service history at your fingertips",
              "Know what's due before you have to ask",
              "Book appointments in seconds",
              "Real-time status updates",
            ].map((b) => (
              <div key={b} className="flex items-center gap-3">
                <CheckCircle2 size={16} style={{ color: "#C9A227" }} />
                {b}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-white/40">Mon–Sat 8AM–5PM · 0998-151-6245 · Pulilan, Bulacan</div>
      </div>

      {/* RIGHT */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-block text-sm text-stone-500 hover:text-stone-800 transition">← Back to Home</Link>

          {done ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="mt-4 text-2xl font-bold" style={{ color: "#0F1E3A" }}>Request Received!</h2>
              <p className="mt-2 text-stone-600">We'll review your request and get in touch within 24 hours.</p>
              <p className="mt-1 text-sm text-stone-500">In the meantime, feel free to call us at 0998-151-6245.</p>
              <Link to="/" className="mt-6 inline-block text-sm font-semibold hover:underline" style={{ color: "#0F1E3A" }}>
                ← Back to Home
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold" style={{ color: "#0F1E3A" }}>Request Access</h2>
              <p className="mt-2 text-stone-500">Fill in your details and we'll set up your account.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}
                {[
                  { key: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Juan dela Cruz" },
                  { key: "email", label: "Email Address", type: "email", required: true, placeholder: "you@email.com" },
                  { key: "phone", label: "Phone Number", type: "tel", required: false, placeholder: "09XX-XXX-XXXX" },
                  { key: "vehicle_info", label: "Vehicle (Year / Make / Model)", type: "text", required: false, placeholder: "e.g. 2019 Toyota Vios" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={f.type}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={form[f.key as keyof typeof form]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 focus:border-[#0F1E3A] transition"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">Message (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Any specific services or questions?"
                    value={form.message}
                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 focus:border-[#0F1E3A] transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-semibold text-white disabled:opacity-70 transition"
                  style={{ backgroundColor: "#0F1E3A" }}
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                    : <><span>Submit Request</span><ArrowRight size={16} /></>}
                </button>
                <p className="text-center text-xs text-stone-400">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold hover:underline" style={{ color: "#C9A227" }}>Sign In</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
