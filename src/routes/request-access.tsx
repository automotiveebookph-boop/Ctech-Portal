import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";

export const Route = createFileRoute("/request-access")({
  head: () => ({
    meta: [{ title: "Request Access — C-Tech Automotive" }],
  }),
  component: RequestAccessPage,
});

type VehicleEntry = {
  make: string;
  model: string;
  year: string;
  transmission: "Automatic" | "Manual" | "";
  odometer: string;
};

function emptyVehicle(): VehicleEntry {
  return { make: "", model: "", year: "", transmission: "", odometer: "" };
}

const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20 focus:border-[#0F1E3A] transition";

function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([emptyVehicle()]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVehicle(idx: number, field: keyof VehicleEntry, value: string) {
    setVehicles((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  }

  function addVehicle() {
    setVehicles((prev) => [...prev, emptyVehicle()]);
  }

  function removeVehicle(idx: number) {
    setVehicles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build a summary string for vehicle_info (backward compat)
    const vehicleSummary = vehicles
      .filter((v) => v.make || v.model)
      .map((v) => {
        const parts = [v.year, v.make, v.model].filter(Boolean).join(" ");
        const details = [v.transmission, v.odometer ? `${Number(v.odometer).toLocaleString()} km` : ""].filter(Boolean).join(", ");
        return details ? `${parts} (${details})` : parts;
      })
      .join("; ");

    const { error: dbError } = await supabaseFleet.from("contact_requests").insert([{
      full_name: fullName,
      email,
      phone: phone || null,
      vehicle_info: vehicleSummary || null,
      vehicles: vehicles.filter((v) => v.make || v.model),
      message: message || null,
    }]);

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

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                {/* Personal info */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required placeholder="Juan dela Cruz" value={fullName}
                    onChange={(e) => setFullName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input type="email" required placeholder="you@email.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">
                    Phone Number
                  </label>
                  <input type="tel" placeholder="09XX-XXX-XXXX" value={phone}
                    onChange={(e) => setPhone(e.target.value)} className={inputCls} />
                </div>

                {/* Vehicles */}
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Vehicle{vehicles.length > 1 ? "s" : ""} <span className="text-red-500">*</span>
                  </div>

                  <div className="space-y-4">
                    {vehicles.map((v, idx) => (
                      <div key={idx} className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                        {vehicles.length > 1 && (
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-stone-500">Vehicle {idx + 1}</span>
                            <button type="button" onClick={() => removeVehicle(idx)}
                              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Make</label>
                            <input type="text" placeholder="Toyota" value={v.make} required={idx === 0}
                              onChange={(e) => updateVehicle(idx, "make", e.target.value)}
                              className={inputCls + " py-2.5 text-sm"} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Model</label>
                            <input type="text" placeholder="Vios" value={v.model} required={idx === 0}
                              onChange={(e) => updateVehicle(idx, "model", e.target.value)}
                              className={inputCls + " py-2.5 text-sm"} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Year</label>
                            <input type="number" placeholder="2019" min="1990" max="2030" value={v.year}
                              onChange={(e) => updateVehicle(idx, "year", e.target.value)}
                              className={inputCls + " py-2.5 text-sm"} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Transmission</label>
                            <select value={v.transmission}
                              onChange={(e) => updateVehicle(idx, "transmission", e.target.value)}
                              className={inputCls + " py-2.5 text-sm"}>
                              <option value="">— Select —</option>
                              <option value="Automatic">Automatic</option>
                              <option value="Manual">Manual</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Current Odometer (km)</label>
                          <input type="number" placeholder="e.g. 45000" min="0" value={v.odometer}
                            onChange={(e) => updateVehicle(idx, "odometer", e.target.value)}
                            className={inputCls + " py-2.5 text-sm"} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={addVehicle}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 hover:border-stone-400 hover:bg-stone-50 transition w-full justify-center">
                    <Plus size={15} />
                    Add Another Vehicle
                  </button>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">Message (optional)</label>
                  <textarea rows={3} placeholder="Any specific services or questions?"
                    value={message} onChange={(e) => setMessage(e.target.value)}
                    className={inputCls} />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-semibold text-white disabled:opacity-70 transition"
                  style={{ backgroundColor: "#0F1E3A" }}>
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
