import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Download, Wrench } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";
import {
  calculateEstimate,
  peso,
  STATUS_STYLES,
  type Pricing,
  type Vehicle,
} from "@/lib/fleet-utils";

import { BUSINESS } from "@/lib/business";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "Monthly Report — C-Tech Automotive" }] }),
  component: ReportPage,
});

type Client = {
  id: string;
  company_name: string;
  fleet_manager: string;
  tier: string;
  parts_discount: number;
  labor_discount: number;
  payment_terms?: string | null;
};

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";

function ReportPage() {
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
  }, [navigate]);

  const now = new Date();
  const monthYear = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayReadable = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dueVehicles = vehicles.filter((v) => v.service_status !== "OK");
  const partsDiscount = client?.parts_discount ?? 0;
  const rows = dueVehicles.map((v) => ({
    v,
    est: calculateEstimate(v, partsDiscount, pricing),
  }));
  const total = rows.reduce((s, r) => s + r.est, 0);

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
        vehicleCount={vehicles.length}
      />

      <div className="md:ml-64">
        {/* Top bar — hidden on print */}
        <header className="no-print flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8 print:hidden">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold md:text-2xl" style={{ color: NAVY }}>
              Monthly Report
            </h1>
            <p className="mt-0.5 truncate text-xs text-stone-500 md:text-sm">
              {monthYear}
              {client ? ` · ${client.company_name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative rounded-lg p-2.5 hover:bg-stone-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-stone-600" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white sm:flex-none"
              style={{ backgroundColor: NAVY }}
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl p-4 md:p-8 print:p-0">
          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-white" />
          ) : (
            <div className="report-card overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
              {/* Section 1 — Header */}
              <div
                className="px-8 py-8 text-center text-white"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${NAVY}, #1E3464)`,
                }}
              >
                <div className="mb-4 flex items-center justify-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg"
                    style={{ backgroundColor: GOLD }}
                  >
                    <Wrench className="h-6 w-6 text-white" strokeWidth={2.25} />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-black tracking-tight">
                      C-TECH AUTOMOTIVE
                    </div>
                    <div
                      className="text-[10px] uppercase opacity-70"
                      style={{ letterSpacing: "0.3em" }}
                    >
                      Next-Level Automotive Excellence
                    </div>
                  </div>
                </div>
                <span
                  className="inline-block rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: "rgba(201, 162, 39, 0.2)",
                    color: "#F0D78C",
                    borderColor: "rgba(201, 162, 39, 0.4)",
                  }}
                >
                  Monthly Fleet Service Report
                </span>
                <div className="mt-6 text-2xl font-bold">{monthYear}</div>
                <div className="mt-1 text-sm opacity-80">
                  {client?.company_name ?? "—"}
                </div>
              </div>

              {/* Section 2 — Summary */}
              <div className="grid grid-cols-2 gap-4 border-b border-stone-200 px-4 py-6 text-center md:grid-cols-4 md:px-8">
                <Metric label="Total Units" value={String(vehicles.length)} />
                <Metric label="Discount Tier" value={client?.tier ?? "—"} />
                <Metric
                  label="Payment Terms"
                  value={client?.payment_terms ?? "Net 30"}
                />
                <Metric
                  label="Due This Month"
                  value={String(dueVehicles.length)}
                  gold
                />
              </div>

              {/* Section 3 — Vehicles requiring service */}
              <div className="px-4 py-6 md:px-8">
                <h2 className="mb-4 font-bold" style={{ color: NAVY }}>
                  Vehicles Requiring Service
                </h2>
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-500">
                    All vehicles are on schedule. No service required this
                    month.
                  </div>
                ) : (
                  <div className="-mx-4 overflow-x-auto md:mx-0">
                  <table className="w-full min-w-[560px] px-4 md:min-w-0">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-3 text-[10px] uppercase tracking-wider text-stone-500">
                          Unit
                        </th>
                        <th className="pb-3 text-[10px] uppercase tracking-wider text-stone-500">
                          Vehicle
                        </th>
                        <th className="pb-3 text-[10px] uppercase tracking-wider text-stone-500">
                          Current KM
                        </th>
                        <th className="pb-3 text-[10px] uppercase tracking-wider text-stone-500">
                          Status
                        </th>
                        <th className="pb-3 text-right text-[10px] uppercase tracking-wider text-stone-500">
                          Est. Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {rows.map(({ v, est }) => {
                        const styles = STATUS_STYLES[v.service_status];
                        return (
                          <tr key={v.id} className="py-3 text-sm">
                            <td className="py-3">
                              <span
                                className="font-semibold"
                                style={{ color: NAVY }}
                              >
                                {v.plate_number}
                              </span>
                            </td>
                            <td className="py-3 text-stone-700">
                              {v.make} {v.model}
                            </td>
                            <td className="py-3 text-stone-700">
                              {v.current_km.toLocaleString()}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${styles.text} ${styles.bg} ${styles.border}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                                />
                                {v.service_status}
                              </span>
                            </td>
                            <td
                              className="py-3 text-right font-bold"
                              style={{ color: NAVY }}
                            >
                              {peso(est)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${NAVY}` }}>
                        <td
                          colSpan={4}
                          className="pt-4 text-right font-bold"
                          style={{ color: NAVY }}
                        >
                          Estimated Total (with Tier {client?.tier ?? "—"} fleet
                          discount)
                        </td>
                        <td
                          className="pt-4 text-right text-xl font-bold"
                          style={{ color: NAVY }}
                        >
                          {peso(total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                )}
              </div>

              {/* Section 4 — Notes */}
              <div className="border-t border-stone-200 bg-stone-50 px-4 py-6 md:px-8">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
                  Notes & Recommendations
                </h3>
                <ul className="space-y-2 text-sm text-stone-700">
                  {[
                    "Vehicles marked OVERDUE require immediate scheduling to prevent costly repairs.",
                    "Estimated cost is based on standard PMS. Actual cost may vary based on inspection findings.",
                    `Fleet discount automatically applied per your service agreement (Tier ${client?.tier ?? "—"}: ${client?.parts_discount ?? 0}% parts, ${client?.labor_discount ?? 0}% labor).`,
                    "Schedule directly through this portal or contact your fleet manager.",
                  ].map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span style={{ color: GOLD }}>•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Section 5 — Footer */}
              <div className="border-t border-stone-200 px-8 py-5 text-center text-xs text-stone-500">
                {BUSINESS.name.toUpperCase()} · {BUSINESS.phone1} ·{" "}
                {BUSINESS.email} · {BUSINESS.address} · Prepared {todayReadable}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          .ml-64 { margin-left: 0 !important; }
          body { background: white !important; }
          .report-card {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function Metric({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: gold ? GOLD : NAVY }}
      >
        {value}
      </div>
    </div>
  );
}
