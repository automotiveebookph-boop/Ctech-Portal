import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Car, Clock, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";
import { STATUS_STYLES, type Customer } from "@/lib/fleet-utils";
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

const QUICK_SELECT =
  "id, plate_number, make, model, year, current_km, service_status, last_service_date, customer_id";

function WalkinOverview() {
  const [stats, setStats] = useState({
    customers: 0,
    vehicles: 0,
    pending: 0,
    thisMonth: 0,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [plateQuery, setPlateQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<QuickVehicle[]>([]);
  const [customerMap, setCustomerMap] = useState<Map<string, QuickCustomer>>(new Map());
  const [action, setAction] = useState<QuickAction>({ kind: "none" });

  async function load() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [cu, ve, pe, mo, ap] = await Promise.all([
      supabaseFleet.from("customers").select("id", { count: "exact", head: true }),
      supabaseFleet.from("vehicles").select("id", { count: "exact", head: true }).not("customer_id", "is", null),
      supabaseFleet.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseFleet.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabaseFleet
        .from("appointments")
        .select(`id, preferred_date, preferred_time, service_type, status, created_at,
          customers (full_name, phone),
          vehicles (plate_number, make, model)`)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setStats({
      customers: cu.count ?? 0,
      vehicles: ve.count ?? 0,
      pending: pe.count ?? 0,
      thisMonth: mo.count ?? 0,
    });
    setRows((ap.data ?? []) as unknown as Row[]);
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
            Client Dashboard
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-8 rounded-2xl border-2 p-5 md:p-6" style={{ borderColor: "#C9A227", backgroundColor: "#0F1E3A" }}>
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

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" style={{ color: "#C9A227" }} />}
            iconBg="rgba(201,162,39,0.20)"
            value={loading ? "—" : stats.customers}
            label="Total Customers"
            sub="walk-in clients"
          />
          <StatCard
            icon={<Car className="h-5 w-5" style={{ color: "#0F1E3A" }} />}
            iconBg="rgba(15,30,58,0.15)"
            value={loading ? "—" : stats.vehicles}
            label="Customer Vehicles"
            sub="registered units"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-700" />}
            iconBg="rgba(217,119,6,0.15)"
            value={loading ? "—" : stats.pending}
            label="Pending Bookings"
            sub="awaiting action"
          />
          <StatCard
            icon={<Calendar className="h-5 w-5 text-emerald-700" />}
            iconBg="rgba(5,150,105,0.15)"
            value={loading ? "—" : stats.thisMonth}
            label="This Month"
            sub="new bookings"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 md:px-6">
            <div>
              <div className="font-bold" style={{ color: "#0F1E3A" }}>
                Recent Appointment Requests
              </div>
              <div className="text-xs text-stone-500">Last {rows.length}</div>
            </div>
            <Link
              to="/admin/walkin/appointments"
              className="text-xs font-semibold hover:underline"
              style={{ color: "#0F1E3A" }}
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Customer</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">Service</th>
                  <th className="px-4 py-3 text-left font-bold">Preferred</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No appointments yet.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-xs text-stone-500">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                          {r.customers?.full_name ?? "—"}
                        </div>
                        <div className="text-xs text-stone-500">{r.customers?.phone ?? ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.vehicles?.plate_number ?? "—"}</div>
                        <div className="text-xs text-stone-500">{r.vehicles?.make} {r.vehicles?.model}</div>
                      </td>
                      <td className="px-4 py-3">{r.service_type}</td>
                      <td className="px-4 py-3">
                        <div>{formatDate(r.preferred_date)}</div>
                        <div className="text-xs text-stone-500">{r.preferred_time}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

function StatCard({
  icon, iconBg, value, label, sub,
}: { icon: React.ReactNode; iconBg: string; value: number | string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
      <div className="mb-1 text-3xl font-bold" style={{ color: "#0F1E3A" }}>{value}</div>
      <div className="text-sm font-medium text-stone-700">{label}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </div>
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
