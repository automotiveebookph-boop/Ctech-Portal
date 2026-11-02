import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Smartphone } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { BILL_STATUS_STYLE } from "@/components/BillDocument";

export const Route = createFileRoute("/admin/walkin/home-service")({
  component: HomeServiceMonitor,
});

// Owner's view of technician jobs from the Home Service phone app: what each
// tech did, what they billed and collected (cash to hand over vs GCash).

type Job = {
  id: string; bill_no: string; created_at: string; client_name: string | null; client_contact: string | null;
  vehicle_description: string | null; plate_number: string | null; odometer_km: number | null;
  total_amount: number; amount_paid: number; balance: number; status: string; notes: string | null;
  prepared_by: string | null; service_history_id: string | null; vehicle_id: string | null;
  staff: { full_name: string } | null;
  bill_payments: { amount: number; method: string }[];
  bill_line_items: { description: string; qty: number; amount: number }[];
};

const RANGES = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "Last 7 days", days: 6 },
  { key: "30", label: "Last 30 days", days: 29 },
  { key: "all", label: "All", days: null },
] as const;
const STATUS_LABEL: Record<string, string> = { unpaid: "Unpaid", partial: "Partially paid", paid: "Paid", void: "Void" };
const manilaDate = (n = 0) => new Date(Date.now() + 8 * 3600000 - n * 86400000).toISOString().slice(0, 10);
const fmtTime = (s: string) => new Date(s).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function HomeServiceMonitor() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7");
  const [tech, setTech] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setJobs(null);
      const days = RANGES.find((r) => r.key === range)!.days;
      let q = supabaseFleet
        .from("bills")
        .select("id, bill_no, created_at, client_name, client_contact, vehicle_description, plate_number, odometer_km, total_amount, amount_paid, balance, status, notes, prepared_by, service_history_id, vehicle_id, staff:prepared_by (full_name), bill_payments (amount, method), bill_line_items (description, qty, amount)")
        .eq("source", "home_service")
        .order("created_at", { ascending: false });
      if (days !== null) q = q.gte("created_at", `${manilaDate(days)}T00:00:00+08:00`);
      const { data } = await q;
      setJobs((data ?? []) as unknown as Job[]);
    })();
  }, [range]);

  const live = useMemo(() => (jobs ?? []).filter((j) => j.status !== "void"), [jobs]);
  const techs = useMemo(() => Array.from(new Set(live.map((j) => j.staff?.full_name ?? "—"))).sort(), [live]);
  const shown = useMemo(() => (jobs ?? []).filter((j) => tech === "all" || (j.staff?.full_name ?? "—") === tech), [jobs, tech]);

  // Per-technician totals (void jobs excluded): cash is what they should hand over.
  const perTech = useMemo(() => {
    const m = new Map<string, { jobs: number; billed: number; cash: number; gcash: number; other: number; balance: number }>();
    for (const j of live) {
      const k = j.staff?.full_name ?? "—";
      const t = m.get(k) ?? { jobs: 0, billed: 0, cash: 0, gcash: 0, other: 0, balance: 0 };
      t.jobs++;
      t.billed += Number(j.total_amount);
      t.balance += Number(j.balance);
      for (const p of j.bill_payments) {
        if (p.method === "cash") t.cash += Number(p.amount);
        else if (p.method === "gcash") t.gcash += Number(p.amount);
        else t.other += Number(p.amount);
      }
      m.set(k, t);
    }
    return [...m.entries()].sort((a, b) => b[1].billed - a[1].billed);
  }, [live]);
  const totals = perTech.reduce((s, [, t]) => ({ jobs: s.jobs + t.jobs, billed: s.billed + t.billed, cash: s.cash + t.cash, gcash: s.gcash + t.gcash, balance: s.balance + t.balance }), { jobs: 0, billed: 0, cash: 0, gcash: 0, balance: 0 });

  return (
    <>
      <header className="border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
        <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Home Service jobs</h1>
        <p className="mt-0.5 text-sm text-stone-500">Everything technicians record in the Home Service phone app.</p>
      </header>

      <main className="space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${range === r.key ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={range === r.key ? { backgroundColor: "#0F1E3A" } : undefined}>{r.label}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <Stat label="Jobs" value={String(totals.jobs)} />
          <Stat label="Billed" value={peso(totals.billed)} />
          <Stat label="Cash collected" value={peso(totals.cash)} sub={`GCash ${peso(totals.gcash)}`} tone="green" />
          <Stat label="Still unpaid" value={peso(totals.balance)} tone={totals.balance > 0 ? "red" : undefined} />
        </div>

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 bg-stone-50 px-4 py-2.5 font-bold" style={{ color: "#0F1E3A" }}>By technician</div>
          {perTech.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-500">{jobs === null ? "Loading…" : "No jobs in this period."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Technician</th>
                    <th className="px-4 py-2 text-right">Jobs</th>
                    <th className="px-4 py-2 text-right">Billed</th>
                    <th className="px-4 py-2 text-right">Cash to hand over</th>
                    <th className="px-4 py-2 text-right">GCash</th>
                    <th className="px-4 py-2 text-right">Unpaid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {perTech.map(([name, t]) => (
                    <tr key={name} onClick={() => setTech(tech === name ? "all" : name)} className={`cursor-pointer hover:bg-stone-50 ${tech === name ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "#0F1E3A" }}>{name}</td>
                      <td className="px-4 py-2.5 text-right">{t.jobs}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{peso(t.billed)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{peso(t.cash)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{peso(t.gcash)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${t.balance > 0 ? "text-red-600" : "text-stone-500"}`}>{peso(t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
            <span className="font-bold" style={{ color: "#0F1E3A" }}>Jobs {tech !== "all" && `— ${tech}`}</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={tech === "all"} onClick={() => setTech("all")}>All techs</Chip>
              {techs.map((t) => <Chip key={t} active={tech === t} onClick={() => setTech(t)}>{t}</Chip>)}
            </div>
          </div>
          {jobs === null ? (
            <div className="px-4 py-8 text-center text-stone-500">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="px-4 py-8 text-center text-stone-500">No home service jobs yet in this period.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {shown.map((j) => {
                const isOpen = open === j.id;
                const methods = Array.from(new Set(j.bill_payments.map((p) => (p.method === "gcash" ? "GCash" : p.method === "cash" ? "Cash" : p.method)))).join(" + ");
                const details = (j.notes ?? "").split("\n").slice(1).join("\n");
                return (
                  <div key={j.id} className={j.status === "void" ? "opacity-50" : ""}>
                    <button onClick={() => setOpen(isOpen ? null : j.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-stone-50">
                      {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold" style={{ color: "#0F1E3A" }}>{j.client_name || "—"} <span className="font-normal text-stone-500">· {[j.vehicle_description, j.plate_number].filter(Boolean).join(" · ")}</span></div>
                        <div className="mt-0.5 text-xs text-stone-500">{fmtTime(j.created_at)} · {j.staff?.full_name ?? "—"} · <span className="font-mono">{j.bill_no}</span></div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono font-bold">{peso(Number(j.total_amount))}</div>
                        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-xs">
                          {methods && <span className="text-stone-500">{methods}</span>}
                          <span className={`rounded border px-1.5 py-0.5 font-bold ${BILL_STATUS_STYLE[j.status] ?? ""}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
                        </div>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="grid gap-4 border-t border-stone-100 bg-stone-50/60 px-4 py-3 pl-11 text-sm md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-bold uppercase text-stone-500">Work done</div>
                          {j.bill_line_items.map((l, i) => (
                            <div key={i} className="flex justify-between gap-3 py-0.5"><span>{l.qty > 1 ? `${l.qty} × ` : ""}{l.description.split("\n")[0]}</span><span className="font-mono">{peso(Number(l.amount))}</span></div>
                          ))}
                          <div className="mt-2 text-xs text-stone-500">
                            {j.client_contact && <>Contact: {j.client_contact} · </>}
                            {j.odometer_km ? <>Odometer: {j.odometer_km.toLocaleString()} km · </> : null}
                            {j.service_history_id ? <span className="text-emerald-700">Saved to service history</span> : <span className="text-amber-700">Not in service history (no plate)</span>}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-bold uppercase text-stone-500">Job details</div>
                          <div className="whitespace-pre-wrap text-stone-700">{details || "—"}</div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                            <Link to="/admin/walkin/bills/$billId" params={{ billId: j.id }} className="underline" style={{ color: "#0F1E3A" }}>Open bill →</Link>
                            {j.vehicle_id && <Link to="/admin/walkin/vehicles/$vehicleId" params={{ vehicleId: j.vehicle_id }} className="underline" style={{ color: "#0F1E3A" }}>Car history →</Link>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="flex items-center gap-2 text-xs text-stone-500"><Smartphone className="h-4 w-4" /> Jobs also appear in Billing, in "Collected today" on the Overview, and in each car's service history.</p>
      </main>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`} style={tone ? undefined : { color: "#0F1E3A" }}>{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${active ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={active ? { backgroundColor: "#0F1E3A" } : undefined}>
      {children}
    </button>
  );
}
