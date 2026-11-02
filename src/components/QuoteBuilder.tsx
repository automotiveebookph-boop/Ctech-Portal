import { useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { isDeduction, pesoSigned, quoteTotals } from "@/lib/quote-lines";
import { OIL_CHANGE_INCLUSIONS, PMS_INCLUSIONS, parsePackage, type PackageInfo } from "@/lib/packages";

type CatalogItem = { id: string; category: string; name: string; price: number };
type StaffOption = { id: string; full_name: string };
type CustomerResult = { id: string; full_name: string; email: string | null; phone: string | null };
type VehicleResult = { id: string; plate_number: string; make: string; model: string; year: number | null; customer_id: string | null };
type SavedItem = { title: string; price: number; category: "service" | "part"; count: number };
type Line = { key: number; category: "service" | "part"; description: string; qty: number; unit_price: number; service_pricing_id?: string | null };

const catLabel = (c: string) => ({ package: "PMS & Oil Change Packages", engine_oil: "Engine Oil", filter: "Filters", wheel_balance: "Wheel Service", add_on: "Add-ons" }[c] ?? c);
const catToLineCategory = (c: string): "service" | "part" => (c === "filter" ? "part" : "service");
const packageBadge = (item: CatalogItem): { label: string; color: string } => {
  if (item.category === "package") {
    if (item.name.startsWith("PMS")) return { label: "PMS", color: "#C9A227" };
    if (item.name.startsWith("Oil Change")) return { label: "OIL CHANGE", color: "#2563EB" };
  }
  return { label: catLabel(item.category), color: "#C9A227" };
};
const isoPlusDays =(n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const labelCls = "mb-1 block text-xs font-semibold uppercase text-stone-600";

type InclusionType = "custom" | "pms" | "oil_change";
const INCLUSION_TABS: { value: InclusionType; label: string }[] = [
  { value: "custom", label: "Custom / free text" },
  { value: "pms", label: "PMS Package" },
  { value: "oil_change", label: "Oil Change Package" },
];

// Sub-inclusions of a custom line are stored inside the description itself:
// first line is the service name, each following line is a "• item" (no price).
function buildLineDescription(title: string, inclusions: string): string {
  const items = inclusions.split("\n").map((s) => s.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
  return [title.trim(), ...items.map((i) => `• ${i}`)].join("\n");
}

function listToSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildInclusionsNotes(checklist: string[], additional: string): string {
  const sentence = checklist.length ? `Includes ${listToSentence(checklist)}.` : "";
  const extra = additional.trim();
  if (sentence && extra) return `${sentence} ${extra}`;
  return sentence || extra;
}

// The same builder edits quotations and billing statements; only the tables,
// the date field and the wording differ.
const KIND = {
  quote: { table: "quotes", linesTable: "quote_line_items", fk: "quote_id", dateField: "valid_until", dateLabel: "Valid until", noun: "quotation", defaultDays: 7 },
  bill: { table: "bills", linesTable: "bill_line_items", fk: "bill_id", dateField: "due_date", dateLabel: "Due date", noun: "billing statement", defaultDays: 0 },
} as const;

export function QuoteBuilder({
  kind = "quote",
  quoteId,
  initialCustomer = null,
  initialVehicle = null,
  initialClientName = "",
  initialClientContact = "",
  initialVehicleDescription = "",
  initialPlateNumber = "",
  initialOdometerKm = "",
  initialValidUntil,
  initialPreparedBy = "",
  initialNotes = "Includes: Free ECU Scan, Safety Inspection.",
  initialLines = [],
}: {
  kind?: "quote" | "bill";
  /** id of the quote (or bill, when kind="bill") being edited */
  quoteId?: string;
  initialCustomer?: CustomerResult | null;
  initialVehicle?: VehicleResult | null;
  initialClientName?: string;
  initialClientContact?: string;
  initialVehicleDescription?: string;
  initialPlateNumber?: string;
  initialOdometerKm?: string;
  initialValidUntil?: string;
  initialPreparedBy?: string;
  initialNotes?: string;
  initialLines?: { category: "service" | "part"; description: string; qty: number; unit_price: number; service_pricing_id?: string | null }[];
}) {
  const isEdit = Boolean(quoteId);
  const cfg = KIND[kind];
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [saving, setSaving] = useState(false);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(initialCustomer ? "existing" : "new");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [customer, setCustomer] = useState<CustomerResult | null>(initialCustomer);
  const [clientName, setClientName] = useState(initialClientName);
  const [clientContact, setClientContact] = useState(initialClientContact);

  const [vehicleMode, setVehicleMode] = useState<"existing" | "new">(initialVehicle ? "existing" : "new");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleResults, setVehicleResults] = useState<VehicleResult[]>([]);
  const [vehicle, setVehicle] = useState<VehicleResult | null>(initialVehicle);
  const [vehicleDescription, setVehicleDescription] = useState(initialVehicleDescription);
  const [plateNumber, setPlateNumber] = useState(initialPlateNumber);
  const [odometerKm, setOdometerKm] = useState(initialOdometerKm);

  const [validUntil, setValidUntil] = useState(initialValidUntil ?? isoPlusDays(cfg.defaultDays));
  const [preparedBy, setPreparedBy] = useState(initialPreparedBy);
  const [inclusionType, setInclusionType] = useState<InclusionType>("custom");
  const [checkedInclusions, setCheckedInclusions] = useState<Record<string, boolean>>({});
  const [additionalNotes, setAdditionalNotes] = useState(initialNotes);

  const activeChecklist = inclusionType === "pms" ? PMS_INCLUSIONS : inclusionType === "oil_change" ? OIL_CHANGE_INCLUSIONS : [];
  const checkedItems = activeChecklist.filter((item) => checkedInclusions[item] ?? true);

  const [lines, setLines] = useState<Line[]>(() => initialLines.map((l, i) => ({ ...l, key: i + 1 })));
  const nextKey = useRef(initialLines.length + 1);
  const [customDesc, setCustomDesc] = useState("");
  const [customCat, setCustomCat] = useState<"service" | "part">("service");
  const [customQty, setCustomQty] = useState("1");
  const [customPrice, setCustomPrice] = useState("");
  const [customInclusions, setCustomInclusions] = useState("");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const savedMatch = savedItems.find((s) => s.title.toLowerCase() === customDesc.trim().toLowerCase()) ?? null;

  function onCustomDescChange(value: string) {
    setCustomDesc(value);
    // Picking a remembered line fills in its last price and type (only if price is still empty).
    const hit = savedItems.find((s) => s.title.toLowerCase() === value.trim().toLowerCase());
    if (hit && !customPrice) { setCustomPrice(String(hit.price)); setCustomCat(hit.category); }
  }
  const [dedKind, setDedKind] = useState<"discount" | "less">("discount");
  const [dedReason, setDedReason] = useState("");
  const [dedCat, setDedCat] = useState<"service" | "part">("service");
  const [dedAmount, setDedAmount] = useState("");
  const [dedUnit, setDedUnit] = useState<"peso" | "percent">("peso");

  useEffect(() => {
    (async () => {
      const [{ data: cat }, { data: st }, { data: past }] = await Promise.all([
        supabaseFleet.from("service_pricing").select("id, category, name, price").eq("active", true).order("category").order("name"),
        supabaseFleet.from("staff").select("id, full_name").eq("active", true).order("full_name"),
        supabaseFleet.from("quote_line_items").select("description, unit_price, category").gt("unit_price", 0).order("created_at", { ascending: false }).limit(2000),
      ]);
      setCatalog((cat ?? []) as CatalogItem[]);
      setStaff((st ?? []) as StaffOption[]);
      // Remember every line typed before: newest price wins, most-used first.
      const seen = new Map<string, SavedItem>();
      for (const l of (past ?? []) as { description: string; unit_price: number; category: "service" | "part" }[]) {
        const title = l.description.split("\n")[0].trim();
        const key = title.toLowerCase();
        if (!title) continue;
        const prev = seen.get(key);
        if (prev) prev.count++;
        else seen.set(key, { title, price: Number(l.unit_price), category: l.category, count: 1 });
      }
      setSavedItems([...seen.values()].sort((a, b) => b.count - a.count));
      if (st?.length && !initialPreparedBy) setPreparedBy(st[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (customerMode !== "existing" || customerQuery.trim().length < 2) { setCustomerResults([]); return; }
    const handle = setTimeout(async () => {
      const { data } = await supabaseFleet.from("customers").select("id, full_name, email, phone").ilike("full_name", `%${customerQuery}%`).order("full_name").limit(10);
      setCustomerResults((data ?? []) as CustomerResult[]);
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery, customerMode]);

  useEffect(() => {
    if (vehicleMode !== "existing" || vehicleQuery.trim().length < 2) { setVehicleResults([]); return; }
    const handle = setTimeout(async () => {
      let q = supabaseFleet.from("vehicles").select("id, plate_number, make, model, year, customer_id").order("plate_number").limit(10);
      q = customer?.id ? q.eq("customer_id", customer.id) : q.or(`plate_number.ilike.%${vehicleQuery}%,make.ilike.%${vehicleQuery}%,model.ilike.%${vehicleQuery}%`);
      const { data } = await q;
      setVehicleResults((data ?? []) as VehicleResult[]);
    }, 250);
    return () => clearTimeout(handle);
  }, [vehicleQuery, vehicleMode, customer]);

  // A typed plate that's already on file: offer to link the existing customer + car,
  // so the quote / bill lands in that car's history instead of a loose name.
  const [plateMatch, setPlateMatch] = useState<{ vehicle: VehicleResult; customer: CustomerResult | null } | null>(null);
  useEffect(() => {
    const norm = plateNumber.replace(/\s+/g, "").toUpperCase();
    if (vehicleMode !== "new" || norm.length < 3) { setPlateMatch(null); return; }
    const handle = setTimeout(async () => {
      const { data } = await supabaseFleet
        .from("vehicles")
        .select("id, plate_number, make, model, year, customer_id")
        .ilike("plate_number", norm.split("").join("%"))
        .limit(10);
      const v = ((data ?? []) as VehicleResult[]).find((x) => x.plate_number.replace(/\s+/g, "").toUpperCase() === norm);
      if (!v) { setPlateMatch(null); return; }
      const { data: c } = v.customer_id
        ? await supabaseFleet.from("customers").select("id, full_name, email, phone").eq("id", v.customer_id).maybeSingle()
        : { data: null };
      setPlateMatch({ vehicle: v, customer: (c ?? null) as CustomerResult | null });
    }, 300);
    return () => clearTimeout(handle);
  }, [plateNumber, vehicleMode]);

  function applyPlateMatch() {
    if (!plateMatch) return;
    setVehicleMode("existing");
    setVehicle(plateMatch.vehicle);
    if (plateMatch.customer) { setCustomerMode("existing"); setCustomer(plateMatch.customer); }
    setPlateMatch(null);
    toast.success("Linked to the existing customer and car");
  }

  function addLine(line: Omit<Line, "key">) { setLines((c) => [...c, { ...line, key: nextKey.current++ }]); }
  function removeLine(key: number) { setLines((c) => c.filter((l) => l.key !== key)); if (editingKey === key) cancelEdit(); }

  // Clicking a line in the summary loads it back into the custom-line (or
  // discount / less) form; the form's button then replaces it in place.
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const customFormRef = useRef<HTMLDivElement>(null);
  const dedFormRef = useRef<HTMLDivElement>(null);
  const editingLine = lines.find((l) => l.key === editingKey) ?? null;
  const editingDeduction = editingLine ? isDeduction(editingLine) : false;

  function startEdit(l: Line) {
    setEditingKey(l.key);
    if (isDeduction(l)) {
      const [label, ...rest] = l.description.split(": ");
      setDedKind(label.startsWith("Less") ? "less" : "discount");
      setDedReason(rest.join(": "));
      setDedCat(l.category);
      setDedUnit("peso");
      setDedAmount(String(-(l.qty * l.unit_price)));
      setShowDiscount(true);
      setTimeout(() => dedFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    } else {
      const [title, ...items] = l.description.split("\n");
      setCustomDesc(title);
      setCustomInclusions(items.map((i) => i.replace(/^\s*•\s*/, "")).join("\n"));
      setCustomCat(l.category);
      setCustomQty(String(l.qty));
      setCustomPrice(String(l.unit_price));
      if (items.length) setShowSubItems(true);
      setTimeout(() => customFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    }
  }

  function cancelEdit() {
    setEditingKey(null);
    setCustomDesc(""); setCustomPrice(""); setCustomQty("1"); setCustomInclusions("");
    setDedReason(""); setDedAmount("");
  }

  // Adds a new line, or replaces the one being edited (keeping its catalog link).
  function putLine(line: Omit<Line, "key">) {
    if (editingKey == null) { addLine(line); return; }
    setLines((c) => c.map((l) => (l.key === editingKey ? { ...line, key: l.key, service_pricing_id: line.service_pricing_id ?? l.service_pricing_id } : l)));
    setEditingKey(null);
  }

  const totals = quoteTotals(lines);
  const grand = totals.total;

  function addDeduction() {
    const value = Number(dedAmount);
    const reason = dedReason.trim();
    if (!value || value <= 0) { toast.error("Enter a discount / less amount greater than 0"); return; }
    if (dedKind === "less" && !reason) { toast.error("Say which part of the service was not done"); return; }
    // Percent is taken off the gross (pre-deduction) subtotal of the chosen type.
    const base = dedCat === "service" ? totals.services : totals.parts;
    const amount = dedUnit === "percent" ? Math.round((base * value) / 100 * 100) / 100 : value;
    // Never let a type's net go below zero (it becomes the job order's labor/parts cost).
    const netForCat = lines.filter((l) => l.category === dedCat && l.key !== editingKey).reduce((s, l) => s + l.qty * l.unit_price, 0);
    if (amount <= 0 || amount > netForCat) { toast.error(`That is more than the remaining ${dedCat === "service" ? "services" : "parts"} total (${peso(netForCat)})`); return; }
    const label = dedKind === "discount" ? `Discount${dedUnit === "percent" ? ` (${value}%)` : ""}` : "Less";
    putLine({ category: dedCat, description: reason ? `${label}: ${reason}` : label, qty: 1, unit_price: -amount });
    setDedReason(""); setDedAmount("");
  }
  // Packages get their own picker (type → oil size → grade); the rest of the
  // catalog sits behind "Browse catalog" since most lines are typed by hand.
  const packages = catalog.map((item) => ({ item, pkg: parsePackage(item.name) })).filter((p): p is { item: CatalogItem; pkg: PackageInfo } => p.pkg !== null);
  const otherCatalog = catalog.filter((c) => !parsePackage(c.name));
  const categories = ["all", ...Array.from(new Set(otherCatalog.map((c) => c.category)))];
  const filteredCatalog = otherCatalog.filter((c) => activeCat === "all" || c.category === activeCat);
  const [pkgType, setPkgType] = useState<PackageInfo["type"]>("PMS");
  const [pkgSize, setPkgSize] = useState<string | null>(null);
  const [pkgGrade, setPkgGrade] = useState("Fully Synthetic");
  const pkgSizes = Array.from(new Map(packages.filter((p) => p.pkg.type === pkgType).map((p) => [p.pkg.size, p.pkg.liters])).entries())
    .sort((a, b) => a[1] - b[1]).map(([size]) => size);
  const pkgGrades = Array.from(new Set(packages.map((p) => p.pkg.grade))).sort();
  const pkgMatch = packages.find((p) => p.pkg.type === pkgType && p.pkg.size === pkgSize && p.pkg.grade === pkgGrade) ?? null;
  const [lastPkgType, setLastPkgType] = useState<PackageInfo["type"] | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSubItems, setShowSubItems] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);

  function updateLine(key: number, patch: Partial<Pick<Line, "qty" | "unit_price">>) {
    setLines((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  // Unsaved-changes guard: warn before leaving a quote with edits (in-app links and tab close).
  const initialSig = useRef(JSON.stringify(initialLines.map((l) => [l.description, l.qty, l.unit_price])));
  const savedRef = useRef(false);
  const isDirty = () =>
    !savedRef.current &&
    (JSON.stringify(lines.map((l) => [l.description, l.qty, l.unit_price])) !== initialSig.current ||
      customDesc.trim() !== "" ||
      clientName !== initialClientName ||
      vehicleDescription !== initialVehicleDescription);
  useBlocker({
    shouldBlockFn: () => isDirty() && !window.confirm(`Leave without saving? Your changes to this ${cfg.noun} will be lost.`),
    enableBeforeUnload: isDirty,
  });

  async function save() {
    if (!lines.length) { toast.error("Add at least one line item before saving"); return; }
    const netOf = (cat: "service" | "part") => lines.filter((l) => l.category === cat).reduce((s, l) => s + l.qty * l.unit_price, 0);
    if (netOf("service") < 0 || netOf("part") < 0) { toast.error("Discounts / less are bigger than the items they apply to — remove one first"); return; }
    if (!customer && !clientName.trim()) { toast.error("A customer or client name is required"); return; }
    if (!vehicle && !vehicleDescription.trim()) { toast.error("A vehicle or vehicle description is required"); return; }
    setSaving(true);
    try {
      const basePayload = {
        customer_id: customer?.id ?? null,
        vehicle_id: vehicle?.id ?? null,
        client_name: customer ? null : clientName || null,
        client_contact: customer ? customer.phone ?? customer.email : clientContact || null,
        vehicle_description: vehicle ? null : vehicleDescription || null,
        plate_number: vehicle ? vehicle.plate_number : plateNumber || null,
        odometer_km: odometerKm ? Number(odometerKm) : null,
        [cfg.dateField]: validUntil,
        prepared_by: preparedBy || null,
        notes: buildInclusionsNotes(checkedItems, additionalNotes),
      };
      const lineRows = (id: string) =>
        lines.map((l) => ({ [cfg.fk]: id, category: l.category, description: l.description, qty: l.qty, unit_price: l.unit_price, service_pricing_id: l.service_pricing_id ?? null }));
      const goTo = (id: string) =>
        kind === "bill"
          ? navigate({ to: "/admin/walkin/bills/$billId", params: { billId: id } })
          : navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId: id } });
      const Noun = cfg.noun[0].toUpperCase() + cfg.noun.slice(1);

      if (isEdit && quoteId) {
        const { error } = await supabaseFleet.from(cfg.table).update(basePayload).eq("id", quoteId);
        if (error) throw error;

        const { error: delErr } = await supabaseFleet.from(cfg.linesTable).delete().eq(cfg.fk, quoteId);
        if (delErr) throw delErr;

        const { error: linesError } = await supabaseFleet.from(cfg.linesTable).insert(lineRows(quoteId));
        if (linesError) throw linesError;

        toast.success(`${Noun} updated`);
        savedRef.current = true;
        goTo(quoteId);
      } else {
        const { data: created, error } = await supabaseFleet
          .from(cfg.table)
          .insert(basePayload)
          .select("id")
          .single();
        if (error) throw error;

        const { error: linesError } = await supabaseFleet.from(cfg.linesTable).insert(lineRows(created.id));
        if (linesError) throw linesError;

        toast.success(`${Noun} saved`);
        savedRef.current = true;
        goTo(created.id);
      }
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? `Unable to save ${cfg.noun}`);
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{isEdit ? `Edit ${cfg.noun}` : `Build a ${cfg.noun}`}</h1>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-6 p-4 pb-28 md:p-8 md:pb-28 lg:grid-cols-[1fr_360px] lg:items-start lg:pb-8">
        <div className="space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>Client &amp; vehicle</h2>

            <Seg value={customerMode} onChange={(m) => { setCustomerMode(m); setCustomer(null); }} labels={{ existing: "Existing customer", new: "Walk-in / new" }} />
            {customerMode === "existing" ? (
              <div className="relative mb-3">
                <label className={labelCls}>Search customer</label>
                <input className={inputCls} value={customer ? customer.full_name : customerQuery} onChange={(e) => { setCustomer(null); setCustomerQuery(e.target.value); }} placeholder="Type a name…" />
                {customerResults.length > 0 && !customer && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                    {customerResults.map((c) => (
                      <button key={c.id} onClick={() => { setCustomer(c); setCustomerResults([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50">
                        {c.full_name} <span className="text-stone-500">· {c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Client name</label><input className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
                <div><label className={labelCls}>Contact / Messenger</label><input className={inputCls} value={clientContact} onChange={(e) => setClientContact(e.target.value)} /></div>
              </div>
            )}

            <Seg value={vehicleMode} onChange={(m) => { setVehicleMode(m); setVehicle(null); }} labels={{ existing: "Existing vehicle", new: "Describe vehicle" }} />
            {vehicleMode === "existing" ? (
              <div className="relative mb-3">
                <label className={labelCls}>Search vehicle</label>
                <input className={inputCls} value={vehicle ? `${vehicle.plate_number} — ${vehicle.make} ${vehicle.model}` : vehicleQuery} onChange={(e) => { setVehicle(null); setVehicleQuery(e.target.value); }} placeholder="Plate or model…" />
                {vehicleResults.length > 0 && !vehicle && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                    {vehicleResults.map((v) => (
                      <button key={v.id} onClick={() => { setVehicle(v); setVehicleResults([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50">
                        {v.plate_number} · {v.make} {v.model} {v.year ?? ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Vehicle</label><input className={inputCls} value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} placeholder="e.g. Toyota Vios 2019, 1.3 Gas" /></div>
                <div><label className={labelCls}>Plate number</label><input className={inputCls} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value.toUpperCase())} placeholder="Needed for service history" /></div>
              </div>
            )}
            {plateMatch && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <span className="text-emerald-800">
                  <strong>{plateMatch.vehicle.plate_number}</strong> is already on file — {plateMatch.vehicle.make} {plateMatch.vehicle.model}
                  {plateMatch.customer ? ` · ${plateMatch.customer.full_name}` : ""}
                </span>
                <button type="button" onClick={applyPlateMatch} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                  Use this customer &amp; car
                </button>
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Odometer (km)</label><input type="number" className={inputCls} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} /></div>
              <div><label className={labelCls}>{cfg.dateLabel}</label><input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            </div>
            <div>
              <label className={labelCls}>Prepared by</label>
              <select className={inputCls} value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)}>
                <option value="">— Select —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>Add items</h2>

            <div ref={customFormRef} className={editingLine && !editingDeduction ? "-mx-2 rounded-lg bg-amber-50 px-2 py-2 ring-2 ring-amber-400" : ""}>
            {editingLine && !editingDeduction && <EditingBanner onCancel={cancelEdit} />}
            <div className="grid grid-cols-[1fr_64px_100px_auto] gap-2">
              <div className="col-span-full">
                <label className={labelCls}>Item / service</label>
                <input className={inputCls} list="saved-line-items" value={customDesc} onChange={(e) => onCustomDescChange(e.target.value)} placeholder="Type an item — e.g. Brake Fluid, Coolant…" />
                <datalist id="saved-line-items">
                  {savedItems.map((s) => <option key={s.title} value={s.title}>{`${peso(s.price)} · ${s.category}`}</option>)}
                </datalist>
                {savedMatch && <div className="mt-1 text-xs text-stone-500">Last quoted at {peso(savedMatch.price)} · used {savedMatch.count}×</div>}
              </div>
              <div><label className={labelCls}>Type</label><select className={inputCls} value={customCat} onChange={(e) => setCustomCat(e.target.value as "service" | "part")}><option value="service">Service</option><option value="part">Part</option></select></div>
              <div><label className={labelCls}>Qty</label><input type="number" min="1" className={inputCls} value={customQty} onChange={(e) => setCustomQty(e.target.value)} /></div>
              <div><label className={labelCls}>Price</label><input type="number" min="0" className={inputCls} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} /></div>
              <button
                onClick={() => {
                  const price = Number(customPrice); const qty = Number(customQty) || 1;
                  if (!customDesc.trim() || Number.isNaN(price)) { toast.error("Type the item and its price"); return; }
                  putLine({ category: customCat, description: buildLineDescription(customDesc, customInclusions), qty, unit_price: price });
                  setCustomDesc(""); setCustomPrice(""); setCustomQty("1"); setCustomInclusions(""); setShowSubItems(false);
                }}
                className="self-end rounded-lg px-5 py-2 text-sm font-bold"
                style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
              >
                {editingLine && !editingDeduction ? "Update" : "Add"}
              </button>
            </div>
            {showSubItems || customInclusions ? (
              <div className="mt-2">
                <label className={labelCls}>Sub-items (no price, one per line)</label>
                <textarea className={inputCls} rows={3} value={customInclusions} onChange={(e) => setCustomInclusions(e.target.value)} placeholder={"Intake manifold cleaning\nThrottle body cleaning"} />
              </div>
            ) : (
              <button type="button" onClick={() => setShowSubItems(true)} className="mt-2 text-xs font-semibold text-stone-500 hover:underline">+ Add sub-items under this line (no price)</button>
            )}
            </div>

            <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase text-stone-600">Package</span>
                {(["PMS", "Oil Change"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setPkgType(t); setPkgSize(null); }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${pkgType === t ? "border-transparent text-white" : "border-stone-300 bg-white text-stone-600"}`} style={pkgType === t ? { backgroundColor: t === "PMS" ? "#C9A227" : "#2563EB" } : undefined}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pkgSizes.map((s) => (
                  <button key={s} type="button" onClick={() => setPkgSize(s)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${pkgSize === s ? "border-transparent text-white" : "border-stone-300 bg-white text-stone-700"}`} style={pkgSize === s ? { backgroundColor: "#0F1E3A" } : undefined}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pkgGrades.map((g) => {
                  const available = !pkgSize || packages.some((p) => p.pkg.type === pkgType && p.pkg.size === pkgSize && p.pkg.grade === g);
                  return (
                    <button key={g} type="button" disabled={!available} onClick={() => setPkgGrade(g)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${pkgGrade === g ? "border-transparent text-white" : "border-stone-300 bg-white text-stone-700"}`} style={pkgGrade === g ? { backgroundColor: "#0F1E3A" } : undefined}>
                      {g}
                    </button>
                  );
                })}
                <div className="ml-auto flex items-center gap-2">
                  {pkgMatch ? (
                    <>
                      <span className="font-mono text-sm font-bold" style={{ color: "#0F1E3A" }}>{peso(pkgMatch.item.price)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          addLine({ category: "service", description: pkgMatch.item.name, qty: 1, unit_price: pkgMatch.item.price, service_pricing_id: pkgMatch.item.id });
                          setLastPkgType(pkgType);
                          toast.success(`Added ${pkgType} package ${pkgMatch.pkg.size}`);
                        }}
                        className="rounded-lg px-4 py-1.5 text-xs font-bold"
                        style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                      >
                        Add package
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-stone-500">{pkgSize ? "Not offered in this grade" : "Pick the oil size"}</span>
                  )}
                </div>
              </div>
              {lastPkgType && inclusionType === "custom" && (
                <button type="button" onClick={() => setInclusionType(lastPkgType === "PMS" ? "pms" : "oil_change")} className="mt-2 text-xs font-semibold text-amber-700 hover:underline">
                  Print the {lastPkgType} inclusions checklist on the quotation →
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" onClick={() => setShowCatalog((s) => !s)} className="text-xs font-semibold hover:underline" style={{ color: "#0F1E3A" }}>
                {showCatalog ? "− Hide catalog" : `+ Browse catalog (${otherCatalog.length} add-ons & filters)`}
              </button>
              {!(showDiscount || editingDeduction) && (
                <button type="button" onClick={() => setShowDiscount(true)} className="text-xs font-semibold text-red-600 hover:underline">+ Discount / less</button>
              )}
            </div>

            {showCatalog && (
              <div className="mt-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button key={c} onClick={() => setActiveCat(c)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeCat === c ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={activeCat === c ? { backgroundColor: "#0F1E3A" } : undefined}>
                      {c === "all" ? "All" : catLabel(c)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCatalog.map((item) => {
                    const badge = packageBadge(item);
                    return (
                      <button key={item.id} onClick={() => { addLine({ category: catToLineCategory(item.category), description: item.name, qty: 1, unit_price: item.price, service_pricing_id: item.id }); toast.success(`Added ${item.name}`); }} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left hover:border-amber-400" style={{ borderLeft: `3px solid ${badge.color}` }}>
                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: badge.color }}>{badge.label}</div>
                          <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{item.name}</div>
                        </div>
                        <div className="shrink-0 font-mono text-sm text-stone-600">{peso(item.price)}</div>
                      </button>
                    );
                  })}
                  {!filteredCatalog.length && <div className="text-sm text-stone-500">No catalog items in this category.</div>}
                </div>
              </div>
            )}

            {(showDiscount || editingDeduction) && (
            <div ref={dedFormRef} className={`mt-4 border-t border-dashed border-stone-200 pt-4 ${editingDeduction ? "-mx-2 rounded-lg bg-amber-50 px-2 pb-2 ring-2 ring-amber-400" : ""}`}>
              {editingDeduction && <EditingBanner onCancel={cancelEdit} />}
              <label className={labelCls}>Discount / less</label>
              <div className="mb-2 flex w-fit overflow-hidden rounded-lg border border-stone-300">
                {([["discount", "Discount"], ["less", "Less (part not done)"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setDedKind(v)} className={`px-3 py-1.5 text-xs font-semibold ${dedKind === v ? "text-white" : "bg-white text-stone-500"}`} style={dedKind === v ? { backgroundColor: "#0F1E3A" } : undefined}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_150px_auto]">
                <div>
                  <label className={labelCls}>{dedKind === "discount" ? "Reason (optional)" : "What was not done"}</label>
                  <input className={inputCls} value={dedReason} onChange={(e) => setDedReason(e.target.value)} placeholder={dedKind === "discount" ? "e.g. Suki discount" : "e.g. Throttle body cleaning (already clean)"} />
                </div>
                <div><label className={labelCls}>Applies to</label><select className={inputCls} value={dedCat} onChange={(e) => setDedCat(e.target.value as "service" | "part")}><option value="service">Service</option><option value="part">Part</option></select></div>
                <div>
                  <label className={labelCls}>Amount</label>
                  <div className="flex">
                    <input type="number" min="0" className={`${inputCls} rounded-r-none`} value={dedAmount} onChange={(e) => setDedAmount(e.target.value)} />
                    <select className="rounded-r-lg border border-l-0 border-stone-300 bg-stone-50 px-2 text-sm" value={dedUnit} onChange={(e) => setDedUnit(e.target.value as "peso" | "percent")} aria-label="Amount unit">
                      <option value="peso">₱</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
                <button onClick={addDeduction} className="self-end rounded-lg border-2 px-4 py-2 text-sm font-bold" style={{ borderColor: "#0F1E3A", color: "#0F1E3A" }}>
                  {editingDeduction ? "Update" : "Add"} {dedKind === "discount" ? "discount" : "less"}
                </button>
              </div>
            </div>
            )}
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>Inclusions &amp; notes</h2>
              <div className="mb-3 flex flex-wrap gap-2">
                {INCLUSION_TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setInclusionType(t.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${inclusionType === t.value ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`}
                    style={inclusionType === t.value ? { backgroundColor: "#0F1E3A" } : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {inclusionType !== "custom" && (
                <div className="mb-3 grid grid-cols-1 gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
                  {activeChecklist.map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={checkedInclusions[item] ?? true}
                        onChange={(e) => setCheckedInclusions((c) => ({ ...c, [item]: e.target.checked }))}
                        className="h-4 w-4 rounded border-stone-300"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              )}

              <label className={labelCls}>
                {inclusionType === "custom" ? "Notes" : "Additional notes (optional, prints below the checklist)"}
              </label>
              <textarea className={inputCls} rows={3} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
          </section>
        </div>

        <aside id="builder-summary" className="flex h-fit flex-col rounded-xl border border-stone-200 bg-white lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="border-b border-dashed border-stone-200 p-4">
            <div className="font-mono text-sm font-bold" style={{ color: "#0F1E3A" }}>{isEdit ? `Editing ${cfg.noun}` : `New ${cfg.noun}`}</div>
            <div className="text-xs text-stone-500">{cfg.dateLabel} {validUntil} · {lines.length} item{lines.length === 1 ? "" : "s"}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!lines.length && <div className="py-6 text-center text-sm text-stone-500">No items yet — add one on the left.</div>}
            {lines.map((l) => {
              const ded = isDeduction(l);
              return (
                <div key={l.key} className={`border-b border-stone-100 py-2 text-sm ${editingKey === l.key ? "-mx-2 rounded bg-amber-50 px-2" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => startEdit(l)} title="Edit details" className="min-w-0 flex-1 text-left hover:opacity-70">
                      <div className={`font-medium ${ded ? "text-red-600" : ""}`}>{l.description.split("\n")[0]}</div>
                      {l.description.includes("\n") && <div className="whitespace-pre-line pl-2 text-xs text-stone-500">{l.description.split("\n").slice(1).join("\n")}</div>}
                    </button>
                    <button onClick={() => removeLine(l.key)} className="-mr-1 px-1 text-lg leading-none text-red-500" aria-label="Remove">×</button>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {ded ? (
                      <span className="text-xs uppercase text-stone-500">deduction · {l.category}</span>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-stone-500">
                        <input type="number" min="1" aria-label="Quantity" className="w-12 rounded border border-stone-300 px-1.5 py-1 text-center text-sm" value={l.qty} onChange={(e) => updateLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                        <span>×</span>
                        <input type="number" min="0" aria-label="Unit price" className="w-24 rounded border border-stone-300 px-1.5 py-1 text-right text-sm" value={l.unit_price} onChange={(e) => updateLine(l.key, { unit_price: Math.max(0, Number(e.target.value) || 0) })} />
                      </div>
                    )}
                    <div className={`font-mono font-semibold ${ded ? "text-red-600" : ""}`}>{pesoSigned(l.qty * l.unit_price)}</div>
                  </div>
                  {editingKey === l.key && <div className="mt-1 text-xs font-semibold text-amber-600">Editing on the left…</div>}
                </div>
              );
            })}
          </div>
          <div className="space-y-1 border-t border-stone-200 p-4 text-sm">
            <div className="flex justify-between text-stone-500"><span>Services</span><span className="font-mono">{peso(totals.services)}</span></div>
            <div className="flex justify-between text-stone-500"><span>Parts</span><span className="font-mono">{peso(totals.parts)}</span></div>
            {totals.deductions > 0 && <div className="flex justify-between text-red-600"><span>Less &amp; discounts</span><span className="font-mono">{pesoSigned(-totals.deductions)}</span></div>}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold" style={{ color: "#0F1E3A" }}><span>Total</span><span className="font-mono">{peso(grand)}</span></div>
          </div>
          <div className="p-4 pt-0">
            <button disabled={saving} onClick={() => void save()} className="w-full rounded-lg py-3 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
              {saving ? "Saving…" : isEdit ? "Save changes" : `Save ${cfg.noun}`}
            </button>
          </div>
        </aside>
      </main>

      {/* Phone / small tablet: total + Save always reachable at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:left-64 lg:hidden">
        <button type="button" onClick={() => document.getElementById("builder-summary")?.scrollIntoView({ behavior: "smooth" })} className="min-w-0 flex-1 text-left">
          <div className="text-xs text-stone-500">{lines.length} item{lines.length === 1 ? "" : "s"} · view list</div>
          <div className="font-mono text-lg font-bold" style={{ color: "#0F1E3A" }}>{peso(grand)}</div>
        </button>
        <button disabled={saving} onClick={() => void save()} className="rounded-lg px-5 py-3 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

function EditingBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-amber-700">
      <span>Editing a saved line — change it below, then tap Update.</span>
      <button type="button" onClick={onCancel} className="rounded border border-amber-300 bg-white px-2 py-0.5 text-amber-700">Cancel</button>
    </div>
  );
}

function Seg({ value, onChange, labels }: { value: "existing" | "new"; onChange: (v: "existing" | "new") => void; labels: { existing: string; new: string } }) {
  return (
    <div className="mb-3 flex w-fit overflow-hidden rounded-lg border border-stone-300">
      {(["existing", "new"] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)} className={`px-3 py-1.5 text-xs font-semibold ${value === v ? "text-white" : "bg-white text-stone-500"}`} style={value === v ? { backgroundColor: "#0F1E3A" } : undefined}>
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
