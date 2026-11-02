import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ClipboardCheck, LogOut, MapPin, Minus, Phone, Plus, Printer, Send, Trash2, Wrench } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { OIL_CHANGE_INCLUSIONS, PMS_INCLUSIONS, parsePackage, type PackageInfo } from "@/lib/packages";
import { publicBillUrl } from "@/lib/quotation-message";
import { bluetoothSupported, buildReceipt, connectedPrinterName, forgetPrinter, printBluetooth, rawbtUrl, type ReceiptData } from "@/lib/thermal-print";

export const Route = createFileRoute("/tech")({
  head: () => ({ meta: [{ title: "Home Service — C-Tech Automotive" }] }),
  component: TechApp,
});

// Phone screen for technicians on home service: pick the booking, tap the
// work done (big buttons for dirty hands), take payment, print a receipt.

type Booking = {
  id: string; visit_date: string; time_slot: string; service_type: string; vehicle: string | null;
  barangay: string | null; municipality: string | null; maps_link: string | null;
  name: string; contact: string | null; status: string; estimate_summary: string | null;
};
type CatalogItem = { id: string; name: string; price: number };
type Saved = { title: string; price: number; category: "service" | "part"; count: number };
type JobLine = { key: number; title: string; category: "service" | "part"; qty: number; price: number; service_pricing_id: string | null };
type MyBill = { id: string; bill_no: string; client_name: string | null; total_amount: number; amount_paid: number; created_at: string };

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";
const manilaDate = (n = 0) => new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const bigInput = "w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base focus:border-[#0F1E3A] focus:outline-none";
const label = "mb-1 block text-sm font-semibold text-stone-700";
let lineKey = 1;

