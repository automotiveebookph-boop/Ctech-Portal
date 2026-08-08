import { X } from "lucide-react";
import { formatDate } from "@/lib/my-car-session";
import { RECOMMENDATION_STYLES, peso, type ServiceRecord } from "@/lib/fleet-utils";

export function ServiceRecordModal({
  record,
  vehicleLabel,
  onClose,
}: {
  record: ServiceRecord;
  vehicleLabel?: string;
  onClose: () => void;
}) {
  const priority = record.recommendation_priority ?? "Good";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>Service Record</h2>
            {vehicleLabel && <p className="text-xs text-stone-500">{vehicleLabel}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Service Date" value={formatDate(record.service_date)} />
            <Field label="Mileage" value={`${record.odometer_km.toLocaleString()} km`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Job Order #" value={record.job_order_number || "—"} />
            <Field label="Technician" value={record.technician || "—"} />
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Service Performed</div>
            <div className="mt-0.5 whitespace-pre-wrap text-stone-700">{record.service_performed}</div>
          </div>

          {record.notes && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Notes</div>
              <div className="mt-0.5 whitespace-pre-wrap text-stone-700">{record.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 border-t border-stone-200 pt-4">
            <Field label="Parts" value={peso(record.parts_cost ?? 0)} />
            <Field label="Labor" value={peso(record.labor_cost ?? 0)} />
            <Field label="Total" value={peso(record.total_cost ?? 0)} bold />
          </div>

          {record.recommendation && (
            <div className={`rounded-xl border p-4 ${RECOMMENDATION_STYLES[priority].border} ${RECOMMENDATION_STYLES[priority].bg}`}>
              <div className={`text-xs font-bold uppercase tracking-wide ${RECOMMENDATION_STYLES[priority].text}`}>
                Recommendation for Next Visit
              </div>
              <div className="mt-1 text-stone-800">{record.recommendation}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                {record.recommendation_priority && (
                  <span>Priority: <strong>{record.recommendation_priority}</strong></span>
                )}
                {record.recommendation_due_km != null && (
                  <span>Recommended return: within {record.recommendation_due_km.toLocaleString()} km</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</div>
      <div className={`mt-0.5 text-stone-700 ${bold ? "font-bold" : ""}`} style={bold ? { color: "#0F1E3A" } : undefined}>
        {value}
      </div>
    </div>
  );
}
