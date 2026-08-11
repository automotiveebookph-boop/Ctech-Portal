import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Car } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";
import {
  CUSTOMER_TYPE_LABEL,
  STATUS_STYLES,
  peso,
  type Customer,
  type ServiceRecord,
  type Vehicle,
} from "@/lib/fleet-utils";
import { formatPHPhone } from "@/lib/phone";
import { CustomerModal } from "@/components/CustomerModal";
import { VehicleQuickModal } from "@/components/VehicleQuickModal";
import { JobOrderModal } from "@/components/JobOrderModal";
import { BookAppointmentModal } from "@/components/BookAppointmentModal";
import { ServiceRecordModal } from "@/components/ServiceRecordModal";

export const Route = createFileRoute("/admin/walkin/customers/$customerId")({
  component: CustomerProfilePage,
});

const URGENCY: Record<Vehicle["service_status"], number> = {
  OVERDUE: 0,
  "DUE NOW": 1,
  "DUE SOON": 2,
  OK: 3,
};

type ServiceRow = ServiceRecord & { vehicles?: { plate_number: string; make: string; model: string } | null };

type ModalState =
  | { kind: "none" }
  | { kind: "editCustomer" }
  | { kind: "addVehicle" }
  | { kind: "editVehicle"; vehicle: Vehicle }
  | { kind: "jobOrder"; vehicleId?: string }
  | { kind: "appointment"; vehicleId?: string };

