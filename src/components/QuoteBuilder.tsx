import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

type CatalogItem = { id: string; category: string; name: string; price: number };
type StaffOption = { id: string; full_name: string };
type CustomerResult = { id: string; full_name: string; email: string | null; phone: string | null };
type VehicleResult = { id: string; plate_number: string; make: string; model: string; year: number | null; customer_id: string | null };
type Line = { key: number; category: "service" | "part"; description: string; qty: number; unit_price: number; service_pricing_id?: string | null };

const catLabel = (c: string) => ({ package: "PMS & Oil Change Packages", engine_oil: "Engine Oil", filter: "Filters", wheel_balance: "Wheel Service", add_on: "Add-ons" }[c] ?? c);
const catToLineCategory = (c: string): "service" | "part" => (c === "filter" ? "part" : "service");
const isoPlusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const labelCls = "mb-1 block text-xs font-semibold uppercase text-stone-600";

type InclusionType = "custom" | "pms" | "oil_change";
const INCLUSION_TABS: { value: InclusionType; label: string }[] = [
  { value: "custom", label: "Custom / free text" },
  { value: "pms", label: "PMS Package" },
  { value: "oil_change", label: "Oil Change Package" },
];
const PMS_INCLUSIONS = [
  "Engine Oil",
  "Oil Filter",
  "Cabin Filter Cleaning",
  "Air Filter Cleaning",
  "Fluid Top-Up",
  "Battery Health Check-Up",
  "Labor",
  "Brake Cleaning",
  "Brake Cleaner",
  "Under Chassis Check-Up",
  "Tire Rotation (upon request)",
  "Windshield Washer Fluid",
  "Engine Bay Cleaning",
  "Car Seat Cover Kit",
  "FREE! Full System ECU Scanning",
  "FREE! Safety Inspection",
];
const OIL_CHANGE_INCLUSIONS = [
  "Engine Oil",
  "Oil Filter",
  "Cabin Filter Cleaning",
  "Air Filter Cleaning",
  "Fluid Top-Up",
  "Battery Health Check-Up",
  "Labor",
];

function buildInclusionsNotes(checklist: string[], additional: string): string {
  const bullets = checklist.length ? `Includes:\n${checklist.map((i) => `• ${i}`).join("\n")}` : "";
  const extra = additional.trim();
  if (bullets && extra) return `${bullets}\n\n${extra}`;
  return bullets || extra;
}

