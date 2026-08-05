import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { STATUS_STYLES } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/walkin/vehicles")({
  component: WalkinVehiclesPage,
});

type CV = {
  id: string;
  unit_id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  variant: string | null;
  color: string | null;
  vehicle_type: string | null;
  engine_type: string | null;
  engine_code: string | null;
  transmission_type: string | null;
  vin_number: string | null;
  engine_number: string | null;
  tire_size: string | null;
  bolt_pattern: string | null;
  current_km: number;
  service_status: "OK" | "DUE SOON" | "DUE NOW" | "OVERDUE";
  customer_id: string;
  oil_type: string;
  oil_liters: number;
  pms_interval_km: number | null;
  last_service_km: number | null;
  last_service_date: string | null;
};
type Customer = { id: string; full_name: string };

const OIL_TYPES = ["Semi-Synth", "Fully Synth", "Fully Synth 5W30", "Fully Synth 0W20", "Mineral"];
const VEHICLE_TYPES = ["Pickup", "Sedan", "Van", "SUV", "Truck", "Motorcycle", "Other"];
const ENGINE_TYPES = ["Gas", "Diesel", "Hybrid", "Electric"];
const TRANSMISSION_TYPES = ["Automatic", "Manual", "CVT"];

function WalkinVehiclesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/walkin/vehicles") {
    return <Outlet />;
  }
  return <WalkinVehiclesListPage />;
}

