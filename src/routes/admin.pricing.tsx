import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Info,
  List,
  Plus,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { peso } from "@/lib/fleet-utils";

export const Route = createFileRoute("/admin/pricing")({
  component: PricingPage,
});

type PricingRow = {
  id: string;
  service_code: string;
  description: string;
  category: string;
  standard_price: number;
};

const CATEGORIES = ["OIL_CHANGE", "LABOR", "PARTS", "INSPECTION"];

type FormState = {
  service_code: string;
  description: string;
  category: string;
  standard_price: string;
};

const EMPTY_FORM: FormState = {
  service_code: "",
  description: "",
  category: "OIL_CHANGE",
  standard_price: "",
};

function PricingPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PricingRow[]>([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<PricingRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) return;
      const { data: role } = await supabaseFleet
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (role?.role === "admin") setAuthorized(true);
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabaseFleet
      .from("pricing_reference")
      .select("*")
      .order("service_code", { ascending: true });
    if (error) {
      toast.error("Failed to load pricing: " + error.message);
    }
    setRows((data ?? []) as PricingRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) load();
  }, [authorized]);

  const stats = useMemo(() => {
    if (!rows.length) return { count: 0, avg: 0, min: 0, max: 0 };
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const r of rows) {
      sum += r.standard_price;
      if (r.standard_price < min) min = r.standard_price;
      if (r.standard_price > max) max = r.standard_price;
    }
    return {
      count: rows.length,
      avg: Math.round(sum / rows.length),
      min,
      max,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (categoryFilter !== "All" && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.service_code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [rows, search, categoryFilter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: PricingRow) {
    setEditing(row);
    setForm({
      service_code: row.service_code,
      description: row.description,
      category: row.category || "OIL_CHANGE",
      standard_price: String(row.standard_price),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    const price = parseFloat(form.standard_price);
    if (!form.service_code.trim() || !form.description.trim()) {
      toast.error("Service code and description are required");
      return;
    }
    if (!form.category) {
      toast.error("Category is required");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.error("Standard price must be a positive number");
      return;
    }

    setSaving(true);
    const payload = {
      service_code: form.service_code.trim().toUpperCase(),
      description: form.description.trim(),
      category: form.category,
      standard_price: price,
    };

    if (editing) {
      const { error } = await supabaseFleet
        .from("pricing_reference")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast.error("Update failed: " + error.message);
        setSaving(false);
        return;
      }
      toast.success("Service code updated");
    } else {
      const { error } = await supabaseFleet
        .from("pricing_reference")
        .insert([payload]);
      if (error) {
        toast.error("Insert failed: " + error.message);
        setSaving(false);
        return;
      }
      toast.success("Service code added");
    }
    setSaving(false);
    closeModal();
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabaseFleet
      .from("pricing_reference")
      .delete()
      .eq("id", deleting.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    toast.success("Service code deleted");
    setDeleting(null);
    load();
  }

  if (!authorized) {
    return (
      <div className="p-4 md:p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
      </div>
    );
  }

  const previewPrice = parseFloat(form.standard_price) || 0;

  return (
    <div>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "#C9A227" }}
          >
            C-Tech Staff View
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
            Pricing Reference
          </h1>
          <p className="text-sm text-stone-500">
            {stats.count} service codes configured
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50">
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            <Plus className="h-4 w-4" />
            Add Service Code
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8">
        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard
            icon={<List className="h-5 w-5" style={{ color: "#0F1E3A" }} />}
            iconBg="rgba(15,30,58,0.15)"
            value={String(stats.count)}
            label="Service Codes"
            sub="configured for fleet pricing"
          />
          <StatCard
            icon={
              <TrendingUp className="h-5 w-5" style={{ color: "#C9A227" }} />
            }
            iconBg="rgba(201,162,39,0.2)"
            value={stats.count ? peso(stats.avg) : "—"}
            label="Avg Standard Price"
            sub="across all categories"
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
            iconBg="rgba(16,185,129,0.15)"
            value={
              stats.count ? `${peso(stats.min)} – ${peso(stats.max)}` : "—"
            }
            label="Price Range"
            sub="lowest to highest"
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service code, description..."
              className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-stone-400 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter("All");
            }}
            className="text-sm font-semibold text-stone-600 hover:underline"
          >
            Reset
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="min-w-[720px] w-full">
              <thead className="bg-stone-50 text-left">
                <tr>
                  {[
                    "Service Code",
                    "Description",
                    "Category",
                    "Standard Price",
                    "Tier A (5% off)",
                    "Tier B (8% off)",
                    "Tier C (10% off)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-stone-500">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-stone-500">
                      No service codes match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="transition hover:bg-stone-50">
                      <td
                        className="px-6 py-4 font-mono text-sm font-semibold"
                        style={{ color: "#0F1E3A" }}
                      >
                        {r.service_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-700">
                        {r.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700">
                          {r.category}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-sm font-bold"
                        style={{ color: "#0F1E3A" }}
                      >
                        {peso(r.standard_price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600">
                        {peso(Math.round(r.standard_price * 0.95))}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600">
                        {peso(Math.round(r.standard_price * 0.92))}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600">
                        {peso(Math.round(r.standard_price * 0.9))}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEdit(r)}
                            className="text-xs font-semibold hover:underline"
                            style={{ color: "#0F1E3A" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleting(r)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2
                className="text-xl font-bold"
                style={{ color: "#0F1E3A" }}
              >
                {editing
                  ? `Edit Service Code: ${editing.service_code}`
                  : "Add Service Code"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-stone-500 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <p className="text-sm text-blue-900">
                Tier discounts (Tier A: 5%, Tier B: 8%, Tier C: 10%) are
                automatically applied to standard price when fleet managers view
                estimates.
              </p>
            </div>

            <div className="space-y-4">
              <Field label="Service Code *">
                <input
                  value={form.service_code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      service_code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., OIL-5L-FS-5W30 or LABOR-AIR"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono focus:border-stone-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-stone-500">
                  e.g., OIL-5L-FS-5W30 or LABOR-AIR
                </p>
              </Field>

              <Field label="Description *">
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="e.g., 5L Fully Synthetic 5W30 PMS"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
                />
              </Field>

              <Field label="Category *">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono focus:border-stone-400 focus:outline-none"
                >
                  {CATEGORIES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Standard Price (₱) *">
                <input
                  type="number"
                  min={0}
                  value={form.standard_price}
                  onChange={(e) =>
                    setForm({ ...form, standard_price: e.target.value })
                  }
                  placeholder="5000"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
                />
              </Field>

              <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                  Tier Price Preview
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <PreviewCell
                    label="Standard"
                    value={peso(Math.round(previewPrice))}
                    bold
                  />
                  <PreviewCell
                    label="Tier A (5%)"
                    value={peso(Math.round(previewPrice * 0.95))}
                  />
                  <PreviewCell
                    label="Tier B (8%)"
                    value={peso(Math.round(previewPrice * 0.92))}
                  />
                  <PreviewCell
                    label="Tier C (10%)"
                    value={peso(Math.round(previewPrice * 0.9))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#0F1E3A" }}
              >
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save Changes"
                    : "Add Service Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3
              className="mb-2 text-lg font-bold"
              style={{ color: "#0F1E3A" }}
            >
              Delete Service Code
            </h3>
            <p className="mb-6 text-sm text-stone-600">
              Permanently delete{" "}
              <span className="font-mono font-semibold">
                {deleting.service_code}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold text-stone-700">{label}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-600">
        {label}
      </label>
      {children}
    </div>
  );
}

function PreviewCell({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 ${bold ? "font-bold" : "font-semibold"}`}
        style={{ color: "#0F1E3A" }}
      >
        {value}
      </div>
    </div>
  );
}
