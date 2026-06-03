import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CreditCard,
  Download,
  History as HistoryIcon,
  Search,
  TrendingUp,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Service History — C-Tech Automotive" }] }),
  component: HistoryPage,
});

type ClientInfo = { company_name: string; fleet_manager: string; tier: string };
type VehicleLite = {
  id: string;
  unit_id: string;
  plate_number: string;
  make: string;
  model: string;
};
type Record = {
  id: string;
  vehicle_id?: string | null;
  unit_id?: string | null;
  service_date: string;
  job_order_number?: string | null;
  odometer_km: number;
  service_performed: string;
  parts_cost?: number | null;
  labor_cost?: number | null;
  total_cost?: number | null;
  notes?: string | null;
  technician?: string | null;
};

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";

function HistoryPage() {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [vehicles, setVehicles] = useState<VehicleLite[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  const thisYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [fromDate, setFromDate] = useState(`${thisYear}-01-01`);
  const [toDate, setToDate] = useState(`${thisYear}-12-31`);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabaseFleet.auth.getUser();
      if (!user) return navigate({ to: "/" });

      const { data: roleData } = await supabaseFleet
        .from("user_roles")
        .select("role, client_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!roleData) return navigate({ to: "/" });
      if (roleData.role !== "fleet_manager") return navigate({ to: "/admin" });

      const [c, v] = await Promise.all([
        supabaseFleet
          .from("fleet_clients")
          .select("company_name, fleet_manager, tier")
          .eq("id", roleData.client_id)
          .maybeSingle(),
        supabaseFleet
          .from("vehicles")
          .select("id, unit_id, plate_number, make, model")
          .eq("client_id", roleData.client_id)
          .order("plate_number"),
      ]);
      setClient(c.data as ClientInfo | null);
      const vs = (v.data ?? []) as VehicleLite[];
      setVehicles(vs);

      if (vs.length) {
        const ids = vs.map((x) => x.id);
        const unitIds = vs.map((x) => x.unit_id);
        const [byId, byUnit] = await Promise.all([
          supabaseFleet
            .from("service_history")
            .select("*")
            .in("vehicle_id", ids)
            .order("service_date", { ascending: false }),
          supabaseFleet
            .from("service_history")
            .select("*")
            .in("unit_id", unitIds)
            .order("service_date", { ascending: false }),
        ]);
        const map = new Map<string, Record>();
        for (const r of [...(byId.data ?? []), ...(byUnit.data ?? [])] as Record[]) {
          map.set(r.id, r);
        }
        const merged = Array.from(map.values()).sort((a, b) =>
          a.service_date < b.service_date ? 1 : -1,
        );
        setRecords(merged);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, VehicleLite>();
    for (const v of vehicles) {
      m.set(v.id, v);
      m.set(v.unit_id, v);
    }
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (q) {
        const hay = `${r.service_performed ?? ""} ${r.job_order_number ?? ""} ${r.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (vehicleFilter !== "all") {
        const key = r.vehicle_id ?? r.unit_id ?? "";
        const v = vehicleById.get(key);
        if (!v || v.id !== vehicleFilter) return false;
      }
      if (fromDate && r.service_date < fromDate) return false;
      if (toDate && r.service_date > toDate) return false;
      return true;
    });
  }, [records, search, vehicleFilter, fromDate, toDate, vehicleById]);

  const stats = useMemo(() => {
    const total = records.length;
    const yearCount = records.filter(
      (r) => new Date(r.service_date).getFullYear() === thisYear,
    ).length;
    const spent = records.reduce((s, r) => s + (r.total_cost ?? 0), 0);
    const avg = total ? Math.round(spent / total) : 0;
    return { total, yearCount, spent, avg };
  }, [records, thisYear]);

  const resetFilters = () => {
    setSearch("");
    setVehicleFilter("all");
    setFromDate(`${thisYear}-01-01`);
    setToDate(`${thisYear}-12-31`);
  };

  const exportCsv = () => {
    const rows = [
      ["Date", "Plate", "Vehicle", "JO#", "Service", "Odometer", "Technician", "Parts", "Labor", "Total", "Notes"],
      ...filtered.map((r) => {
        const v = vehicleById.get(r.vehicle_id ?? r.unit_id ?? "");
        return [
          r.service_date,
          v?.plate_number ?? "",
          v ? `${v.make} ${v.model}` : "",
          r.job_order_number ?? "",
          r.service_performed,
          r.odometer_km,
          r.technician ?? "",
          r.parts_cost ?? "",
          r.labor_cost ?? "",
          r.total_cost ?? "",
          (r.notes ?? "").replace(/\n/g, " "),
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <FleetSidebar client={client} vehicleCount={vehicles.length} />
      <main className="md:ml-64">
        {/* Top bar */}
        <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold md:text-2xl" style={{ color: NAVY }}>
              Service History
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 md:text-sm">
              Complete maintenance record for your fleet
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={exportCsv}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white sm:flex-none"
              style={{ backgroundColor: NAVY }}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={<HistoryIcon className="h-5 w-5" style={{ color: NAVY }} />}
              iconBg={`${NAVY}26`}
              number={stats.total.toString()}
              label="Total Services"
              sub="all-time"
            />
            <StatCard
              icon={<Calendar className="h-5 w-5" style={{ color: GOLD }} />}
              iconBg={`${GOLD}33`}
              number={stats.yearCount.toString()}
              label="This Year"
              sub={`${thisYear}`}
            />
            <StatCard
              icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
              iconBg="rgb(16 185 129 / 0.15)"
              number={peso(stats.spent)}
              label="Total Spent"
              sub="all-time investment"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
              iconBg="rgb(245 158 11 / 0.15)"
              number={peso(stats.avg)}
              label="Avg per Service"
              sub="across all PMS"
            />
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 md:flex-row md:flex-wrap md:items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search service description, JO#, tech notes..."
                className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-stone-400 focus:outline-none"
              />
            </div>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} - {v.make} {v.model}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              From:
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-stone-400 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              To:
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-stone-400 focus:outline-none"
              />
            </label>
            <button
              onClick={resetFilters}
              className="text-sm text-stone-600 underline hover:text-stone-900"
            >
              Reset
            </button>
          </div>

          {/* Timeline */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <div className="font-bold" style={{ color: NAVY }}>
                Service Records
              </div>
              <div className="text-xs text-stone-500">
                {filtered.length} of {records.length} records
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-stone-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-stone-500">No service records match your filters.</p>
                <button
                  onClick={resetFilters}
                  className="mt-2 text-sm hover:underline"
                  style={{ color: NAVY }}
                >
                  Reset filters →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filtered.map((r) => {
                  const v = vehicleById.get(r.vehicle_id ?? r.unit_id ?? "");
                  const d = new Date(r.service_date);
                  const mon = d.toLocaleString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div key={r.id} className="px-4 py-5 transition hover:bg-stone-50 md:px-6">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="w-14 flex-shrink-0 md:w-24">
                          <div className="text-sm font-bold" style={{ color: NAVY }}>
                            {mon}
                          </div>
                          <div className="text-xs text-stone-500">{d.getFullYear()}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold">
                              {v?.plate_number ?? "—"}
                            </span>
                            <span className="text-xs text-stone-500">
                              {v ? `${v.make} ${v.model}` : ""}
                            </span>
                            {r.job_order_number && (
                              <span className="text-xs text-stone-400">
                                JO# {r.job_order_number}
                              </span>
                            )}
                          </div>
                          <div className="mb-1 text-sm font-semibold" style={{ color: NAVY }}>
                            {r.service_performed}
                          </div>
                          <div className="text-xs text-stone-500">
                            {r.odometer_km.toLocaleString()} km
                            {r.technician ? ` · Technician: ${r.technician}` : ""}
                          </div>
                          {r.notes && (
                            <div
                              className="mt-2 rounded-md border-l-2 bg-stone-50 px-3 py-2"
                              style={{ borderColor: GOLD }}
                            >
                              <div className="text-xs text-stone-600">
                                Tech notes: {r.notes}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-base font-bold" style={{ color: NAVY }}>
                            {peso(r.total_cost ?? 0)}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            Parts {peso(r.parts_cost ?? 0)}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            Labor {peso(r.labor_cost ?? 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  number,
  label,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  number: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color: NAVY }}>
        {number}
      </div>
      <div className="mt-1 text-sm font-semibold text-stone-700">{label}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}
