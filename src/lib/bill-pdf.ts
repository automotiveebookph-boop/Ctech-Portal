import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isDeduction, quoteTotals } from "@/lib/quote-lines";
import type { BillHeader, BillLine } from "@/components/BillDocument";

type Payment = { amount: number; method: string; paid_at: string; reference: string | null };

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

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");
const METHOD_LABEL: Record<string, string> = { cash: "Cash", gcash: "GCash", bank: "Bank transfer", card: "Card" };

// Same letterhead and layout as the quotation PDF, titled "BILLING STATEMENT",
// plus amount paid / balance and the payment history.
export async function downloadBillPdf(bill: BillHeader, lines: BillLine[], payments: Payment[], preparerName: string) {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const svc = lines.filter((l) => l.category === "service" && !isDeduction(l));
  const parts = lines.filter((l) => l.category === "part" && !isDeduction(l));
  const deductions = lines.filter(isDeduction);
  const totals = quoteTotals(lines);
  const phMoney = (n: number) => (n < 0 ? "- " : "") + "PHP " + Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const bandH = 36;
  doc.setFillColor(15, 30, 58);
  doc.rect(0, 0, pageWidth, bandH, "F");
  doc.setFillColor(201, 162, 39);
  doc.rect(0, bandH, pageWidth, 1, "F");

  const logoY = 3;
  const logoH = 30;
  const logoW = logoH * (640 / 800);
  try {
    doc.addImage(await loadImageAsDataUrl("/ctech-logo.png"), "PNG", marginX, logoY, logoW, logoH);
  } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
    doc.text("C-TECH AUTOMOTIVE", marginX, logoY + 18);
  }
  const addrX = marginX + logoW + 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(190, 197, 212);
  doc.text("9016 DRT Highway, Sto. Cristo, Pulilan, Bulacan", addrX, logoY + 13);
  doc.text("0998-1516-245  ·  Mon-Sat 8AM-5PM", addrX, logoY + 19);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(201, 162, 39);
  doc.text("BILLING STATEMENT", pageWidth - marginX, logoY + 9, { align: "right" });
  doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text(bill.bill_no ?? "", pageWidth - marginX, logoY + 22, { align: "right" });
  let y = bandH + 9;

  const colW = (pageWidth - marginX * 2) / 2;
  function metaBlock(x: number, label: string, rows: string[]) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
    doc.text(label.toUpperCase(), x, y);
    let yy = y + 5;
    rows.forEach((line, i) => { doc.setFontSize(i === 0 ? 10.5 : 9.5); doc.setTextColor(20, 38, 61); doc.text(line, x, yy); yy += 5; });
  }
  metaBlock(marginX, "Billed to", [bill.client_name || "—", bill.client_contact || ""]);
  metaBlock(marginX + colW, "Vehicle", [bill.vehicle_description || "—", `Plate ${bill.plate_number || "—"}${bill.odometer_km ? " · " + bill.odometer_km.toLocaleString() + " km" : ""}`]);
  y += 18;
  metaBlock(marginX, "Date issued / due date", [`${fmtDate(bill.created_at)} — ${fmtDate(bill.due_date)}`]);
  metaBlock(marginX + colW, "Prepared by", [preparerName]);
  y += 12;

  const tableOpts = { margin: { left: marginX, right: marginX }, styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: [20, 38, 61] as [number, number, number] }, headStyles: { fillColor: [15, 30, 58] as [number, number, number], textColor: 255, fontStyle: "bold" as const, fontSize: 8.5 }, columnStyles: { 1: { halign: "right" as const, cellWidth: 16 }, 2: { halign: "right" as const, cellWidth: 28 }, 3: { halign: "right" as const, cellWidth: 28 } } };
  const head = [["Description", "Qty", "Unit price", "Amount"]];
  const lineRow = (l: BillLine) => [l.description, String(l.qty), phMoney(l.unit_price), phMoney(l.qty * l.unit_price)];
  function section(title: string, body: string[][], red = false) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(201, 162, 39); doc.text(title, marginX, y - 2);
    autoTable(doc, { ...tableOpts, startY: y + 1, head, body, ...(red ? { bodyStyles: { textColor: [185, 28, 28] as [number, number, number] } } : {}) });
    y = lastY() + 8;
  }
  section("SERVICES", svc.length ? svc.map(lineRow) : [["No service lines", "", "", ""]]);
  section("PARTS", parts.length ? parts.map(lineRow) : [["No part lines", "", "", ""]]);
  if (deductions.length) section("LESS & DISCOUNTS", deductions.map(lineRow), true);
  y -= 2;

  const rows: [string, number, [number, number, number]][] = [
    ["Subtotal, services", totals.services, [90, 100, 115]],
    ["Subtotal, parts", totals.parts, [90, 100, 115]],
    ...(totals.deductions > 0 ? [["Less & discounts", -totals.deductions, [185, 28, 28]] as [string, number, [number, number, number]]] : []),
    ["Total amount", bill.total_amount ?? 0, [20, 38, 61]],
    ["Amount paid", -(bill.amount_paid ?? 0), [4, 120, 87]],
  ];
  const boxW = 75, boxX = pageWidth - marginX - boxW, boxH = rows.length * 5 + 12;
  doc.setDrawColor(15, 30, 58); doc.setLineWidth(0.3); doc.rect(boxX, y, boxW, boxH);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  rows.forEach(([label, value, color], i) => {
    doc.setTextColor(...color);
    doc.text(label, boxX + 3, y + 6 + i * 5); doc.text(phMoney(value), boxX + boxW - 3, y + 6 + i * 5, { align: "right" });
  });
  doc.setFillColor(15, 30, 58); doc.rect(boxX, y + boxH - 8, boxW, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
  doc.text("Balance due", boxX + 3, y + boxH - 2.5); doc.text(phMoney(bill.balance ?? 0), boxX + boxW - 3, y + boxH - 2.5, { align: "right" });

  if (payments.length) {
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      margin: { left: marginX, right: marginX + boxW + 6 },
      head: [["Payment date", "Method", "Amount"]],
      body: payments.map((p) => [fmtDate(p.paid_at), METHOD_LABEL[p.method] + (p.reference ? ` (${p.reference})` : ""), phMoney(p.amount)]),
      columnStyles: { 2: { halign: "right" as const } },
    });
    y = Math.max(y + boxH, lastY()) + 8;
  } else {
    y += boxH + 8;
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
  doc.text("INCLUSIONS & NOTES", marginX, y);
  doc.setFontSize(9); doc.setTextColor(20, 38, 61);
  const noteLines = doc.splitTextToSize(bill.notes || "—", pageWidth - marginX * 2);
  doc.text(noteLines, marginX, y + 5);
  y += 5 + noteLines.length * 4.2 + 6;

  doc.setDrawColor(212, 217, 224); doc.setLineWidth(0.2); doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140);
  const terms = "This is a billing statement and not an official receipt. Please settle the balance on or before the due date. Thank you for choosing C-Tech Automotive.";
  doc.text(doc.splitTextToSize(terms, pageWidth - marginX * 2), marginX, y);

  doc.save(`C-Tech-Billing-${bill.bill_no}.pdf`);
}
