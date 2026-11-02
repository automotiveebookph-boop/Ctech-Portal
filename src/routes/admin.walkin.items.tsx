import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";
import { categorizeItem, ITEM_CATEGORIES, OTHER_CATEGORY } from "@/lib/item-categories";

export const Route = createFileRoute("/admin/walkin/items")({
  component: ItemsPage,
});

type RawLine = {
  description: string;
  category: "service" | "part";
  unit_price: number;
  created_at: string;
  quote_id: string;
  quotes: { quote_no: string | null; client_name: string | null; status: string | null; converted_bill_id: string | null } | null;
};

type Use = { quoteId: string; quoteNo: string | null; client: string | null; date: string; price: number; pushed: boolean };
type Item = {
  key: string;
  title: string;
  type: "service" | "part";
  category: { key: string; label: string };
  uses: Use[];
  lastPrice: number;
  min: number;
  max: number;
  lastDate: string;
  pushed: number;
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const CATEGORY_ORDER = [...ITEM_CATEGORIES.map((c) => c.key), OTHER_CATEGORY.key];

function ItemsPage() {
  const [lines, setLines] = useState<RawLine[] | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "service" | "part">("all");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseFleet
        .from("quote_line_items")
        .select("description, category, unit_price, created_at, quote_id, quotes (quote_no, client_name, status, converted_bill_id)")
        .gt("unit_price", 0)
        .order("created_at", { ascending: false })
        .limit(5000);
      setLines((data ?? []) as unknown as RawLine[]);
    })();
  }, []);

  // One row per distinct item (same title + service/part, ignoring case), newest first.
  const items = useMemo<Item[]>(() => {
    const map = new Map<string, Item>();
    for (const l of lines ?? []) {
      const title = l.description.split("\n")[0].trim();
      if (!title) continue;
      const key = `${l.category}|${title.toLowerCase().replace(/\s+/g, " ")}`;
      const use: Use = {
        quoteId: l.quote_id,
        quoteNo: l.quotes?.quote_no ?? null,
        client: l.quotes?.client_name ?? null,
        date: l.created_at,
        price: Number(l.unit_price),
        pushed: l.quotes?.status === "approved" || Boolean(l.quotes?.converted_bill_id),
      };
      const it = map.get(key);
      if (it) {
        it.uses.push(use);
        it.min = Math.min(it.min, use.price);
        it.max = Math.max(it.max, use.price);
        if (use.pushed) it.pushed++;
      } else {
        map.set(key, {
          key, title, type: l.category, category: categorizeItem(title), uses: [use],
          lastPrice: use.price, min: use.price, max: use.price, lastDate: use.date, pushed: use.pushed ? 1 : 0,
        });
      }
    }
    return [...map.values()];
  }, [lines]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => (type === "all" || i.type === type) && (cat === "all" || i.category.key === cat) && (!s || i.title.toLowerCase().includes(s)));
  }, [items, search, type, cat]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (type === "all" || i.type === type) m.set(i.category.key, (m.get(i.category.key) ?? 0) + 1);
    return m;
  }, [items, type]);

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of filtered) m.set(i.category.key, [...(m.get(i.category.key) ?? []), i]);
    return CATEGORY_ORDER.filter((k) => m.has(k)).map((k) => {
      // Most-quoted first, then A–Z so similar wording sits together.
      const list = m.get(k)!.sort((a, b) => b.uses.length - a.uses.length || a.title.localeCompare(b.title));
      return { key: k, label: list[0].category.label, list };
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const services = items.filter((i) => i.type === "service").length;
    const top = [...items].sort((a, b) => b.uses.length - a.uses.length)[0];
    const varies = items.filter((i) => i.min !== i.max).length;
    return { total: items.length, services, parts: items.length - services, top, varies };
  }, [items]);

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["Category", "Item", "Type", "Times quoted", "Pushed through", "Last price", "Lowest", "Highest", "Last quoted"]];
    for (const g of groups) for (const i of g.list) rows.push([g.label, i.title, i.type, String(i.uses.length), String(i.pushed), String(i.lastPrice), String(i.min), String(i.max), i.lastDate.slice(0, 10)]);
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `C-Tech-Services-and-Parts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#C9A227" }}>C-Tech Client Dashboard</div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>Services &amp; Parts</h1>
          <p className="mt-0.5 text-sm text-stone-500">Everything you've quoted, grouped by system — from {lines?.length ?? "…"} quote lines</p>
        </div>
        <button onClick={exportCsv} disabled={!items.length} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
          <Download className="h-4 w-4" /> Export to Excel (CSV)
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          <Stat label="Different items" value={String(stats.total)} sub={`${stats.services} services · ${stats.parts} parts`} />
          <Stat label="Most quoted" value={stats.top ? `${stats.top.uses.length}×` : "—"} sub={stats.top?.title ?? ""} />
          <Stat label="Price varies" value={String(stats.varies)} sub="items quoted at different prices" tone="amber" />
          <Stat label="Systems" value={String(groups.length)} sub="categories with items" />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search an item — e.g. brake, ATF, coolant…" className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900" />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-stone-300">
            {(["all", "service", "part"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 text-xs font-semibold ${type === t ? "text-white" : "bg-white text-stone-600"}`} style={type === t ? { backgroundColor: "#0F1E3A" } : undefined}>
                {t === "all" ? "All" : t === "service" ? "Services" : "Parts"}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>All systems</Chip>
          {CATEGORY_ORDER.filter((k) => catCounts.has(k)).map((k) => (
            <Chip key={k} active={cat === k} onClick={() => setCat(k)}>
              {(ITEM_CATEGORIES.find((c) => c.key === k) ?? OTHER_CATEGORY).label} ({catCounts.get(k)})
            </Chip>
          ))}
        </div>

        {lines === null ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-stone-500">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center text-stone-500">No items match.</div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.key} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2.5">
                  <h2 className="font-bold" style={{ color: "#0F1E3A" }}>{g.label}</h2>
                  <span className="text-xs text-stone-500">{g.list.length} item{g.list.length === 1 ? "" : "s"}</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {g.list.map((i) => {
                    const isOpen = open === i.key;
                    return (
                      <div key={i.key}>
                        <button onClick={() => setOpen(isOpen ? null : i.key)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50">
                          {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>{i.title}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                              <span className={`rounded px-1.5 py-0.5 font-bold uppercase ${i.type === "part" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"}`}>{i.type}</span>
                              <span>quoted {i.uses.length}×</span>
                              {i.pushed > 0 && <span className="text-emerald-700">· {i.pushed} pushed through</span>}
                              <span>· last {fmtDate(i.lastDate)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-sm font-bold">{peso(i.lastPrice)}</div>
                            {i.min !== i.max && <div className="text-xs font-semibold text-amber-700">{peso(i.min)} – {peso(i.max)}</div>}
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 pl-11">
                            {i.uses.map((u, n) => (
                              <Link key={n} to="/admin/walkin/quotes/$quoteId" params={{ quoteId: u.quoteId }} className="flex items-center justify-between gap-3 py-1.5 text-sm hover:underline">
                                <span className="min-w-0 truncate">
                                  <span className="font-mono text-xs text-stone-500">{u.quoteNo}</span> · {u.client || "—"} · <span className="text-stone-500">{fmtDate(u.date)}</span>
                                  {u.pushed && <span className="ml-1.5 text-xs font-semibold text-emerald-700">✓</span>}
                                </span>
                                <span className="shrink-0 font-mono">{peso(u.price)}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${tone === "amber" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${tone === "amber" ? "text-amber-700" : "text-stone-500"}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "amber" ? "text-amber-700" : ""}`} style={tone ? undefined : { color: "#0F1E3A" }}>{value}</div>
      <div className="truncate text-xs text-stone-500">{sub}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-transparent text-white" : "border-stone-200 bg-white text-stone-600"}`} style={active ? { backgroundColor: "#0F1E3A" } : undefined}>
      {children}
    </button>
  );
}
