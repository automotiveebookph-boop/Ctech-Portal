import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import type { RecommendationPriority } from "@/lib/fleet-utils";

type VehicleOption = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  current_km: number;
};

const PRIORITIES: RecommendationPriority[] = ["Good", "Due Soon", "Overdue", "Needs Inspection"];
const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const today = () => new Date().toISOString().slice(0, 10);

export function JobOrderModal({
  vehicles,
  initialVehicleId,
  onClose,
  onSaved,
}: {
  vehicles: VehicleOption[];
  initialVehicleId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? vehicles[0]?.id ?? "");
  const vehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);

  const [form, setForm] = useState({
    service_date: today(),
    odometer_km: vehicle?.current_km ?? 0,
    job_order_number: "",
    service_performed: "",
    parts_cost: 0,
    labor_cost: 0,
    technician: "",
    recommendation: "",
    recommendation_priority: "" as RecommendationPriority | "",
    recommendation_due_km: "",
  });
  const [saving, setSaving] = useState(false);

  function pickVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setForm((f) => ({ ...f, odometer_km: v.current_km }));
  }

  async function save() {
    if (!vehicleId) {
      toast.error("Select a vehicle");
      return;
    }
    if (!form.service_performed.trim()) {
      toast.error("Describe the service performed");
      return;
    }
    if (form.odometer_km < (vehicle?.current_km ?? 0)) {
      toast.error(`Mileage can't be less than the vehicle's current ${vehicle?.current_km.toLocaleString()} km`);
      return;
    }
    setSaving(true);
    const total = Number(form.parts_cost) + Number(form.labor_cost);
    const { error: shError } = await supabaseFleet.from("service_history").insert([{
      vehicle_id: vehicleId,
      service_date: form.service_date,
      job_order_number: form.job_order_number.trim() || null,
      odometer_km: Number(form.odometer_km),
      service_performed: form.service_performed.trim(),
      parts_cost: Number(form.parts_cost) || 0,
      labor_cost: Number(form.labor_cost) || 0,
      total_cost: total,
      technician: form.technician.trim() || null,
      recommendation: form.recommendation.trim() || null,
      recommendation_priority: form.recommendation_priority || null,
      recommendation_due_km: form.recommendation_due_km ? Number(form.recommendation_due_km) : null,
    }]);
    if (shError) {
      setSaving(false);
      toast.error(shError.message);
      return;
    }
    // A completed job order is the new baseline for the vehicle's mileage/PMS clock.
    const { error: vError } = await supabaseFleet
      .from("vehicles")
      .update({
        current_km: Number(form.odometer_km),
        last_service_km: Number(form.odometer_km),
        last_service_date: form.service_date,
      })
      .eq("id", vehicleId);
    setSaving(false);
    if (vError) { toast.error(vError.message); return; }
    toast.success("Job order saved");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>Create Job Order</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {vehicles.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Vehicle *</label>
              <select className={input} value={vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Service Date</label>
              <input type="date" className={input} value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Mileage (km) *</label>
              <input type="number" className={input} value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Job Order #</label>
            <input className={input} value={form.job_order_number} onChange={(e) => setForm({ ...form, job_order_number: e.target.value })} placeholder="Optional" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Service Performed *</label>
            <textarea rows={2} className={input} value={form.service_performed} onChange={(e) => setForm({ ...form, service_performed: e.target.value })} placeholder="e.g. Full PMS — oil, filter, brake inspection" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Parts (₱)</label>
              <input type="number" className={input} value={form.parts_cost} onChange={(e) => setForm({ ...form, parts_cost: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Labor (₱)</label>
              <input type="number" className={input} value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Total</label>
              <div className="flex h-[38px] items-center rounded-lg bg-stone-100 px-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>
                ₱{(Number(form.parts_cost) + Number(form.labor_cost)).toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Technician</label>
            <input className={input} value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} />
          </div>

          <div className="border-t border-stone-200 pt-4">
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Recommendation for next visit</label>
            <textarea rows={2} className={input} value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })} placeholder="e.g. Front brake pads need inspection" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Priority</label>
                <select className={input} value={form.recommendation_priority} onChange={(e) => setForm({ ...form, recommendation_priority: e.target.value as RecommendationPriority })}>
                  <option value="">— None —</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-stone-600">Recommended return (km)</label>
                <input type="number" className={input} value={form.recommendation_due_km} onChange={(e) => setForm({ ...form, recommendation_due_km: e.target.value })} placeholder="e.g. 2000" />
              </div>
            </div>
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
            {saving ? "Saving…" : "Save Job Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
