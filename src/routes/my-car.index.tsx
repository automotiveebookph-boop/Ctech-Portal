import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { MyCarTopNav } from "@/components/MyCarTopNav";
import { MyCarFooter } from "@/components/MyCarFooter";
import { peso, type Pricing, type ServiceRecord } from "@/lib/fleet-utils";
import {
  formatDate,
  progressColor,
  statusBadgeClass,
  useMyCarSession,
} from "@/lib/my-car-session";

export const Route = createFileRoute("/my-car/")({
  component: MyCarHome,
});

function MyCarHome() {
  const { loading, customer, vehicle } = useMyCarSession();
  const [recent, setRecent] = useState<ServiceRecord[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  useEffect(() => {
    if (!vehicle?.id) return;
    let cancelled = false;
    (async () => {
      const [histRes, priceRes] = await Promise.all([
        supabaseFleet
          .from("service_history")
          .select("*")
          .eq("vehicle_id", vehicle.id)
          .order("service_date", { ascending: false })
          .limit(3),
        supabaseFleet.from("pricing_reference").select("*"),
      ]);
      if (cancelled) return;
      setRecent((histRes.data ?? []) as ServiceRecord[]);
      setPricing((priceRes.data ?? []) as Pricing[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicle?.id]);

  if (loading || !customer) {
    return (
      <div className="min-h-screen bg-stone-50">
        <MyCarTopNav firstName="" />
        <div className="mx-auto max-w-lg space-y-4 p-6">
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-64 animate-pulse rounded-2xl bg-stone-200" />
        </div>
      </div>
    );
  }

  const firstName = customer.full_name.split(" ")[0];

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-stone-50">
        <MyCarTopNav firstName={firstName} customerId={customer.id} />
        <div className="mx-auto max-w-lg p-6 text-center">
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
            Welcome, {firstName} 👋
          </h1>
          <p className="mt-2 text-stone-600">
            No vehicle is linked to your account yet. Please contact C-Tech.
          </p>
        </div>
      </div>
    );
  }

  const lastKm = vehicle.last_service_km ?? 0;
  const interval = vehicle.pms_interval_km ?? 5000;
  const progressed = Math.max(0, vehicle.current_km - lastKm);
  const pctRaw = interval > 0 ? (progressed / interval) * 100 : 0;
  const pct = Math.min(100, Math.max(0, pctRaw));

  // Estimate cost from pricing
  let codeSuffix = "SS";
  if (vehicle.oil_type?.includes("Fully Synth 5W30")) codeSuffix = "FS-5W30";
  else if (vehicle.oil_type?.toLowerCase().includes("fully")) codeSuffix = "FS";
  const code = `OIL-${vehicle.oil_liters}L-${codeSuffix}`;
  const estimate = pricing.find((p) => p.service_code === code)?.standard_price;

  return (
    <div className="min-h-screen bg-stone-50">
      <MyCarTopNav firstName={firstName} customerId={customer.id} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-stone-50 to-white px-6 py-8 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
          Good day, {firstName}! 👋
        </h1>
        <p className="mt-1 text-stone-500">
          {vehicle.plate_number} · {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
      </section>

      <main className="mx-auto max-w-lg px-4 pb-12">
        {/* Vehicle Status Card */}
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
              {vehicle.plate_number}
            </div>
            <span
              className={`rounded-xl px-4 py-2 text-sm font-bold ${statusBadgeClass(vehicle.service_status)}`}
            >
              {vehicle.service_status}
            </span>
          </div>

          {/* Progress */}
          <div className="mb-5">
            <div className="mb-2 text-xs uppercase tracking-wider text-stone-500">
              Service Progress
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full ${progressColor(pctRaw)} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-stone-500">
              {Math.round(pctRaw)}% to next PMS
            </div>
          </div>

          {/* Stats */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat
              label="Last Service"
              value={`${(vehicle.last_service_km ?? 0).toLocaleString()} km`}
              sub={formatDate(vehicle.last_service_date)}
            />
            <Stat
              label="Next Service"
              value={`${vehicle.next_service_km.toLocaleString()} km`}
            />
            <Stat
              label="KM to Go"
              value={`${vehicle.km_to_next_service.toLocaleString()} km`}
              valueClass={
                vehicle.km_to_next_service <= 0
                  ? "text-red-600"
                  : "text-emerald-600"
              }
            />
          </div>

          {/* Estimated due date */}
          {(() => {
            const avg = vehicle.avg_km_per_month;
            const kmLeft = vehicle.km_to_next_service;
            if (avg && avg > 0 && kmLeft > 0) {
              const monthsLeft = kmLeft / avg;
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + Math.round(monthsLeft * 30.44));
              const label = dueDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
              return (
                <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 border border-amber-100">
                  Est. next service: <span className="font-bold">{label}</span>
                </div>
              );
            }
            return null;
          })()}

          {vehicle.service_status !== "OK" && estimate && (
            <div className="text-center text-sm text-stone-500">
              Estimated service cost: {peso(estimate)}
            </div>
          )}

          {/* Vehicle specs */}
          <div className="mt-4 border-t border-stone-100 pt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {vehicle.vehicle_type && (
              <SpecRow label="Type" value={vehicle.vehicle_type} />
            )}
            {vehicle.engine && (
              <SpecRow label="Engine" value={vehicle.engine} />
            )}
            {vehicle.engine_type && (
              <SpecRow label="Fuel" value={vehicle.engine_type} />
            )}
            <SpecRow label="Oil" value={`${vehicle.oil_type} · ${vehicle.oil_liters}L`} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid grid-cols-2 gap-3">
          <Link
            to="/my-car/book"
            className="rounded-xl py-4 text-center font-bold text-white"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            📅 Book a Service
          </Link>
          <Link
            to="/my-car/history"
            className="rounded-xl border-2 py-4 text-center font-bold"
            style={{ borderColor: "#0F1E3A", color: "#0F1E3A" }}
          >
            📄 Service History
          </Link>
        </div>

        {/* Recent Services */}
        <div>
          <div className="mb-3 font-bold" style={{ color: "#0F1E3A" }}>
            Recent Services
          </div>
          {recent.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
              No services yet. Your first visit will appear here.
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white">
              {recent.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-4 py-3 ${i < recent.length - 1 ? "border-b border-stone-100" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="text-xs text-stone-500">
                      {formatDate(r.service_date)}
                    </div>
                    <div className="truncate text-sm">
                      {r.service_performed}
                    </div>
                  </div>
                  <div className="ml-3 font-bold" style={{ color: "#0F1E3A" }}>
                    {peso(r.total_cost ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-right">
            <Link
              to="/my-car/history"
              className="text-xs font-semibold"
              style={{ color: "#0F1E3A" }}
            >
              View full history →
            </Link>
          </div>
        </div>
      </main>
      <MyCarFooter />
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-stone-400 uppercase tracking-wider" style={{ fontSize: "9px" }}>{label}</span>
      <span className="font-medium text-stone-700 truncate">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-bold ${valueClass ?? ""}`}
        style={valueClass ? undefined : { color: "#0F1E3A" }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-stone-500">{sub}</div>}
    </div>
  );
}
