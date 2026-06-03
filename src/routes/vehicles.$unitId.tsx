import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";
import {
  ScheduleBookingPicker,
  type ScheduleSelection,
} from "@/components/ScheduleBookingPicker";
import {
  calculateEstimate,
  peso,
  STATUS_STYLES,
  type Pricing,
  type ServiceRecord,
  type Vehicle,
} from "@/lib/fleet-utils";

export const Route = createFileRoute("/vehicles/$unitId")({
  component: VehicleDetailPage,
});

type Client = {
  id: string;
  company_name: string;
  fleet_manager: string;
  tier: string;
  parts_discount: number;
  labor_discount: number;
};

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";

function VehicleDetailPage() {
  const { unitId } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [history, setHistory] = useState<ServiceRecord[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSelection | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabaseFleet.auth.getUser();
      if (!user) {
        navigate({ to: "/" });
        return;
      }
      const { data: roleData } = await supabaseFleet
        .from("user_roles")
        .select("role, client_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!roleData) {
        navigate({ to: "/" });
        return;
      }
      if (roleData.role !== "fleet_manager") {
        navigate({ to: "/admin" });
        return;
      }

      const [clientRes, vehicleRes, pricingRes, countRes] = await Promise.all([
        supabaseFleet
          .from("fleet_clients")
          .select("*")
          .eq("id", roleData.client_id)
          .maybeSingle(),
        supabaseFleet
          .from("vehicle_status_view")
          .select("*")
          .eq("client_id", roleData.client_id)
          .eq("unit_id", unitId)
          .maybeSingle(),
        supabaseFleet.from("pricing_reference").select("*"),
        supabaseFleet
          .from("vehicle_status_view")
          .select("id", { count: "exact", head: true })
          .eq("client_id", roleData.client_id),
      ]);

      setClient(clientRes.data as Client | null);
      const v = vehicleRes.data as Vehicle | null;
      setVehicle(v);
      setPricing((pricingRes.data ?? []) as Pricing[]);
      setVehicleCount(countRes.count ?? 0);

      if (v) {
        // Try by vehicle_id first; fallback to unit_id.
        let recs: ServiceRecord[] = [];
        const byId = await supabaseFleet
          .from("service_history")
          .select("*")
          .eq("vehicle_id", v.id)
          .order("service_date", { ascending: false });
        if (byId.data && byId.data.length) {
          recs = byId.data as ServiceRecord[];
        } else {
          const byUnit = await supabaseFleet
            .from("service_history")
            .select("*")
            .eq("unit_id", v.unit_id)
            .order("service_date", { ascending: false });
          recs = (byUnit.data ?? []) as ServiceRecord[];
        }
        setHistory(recs);
      }
      setLoading(false);
    })();
  }, [unitId, navigate]);

  const submitSchedule = async () => {
    if (!vehicle || !schedule?.schedule_id) {
      toast.error("Please pick a date and time block.");
      return;
    }
    setScheduleSaving(true);
    const { error: insertError } = await supabaseFleet
      .from("appointments")
      .insert([
        {
          vehicle_id: vehicle.id,
          schedule_id: schedule.schedule_id,
          preferred_date: schedule.date,
          preferred_time: schedule.time_block,
          service_type: "Fleet PMS Request",
          notes: scheduleNotes || null,
          status: "pending",
        },
      ]);
    setScheduleSaving(false);
    if (insertError) {
      console.error("Schedule insert error", insertError);
      toast.error(`Could not submit: ${insertError.message}`);
      return;
    }
    toast.success("Service request submitted! We'll contact you to confirm.");
    setScheduleOpen(false);
    setScheduleNotes("");
    setSchedule(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <FleetSidebar client={null} vehicleCount={0} />
        <div className="p-4 pt-16 md:ml-64 md:p-8 md:pt-8">
          <div className="h-32 animate-pulse rounded-xl bg-white" />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-96 animate-pulse rounded-xl bg-white lg:col-span-2" />
            <div className="h-96 animate-pulse rounded-xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-stone-50">
        <FleetSidebar client={null} vehicleCount={0} />
        <div className="p-8 pt-16 text-center md:ml-64 md:p-16 md:pt-16">
          <p className="text-stone-500">Vehicle not found.</p>
          <Link
            to="/vehicles"
            className="mt-3 inline-block text-sm font-semibold hover:underline"
            style={{ color: NAVY }}
          >
            ← Back to vehicles
          </Link>
        </div>
      </div>
    );
  }

  const styles = STATUS_STYLES[vehicle.service_status];
  const interval = vehicle.pms_interval_km ?? 0;
  const last = vehicle.last_service_km ?? 0;
  const progressRaw = interval
    ? ((vehicle.current_km - last) / interval) * 100
    : 0;
  const progress = Math.min(100, Math.max(0, progressRaw));
  const barClass =
    progressRaw >= 100
      ? "bg-gradient-to-r from-red-600 to-red-700"
      : progressRaw >= 90
        ? "bg-gradient-to-r from-amber-600 to-amber-700"
        : progressRaw >= 70
          ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
          : "bg-gradient-to-r from-emerald-600 to-emerald-700";

  const km = vehicle.km_to_next_service;
  const nextColor =
    km < 0 ? "text-red-600" : km <= 500 ? "text-amber-600" : "text-emerald-600";

  const estimate =
    vehicle.service_status === "OK"
      ? 0
      : calculateEstimate(vehicle, client?.parts_discount ?? 0, pricing);

  const engineLabel = vehicle.engine_type ?? vehicle.engine ?? "—";
  const subtitle = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.vehicle_type,
    engineLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-stone-50">
      <FleetSidebar
        client={
          client
            ? {
                company_name: client.company_name,
                fleet_manager: client.fleet_manager,
                tier: client.tier,
              }
            : null
        }
        vehicleCount={vehicleCount}
      />

      <div className="md:ml-64">
        {/* Top bar */}
        <header className="border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
          <Link
            to="/vehicles"
            className="mb-3 flex w-fit items-center gap-1 text-sm text-stone-500 transition hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to vehicles
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold md:text-3xl" style={{ color: NAVY }}>
                  {vehicle.plate_number}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-bold ${styles.text} ${styles.bg} ${styles.border}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                  {vehicle.service_status}
                </span>
              </div>
              <p className="text-sm text-stone-600 md:text-base">{subtitle}</p>
            </div>
            {vehicle.service_status !== "OK" && (
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white shadow md:w-auto"
                style={{ backgroundColor: NAVY }}
              >
                <Calendar className="h-4 w-4" />
                Schedule Service
              </button>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6 p-4 md:p-8 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="space-y-6 lg:col-span-2">
            {/* Card 1 — Service Progress */}
            <section className="rounded-xl border border-stone-200 bg-white p-4 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold" style={{ color: NAVY }}>
                  Service Progress
                </h2>
                <span className="text-xs text-stone-500">
                  {interval.toLocaleString()} km service interval
                </span>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-stone-500">Last Service</div>
                  <div className="text-2xl font-bold" style={{ color: NAVY }}>
                    {last.toLocaleString()}
                  </div>
                  <div className="text-xs text-stone-500">
                    km{vehicle.last_service_date ? ` · ${vehicle.last_service_date}` : ""}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-stone-500">Current Reading</div>
                  <div className="text-2xl font-bold" style={{ color: NAVY }}>
                    {vehicle.current_km.toLocaleString()}
                  </div>
                  <div className="text-xs text-stone-500">
                    km
                    {vehicle.avg_km_per_month
                      ? ` · ~${vehicle.avg_km_per_month.toLocaleString()} km/mo avg`
                      : ""}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-stone-500">Next Service</div>
                  <div className="text-2xl font-bold" style={{ color: NAVY }}>
                    {vehicle.next_service_km.toLocaleString()}
                  </div>
                  <div className={`text-xs font-semibold ${nextColor}`}>
                    {km > 0
                      ? `${km.toLocaleString()} km away`
                      : `${Math.abs(km).toLocaleString()} km overdue`}
                  </div>
                </div>
              </div>

              <div className="relative h-3 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full ${barClass}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-stone-500">
                <span>0 km</span>
                <span className="font-semibold">
                  {Math.round(progressRaw)}% to next PMS
                </span>
                <span>{interval.toLocaleString()} km</span>
              </div>
            </section>

            {/* Card 2 — Service History */}
            <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-6 py-4">
                <h2 className="font-bold" style={{ color: NAVY }}>
                  Service History
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {history.length} service{history.length === 1 ? "" : "s"} on record
                </p>
              </div>
              {history.length === 0 ? (
                <p className="p-12 text-center text-sm text-stone-500">
                  No service records yet.
                </p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {history.map((r) => {
                    const parts = r.parts_cost ?? 0;
                    const labor = r.labor_cost ?? 0;
                    const total = r.total_cost ?? parts + labor;
                    return (
                      <div key={r.id} className="px-6 py-5">
                        <div className="mb-2 flex items-start justify-between gap-4">
                          <div>
                            <div
                              className="text-sm font-semibold"
                              style={{ color: NAVY }}
                            >
                              {r.service_performed}
                            </div>
                            <div className="mt-0.5 text-xs text-stone-500">
                              {[
                                r.service_date,
                                r.job_order_number,
                                `${r.odometer_km.toLocaleString()} km`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className="text-sm font-bold"
                              style={{ color: NAVY }}
                            >
                              {peso(total)}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              Parts {peso(parts)} · Labor {peso(labor)}
                            </div>
                          </div>
                        </div>
                        {r.notes && (
                          <div
                            className="mt-2 rounded-md border-l-2 bg-stone-50 px-3 py-2 text-xs text-stone-600"
                            style={{ borderLeftColor: GOLD }}
                          >
                            <span className="font-semibold">Tech notes: </span>
                            {r.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 lg:col-span-1">
            {/* Card A — Specs */}
            <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-6 py-4">
                <h2 className="font-bold" style={{ color: NAVY }}>
                  Vehicle Specs
                </h2>
              </div>
              <dl className="space-y-3 p-6 text-sm">
                {(
                  [
                    ["Unit ID", vehicle.unit_id],
                    ["Plate #", vehicle.plate_number],
                    ["Make", vehicle.make],
                    ["Model", vehicle.model],
                    ["Year", String(vehicle.year)],
                    ["Type", vehicle.vehicle_type ?? "—"],
                    ["Engine", engineLabel],
                    ["Oil Type", vehicle.oil_type],
                    ["Oil Capacity", `${vehicle.oil_liters}L`],
                    [
                      "PMS Interval",
                      `${(vehicle.pms_interval_km ?? 0).toLocaleString()} km`,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1"
                  >
                    <dt className="text-stone-500">{label}</dt>
                    <dd className="font-semibold" style={{ color: NAVY }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Card B — Estimate */}
            {vehicle.service_status !== "OK" && (
              <section
                className="rounded-xl p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, #1E3464)`,
                }}
              >
                <div className="mb-2 text-xs uppercase tracking-wider opacity-70">
                  Next Service Estimate
                </div>
                <div className="mb-1 text-4xl font-bold">{peso(estimate)}</div>
                <div className="mb-4 text-xs opacity-70">
                  Standard PMS · Tier {client?.tier ?? "—"} discount applied
                </div>
                <div className="mb-5 border-b border-white/20 pb-5" />
                <div className="mb-5 space-y-2 text-sm opacity-90">
                  <div className="flex justify-between">
                    <span>Engine oil + filter ({vehicle.oil_liters}L)</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multi-point inspection</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service report</span>
                    <span>Included</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  Schedule Service →
                </button>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Schedule modal */}
      {scheduleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setScheduleOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: NAVY }}>
                Schedule Service Request
              </h3>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="rounded-md p-1 hover:bg-stone-100"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-stone-500" />
              </button>
            </div>
            <p className="mb-6 text-sm text-stone-600">
              for {vehicle.plate_number} — {vehicle.make} {vehicle.model}
            </p>
            <div className="space-y-4">
              <ScheduleBookingPicker value={schedule} onChange={setSchedule} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="flex-1 rounded-lg border border-stone-300 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSchedule}
                disabled={scheduleSaving || !schedule?.schedule_id}
                className="flex-1 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: NAVY }}
              >
                {scheduleSaving ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
