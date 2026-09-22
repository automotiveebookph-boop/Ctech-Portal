import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/quote/$quoteId")({
  head: () => ({ meta: [{ title: "Your Quotation — C-Tech Automotive" }] }),
  component: PublicQuotePage,
});

type Line = { id: string; category: string; description: string; qty: number; unit_price: number };
type QuoteData = {
  id: string;
  quote_no: string | null;
  client_name: string | null;
  client_contact: string | null;
  vehicle_description: string | null;
  plate_number: string | null;
  odometer_km: number | null;
  status: string | null;
  effective_status: string | null;
  valid_until: string | null;
  created_at: string | null;
  subtotal_services: number | null;
  subtotal_parts: number | null;
  total_amount: number | null;
  notes: string | null;
};
type PublicQuoteResponse = {
  ok: boolean;
  reason?: string;
  quote?: QuoteData;
  lines?: Line[];
  preparer_name?: string;
};

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function PublicQuotePage() {
  const { quoteId } = Route.useParams();
  const [state, setState] = useState<"loading" | "notfound" | "ok">("loading");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [preparerName, setPreparerName] = useState("—");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseFleet.rpc("get_public_quote", { p_quote_id: quoteId });
      if (cancelled) return;
      const res = data as PublicQuoteResponse | null;
      if (error || !res?.ok || !res.quote) { setState("notfound"); return; }
      setQuote(res.quote);
      setLines(res.lines ?? []);
      setPreparerName(res.preparer_name ?? "—");
      setState("ok");
    })();
    return () => { cancelled = true; };
  }, [quoteId]);

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-400">Loading your quotation…</div>;
  }

  if (state === "notfound" || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">🤔</div>
          <h1 className="mb-1 text-lg font-bold" style={{ color: "#0F1E3A" }}>Quotation not found</h1>
          <p className="text-sm text-stone-500">This link may be incorrect. Please contact C-Tech Automotive at 0998-1516-245 for help.</p>
        </div>
      </div>
    );
  }

  const svc = lines.filter((l) => l.category === "service");
  const parts = lines.filter((l) => l.category === "part");
  const isExpired = quote.effective_status === "expired";

  return (
    <div className="min-h-screen bg-stone-50 px-3 py-6 sm:px-4 sm:py-8">
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
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>Quotation</div>
            <div className="font-mono text-xl font-bold text-white sm:text-2xl">{quote.quote_no}</div>
          </div>
        </div>
        <div className="h-1.5" style={{ backgroundColor: "#C9A227" }} />

        {isExpired && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            This quotation has passed its validity date. Please message us if you'd like an updated quote.
          </div>
        )}

        <div className="p-5 sm:p-8">
          <div className="grid grid-cols-1 border border-stone-200 sm:grid-cols-2">
            <div className="border-b border-stone-200 p-4 sm:border-b-0 sm:border-r">
              <div className="text-[10px] font-bold uppercase text-stone-400">Prepared for</div>
              <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{quote.client_name || "—"}</div>
              <div className="text-xs text-stone-500">{quote.client_contact}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase text-stone-400">Vehicle</div>
              <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{quote.vehicle_description || "—"}</div>
              <div className="text-xs text-stone-500">
                Plate {quote.plate_number || "—"}{quote.odometer_km ? ` · ${quote.odometer_km.toLocaleString()} km` : ""}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 border border-t-0 border-stone-200 sm:grid-cols-2">
            <div className="border-b border-stone-200 p-4 sm:border-b-0 sm:border-r">
              <div className="text-[10px] font-bold uppercase text-stone-400">Date issued / valid until</div>
              <div className="text-sm">{fmtDate(quote.created_at)} — {fmtDate(quote.valid_until)}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase text-stone-400">Prepared by</div>
              <div className="text-sm">{preparerName}</div>
            </div>
          </div>

          <LinesTable title="Services" lines={svc} />
          <LinesTable title="Parts" lines={parts} />

          <div className="mt-4 flex justify-end">
            <div className="w-full border sm:w-64" style={{ borderColor: "#0F1E3A" }}>
              <div className="flex justify-between px-3 py-1.5 text-sm text-stone-500"><span>Subtotal, services</span><span className="font-mono">{peso(quote.subtotal_services ?? 0)}</span></div>
              <div className="flex justify-between px-3 py-1.5 text-sm text-stone-500"><span>Subtotal, parts</span><span className="font-mono">{peso(quote.subtotal_parts ?? 0)}</span></div>
              <div className="flex justify-between px-3 py-2 text-base font-bold text-white" style={{ backgroundColor: "#0F1E3A" }}><span>Grand total</span><span className="font-mono">{peso(quote.total_amount ?? 0)}</span></div>
            </div>
          </div>

          <div className="mt-5 text-sm">
            <div className="mb-1 text-[10px] font-bold uppercase text-stone-400">Inclusions &amp; notes</div>
            <div className="whitespace-pre-wrap">{quote.notes || "—"}</div>
          </div>
          <div className="mt-4 border-t border-stone-200 pt-3 text-xs text-stone-400">
            This quotation is an estimate and is valid until the date above. Not a job order — work begins only once this quotation is approved.
          </div>

          <div className="mt-6 rounded-lg bg-stone-50 p-4 text-center text-sm text-stone-600">
            Questions about this quotation? Message us on{" "}
            <a href="https://m.me/cteachautomotive" target="_blank" rel="noopener" className="font-semibold" style={{ color: "#0F1E3A" }}>
              Messenger
            </a>
            {" "}or call <strong>0998-1516-245</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

function LinesTable({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="border-b-2 pb-1 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: "#C9A227", borderColor: "#0F1E3A" }}>{title}</caption>
        <thead>
          <tr className="text-[10px] uppercase text-stone-400">
            <th className="border-b border-stone-200 py-1.5 text-left font-bold">Description</th>
            <th className="hidden border-b border-stone-200 py-1.5 text-right font-bold sm:table-cell">Qty</th>
            <th className="hidden border-b border-stone-200 py-1.5 text-right font-bold sm:table-cell">Unit price</th>
            <th className="border-b border-stone-200 py-1.5 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? lines.map((l) => (
            <tr key={l.id}>
              <td className="border-b border-stone-100 py-1.5 pr-2">
                {l.description}
                <span className="block text-[11px] text-stone-400 sm:hidden">Qty {l.qty} · {peso(l.unit_price)} each</span>
              </td>
              <td className="hidden border-b border-stone-100 py-1.5 text-right font-mono sm:table-cell">{l.qty}</td>
              <td className="hidden border-b border-stone-100 py-1.5 text-right font-mono sm:table-cell">{peso(l.unit_price)}</td>
              <td className="whitespace-nowrap border-b border-stone-100 py-1.5 text-right font-mono">{peso(l.qty * l.unit_price)}</td>
            </tr>
          )) : (
            <tr><td colSpan={4} className="py-2 italic text-stone-400">No {title.toLowerCase()}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
