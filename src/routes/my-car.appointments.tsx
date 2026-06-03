import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { MyCarTopNav } from "@/components/MyCarTopNav";
import { MyCarFooter } from "@/components/MyCarFooter";
import { formatDate, useMyCarSession } from "@/lib/my-car-session";

export const Route = createFileRoute("/my-car/appointments")({
  component: AppointmentsPage,
});

type Appointment = {
  id: string;
  service_type: string;
  preferred_date: string;
  preferred_time: string;
  notes: string | null;
  admin_notes: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
};

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  pending: {
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    label: "Pending Confirmation",
  },
  confirmed: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Confirmed ✅",
  },
  completed: {
    cls: "bg-stone-50 text-stone-700 border-stone-200",
    label: "Completed",
  },
  cancelled: {
    cls: "bg-stone-50 text-stone-400 border-stone-200",
    label: "Cancelled",
  },
};

function AppointmentsPage() {
  const { loading, customer } = useMyCarSession();
  const [list, setList] = useState<Appointment[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!customer?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabaseFleet
        .from("appointments")
        .select("*")
        .eq("customer_id", customer.id)
        .order("preferred_date", { ascending: false });
      if (cancelled) return;
      setList((data ?? []) as Appointment[]);
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [customer?.id]);

  const firstName = customer?.full_name.split(" ")[0] ?? "";

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <MyCarTopNav firstName="" />
        <div className="mx-auto max-w-2xl p-6">
          <div className="h-40 animate-pulse rounded-xl bg-stone-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <MyCarTopNav firstName={firstName} customerId={customer?.id} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
          My Appointments
        </h1>

        {fetching ? (
          <div className="mt-6 h-40 animate-pulse rounded-xl bg-stone-100" />
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-10 text-center">
            <p className="text-stone-500">No appointments yet.</p>
            <Link
              to="/my-car/book"
              className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: "#0F1E3A" }}
            >
              Book a Service →
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {list.map((a) => {
              const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.pending;
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-stone-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="font-bold"
                      style={{ color: "#0F1E3A" }}
                    >
                      {a.service_type}
                    </div>
                    <span
                      className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold ${style.cls}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {formatDate(a.preferred_date)} · {a.preferred_time}
                  </div>
                  {a.notes && (
                    <div className="mt-2 text-sm italic text-stone-600">
                      "{a.notes}"
                    </div>
                  )}
                  {a.status === "confirmed" && a.admin_notes && (
                    <div
                      className="mt-3 rounded border-l-2 bg-stone-50 px-3 py-2 text-xs text-stone-700"
                      style={{ borderColor: "#C9A227" }}
                    >
                      <strong>Note from C-Tech:</strong> {a.admin_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <MyCarFooter />
    </div>
  );
}
