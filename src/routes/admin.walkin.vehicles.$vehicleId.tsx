import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";
import {
  CUSTOMER_TYPE_LABEL,
  RECOMMENDATION_STYLES,
  STATUS_STYLES,
  peso,
  type Customer,
  type ServiceRecord,
  type Vehicle,
} from "@/lib/fleet-utils";
import { formatPHPhone } from "@/lib/phone";
import { VehicleQuickModal } from "@/components/VehicleQuickModal";
import { JobOrderModal } from "@/components/JobOrderModal";
import { ServiceRecordModal } from "@/components/ServiceRecordModal";

export const Route = createFileRoute("/admin/walkin/vehicles/$vehicleId")({
  component: VehicleProfilePage,
});

type ModalState = { kind: "none" } | { kind: "edit" } | { kind: "jobOrder" } | { kind: "mileage" };

function VehicleProfilePage() {
  const { vehicleId } = Route.useParams();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [mileageInput, setMileageInput] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<ServiceRecord | null>(null);

  async function load() {
    setLoading(true);
    const vRes = await supabaseFleet.from("vehicle_status_view").select("*").eq("id", vehicleId).maybeSingle();
    if (!vRes.data) {
      toast.error("Vehicle not found");
      navigate({ to: "/admin/walkin/vehicles" });
      return;
    }
    const v = vRes.data as unknown as Vehicle;
    setVehicle(v);
    setMileageInput(String(v.current_km));

    if (v.customer_id) {
      const { data } = await supabaseFleet.from("customers").select("*").eq("id", v.customer_id).maybeSingle();
      setCustomer(data as Customer | null);
    }

    const { data: hist } = await supabaseFleet
      .from("service_history")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false });
    setHistory((hist ?? []) as ServiceRecord[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [vehicleId]);

  const pendingConcern = useMemo(
    () => history.find((r) => r.recommendation && r.recommendation_priority && r.recommendation_priority !== "Good") ?? null,
    [history],
  );

  async function saveMileage() {
    if (!vehicle) return;
    const km = Number(mileageInput);
    if (!Number.isFinite(km) || km < vehicle.current_km) {
      toast.error(`Mileage must be a number ≥ current ${vehicle.current_km.toLocaleString()} km`);
      return;
    }
    setSavingMileage(true);
    const { error } = await supabaseFleet.from("vehicles").update({ current_km: km }).eq("id", vehicle.id);
    setSavingMileage(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mileage updated");
    setModal({ kind: "none" });
    load();
  }

  if (loading || !vehicle) {
    return (
      <main className="p-4 md:p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-stone-100" />
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <Link to="/admin/walkin/vehicles" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Vehicles
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{vehicle.plate_number || "No Plate on File"}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.current_km.toLocaleString()} km
            </p>
            {customer && (
              <Link
                to="/admin/walkin/customers/$customerId"
                params={{ customerId: customer.id }}
                className="mt-1 inline-block text-sm font-semibold hover:underline"
                style={{ color: "#0F1E3A" }}
              >
                {customer.full_name} →
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal({ kind: "jobOrder" })}
              className="rounded-lg px-4 py-2 text-sm font-bold"
              style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
            >
              Create Job Order
            </button>
            <button onClick={() => setModal({ kind: "mileage" })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Update Mileage
            </button>
            <button onClick={() => setModal({ kind: "edit" })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Edit Vehicle
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Current Mileage" value={`${vehicle.current_km.toLocaleString()} km`} />
          <SummaryCard label="Last Service" value={vehicle.last_service_date ? formatDate(vehicle.last_service_date) : "—"} />
          <SummaryCard
            label="Next Recommended Service"
            value={vehicle.service_status}
            valueClass={STATUS_STYLES[vehicle.service_status].text}
          />
          <SummaryCard
            label="Pending Concern"
            value={pendingConcern ? pendingConcern.recommendation_priority! : "Good"}
            valueClass={pendingConcern ? RECOMMENDATION_STYLES[pendingConcern.recommendation_priority!].text : RECOMMENDATION_STYLES.Good.text}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-6 lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold" style={{ color: "#0F1E3A" }}>Customer Information</h2>
              {customer && (
                <Link
                  to="/admin/walkin/customers/$customerId"
                  params={{ customerId: customer.id }}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#0F1E3A" }}
                >
                  Full Profile →
                </Link>
              )}
            </div>
            {customer ? (
              <dl className="space-y-3 text-sm">
                <Field label="Full Name" value={customer.full_name} />
                <Field label="Customer Type" value={CUSTOMER_TYPE_LABEL[customer.customer_type]} />
                <Field label="Mobile" value={customer.phone ? formatPHPhone(customer.phone) : "—"} />
                <Field label="Viber / WhatsApp" value={customer.viber_whatsapp ? "Yes, same number" : "—"} />
                <Field label="Email" value={customer.email ?? "—"} />
                <Field label="Location" value={[customer.barangay, customer.city].filter(Boolean).join(", ") || "—"} />
                <Field label="Outstanding Balance" value={peso(customer.outstanding_balance)} />
              </dl>
            ) : (
              <p className="text-sm text-stone-500">No customer linked to this vehicle.</p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-6 lg:col-span-1">
            <h2 className="mb-4 font-bold" style={{ color: "#0F1E3A" }}>Vehicle Information</h2>
            <dl className="space-y-3 text-sm">
              <Field label="Plate Number" value={vehicle.plate_number || "—"} />
              <Field label="VIN / Chassis No." value={vehicle.vin_number ?? "—"} />
              <Field label="Engine Number" value={vehicle.engine_number ?? "—"} />
              <Field label="Brand / Model / Variant" value={`${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`} />
              <Field label="Year" value={String(vehicle.year)} />
              <Field label="Transmission" value={vehicle.transmission_type ?? "—"} />
              <Field label="Fuel Type" value={vehicle.engine_type ?? "—"} />
              <Field label="Color" value={vehicle.color ?? "—"} />
              <Field label="Engine Code" value={vehicle.engine_code ?? "—"} />
              <Field label="Oil Capacity / Type" value={`${vehicle.oil_liters}L · ${vehicle.oil_type}`} />
              <Field label="Tire Size" value={vehicle.tire_size ?? "—"} />
              <Field label="Bolt Pattern" value={vehicle.bolt_pattern ?? "—"} />
              <Field label="Current Mileage" value={`${vehicle.current_km.toLocaleString()} km`} />
              <Field label="Avg. Monthly Mileage" value={vehicle.avg_km_per_month ? `${vehicle.avg_km_per_month.toLocaleString()} km/mo` : "—"} />
            </dl>
          </div>

          <div className="lg:col-span-1">
            <h2 className="mb-4 font-bold" style={{ color: "#0F1E3A" }}>Pending Recommendation</h2>
            {pendingConcern ? (
              <div className={`rounded-xl border p-5 ${RECOMMENDATION_STYLES[pendingConcern.recommendation_priority!].border} ${RECOMMENDATION_STYLES[pendingConcern.recommendation_priority!].bg}`}>
                <div className={`font-bold ${RECOMMENDATION_STYLES[pendingConcern.recommendation_priority!].text}`}>
                  {pendingConcern.recommendation}
                </div>
                <div className="mt-2 space-y-1 text-sm text-stone-600">
                  <div>Recommended during service on {formatDate(pendingConcern.service_date)}</div>
                  <div>Priority: <span className="font-semibold">{pendingConcern.recommendation_priority}</span></div>
                  {pendingConcern.recommendation_due_km != null && (
                    <div>Recommended return: within {pendingConcern.recommendation_due_km.toLocaleString()} km</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                No pending concerns — vehicle is in good condition.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-bold" style={{ color: "#0F1E3A" }}>Service History</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Date</th>
                    <th className="px-4 py-3 text-left font-bold">Mileage</th>
                    <th className="px-4 py-3 text-left font-bold">Service Performed</th>
                    <th className="px-4 py-3 text-left font-bold">Parts / Fluids</th>
                    <th className="px-4 py-3 text-left font-bold">Amount</th>
                    <th className="px-4 py-3 text-left font-bold">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No service records yet.</td></tr>
                  ) : (
                    history.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setViewingRecord(r)}
                        className="cursor-pointer transition hover:bg-stone-50"
                      >
                        <td className="px-4 py-3 text-xs text-stone-500">{formatDate(r.service_date)}</td>
                        <td className="px-4 py-3">{r.odometer_km.toLocaleString()} km</td>
                        <td className="px-4 py-3">{r.service_performed}</td>
                        <td className="px-4 py-3 text-xs text-stone-500">{r.notes || "—"}</td>
                        <td className="px-4 py-3 font-semibold">{peso(r.total_cost ?? 0)}</td>
                        <td className="px-4 py-3 text-xs text-stone-500">
                          {r.recommendation ? (
                            <span className={RECOMMENDATION_STYLES[r.recommendation_priority ?? "Good"].text}>
                              {r.recommendation}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {modal.kind === "edit" && vehicle.customer_id && (
        <VehicleQuickModal
          customerId={vehicle.customer_id}
          customerName={customer?.full_name}
          initial={vehicle}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); load(); }}
        />
      )}
      {modal.kind === "jobOrder" && (
        <JobOrderModal
          vehicles={[{ id: vehicle.id, plate_number: vehicle.plate_number || "No Plate", make: vehicle.make, model: vehicle.model, current_km: vehicle.current_km }]}
          initialVehicleId={vehicle.id}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); load(); }}
        />
      )}
      {viewingRecord && (
        <ServiceRecordModal
          record={viewingRecord}
          vehicleLabel={`${vehicle.plate_number || "No Plate"} — ${vehicle.make} ${vehicle.model}`}
          onClose={() => setViewingRecord(null)}
        />
      )}
      {modal.kind === "mileage" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-lg font-bold" style={{ color: "#0F1E3A" }}>Update Mileage</h2>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Current Mileage (km)</label>
            <input
              type="number"
              autoFocus
              value={mileageInput}
              onChange={(e) => setMileageInput(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setModal({ kind: "none" })} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
              <button
                onClick={saveMileage}
                disabled={savingMileage}
                className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
              >
                {savingMileage ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${valueClass ?? ""}`} style={valueClass ? undefined : { color: "#0F1E3A" }}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</dt>
      <dd className="mt-0.5 text-stone-700">{value}</dd>
    </div>
  );
}
