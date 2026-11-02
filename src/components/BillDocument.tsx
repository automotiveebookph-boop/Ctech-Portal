import { peso } from "@/lib/fleet-utils";
import { isDeduction, pesoSigned, quoteTotals } from "@/lib/quote-lines";

export type BillLine = { id: string; category: string; description: string; qty: number; unit_price: number };
export type BillHeader = {
  bill_no: string | null;
  client_name: string | null;
  client_contact: string | null;
  vehicle_description: string | null;
  plate_number: string | null;
  odometer_km: number | null;
  status: string;
  due_date: string | null;
  created_at: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance: number | null;
  notes: string | null;
};

// Same GCash account shown on the landing page's home-service payment step.
const GCASH_NUMBER = "0926 695 6051";
const GCASH_NAME = "RO****O J* D.";

export const BILL_STATUS_STYLE: Record<string, string> = {
  unpaid: "bg-red-50 text-red-700 border-red-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  void: "bg-stone-100 text-stone-500 border-stone-200",
};

export function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

// The printed-looking billing statement, shared by the admin detail page and
// the public /bill/$id link sent to the client.
export function BillDocument({ bill, lines, preparerName }: { bill: BillHeader; lines: BillLine[]; preparerName: string }) {
  const svc = lines.filter((l) => l.category === "service" && !isDeduction(l));
  const parts = lines.filter((l) => l.category === "part" && !isDeduction(l));
  const deductions = lines.filter(isDeduction);
  const totals = quoteTotals(lines);
  const paid = bill.amount_paid ?? 0;
  const balance = bill.balance ?? 0;

  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" style={{ backgroundColor: "#0F1E3A" }}>
        <div className="flex items-center gap-3">
          <img src="/ctech-logo.png" alt="C-Tech Automotive" className="h-14 w-auto sm:h-20" />
          <div className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
            9016 DRT Highway, Sto. Cristo, Pulilan, Bulacan
            <br />
            0998-1516-245 · Mon–Sat 8AM–5PM
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>Billing Statement</div>
          <div className="font-mono text-xl font-bold text-white sm:text-2xl">{bill.bill_no}</div>
        </div>
      </div>
      <div className="h-1.5" style={{ backgroundColor: "#C9A227" }} />

      <div className="p-5 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${BILL_STATUS_STYLE[bill.status] ?? ""}`}>{bill.status === "partial" ? "Partially paid" : bill.status}</span>
          {balance > 0 && bill.status !== "void" && <span className="text-sm font-semibold text-red-600">Balance due: {peso(balance)}</span>}
        </div>

        <div className="grid grid-cols-1 border border-stone-200 sm:grid-cols-2">
          <div className="border-b border-stone-200 p-4 sm:border-b-0 sm:border-r">
            <div className="text-xs font-bold uppercase text-stone-500">Billed to</div>
            <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{bill.client_name || "—"}</div>
            <div className="text-xs text-stone-500">{bill.client_contact}</div>
          </div>
          <div className="p-4">
            <div className="text-xs font-bold uppercase text-stone-500">Vehicle</div>
            <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{bill.vehicle_description || "—"}</div>
            <div className="text-xs text-stone-500">Plate {bill.plate_number || "—"}{bill.odometer_km ? ` · ${bill.odometer_km.toLocaleString()} km` : ""}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 border border-t-0 border-stone-200 sm:grid-cols-2">
          <div className="border-b border-stone-200 p-4 sm:border-b-0 sm:border-r">
            <div className="text-xs font-bold uppercase text-stone-500">Date issued / due date</div>
            <div className="text-sm">{fmtDate(bill.created_at)} — {fmtDate(bill.due_date)}</div>
          </div>
          <div className="p-4">
            <div className="text-xs font-bold uppercase text-stone-500">Prepared by</div>
            <div className="text-sm">{preparerName}</div>
          </div>
        </div>

        <LinesTable title="Services" lines={svc} />
        <LinesTable title="Parts" lines={parts} />
        {deductions.length > 0 && <LinesTable title="Less & discounts" lines={deductions} />}

        <div className="mt-4 flex justify-end">
          <div className="w-full border sm:w-72" style={{ borderColor: "#0F1E3A" }}>
            <div className="flex justify-between px-3 py-1.5 text-sm text-stone-500"><span>Subtotal, services</span><span className="font-mono">{peso(totals.services)}</span></div>
            <div className="flex justify-between px-3 py-1.5 text-sm text-stone-500"><span>Subtotal, parts</span><span className="font-mono">{peso(totals.parts)}</span></div>
            {totals.deductions > 0 && <div className="flex justify-between px-3 py-1.5 text-sm text-red-600"><span>Less &amp; discounts</span><span className="font-mono">{pesoSigned(-totals.deductions)}</span></div>}
            <div className="flex justify-between border-t border-stone-200 px-3 py-1.5 text-sm font-bold" style={{ color: "#0F1E3A" }}><span>Total amount</span><span className="font-mono">{peso(bill.total_amount ?? 0)}</span></div>
            <div className="flex justify-between px-3 py-1.5 text-sm text-emerald-700"><span>Amount paid</span><span className="font-mono">{pesoSigned(-paid)}</span></div>
            <div className="flex justify-between px-3 py-2 text-base font-bold text-white" style={{ backgroundColor: "#0F1E3A" }}><span>Balance due</span><span className="font-mono">{peso(balance)}</span></div>
          </div>
        </div>

        {balance > 0 && bill.status !== "void" && (
          <div className="mt-5 rounded-xl border-2 p-4" style={{ borderColor: "#C9A227" }}>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "#C9A227" }}>How to pay</div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img src="/gcash-qr.jpg" alt="GCash QR code for C-Tech Automotive" className="w-44 shrink-0 rounded-lg border border-stone-200" />
              <div className="space-y-2 text-sm">
                <div>
                  <div className="font-semibold" style={{ color: "#0F1E3A" }}>GCash</div>
                  <div>Scan the QR, or send to <span className="font-mono font-semibold">{GCASH_NUMBER}</span> ({GCASH_NAME})</div>
                </div>
                <div>
                  <div className="font-semibold" style={{ color: "#0F1E3A" }}>Cash or card</div>
                  <div>At the shop — 9016 DRT Highway, Sto. Cristo, Pulilan, Bulacan</div>
                </div>
                <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  After paying by GCash, please send us the reference number or a screenshot on Messenger so we can record it. Amount due: <strong>{peso(balance)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 text-sm">
          <div className="mb-1 text-xs font-bold uppercase text-stone-500">Inclusions &amp; notes</div>
          <div className="whitespace-pre-wrap">{bill.notes || "—"}</div>
        </div>
        <div className="mt-4 border-t border-stone-200 pt-3 text-xs text-stone-500">
          This is a billing statement and not an official receipt. Please settle the balance on or before the due date. Thank you for choosing C-Tech Automotive.
        </div>
      </div>
    </div>
  );
}