function WalkinVehiclesListPage() {
  const [vehicles, setVehicles] = useState<CV[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CV | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [archiving, setArchiving] = useState<CV | null>(null);

  async function load() {
    setLoading(true);
    const [vRes, cRes] = await Promise.all([
      supabaseFleet.from("vehicle_status_view").select("*").not("customer_id", "is", null).neq("status", "archived"),
      supabaseFleet.from("customers").select("id, full_name").order("full_name"),
    ]);
    setVehicles((vRes.data ?? []) as unknown as CV[]);
    setCustomers((cRes.data ?? []) as Customer[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      v.plate_number.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.vin_number ?? "").toLowerCase().includes(q) ||
      (customerById.get(v.customer_id)?.full_name ?? "").toLowerCase().includes(q)
    );
  }, [vehicles, search, customerById]);

  async function doArchive() {
    if (!archiving) return;
    const { error } = await supabaseFleet.from("vehicles").update({ status: "archived" }).eq("id", archiving.id);
    if (error) toast.error(error.message); else toast.success("Vehicle archived");
    setArchiving(null);
    load();
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Customer Vehicles
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">{vehicles.length} vehicles registered</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
        >
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 max-w-md relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, VIN, make, model, customer…"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Plate</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">Customer</th>
                  <th className="px-4 py-3 text-left font-bold">Current KM</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No customer vehicles yet.</td></tr>
                ) : (
                  filtered.map((v) => {
                    const s = STATUS_STYLES[v.service_status];
                    return (
                      <tr key={v.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>{v.plate_number}</div>
                          <div className="text-xs text-stone-500">{v.unit_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{v.make} {v.model}</div>
                          <div className="text-xs text-stone-500">{v.year} · {v.vehicle_type ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: "#0F1E3A" }}>
                          {customerById.get(v.customer_id)?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold">{v.current_km.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text} ${s.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {v.service_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to="/admin/walkin/vehicles/$vehicleId"
                              params={{ vehicleId: v.id }}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                              style={{ backgroundColor: "#0F1E3A" }}
                            >
                              View
                            </Link>
                            <button
                              onClick={() => { setEditing(v); setModalOpen(true); }}
                              className="text-xs font-semibold hover:underline"
                              style={{ color: "#0F1E3A" }}
                            >Edit</button>
                            <button
                              onClick={() => setArchiving(v)}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >Archive</button>
                          </div>
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
        <VehicleModal
          initial={editing}
          customers={customers}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {archiving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold mb-2" style={{ color: "#0F1E3A" }}>Archive Vehicle?</h2>
            <p className="text-sm text-stone-600 mb-4">
              <strong>{archiving.plate_number}</strong> will be hidden from the active list. Its service history is kept.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setArchiving(null)} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
              <button onClick={doArchive} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Archive</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const today = () => new Date().toISOString().slice(0, 10);

function VehicleModal({
  initial, customers, onClose, onSaved,
}: { initial: CV | null; customers: Customer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_id: initial?.customer_id ?? (customers[0]?.id ?? ""),
    unit_id: initial?.unit_id ?? "",
    plate_number: initial?.plate_number ?? "",
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? new Date().getFullYear(),
    variant: initial?.variant ?? "",
    color: initial?.color ?? "",
    vehicle_type: initial?.vehicle_type ?? "Sedan",
    engine_type: initial?.engine_type ?? "Gas",
    engine_code: initial?.engine_code ?? "",
    transmission_type: initial?.transmission_type ?? "Automatic",
    vin_number: initial?.vin_number ?? "",
    engine_number: initial?.engine_number ?? "",
    tire_size: initial?.tire_size ?? "",
    bolt_pattern: initial?.bolt_pattern ?? "",
    oil_type: initial?.oil_type ?? "Fully Synth",
    oil_liters: initial?.oil_liters ?? 4,
    pms_interval_km: initial?.pms_interval_km ?? 5000,
    current_km: initial?.current_km ?? 0,
    last_service_km: initial?.last_service_km ?? 0,
    last_service_date: initial?.last_service_date?.slice(0, 10) ?? today(),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.customer_id || !form.unit_id || !form.plate_number || !form.make || !form.model) {
      toast.error("Please complete all required fields");
      return;
    }
    const plate = form.plate_number.trim().toUpperCase();
    const vin = form.vin_number.trim().toUpperCase();

    let dupQuery = supabaseFleet
      .from("vehicles")
      .select("id, plate_number")
      .or(`plate_number.eq.${plate}${vin ? `,vin_number.eq.${vin}` : ""}`)
      .neq("status", "archived");
    if (initial) dupQuery = dupQuery.neq("id", initial.id);
    const dup = await dupQuery.maybeSingle();
    if (dup.data) {
      toast.error(`A vehicle with this plate/VIN already exists (${dup.data.plate_number})`);
      return;
    }

    setSaving(true);
    const payload = {
      customer_id: form.customer_id,
      client_id: null,
      unit_id: form.unit_id.toUpperCase(),
      plate_number: plate,
      make: form.make,
      model: form.model,
      year: Number(form.year),
      variant: form.variant.trim() || null,
      color: form.color.trim() || null,
      vehicle_type: form.vehicle_type,
      engine_type: form.engine_type,
      engine_code: form.engine_code.trim() || null,
      transmission_type: form.transmission_type,
      vin_number: vin || null,
      engine_number: form.engine_number.trim() || null,
      tire_size: form.tire_size.trim() || null,
      bolt_pattern: form.bolt_pattern.trim() || null,
      oil_type: form.oil_type,
      oil_liters: Number(form.oil_liters),
      pms_interval_km: Number(form.pms_interval_km),
      current_km: Number(form.current_km),
      last_service_km: Number(form.last_service_km),
      last_service_date: form.last_service_date,
    };
    const res = initial
      ? await supabaseFleet.from("vehicles").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("vehicles").insert([payload]);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(initial ? "Vehicle updated" : "Vehicle added");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? "Edit Vehicle" : "Add Customer Vehicle"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Customer *</Label>
            <select className={input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">— Select —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div><Label>Unit ID *</Label><input className={input} value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} /></div>
          <div><Label>Plate Number *</Label><input className={input} value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} /></div>
          <div><Label>Make *</Label><input className={input} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
          <div><Label>Model *</Label><input className={input} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div><Label>Year</Label><input type="number" className={input} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
          <div><Label>Variant</Label><input className={input} value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g. 2.8 V" /></div>
          <div>
            <Label>Vehicle Type</Label>
            <select className={input} value={form.vehicle_type ?? ""} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
              {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Fuel Type</Label>
            <select className={input} value={form.engine_type ?? ""} onChange={(e) => setForm({ ...form, engine_type: e.target.value })}>
              {ENGINE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Transmission</Label>
            <select className={input} value={form.transmission_type} onChange={(e) => setForm({ ...form, transmission_type: e.target.value })}>
              {TRANSMISSION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Color</Label><input className={input} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Optional" /></div>
          <div><Label>VIN / Chassis No.</Label><input className={input} value={form.vin_number} onChange={(e) => setForm({ ...form, vin_number: e.target.value })} placeholder="Optional" /></div>
          <div><Label>Engine Number</Label><input className={input} value={form.engine_number} onChange={(e) => setForm({ ...form, engine_number: e.target.value })} placeholder="Optional" /></div>
          <div><Label>Engine Code</Label><input className={input} value={form.engine_code} onChange={(e) => setForm({ ...form, engine_code: e.target.value })} placeholder="e.g. 1GD-FTV" /></div>
          <div><Label>Tire Size</Label><input className={input} value={form.tire_size} onChange={(e) => setForm({ ...form, tire_size: e.target.value })} placeholder="e.g. 265/65R17" /></div>
          <div><Label>Bolt Pattern</Label><input className={input} value={form.bolt_pattern} onChange={(e) => setForm({ ...form, bolt_pattern: e.target.value })} placeholder="e.g. 6x139.7" /></div>
          <div>
            <Label>Oil Type</Label>
            <select className={input} value={form.oil_type} onChange={(e) => setForm({ ...form, oil_type: e.target.value })}>
              {OIL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Oil Liters</Label><input type="number" step="0.5" className={input} value={form.oil_liters} onChange={(e) => setForm({ ...form, oil_liters: Number(e.target.value) })} /></div>
          <div><Label>PMS Interval (km)</Label><input type="number" className={input} value={form.pms_interval_km} onChange={(e) => setForm({ ...form, pms_interval_km: Number(e.target.value) })} /></div>
          <div><Label>Current KM</Label><input type="number" className={input} value={form.current_km} onChange={(e) => setForm({ ...form, current_km: Number(e.target.value) })} /></div>
          <div><Label>Last Service KM</Label><input type="number" className={input} value={form.last_service_km} onChange={(e) => setForm({ ...form, last_service_km: Number(e.target.value) })} /></div>
          <div><Label>Last Service Date</Label><input type="date" className={input} value={form.last_service_date} onChange={(e) => setForm({ ...form, last_service_date: e.target.value })} /></div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-600">{children}</label>;
}
