import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";
import { isMissedBooking, parseLandingNotes, phoneHref } from "@/lib/booking-notes";
import { needsFollowUp } from "@/lib/quote-outcome";
import { STATUS_STYLES, peso, type Customer } from "@/lib/fleet-utils";
import { CustomerModal } from "@/components/CustomerModal";
import { VehicleQuickModal } from "@/components/VehicleQuickModal";
import { JobOrderModal } from "@/components/JobOrderModal";

export const Route = createFileRoute("/admin/walkin/")({
  component: WalkinOverview,
});

type Row = {
  id: string;
  preferred_date: string;
  preferred_time: string;
  service_type: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  notes: string | null;
  customers: { full_name: string; phone: string | null } | null;
  vehicles: { plate_number: string; make: string; model: string } | null;
};

type QuickVehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  current_km: number;
  service_status: "OK" | "DUE SOON" | "DUE NOW" | "OVERDUE";
  last_service_date: string | null;
  customer_id: string;
};

type QuickCustomer = { id: string; full_name: string; phone: string | null };

type QuickAction =
  | { kind: "none" }
  | { kind: "jobOrder"; vehicle: QuickVehicle }
  | { kind: "newCustomer"; plate: string }
  | { kind: "newVehicle"; plate: string; customer: Customer };

/** YYYY-MM-DD in Manila, offset by n days. */
const manilaDate = (n: number) => new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);

const QUICK_SELECT =
  "id, plate_number, make, model, year, current_km, service_status, last_service_date, customer_id";

