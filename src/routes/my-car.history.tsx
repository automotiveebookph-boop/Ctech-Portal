import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { MyCarTopNav } from "@/components/MyCarTopNav";
import { MyCarFooter } from "@/components/MyCarFooter";
import { peso, type ServiceRecord } from "@/lib/fleet-utils";
import { formatDate, useMyCarSession } from "@/lib/my-car-session";

export const Route = createFileRoute("/my-car/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { loading, customer, vehicle } = useMyCarSession();
  const [history, setHistory] = useState<ServiceRecord[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!vehicle?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseFleet
        .from("service_history")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("service_date", { ascending: false });
      if (cancelled) return;
      setHistory((data ?? []) as ServiceRecord[]);
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicle?.id]);

  const firstName = customer?.full_name.split(" ")[0] ?? "";

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <MyCarTopNav firstName="" />
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <div className="h-24 animate-pulse rounded-xl bg-stone-200" />
          <div className="h-40 animate-pulse rounded-xl bg-stone-200" />
        </div>
      </div>
    );
  }

  const totalServices = history.length;
  const totalSpent = history.reduce((s, r) => s + (r.total_cost ?? 0), 0);
  const lastDate = history[0]?.service_date;

  return (
    <div className="min-h-screen bg-stone-50">
      <MyCarTopNav firstName={firstName} customerId={customer?.id} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
            Service History
          </h1>
          {vehicle && (
            <p className="mt-1 text-stone-500">
              {vehicle.plate_number} {vehicle.make} {vehicle.model}
            </p>
          )}
        </div>

        <div className="mx-auto mb-6 grid max-w-lg grid-cols-3 gap-4">
          <StatBox label="Total Services" value={String(totalServices)} />
          <StatBox label="Total Spent" value={peso(totalSpent)} />
          <StatBox label="Last Service" value={formatDate(lastDate)} />
        </div>

        {fetching ? (
          <div className="h-40 animate-pulse rounded-xl bg-stone-100" />
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
            No service history yet. Your first PMS at C-Tech will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-stone-500">
                      {formatDate(r.service_date)}
                    </div>
                    {r.job_order_number && (
                      <div className="font-mono text-xs text-stone-400">
                        JO# {r.job_order_number}
                      </div>
                    )}
                  </div>
                  <div className="font-bold" style={{ color: "#0F1E3A" }}>
                    {peso(r.total_cost ?? 0)}
                  </div>
                </div>
                <div
                  className="mt-1 font-semibold"
                  style={{ color: "#0F1E3A" }}
                >
                  {r.service_performed}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {(r.odometer_km ?? 0).toLocaleString()} km
                </div>
                {r.notes && (
                  <div
                    className="mt-2 rounded border-l-2 bg-stone-50 px-3 py-2 text-xs text-stone-600"
                    style={{ borderColor: "#C9A227" }}
                  >
                    Tech notes: {r.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <MyCarFooter />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold" style={{ color: "#0F1E3A" }}>
        {value}
      </div>
    </div>
  );
}
