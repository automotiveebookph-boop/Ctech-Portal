import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { STATUS_STYLES, type Vehicle } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/vehicles")({
  component: VehiclesPage,
});

type Client = {
  id: string;
  client_code: string;
  company_name: string;
};

const OIL_TYPES = [
  "Semi-Synth",
  "Fully Synth",
  "Fully Synth 5W30",
  "Fully Synth 0W20",
  "Mineral",
];
const VEHICLE_TYPES = ["Pickup", "Sedan", "Van", "SUV", "Truck", "Motorcycle", "Other"];
const ENGINE_TYPES = ["Gas", "Diesel", "Hybrid", "Electric"];
const STATUSES = ["OVERDUE", "DUE NOW", "DUE SOON", "OK"];

type FormState = {
  unit_id: string;
  plate_number: string;
  client_id: string;
  make: string;
  model: string;
  year: number;
  vehicle_type: string;
  engine_type: string;
  oil_type: string;
  oil_liters: number;
  pms_interval_km: number;
  avg_km_per_month: number | "";
  current_km: number;
  last_service_km: number;
  last_service_date: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: FormState = {
  unit_id: "",
  plate_number: "",
  client_id: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  vehicle_type: "Pickup",
  engine_type: "Diesel",
  oil_type: "Fully Synth",
  oil_liters: 4,
  pms_interval_km: 5000,
  avg_km_per_month: "",
  current_km: 0,
  last_service_km: 0,
  last_service_date: today(),
  notes: "",
};

function VehiclesPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [engineFilter, setEngineFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

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
    const [vRes, cRes, sRes] = await Promise.all([
      supabaseFleet.from("vehicle_status_view").select("*"),
      supabaseFleet.from("fleet_clients").select("id, client_code, company_name").order("company_name"),
      supabaseFleet.from("service_history").select("vehicle_id"),
    ]);
    setVehicles((vRes.data ?? []) as Vehicle[]);
    setClients((cRes.data ?? []) as Client[]);
    const counts: Record<string, number> = {};
    for (const s of (sRes.data ?? []) as { vehicle_id: string | null }[]) {
      if (s.vehicle_id) counts[s.vehicle_id] = (counts[s.vehicle_id] ?? 0) + 1;
    }
    setServiceCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles.filter((v) => {
      if (clientFilter !== "All" && v.client_id !== clientFilter) return false;
      if (typeFilter !== "All" && v.vehicle_type !== typeFilter) return false;
      if (engineFilter !== "All" && v.engine_type !== engineFilter) return false;
      if (statusFilter !== "All" && v.service_status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.plate_number.toLowerCase().includes(q) ||
        v.unit_id.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, clientFilter, typeFilter, engineFilter, statusFilter]);

  function resetFilters() {
    setSearch("");
    setClientFilter("All");
    setTypeFilter("All");
    setEngineFilter("All");
    setStatusFilter("All");
  }

  const fleetCount = new Set(vehicles.map((v) => v.client_id)).size;

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
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>
            C-Tech Staff View
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
            Vehicles
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {vehicles.length} vehicles across {fleetCount} fleet{fleetCount === 1 ? "" : "s"}
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
            Add Vehicle
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate, unit ID, make, model…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectCls}>
            <option value="All">All Fleets</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="All">All Types</option>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={engineFilter} onChange={(e) => setEngineFilter(e.target.value)} className={selectCls}>
            <option value="All">All Engines</option>
            {ENGINE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={resetFilters} className="text-sm text-stone-600 underline">
            Reset
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3 text-left font-bold">Unit</th>
                <th className="px-6 py-3 text-left font-bold">Vehicle</th>
                <th className="px-6 py-3 text-left font-bold">Fleet Client</th>
                <th className="px-6 py-3 text-left font-bold">Current KM</th>
                <th className="px-6 py-3 text-left font-bold">Last Service</th>
                <th className="px-6 py-3 text-left font-bold">Status</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-stone-500">No vehicles match these filters</td></tr>
              ) : (
                filtered.map((v) => {
                  const client = clientById.get(v.client_id);
                  const interval = v.pms_interval_km ?? 5000;
                  const last = v.last_service_km ?? 0;
                  const pct = Math.min(100, Math.max(0, ((v.current_km - last) / interval) * 100));
                  const barColor =
                    pct >= 100 ? "bg-red-500" :
                    pct >= 90 ? "bg-amber-500" :
                    pct >= 70 ? "bg-yellow-400" : "bg-emerald-500";
                  const s = STATUS_STYLES[v.service_status];
                  return (
                    <tr key={v.id} className="transition hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold" style={{ color: "#0F1E3A" }}>{v.unit_id}</div>
                        <div className="font-mono text-xs text-stone-500">{v.plate_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-stone-900">{v.make} {v.model}</div>
                        <div className="text-xs text-stone-500">
                          {v.year} · {v.vehicle_type ?? "—"} · {v.engine_type ?? "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium" style={{ color: "#0F1E3A" }}>
                          {client?.company_name ?? "—"}
                        </div>
                        <div className="font-mono text-xs text-stone-500">{client?.client_code ?? ""}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{v.current_km.toLocaleString()}</div>
                        <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-stone-100">
                          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-stone-700">
                          {v.last_service_date
                            ? new Date(v.last_service_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </div>
                        <div className="text-xs text-stone-500">{(v.last_service_km ?? 0).toLocaleString()} km</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text} ${s.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {v.service_status}
                        </span>
                      </td>
                      <td className="space-x-3 px-6 py-4 text-right">
                        <button
                          onClick={() => { setEditing(v); setModalOpen(true); }}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: "#0F1E3A" }}
                        >Edit</button>
                        <button
                          onClick={() => setDeleting(v)}
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
        <VehicleFormModal
          initial={editing}
          clients={clients}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {deleting && (
        <DeleteVehicleModal
          vehicle={deleting}
          serviceCount={serviceCounts[deleting.id] ?? 0}
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

function VehicleFormModal({
  initial,
  clients,
  onClose,
  onSaved,
}: {
  initial: Vehicle | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return { ...EMPTY_FORM, client_id: clients[0]?.id ?? "" };
    return {
      unit_id: initial.unit_id,
      plate_number: initial.plate_number,
      client_id: initial.client_id,
      make: initial.make,
      model: initial.model,
      year: initial.year,
      vehicle_type: initial.vehicle_type ?? "Pickup",
      engine_type: initial.engine_type ?? "Diesel",
      oil_type: initial.oil_type,
      oil_liters: initial.oil_liters,
      pms_interval_km: initial.pms_interval_km ?? 5000,
      avg_km_per_month: initial.avg_km_per_month ?? "",
      current_km: initial.current_km,
      last_service_km: initial.last_service_km ?? 0,
      last_service_date: initial.last_service_date?.slice(0, 10) ?? today(),
      notes: "",
    };
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.unit_id || !form.plate_number || !form.client_id || !form.make || !form.model) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const payload = {
      unit_id: form.unit_id.toUpperCase(),
      plate_number: form.plate_number.toUpperCase(),
      client_id: form.client_id,
      make: form.make,
      model: form.model,
      year: Number(form.year),
      vehicle_type: form.vehicle_type,
      engine_type: form.engine_type,
      oil_type: form.oil_type,
      oil_liters: Number(form.oil_liters),
      pms_interval_km: Number(form.pms_interval_km),
      avg_km_per_month: form.avg_km_per_month === "" ? null : Number(form.avg_km_per_month),
      current_km: Number(form.current_km),
      last_service_km: Number(form.last_service_km),
      last_service_date: form.last_service_date,
    };
    const res = initial
      ? await supabaseFleet.from("vehicles").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("vehicles").insert([payload]);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(initial ? "Vehicle updated" : "Vehicle added");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? `Edit Vehicle: ${initial.unit_id}` : "Add New Vehicle"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <SectionLabel>Identification</SectionLabel>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Unit ID" required hint="e.g., U-007">
            <input type="text" value={form.unit_id} onChange={(e) => update("unit_id", e.target.value.toUpperCase())} className={inputCls} />
          </Field>
          <Field label="Plate Number" required hint="e.g., ABC-1234">
            <input type="text" value={form.plate_number} onChange={(e) => update("plate_number", e.target.value.toUpperCase())} className={inputCls} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Fleet Client" required>
              <select value={form.client_id} onChange={(e) => update("client_id", e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.client_code} - {c.company_name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <SectionLabel>Vehicle Info</SectionLabel>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Make" required>
            <input type="text" value={form.make} onChange={(e) => update("make", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Model" required>
            <input type="text" value={form.model} onChange={(e) => update("model", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Year" required>
            <input type="number" min={1990} max={2030} value={form.year} onChange={(e) => update("year", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Vehicle Type" required>
            <select value={form.vehicle_type} onChange={(e) => update("vehicle_type", e.target.value)} className={inputCls}>
              {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Engine Type" required>
            <select value={form.engine_type} onChange={(e) => update("engine_type", e.target.value)} className={inputCls}>
              {ENGINE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <SectionLabel>Service Specs</SectionLabel>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Oil Type" required>
            <select value={form.oil_type} onChange={(e) => update("oil_type", e.target.value)} className={inputCls}>
              {OIL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Oil Capacity (Liters)" required>
            <input type="number" step={0.5} min={1} max={15} value={form.oil_liters} onChange={(e) => update("oil_liters", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="PMS Interval (KM)" required>
            <input type="number" step={1000} value={form.pms_interval_km} onChange={(e) => update("pms_interval_km", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Avg KM per Month" hint="optional">
            <input
              type="number"
              value={form.avg_km_per_month}
              onChange={(e) => update("avg_km_per_month", e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <SectionLabel>Current Status</SectionLabel>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Current KM" required>
            <input type="number" value={form.current_km} onChange={(e) => update("current_km", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Last Service KM" required>
            <input type="number" value={form.last_service_km} onChange={(e) => update("last_service_km", Number(e.target.value))} className={inputCls} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Last Service Date" required>
              <input type="date" value={form.last_service_date} onChange={(e) => update("last_service_date", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
          <button onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            {saving ? "Saving…" : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-stone-500">
      {children}
    </div>
  );
}

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {hint && <span className="ml-2 font-normal normal-case text-stone-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function DeleteVehicleModal({
  vehicle, serviceCount, onClose, onDeleted,
}: {
  vehicle: Vehicle;
  serviceCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabaseFleet.from("vehicles").delete().eq("id", vehicle.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vehicle deleted");
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>Delete Vehicle?</h2>
        <p className="mt-2 text-sm text-stone-600">
          Are you sure you want to delete <strong>{vehicle.plate_number}</strong> — {vehicle.make} {vehicle.model}?
        </p>
        <p className="mt-2 text-sm text-stone-600">
          This will also delete <strong>{serviceCount}</strong> service history record{serviceCount === 1 ? "" : "s"} for this vehicle.
        </p>
        <p className="mt-2 text-sm font-semibold text-red-600">This action cannot be undone.</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
