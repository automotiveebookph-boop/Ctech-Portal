import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { BILL_STATUS_STYLE, fmtDate } from "@/components/BillDocument";

export const Route = createFileRoute("/admin/walkin/bills")({
  component: BillsPage,
});

type Bill = {
  id: string;
  bill_no: string | null;
  client_name: string | null;
  vehicle_description: string | null;
  plate_number: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance: number | null;
  status: string;
  due_date: string | null;
  created_at: string | null;
};

const STATUS_ORDER = ["all", "unpaid", "partial", "paid", "void"];
const STATUS_LABEL: Record<string, string> = { all: "All statuses", unpaid: "Unpaid", partial: "Partially paid", paid: "Paid", void: "Void" };

function BillsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/walkin/bills") return <Outlet />;
  return <BillsListPage />;
}

function BillsListPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabaseFleet
      .from("bills")
      .select("id, bill_no, client_name, vehicle_description, plate_number, total_amount, amount_paid, balance, status, due_date, created_at")
      .order("created_at", { ascending: false });
    setBills((data ?? []) as Bill[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function doDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const { error, count } = await supabaseFleet.from("bills").delete({ count: "exact" }).eq("id", deleting.id);
    setBusyDelete(false);
    if (error) { toast.error(error.message); return; }
    if (!count) { toast.error("Only the owner or an admin can delete a bill."); return; }
    toast.success("Bill deleted");
    setDeleting(null);
    load();
  }

  const filtered = useMemo(() => (status === "all" ? bills : bills.filter((b) => b.status === status)), [bills, status]);

  const stats = useMemo(() => {
    const open = bills.filter((b) => b.status === "unpaid" || b.status === "partial");
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const billedThisMonth = bills
      .filter((b) => b.status !== "void" && b.created_at && Date.parse(b.created_at) >= monthStart.getTime())
      .reduce((s, b) => s + (b.total_amount ?? 0), 0);
    return { openCount: open.length, receivable: open.reduce((s, b) => s + (b.balance ?? 0), 0), billedThisMonth };
  }, [bills]);

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Billing</h1>
          <p className="mt-0.5 text-sm text-stone-500">{bills.length} billing statements</p>
        </div>
        <Link to="/admin/walkin/bills/new" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
          <Plus className="h-4 w-4" />
          New Bill
        </Link>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4" style={{ borderColor: "#C9A227" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">To collect</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{peso(stats.receivable)}</div>
            <div className="text-xs text-stone-500">{stats.openCount} unpaid / partial bills</div>
          </div>
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Billed this month</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "#0F1E3A" }}>{peso(stats.billedThisMonth)}</div>
          </div>
        </div>

        <p className="mb-3 text-xs text-stone-500">Tip: open a quotation and tap <strong>Convert to bill</strong> to bill a client from an existing quote.</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${status === s ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={status === s ? { backgroundColor: "#0F1E3A" } : undefined}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Bill no.</th>
                  <th className="px-4 py-3 text-left font-bold">Client</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-right font-bold">Total</th>
                  <th className="px-4 py-3 text-right font-bold">Balance</th>
                  <th className="px-4 py-3 text-left font-bold">Status</th>
                  <th className="px-4 py-3 text-left font-bold">Due</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-500">No billing statements found.</td></tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-mono text-xs">{b.bill_no}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#0F1E3A" }}>{b.client_name || "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{b.vehicle_description || b.plate_number || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{peso(b.total_amount ?? 0)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${(b.balance ?? 0) > 0 && b.status !== "void" ? "text-red-600" : "text-stone-400"}`}>{peso(b.balance ?? 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${BILL_STATUS_STYLE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{fmtDate(b.due_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link to="/admin/walkin/bills/$billId" params={{ billId: b.id }} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "#0F1E3A", color: "white" }}>View</Link>
                          {b.status !== "void" && (
                            <Link to="/admin/walkin/bills/edit/$billId" params={{ billId: b.id }} className="text-xs font-semibold hover:underline" style={{ color: "#0F1E3A" }}>Edit</Link>
                          )}
                          <button onClick={() => setDeleting(b)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
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
            <h2 className="mb-2 text-lg font-bold" style={{ color: "#0F1E3A" }}>Delete Bill?</h2>
            <p className="mb-4 text-sm text-stone-600">
              <strong>{deleting.bill_no}</strong> for <strong>{deleting.client_name || "this client"}</strong> will be permanently deleted, along with its line items and recorded payments. This can't be undone. (To keep a record, open the bill and mark it Void instead.)
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
