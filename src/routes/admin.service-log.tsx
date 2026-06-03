import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar as CalendarIcon,
  CreditCard,
  History,
  Info,
  Plus,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/service-log")({
  component: ServiceLogPage,
});

type Client = { id: string; client_code: string; company_name: string };
type VehicleRow = {
  id: string;
  unit_id: string;
  plate_number: string;
  make: string;
  model: string;
  current_km: number;
  client_id: string;
};
type ServiceRow = {
  id: string;
  vehicle_id: string | null;
  service_date: string;
  job_order_number: string | null;
  odometer_km: number;
  service_performed: string;
  parts_cost: number | null;
  labor_cost: number | null;
  total_cost: number | null;
  technician: string | null;
  notes: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function dayOfWeek(d: string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "long" });
}

function ServiceLogPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(today());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) return;
      const { data: role } = await supabaseFleet
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (role?.role === "admin") setAuthorized(true);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const [sRes, vRes, cRes] = await Promise.all([
      supabaseFleet
        .from("service_history")
        .select("*")
        .order("service_date", { ascending: false }),
      supabaseFleet
        .from("vehicles")
        .select("id, unit_id, plate_number, make, model, current_km, client_id"),
      supabaseFleet
        .from("fleet_clients")
        .select("id, client_code, company_name")
        .order("company_name"),
    ]);
    setServices((sRes.data ?? []) as ServiceRow[]);
    setVehicles((vRes.data ?? []) as VehicleRow[]);
    setClients((cRes.data ?? []) as Client[]);
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );
  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let monthCount = 0;
    let totalRev = 0;
    let costCount = 0;
    let costSum = 0;
    for (const s of services) {
      const d = new Date(s.service_date);
      if (d.getFullYear() === y && d.getMonth() === m) monthCount++;
      const c = s.total_cost ?? 0;
      totalRev += c;
      if (c > 0) {
        costSum += c;
        costCount++;
      }
    }
    return {
      total: services.length,
      monthCount,
      totalRev,
      avg: costCount ? Math.round(costSum / costCount) : 0,
    };
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services.filter((s) => {
      const v = s.vehicle_id ? vehicleById.get(s.vehicle_id) : undefined;
      if (clientFilter !== "All" && v?.client_id !== clientFilter) return false;
      if (vehicleFilter !== "All" && s.vehicle_id !== vehicleFilter) return false;
      if (fromDate && s.service_date < fromDate) return false;
      if (toDate && s.service_date > toDate) return false;
      if (!q) return true;
      return (
        (s.service_performed ?? "").toLowerCase().includes(q) ||
        (s.job_order_number ?? "").toLowerCase().includes(q) ||
        (s.technician ?? "").toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [services, vehicleById, search, clientFilter, vehicleFilter, fromDate, toDate]);

  const vehiclesForFilter = useMemo(() => {
    if (clientFilter === "All") return vehicles;
    return vehicles.filter((v) => v.client_id === clientFilter);
  }, [vehicles, clientFilter]);

  function resetFilters() {
    setSearch("");
    setClientFilter("All");
    setVehicleFilter("All");
    setFromDate(startOfYear());
    setToDate(today());
  }

  if (!authorized) {
    return (
      <div className="p-4 md:p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "#C9A227" }}
          >
            C-Tech Staff View
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
            Service Log
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {services.length} services logged · {peso(stats.totalRev)} all-time revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg p-2.5 hover:bg-stone-100" aria-label="Notifications">
            <Bell className="h-5 w-5 text-stone-600" />
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            <Plus className="h-4 w-4" />
            Log New Service
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<History className="h-5 w-5" style={{ color: "#0F1E3A" }} />}
            iconBg="rgba(15,30,58,0.15)"
            value={stats.total.toString()}
            label="Total Services Logged"
            sub="All-time"
          />
          <StatCard
            icon={<CalendarIcon className="h-5 w-5" style={{ color: "#C9A227" }} />}
            iconBg="rgba(201,162,39,0.20)"
            value={stats.monthCount.toString()}
            label="This Month"
            sub={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          />
          <StatCard
            icon={<CreditCard className="h-5 w-5 text-emerald-700" />}
            iconBg="rgba(16,185,129,0.15)"
            value={peso(stats.totalRev)}
            label="Total Revenue"
            sub="All-time"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-amber-700" />}
            iconBg="rgba(245,158,11,0.15)"
            value={peso(stats.avg)}
            label="Avg Service Value"
            sub="Excluding ₱0 records"
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service, JO#, tech, notes…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setVehicleFilter("All");
            }}
            className={selectCls}
          >
            <option value="All">All Fleets</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className={selectCls}
          >
            <option value="All">All Vehicles</option>
            {vehiclesForFilter.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} — {v.make} {v.model}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            From:
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={selectCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            To:
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={selectCls}
            />
          </label>
          <button onClick={resetFilters} className="text-sm text-stone-600 underline">
            Reset
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3 text-left font-bold">Date</th>
                <th className="px-6 py-3 text-left font-bold">Vehicle</th>
                <th className="px-6 py-3 text-left font-bold">Fleet Client</th>
                <th className="px-6 py-3 text-left font-bold">Service Performed</th>
                <th className="px-6 py-3 text-left font-bold">JO# / Tech</th>
                <th className="px-6 py-3 text-right font-bold">Cost</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-500">No service records match these filters</td></tr>
              ) : (
                filtered.map((s) => {
                  const v = s.vehicle_id ? vehicleById.get(s.vehicle_id) : undefined;
                  const client = v ? clientById.get(v.client_id) : undefined;
                  return (
                    <tr key={s.id} className="transition hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                          {fmtDate(s.service_date)}
                        </div>
                        <div className="text-xs text-stone-500">{dayOfWeek(s.service_date)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                          {v?.plate_number ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">
                          {v ? `${v.make} ${v.model}` : ""} · {s.odometer_km.toLocaleString()} km
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium" style={{ color: "#0F1E3A" }}>
                          {client?.company_name ?? "—"}
                        </div>
                        <div className="font-mono text-xs text-stone-500">{client?.client_code ?? ""}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="line-clamp-2 text-sm text-stone-900">
                          {s.service_performed}
                        </div>
                        {s.notes ? (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-stone-500">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: "#C9A227" }}
                            />
                            Has notes
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-stone-700">
                          {s.job_order_number ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">{s.technician ?? "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold" style={{ color: "#0F1E3A" }}>
                          {peso(s.total_cost ?? 0)}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          P:{peso(s.parts_cost ?? 0)} / L:{peso(s.labor_cost ?? 0)}
                        </div>
                      </td>
                      <td className="space-x-3 px-6 py-4 text-right">
                        <button
                          onClick={() => { setEditing(s); setModalOpen(true); }}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: "#0F1E3A" }}
                        >Edit</button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      {modalOpen && (
        <ServiceFormModal
          initial={editing}
          clients={clients}
          vehicles={vehicles}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {deleting && (
        <DeleteServiceModal
          service={deleting}
          vehicle={deleting.vehicle_id ? vehicleById.get(deleting.vehicle_id) : undefined}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); }}
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900";
const selectCls = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

function StatCard({
  icon,
  iconBg,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="mb-1 text-3xl font-bold" style={{ color: "#0F1E3A" }}>
        {value}
      </div>
      <div className="text-sm font-medium text-stone-700">{label}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </div>
  );
}

type SFormState = {
  client_id: string;
  vehicle_id: string;
  service_date: string;
  job_order_number: string;
  odometer_km: number | "";
  technician: string;
  service_performed: string;
  parts_cost: number | "";
  labor_cost: number | "";
  notes: string;
};

function ServiceFormModal({
  initial,
  clients,
  vehicles,
  onClose,
  onSaved,
}: {
  initial: ServiceRow | null;
  clients: Client[];
  vehicles: VehicleRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initVehicle = initial?.vehicle_id
    ? vehicles.find((v) => v.id === initial.vehicle_id)
    : undefined;

  const [form, setForm] = useState<SFormState>({
    client_id: initVehicle?.client_id ?? "",
    vehicle_id: initial?.vehicle_id ?? "",
    service_date: initial?.service_date?.slice(0, 10) ?? today(),
    job_order_number: initial?.job_order_number ?? "",
    odometer_km: initial?.odometer_km ?? "",
    technician: initial?.technician ?? "",
    service_performed: initial?.service_performed ?? "",
    parts_cost: initial?.parts_cost ?? "",
    labor_cost: initial?.labor_cost ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof SFormState>(key: K, value: SFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const filteredVehicles = useMemo(
    () => (form.client_id ? vehicles.filter((v) => v.client_id === form.client_id) : []),
    [vehicles, form.client_id],
  );

  const totalCost =
    (Number(form.parts_cost) || 0) + (Number(form.labor_cost) || 0);

  function handleVehicleChange(id: string) {
    const v = vehicles.find((vh) => vh.id === id);
    setForm((f) => ({
      ...f,
      vehicle_id: id,
      odometer_km: v ? v.current_km : f.odometer_km,
    }));
  }

  async function handleSave() {
    if (
      !form.client_id ||
      !form.vehicle_id ||
      !form.service_date ||
      !form.job_order_number ||
      form.odometer_km === "" ||
      !form.technician ||
      !form.service_performed ||
      form.parts_cost === "" ||
      form.labor_cost === ""
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const parts = Number(form.parts_cost);
    const labor = Number(form.labor_cost);
    const odometer = Number(form.odometer_km);
    const payload = {
      vehicle_id: form.vehicle_id,
      client_id: form.client_id,
      service_date: form.service_date,
      job_order_number: form.job_order_number,
      odometer_km: odometer,
      technician: form.technician,
      service_performed: form.service_performed,
      parts_cost: parts,
      labor_cost: labor,
      notes: form.notes || null,
    };
    const res = initial
      ? await supabaseFleet.from("service_history").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("service_history").insert([payload]);
    if (res.error) {
      setSaving(false);
      toast.error(res.error.message);
      return;
    }
    // Auto-update vehicle's last service info + current km (odometer is "now")
    const vUpdate = await supabaseFleet
      .from("vehicles")
      .update({
        last_service_km: odometer,
        last_service_date: form.service_date,
        current_km: odometer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.vehicle_id);
    if (vUpdate.error) {
      setSaving(false);
      toast.error(`Service saved, but vehicle update failed: ${vUpdate.error.message}`);
      return;
    }
    setSaving(false);
    toast.success(initial ? "Service record updated" : "Service logged! Vehicle status updated.");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? "Edit Service Record" : "Log New Service"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
          <p className="text-sm text-blue-900">
            Logging this service will automatically update the vehicle's status and last service info.
          </p>
        </div>

        <SectionLabel>Vehicle Selection</SectionLabel>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Fleet Client" required>
            <select
              value={form.client_id}
              onChange={(e) => {
                update("client_id", e.target.value);
                update("vehicle_id", "");
              }}
              className={inputCls}
            >
              <option value="">— Select —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle" required>
            <select
              value={form.vehicle_id}
              onChange={(e) => handleVehicleChange(e.target.value)}
              disabled={!form.client_id}
              className={inputCls}
            >
              <option value="">— Select —</option>
              {filteredVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} - {v.make} {v.model} (Current: {v.current_km.toLocaleString()} km)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <SectionLabel>Service Details</SectionLabel>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Service Date" required>
            <input
              type="date"
              value={form.service_date}
              onChange={(e) => update("service_date", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Job Order Number" required hint="Format: JO-YYYY-XXX">
            <input
              type="text"
              value={form.job_order_number}
              onChange={(e) => update("job_order_number", e.target.value)}
              className={inputCls}
              placeholder="JO-2026-001"
            />
          </Field>
          <Field label="Odometer (KM)" required>
            <input
              type="number"
              value={form.odometer_km}
              onChange={(e) =>
                update("odometer_km", e.target.value === "" ? "" : Number(e.target.value))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Technician" required>
            <input
              type="text"
              value={form.technician}
              onChange={(e) => update("technician", e.target.value)}
              className={inputCls}
              placeholder="e.g., Tech 1, Mike"
            />
          </Field>
        </div>

        <SectionLabel>Service Performed</SectionLabel>
        <div className="mb-6">
          <Field label="Service Performed" required>
            <textarea
              rows={2}
              value={form.service_performed}
              onChange={(e) => update("service_performed", e.target.value)}
              className={inputCls}
              placeholder="e.g., 10,000 KM PMS - Oil/Filter, Air Filter, Coolant top-up"
            />
          </Field>
        </div>

        <SectionLabel>Costs</SectionLabel>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Parts Cost (₱)" required>
            <input
              type="number"
              value={form.parts_cost}
              onChange={(e) =>
                update("parts_cost", e.target.value === "" ? "" : Number(e.target.value))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Labor Cost (₱)" required>
            <input
              type="number"
              value={form.labor_cost}
              onChange={(e) =>
                update("labor_cost", e.target.value === "" ? "" : Number(e.target.value))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Total Cost (₱)" hint="Auto-calculated">
            <input
              type="number"
              value={totalCost}
              readOnly
              className={`${inputCls} bg-stone-50 font-bold`}
            />
          </Field>
        </div>

        <SectionLabel>Tech Notes</SectionLabel>
        <div className="mb-6">
          <Field label="Tech Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className={inputCls}
              placeholder="Observations, recommendations for next visit, parts to monitor…"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            {saving ? "Saving…" : "Save Service Log"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteServiceModal({
  service,
  vehicle,
  onClose,
  onDeleted,
}: {
  service: ServiceRow;
  vehicle: VehicleRow | undefined;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function handleDelete() {
    setBusy(true);
    const { error } = await supabaseFleet
      .from("service_history")
      .delete()
      .eq("id", service.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service record deleted");
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "#0F1E3A" }}>
            Delete Service Record?
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-700">
          This will permanently delete the service record for{" "}
          <span className="font-semibold">{vehicle?.plate_number ?? "this vehicle"}</span>{" "}
          on {fmtDate(service.service_date)} ({service.job_order_number ?? "no JO#"}).
        </p>
        <p className="mb-6 text-xs text-stone-500">
          The vehicle's last service info will NOT be auto-reverted. Edit the vehicle manually if needed.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3 text-xs font-bold uppercase tracking-wider"
      style={{ color: "#C9A227" }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-stone-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <div className="mt-1 text-[11px] text-stone-500">{hint}</div> : null}
    </div>
  );
}
