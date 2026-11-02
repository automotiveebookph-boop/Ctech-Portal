import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, MapPin, Plus, Send, Trash2, X } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { ACTIVE_JOB_STATUSES, buildDispatchMessage, fmtJobDate, JOB_STATUS_LABEL, JOB_STATUS_STYLE, type PlannedItem, type TechJob } from "@/lib/tech-jobs";

export const Route = createFileRoute("/admin/walkin/dispatch")({
  // ?quote=<id> or ?booking=<id> opens a new job order prefilled from that record.
  validateSearch: (s: Record<string, unknown>): { quote?: string; booking?: string } => ({
    quote: typeof s.quote === "string" ? s.quote : undefined,
    booking: typeof s.booking === "string" ? s.booking : undefined,
  }),
  component: DispatchPage,
});

type Staff = { id: string; full_name: string };
type Booking = {
  id: string; visit_date: string; time_slot: string; service_type: string; vehicle: string | null; barangay: string | null;
  municipality: string | null; maps_link: string | null; site_notes: string | null; name: string; contact: string | null;
  status: string; estimate_summary: string | null;
};
type Draft = Omit<TechJob, "id" | "job_no" | "status" | "bill_id" | "completed_at" | "created_at"> & { id?: string };

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";
const labelCls = "mb-1 block text-xs font-semibold uppercase text-stone-600";
const SLOTS = ["8:00 AM", "10:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "6:00 PM", "7:30 PM"];
const manilaDate = (n = 0) => new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({
  assigned_to: null, scheduled_date: manilaDate(0), time_slot: "", client_name: "", client_contact: "", vehicle_description: "",
  plate_number: "", address: "", maps_link: "", instructions: "", planned_items: [], home_service_booking_id: null, quote_id: null,
});

function DispatchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<TechJob[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [techs, setTechs] = useState<Staff[]>([]);
  const [suggest, setSuggest] = useState<{ title: string; price: number; category: "service" | "part"; id?: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tech: string; text: string } | null>(null);

  async function load() {
    const [{ data: j }, { data: b }] = await Promise.all([
      supabaseFleet.from("tech_jobs").select("*").gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString()).order("scheduled_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabaseFleet.from("home_service_bookings").select("id, visit_date, time_slot, service_type, vehicle, barangay, municipality, maps_link, site_notes, name, contact, status, estimate_summary").in("status", ["pending", "confirmed"]).gte("visit_date", manilaDate(-1)).order("visit_date").order("time_slot"),
    ]);
    setJobs((j ?? []) as TechJob[]);
    setBookings((b ?? []) as Booking[]);
  }

  useEffect(() => {
    void load();
    (async () => {
      const [{ data: st }, { data: cat }, { data: past }] = await Promise.all([
        supabaseFleet.from("staff").select("id, full_name").eq("active", true).eq("shop_role", "technician").order("full_name"),
        supabaseFleet.from("service_pricing").select("id, name, price, category").eq("active", true),
        supabaseFleet.from("quote_line_items").select("description, unit_price, category").gt("unit_price", 0).order("created_at", { ascending: false }).limit(1500),
      ]);
      setTechs((st ?? []) as Staff[]);
      const seen = new Map<string, { title: string; price: number; category: "service" | "part"; id?: string }>();
      for (const c of (cat ?? []) as { id: string; name: string; price: number; category: string }[]) seen.set(c.name.toLowerCase(), { title: c.name, price: Number(c.price), category: c.category === "filter" ? "part" : "service", id: c.id });
      for (const l of (past ?? []) as { description: string; unit_price: number; category: "service" | "part" }[]) {
        const t = l.description.split("\n")[0].trim();
        if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), { title: t, price: Number(l.unit_price), category: l.category });
      }
      setSuggest([...seen.values()]);
    })();
  }, []);

  // Open the form prefilled from ?quote= or ?booking= (e.g. "Send to technician" on a quote).
  useEffect(() => {
    (async () => {
      if (search.quote) {
        const { data: q } = await supabaseFleet.from("quotes").select("id, quote_no, client_name, client_contact, vehicle_description, plate_number").eq("id", search.quote).maybeSingle();
        const { data: ls } = await supabaseFleet.from("quote_line_items").select("description, category, qty, unit_price, service_pricing_id").eq("quote_id", search.quote).order("created_at");
        if (q) {
          setDraft({
            ...emptyDraft(), quote_id: q.id, client_name: q.client_name ?? "", client_contact: q.client_contact ?? "",
            vehicle_description: q.vehicle_description ?? "", plate_number: q.plate_number ?? "", instructions: `From quotation ${q.quote_no}`,
            planned_items: ((ls ?? []) as { description: string; category: "service" | "part"; qty: number; unit_price: number; service_pricing_id: string | null }[])
              .map((l) => ({ title: l.description.split("\n")[0], category: l.category, qty: Number(l.qty), price: Number(l.unit_price), service_pricing_id: l.service_pricing_id })),
          });
        }
        navigate({ to: "/admin/walkin/dispatch", search: {}, replace: true });
      } else if (search.booking) {
        const { data: b } = await supabaseFleet.from("home_service_bookings").select("*").eq("id", search.booking).maybeSingle();
        if (b) openFromBooking(b as Booking);
        navigate({ to: "/admin/walkin/dispatch", search: {}, replace: true });
      }
    })();
  }, [search.quote, search.booking]);

  function openFromBooking(b: Booking) {
    setDraft({
      ...emptyDraft(), home_service_booking_id: b.id, client_name: b.name, client_contact: b.contact ?? "", vehicle_description: b.vehicle ?? "",
      address: [b.barangay, b.municipality].filter(Boolean).join(", "), maps_link: b.maps_link ?? "", scheduled_date: b.visit_date, time_slot: b.time_slot,
      instructions: [b.service_type, b.estimate_summary, b.site_notes ? `Site: ${b.site_notes}` : ""].filter(Boolean).join(" — "),
    });
  }

  const techName = (id: string | null) => techs.find((t) => t.id === id)?.full_name ?? "—";
  const dispatchedBookings = useMemo(() => new Set((jobs ?? []).filter((j) => j.status !== "cancelled").map((j) => j.home_service_booking_id).filter(Boolean)), [jobs]);
  const toAssignBookings = bookings.filter((b) => !dispatchedBookings.has(b.id));
  const unassigned = (jobs ?? []).filter((j) => j.status === "unassigned");
  const active = (jobs ?? []).filter((j) => ACTIVE_JOB_STATUSES.includes(j.status));
  const done = (jobs ?? []).filter((j) => j.status === "done");

  async function save() {
    if (!draft) return;
    if (!draft.client_name.trim()) { toast.error("Enter the customer's name"); return; }
    setSaving(true);
    const { id, ...fields } = draft;
    const payload = {
      ...fields,
      client_name: fields.client_name.trim(),
      plate_number: fields.plate_number?.trim().toUpperCase() || null,
      scheduled_date: fields.scheduled_date || null,
      planned_items: fields.planned_items.filter((i) => i.title.trim()),
      ...(id ? {} : { status: fields.assigned_to ? "assigned" : "unassigned" }),
    };
    const res = id
      ? await supabaseFleet.from("tech_jobs").update(payload).eq("id", id).select("*").single()
      : await supabaseFleet.from("tech_jobs").insert(payload).select("*").single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    const job = res.data as TechJob;
    if (job.home_service_booking_id) await supabaseFleet.from("home_service_bookings").update({ status: "confirmed" }).eq("id", job.home_service_booking_id).eq("status", "pending");
    setDraft(null);
    toast.success(`${job.job_no} ${id ? "updated" : "created"}`);
    if (job.assigned_to) setMessage({ tech: techName(job.assigned_to), text: buildDispatchMessage(job, techName(job.assigned_to)) });
    void load();
  }

  async function cancelJob(j: TechJob) {
    if (!window.confirm(`Cancel ${j.job_no}? The technician will no longer see it.`)) return;
    const { error } = await supabaseFleet.from("tech_jobs").update({ status: "cancelled" }).eq("id", j.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${j.job_no} cancelled`);
    void load();
  }

  function edit(j: TechJob) {
    const { job_no: _n, status: _s, bill_id: _b, completed_at: _c, created_at: _a, ...rest } = j;
    setDraft({ ...rest, client_contact: rest.client_contact ?? "", vehicle_description: rest.vehicle_description ?? "", plate_number: rest.plate_number ?? "", address: rest.address ?? "", maps_link: rest.maps_link ?? "", instructions: rest.instructions ?? "", time_slot: rest.time_slot ?? "" });
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Dispatch</h1>
          <p className="mt-0.5 text-sm text-stone-500">Send job orders to technicians' phones and watch their progress.</p>
        </div>
        <button onClick={() => setDraft(emptyDraft())} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
          <Plus className="h-4 w-4" /> New job order
        </button>
      </header>

      <main className="space-y-6 p-4 md:p-8">
        <section>
          <h2 className="mb-2 font-bold" style={{ color: "#0F1E3A" }}>To assign {toAssignBookings.length + unassigned.length > 0 && <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{toAssignBookings.length + unassigned.length}</span>}</h2>
          {jobs === null ? <Empty>Loading…</Empty> : toAssignBookings.length + unassigned.length === 0 ? <Empty>Nothing waiting for a technician. 🎉</Empty> : (
            <div className="grid gap-3 md:grid-cols-2">
              {toAssignBookings.map((b) => (
                <div key={b.id} className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">Online booking</span>
                    <span className="text-xs font-semibold text-stone-600">{fmtJobDate(b.visit_date)} · {b.time_slot}</span>
                  </div>
                  <div className="font-semibold" style={{ color: "#0F1E3A" }}>{b.name}</div>
                  <div className="text-sm text-stone-600">{b.vehicle} · {b.service_type}</div>
                  <div className="text-sm text-stone-500">{[b.barangay, b.municipality].filter(Boolean).join(", ")}</div>
                  <button onClick={() => openFromBooking(b)} className="mt-3 w-full rounded-lg py-2 text-sm font-bold text-white" style={{ backgroundColor: "#0F1E3A" }}>Assign to technician</button>
                </div>
              ))}
              {unassigned.map((j) => <JobCard key={j.id} job={j} techName={techName(j.assigned_to)} onEdit={() => edit(j)} onCancel={() => void cancelJob(j)} />)}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-bold" style={{ color: "#0F1E3A" }}>Active jobs ({active.length})</h2>
          {active.length === 0 ? <Empty>No active jobs.</Empty> : (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((j) => (
                <JobCard key={j.id} job={j} techName={techName(j.assigned_to)} onEdit={() => edit(j)} onCancel={() => void cancelJob(j)}
                  onMessage={() => setMessage({ tech: techName(j.assigned_to), text: buildDispatchMessage(j, techName(j.assigned_to)) })} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-bold" style={{ color: "#0F1E3A" }}>Done — last 14 days ({done.length})</h2>
          {done.length === 0 ? <Empty>No finished jobs yet.</Empty> : (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
              {done.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <span className="font-mono text-xs text-stone-500">{j.job_no}</span> · <span className="font-semibold" style={{ color: "#0F1E3A" }}>{j.client_name}</span> · {techName(j.assigned_to)}
                    <div className="text-xs text-stone-500">Finished {j.completed_at ? new Date(j.completed_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</div>
                  </div>
                  {j.bill_id && <Link to="/admin/walkin/bills/$billId" params={{ billId: j.bill_id }} className="text-xs font-semibold underline" style={{ color: "#0F1E3A" }}>Open bill →</Link>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#0F1E3A" }}>{draft.id ? "Edit job order" : "New job order"}</h2>
              <button onClick={() => setDraft(null)} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Technician</label>
                <div className="flex flex-wrap gap-2">
                  {techs.map((t) => (
                    <button key={t.id} type="button" onClick={() => setDraft({ ...draft, assigned_to: draft.assigned_to === t.id ? null : t.id })} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${draft.assigned_to === t.id ? "border-transparent text-white" : "border-stone-300 text-stone-700"}`} style={draft.assigned_to === t.id ? { backgroundColor: "#0F1E3A" } : undefined}>{t.full_name}</button>
                  ))}
                </div>
              </div>
              <div><label className={labelCls}>Customer name *</label><input className={inputCls} value={draft.client_name} onChange={(e) => setDraft({ ...draft, client_name: e.target.value })} /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={draft.client_contact ?? ""} onChange={(e) => setDraft({ ...draft, client_contact: e.target.value })} /></div>
              <div><label className={labelCls}>Car</label><input className={inputCls} value={draft.vehicle_description ?? ""} onChange={(e) => setDraft({ ...draft, vehicle_description: e.target.value })} placeholder="e.g. Toyota Vios 2019" /></div>
              <div><label className={labelCls}>Plate</label><input className={inputCls} value={draft.plate_number ?? ""} onChange={(e) => setDraft({ ...draft, plate_number: e.target.value.toUpperCase() })} /></div>
              <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={draft.scheduled_date ?? ""} onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })} /></div>
              <div>
                <label className={labelCls}>Time</label>
                <input className={inputCls} list="dispatch-slots" value={draft.time_slot ?? ""} onChange={(e) => setDraft({ ...draft, time_slot: e.target.value })} placeholder="e.g. 10:00 AM" />
                <datalist id="dispatch-slots">{SLOTS.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Address (leave blank for in-shop work)</label><input className={inputCls} value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Barangay, town, landmark" /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Google Maps link</label><input className={inputCls} value={draft.maps_link ?? ""} onChange={(e) => setDraft({ ...draft, maps_link: e.target.value })} placeholder="Optional" /></div>
              <div className="sm:col-span-2"><label className={labelCls}>Instructions for the tech</label><textarea rows={2} className={inputCls} value={draft.instructions ?? ""} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="e.g. Customer will pay GCash. Bring 7L diesel oil." /></div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Planned work (the tech can still change it)</label>
                <div className="space-y-2">
                  {draft.planned_items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_100px_auto] gap-2">
                      <input className={inputCls} list="dispatch-items" value={it.title} placeholder="Item / service"
                        onChange={(e) => {
                          const hit = suggest.find((s) => s.title.toLowerCase() === e.target.value.toLowerCase());
                          const items = [...draft.planned_items];
                          items[i] = hit && !it.price ? { ...it, title: e.target.value, price: hit.price, category: hit.category, service_pricing_id: hit.id ?? null } : { ...it, title: e.target.value };
                          setDraft({ ...draft, planned_items: items });
                        }} />
                      <input type="number" min="1" className={inputCls} value={it.qty} onChange={(e) => { const items = [...draft.planned_items]; items[i] = { ...it, qty: Math.max(1, Number(e.target.value) || 1) }; setDraft({ ...draft, planned_items: items }); }} />
                      <input type="number" className={inputCls} value={it.price} onChange={(e) => { const items = [...draft.planned_items]; items[i] = { ...it, price: Number(e.target.value) || 0 }; setDraft({ ...draft, planned_items: items }); }} />
                      <button type="button" onClick={() => setDraft({ ...draft, planned_items: draft.planned_items.filter((_, k) => k !== i) })} className="px-2 text-red-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <datalist id="dispatch-items">{suggest.map((s) => <option key={s.title} value={s.title}>{peso(s.price)}</option>)}</datalist>
                  <button type="button" onClick={() => setDraft({ ...draft, planned_items: [...draft.planned_items, { title: "", category: "service", qty: 1, price: 0 }] })} className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>+ Add item</button>
                  {draft.planned_items.length > 0 && <div className="text-right text-sm font-bold" style={{ color: "#0F1E3A" }}>Estimated: {peso(draft.planned_items.reduce((s, i) => s + i.qty * i.price, 0))}</div>}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
              <button disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}>
                <Send className="h-4 w-4" /> {saving ? "Saving…" : draft.assigned_to ? `Send to ${techName(draft.assigned_to)}` : "Save without technician"}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-1 text-lg font-bold" style={{ color: "#0F1E3A" }}>Job sent to {message.tech}'s app</h2>
            <p className="mb-3 text-sm text-stone-600">It's already on their Home Service screen. Send this so they know:</p>
            <textarea readOnly rows={9} value={message.text} className="mb-3 w-full rounded-lg border border-stone-300 p-3 text-sm" />
            <div className="flex flex-col gap-2">
              <button onClick={() => navigator.clipboard.writeText(message.text).then(() => toast.success("Copied — paste it in Messenger"), () => toast.error("Couldn't copy"))} className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white" style={{ backgroundColor: "#0F1E3A" }}>
                <Copy className="h-4 w-4" /> Copy message for Messenger
              </button>
              <button onClick={() => setMessage(null)} className="rounded-lg py-2 text-sm text-stone-600 hover:bg-stone-100">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function JobCard({ job, techName, onEdit, onCancel, onMessage }: { job: TechJob; techName: string; onEdit: () => void; onCancel: () => void; onMessage?: () => void }) {
  const est = job.planned_items.reduce((s, i) => s + i.qty * i.price, 0);
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`rounded border px-2 py-0.5 text-xs font-bold ${JOB_STATUS_STYLE[job.status]}`}>{JOB_STATUS_LABEL[job.status]}</span>
        <span className="text-xs font-semibold text-stone-600">{fmtJobDate(job.scheduled_date)}{job.time_slot ? ` · ${job.time_slot}` : ""}</span>
      </div>
      <div className="font-semibold" style={{ color: "#0F1E3A" }}>{job.client_name} <span className="font-mono text-xs font-normal text-stone-500">{job.job_no}</span></div>
      <div className="text-sm text-stone-600">{[job.vehicle_description, job.plate_number].filter(Boolean).join(" · ") || "—"}</div>
      {job.address && <div className="flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-3.5 w-3.5" /> {job.address}</div>}
      <div className="mt-1 text-sm"><span className="text-stone-500">Tech:</span> <strong>{techName}</strong>{est > 0 && <span className="text-stone-500"> · est. {peso(est)}</span>}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onMessage && <button onClick={onMessage} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">Message tech</button>}
        <button onClick={onEdit} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50">{job.assigned_to ? "Edit / reassign" : "Assign"}</button>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Cancel job</button>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-500">{children}</div>;
}
