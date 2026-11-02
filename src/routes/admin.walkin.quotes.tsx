import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { publicQuoteUrl } from "@/lib/quotation-message";
import { needsFollowUp, OUTCOME_LABEL, OUTCOME_STYLE, outcomeOf, type Outcome } from "@/lib/quote-outcome";
import { SendQuotationModal } from "@/components/SendQuotationModal";

export const Route = createFileRoute("/admin/walkin/quotes")({
  // ?filter=followup opens the list on the follow-up tab (linked from the Today overview).
  validateSearch: (s: Record<string, unknown>): { filter?: string } => (typeof s.filter === "string" ? { filter: s.filter } : {}),
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
  converted_bill_id: string | null;
  outcome_reason: string | null;
  followed_up_at: string | null;
};

type Filter = "all" | "followup" | Outcome;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "followup", label: "Follow up" },
  { value: "waiting", label: "Waiting" },
  { value: "pushed", label: "Pushed through" },
  { value: "not_pushed", label: "Didn't push through" },
];

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
const daysAgo = (s: string | null) => (s ? Math.floor((Date.now() - Date.parse(s)) / 86400000) : 0);

function QuotesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/walkin/quotes") return <Outlet />;
  return <QuotesListPage />;
}

function QuotesListPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const initialFilter = Route.useSearch().filter;
  const [filter, setFilter] = useState<Filter>(FILTERS.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : "all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [followUp, setFollowUp] = useState<Quote | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabaseFleet
      .from("quotes_with_effective_status")
      .select("id, quote_no, client_name, vehicle_description, plate_number, total_amount, status, effective_status, valid_until, created_at, converted_job_order_id, converted_bill_id, outcome_reason, followed_up_at")
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

  async function markFollowedUp(q: Quote) {
    const { error } = await supabaseFleet
      .from("quotes")
      .update({ followed_up_at: new Date().toISOString(), ...(q.status === "draft" ? { status: "sent" } : {}) })
      .eq("id", q.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const followUpCount = useMemo(() => quotes.filter((q) => needsFollowUp(q)).length, [quotes]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (filter === "followup" ? !needsFollowUp(q) : filter !== "all" && outcomeOf(q) !== filter) return false;
      if (!s) return true;
      return [q.quote_no, q.client_name, q.vehicle_description, q.plate_number].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [quotes, filter, search]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 6 * 86400000;
    const monthAgo = Date.now() - 30 * 86400000;
    const recent = quotes.filter((q) => q.created_at && Date.parse(q.created_at) >= monthAgo);
    const pushed = recent.filter((q) => outcomeOf(q) === "pushed");
    const waiting = recent.filter((q) => outcomeOf(q) === "waiting");
    return {
      issuedThisWeek: quotes.filter((q) => q.created_at && Date.parse(q.created_at) >= weekAgo).length,
      total: quotes.length,
      recent: recent.length,
      pushed: pushed.length,
      pushedValue: pushed.reduce((s, q) => s + (q.total_amount ?? 0), 0),
      waitingValue: waiting.reduce((s, q) => s + (q.total_amount ?? 0), 0),
    };
  }, [quotes]);

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
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
        <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4" style={{ borderColor: "#C9A227" }}>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Issued this week</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "#0F1E3A" }}>{stats.issuedThisWeek}</div>
            <div className="text-xs text-stone-500">of {stats.total} total</div>
          </div>
          <button onClick={() => setFilter("followup")} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">To follow up</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{followUpCount}</div>
            <div className="text-xs text-amber-700/80">waiting 2+ days, tap to see</div>
          </button>
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Still waiting (30 days)</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "#0F1E3A" }}>{peso(stats.waitingValue)}</div>
            <div className="text-xs text-stone-500">quoted, no answer yet</div>
          </div>
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Pushed through (30 days)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{peso(stats.pushedValue)}</div>
            <div className="text-xs text-stone-500">{stats.pushed} of {stats.recent} quotes</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, vehicle, plate, quote no…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === f.value ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`}
                style={filter === f.value ? { backgroundColor: "#0F1E3A" } : undefined}
              >
                {f.label}{f.value === "followup" && followUpCount > 0 ? ` (${followUpCount})` : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Phone: one card per quote instead of a wide table. */}
        <div className="space-y-2 sm:hidden">
          {loading ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-stone-500">{filter === "followup" ? "Nothing to follow up right now. 🎉" : "No quotations found."}</div>
          ) : (
            filtered.map((q) => {
              const outcome = outcomeOf(q);
              const due = needsFollowUp(q);
              return (
                <div key={q.id} onClick={() => navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId: q.id } })} className="cursor-pointer rounded-xl border border-stone-200 bg-white p-3 active:bg-stone-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold" style={{ color: "#0F1E3A" }}>{q.client_name || "—"}</div>
                      <div className="truncate text-sm text-stone-600">{[q.vehicle_description, q.plate_number].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <div className="shrink-0 text-right font-semibold">{peso(q.total_amount ?? 0)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 text-xs text-stone-500">
                      <span className={`mr-1.5 rounded border px-1.5 py-0.5 font-bold ${OUTCOME_STYLE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>
                      {outcome === "waiting" ? `${daysAgo(q.created_at)}d ago` : outcome === "not_pushed" ? q.outcome_reason ?? "" : ""}
                    </div>
                    {due && (
                      <button onClick={(e) => { e.stopPropagation(); setFollowUp(q); }} className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">
                        <MessageCircle className="h-3.5 w-3.5" /> Follow up
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-stone-200 bg-white sm:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Client</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-right font-bold">Total</th>
                  <th className="px-4 py-3 text-left font-bold">Outcome</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-stone-500">{filter === "followup" ? "Nothing to follow up right now. 🎉" : "No quotations found."}</td></tr>
                ) : (
                  filtered.map((q) => {
                    const outcome = outcomeOf(q);
                    const due = needsFollowUp(q);
                    const editable = outcome !== "pushed" && !q.converted_job_order_id;
                    return (
                      <tr
                        key={q.id}
                        onClick={() => navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId: q.id } })}
                        className="cursor-pointer hover:bg-stone-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>{q.client_name || "—"}</div>
                          <div className="font-mono text-xs text-stone-500">{q.quote_no} · {fmtDate(q.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {q.vehicle_description || "—"}
                          {q.plate_number && <div className="text-xs text-stone-500">{q.plate_number}</div>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{peso(q.total_amount ?? 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`whitespace-nowrap rounded border px-2 py-0.5 text-xs font-bold ${OUTCOME_STYLE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>
                          {outcome === "not_pushed" && q.outcome_reason && <div className="mt-1 text-xs text-stone-500">{q.outcome_reason}</div>}
                          {outcome === "waiting" && (
                            <div className={`mt-1 text-xs ${due ? "font-semibold text-amber-700" : "text-stone-500"}`}>
                              {daysAgo(q.created_at)}d ago{q.followed_up_at ? ` · followed up ${daysAgo(q.followed_up_at)}d ago` : q.status === "sent" ? " · sent" : ""}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-3">
                            {due && (
                              <button
                                onClick={() => setFollowUp(q)}
                                className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> Follow up
                              </button>
                            )}
                            {editable && (
                              <Link
                                to="/admin/walkin/quotes/edit/$quoteId"
                                params={{ quoteId: q.id }}
                                className="text-xs font-semibold hover:underline"
                                style={{ color: "#0F1E3A" }}
                              >
                                Edit
                              </Link>
                            )}
                            {editable && (
                              <button onClick={() => setDeleting(q)} className="text-xs font-semibold text-red-600 hover:underline">
                                Delete
                              </button>
                            )}
                          </div>
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

      {followUp && (
        <SendQuotationModal
          kind="followup"
          clientName={followUp.client_name}
          quotationLink={publicQuoteUrl(followUp.id)}
          onClose={() => setFollowUp(null)}
          onSent={() => void markFollowedUp(followUp)}
        />
      )}

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