function WalkinOverview() {
  const [stats, setStats] = useState({ customers: 0, vehicles: 0, missed: 0 });
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [toConfirm, setToConfirm] = useState<Row[]>([]);
  const [today, setToday] = useState({
    todayCount: 0, tomorrowCount: 0, followUps: 0, followUpValue: 0,
    toCollect: 0, openBills: 0, collected: 0, collectedBreakdown: "",
  });
  const [loading, setLoading] = useState(true);

  const [plateQuery, setPlateQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<QuickVehicle[]>([]);
  const [customerMap, setCustomerMap] = useState<Map<string, QuickCustomer>>(new Map());
  const [action, setAction] = useState<QuickAction>({ kind: "none" });

  // Everything the front desk needs today: bookings, follow-ups, money in and out.
  async function load() {
    const d0 = manilaDate(0), d1 = manilaDate(1);
    const monthAgo = new Date(Date.now() - 31 * 86400000).toISOString();
    const [cu, ve, ap, qu, bi, pa] = await Promise.all([
      supabaseFleet.from("customers").select("id", { count: "exact", head: true }),
      supabaseFleet.from("vehicles").select("id", { count: "exact", head: true }).not("customer_id", "is", null),
      supabaseFleet
        .from("appointments")
        .select(`id, preferred_date, preferred_time, service_type, status, created_at, notes,
          customers (full_name, phone),
          vehicles (plate_number, make, model)`)
        .in("status", ["pending", "confirmed"])
        .order("preferred_date")
        .order("preferred_time"),
      supabaseFleet.from("quotes").select("status, created_at, converted_bill_id, followed_up_at, total_amount").gte("created_at", monthAgo),
      supabaseFleet.from("bills").select("balance").in("status", ["unpaid", "partial"]),
      supabaseFleet.from("bill_payments").select("amount, method").gte("paid_at", `${d0}T00:00:00+08:00`),
    ]);
    const appts = (ap.data ?? []) as unknown as Row[];
    const soon = appts.filter((r) => r.preferred_date === d0 || r.preferred_date === d1);
    setUpcoming(soon);
    setToConfirm(appts.filter((r) => r.status === "pending" && r.preferred_date > d1));
    const quotes = (qu.data ?? []) as { status: string; created_at: string; converted_bill_id: string | null; followed_up_at: string | null; total_amount: number | null }[];
    const due = quotes.filter((q) => needsFollowUp(q));
    const pays = (pa.data ?? []) as { amount: number; method: string }[];
    const byMethod = new Map<string, number>();
    for (const p of pays) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
    const METHOD: Record<string, string> = { cash: "Cash", gcash: "GCash", bank: "Bank", card: "Card" };
    setToday({
      todayCount: soon.filter((r) => r.preferred_date === d0).length,
      tomorrowCount: soon.filter((r) => r.preferred_date === d1).length,
      followUps: due.length,
      followUpValue: due.reduce((s, q) => s + (q.total_amount ?? 0), 0),
      toCollect: (bi.data ?? []).reduce((s, b) => s + Number(b.balance ?? 0), 0),
      openBills: (bi.data ?? []).length,
      collected: pays.reduce((s, p) => s + Number(p.amount), 0),
      collectedBreakdown: [...byMethod].map(([m, v]) => `${METHOD[m] ?? m} ${peso(v)}`).join(" · "),
    });
    setStats({ customers: cu.count ?? 0, vehicles: ve.count ?? 0, missed: appts.filter(isMissedBooking).length });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = plateQuery.trim();
    if (q.length < 2) {
      setMatches([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const { data } = await supabaseFleet
        .from("vehicle_status_view")
        .select(QUICK_SELECT)
        .ilike("plate_number", `%${q}%`)
        .not("customer_id", "is", null)
        .neq("status", "archived")
        .limit(8);
      const list = (data ?? []) as unknown as QuickVehicle[];
      setMatches(list);
      if (list.length) {
        const ids = [...new Set(list.map((v) => v.customer_id))];
        const { data: custs } = await supabaseFleet.from("customers").select("id, full_name, phone").in("id", ids);
        setCustomerMap(new Map((custs ?? []).map((c) => [c.id, c as QuickCustomer])));
      }
      setSearching(false);
      setSearched(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [plateQuery]);

  const showResults = plateQuery.trim().length >= 2;
  const normalizedQuery = useMemo(() => plateQuery.trim().toUpperCase(), [plateQuery]);

  function resetSearch() {
    setPlateQuery("");
    setMatches([]);
    setSearched(false);
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Today · {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric", timeZone: "Asia/Manila" })}
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#C9A227", backgroundColor: "#0F1E3A" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#C9A227" }}>
            Front Desk Quick Search
          </div>
          <h2 className="mb-4 mt-1 text-base font-bold text-white md:text-lg">
            Search a plate number to pull up history and start a job order
          </h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              autoFocus
              value={plateQuery}
              onChange={(e) => setPlateQuery(e.target.value)}
              placeholder="Type plate number… e.g. ABC 1234"
              className="w-full rounded-xl border-0 bg-white py-3.5 pl-12 pr-4 text-base font-semibold tracking-wide text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            />
          </div>

          {showResults && (
            <div className="mt-4 overflow-hidden rounded-xl bg-white">
              {searching ? (
                <div className="px-4 py-6 text-center text-sm text-stone-500">Searching…</div>
              ) : matches.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {matches.map((v) => {
                    const cust = customerMap.get(v.customer_id);
                    const s = STATUS_STYLES[v.service_status];
                    return (
                      <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-[140px]">
                          <div className="font-bold" style={{ color: "#0F1E3A" }}>{v.plate_number}</div>
                          <div className="text-xs text-stone-500">
                            {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                          </div>
                        </div>
                        <div className="min-w-[140px]">
                          <div className="text-sm font-semibold text-stone-700">{cust?.full_name ?? "—"}</div>
                          <div className="text-xs text-stone-500">{cust?.phone ?? ""}</div>
                        </div>
                        <div className="text-xs text-stone-500">
                          Last service: {v.last_service_date ? formatDate(v.last_service_date) : "—"}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text} ${s.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {v.service_status}
                        </span>
                        <div className="flex items-center gap-3">
                          <Link
                            to="/admin/walkin/vehicles/$vehicleId"
                            params={{ vehicleId: v.id }}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: "#0F1E3A" }}
                          >
                            View Profile →
                          </Link>
                          <button
                            onClick={() => setAction({ kind: "jobOrder", vehicle: v })}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold"
                            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                          >
                            Create Job Order
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searched ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div className="text-sm text-stone-600">
                    No vehicle found for <strong>"{normalizedQuery}"</strong>. This looks like a new walk-in.
                  </div>
                  <button
                    onClick={() => setAction({ kind: "newCustomer", plate: normalizedQuery })}
                    className="rounded-lg px-4 py-2 text-xs font-bold"
                    style={{ backgroundColor: "#0F1E3A", color: "white" }}
                  >
                    + Register New Walk-in
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TodayCard
            to="/admin/walkin/appointments"
            tone="navy"
            label="Today"
            value={loading ? "—" : String(today.todayCount)}
            sub={loading ? "" : `booking${today.todayCount === 1 ? "" : "s"} · ${today.tomorrowCount} tomorrow`}
          />
          <TodayCard
            to="/admin/walkin/quotes"
            search={{ filter: "followup" }}
            tone="amber"
            label="To follow up"
            value={loading ? "—" : String(today.followUps)}
            sub={loading ? "" : `quotes · ${peso(today.followUpValue)} waiting`}
          />
          <TodayCard
            to="/admin/walkin/bills"
            tone="red"
            label="To collect"
            value={loading ? "—" : peso(today.toCollect)}
            sub={loading ? "" : `${today.openBills} unpaid / partial bill${today.openBills === 1 ? "" : "s"}`}
          />
          <TodayCard
            to="/admin/walkin/bills"
            tone="green"
            label="Collected today"
            value={loading ? "—" : peso(today.collected)}
            sub={loading ? "" : today.collectedBreakdown || "no payments yet"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <BookingList
            title="Bookings — today & tomorrow"
            empty="No bookings today or tomorrow."
            rows={upcoming}
            loading={loading}
            showDay
          />
          <BookingList
            title="New online bookings to confirm"
            empty="No new bookings waiting. 🎉"
            rows={toConfirm}
            loading={loading}
            footer={
              stats.missed > 0 ? (
                <Link to="/admin/walkin/appointments" className="text-xs font-semibold text-red-600 hover:underline">
                  {stats.missed} older pending bookings with dates already passed →
                </Link>
              ) : null
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
          <Link to="/admin/walkin/customers" className="hover:underline"><strong style={{ color: "#0F1E3A" }}>{stats.customers}</strong> customers</Link>
          <Link to="/admin/walkin/vehicles" className="hover:underline"><strong style={{ color: "#0F1E3A" }}>{stats.vehicles}</strong> vehicles</Link>
          <Link to="/admin/walkin/reminders" className="hover:underline">Service reminders →</Link>
        </div>
      </main>

      {action.kind === "jobOrder" && (
        <JobOrderModal
          vehicles={[{
            id: action.vehicle.id,
            plate_number: action.vehicle.plate_number,
            make: action.vehicle.make,
            model: action.vehicle.model,
            current_km: action.vehicle.current_km,
          }]}
          onClose={() => setAction({ kind: "none" })}
          onSaved={() => {
            setAction({ kind: "none" });
            toast.success("Job order created");
            resetSearch();
            load();
          }}
        />
      )}

      {action.kind === "newCustomer" && (
        <CustomerModal
          initial={null}
          onClose={() => setAction({ kind: "none" })}
          onSaved={(customer) => setAction({ kind: "newVehicle", plate: action.plate, customer })}
        />
      )}

      {action.kind === "newVehicle" && (
        <VehicleQuickModal
          customerId={action.customer.id}
          customerName={action.customer.full_name}
          initialPlate={action.plate}
          onClose={() => setAction({ kind: "none" })}
          onSaved={async (vehicleId) => {
            if (!vehicleId) { setAction({ kind: "none" }); load(); return; }
            const { data } = await supabaseFleet
              .from("vehicle_status_view")
              .select(QUICK_SELECT)
              .eq("id", vehicleId)
              .maybeSingle();
            if (data) setAction({ kind: "jobOrder", vehicle: data as unknown as QuickVehicle });
            else setAction({ kind: "none" });
            load();
          }}
        />
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-stone-100 text-stone-600 border-stone-200",
    cancelled: "bg-stone-50 text-stone-400 border-stone-200",
  };
  return (
    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

const TONE: Record<"navy" | "amber" | "red" | "green", { border: string; bg: string; text: string }> = {
  navy: { border: "#0F1E3A", bg: "#ffffff", text: "#0F1E3A" },
  amber: { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  red: { border: "#FCA5A5", bg: "#FEF2F2", text: "#DC2626" },
  green: { border: "#6EE7B7", bg: "#ECFDF5", text: "#047857" },
};

function TodayCard({ to, search, tone, label, value, sub }: {
  to: "/admin/walkin/appointments" | "/admin/walkin/quotes" | "/admin/walkin/bills";
  search?: Record<string, string>;
  tone: keyof typeof TONE;
  label: string;
  value: string;
  sub: string;
}) {
  const t = TONE[tone];
  return (
    <Link to={to} search={search as never} className="block rounded-xl border-2 p-4 transition hover:shadow-md" style={{ borderColor: t.border, backgroundColor: t.bg }}>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.text }}>{label}</div>
      <div className="mt-1 text-2xl font-bold md:text-3xl" style={{ color: t.text }}>{value}</div>
      <div className="mt-0.5 text-xs text-stone-600">{sub}</div>
    </Link>
  );
}

function BookingList({ title, empty, rows, loading, showDay, footer }: {
  title: string;
  empty: string;
  rows: Row[];
  loading: boolean;
  showDay?: boolean;
  footer?: React.ReactNode;
}) {
  const todayStr = manilaDate(0);
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <div className="font-bold" style={{ color: "#0F1E3A" }}>{title}</div>
        <Link to="/admin/walkin/appointments" className="text-xs font-semibold hover:underline" style={{ color: "#0F1E3A" }}>All →</Link>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-stone-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-stone-500">{empty}</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {rows.map((r) => {
            const landing = parseLandingNotes(r.notes);
            const name = r.customers?.full_name ?? landing?.name ?? "—";
            const phone = r.customers?.phone ?? landing?.contact ?? null;
            const car = r.vehicles ? `${r.vehicles.plate_number} · ${r.vehicles.make} ${r.vehicles.model}` : landing?.vehicle ?? "";
            const tel = phoneHref(phone);
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: "#0F1E3A" }}>{name}</div>
                  <div className="truncate text-sm text-stone-600">{car}</div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {r.service_type} ·{" "}
                    {showDay ? (r.preferred_date === todayStr ? "Today" : "Tomorrow") : formatDate(r.preferred_date)}, {r.preferred_time}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusPill status={r.status} />
                  {tel && (
                    <div className="flex gap-1.5">
                      <a href={`tel:${tel}`} className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"><Phone className="h-3 w-3" /> Call</a>
                      <a href={`sms:${tel}`} className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100"><MessageSquare className="h-3 w-3" /> Text</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {footer && <div className="border-t border-stone-100 px-4 py-2.5">{footer}</div>}
    </div>
  );
}
