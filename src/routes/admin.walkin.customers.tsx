import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Car, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";

export const Route = createFileRoute("/admin/walkin/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes?: string | null;
  created_at: string;
};

type VehicleLite = {
  id: string;
  customer_id: string | null;
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  color?: string | null;
  transmission?: string | null;
};

type LastVisit = { customer_id: string; service_date: string };

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLite[]>([]);
  const [lastVisits, setLastVisits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  async function load() {
    setLoading(true);
    const cu = await supabaseFleet.from("customers").select("*").order("created_at", { ascending: false });
    let veRes = await supabaseFleet
      .from("vehicles")
      .select("id, customer_id, plate_number, make, model, year, color, transmission")
      .not("customer_id", "is", null);
    if (veRes.error) {
      // Fallback for DBs without color/transmission columns
      veRes = await supabaseFleet
        .from("vehicles")
        .select("id, customer_id, plate_number, make, model, year")
        .not("customer_id", "is", null) as typeof veRes;
    }
    const cList = (cu.data ?? []) as Customer[];
    const vList = (veRes.data ?? []) as unknown as VehicleLite[];
    setCustomers(cList);
    setVehicles(vList);

    // last visit per customer (via their vehicles)
    const vIds = vList.map((v) => v.id);
    if (vIds.length) {
      const { data } = await supabaseFleet
        .from("service_history")
        .select("vehicle_id, service_date")
        .in("vehicle_id", vIds)
        .order("service_date", { ascending: false });
      const vToC = new Map(vList.map((v) => [v.id, v.customer_id]));
      const lv: Record<string, string> = {};
      for (const r of (data ?? []) as { vehicle_id: string; service_date: string }[]) {
        const cId = vToC.get(r.vehicle_id);
        if (cId && !lv[cId]) lv[cId] = r.service_date;
      }
      setLastVisits(lv);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const vehiclesByCustomer = useMemo(() => {
    const m = new Map<string, VehicleLite[]>();
    for (const v of vehicles) {
      if (!v.customer_id) continue;
      const list = m.get(v.customer_id) ?? [];
      list.push(v);
      m.set(v.customer_id, list);
    }
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  async function doDelete() {
    if (!deleting) return;
    const { error } = await supabaseFleet.from("customers").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else toast.success("Customer deleted");
    setDeleting(null);
    load();
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Walk-in Panel
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Walk-in Customers
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {customers.length} customers registered
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 max-w-md relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone…"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Name</th>
                  <th className="px-4 py-3 text-left font-bold">Email</th>
                  <th className="px-4 py-3 text-left font-bold">Phone</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">Last Visit</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No customers found.</td></tr>
                ) : (
                  filtered.map((c) => {
                    const vList = vehiclesByCustomer.get(c.id) ?? [];
                    return (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>{c.full_name}</div>
                          <div className="text-xs text-stone-500">{c.email}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-700">{c.email ?? "—"}</td>
                        <td className="px-4 py-3 text-stone-700">{c.phone ?? "—"}</td>
                        <td className="px-4 py-3">
                          {vList.length === 0 ? (
                            <span className="text-stone-400">—</span>
                          ) : (
                            <div className="space-y-1">
                              {vList.map((v) => (
                                <div key={v.id}>
                                  <div className="font-semibold">{v.plate_number}</div>
                                  <div className="text-xs text-stone-500">
                                    {v.make} {v.model}{v.year ? ` · ${v.year}` : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {lastVisits[c.id] ? formatDate(lastVisits[c.id]) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right space-x-3">
                          <button
                            onClick={() => { setEditing(c); setModalOpen(true); }}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: "#0F1E3A" }}
                          >Edit</button>
                          <button
                            onClick={() => setDeleting(c)}
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
        <CustomerModal
          initial={editing}
          initialVehicles={editing ? vehiclesByCustomer.get(editing.id) ?? [] : []}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold mb-2" style={{ color: "#0F1E3A" }}>Delete Customer?</h2>
            <p className="text-sm text-stone-600 mb-4">
              This will permanently delete <strong>{deleting.full_name}</strong>. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">
                Cancel
              </button>
              <button onClick={doDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CustomerModal({
  initial,
  initialVehicles,
  onClose,
  onSaved,
}: {
  initial: Customer | null;
  initialVehicles: VehicleLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  });
  const [vehicleList, setVehicleList] = useState<VehicleLite[]>(initialVehicles);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vForm, setVForm] = useState({
    plate_number: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    transmission: "Automatic",
  });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Full name and email are required");
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = initial
      ? await supabaseFleet.from("customers").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("customers").insert([payload]);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(initial ? "Customer updated" : "Customer added");
    onSaved();
  }

  async function addVehicle() {
    if (!initial) {
      toast.error("Save the customer first, then add vehicles");
      return;
    }
    if (!vForm.plate_number.trim() || !vForm.make.trim() || !vForm.model.trim()) {
      toast.error("Plate, make, and model are required");
      return;
    }
    setSavingVehicle(true);
    const plate = vForm.plate_number.trim().toUpperCase();
    // Defaults for required NOT NULL columns on the vehicles table
    const payload: Record<string, unknown> = {
      customer_id: initial.id,
      client_id: null,
      unit_id: plate,
      plate_number: plate,
      make: vForm.make.trim(),
      model: vForm.model.trim(),
      year: Number(vForm.year) || new Date().getFullYear(),
      color: vForm.color.trim() || null,
      transmission: vForm.transmission,
      vehicle_type: "Sedan",
      engine_type: "Gas",
      oil_type: "Fully Synth",
      oil_liters: 4,
      pms_interval_km: 5000,
      current_km: 0,
      last_service_km: 0,
      last_service_date: new Date().toISOString().slice(0, 10),
    };
    let res = await supabaseFleet.from("vehicles").insert([payload]).select().single();
    if (res.error) {
      // Retry without color/transmission if those columns don't exist
      delete payload.color;
      delete payload.transmission;
      res = await supabaseFleet.from("vehicles").insert([payload]).select().single();
    }
    setSavingVehicle(false);
    if (res.error) { toast.error(res.error.message); return; }
    const v = res.data as VehicleLite;
    setVehicleList((prev) => [...prev, v]);
    setVForm({
      plate_number: "",
      make: "",
      model: "",
      year: new Date().getFullYear(),
      color: "",
      transmission: "Automatic",
    });
    setAddingVehicle(false);
    toast.success("Vehicle added");
  }

  async function removeVehicle(id: string) {
    const { error } = await supabaseFleet.from("vehicles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setVehicleList((prev) => prev.filter((v) => v.id !== id));
    toast.success("Vehicle removed");
  }

  const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? "Edit Customer" : "Add Customer"}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Full Name *</label>
            <input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Email *</label>
            <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Phone</label>
            <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Address</label>
            <input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Notes</label>
            <textarea rows={3} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="border-t border-stone-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase text-stone-600">Vehicles</label>
              {initial && !addingVehicle && (
                <button
                  type="button"
                  onClick={() => setAddingVehicle(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold"
                  style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                >
                  <Plus className="h-3 w-3" /> Add Vehicle
                </button>
              )}
            </div>

            {!initial && (
              <p className="text-xs text-stone-500">Save the customer first to add vehicles.</p>
            )}

            {initial && vehicleList.length === 0 && !addingVehicle && (
              <p className="text-xs text-stone-500">No vehicles yet.</p>
            )}

            <div className="space-y-2">
              {vehicleList.map((v) => (
                <div key={v.id} className="flex items-start justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 h-4 w-4 text-stone-500" />
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#0F1E3A" }}>{v.plate_number}</div>
                      <div className="text-xs text-stone-600">
                        {v.make} {v.model}{v.year ? ` · ${v.year}` : ""}
                        {v.color ? ` · ${v.color}` : ""}
                        {v.transmission ? ` · ${v.transmission}` : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVehicle(v.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="Remove vehicle"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {addingVehicle && (
              <div className="mt-3 space-y-3 rounded-lg border border-stone-300 bg-white p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Plate Number *</label>
                    <input className={input} value={vForm.plate_number} onChange={(e) => setVForm({ ...vForm, plate_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Make *</label>
                    <input className={input} value={vForm.make} onChange={(e) => setVForm({ ...vForm, make: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Model *</label>
                    <input className={input} value={vForm.model} onChange={(e) => setVForm({ ...vForm, model: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Year</label>
                    <input type="number" className={input} value={vForm.year} onChange={(e) => setVForm({ ...vForm, year: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Color</label>
                    <input className={input} value={vForm.color} onChange={(e) => setVForm({ ...vForm, color: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Transmission</label>
                    <select className={input} value={vForm.transmission} onChange={(e) => setVForm({ ...vForm, transmission: e.target.value })}>
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingVehicle(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100"
                  >Cancel</button>
                  <button
                    type="button"
                    onClick={addVehicle}
                    disabled={savingVehicle}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                    style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                  >
                    {savingVehicle ? "Saving…" : "Save Vehicle"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Close</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
