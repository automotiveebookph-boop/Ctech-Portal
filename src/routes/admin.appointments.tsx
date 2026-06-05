import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Clock, Search, X } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";



export const Route = createFileRoute("/admin/appointments")({
  component: () => <AdminAppointments />,
});

type Row = {
  id: string;
  vehicle_id: string;
  customer_id: string;
  preferred_date: string;
  preferred_time: string;
  service_type: string;
  notes: string | null;
  admin_notes: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  customers: {
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  vehicles: {
    plate_number: string;
    make: string;
    model: string;
    unit_id: string;
  } | null;
};

type ModalState =
  | { kind: "none" }
  | { kind: "confirm"; row: Row; note: string }
  | { kind: "complete"; row: Row }
  | { kind: "cancel"; row: Row };

const today = () => new Date().toISOString().slice(0, 10);

export function AdminAppointments({
  title = "Appointment Requests",
}: { title?: string } = {}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | Row["status"]>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabaseFleet
      .from("appointments")
      .select(
        `*, customers (full_name, phone, email), vehicles (plate_number, make, model, unit_id)`,
      )
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pending = rows.filter((r) => r.status === "pending").length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const today = new Date();
  const inOneWeek = new Date();
  inOneWeek.setDate(today.getDate() + 7);
  const thisWeek = rows.filter((r) => {
    const d = new Date(r.preferred_date);
    return d >= today && d <= inOneWeek;
  }).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (fromDate && r.preferred_date < fromDate) return false;
      if (toDate && r.preferred_date > toDate) return false;
      if (!q) return true;
      return (
        (r.customers?.full_name ?? "").toLowerCase().includes(q) ||
        (r.vehicles?.plate_number ?? "").toLowerCase().includes(q) ||
        (r.service_type ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, search, fromDate, toDate]);

  async function doConfirm() {
    if (modal.kind !== "confirm") return;
    setSaving(true);
    const id = modal.row.id;
    await supabaseFleet
      .from("appointments")
      .update({ status: "confirmed", admin_notes: modal.note || null })
      .eq("id", id);
    setSaving(false);
    setModal({ kind: "none" });
    load();
    toast.success("Appointment confirmed successfully");
  }
  async function doComplete() {
    if (modal.kind !== "complete") return;
    setSaving(true);
    const id = modal.row.id;
    await supabaseFleet
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", id);
    setSaving(false);
    setModal({ kind: "none" });
    load();
    toast.success("Appointment marked as completed");
  }
  async function doCancel() {
    if (modal.kind !== "cancel") return;
    setSaving(true);
    await supabaseFleet
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", modal.row.id);
    setSaving(false);
    setModal({ kind: "none" });
    load();
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-wider md:text-xs"
            style={{ color: "#C9A227" }}
          >
            C-Tech Staff View
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            {title}
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-700" />}
            iconBg="rgba(217,119,6,0.15)"
            value={loading ? "—" : pending}
            label="Pending"
            sub="awaiting confirmation"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />}
            iconBg="rgba(5,150,105,0.15)"
            value={loading ? "—" : confirmed}
            label="Confirmed"
            sub="ready to service"
          />
          <StatCard
            icon={<CalendarCheck className="h-5 w-5" style={{ color: "#0F1E3A" }} />}
            iconBg="rgba(15,30,58,0.12)"
            value={loading ? "—" : thisWeek}
            label="This Week"
            sub="next 7 days"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, plate, service…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            From:
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            To:
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          {(search || fromDate || toDate) && (
            <button
              onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}
              className="text-sm text-stone-500 underline"
            >
              Reset
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                  statusFilter === s
                    ? "border-transparent text-white"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }`}
                style={statusFilter === s ? { backgroundColor: "#0F1E3A" } : undefined}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Date Requested</th>
                  <th className="px-4 py-3 text-left font-bold">Customer</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">Service</th>
                  <th className="px-4 py-3 text-left font-bold">Preferred</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-stone-500">
                      No appointments match these filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-4 align-top">
                        <div className="text-xs text-stone-500">
                          {formatDate(r.created_at)}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(r.created_at).toLocaleDateString("en-US", {
                            weekday: "long",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div
                          className="font-semibold"
                          style={{ color: "#0F1E3A" }}
                        >
                          {r.customers?.full_name ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">
                          {r.customers?.phone ?? r.customers?.email ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold">
                          {r.vehicles?.plate_number ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">
                          {r.vehicles?.make} {r.vehicles?.model}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm">
                        {r.service_type}
                      </td>
                      <td className="px-4 py-4 align-top text-sm">
                        <div>{formatDate(r.preferred_date)}</div>
                        <div className="text-xs text-stone-500">
                          {r.preferred_time}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          {r.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  setModal({ kind: "confirm", row: r, note: "" })
                                }
                                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setModal({ kind: "cancel", row: r })}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {r.status === "confirmed" && (
                            <>
                              <button
                                onClick={() => setModal({ kind: "complete", row: r })}
                                className="rounded px-3 py-1 text-xs font-semibold text-white"
                                style={{ backgroundColor: "#0F1E3A" }}
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => setModal({ kind: "cancel", row: r })}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {(r.status === "completed" || r.status === "cancelled") && (
                            <span className="text-xs text-stone-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {modal.kind !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#0F1E3A" }}>
                {modal.kind === "confirm" && "Confirm Appointment"}
                {modal.kind === "complete" && "Mark as Completed"}
                {modal.kind === "cancel" && "Cancel Appointment"}
              </h2>
              <button
                onClick={() => setModal({ kind: "none" })}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {"row" in modal && (
              <div className="mb-4 rounded-lg bg-stone-50 p-4 text-sm">
                <div>
                  <strong>{modal.row.customers?.full_name}</strong>
                </div>
                <div className="text-stone-600">
                  {modal.row.vehicles?.plate_number} ·{" "}
                  {modal.row.vehicles?.make} {modal.row.vehicles?.model}
                </div>
                <div className="mt-1 text-stone-600">
                  {modal.row.service_type} · {formatDate(modal.row.preferred_date)} (
                  {modal.row.preferred_time})
                </div>
              </div>
            )}

            {modal.kind === "confirm" && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold uppercase text-stone-600">
                  Note to customer (optional)
                </label>
                <textarea
                  rows={3}
                  value={modal.note}
                  onChange={(e) => setModal({ ...modal, note: e.target.value })}
                  maxLength={500}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-[#0F1E3A] focus:outline-none"
                  placeholder="e.g. Please bring your vehicle 10 minutes early."
                />
              </div>
            )}

            {modal.kind === "complete" && (
              <p className="mb-4 text-sm text-stone-600">
                Are you sure this service has been completed?
              </p>
            )}

            {modal.kind === "cancel" && (
              <p className="mb-4 text-sm text-stone-600">
                Are you sure you want to cancel this appointment?
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ kind: "none" })}
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              {modal.kind === "confirm" && (
                <button
                  onClick={doConfirm}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Confirm Appointment
                </button>
              )}
              {modal.kind === "complete" && (
                <button
                  onClick={doComplete}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#0F1E3A" }}
                >
                  Mark Completed
                </button>
              )}
              {modal.kind === "cancel" && (
                <button
                  onClick={doCancel}
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Cancel Appointment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number | string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full"
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-stone-100 text-stone-600 border-stone-200",
    cancelled: "bg-stone-50 text-stone-400 border-stone-200",
  };
  return (
    <span
      className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? map.pending}`}
    >
      {status}
    </span>
  );
}