function CustomerProfilePage() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [history, setHistory] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [viewingRecord, setViewingRecord] = useState<ServiceRow | null>(null);

  async function load() {
    setLoading(true);
    const [cRes, vRes] = await Promise.all([
      supabaseFleet.from("customers").select("*").eq("id", customerId).maybeSingle(),
      supabaseFleet
        .from("vehicle_status_view")
        .select("*")
        .eq("customer_id", customerId)
        .neq("status", "archived"),
    ]);
    if (!cRes.data) {
      toast.error("Customer not found");
      navigate({ to: "/admin/walkin/customers" });
      return;
    }
    setCustomer(cRes.data as Customer);
    const vList = (vRes.data ?? []) as unknown as Vehicle[];
    setVehicles(vList);

    const vIds = vList.map((v) => v.id);
    if (vIds.length) {
      const { data } = await supabaseFleet
        .from("service_history")
        .select("*, vehicles (plate_number, make, model)")
        .in("vehicle_id", vIds)
        .order("service_date", { ascending: false });
      setHistory((data ?? []) as unknown as ServiceRow[]);
    } else {
      setHistory([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [customerId]);

  const nextService = useMemo(() => {
    if (vehicles.length === 0) return null;
    return [...vehicles].sort((a, b) => URGENCY[a.service_status] - URGENCY[b.service_status])[0];
  }, [vehicles]);

  const lastVisit = history[0]?.service_date ?? null;
  const isReturning = history.length > 0;
  const visibleHistory = showAllHistory ? history : history.slice(0, 5);

  if (loading || !customer) {
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
        <Link to="/admin/walkin/customers" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customers
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{customer.full_name}</h1>
              <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                {CUSTOMER_TYPE_LABEL[customer.customer_type]}
              </span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isReturning ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {isReturning ? "Returning Customer" : "New Customer"}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-500">{customer.phone ? formatPHPhone(customer.phone) : "No mobile on file"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal({ kind: "jobOrder" })}
              disabled={vehicles.length === 0}
              className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
            >
              Create Job Order
            </button>
            <button onClick={() => setModal({ kind: "addVehicle" })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Add Vehicle
            </button>
            <button onClick={() => setModal({ kind: "appointment" })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Book Appointment
            </button>
            <button onClick={() => setModal({ kind: "editCustomer" })} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Edit Customer
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Vehicles" value={String(vehicles.length)} />
          <SummaryCard label="Last Visit" value={lastVisit ? formatDate(lastVisit) : "—"} />
          <SummaryCard
            label="Next Service"
            value={nextService ? nextService.service_status : "—"}
            valueClass={nextService ? STATUS_STYLES[nextService.service_status].text : undefined}
          />
          <SummaryCard label="Outstanding Balance" value={peso(customer.outstanding_balance)} valueClass={customer.outstanding_balance > 0 ? "text-red-600" : undefined} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-6 lg:col-span-1">
            <h2 className="mb-4 font-bold" style={{ color: "#0F1E3A" }}>Customer Information</h2>
            <dl className="space-y-3 text-sm">
              <Field label="Full Name" value={customer.full_name} />
              <Field label="Customer Type" value={CUSTOMER_TYPE_LABEL[customer.customer_type]} />
              {customer.customer_type !== "private" && (
                <Field label="TIN" value={customer.tin || "—"} />
              )}
              <Field label="Mobile" value={customer.phone ? formatPHPhone(customer.phone) : "—"} />
              <Field label="Viber / WhatsApp" value={customer.viber_whatsapp ? "Yes, same number" : "—"} />
              <Field label="Messenger" value={customer.messenger_name || "—"} />
              <Field label="Email" value={customer.email ?? "—"} />
              <Field label="Location" value={[customer.barangay, customer.city].filter(Boolean).join(", ") || "—"} />
              <Field label="Preferred Contact Person" value={customer.preferred_contact_person || "—"} />
              <Field label="Notes" value={customer.notes || "—"} />
            </dl>
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-4 font-bold" style={{ color: "#0F1E3A" }}>Vehicles</h2>
            {vehicles.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                No vehicles yet. Add one to start tracking service history.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {vehicles.map((v) => (
                  <div key={v.id} className="rounded-xl border border-stone-200 bg-white p-5">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-stone-400" />
                        <div className="font-bold" style={{ color: "#0F1E3A" }}>{v.plate_number || "No Plate on File"}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[v.service_status].bg} ${STATUS_STYLES[v.service_status].text} ${STATUS_STYLES[v.service_status].border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[v.service_status].dot}`} />
                        {v.service_status}
                      </span>
                    </div>
                    <div className="text-sm text-stone-600">{v.year} {v.make} {v.model}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-stone-500">
                      <div>Transmission: <span className="font-semibold text-stone-700">{v.transmission_type ?? "—"}</span></div>
                      <div>Mileage: <span className="font-semibold text-stone-700">{v.current_km.toLocaleString()} km</span></div>
                      <div>Last Service: <span className="font-semibold text-stone-700">{v.last_service_date ? formatDate(v.last_service_date) : "—"}</span></div>
                      <div>Next Service: <span className="font-semibold text-stone-700">{v.next_service_km.toLocaleString()} km</span></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to="/admin/walkin/vehicles/$vehicleId"
                        params={{ vehicleId: v.id }}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                      >
                        View Vehicle
                      </Link>
                      <button
                        onClick={() => setModal({ kind: "jobOrder", vehicleId: v.id })}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold"
                        style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                      >
                        Create Job Order
                      </button>
                      <button
                        onClick={() => setModal({ kind: "editVehicle", vehicle: v })}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                      >
                        Edit Vehicle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold" style={{ color: "#0F1E3A" }}>
              {showAllHistory ? "Full Service History" : "Recent Service History"}
            </h2>
            {history.length > 5 && (
              <button onClick={() => setShowAllHistory((s) => !s)} className="text-xs font-semibold hover:underline" style={{ color: "#0F1E3A" }}>
                {showAllHistory ? "Show latest 5" : "View All Service History →"}
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Date</th>
                    <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                    <th className="px-4 py-3 text-left font-bold">Mileage</th>
                    <th className="px-4 py-3 text-left font-bold">Service Performed</th>
                    <th className="px-4 py-3 text-left font-bold">Amount</th>
                    <th className="px-4 py-3 text-left font-bold">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleHistory.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No service records yet.</td></tr>
                  ) : (
                    visibleHistory.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setViewingRecord(r)}
                        className="cursor-pointer transition hover:bg-stone-50"
                      >
                        <td className="px-4 py-3 text-xs text-stone-500">{formatDate(r.service_date)}</td>
                        <td className="px-4 py-3 font-semibold">{r.vehicles?.plate_number ?? "—"}</td>
                        <td className="px-4 py-3">{r.odometer_km.toLocaleString()} km</td>
                        <td className="px-4 py-3">{r.service_performed}</td>
                        <td className="px-4 py-3 font-semibold">{peso(r.total_cost ?? 0)}</td>
                        <td className="px-4 py-3 text-xs text-stone-500">{r.recommendation || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {viewingRecord && (
        <ServiceRecordModal
          record={viewingRecord}
          vehicleLabel={
            viewingRecord.vehicles
              ? `${viewingRecord.vehicles.plate_number || "No Plate"} — ${viewingRecord.vehicles.make} ${viewingRecord.vehicles.model}`
              : undefined
          }
          onClose={() => setViewingRecord(null)}
        />
      )}
      {modal.kind === "editCustomer" && (
        <CustomerModal initial={customer} onClose={() => setModal({ kind: "none" })} onSaved={() => { setModal({ kind: "none" }); load(); }} />
      )}
      {modal.kind === "addVehicle" && (
        <VehicleQuickModal customerId={customer.id} customerName={customer.full_name} onClose={() => setModal({ kind: "none" })} onSaved={() => { setModal({ kind: "none" }); load(); }} />
      )}
      {modal.kind === "editVehicle" && (
        <VehicleQuickModal customerId={customer.id} customerName={customer.full_name} initial={modal.vehicle} onClose={() => setModal({ kind: "none" })} onSaved={() => { setModal({ kind: "none" }); load(); }} />
      )}
      {modal.kind === "jobOrder" && (
        <JobOrderModal
          vehicles={vehicles.map((v) => ({ id: v.id, plate_number: v.plate_number || "No Plate", make: v.make, model: v.model, current_km: v.current_km }))}
          initialVehicleId={modal.vehicleId}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); load(); }}
        />
      )}
      {modal.kind === "appointment" && (
        <BookAppointmentModal
          customerId={customer.id}
          vehicles={vehicles.map((v) => ({ id: v.id, plate_number: v.plate_number || "No Plate", make: v.make, model: v.model }))}
          initialVehicleId={modal.vehicleId}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); load(); }}
        />
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
