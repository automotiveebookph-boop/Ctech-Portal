import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, CalendarClock, Car, CheckCircle2, Clock, TrendingUp, Users } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { AdminSidebar } from "@/components/AdminSidebar";
import {
  calculateEstimate,
  peso,
  type Pricing,
  type Vehicle,
} from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Fleet Admin — C-Tech Automotive" }] }),
  component: AdminLayout,
});

type Client = {
  id: string;
  client_code: string;
  company_name: string;
  fleet_manager: string;
  email: string;
  contact_number: string | null;
  tier: string;
  parts_discount: number;
  labor_discount: number;
  payment_terms: string;
  status: string;
  notes: string | null;
  created_at: string;
};

function AdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [authorized, setAuthorized] = useState(false);

  // /admin/select and /admin/walkin manage their own auth + chrome.
  const isOwnChrome =
    pathname === "/admin/select" ||
    pathname === "/admin/walkin" ||
    pathname.startsWith("/admin/walkin/");

  useEffect(() => {
    if (isOwnChrome) return;
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) return navigate({ to: "/" });
      setEmail(user.email ?? "");
      const { data: role } = await supabaseFleet
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!role || role.role !== "admin") {
        if (role?.role === "customer") navigate({ to: "/my-car" });
        else if (role?.role === "fleet_manager") navigate({ to: "/dashboard" });
        else navigate({ to: "/" });
        return;
      }
      setAuthorized(true);
    })();
  }, [navigate, isOwnChrome]);

  if (isOwnChrome) {
    return <Outlet />;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-stone-50">
        <AdminSidebar email={email} />
        <div className="p-4 pt-16 md:ml-64 md:p-8 md:pt-8">
          <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        </div>
      </div>
    );
  }

  // Sub-route /admin/clients renders via Outlet
  if (pathname !== "/admin") {
    return (
      <div className="min-h-screen bg-stone-50">
        <AdminSidebar email={email} />
        <div className="md:ml-64">
          <Outlet />
        </div>
      </div>
    );
  }

  return <AdminOverview email={email} />;
}

