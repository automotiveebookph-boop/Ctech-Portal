import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Mail, MessageSquare, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CHECKIN_DUE_STYLE, STATUS_STYLES, isCheckInDue } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/walkin/reminders")({
  component: RemindersPage,
});

type VSV = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  current_km: number;
  next_service_km: number;
  km_to_next_service: number;
  service_status: "OK" | "DUE SOON" | "DUE NOW" | "OVERDUE";
  customer_id: string;
  avg_km_per_month: number | null;
  last_service_date: string | null;
};
type Customer = { id: string; full_name: string; phone: string | null; email: string | null };

type Filter = "all" | "OVERDUE" | "DUE NOW" | "DUE SOON" | "CHECK_IN";

const URGENCY: Record<VSV["service_status"], number> = {
  OVERDUE: 0,
  "DUE NOW": 1,
  "DUE SOON": 2,
  OK: 3,
};

/** Which reminder bucket a vehicle belongs to — mileage-based, or a pure
 * 3-month check-in nudge when mileage says OK but it's been a while.
 * Returns null when the vehicle isn't due for anything. */
function bucket(v: VSV): Exclude<Filter, "all"> | null {
  if (v.service_status !== "OK") return v.service_status;
  return isCheckInDue(v.last_service_date) ? "CHECK_IN" : null;
}

function statusDisplay(v: VSV) {
  return bucket(v) === "CHECK_IN"
    ? { label: "CHECK-IN DUE", style: CHECKIN_DUE_STYLE }
    : { label: v.service_status, style: STATUS_STYLES[v.service_status] };
}

function estimatedDueDate(v: VSV): string | null {
  const avg = v.avg_km_per_month;
  const kmLeft = v.km_to_next_service;
  if (!avg || avg <= 0 || kmLeft <= 0) return null;
  const monthsLeft = kmLeft / avg;
  const d = new Date();
  d.setDate(d.getDate() + Math.round(monthsLeft * 30.44));
  return d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}

function reminderMessage(firstName: string, v: VSV) {
  if (bucket(v) === "CHECK_IN") {
    return `Hi ${firstName}! This is C-Tech Automotive. It's been a few months since your ${v.make} ${v.model} (${v.plate_number}) was last serviced with us. Time for a quick check-up! Reply here or call us to book your slot. Thank you!`;
  }
  const overdue = v.km_to_next_service <= 0;
  return `Hi ${firstName}! This is C-Tech Automotive. Your ${v.make} ${v.model} (${v.plate_number}) is ${
    overdue ? "now overdue" : "coming up"
  } for PMS service (due at ${v.next_service_km.toLocaleString()} km, currently ${v.current_km.toLocaleString()} km). Reply here or call us to book your slot. Thank you!`;
}

