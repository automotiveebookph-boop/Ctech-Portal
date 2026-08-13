import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/walkin/quotes/$quoteId")({
  component: QuoteDetailPage,
});

type QuoteLine = { id: string; category: string; description: string; qty: number; unit_price: number };
type Quote = {
  id: string; quote_no: string | null; client_name: string | null; client_contact: string | null;
  vehicle_description: string | null; plate_number: string | null; odometer_km: number | null;
  status: string | null; effective_status: string | null; valid_until: string | null; created_at: string | null;
  prepared_by: string | null; subtotal_services: number | null; subtotal_parts: number | null; total_amount: number | null;
  notes: string | null; converted_job_order_id: string | null;
};

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function QuoteDetailPage() {
  const { quoteId } = Route.useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [preparerName, setPreparerName] = useState("—");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: q, error } = await supabaseFleet.from("quotes_with_effective_status").select("*").eq("id", quoteId).single();
    if (error) { toast.error(error.message); return; }
    setQuote(q as Quote);
    const { data: ls } = await supabaseFleet.from("quote_line_items").select("id, category, description, qty, unit_price").eq("quote_id", quoteId).order("created_at");
    setLines((ls ?? []) as QuoteLine[]);
    if (q?.prepared_by) {
      const { data: staffRow } = await supabaseFleet.from("staff").select("full_name").eq("id", q.prepared_by).maybeSingle();
      if (staffRow) setPreparerName(staffRow.full_name);
    }
  }

  useEffect(() => { load(); }, [quoteId]);

  async function convert() {
    if (!quote) return;
    setBusy(true);
    const { data: jobOrderId, error } = await supabaseFleet.rpc("approve_and_convert_quote", { p_quote_id: quote.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Converted to job order");
    setQuote({ ...quote, status: "approved", effective_status: "approved", converted_job_order_id: jobOrderId as string });
  }

  async function downloadPdf() {
    if (!quote) return;
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;
    const svc = lines.filter((l) => l.category === "service");
    const parts = lines.filter((l) => l.category === "part");
    const phMoney = (n: number) => "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Navy header band — the logo's wordmark is white, so it needs a dark
    // background to read at all (it's invisible on plain white paper).
    const bandH = 62;
    doc.setFillColor(15, 30, 58);
    doc.rect(0, 0, pageWidth, bandH, "F");
    doc.setFillColor(201, 162, 39);
    doc.rect(0, bandH, pageWidth, 1.5, "F");

    const logoY = 8;
    const logoH = 42;
    const logoW = logoH * (640 / 800);
    try {
      const logoDataUrl = await loadImageAsDataUrl("/ctech-logo.png");
      doc.addImage(logoDataUrl, "PNG", marginX, logoY, logoW, logoH);
    } catch {
      doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
      doc.text("C-TECH AUTOMOTIVE", marginX, logoY + 20);
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(190, 197, 212);
    doc.text("9016 DRT Highway, Sto. Cristo, Pulilan, Bulacan  ·  0998-1516-245  ·  Mon-Sat 8AM-5PM", marginX, logoY + logoH + 7);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(201, 162, 39);
    doc.text("QUOTATION", pageWidth - marginX, logoY + 12, { align: "right" });
    doc.setFontSize(23); doc.setTextColor(255, 255, 255);
    doc.text(quote.quote_no ?? "", pageWidth - marginX, logoY + 27, { align: "right" });
    let y = bandH + 10;

    const colW = (pageWidth - marginX * 2) / 2;
    function metaBlock(x: number, label: string, rows: string[]) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
      doc.text(label.toUpperCase(), x, y);
      let yy = y + 5;
      rows.forEach((line, i) => { doc.setFontSize(i === 0 ? 10.5 : 9.5); doc.setTextColor(20, 38, 61); doc.text(line, x, yy); yy += 5; });
    }
    metaBlock(marginX, "Prepared for", [quote.client_name || "—", quote.client_contact || ""]);
    metaBlock(marginX + colW, "Vehicle", [quote.vehicle_description || "—", `Plate ${quote.plate_number || "—"}${quote.odometer_km ? " · " + quote.odometer_km.toLocaleString() + " km" : ""}`]);
    y += 18;
    metaBlock(marginX, "Date issued / valid until", [`${fmtDate(quote.created_at)} — ${fmtDate(quote.valid_until)}`]);
    metaBlock(marginX + colW, "Prepared by", [preparerName]);
    y += 12;

    const tableOpts = { startY: y + 1, margin: { left: marginX, right: marginX }, styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: [20, 38, 61] as [number, number, number] }, headStyles: { fillColor: [15, 30, 58] as [number, number, number], textColor: 255, fontStyle: "bold" as const, fontSize: 8.5 }, columnStyles: { 1: { halign: "right" as const, cellWidth: 16 }, 2: { halign: "right" as const, cellWidth: 28 }, 3: { halign: "right" as const, cellWidth: 28 } } };
    const lineRow = (l: QuoteLine) => [l.description, String(l.qty), phMoney(l.unit_price), phMoney(l.qty * l.unit_price)];

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(201, 162, 39); doc.text("SERVICES", marginX, y - 2);
    autoTable(doc, { ...tableOpts, head: [["Description", "Qty", "Unit price", "Amount"]], body: svc.length ? svc.map(lineRow) : [["No service lines", "", "", ""]] });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(201, 162, 39); doc.text("PARTS", marginX, y - 2);
    autoTable(doc, { ...tableOpts, startY: y + 1, head: [["Description", "Qty", "Unit price", "Amount"]], body: parts.length ? parts.map(lineRow) : [["No part lines", "", "", ""]] });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    const boxW = 70, boxX = pageWidth - marginX - boxW;
    doc.setDrawColor(15, 30, 58); doc.setLineWidth(0.3); doc.rect(boxX, y, boxW, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 100, 115);
    doc.text("Subtotal, services", boxX + 3, y + 6); doc.text(phMoney(quote.subtotal_services ?? 0), boxX + boxW - 3, y + 6, { align: "right" });
    doc.text("Subtotal, parts", boxX + 3, y + 11); doc.text(phMoney(quote.subtotal_parts ?? 0), boxX + boxW - 3, y + 11, { align: "right" });
    doc.setFillColor(15, 30, 58); doc.rect(boxX, y + 14, boxW, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
    doc.text("Grand total", boxX + 3, y + 19.5); doc.text(phMoney(quote.total_amount ?? 0), boxX + boxW - 3, y + 19.5, { align: "right" });
    y += 30;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
    doc.text("INCLUSIONS & NOTES", marginX, y);
    doc.setFontSize(9); doc.setTextColor(20, 38, 61);
    const noteLines = doc.splitTextToSize(quote.notes || "—", pageWidth - marginX * 2);
    doc.text(noteLines, marginX, y + 5);
    y += 5 + noteLines.length * 4.2 + 6;

    doc.setDrawColor(212, 217, 224); doc.setLineWidth(0.2); doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
    const terms = "This quotation is an estimate and is valid until the date above. Not a job order — work begins only once this quotation is approved.";
    const termLines = doc.splitTextToSize(terms, pageWidth - marginX * 2);
    doc.text(termLines, marginX, y);
    y += termLines.length * 3.6 + 16;

    doc.setDrawColor(20, 38, 61); doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + colW - 8, y);
    doc.line(marginX + colW, y, pageWidth - marginX, y);
    doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
    doc.text("Customer signature over printed name", marginX, y + 4);
    doc.text("Authorized by — C-Tech Automotive", marginX + colW, y + 4);

    doc.save(`C-Tech-Quotation-${quote.quote_no}.pdf`);
  }

  if (!quote) return <main className="p-8 text-stone-500">Loading…</main>;

  const svc = lines.filter((l) => l.category === "service");
  const parts = lines.filter((l) => l.category === "part");
  const canConvert = quote.effective_status === "draft" || quote.effective_status === "sent";

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{quote.quote_no}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/walkin/quotes" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700">← Back to list</Link>
          {canConvert && (
            <button disabled={busy} onClick={() => void convert()} className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#0F1E3A" }}>
              {busy ? "Converting…" : "Approve & convert to job order"}
            </button>
          )}
          <button onClick={downloadPdf} className="rounded-lg px-4 py-2 text-sm font-bold" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
            Print / Save as PDF
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {quote.converted_job_order_id && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Converted to job order.
          </div>
        )}

        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-10 py-10" style={{ backgroundColor: "#0F1E3A" }}>
            <div>
              <img src="/ctech-logo.png" alt="C-Tech Automotive" className="h-40 w-auto" />
              <div className="mt-4 text-base" style={{ color: "rgba(255,255,255,0.65)" }}>9016 DRT Highway, Sto. Cristo, Pulilan, Bulacan · 0998-1516-245 · Mon–Sat 8AM–5PM</div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>Quotation</div>
              <div className="font-mono text-4xl font-bold text-white">{quote.quote_no}</div>
            </div>
          </div>
          <div className="h-1.5" style={{ backgroundColor: "#C9A227" }} />

          <div className="p-8">
          <div className="grid grid-cols-2 border border-stone-200">
            <div className="border-r border-stone-200 p-4">
              <div className="text-[10px] font-bold uppercase text-stone-400">Prepared for</div>
              <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{quote.client_name || "—"}</div>
              <div className="text-xs text-stone-500">{quote.client_contact}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-bold uppercase text-stone-400">Vehicle</div>
              <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{quote.vehicle_description || "—"}</div>
              <div className="text-xs text-stone-500">Plate {quote.plate_number || "—"}{quote.odometer_km ? ` · ${quote.odometer_km.toLocaleString()} km` : ""}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 border border-t-0 border-stone-200">
            <div className="border-r border-stone-200 p-4">
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
            <div className="w-64 border" style={{ borderColor: "#0F1E3A" }}>
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
          </div>
        </div>
      </main>
    </>
  );
}

