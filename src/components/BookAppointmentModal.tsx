import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { TIME_BLOCKS } from "@/routes/admin.appointments";

type VehicleOption = { id: string; plate_number: string; make: string; model: string };

const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const today = () => new Date().toISOString().slice(0, 10);

export function BookAppointmentModal({
  customerId,
  vehicles,
  initialVehicleId,
  onClose,
  onSaved,
}: {
  customerId: string;
  vehicles: VehicleOption[];
  initialVehicleId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vehicle_id: initialVehicleId ?? vehicles[0]?.id ?? "",
    preferred_date: today(),
    preferred_time: TIME_BLOCKS[0] as string,
    service_type: "",
    notes: "",
    status: "confirmed" as "pending" | "confirmed",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.vehicle_id) {
      toast.error("Select a vehicle");
      return;
    }
    if (!form.service_type.trim()) {
      toast.error("Enter the service type");
      return;
    }
    setSaving(true);
    const { error } = await supabaseFleet.from("appointments").insert([{
      customer_id: customerId,
      vehicle_id: form.vehicle_id,
      preferred_date: form.preferred_date,
      preferred_time: form.preferred_time,
      service_type: form.service_type.trim(),
      notes: form.notes.trim() || null,
      status: form.status,
    }]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment booked");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>Book Appointment</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {vehicles.length > 1 ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Vehicle *</label>
              <select className={input} value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>
                ))}
              </select>
            </div>
          ) : vehicles.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This customer has no vehicles yet — add one first.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Date</label>
              <input type="date" className={input} value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Time Slot</label>
              <select className={input} value={form.preferred_time} onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}>
                {TIME_BLOCKS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Service Type *</label>
            <input className={input} value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} placeholder="e.g. Oil Change / PMS" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Notes</label>
            <textarea rows={2} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Status</label>
            <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "pending" | "confirmed" })}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
          <button
            onClick={save}
            disabled={saving || vehicles.length === 0}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
          >
            {saving ? "Saving…" : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