function AdminOverview({ email }: { email: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [apptToday, setApptToday] = useState(0);
  const [apptWeek, setApptWeek] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [clientsRes, vehiclesRes, pricingRes, apptPending, apptTodayRes, apptWeekRes, revenueRes] =
        await Promise.all([
          supabaseFleet.from("fleet_clients").select("*").order("created_at", { ascending: false }),
          supabaseFleet.from("vehicle_status_view").select("*"),
          supabaseFleet.from("pricing_reference").select("*"),
          supabaseFleet.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabaseFleet.from("appointments").select("id", { count: "exact", head: true }).eq("preferred_date", todayStr).neq("status", "cancelled"),
          supabaseFleet.from("appointments").select("id", { count: "exact", head: true }).gte("preferred_date", todayStr).lte("preferred_date", weekEndStr).neq("status", "cancelled"),
          supabaseFleet.from("service_history").select("total_cost").gte("service_date", monthStart),
        ]);

      setClients((clientsRes.data ?? []) as Client[]);
      setVehicles((vehiclesRes.data ?? []) as Vehicle[]);
      setPricing((pricingRes.data ?? []) as Pricing[]);
      setPendingBookings(apptPending.count ?? 0);
      setApptToday(apptTodayRes.count ?? 0);
      setApptWeek(apptWeekRes.count ?? 0);
      setRevenueMonth((revenueRes.data ?? []).reduce((s, r) => s + (r.total_cost ?? 0), 0));
      setLoading(false);
    })();
  }, []);

  const activeClients = clients.filter((c) => c.status === "Active").length;
  const totalVehicles = vehicles.length;
  const dueCount = vehicles.filter((v) => v.service_status !== "OK").length;

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const vehiclesByClient = new Map<string, Vehicle[]>();
  for (const v of vehicles) {
    const arr = vehiclesByClient.get(v.client_id) ?? [];
    arr.push(v);
    vehiclesByClient.set(v.client_id, arr);
  }

  const monthlyRevenue = vehicles
    .filter((v) => v.service_status !== "OK")
    .reduce((sum, v) => {
      const c = clientById.get(v.client_id);
      const discount = c?.parts_discount ?? 0;
      return sum + calculateEstimate(v, discount, pricing);
    }, 0);

  const topClients = clients.slice(0, 5);

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminSidebar email={email} />
      <div className="md:ml-64">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-bold uppercase tracking-wider md:text-xs"
              style={{ color: "#C9A227" }}
            >
              C-Tech Staff View
            </div>
            <h1 className="truncate text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
              Fleet Operations Overview
            </h1>
          </div>
          <button className="ml-2 rounded-lg p-2.5 hover:bg-stone-100" aria-label="Notifications">
            <Bell className="h-5 w-5 text-stone-600" />
          </button>
        </header>

        <main className="p-4 md:p-8">
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              icon={<CalendarCheck className="h-5 w-5 text-amber-700" />}
              iconBg="rgba(217,119,6,0.15)"
              value={loading ? "—" : pendingBookings}
              label="Pending Bookings"
              sub="awaiting confirmation"
            />
            <StatCard
              icon={<CalendarClock className="h-5 w-5 text-sky-600" />}
              iconBg="rgba(2,132,199,0.15)"
              value={loading ? "—" : apptToday}
              label="Appointments Today"
              sub="scheduled for today"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              iconBg="rgba(5,150,105,0.15)"
              value={loading ? "—" : apptWeek}
              label="This Week"
              sub="next 7 days"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" style={{ color: "#D97706" }} />}
              iconBg="rgba(217,119,6,0.15)"
              value={loading ? "—" : dueCount}
              label="Fleet Services Due"
              sub="needs attention"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" style={{ color: "#059669" }} />}
              iconBg="rgba(5,150,105,0.15)"
              value={loading ? "—" : peso(revenueMonth)}
              label="Revenue This Month"
              sub="from completed services"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 md:px-6">
              <div>
                <div className="font-bold" style={{ color: "#0F1E3A" }}>
                  All Fleet Clients
                </div>
                <div className="text-xs text-stone-500">{clients.length} clients</div>
              </div>
              <Link
                to="/admin/clients"
                className="text-xs font-semibold hover:underline"
                style={{ color: "#0F1E3A" }}
              >
                View all →
              </Link>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-6 py-3 text-left font-bold">Client</th>
                  <th className="px-6 py-3 text-left font-bold">Vehicles</th>
                  <th className="px-6 py-3 text-left font-bold">Tier</th>
                  <th className="px-6 py-3 text-left font-bold">Status</th>
                  <th className="px-6 py-3 text-right font-bold">This Month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-stone-500">
                      Loading…
                    </td>
                  </tr>
                ) : topClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-stone-500">
                      No clients yet
                    </td>
                  </tr>
                ) : (
                  topClients.map((c) => {
                    const vs = vehiclesByClient.get(c.id) ?? [];
                    const due = vs.filter((v) => v.service_status !== "OK");
                    const est = due.reduce(
                      (s, v) => s + calculateEstimate(v, c.parts_discount, pricing),
                      0,
                    );
                    return (
                      <tr
                        key={c.id}
                        onClick={() => (window.location.href = "/admin/clients")}
                        className="cursor-pointer transition hover:bg-stone-50"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                            {c.company_name}
                          </div>
                          <div className="text-xs text-stone-500">{c.fleet_manager}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold">{vs.length}</td>
                        <td className="px-6 py-4">
                          <TierBadge tier={c.tier} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {est > 0 ? (
                            <span className="font-bold" style={{ color: "#0F1E3A" }}>
                              {peso(est)}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
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
      </div>
    </div>
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

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
    >
      TIER {tier}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Prospect: "bg-amber-50 text-amber-800 border-amber-200",
    Inactive: "bg-stone-100 text-stone-600 border-stone-200",
  };
  const cls = map[status] ?? map.Inactive;
  return (
    <span
      className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {status}
    </span>
  );
}
