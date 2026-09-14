import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Car, CheckCircle2, Clock, Home, Image, Mail, MapPin,
  Phone, RefreshCw, ShieldAlert, X, XCircle,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";

export const Route = createFileRoute("/admin/homeservice")({
  head: () => ({ meta: [{ title: "Home Service — C-Tech Admin" }] }),
  component: AdminHomeServicePage,
});

type Booking = {
  id: string;
  visit_date: string;
  time_slot: string;
  service_type: string;
  vehicle: string | null;
  barangay: string | null;
  municipality: string | null;
  maps_link: string | null;
  site_risk: boolean;
  site_notes: string | null;
  name: string | null;
  contact: string | null;
  email: string | null;
  estimate_summary: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  payment_reference: string | null;
  payment_proof_path: string | null;
  payment_submitted_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isExpired(b: Booking) {
  return b.status === "pending" && !b.payment_reference && !!b.expires_at && new Date(b.expires_at) < new Date();
}

function statusInfo(b: Booking): { label: string; className: string } {
  if (b.status === "confirmed") return { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (b.status === "completed") return { label: "Completed", className: "bg-stone-100 text-stone-600 border border-stone-200" };
  if (b.status === "cancelled") return { label: "Cancelled", className: "bg-red-50 text-red-600 border border-red-200" };
  if (b.payment_reference) return { label: "Payment Submitted", className: "bg-blue-50 text-blue-600 border border-blue-200" };
  if (isExpired(b)) return { label: "Expired — Unpaid", className: "bg-stone-100 text-stone-500 border border-stone-200" };
  return { label: "Awaiting Payment", className: "bg-yellow-50 text-yellow-700 border border-yellow-200" };
}

function StatusBadge({ b }: { b: Booking }) {
  const s = statusInfo(b);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.className}`}>
      {s.label}
    </span>
  );
}

function AdminHomeServicePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabaseFleet
      .from("home_service_bookings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load home service bookings.");
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(b: Booking, status: Booking["status"], successMsg: string) {
    setBusyId(b.id);
    const { error } = await supabaseFleet.from("home_service_bookings").update({ status }).eq("id", b.id);
    setBusyId(null);
    if (error) { toast.error("Something went wrong — please try again."); return; }
    setBookings((prev) => prev.map((row) => (row.id === b.id ? { ...row, status } : row)));
    toast.success(successMsg);
  }

  const [viewingId, setViewingId] = useState<string | null>(null);
  async function viewProof(b: Booking) {
    if (!b.payment_proof_path) return;
    setViewingId(b.id);
    const { data, error } = await supabaseFleet.storage
      .from("home-service-payments")
      .createSignedUrl(b.payment_proof_path, 300);
    setViewingId(null);
    if (error || !data) { toast.error("Couldn't load the screenshot — please try again."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const needsReview = bookings.filter((b) => b.status === "pending" && (b.payment_reference || b.payment_proof_path)).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#0F1E3A" }}>
            <Home size={22} /> Home Service Bookings
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {needsReview > 0 ? (
              <span className="font-semibold" style={{ color: "#C9A227" }}>
                {needsReview} awaiting confirmation
              </span>
            ) : "Nothing waiting on confirmation"}
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
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400">
          <Home size={40} className="mb-3 opacity-30" />
          <p>No home service bookings yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const canConfirm = b.status === "pending" && (!!b.payment_reference || !!b.payment_proof_path);
            const canCancel = b.status === "pending" || b.status === "confirmed";
            const canComplete = b.status === "confirmed";
            const dateLabel = new Date(b.visit_date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

            return (
              <div
                key={b.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition ${
                  canConfirm ? "border-blue-300" : b.status === "pending" ? "border-yellow-200" : "border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-stone-900">{b.name || "Unnamed"}</span>
                      <StatusBadge b={b} />
                      {b.site_risk && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1">
                          <ShieldAlert size={10} /> Site Risk
                        </span>
                      )}
                      <span className="text-xs text-stone-400 ml-auto">{timeAgo(b.created_at)}</span>
                    </div>

                    <div className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>
                      {b.service_type} · {dateLabel} · {b.time_slot}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
                      {b.contact && (
                        <a href={`tel:${b.contact}`} className="flex items-center gap-1.5 hover:text-[#0F1E3A] transition">
                          <Phone size={13} style={{ color: "#C9A227" }} />{b.contact}
                        </a>
                      )}
                      {b.email && (
                        <a href={`mailto:${b.email}`} className="flex items-center gap-1.5 hover:text-[#0F1E3A] transition">
                          <Mail size={13} style={{ color: "#C9A227" }} />{b.email}
                        </a>
                      )}
                      {b.vehicle && (
                        <span className="flex items-center gap-1.5">
                          <Car size={13} style={{ color: "#C9A227" }} />{b.vehicle}
                        </span>
                      )}
                      {(b.barangay || b.municipality) && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} style={{ color: "#C9A227" }} />
                          {[b.barangay, b.municipality].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>

                    {b.estimate_summary && (
                      <p className="mt-3 text-sm text-stone-500 bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                        {b.estimate_summary}
                      </p>
                    )}

                    {(b.payment_reference || b.payment_proof_path) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-blue-700 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                        {b.payment_reference && <span>GCash Ref: <strong>{b.payment_reference}</strong></span>}
                        {b.payment_proof_path && (
                          <button
                            onClick={() => viewProof(b)}
                            disabled={viewingId === b.id}
                            className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 font-sans font-semibold text-blue-700 hover:bg-blue-200 transition disabled:opacity-60"
                          >
                            <Image size={12} /> {viewingId === b.id ? "Loading…" : "View Screenshot"}
                          </button>
                        )}
                        {b.payment_submitted_at && <span className="text-blue-400 font-sans"> · submitted {timeAgo(b.payment_submitted_at)}</span>}
                      </div>
                    ) : isExpired(b) ? (
                      <p className="mt-2 text-xs text-stone-400">30-minute hold lapsed with no proof submitted — slot has been released.</p>
                    ) : b.status === "pending" ? (
                      <p className="mt-2 text-xs text-stone-400">Waiting for the customer to submit their GCash reference or screenshot.</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {canConfirm && (
                      <button
                        onClick={() => setStatus(b, "confirmed", "Confirmed — remember to message the customer.")}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                      >
                        {busyId === b.id ? <Clock size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Confirm
                      </button>
                    )}
                    {canComplete && (
                      <button
                        onClick={() => setStatus(b, "completed", "Marked as completed.")}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition disabled:opacity-60"
                      >
                        <CheckCircle2 size={13} /> Mark Completed
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => setStatus(b, "cancelled", "Booking cancelled — slot released.")}
                        disabled={busyId === b.id}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60"
                      >
                        <XCircle size={13} /> {canConfirm ? "Reject" : "Cancel"}
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
