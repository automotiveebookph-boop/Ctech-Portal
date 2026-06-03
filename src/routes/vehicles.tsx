import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Download } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";
import {
  calculateEstimate,
  peso,
  STATUS_STYLES,
  type Pricing,
  type Vehicle,
} from "@/lib/fleet-utils";

type FilterKey = "ALL" | "OVERDUE" | "DUE NOW" | "DUE SOON" | "OK";

export const Route = createFileRoute("/vehicles")({
  head: () => ({ meta: [{ title: "My Vehicles — C-Tech Automotive" }] }),
  validateSearch: (search: Record<string, unknown>): { filter?: FilterKey } => {
    const f = search.filter as string | undefined;
    const allowed: FilterKey[] = ["ALL", "OVERDUE", "DUE NOW", "DUE SOON", "OK"];
    return { filter: allowed.includes(f as FilterKey) ? (f as FilterKey) : undefined };
  },
  component: VehiclesPage,
});

type Client = {
  id: string;
  company_name: string;
  fleet_manager: string;
  tier: string;
  parts_discount: number;
  labor_discount: number;
};

function VehiclesPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetailRoute = pathname !== "/vehicles";
  const { filter: filterParam } = Route.useSearch();
  const filter: FilterKey = filterParam ?? "ALL";

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  useEffect(() => {
    if (isDetailRoute) return;

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
        navigate({ to: "/admin" });
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
          .eq("client_id", roleData.client_id)
          .order("km_to_next_service", { ascending: true }),
        supabaseFleet.from("pricing_reference").select("*"),
      ]);

      setClient(clientRes.data as Client | null);
      setVehicles((vehiclesRes.data ?? []) as Vehicle[]);
      setPricing((pricingRes.data ?? []) as Pricing[]);
      setLoading(false);
    })();
  }, [isDetailRoute, navigate]);

  if (isDetailRoute) {
    return <Outlet />;
  }

  const total = vehicles.length;
  const counts = {
    ALL: total,
    OVERDUE: vehicles.filter((v) => v.service_status === "OVERDUE").length,
    "DUE NOW": vehicles.filter((v) => v.service_status === "DUE NOW").length,
    "DUE SOON": vehicles.filter((v) => v.service_status === "DUE SOON").length,
    OK: vehicles.filter((v) => v.service_status === "OK").length,
  };

  const filtered =
    filter === "ALL"
      ? vehicles
      : vehicles.filter((v) => v.service_status === filter);

  const setFilter = (f: FilterKey) => {
    navigate({
      to: "/vehicles",
      search: f === "ALL" ? {} : { filter: f },
    });
  };

  const pills: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: "All Vehicles" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "DUE NOW", label: "Due Now" },
    { key: "DUE SOON", label: "Due Soon" },
    { key: "OK", label: "On Schedule" },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <FleetSidebar
        client={
          client
            ? {
                company_name: client.company_name,
                fleet_manager: client.fleet_manager,
                tier: client.tier,
              }
            : null
        }
        vehicleCount={total}
      />

      <div className="md:ml-64">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
              My Vehicles
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 md:text-sm">
              {total} unit{total === 1 ? "" : "s"} enrolled
            </p>
          </div>
          <div className="ml-2 flex items-center gap-2">
            <button
              type="button"
              className="relative rounded-lg p-2.5 hover:bg-stone-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-stone-600" />
            </button>
            <button
              type="button"
              onClick={() => console.log("Export list", filtered)}
              className="hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white sm:flex"
              style={{ backgroundColor: "#0F1E3A" }}
            >
              <Download className="h-4 w-4" />
              Export List
            </button>
            <button
              type="button"
              onClick={() => console.log("Export list", filtered)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white sm:hidden"
              style={{ backgroundColor: "#0F1E3A" }}
              aria-label="Export List"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8">
          {/* Filter pills */}
          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
            {pills.map((p) => {
              const active = filter === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFilter(p.key)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "text-white shadow-md"
                      : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                  }`}
                  style={active ? { backgroundColor: "#0F1E3A" } : undefined}
                >
                  {p.label} ({counts[p.key]})
                </button>
              );
            })}
          </div>

          {/* Table / list */}
          {loading ? (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse border-b border-stone-100 bg-stone-50 last:border-0"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-16 text-center">
              <p className="text-stone-500">No vehicles in this category</p>
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className="mt-3 text-sm font-semibold hover:underline"
                style={{ color: "#0F1E3A" }}
              >
                Show all vehicles →
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white md:block">
                <table className="w-full">
                  <thead className="border-b border-stone-200 bg-stone-50">
                    <tr>
                      <Th>Unit</Th>
                      <Th>Vehicle</Th>
                      <Th>Current KM</Th>
                      <Th>Next Service</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Estimate</Th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((v) => {
                      const styles = STATUS_STYLES[v.service_status];
                      const est =
                        v.service_status === "OK"
                          ? 0
                          : calculateEstimate(
                              v,
                              client?.parts_discount ?? 0,
                              pricing,
                            );
                      const interval = v.pms_interval_km ?? 0;
                      const last = v.last_service_km ?? 0;
                      const progress = interval
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              ((v.current_km - last) / interval) * 100,
                            ),
                          )
                        : 0;
                      const barColor =
                        progress >= 100
                          ? "bg-red-600"
                          : progress >= 90
                            ? "bg-amber-600"
                            : progress >= 70
                              ? "bg-yellow-500"
                              : "bg-emerald-600";

                      return (
                        <tr
                          key={v.id}
                          onClick={() =>
                            navigate({
                              to: "/vehicles/$unitId",
                              params: { unitId: v.unit_id },
                            })
                          }
                          className="cursor-pointer transition hover:bg-stone-50"
                        >
                          <td className="px-6 py-4">
                            <div
                              className="text-sm font-semibold"
                              style={{ color: "#0F1E3A" }}
                            >
                              {v.plate_number}
                            </div>
                            <div className="text-xs text-stone-500">
                              {v.unit_id}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-stone-900">
                              {v.make} {v.model}
                            </div>
                            <div className="text-xs text-stone-500">
                              {[v.year, v.vehicle_type, v.engine]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-stone-900">
                              {v.current_km.toLocaleString()}
                            </div>
                            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
                              <div
                                className={`h-full ${barColor}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-stone-900">
                              {v.next_service_km.toLocaleString()} km
                            </div>
                            {v.km_to_next_service > 0 ? (
                              <div className="text-xs text-stone-500">
                                {v.km_to_next_service.toLocaleString()} km away
                              </div>
                            ) : (
                              <div className="text-xs text-red-600">
                                {Math.abs(v.km_to_next_service).toLocaleString()} km over
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold ${styles.text} ${styles.bg} ${styles.border}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                              />
                              {v.service_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {v.service_status !== "OK" ? (
                              <>
                                <div
                                  className="text-sm font-bold"
                                  style={{ color: "#0F1E3A" }}
                                >
                                  {peso(est)}
                                </div>
                                <div className="text-[10px] text-stone-500">
                                  w/ Tier {client?.tier}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-stone-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ChevronRight className="inline h-4 w-4 text-stone-400" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((v) => {
                  const styles = STATUS_STYLES[v.service_status];
                  const est =
                    v.service_status === "OK"
                      ? 0
                      : calculateEstimate(
                          v,
                          client?.parts_discount ?? 0,
                          pricing,
                        );
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/vehicles/$unitId",
                          params: { unitId: v.unit_id },
                        })
                      }
                      className="w-full rounded-xl border border-stone-200 bg-white p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className="text-sm font-bold"
                            style={{ color: "#0F1E3A" }}
                          >
                            {v.plate_number}
                          </div>
                          <div className="text-xs text-stone-500">
                            {v.make} {v.model} · {v.year}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold ${styles.text} ${styles.bg} ${styles.border}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                          />
                          {v.service_status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                        <span>
                          {v.current_km.toLocaleString()} km · Next{" "}
                          {v.next_service_km.toLocaleString()}
                        </span>
                        {v.service_status !== "OK" && (
                          <span
                            className="text-sm font-bold"
                            style={{ color: "#0F1E3A" }}
                          >
                            {peso(est)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500 ${className}`}
    >
      {children}
    </th>
  );
}