function LinesTable({ title, lines }: { title: string; lines: QuoteLine[] }) {
  return (
    <table className="mt-4 w-full text-sm">
      <caption className="border-b-2 pb-1 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: "#C9A227", borderColor: "#0F1E3A" }}>{title}</caption>
      <thead>
        <tr className="text-[10px] uppercase text-stone-400">
          <th className="border-b border-stone-200 py-1.5 text-left font-bold">Description</th>
          <th className="border-b border-stone-200 py-1.5 text-right font-bold">Qty</th>
          <th className="border-b border-stone-200 py-1.5 text-right font-bold">Unit price</th>
          <th className="border-b border-stone-200 py-1.5 text-right font-bold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.length ? lines.map((l) => (
          <tr key={l.id}>
            <td className="border-b border-stone-100 py-1.5">{l.description}</td>
            <td className="border-b border-stone-100 py-1.5 text-right font-mono">{l.qty}</td>
            <td className="border-b border-stone-100 py-1.5 text-right font-mono">{peso(l.unit_price)}</td>
            <td className="border-b border-stone-100 py-1.5 text-right font-mono">{peso(l.qty * l.unit_price)}</td>
          </tr>
        )) : (
          <tr><td colSpan={4} className="py-2 italic text-stone-400">No {title.toLowerCase()}</td></tr>
        )}
      </tbody>
    </table>
  );
}
