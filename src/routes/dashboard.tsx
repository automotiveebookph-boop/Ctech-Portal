import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  Facebook,
  FileText,
  Mail,
  MapPin,
  Phone,
  TrendingUp,
  User,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";
import { BUSINESS } from "@/lib/business";
import {
  calculateEstimate,
  peso,
  STATUS_STYLES,
  type Pricing,
  type Vehicle,
} from "@/lib/fleet-utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Fleet Dashboard — C-Tech Automotive" }] }),
  component: DashboardPage,
});

type Client = {
  id: string;
  company_name: string;
  fleet_manager: string;
  tier: string;
  parts_discount: number;
  labor_discount: number;
  payment_terms: string;
  created_at: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabaseFleet.auth.getUser();
      if (!user) {
        navigate({ to: "/" });
        return;
      }
      const { data: roleData } = await supabaseFleet
        .from("user_roles")
        .select("role, client_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!roleData) {
        navigate({ to: "/" });
        return;
      }
      if (roleData.role !== "fleet_manager") {
        if (roleData.role === "admin") navigate({ to: "/admin/select" });
        else if (roleData.role === "customer") navigate({ to: "/my-car" });
        else navigate({ to: "/" });
        return;
      }

      const [clientRes, vehiclesRes, pricingRes] = await Promise.all([
        supabaseFleet
          .from("fleet_clients")
          .select("*")
          .eq("id", roleData.client_id)
          .maybeSingle(),
        supabaseFleet
          .from("vehicle_status_view")
          .select("*")
          .eq("client_id", roleData.client_id),
        supabaseFleet.from("pricing_reference").select("*"),
      ]);

      setClient(clientRes.data as Client | null);
      setVehicles((vehiclesRes.data ?? []) as Vehicle[]);
      setPricing((pricingRes.data ?? []) as Pricing[]);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading || !client) {
    return (
      <div className="min-h-screen bg-stone-50">
        <FleetSidebar />
        <div className="p-4 pt-16 md:ml-64 md:p-8 md:pt-8">
          <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-stone-100"
              />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-96 animate-pulse rounded-xl bg-stone-100 lg:col-span-2" />
            <div className="h-96 animate-pulse rounded-xl bg-stone-100" />
          </div>
        </div>
      </div>
    );
  }

  const firstName = client.fleet_manager.split(" ")[0];
  const total = vehicles.length;
  const ok = vehicles.filter((v) => v.service_status === "OK").length;
  const dueSoon = vehicles.filter((v) => v.service_status === "DUE SOON").length;
  const dueNow = vehicles.filter((v) => v.service_status === "DUE NOW").length;
  const dueThisMonth = dueSoon + dueNow;
  const overdue = vehicles.filter((v) => v.service_status === "OVERDUE").length;

  const needsService = vehicles
    .filter((v) => v.service_status !== "OK")
    .sort((a, b) => a.km_to_next_service - b.km_to_next_service);

  const monthEstimate = needsService.reduce(
    (sum, v) => sum + calculateEstimate(v, client.parts_discount, pricing),
    0,
  );

  const clientSince = new Date(client.created_at).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <FleetSidebar
        client={{
          company_name: client.company_name,
          fleet_manager: client.fleet_manager,
          tier: client.tier,
        }}
        vehicleCount={total}
      />

      <div className="md:ml-64">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-lg font-bold md:text-2xl"
              style={{ color: "#0F1E3A" }}
            >
              Good day, {firstName}.
            </h1>
            <p className="mt-0.5 line-clamp-2 text-xs text-stone-500 md:text-sm">
              Here's how {client.company_name}'s fleet is doing today.
            </p>
          </div>
          <button
            type="button"
            className="relative ml-2 rounded-lg p-2.5 hover:bg-stone-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-stone-600" />
            {overdue > 0 && (
              <span
                className="absolute right-2 top-2 h-2 w-2 rounded-full"
                style={{ backgroundColor: "#C9A227" }}
              />
            )}
          </button>
        </header>

        <main className="p-4 md:p-8">
          {/* Overdue banner */}
          {overdue > 0 && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-red-900">
                  {overdue} vehicle{overdue === 1 ? "" : "s"} overdue for service
                </div>
                <p className="mt-0.5 text-sm text-red-700">
                  Delaying service can lead to expensive repairs and lost
                  warranty. Schedule immediately.
                </p>
              </div>
              <a
                href="/vehicles?filter=OVERDUE"
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Review →
              </a>
            </div>
          )}

          {/* Stat cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={<Car className="h-5 w-5" style={{ color: "#0F1E3A" }} />}
              iconBg="rgba(15,30,58,0.15)"
              value={total}
              label="Total Fleet"
              sub="vehicles enrolled"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" style={{ color: "#059669" }} />}
              iconBg="rgba(5,150,105,0.15)"
              value={ok}
              label="On Schedule"
              sub="no action needed"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" style={{ color: "#D97706" }} />}
              iconBg="rgba(217,119,6,0.15)"
              value={dueThisMonth}
              label="Due This Month"
              sub={`${dueSoon} soon · ${dueNow} now`}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" style={{ color: "#DC2626" }} />}
              iconBg="rgba(220,38,38,0.15)"
              value={overdue}
              label="Overdue"
              sub={overdue > 0 ? "requires attention" : "all caught up"}
            />
          </div>

          {/* Two-column */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Due This Month */}
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white lg:col-span-2">
              <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
                <div>
                  <div
                    className="text-base font-bold"
                    style={{ color: "#0F1E3A" }}
                  >
                    Due This Month
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {needsService.length} vehicle
                    {needsService.length === 1 ? "" : "s"} need attention
                  </div>
                </div>
                <Link
                  to="/report"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#0F1E3A" }}
                >
                  View full report →
                </Link>
              </div>

              {needsService.length === 0 ? (
                <div className="p-10 text-center text-sm text-stone-500">
                  {total === 0
                    ? "No vehicles enrolled yet. Contact your fleet manager to add vehicles."
                    : "All vehicles are on schedule. 🎉"}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-stone-100">
                    {needsService.map((v) => {
                      const styles = STATUS_STYLES[v.service_status];
                      const est = calculateEstimate(
                        v,
                        client.parts_discount,
                        pricing,
                      );
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() =>
                            navigate({ to: "/vehicles" })
                          }
                          className="flex w-full cursor-pointer items-center gap-4 px-6 py-4 text-left transition hover:bg-stone-50"
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-2">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: "#0F1E3A" }}
                              >
                                {v.plate_number}
                              </span>
                              <span className="text-xs text-stone-500">·</span>
                              <span className="text-sm text-stone-700">
                                {v.make} {v.model}
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs text-stone-500">
                              <span>
                                {v.current_km.toLocaleString()} km
                              </span>
                              <span>·</span>
                              <span>
                                Next: {v.next_service_km.toLocaleString()} km
                              </span>
                            </div>
                          </div>
                          <span
                            className={`rounded-md border px-2.5 py-1 text-[10px] font-bold ${styles.text} ${styles.bg} ${styles.border}`}
                          >
                            {v.service_status}
                          </span>
                          <div className="text-right">
                            <div
                              className="text-sm font-bold"
                              style={{ color: "#0F1E3A" }}
                            >
                              {peso(est)}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              est. (Tier {client.tier})
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-stone-400" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-6 py-4">
                    <div className="text-sm text-stone-700">
                      Estimated total this month:{" "}
                      <span
                        className="font-bold"
                        style={{ color: "#0F1E3A" }}
                      >
                        {peso(monthEstimate)}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500">
                      Fleet discount applied · Tier {client.tier} (
                      {client.parts_discount}% parts / {client.labor_discount}%
                      labor)
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6 lg:col-span-1">
              {/* Your Account */}
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="border-b border-stone-200 px-6 py-4">
                  <div
                    className="text-base font-bold"
                    style={{ color: "#0F1E3A" }}
                  >
                    Your Account
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <AccountRow
                    icon={<Building2 className="h-4 w-4" style={{ color: "#0F1E3A" }} />}
                    iconBg="rgba(15,30,58,0.10)"
                    label="Company"
                    value={client.company_name}
                  />
                  <AccountRow
                    icon={<TrendingUp className="h-4 w-4" style={{ color: "#C9A227" }} />}
                    iconBg="rgba(201,162,39,0.20)"
                    label="Discount Tier"
                    value={`Tier ${client.tier} · ${client.parts_discount}% / ${client.labor_discount}%`}
                  />
                  <AccountRow
                    icon={<FileText className="h-4 w-4" style={{ color: "#059669" }} />}
                    iconBg="rgba(5,150,105,0.15)"
                    label="Payment Terms"
                    value={client.payment_terms}
                  />
                  <div className="border-t border-stone-100 pt-4">
                    <div className="mb-2 text-xs text-stone-500">
                      Client since {clientSince}
                    </div>
                    <div className="text-xs text-stone-500">
                      Need to upgrade tier? Grow your fleet to unlock better
                      rates.
                    </div>
                  </div>
                </div>
              </div>

              {/* Need Help */}
              <div
                className="rounded-xl p-6 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #0F1E3A 0%, #1E3464 100%)",
                }}
              >
                <div
                  className="mb-2 text-xs uppercase opacity-70"
                  style={{ letterSpacing: "0.12em" }}
                >
                  Need Help?
                </div>
                <div className="mb-3 text-lg font-bold">
                  Talk to your fleet manager
                </div>
                <div className="space-y-2 text-sm opacity-90">
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{BUSINESS.phones}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-all">{BUSINESS.email}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{BUSINESS.address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{BUSINESS.hours}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Fleet Manager: {BUSINESS.fleetManager}</span>
                  </div>
                  <a
                    href={BUSINESS.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 hover:underline"
                  >
                    <Facebook className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{BUSINESS.facebookLabel}</span>
                  </a>
                </div>
              </div>
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
  value: number;
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
      <div
        className="mb-1 text-3xl font-bold"
        style={{ color: "#0F1E3A" }}
      >
        {value}
      </div>
      <div className="text-sm font-medium text-stone-700">{label}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </div>
  );
}

function AccountRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-stone-500">{label}</div>
        <div
          className="truncate text-sm font-semibold"
          style={{ color: "#0F1E3A" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
