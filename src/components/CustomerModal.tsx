import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import type { Customer } from "@/lib/fleet-utils";
import { isValidPHPhone, normalizePHPhone } from "@/lib/phone";

const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900";

export function CustomerModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Customer | null;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    customer_type: initial?.customer_type ?? "private",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
    outstanding_balance: initial?.outstanding_balance ?? 0,
    tin: initial?.tin ?? "",
    viber_whatsapp: initial?.viber_whatsapp ?? false,
    messenger_name: initial?.messenger_name ?? "",
    barangay: initial?.barangay ?? "",
    city: initial?.city ?? "",
    preferred_contact_person: initial?.preferred_contact_person ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!form.phone.trim() || !isValidPHPhone(form.phone)) {
      toast.error("Enter a valid PH mobile number (e.g. 0917 123 4567)");
      return;
    }
    const phone = normalizePHPhone(form.phone);
    const email = form.email.trim().toLowerCase();

    let dupQuery = supabaseFleet
      .from("customers")
      .select("id, full_name")
      .or(`phone.eq.${phone}${email ? `,email.ilike.${email}` : ""}`)
      .neq("status", "archived");
    if (initial) dupQuery = dupQuery.neq("id", initial.id);
    const dup = await dupQuery.maybeSingle();
    if (dup.data) {
      toast.error(`A customer with this mobile/email already exists: ${dup.data.full_name}`);
      return;
    }

    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      phone,
      customer_type: form.customer_type,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      outstanding_balance: Number(form.outstanding_balance) || 0,
      tin: form.tin.trim() || null,
      viber_whatsapp: form.viber_whatsapp,
      messenger_name: form.messenger_name.trim() || null,
      barangay: form.barangay.trim() || null,
      city: form.city.trim() || null,
      preferred_contact_person: form.preferred_contact_person.trim() || null,
    };
    const res = initial
      ? await supabaseFleet.from("customers").update(payload).eq("id", initial.id).select().single()
      : await supabaseFleet.from("customers").insert([payload]).select().single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(initial ? "Customer updated" : "Customer added");
    onSaved(res.data as Customer);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>
            {initial ? "Edit Customer" : "Add Customer"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Full Name *</label>
            <input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Individual or company name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Mobile Number *</label>
            <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0917 123 4567" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Customer Type *</label>
            <select className={input} value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value as Customer["customer_type"] })}>
              <option value="private">Private (Individual)</option>
              <option value="company">Company</option>
              <option value="fleet">Fleet (Corporate)</option>
            </select>
          </div>
          {form.customer_type !== "private" && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">TIN (Tax ID)</label>
              <input className={input} value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="For corporate billing / receipts" />
            </div>
          )}

          <div className="border-t border-stone-200 pt-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Contact Channels</div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Email</label>
                <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.viber_whatsapp}
                  onChange={(e) => setForm({ ...form, viber_whatsapp: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-300"
                />
                Reachable on Viber / WhatsApp at this mobile number
              </label>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Facebook / Messenger Name</label>
                <input className={input} value={form.messenger_name} onChange={(e) => setForm({ ...form, messenger_name: e.target.value })} placeholder="Optional" />
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">Location</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Barangay</label>
                <input className={input} value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">City</label>
                <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Preferred Contact Person</label>
              <input className={input} value={form.preferred_contact_person} onChange={(e) => setForm({ ...form, preferred_contact_person: e.target.value })} placeholder="If owner delegates to a driver/assistant" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Notes</label>
            <textarea rows={2} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Complaints or special instructions" />
          </div>
          <div className="border-t border-stone-200 pt-4">
            <label className="mb-1 block text-xs font-semibold uppercase text-stone-600">Outstanding Balance (₱)</label>
            <input type="number" className={input} value={form.outstanding_balance} onChange={(e) => setForm({ ...form, outstanding_balance: Number(e.target.value) })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