export function QuoteBuilder({
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

  const [validUntil, setValidUntil] = useState(initialValidUntil ?? isoPlusDays(7));
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

  useEffect(() => {
    (async () => {
      const [{ data: cat }, { data: st }] = await Promise.all([
        supabaseFleet.from("service_pricing").select("id, category, name, price").eq("active", true).order("category").order("name"),
        supabaseFleet.from("staff").select("id, full_name").eq("active", true).order("full_name"),
      ]);
      setCatalog((cat ?? []) as CatalogItem[]);
      setStaff((st ?? []) as StaffOption[]);
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

  function addLine(line: Omit<Line, "key">) { setLines((c) => [...c, { ...line, key: nextKey.current++ }]); }
  function removeLine(key: number) { setLines((c) => c.filter((l) => l.key !== key)); }

  const totals = lines.reduce((acc, l) => { const amt = l.qty * l.unit_price; if (l.category === "service") acc.services += amt; else acc.parts += amt; return acc; }, { services: 0, parts: 0 });
  const grand = totals.services + totals.parts;
  const categories = ["all", ...Array.from(new Set(catalog.map((c) => c.category)))];
  const filteredCatalog = catalog.filter((c) => activeCat === "all" || c.category === activeCat);

  async function save() {
    if (!lines.length) { toast.error("Add at least one line item before saving"); return; }
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
        valid_until: validUntil,
        prepared_by: preparedBy || null,
        notes: buildInclusionsNotes(checkedItems, additionalNotes),
      };

      if (isEdit && quoteId) {
        const { error } = await supabaseFleet.from("quotes").update(basePayload).eq("id", quoteId);
        if (error) throw error;

        const { error: delErr } = await supabaseFleet.from("quote_line_items").delete().eq("quote_id", quoteId);
        if (delErr) throw delErr;

        const { error: linesError } = await supabaseFleet.from("quote_line_items").insert(
          lines.map((l) => ({ quote_id: quoteId, category: l.category, description: l.description, qty: l.qty, unit_price: l.unit_price, service_pricing_id: l.service_pricing_id ?? null })),
        );
        if (linesError) throw linesError;

        toast.success("Quotation updated");
        navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId } });
      } else {
        const { data: quote, error } = await supabaseFleet
          .from("quotes")
          .insert(basePayload)
          .select("id")
          .single();
        if (error) throw error;

        const { error: linesError } = await supabaseFleet.from("quote_line_items").insert(
          lines.map((l) => ({ quote_id: quote.id, category: l.category, description: l.description, qty: l.qty, unit_price: l.unit_price, service_pricing_id: l.service_pricing_id ?? null })),
        );
        if (linesError) throw linesError;

        toast.success("Quotation saved");
        navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId: quote.id } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save quotation");
      setSaving(false);
    }
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>{isEdit ? "Edit quotation" : "Build a quotation"}</h1>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-6 p-4 md:p-8 lg:grid-cols-[1fr_360px]">
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
                        {c.full_name} <span className="text-stone-400">· {c.email}</span>
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
                <div><label className={labelCls}>Plate number</label><input className={inputCls} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} /></div>
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Odometer (km)</label><input type="number" className={inputCls} value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} /></div>
              <div><label className={labelCls}>Valid until</label><input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
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
            <h2 className="mb-3 text-sm font-bold" style={{ color: "#0F1E3A" }}>Price catalog</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button key={c} onClick={() => setActiveCat(c)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeCat === c ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={activeCat === c ? { backgroundColor: "#0F1E3A" } : undefined}>
                  {c === "all" ? "All categories" : catLabel(c)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {filteredCatalog.map((item) => (
                <button key={item.id} onClick={() => addLine({ category: catToLineCategory(item.category), description: item.name, qty: 1, unit_price: item.price, service_pricing_id: item.id })} className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-left hover:border-amber-400">
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#C9A227" }}>{catLabel(item.category)}</div>
                  <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{item.name}</div>
                  <div className="font-mono text-xs text-stone-500">{peso(item.price)}</div>
                </button>
              ))}
              {!filteredCatalog.length && <div className="text-sm text-stone-400">No catalog items in this category.</div>}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-dashed border-stone-200 pt-4 sm:grid-cols-[1fr_80px_80px_100px_auto]">
              <div><label className={labelCls}>Custom line description</label><input className={inputCls} value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} /></div>
              <div><label className={labelCls}>Type</label><select className={inputCls} value={customCat} onChange={(e) => setCustomCat(e.target.value as "service" | "part")}><option value="service">Service</option><option value="part">Part</option></select></div>
              <div><label className={labelCls}>Qty</label><input type="number" min="1" className={inputCls} value={customQty} onChange={(e) => setCustomQty(e.target.value)} /></div>
              <div><label className={labelCls}>Price</label><input type="number" min="0" className={inputCls} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} /></div>
              <button
                onClick={() => {
                  const price = Number(customPrice); const qty = Number(customQty) || 1;
                  if (!customDesc.trim() || Number.isNaN(price)) return;
                  addLine({ category: customCat, description: customDesc.trim(), qty, unit_price: price });
                  setCustomDesc(""); setCustomPrice(""); setCustomQty("1");
                }}
                className="self-end rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ backgroundColor: "#0F1E3A" }}
              >
                Add line
              </button>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Inclusions (prints on the quotation)</label>
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
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-dashed border-stone-200 p-4">
            <div className="font-mono text-sm font-bold" style={{ color: "#0F1E3A" }}>{isEdit ? "Editing quotation" : "New quotation"}</div>
            <div className="text-xs text-stone-500">Valid until {validUntil}</div>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            {!lines.length && <div className="py-6 text-center text-sm text-stone-400">No line items yet.</div>}
            {lines.map((l) => (
              <div key={l.key} className="flex items-start justify-between gap-2 border-b border-stone-100 py-2 text-sm">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-stone-400">{l.category} · qty {l.qty}</div>
                  <div className="truncate">{l.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="font-mono">{peso(l.qty * l.unit_price)}</div>
                  <button onClick={() => removeLine(l.key)} className="text-red-500" aria-label="Remove">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-stone-200 p-4 text-sm">
            <div className="flex justify-between text-stone-500"><span>Services</span><span className="font-mono">{peso(totals.services)}</span></div>
            <div className="flex justify-between text-stone-500"><span>Parts</span><span className="font-mono">{peso(totals.parts)}</span></div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold" style={{ color: "#0F1E3A" }}><span>Total</span><span className="font-mono">{peso(grand)}</span></div>
          </div>
          <div className="p-4">
            <button disabled={saving} onClick={() => void save()} className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save quotation"}
            </button>
          </div>
        </aside>
      </main>
    </>
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