function LinesTable({ title, lines }: { title: string; lines: BillLine[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="border-b-2 pb-1 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "#C9A227", borderColor: "#0F1E3A" }}>{title}</caption>
        <thead>
          <tr className="text-xs uppercase text-stone-500">
            <th className="border-b border-stone-200 py-1.5 text-left font-bold">Description</th>
            <th className="hidden border-b border-stone-200 py-1.5 text-right font-bold sm:table-cell">Qty</th>
            <th className="hidden border-b border-stone-200 py-1.5 text-right font-bold sm:table-cell">Unit price</th>
            <th className="border-b border-stone-200 py-1.5 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((l) => (
            <tr key={l.id} className={isDeduction(l) ? "text-red-600" : undefined}>
              <td className="whitespace-pre-line border-b border-stone-100 py-1.5 pr-2">
                {l.description}
                <span className="block text-xs text-stone-500 sm:hidden">Qty {l.qty} · {pesoSigned(l.unit_price)} each</span>
              </td>
              <td className="hidden border-b border-stone-100 py-1.5 text-right font-mono sm:table-cell">{l.qty}</td>
              <td className="hidden border-b border-stone-100 py-1.5 text-right font-mono sm:table-cell">{pesoSigned(l.unit_price)}</td>
              <td className="whitespace-nowrap border-b border-stone-100 py-1.5 text-right font-mono">{pesoSigned(l.qty * l.unit_price)}</td>
            </tr>
          )) : (
            <tr><td colSpan={4} className="py-2 italic text-stone-500">No {title.toLowerCase()}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
