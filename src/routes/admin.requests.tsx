import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Car, CheckCircle2, Clock, Mail, MessageSquare,
  Phone, RefreshCw, UserPlus, X,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";

export const Route = createFileRoute("/admin/requests")({
  head: () => ({ meta: [{ title: "Access Requests — C-Tech Admin" }] }),
  component: AdminRequestsPage,
});

type ContactRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  vehicle_info: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  new:       { label: "New",       className: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
  reviewed:  { label: "Reviewed",  className: "bg-blue-50 text-blue-600 border border-blue-200" },
  activated: { label: "Activated", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status ?? "new"] ?? STATUS_STYLES["new"];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.className}`}>
      {s.label}
    </span>
  );
}

function AdminRequestsPage() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [markingReviewed, setMarkingReviewed] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabaseFleet
      .from("contact_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markReviewed(id: string) {
    setMarkingReviewed(id);
    await supabaseFleet.from("contact_requests").update({ status: "reviewed" }).eq("id", id);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "reviewed" } : r)));
    setMarkingReviewed(null);
  }

  async function activateCustomer(r: ContactRequest) {
    setActivating(r.id);
    const { data: { session } } = await supabaseFleet.auth.getSession();
    const res = await fetch(
      `https://azcrctokesvpwxdptatl.supabase.co/functions/v1/activate-customer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          contact_request_id: r.id,
          email: r.email,
          full_name: r.full_name,
          phone: r.phone,
        }),
      }
    );

    const result = await res.json();
    setActivating(null);

    if (!res.ok) {
      showToast("error", result.error ?? "Activation failed. Please try again.");
    } else {
      setRequests((prev) => prev.map((req) => req.id === r.id ? { ...req, status: "activated" } : req));
      showToast("success", `✓ Invite sent to ${r.email}. They'll receive an email to set their password.`);
    }
  }

  const newCount = requests.filter((r) => !r.status || r.status === "new").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium max-w-sm ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>Access Requests</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {newCount > 0 ? (
              <span className="font-semibold" style={{ color: "#C9A227" }}>
                {newCount} new request{newCount > 1 ? "s" : ""}
              </span>
            ) : "All requests reviewed"}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-stone-400">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400">
          <MessageSquare size={40} className="mb-3 opacity-30" />
          <p>No access requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const isNew = !r.status || r.status === "new";
            const isReviewed = r.status === "reviewed";
            const isActivated = r.status === "activated";
            return (
              <div
                key={r.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition ${
                  isNew ? "border-yellow-300" : isActivated ? "border-emerald-200" : "border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-stone-900">{r.full_name}</span>
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-stone-400 ml-auto">{timeAgo(r.created_at)}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
                      <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 hover:text-[#0F1E3A] transition">
                        <Mail size={13} style={{ color: "#C9A227" }} />{r.email}
                      </a>
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 hover:text-[#0F1E3A] transition">
                          <Phone size={13} style={{ color: "#C9A227" }} />{r.phone}
                        </a>
                      )}
                      {r.vehicle_info && (
                        <span className="flex items-center gap-1.5">
                          <Car size={13} style={{ color: "#C9A227" }} />{r.vehicle_info}
                        </span>
                      )}
                    </div>

                    {r.message && (
                      <p className="mt-3 text-sm text-stone-500 bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                        "{r.message}"
                      </p>
                    )}

                    {isActivated && (
                      <p className="mt-3 text-xs text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Invite email sent — account activated
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Activate button — shown for new or reviewed */}
                    {!isActivated && (
                      <button
                        onClick={() => activateCustomer(r)}
                        disabled={activating === r.id}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                      >
                        {activating === r.id ? (
                          <><Clock size={13} className="animate-spin" /> Activating…</>
                        ) : (
                          <><UserPlus size={13} /> Activate & Invite</>
                        )}
                      </button>
                    )}

                    {/* Mark reviewed — only for new */}
                    {isNew && (
                      <button
                        onClick={() => markReviewed(r.id)}
                        disabled={markingReviewed === r.id}
                        className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition disabled:opacity-60"
                      >
                        {markingReviewed === r.id ? (
                          <Clock size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