function TechApp() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ staffId: string | null; name: string } | null>(null);
  const [view, setView] = useState<"home" | "job" | "pay" | "done">("home");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBills, setMyBills] = useState<MyBill[]>([]);
  const [packages, setPackages] = useState<{ item: CatalogItem; pkg: PackageInfo }[]>([]);
  const [common, setCommon] = useState<Saved[]>([]);

  // Job being built
  const [booking, setBooking] = useState<Booking | null>(null);
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [km, setKm] = useState("");
  const [lines, setLines] = useState<JobLine[]>([]);
  const [otherName, setOtherName] = useState("");
  const [otherPrice, setOtherPrice] = useState("");
  const [otherCat, setOtherCat] = useState<"service" | "part">("service");
  const [pkgType, setPkgType] = useState<PackageInfo["type"]>("PMS");
  const [pkgSize, setPkgSize] = useState<string | null>(null);
  const [pkgGrade, setPkgGrade] = useState("Fully Synthetic");

  // Job details (PMS / oil change checklist, oil used, next service, findings)
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const [oilBrand, setOilBrand] = useState("");
  const [nextKm, setNextKm] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [findings, setFindings] = useState("");

  // Payment + result
  const [method, setMethod] = useState<"cash" | "gcash" | "later">("cash");
  const [paid, setPaid] = useState("");
  const [gcashRef, setGcashRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<(ReceiptData & { billId: string }) | null>(null);
  const [printing, setPrinting] = useState(false);

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const pkgLine = lines.find((l) => parsePackage(l.title)) ?? null;
  const jobPkg = pkgLine ? parsePackage(pkgLine.title) : null;
  const checklist = jobPkg ? (jobPkg.type === "PMS" ? PMS_INCLUSIONS : OIL_CHANGE_INCLUSIONS) : [];
  const viscosity = pkgLine?.title.match(/\(([^)]+)\)/)?.[1] ?? "";
  const defaultNextKm = km ? Number(km) + 5000 : null;
  const defaultNextDate = (() => { const d = new Date(Date.now() + 8 * 3600000); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 10); })();
  const nextKmValue = nextKm ? Number(nextKm) : defaultNextKm;
  const nextDateValue = nextDate || defaultNextDate;

  // The full write-up of the job: goes on the bill notes, service history and receipt.
  function detailsText(): string {
    const out: string[] = [];
    if (jobPkg) {
      out.push(`${jobPkg.type === "PMS" ? "PMS" : "Oil change"} checklist:`);
      for (const item of checklist) out.push(`${unchecked[item] ? "✗" : "✓"} ${item}${unchecked[item] ? " (not done)" : ""}`);
      out.push(`Oil used: ${[oilBrand.trim(), `${jobPkg.liters}L`, jobPkg.grade, viscosity].filter(Boolean).join(" ")}`);
    }
    const nd = new Date(nextDateValue + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    if (jobPkg || km) out.push(`Next ${jobPkg?.type === "Oil Change" ? "oil change" : "PMS"}: ${nextKmValue ? `${nextKmValue.toLocaleString()} km or ` : ""}${nd}, whichever comes first`);
    if (findings.trim()) out.push(`Findings / recommendations: ${findings.trim()}`);
    return out.join("\n");
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: role } = await supabaseFleet.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (role?.role !== "technician" && role?.role !== "admin") { navigate({ to: "/login" }); return; }
      const { data: staff } = await supabaseFleet.from("staff").select("id, full_name").ilike("email", user.email ?? "").maybeSingle();
      setMe({ staffId: staff?.id ?? null, name: staff?.full_name ?? user.email ?? "Technician" });
      const [{ data: cat }, { data: past }] = await Promise.all([
        supabaseFleet.from("service_pricing").select("id, name, price").eq("active", true),
        supabaseFleet.from("quote_line_items").select("description, unit_price, category").gt("unit_price", 0).order("created_at", { ascending: false }).limit(2000),
      ]);
      setPackages(((cat ?? []) as CatalogItem[]).map((item) => ({ item, pkg: parsePackage(item.name) })).filter((p): p is { item: CatalogItem; pkg: PackageInfo } => p.pkg !== null));
      // The shop's most-quoted non-package items become the one-tap tiles.
      const seen = new Map<string, Saved>();
      for (const l of (past ?? []) as { description: string; unit_price: number; category: "service" | "part" }[]) {
        const title = l.description.split("\n")[0].trim();
        if (!title || parsePackage(title)) continue;
        const k = title.toLowerCase();
        const prev = seen.get(k);
        if (prev) prev.count++;
        else seen.set(k, { title, price: Number(l.unit_price), category: l.category, count: 1 });
      }
      setCommon([...seen.values()].sort((a, b) => b.count - a.count).slice(0, 12));
    })();
  }, [navigate]);

  async function loadHome() {
    if (!me) return;
    const [{ data: bk }, { data: bills }] = await Promise.all([
      supabaseFleet.from("home_service_bookings").select("*").in("status", ["pending", "confirmed"]).gte("visit_date", manilaDate(0)).lte("visit_date", manilaDate(1)).order("visit_date").order("time_slot"),
      me.staffId
        ? supabaseFleet.from("bills").select("id, bill_no, client_name, total_amount, amount_paid, created_at").eq("prepared_by", me.staffId).neq("status", "void").gte("created_at", `${manilaDate(0)}T00:00:00+08:00`).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setBookings((bk ?? []) as Booking[]);
    setMyBills((bills ?? []) as MyBill[]);
  }
  useEffect(() => { if (view === "home") void loadHome(); }, [me, view]);

  function startJob(b: Booking | null) {
    setBooking(b);
    setClient(b?.name ?? ""); setPhone(b?.contact ?? ""); setVehicle(b?.vehicle ?? "");
    setPlate(""); setKm(""); setLines([]); setOtherName(""); setOtherPrice("");
    setMethod("cash"); setPaid(""); setGcashRef(""); setReceipt(null);
    setUnchecked({}); setOilBrand(""); setNextKm(""); setNextDate(""); setFindings("");
    setView("job");
    window.scrollTo(0, 0);
  }

  function addLine(title: string, category: "service" | "part", price: number, service_pricing_id: string | null = null) {
    setLines((c) => {
      const same = c.find((l) => l.title === title && l.price === price);
      if (same) return c.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: lineKey++, title, category, qty: 1, price, service_pricing_id }];
    });
    toast.success(`Added ${title}`, { duration: 1200 });
  }
  const changeQty = (key: number, d: number) => setLines((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  const pkgSizes = useMemo(
    () => Array.from(new Map(packages.filter((p) => p.pkg.type === pkgType).map((p) => [p.pkg.size, p.pkg.liters])).entries()).sort((a, b) => a[1] - b[1]).map(([s]) => s),
    [packages, pkgType],
  );
  const pkgMatch = packages.find((p) => p.pkg.type === pkgType && p.pkg.size === pkgSize && p.pkg.grade === pkgGrade) ?? null;

  async function finish() {
    if (!client.trim()) { toast.error("Enter the customer's name"); setView("job"); return; }
    if (!lines.length) { toast.error("Add at least one item"); setView("job"); return; }
    const amount = method === "later" ? 0 : Number(paid || total);
    const details = detailsText();
    setSaving(true);
    try {
      const place = [booking?.barangay, booking?.municipality].filter(Boolean).join(", ");
      const { data: bill, error } = await supabaseFleet.from("bills").insert({
        client_name: client.trim(),
        client_contact: phone.trim() || null,
        vehicle_description: vehicle.trim() || "Home service vehicle",
        plate_number: plate.trim().toUpperCase() || null,
        odometer_km: km ? Number(km) : null,
        prepared_by: me?.staffId ?? null,
        notes: [`Home service${place ? ` — ${place}` : ""}${me ? ` · Technician: ${me.name}` : ""}`, details].filter(Boolean).join("\n"),
        home_service_booking_id: booking?.id ?? null,
        source: "home_service",
      }).select("id, bill_no").single();
      if (error) throw error;
      const { error: lErr } = await supabaseFleet.from("bill_line_items").insert(
        lines.map((l) => ({ bill_id: bill.id, category: l.category, description: l.title, qty: l.qty, unit_price: l.price, service_pricing_id: l.service_pricing_id })),
      );
      if (lErr) throw lErr;
      if (amount > 0) {
        const { error: pErr } = await supabaseFleet.from("bill_payments").insert({
          bill_id: bill.id, amount, method, reference: method === "gcash" ? gcashRef.trim() || null : null, received_by: me?.staffId ?? null,
        });
        if (pErr) throw pErr;
      }
      // Best effort: car history + PMS clock (needs a plate), and close the booking.
      if (plate.trim()) {
        const { error: hErr } = await supabaseFleet.rpc("log_bill_to_history", { p_bill_id: bill.id, p_odometer: km ? Number(km) : null, p_job_order_no: null, p_technician: me?.name ?? null, p_plate: plate.trim(),
          p_recommendation: findings.trim() || null, p_next_km: nextKmValue, p_notes: details || null });
        if (hErr) toast.error(`Saved, but not added to service history: ${hErr.message}`);
      }
      if (booking) await supabaseFleet.from("home_service_bookings").update({ status: "completed" }).eq("id", booking.id);

      setReceipt({
        billId: bill.id, billNo: bill.bill_no, date: new Date(), client: client.trim(), phone: phone.trim() || null,
        vehicle: vehicle.trim() || null, plate: plate.trim().toUpperCase() || null, odometer: km ? Number(km) : null,
        lines: lines.map((l) => ({ title: l.title, qty: l.qty, amount: l.qty * l.price })), deductions: 0, total, paid: amount,
        method: amount > 0 ? (method === "gcash" ? "GCash" : "Cash") : null, technician: me?.name ?? null, link: publicBillUrl(bill.id),
        details,
      });
      setView("done");
      window.scrollTo(0, 0);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Couldn't save the bill");
    } finally {
      setSaving(false);
    }
  }

  async function reprint(b: MyBill) {
    const { data: ls } = await supabaseFleet.from("bill_line_items").select("description, qty, unit_price, amount").eq("bill_id", b.id).order("created_at");
    const { data: full } = await supabaseFleet.from("bills").select("client_contact, vehicle_description, plate_number, odometer_km, notes").eq("id", b.id).single();
    const rows = (ls ?? []) as { description: string; qty: number; unit_price: number; amount: number }[];
    setReceipt({
      billId: b.id, billNo: b.bill_no, date: new Date(b.created_at), client: b.client_name ?? "", phone: full?.client_contact, vehicle: full?.vehicle_description,
      plate: full?.plate_number, odometer: full?.odometer_km, lines: rows.filter((r) => r.amount >= 0).map((r) => ({ title: r.description.split("\n")[0], qty: r.qty, amount: Number(r.amount) })),
      deductions: -rows.filter((r) => r.amount < 0).reduce((s, r) => s + Number(r.amount), 0), total: Number(b.total_amount), paid: Number(b.amount_paid),
      method: null, technician: me?.name ?? null, link: publicBillUrl(b.id),
      details: (full?.notes ?? "").split("\n").slice(1).join("\n"),
    });
    setView("done");
  }

  async function doPrint() {
    if (!receipt) return;
    setPrinting(true);
    try {
      await printBluetooth(buildReceipt(receipt));
      toast.success("Receipt sent to printer 🖨️");
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      if (!/cancel/i.test(msg)) toast.error(msg || "Couldn't print. Check the printer is on and nearby.");
      forgetPrinter();
    } finally {
      setPrinting(false);
    }
  }

  function sendLink() {
    if (!receipt?.link) return;
    const text = `Good day po! 😊 Here's your C-Tech home service bill (${receipt.billNo}): ${receipt.link}\nThank you po! 🙏`;
    if (navigator.share) void navigator.share({ title: "C-Tech bill", text }).catch(() => {});
    else window.location.href = `sms:${receipt.phone ?? ""}?body=${encodeURIComponent(text)}`;
  }

  async function signOut() {
    await supabaseFleet.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-stone-100 pb-32">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: NAVY }}>
        <div className="flex items-center gap-2">
          {view !== "home" ? (
            <button onClick={() => setView(view === "pay" ? "job" : "home")} className="-ml-2 rounded-lg p-2" aria-label="Back"><ArrowLeft className="h-6 w-6" /></button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: GOLD }}><Wrench className="h-5 w-5 text-white" /></div>
          )}
          <div className="leading-tight">
            <div className="font-bold">Home Service</div>
            <div className="text-xs text-white/70">{me.name}</div>
          </div>
        </div>
        {view === "home" && <button onClick={() => void signOut()} className="rounded-lg p-2 text-white/70" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>}
      </header>

      {view === "home" && (
        <main className="space-y-5 p-4">
          <button onClick={() => startJob(null)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-lg font-bold shadow" style={{ backgroundColor: GOLD, color: NAVY }}>
            <Plus className="h-6 w-6" /> Start new job
          </button>

          <section>
            <h2 className="mb-2 font-bold" style={{ color: NAVY }}>Bookings — today &amp; tomorrow</h2>
            {bookings.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 text-center text-stone-500">No home service bookings.</div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-bold" style={{ color: NAVY }}>{b.name}</div>
                        <div className="text-sm text-stone-600">{b.vehicle}</div>
                        <div className="mt-1 text-sm font-semibold text-stone-700">{b.visit_date === manilaDate(0) ? "Today" : "Tomorrow"} · {b.time_slot} · {b.service_type}</div>
                        <div className="text-sm text-stone-500">{[b.barangay, b.municipality].filter(Boolean).join(", ")}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{b.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {b.contact ? <a href={`tel:${b.contact.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-1 rounded-xl border-2 border-stone-200 py-3 font-semibold text-stone-700"><Phone className="h-4 w-4" /> Call</a> : <span />}
                      {b.maps_link ? <a href={b.maps_link} target="_blank" rel="noopener" className="flex items-center justify-center gap-1 rounded-xl border-2 border-stone-200 py-3 font-semibold text-stone-700"><MapPin className="h-4 w-4" /> Map</a> : <span />}
                      <button onClick={() => startJob(b)} className="rounded-xl py-3 font-bold text-white" style={{ backgroundColor: NAVY }}>Start</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {myBills.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold" style={{ color: NAVY }}>My jobs today</h2>
              <div className="divide-y divide-stone-100 rounded-2xl bg-white shadow-sm">
                {myBills.map((b) => (
                  <button key={b.id} onClick={() => void reprint(b)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
                    <div>
                      <div className="font-semibold" style={{ color: NAVY }}>{b.client_name}</div>
                      <div className="font-mono text-xs text-stone-500">{b.bill_no}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{peso(Number(b.total_amount))}</div>
                      <div className="flex items-center justify-end gap-1 text-xs text-stone-500"><Printer className="h-3.5 w-3.5" /> Reprint</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {view === "job" && (
        <main className="space-y-4 p-4">
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Customer &amp; car</h2>
            <div><label className={label}>Customer name *</label><input className={bigInput} value={client} onChange={(e) => setClient(e.target.value)} /></div>
            <div><label className={label}>Phone</label><input className={bigInput} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label className={label}>Car</label><input className={bigInput} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. Toyota Vios 2019" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Plate no.</label><input className={bigInput} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC 1234" /></div>
              <div><label className={label}>Odometer (km)</label><input className={bigInput} inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} /></div>
            </div>
            {booking?.estimate_summary && <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600"><span className="font-semibold">Booked estimate:</span> {booking.estimate_summary}</div>}
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold" style={{ color: NAVY }}>Package</h2>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["PMS", "Oil Change"] as const).map((t) => (
                <button key={t} onClick={() => { setPkgType(t); setPkgSize(null); }} className={`rounded-xl py-3 font-bold ${pkgType === t ? "text-white" : "border-2 border-stone-200 text-stone-700"}`} style={pkgType === t ? { backgroundColor: t === "PMS" ? GOLD : "#2563EB" } : undefined}>{t}</button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {pkgSizes.map((s) => (
                <button key={s} onClick={() => setPkgSize(s)} className={`rounded-xl px-1 py-3 text-sm font-semibold ${pkgSize === s ? "text-white" : "border-2 border-stone-200 text-stone-700"}`} style={pkgSize === s ? { backgroundColor: NAVY } : undefined}>{s}</button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {["Fully Synthetic", "Semi-Synthetic"].map((g) => (
                <button key={g} onClick={() => setPkgGrade(g)} className={`rounded-xl py-3 text-sm font-semibold ${pkgGrade === g ? "text-white" : "border-2 border-stone-200 text-stone-700"}`} style={pkgGrade === g ? { backgroundColor: NAVY } : undefined}>{g}</button>
              ))}
            </div>
            <button disabled={!pkgMatch} onClick={() => pkgMatch && addLine(pkgMatch.item.name, "service", Number(pkgMatch.item.price), pkgMatch.item.id)} className="w-full rounded-xl py-4 text-base font-bold disabled:opacity-40" style={{ backgroundColor: GOLD, color: NAVY }}>
              {pkgMatch ? `Add ${pkgType} ${pkgMatch.pkg.size} — ${peso(Number(pkgMatch.item.price))}` : pkgSize ? "Not offered in this grade" : "Pick the oil size"}
            </button>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold" style={{ color: NAVY }}>Common items</h2>
            <div className="grid grid-cols-2 gap-2">
              {common.map((c) => (
                <button key={c.title} onClick={() => addLine(c.title, c.category, c.price)} className="min-h-[72px] rounded-xl border-2 border-stone-200 p-3 text-left active:bg-amber-50">
                  <div className="text-sm font-semibold leading-tight" style={{ color: NAVY }}>{c.title}</div>
                  <div className="mt-1 font-mono text-sm text-stone-600">{peso(c.price)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Other item</h2>
            <input className={bigInput} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Type or tap 🎤 on the keyboard to speak" />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className={bigInput} inputMode="decimal" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price ₱" />
              <div className="flex overflow-hidden rounded-xl border-2 border-stone-300">
                {(["service", "part"] as const).map((c) => (
                  <button key={c} onClick={() => setOtherCat(c)} className={`px-3 text-sm font-semibold ${otherCat === c ? "text-white" : "text-stone-600"}`} style={otherCat === c ? { backgroundColor: NAVY } : undefined}>{c === "service" ? "Service" : "Part"}</button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const p = Number(otherPrice);
                if (!otherName.trim() || !p) { toast.error("Type the item and its price"); return; }
                addLine(otherName.trim(), otherCat, p);
                setOtherName(""); setOtherPrice("");
              }}
              className="w-full rounded-xl border-2 py-3 font-bold" style={{ borderColor: NAVY, color: NAVY }}
            >
              Add item
            </button>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-bold" style={{ color: NAVY }}>Work done ({lines.length})</h2>
            {lines.length === 0 ? (
              <div className="py-4 text-center text-stone-500">Nothing added yet.</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {lines.map((l) => (
                  <div key={l.key} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold" style={{ color: NAVY }}>{l.title}</div>
                      <div className="shrink-0 font-mono font-bold">{peso(l.qty * l.price)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => changeQty(l.key, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-stone-200" aria-label="Less">{l.qty === 1 ? <Trash2 className="h-5 w-5 text-red-500" /> : <Minus className="h-5 w-5" />}</button>
                      <span className="w-8 text-center text-lg font-bold">{l.qty}</span>
                      <button onClick={() => changeQty(l.key, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-stone-200" aria-label="More"><Plus className="h-5 w-5" /></button>
                      <span className="text-sm text-stone-500">×</span>
                      <input inputMode="decimal" aria-label="Price" className="w-28 rounded-xl border-2 border-stone-200 px-3 py-2 text-right" value={l.price} onChange={(e) => setLines((c) => c.map((x) => (x.key === l.key ? { ...x, price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x)))} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: NAVY }}><ClipboardCheck className="h-5 w-5" /> Job details</h2>

            {jobPkg ? (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-stone-700">{jobPkg.type} checklist — untick anything not done</span>
                    <span className="text-sm font-bold" style={{ color: NAVY }}>{checklist.filter((i) => !unchecked[i]).length}/{checklist.length}</span>
                  </div>
                  <div className="divide-y divide-stone-100 rounded-xl border-2 border-stone-200">
                    {checklist.map((item) => {
                      const done = !unchecked[item];
                      return (
                        <button key={item} onClick={() => setUnchecked((u) => ({ ...u, [item]: done }))} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${done ? "border-emerald-600 bg-emerald-600" : "border-stone-300 bg-white"}`}>
                            {done && <Check className="h-5 w-5 text-white" />}
                          </span>
                          <span className={`text-base ${done ? "text-stone-800" : "text-stone-400 line-through"}`}>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={label}>Oil used</label>
                  <div className="mb-2 rounded-xl bg-stone-50 px-4 py-3 text-base font-semibold" style={{ color: NAVY }}>{jobPkg.liters}L · {jobPkg.grade}{viscosity ? ` · ${viscosity}` : ""}</div>
                  <input className={bigInput} value={oilBrand} onChange={(e) => setOilBrand(e.target.value)} placeholder="Oil brand (e.g. the brand on the bottle)" />
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500">Add a PMS or Oil Change package above to get its full checklist.</p>
            )}

            <div>
              <label className={label}>Next {jobPkg?.type === "Oil Change" ? "oil change" : "PMS"} due</label>
              <div className="grid grid-cols-2 gap-3">
                <input className={bigInput} inputMode="numeric" value={nextKm} onChange={(e) => setNextKm(e.target.value.replace(/\D/g, ""))} placeholder={defaultNextKm ? `${defaultNextKm.toLocaleString()} km` : "km"} />
                <input type="date" className={bigInput} value={nextDateValue} onChange={(e) => setNextDate(e.target.value)} />
              </div>
              <p className="mt-1 text-xs text-stone-500">{km ? "Suggested: +5,000 km or 3 months — change if needed." : "Enter the odometer above to suggest the next km."}</p>
            </div>

            <div>
              <label className={label}>Findings / recommendations</label>
              <textarea className={bigInput} rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="e.g. Front brake pads at 30%, replace next visit. (Tap 🎤 to speak)" />
            </div>
          </section>
        </main>
      )}

      {view === "pay" && (
        <main className="space-y-4 p-4">
          <section className="rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-sm font-semibold text-stone-500">{client || "Customer"} · {lines.length} item{lines.length === 1 ? "" : "s"}</div>
            <div className="mt-1 text-4xl font-bold" style={{ color: NAVY }}>{peso(total)}</div>
            {jobPkg && <div className="mt-2 text-sm text-stone-600">{jobPkg.type} checklist: {checklist.filter((i) => !unchecked[i]).length} of {checklist.length} done</div>}
            {nextKmValue && <div className="text-sm text-stone-600">Next due: {nextKmValue.toLocaleString()} km or {new Date(nextDateValue + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</div>}
          </section>
          <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Payment</h2>
            <div className="grid grid-cols-3 gap-2">
              {([["cash", "Cash"], ["gcash", "GCash"], ["later", "Pay later"]] as const).map(([m, t]) => (
                <button key={m} onClick={() => setMethod(m)} className={`rounded-xl py-4 font-bold ${method === m ? "text-white" : "border-2 border-stone-200 text-stone-700"}`} style={method === m ? { backgroundColor: NAVY } : undefined}>{t}</button>
              ))}
            </div>
            {method !== "later" && (
              <div><label className={label}>Amount received</label><input className={bigInput} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(total)} /></div>
            )}
            {method === "gcash" && (
              <div><label className={label}>GCash reference no.</label><input className={bigInput} inputMode="numeric" value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} /></div>
            )}
            {method !== "later" && Number(paid || total) < total && <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Balance left: {peso(total - Number(paid || total))}</div>}
          </section>
        </main>
      )}

      {view === "done" && receipt && (
        <main className="space-y-4 p-4">
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><Check className="h-8 w-8 text-emerald-600" /></div>
            <div className="text-lg font-bold" style={{ color: NAVY }}>Saved {receipt.billNo}</div>
            <div className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>{peso(receipt.total)}</div>
            <div className="text-sm text-stone-600">Paid {peso(receipt.paid)} · Balance {peso(Math.max(0, receipt.total - receipt.paid))}</div>
          </section>
          {bluetoothSupported() ? (
            <button disabled={printing} onClick={() => void doPrint()} className="flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-lg font-bold shadow disabled:opacity-50" style={{ backgroundColor: GOLD, color: NAVY }}>
              <Printer className="h-6 w-6" /> {printing ? "Printing…" : connectedPrinterName() ? `Print receipt (${connectedPrinterName()})` : "Print receipt"}
            </button>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">This browser can't reach Bluetooth printers. Use Chrome on Android, or the RawBT button below.</div>
          )}
          <a href={rawbtUrl(buildReceipt(receipt))} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white py-4 font-semibold text-stone-700">
            <Printer className="h-5 w-5" /> Print with RawBT app
          </a>
          <button onClick={sendLink} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 bg-white py-4 font-semibold" style={{ borderColor: NAVY, color: NAVY }}>
            <Send className="h-5 w-5" /> Send bill link to customer
          </button>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => startJob(null)} className="rounded-2xl bg-white py-4 font-semibold text-stone-700 shadow-sm">Next job</button>
            <button onClick={() => setView("home")} className="rounded-2xl bg-white py-4 font-semibold text-stone-700 shadow-sm">Back to bookings</button>
          </div>
        </main>
      )}

      {(view === "job" || view === "pay") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          {view === "job" ? (
            <button onClick={() => { if (!lines.length) { toast.error("Add at least one item"); return; } setPaid(""); setView("pay"); window.scrollTo(0, 0); }} className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-lg font-bold text-white" style={{ backgroundColor: NAVY }}>
              <span>{peso(total)}</span><span>Next: Payment →</span>
            </button>
          ) : (
            <button disabled={saving} onClick={() => void finish()} className="w-full rounded-2xl py-4 text-lg font-bold disabled:opacity-50" style={{ backgroundColor: GOLD, color: NAVY }}>
              {saving ? "Saving…" : "Finish & save bill"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
