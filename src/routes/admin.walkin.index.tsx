import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Car, Clock, Users } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";

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

function WalkinOverview() {
  const [stats, setStats] = useState({
    customers: 0,
    vehicles: 0,
    pending: 0,
    thisMonth: 0,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Walk-in Panel
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Walk-in Operations
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8">
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
