import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { publicBillUrl } from "@/lib/quotation-message";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { SendQuotationModal } from "@/components/SendQuotationModal";
import { BillDocument, fmtDate, type BillHeader, type BillLine } from "@/components/BillDocument";

export const Route = createFileRoute("/admin/walkin/bills/$billId")({
  component: BillDetailPage,
});

type Bill = BillHeader & {
  id: string; quote_id: string | null; prepared_by: string | null;
  service_history_id: string | null; vehicle_id: string | null; customer_id: string | null;
};
type Payment = { id: string; amount: number; method: string; reference: string | null; paid_at: string };

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank", label: "Bank transfer" },
  { value: "card", label: "Card" },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;
const todayManila = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const labelCls = "mb-1 block text-xs font-semibold uppercase text-stone-600";

function BillDetailPage() {
  const { billId } = Route.useParams();
  const [bill, setBill] = useState<Bill | null>(null);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [preparerName, setPreparerName] = useState("—");
  const [quoteNo, setQuoteNo] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(todayManila());
  const [savingPay, setSavingPay] = useState(false);

  const [histPlate, setHistPlate] = useState("");
  const [histKm, setHistKm] = useState("");
  const [histJo, setHistJo] = useState("");
  const [histTech, setHistTech] = useState("");
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [savingHist, setSavingHist] = useState(false);

  async function load() {
    const { data: b, error } = await supabaseFleet.from("bills").select("*").eq("id", billId).single();
    if (error) { toast.error(error.message); return; }
    setBill(b as Bill);
    const [{ data: ls }, { data: ps }] = await Promise.all([
      supabaseFleet.from("bill_line_items").select("id, category, description, qty, unit_price").eq("bill_id", billId).order("created_at"),
      supabaseFleet.from("bill_payments").select("id, amount, method, reference, paid_at").eq("bill_id", billId).order("paid_at"),
    ]);
    setLines((ls ?? []) as BillLine[]);
    setPayments((ps ?? []) as Payment[]);
    setPayAmount(String(Math.max(0, b.balance ?? 0)));
    setHistPlate(b.plate_number ?? "");
    setHistKm(b.odometer_km ? String(b.odometer_km) : "");
    const { data: techs } = await supabaseFleet.from("staff").select("full_name").eq("active", true).eq("shop_role", "technician").order("full_name");
    setTechnicians((techs ?? []).map((t: { full_name: string }) => t.full_name));
    if (b.prepared_by) {
      const { data: staffRow } = await supabaseFleet.from("staff").select("full_name").eq("id", b.prepared_by).maybeSingle();
      if (staffRow) setPreparerName(staffRow.full_name);
    }
    if (b.quote_id) {
      const { data: q } = await supabaseFleet.from("quotes").select("quote_no").eq("id", b.quote_id).maybeSingle();
      setQuoteNo(q?.quote_no ?? null);
    }
  }

  useEffect(() => { load(); }, [billId]);

  async function recordPayment() {
    if (!bill) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter an amount greater than 0"); return; }
    if (amount > (bill.balance ?? 0) + 0.001 && !window.confirm(`That is more than the balance (${peso(bill.balance ?? 0)}). Record it anyway?`)) return;
    setSavingPay(true);
    const { error } = await supabaseFleet.from("bill_payments").insert({
      bill_id: bill.id,
      amount,
      method: payMethod,
      reference: payRef.trim() || null,
      paid_at: `${payDate}T12:00:00+08:00`,
    });
    setSavingPay(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payment of ${peso(amount)} recorded`);
    setPayRef("");
    load();
  }

  async function saveToHistory() {
    if (!bill) return;
    if (!bill.vehicle_id && !histPlate.trim()) { toast.error("Add the plate number first"); return; }
    setSavingHist(true);
    const { data, error } = await supabaseFleet.rpc("log_bill_to_history", {
      p_bill_id: bill.id,
      p_odometer: histKm ? Number(histKm) : null,
      p_job_order_no: histJo.trim() || null,
      p_technician: histTech.trim() || null,
      p_plate: histPlate.trim() || null,
    });
    setSavingHist(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { new_customer?: boolean; new_vehicle?: boolean };
    toast.success(
      `Saved to service history${r.new_customer ? " · new customer added" : ""}${r.new_vehicle ? " · new car added" : ""}. The PMS reminder clock is reset.`,
    );
    load();
  }

  async function deletePayment(p: Payment) {
    if (!window.confirm(`Remove the ${methodLabel(p.method)} payment of ${peso(p.amount)}?`)) return;
    const { error, count } = await supabaseFleet.from("bill_payments").delete({ count: "exact" }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    if (!count) { toast.error("Only the owner or an admin can remove a payment."); return; }
    toast.success("Payment removed");
    load();
  }

  async function setVoid(makeVoid: boolean) {
    if (!bill) return;
    if (makeVoid && !window.confirm("Void this bill? The client's link will stop working, but the record is kept.")) return;
    const paid = bill.amount_paid ?? 0;
    const restored = paid <= 0 ? "unpaid" : paid >= (bill.total_amount ?? 0) ? "paid" : "partial";
    const { error } = await supabaseFleet.from("bills").update({ status: makeVoid ? "void" : restored }).eq("id", bill.id);
    if (error) { toast.error(error.message); return; }
    toast.success(makeVoid ? "Bill voided" : "Bill restored");
    load();
  }

  if (!bill) return <main className="p-8 text-stone-500">Loading…</main>;
  const isVoid = bill.status === "void";

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{bill.bill_no}</h1>
          {bill.quote_id && (
            <Link to="/admin/walkin/quotes/$quoteId" params={{ quoteId: bill.quote_id }} className="text-xs text-stone-500 hover:underline">
              From quotation {quoteNo ?? ""}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/walkin/bills" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">← Back to list</Link>
          {!isVoid && (
            <Link to="/admin/walkin/bills/edit/$billId" params={{ billId }} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Edit</Link>
          )}
          <button onClick={() => void downloadBillPdf(bill, lines, payments, preparerName)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            Print / Save as PDF
          </button>
          {!isVoid && (
            <button onClick={() => setSendOpen(true)} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:opacity-90" style={{ backgroundColor: "#0F1E3A" }}>
              <Send className="h-4 w-4" /> Send Bill
            </button>
          )}
        </div>
      </header>

      {sendOpen && (
        <SendQuotationModal kind="bill" clientName={bill.client_name} quotationLink={publicBillUrl(bill.id)} onClose={() => setSendOpen(false)} />
      )}

      <main className="grid grid-cols-1 gap-6 p-4 md:p-8 xl:grid-cols-[1fr_340px]">
        <div>
          {isVoid && <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-600">This bill is <strong>void</strong>. The client's link no longer works.</div>}
          <BillDocument bill={bill} lines={lines} preparerName={preparerName} />
        </div>

        <aside className="order-first h-fit space-y-4 xl:order-last">
          <section className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>Payments</h2>
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-stone-500"><span>Total</span><span className="font-mono">{peso(bill.total_amount ?? 0)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-mono">{peso(bill.amount_paid ?? 0)}</span></div>
              <div className="flex justify-between border-t border-stone-200 pt-1 font-bold" style={{ color: "#0F1E3A" }}><span>Balance</span><span className="font-mono">{peso(bill.balance ?? 0)}</span></div>
            </div>

            {payments.length === 0 ? (
              <div className="mb-3 rounded-lg bg-stone-50 py-3 text-center text-xs text-stone-500">No payments yet.</div>
            ) : (
              <div className="mb-3 divide-y divide-stone-100 rounded-lg border border-stone-100">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold">{methodLabel(p.method)} <span className="font-normal text-stone-500">· {fmtDate(p.paid_at)}</span></div>
                      {p.reference && <div className="truncate text-xs text-stone-500">Ref: {p.reference}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono">{peso(p.amount)}</span>
                      <button onClick={() => void deletePayment(p)} className="text-red-500" aria-label="Remove payment">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isVoid && (
              <div className="space-y-2 border-t border-dashed border-stone-200 pt-3">
                <div className="text-xs font-bold uppercase text-stone-500">Record a payment</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Amount</label><input type="number" min="0" className={inputCls} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
                  <div>
                    <label className={labelCls}>Method</label>
                    <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                  <div><label className={labelCls}>Reference</label><input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={payMethod === "gcash" ? "GCash ref no." : "Optional"} /></div>
                </div>
                <button disabled={savingPay} onClick={() => void recordPayment()} className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
                  {savingPay ? "Saving…" : "Record payment"}
                </button>
              </div>
            )}
          </section>

          {!isVoid && (bill.service_history_id ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <div className="font-bold text-emerald-800">✓ Saved to service history</div>
              <p className="mt-1 text-xs text-emerald-700">The car's PMS / 3-month reminder clock was reset.</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                {bill.vehicle_id && <Link to="/admin/walkin/vehicles/$vehicleId" params={{ vehicleId: bill.vehicle_id }} className="text-emerald-800 underline">View car →</Link>}
                {bill.customer_id && <Link to="/admin/walkin/customers/$customerId" params={{ customerId: bill.customer_id }} className="text-emerald-800 underline">View customer →</Link>}
              </div>
            </section>
          ) : (
            <section className={`rounded-xl border p-4 ${bill.status === "paid" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
              <h2 className="text-sm font-bold" style={{ color: "#0F1E3A" }}>Job done? Save to service history</h2>
              <p className="mb-3 mt-0.5 text-xs text-stone-500">Adds this job to the car's history and resets its PMS reminder — no need to retype the job order.</p>
              <div className="grid grid-cols-2 gap-2">
                {!bill.vehicle_id && (
                  <div className="col-span-2"><label className={labelCls}>Plate number *</label><input className={inputCls} value={histPlate} onChange={(e) => setHistPlate(e.target.value.toUpperCase())} placeholder="e.g. ABC 1234" /></div>
                )}
                <div><label className={labelCls}>Odometer (km)</label><input type="number" min="0" className={inputCls} value={histKm} onChange={(e) => setHistKm(e.target.value)} placeholder="Current km" /></div>
                <div><label className={labelCls}>JO #</label><input className={inputCls} value={histJo} onChange={(e) => setHistJo(e.target.value)} placeholder="Optional" /></div>
                <div className="col-span-2">
                  <label className={labelCls}>Technician</label>
                  <input className={inputCls} list="bill-technicians" value={histTech} onChange={(e) => setHistTech(e.target.value)} placeholder="Optional" />
                  <datalist id="bill-technicians">{technicians.map((t) => <option key={t} value={t} />)}</datalist>
                </div>
              </div>
              {!histKm && <p className="mt-2 text-xs text-amber-700">Tip: add the odometer so mileage-based PMS reminders work.</p>}
              <button disabled={savingHist} onClick={() => void saveToHistory()} className="mt-3 w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#0F1E3A" }}>
                {savingHist ? "Saving…" : "Save to service history"}
              </button>
            </section>
          ))}

          <button onClick={() => void setVoid(!isVoid)} className="w-full rounded-lg border border-stone-300 bg-white py-2 text-xs font-semibold text-stone-500 hover:bg-stone-50">
            {isVoid ? "Restore this bill" : "Void this bill"}
          </button>
        </aside>
      </main>
    </>
  );
}
