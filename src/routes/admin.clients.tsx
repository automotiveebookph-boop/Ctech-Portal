import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { StatusBadge, TierBadge } from "./admin";

export const Route = createFileRoute("/admin/clients")({
  component: ClientsPage,
});

type Client = {
  id: string;
  client_code: string;
  company_name: string;
  fleet_manager: string;
  email: string;
  contact_number: string | null;
  tier: string;
  parts_discount: number;
  labor_discount: number;
  payment_terms: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type FormState = {
  client_code: string;
  company_name: string;
  fleet_manager: string;
  email: string;
  contact_number: string;
  tier: "A" | "B" | "C";
  parts_discount: number;
  labor_discount: number;
  payment_terms: "Net 15" | "Net 30" | "Net 45";
  status: "Active" | "Prospect" | "Inactive";
  notes: string;
};

const TIER_DISCOUNTS: Record<"A" | "B" | "C", { parts: number; labor: number }> = {
  A: { parts: 5, labor: 10 },
  B: { parts: 8, labor: 15 },
  C: { parts: 10, labor: 20 },
};

const EMPTY_FORM: FormState = {
  client_code: "",
  company_name: "",
  fleet_manager: "",
  email: "",
  contact_number: "",
  tier: "A",
  parts_discount: TIER_DISCOUNTS.A.parts,
  labor_discount: TIER_DISCOUNTS.A.labor,
  payment_terms: "Net 30",
  status: "Active",
  notes: "",
};

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicleCounts, setVehicleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [tierFilter, setTierFilter] = useState<string>("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  async function load() {
    setLoading(true);
    const [clientsRes, vehiclesRes] = await Promise.all([
      supabaseFleet.from("fleet_clients").select("*").order("company_name"),
      supabaseFleet.from("vehicles").select("client_id"),
    ]);
    const cs = (clientsRes.data ?? []) as Client[];
    const counts: Record<string, number> = {};
    for (const v of vehiclesRes.data ?? []) {
      counts[v.client_id] = (counts[v.client_id] ?? 0) + 1;
    }
    setClients(cs);
    setVehicleCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (tierFilter !== "All" && c.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.fleet_manager.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.client_code.toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter, tierFilter]);

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
            Fleet Clients
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {clients.length} client{clients.length === 1 ? "" : "s"} enrolled
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "#0F1E3A" }}
        >
          <Plus className="h-4 w-4" />
          Add Client
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company name, manager, email…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option>All</option>
            <option>Active</option>
            <option>Prospect</option>
            <option>Inactive</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="All">All Tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-3 text-left font-bold">Code</th>
                <th className="px-6 py-3 text-left font-bold">Company</th>
                <th className="px-6 py-3 text-left font-bold">Manager</th>
                <th className="px-6 py-3 text-left font-bold">Contact</th>
                <th className="px-6 py-3 text-left font-bold">Tier</th>
                <th className="px-6 py-3 text-left font-bold">Status</th>
                <th className="px-6 py-3 text-left font-bold">Vehicles</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-500">
                    No clients match these filters
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 font-mono text-xs text-stone-500">
                      {c.client_code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                        {c.company_name}
                      </div>
                      <div className="text-xs text-stone-500">{c.email}</div>
                    </td>
                    <td className="px-6 py-4">{c.fleet_manager}</td>
                    <td className="px-6 py-4 text-stone-700">{c.contact_number ?? "—"}</td>
                    <td className="px-6 py-4">
                      <TierBadge tier={c.tier} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {vehicleCounts[c.id] ?? 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setModalOpen(true);
                        }}
                        className="mr-3 text-xs font-semibold hover:underline"
                        style={{ color: "#0F1E3A" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      {modalOpen && (
        <ClientFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}

      {deleting && (
        <DeleteModal
          client={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ClientFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return EMPTY_FORM;
    return {
      client_code: initial.client_code,
      company_name: initial.company_name,
      fleet_manager: initial.fleet_manager,
      email: initial.email,
      contact_number: initial.contact_number ?? "",
      tier: (initial.tier as "A" | "B" | "C") ?? "A",
      parts_discount: initial.parts_discount,
      labor_discount: initial.labor_discount,
      payment_terms: (initial.payment_terms as FormState["payment_terms"]) ?? "Net 30",
      status: (initial.status as FormState["status"]) ?? "Active",
      notes: initial.notes ?? "",
    };
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onTierChange(tier: "A" | "B" | "C") {
    const d = TIER_DISCOUNTS[tier];
    setForm((f) => ({ ...f, tier, parts_discount: d.parts, labor_discount: d.labor }));
  }

  async function handleSave() {
    if (
      !form.client_code ||
      !form.company_name ||
      !form.fleet_manager ||
      !form.email
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const payload = {
      client_code: form.client_code.toUpperCase(),
      company_name: form.company_name,
      fleet_manager: form.fleet_manager,
      email: form.email,
      contact_number: form.contact_number || null,
      tier: form.tier,
      parts_discount: form.parts_discount,
      labor_discount: form.labor_discount,
      payment_terms: form.payment_terms,
      status: form.status,
      notes: form.notes || null,
    };
    const res = initial
      ? await supabaseFleet.from("fleet_clients").update(payload).eq("id", initial.id)
      : await supabaseFleet.from("fleet_clients").insert([payload]);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(initial ? "Client updated" : "Client added");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? "Edit Fleet Client" : "Add New Fleet Client"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Client Code" required hint="e.g., FC-004">
            <input
              type="text"
              value={form.client_code}
              onChange={(e) => update("client_code", e.target.value.toUpperCase())}
              className={inputCls}
            />
          </Field>
          <Field label="Company Name" required>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fleet Manager Name" required>
            <input
              type="text"
              value={form.fleet_manager}
              onChange={(e) => update("fleet_manager", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Contact Number">
            <input
              type="text"
              value={form.contact_number}
              onChange={(e) => update("contact_number", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Tier" required>
            <select
              value={form.tier}
              onChange={(e) => onTierChange(e.target.value as "A" | "B" | "C")}
              className={inputCls}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </Field>
          <Field label="Parts Discount %">
            <input
              type="number"
              value={form.parts_discount}
              readOnly
              className={`${inputCls} bg-stone-50`}
            />
          </Field>
          <Field label="Labor Discount %">
            <input
              type="number"
              value={form.labor_discount}
              readOnly
              className={`${inputCls} bg-stone-50`}
            />
          </Field>
          <Field label="Payment Terms" required>
            <select
              value={form.payment_terms}
              onChange={(e) =>
                update("payment_terms", e.target.value as FormState["payment_terms"])
              }
              className={inputCls}
            >
              <option>Net 15</option>
              <option>Net 30</option>
              <option>Net 45</option>
            </select>
          </Field>
          <Field label="Status" required>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value as FormState["status"])}
              className={inputCls}
            >
              <option>Active</option>
              <option>Prospect</option>
              <option>Inactive</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            {saving ? "Saving…" : "Save Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-stone-900";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {hint && <span className="ml-2 font-normal normal-case text-stone-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function DeleteModal({
  client,
  onClose,
  onDeleted,
}: {
  client: Client;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabaseFleet.from("fleet_clients").delete().eq("id", client.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client deleted");
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
          Delete Fleet Client?
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Are you sure you want to delete <strong>{client.company_name}</strong>? This will
          also delete all their vehicles and service history. This action cannot be undone.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
