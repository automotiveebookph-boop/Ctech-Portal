import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CHECK_IN_MONTHS, type Vehicle } from "@/lib/fleet-utils";
import { formatDate } from "@/lib/my-car-session";

const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";

export function VehicleQuickModal({
  customerId,
  customerName,
  initial,
  initialPlate,
  onClose,
  onSaved,
}: {
  customerId: string;
  customerName?: string;
  initial?: Vehicle | null;
  initialPlate?: string;
  onClose: () => void;
  onSaved: (vehicleId?: string) => void;
}) {
  const [form, setForm] = useState({
    plate_number: initial?.plate_number ?? initialPlate ?? "",
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? new Date().getFullYear(),
    variant: initial?.variant ?? "",
    color: initial?.color ?? "",
    transmission_type: initial?.transmission_type ?? "Automatic",
    current_km: initial?.current_km ?? 0,
    vin_number: initial?.vin_number ?? "",
    engine_number: initial?.engine_number ?? "",
    engine_code: initial?.engine_code ?? "",
    tire_size: initial?.tire_size ?? "",
    bolt_pattern: initial?.bolt_pattern ?? "",
    last_service_km: initial?.last_service_km ?? initial?.current_km ?? 0,
    last_service_date: initial?.last_service_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const pmsInterval = initial?.pms_interval_km ?? 5000;
  const nextServiceKm = (Number(form.last_service_km) || 0) + pmsInterval;
  const nextCheckInDate = form.last_service_date
    ? (() => {
        const d = new Date(form.last_service_date);
        d.setMonth(d.getMonth() + CHECK_IN_MONTHS);
        return d.toISOString().slice(0, 10);
      })()
    : null;

  async function save() {
    if (!form.plate_number.trim() || !form.make.trim() || !form.model.trim()) {
      toast.error("Plate, brand, and model are required");
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
    const dupCheck = await dupQuery.maybeSingle();
    if (dupCheck.data) {
      toast.error(`A vehicle with this plate/VIN already exists (${dupCheck.data.plate_number})`);
      return;
    }

    setSaving(true);
    const payload = {
      plate_number: plate,
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year) || new Date().getFullYear(),
      variant: form.variant.trim() || null,
      color: form.color.trim() || null,
      transmission_type: form.transmission_type,
      current_km: Number(form.current_km) || 0,
      vin_number: vin || null,
      engine_number: form.engine_number.trim() || null,
      engine_code: form.engine_code.trim() || null,
      tire_size: form.tire_size.trim() || null,
      bolt_pattern: form.bolt_pattern.trim() || null,
      last_service_km: Number(form.last_service_km) || 0,
      last_service_date: form.last_service_date,
    };

    const res = initial
      ? await supabaseFleet.from("vehicles").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("vehicles").insert([{
          ...payload,
          customer_id: customerId,
          client_id: null,
          unit_id: plate,
          vehicle_type: "Sedan",
          engine_type: "Gas",
          oil_type: "Fully Synth",
          oil_liters: 4,
          pms_interval_km: 5000,
        }]).select("id").single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(initial ? "Vehicle updated" : "Vehicle added");
    onSaved(initial ? undefined : (res.data as { id: string } | null)?.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
              {initial ? "Edit Vehicle" : "Add Vehicle"}
            </h2>
            {customerName && <p className="text-xs text-stone-500">for {customerName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Identification</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Plate Number / Conduction Sticker *</label>
            <input className={input} value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">VIN / Chassis No.</label>
            <input className={input} value={form.vin_number} onChange={(e) => setForm({ ...form, vin_number: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Engine Number</label>
            <input className={input} value={form.engine_number} onChange={(e) => setForm({ ...form, engine_number: e.target.value })} placeholder="Optional" />
          </div>
        </div>

        <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Vehicle Details</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Brand *</label>
            <input className={input} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Model *</label>
            <input className={input} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Year *</label>
            <input type="number" className={input} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Variant</label>
            <input className={input} value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="e.g. 2.8 V" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Transmission *</label>
            <select className={input} value={form.transmission_type} onChange={(e) => setForm({ ...form, transmission_type: e.target.value })}>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="CVT">CVT</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Color</label>
            <input className={input} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Optional" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Current Mileage (km) *</label>
            <input type="number" className={input} value={form.current_km} onChange={(e) => setForm({ ...form, current_km: Number(e.target.value) })} />
          </div>
        </div>

        <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Service History</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Last Visit Date</label>
            <input type="date" className={input} value={form.last_service_date} onChange={(e) => setForm({ ...form, last_service_date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Last Visit Mileage (km)</label>
            <input type="number" className={input} value={form.last_service_km} onChange={(e) => setForm({ ...form, last_service_km: Number(e.target.value) })} />
          </div>
          <div className="col-span-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <span className="font-semibold text-stone-700">Next Visit:</span>{" "}
            due at {nextServiceKm.toLocaleString()} km or by {nextCheckInDate ? formatDate(nextCheckInDate) : "—"}, whichever comes first
          </div>
        </div>

        <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Technical Specifications (Quick Reference)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Engine Code</label>
            <input className={input} value={form.engine_code} onChange={(e) => setForm({ ...form, engine_code: e.target.value })} placeholder="e.g. 1GD-FTV" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Tire Size</label>
            <input className={input} value={form.tire_size} onChange={(e) => setForm({ ...form, tire_size: e.target.value })} placeholder="e.g. 265/65R17" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Bolt Pattern</label>
            <input className={input} value={form.bolt_pattern} onChange={(e) => setForm({ ...form, bolt_pattern: e.target.value })} placeholder="e.g. 6x139.7" />
          </div>
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
