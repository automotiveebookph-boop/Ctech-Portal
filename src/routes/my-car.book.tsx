import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { MyCarTopNav } from "@/components/MyCarTopNav";
import { MyCarFooter } from "@/components/MyCarFooter";
import { statusBadgeClass, useMyCarSession } from "@/lib/my-car-session";
import {
  ScheduleBookingPicker,
  type ScheduleSelection,
} from "@/components/ScheduleBookingPicker";

export const Route = createFileRoute("/my-car/book")({
  component: BookPage,
});

const SERVICE_TYPES = [
  "Oil Change / PMS",
  "Brake Inspection",
  "Tire Rotation / Balancing",
  "Air Filter Replacement",
  "Full Inspection",
  "Engine Check",
  "Battery Check",
  "Other",
];

function BookPage() {
  const { loading, customer, vehicle } = useMyCarSession();
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [schedule, setSchedule] = useState<ScheduleSelection | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<null | {
    serviceType: string;
    date: string;
    time: string;
    ref: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = customer?.full_name.split(" ")[0] ?? "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!serviceType || !schedule?.schedule_id) {
      setError("Please pick a date and time block.");
      return;
    }
    if (!vehicle || !customer) {
      setError("Your vehicle info is still loading. Please wait a moment.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // vehicle came from vehicle_status_view — resolve the real vehicles.id
    // via unit_id (unique) so the FK on appointments.vehicle_id is satisfied.
    let resolvedVehicleId =
      (vehicle as { id?: string; vehicle_id?: string }).id ??
      (vehicle as { id?: string; vehicle_id?: string }).vehicle_id ??
      null;

    if (!resolvedVehicleId && vehicle.unit_id) {
      const { data: vRow } = await supabaseFleet
        .from("vehicles")
        .select("id")
        .eq("unit_id", vehicle.unit_id)
        .maybeSingle();
      resolvedVehicleId = (vRow?.id as string | undefined) ?? null;
    }

    if (!resolvedVehicleId) {
      setSubmitting(false);
      setError("Could not identify your vehicle. Please contact support.");
      return;
    }

    const payload = {
      vehicle_id: resolvedVehicleId,
      customer_id: customer.id,
      schedule_id: schedule.schedule_id,
      preferred_date: schedule.date,
      preferred_time: schedule.time_block,
      service_type: serviceType,
      notes: notes || null,
      status: "pending",
    };
    console.log("[my-car/book] inserting appointment:", payload);
    const { data: inserted, error: insertError } = await supabaseFleet
      .from("appointments")
      .insert([payload])
      .select("id")
      .single();
    setSubmitting(false);
    if (insertError) {
      console.error("[my-car/book] insert error:", insertError);
      setError(`Could not submit booking: ${insertError.message}`);
      return;
    }
    const ref = inserted?.id ? `CT-${inserted.id.slice(0, 8).toUpperCase()}` : "CT-PENDING";
    setSuccess({
      serviceType,
      date: schedule.date,
      time: schedule.time_block,
      ref,
    });
  }

  if (loading || !customer || !vehicle) {
    return (
      <div className="min-h-screen bg-stone-50">
        <MyCarTopNav firstName="" />
        <div className="mx-auto max-w-lg p-6">
          <div className="h-96 animate-pulse rounded-2xl bg-stone-200" />
          <p className="mt-4 text-center text-sm text-stone-500">
            Loading your vehicle…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <MyCarTopNav firstName={firstName} customerId={customer.id} />

      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
          Book a Service
        </h1>
        <p className="mt-1 text-stone-500">
          Schedule your next visit to C-Tech Automotive
        </p>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
          {vehicle && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-stone-50 p-4">
              <span className="text-2xl">🚗</span>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate font-semibold"
                  style={{ color: "#0F1E3A" }}
                >
                  {vehicle.plate_number} · {vehicle.year} {vehicle.make}{" "}
                  {vehicle.model}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${statusBadgeClass(vehicle.service_status)}`}
              >
                {vehicle.service_status}
              </span>
            </div>
          )}

          {success ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="mt-4 text-2xl font-bold" style={{ color: "#0F1E3A" }}>
                Booking Submitted!
              </h2>
              <div className="mt-4 inline-block rounded-xl border border-stone-200 bg-stone-50 px-6 py-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Reference No.</p>
                <p className="mt-1 text-xl font-bold tracking-wide" style={{ color: "#0F1E3A" }}>{success.ref}</p>
              </div>
              <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50 p-4 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Service</span>
                  <span className="font-semibold text-stone-800">{success.serviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Date</span>
                  <span className="font-semibold text-stone-800">{success.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Time</span>
                  <span className="font-semibold text-stone-800">{success.time}</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-stone-500">
                We'll confirm via SMS or call within 24 hours.<br />
                📞 0998-151-6245 / 0995-230-0296
              </p>
              <Link
                to="/my-car/appointments"
                className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "#0F1E3A" }}
              >
                View My Bookings →
              </Link>
              <div className="mt-3">
                <Link to="/my-car" className="text-sm text-stone-400 hover:text-stone-600">← Back to My Car</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Service Type *
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-[#0F1E3A] focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <ScheduleBookingPicker value={schedule} onChange={setSchedule} />

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="Any specific concerns or additional requests?"
                  className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-[#0F1E3A] focus:outline-none focus:ring-2 focus:ring-[#0F1E3A]/20"
                />
              </div>

              <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Info className="h-5 w-5 shrink-0 text-blue-600" />
                <p className="text-sm text-blue-800">
                  We'll confirm your appointment via SMS or call within 24
                  hours.
                  <br />
                  📞 0998-151-6245 / 0995-230-0296
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || !schedule?.schedule_id}
                className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: "#0F1E3A" }}
              >
                {submitting ? "Submitting…" : "Submit Booking Request →"}
              </button>
            </form>
          )}
        </div>
      </main>
      <MyCarFooter />
    </div>
  );
}
