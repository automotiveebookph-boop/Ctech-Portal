import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/walkin/quotes")({
  component: QuotesPage,
});

type Quote = {
  id: string;
  quote_no: string | null;
  client_name: string | null;
  vehicle_description: string | null;
  plate_number: string | null;
  total_amount: number | null;
  status: string | null;
  effective_status: string | null;
  valid_until: string | null;
  created_at: string | null;
  converted_job_order_id: string | null;
};

const STATUS_ORDER = ["all", "draft", "sent", "approved", "declined", "expired"];
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
};

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function QuotesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/walkin/quotes") return <Outlet />;
  return <QuotesListPage />;
}

function QuotesListPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabaseFleet
      .from("quotes_with_effective_status")
      .select("id, quote_no, client_name, vehicle_description, plate_number, total_amount, status, effective_status, valid_until, created_at, converted_job_order_id")
      .order("created_at", { ascending: false });
    setQuotes((data ?? []) as Quote[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function doDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const { error } = await supabaseFleet.from("quotes").delete().eq("id", deleting.id);
    setBusyDelete(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quotation deleted");
    setDeleting(null);
    load();
  }

  const filtered = useMemo(
    () => (status === "all" ? quotes : quotes.filter((q) => q.effective_status === status)),
    [quotes, status],
  );

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 6 * 86400000;
    const issuedThisWeek = quotes.filter((q) => q.created_at && Date.parse(q.created_at) >= weekAgo).length;
    const approved = quotes.filter((q) => q.effective_status === "approved").length;
    return {
      issuedThisWeek,
      total: quotes.length,
      conversion: quotes.length ? Math.round((approved / quotes.length) * 100) : 0,
      approved,
    };
  }, [quotes]);

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Quotations</h1>
          <p className="mt-0.5 text-sm text-stone-500">{quotes.length} quotations issued</p>
        </div>
        <Link
          to="/admin/walkin/quotes/new"
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Link>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4" style={{ borderColor: "#C9A227" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Issued this week</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "#0F1E3A" }}>{stats.issuedThisWeek}</div>
            <div className="text-xs text-stone-500">of {stats.total} total</div>
          </div>
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Conversion rate</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "#0F1E3A" }}>{stats.conversion}%</div>
            <div className="text-xs text-stone-500">{stats.approved} of {stats.total} approved</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`}
              style={status === s ? { backgroundColor: "#0F1E3A" } : undefined}
            >
              {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Quote no.</th>
                  <th className="px-4 py-3 text-left font-bold">Client</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-right font-bold">Total</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                  <th className="px-4 py-3 text-left font-bold">Valid until</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-500">No quotations found.</td></tr>
                ) : (
                  filtered.map((q) => (
                    <tr key={q.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-mono text-xs">{q.quote_no}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#0F1E3A" }}>{q.client_name || "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{q.vehicle_description || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{peso(q.total_amount ?? 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[q.effective_status ?? "draft"]}`}>
                          {q.effective_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{fmtDate(q.valid_until)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to="/admin/walkin/quotes/$quoteId"
                            params={{ quoteId: q.id }}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold"
                            style={{ backgroundColor: "#0F1E3A", color: "white" }}
                          >
                            View
                          </Link>
                          {!q.converted_job_order_id && (
                            <>
                              <Link
                                to="/admin/walkin/quotes/edit/$quoteId"
                                params={{ quoteId: q.id }}
                                className="text-xs font-semibold hover:underline"
                                style={{ color: "#0F1E3A" }}
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => setDeleting(q)}
                                className="text-xs font-semibold text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold mb-2" style={{ color: "#0F1E3A" }}>Delete Quotation?</h2>
            <p className="text-sm text-stone-600 mb-4">
              <strong>{deleting.quote_no}</strong> for <strong>{deleting.client_name || "this client"}</strong> will be permanently deleted, along with its line items. This can't be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
              <button onClick={doDelete} disabled={busyDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busyDelete ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