function RemindersPage() {
  const [vehicles, setVehicles] = useState<VSV[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [vRes, cRes] = await Promise.all([
        supabaseFleet
          .from("vehicle_status_view")
          .select("*")
          .not("customer_id", "is", null)
          .neq("status", "archived"),
        supabaseFleet.from("customers").select("id, full_name, phone, email").neq("status", "archived"),
      ]);
      // Due if the mileage clock says so, OR the shop's 3-month check-in
      // cadence has elapsed since the last visit — whichever comes first.
      const due = ((vRes.data ?? []) as unknown as VSV[]).filter((v) => bucket(v) !== null);
      setVehicles(due);
      setCustomers((cRes.data ?? []) as Customer[]);
      setLoading(false);
    })();
  }, []);

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const counts = useMemo(() => {
    const c = { OVERDUE: 0, "DUE NOW": 0, "DUE SOON": 0, CHECK_IN: 0 };
    for (const v of vehicles) {
      const b = bucket(v);
      if (b) c[b]++;
    }
    return c;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles
      .filter((v) => filter === "all" || bucket(v) === filter)
      .filter((v) => {
        if (!q) return true;
        const cust = customerById.get(v.customer_id);
        return (
          v.plate_number.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          (cust?.full_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => URGENCY[a.service_status] - URGENCY[b.service_status] || a.km_to_next_service - b.km_to_next_service);
  }, [vehicles, filter, search, customerById]);

  function copyMessage(name: string, v: VSV) {
    const msg = reminderMessage(name.split(" ")[0], v);
    navigator.clipboard.writeText(msg).then(
      () => toast.success("Reminder message copied"),
      () => toast.error("Couldn't copy — select and copy manually"),
    );
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Service Reminders
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">Customers due or overdue for their next PMS, or for a 3-month check-in</p>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Overdue" value={counts.OVERDUE} tone="red" active={filter === "OVERDUE"} onClick={() => setFilter(filter === "OVERDUE" ? "all" : "OVERDUE")} />
          <StatCard label="Due Now" value={counts["DUE NOW"]} tone="amber" active={filter === "DUE NOW"} onClick={() => setFilter(filter === "DUE NOW" ? "all" : "DUE NOW")} />
          <StatCard label="Due Soon" value={counts["DUE SOON"]} tone="yellow" active={filter === "DUE SOON"} onClick={() => setFilter(filter === "DUE SOON" ? "all" : "DUE SOON")} />
          <StatCard label="3-Month Check-In" value={counts.CHECK_IN} tone="sky" active={filter === "CHECK_IN"} onClick={() => setFilter(filter === "CHECK_IN" ? "all" : "CHECK_IN")} />
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plate, make, model, customer…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs font-semibold hover:underline" style={{ color: "#0F1E3A" }}>
              Clear filter — showing all {vehicles.length} due/overdue
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Customer</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">KM Status</th>
                  <th className="px-4 py-3 text-left font-bold">Est. Due</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Follow Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Nobody's due right now — nice work staying on top of it.</td></tr>
                ) : (
                  filtered.map((v) => {
                    const cust = customerById.get(v.customer_id);
                    const { label: statusLabel, style: s } = statusDisplay(v);
                    const checkInOnly = bucket(v) === "CHECK_IN";
                    const overdue = v.km_to_next_service <= 0;
                    const due = estimatedDueDate(v);
                    const msg = reminderMessage((cust?.full_name ?? "there").split(" ")[0], v);
                    return (
                      <tr key={v.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>{cust?.full_name ?? "—"}</div>
                          <div className="text-xs text-stone-500">{cust?.phone ?? "no phone on file"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{v.plate_number}</div>
                          <div className="text-xs text-stone-500">{v.year} {v.make} {v.model}</div>
                        </td>
                        <td className="px-4 py-3">
                          {checkInOnly ? (
                            <div className="font-semibold text-sky-700">3+ months since last visit</div>
                          ) : (
                            <div className={`font-semibold ${overdue ? "text-red-600" : "text-stone-700"}`}>
                              {overdue
                                ? `${Math.abs(v.km_to_next_service).toLocaleString()} km overdue`
                                : `${v.km_to_next_service.toLocaleString()} km left`}
                            </div>
                          )}
                          <div className="text-xs text-stone-500">
                            {v.current_km.toLocaleString()} / {v.next_service_km.toLocaleString()} km
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-stone-500">{due ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text} ${s.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {cust?.phone && (
                              <a
                                href={`tel:${cust.phone}`}
                                title="Call"
                                aria-label={`Call ${cust.full_name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {cust?.phone && (
                              <a
                                href={`sms:${cust.phone}?body=${encodeURIComponent(msg)}`}
                                title="Text reminder"
                                aria-label={`Text reminder to ${cust.full_name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {cust?.email && (
                              <a
                                href={`mailto:${cust.email}?subject=${encodeURIComponent("Your vehicle is due for service — C-Tech Automotive")}&body=${encodeURIComponent(msg)}`}
                                title="Email reminder"
                                aria-label={`Email reminder to ${cust.full_name}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => copyMessage(cust?.full_name ?? "there", v)}
                              title="Copy reminder message"
                              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 hover:bg-stone-100"
                            >
                              Copy
                            </button>
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
    </>
  );
}

function StatCard({
  label, value, tone, active, onClick,
}: { label: string; value: number; tone: "red" | "amber" | "yellow" | "sky"; active: boolean; onClick: () => void }) {
  const toneMap = {
    red: { bg: "rgba(220,38,38,0.10)", text: "#B91C1C" },
    amber: { bg: "rgba(217,119,6,0.12)", text: "#B45309" },
    yellow: { bg: "rgba(202,138,4,0.12)", text: "#A16207" },
    sky: { bg: "rgba(2,132,199,0.12)", text: "#0369A1" },
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-white p-6 text-left transition ${active ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-300"}`}
    >
      <div className="mb-1 text-3xl font-bold" style={{ color: toneMap.text }}>{value}</div>
      <div className="text-sm font-medium text-stone-700">{label}</div>
      <div className="mt-1 text-xs text-stone-500">{active ? "Click to clear filter" : "Click to filter"}</div>
      <div className="mt-3 h-1.5 w-10 rounded-full" style={{ backgroundColor: toneMap.bg }} />
    </button>
  );
}
