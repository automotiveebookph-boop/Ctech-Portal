import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarCheck,
  Car,
  LogOut,
  Menu,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { STATUS_STYLES } from "@/lib/fleet-utils";

type DueVehicle = {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  service_status: "OVERDUE" | "DUE NOW";
  customer_name: string | null;
};

type NavItem = {
  to:
    | "/admin/walkin"
    | "/admin/walkin/customers"
    | "/admin/walkin/appointments"
    | "/admin/walkin/vehicles"
    | "/admin/walkin/reminders"
    | "/admin/walkin/schedules";
  label: string;
  icon: typeof BarChart3;
  showBadge?: "pending" | "due";
};

const NAV: NavItem[] = [
  { to: "/admin/walkin", label: "Overview", icon: BarChart3 },
  { to: "/admin/walkin/customers", label: "Customers", icon: Users },
  {
    to: "/admin/walkin/appointments",
    label: "Appointments",
    icon: CalendarCheck,
    showBadge: "pending",
  },
  { to: "/admin/walkin/schedules", label: "Schedules", icon: CalendarCheck },
  { to: "/admin/walkin/vehicles", label: "Vehicles", icon: Car },
  {
    to: "/admin/walkin/reminders",
    label: "Service Reminders",
    icon: Bell,
    showBadge: "due",
  },
];


export function WalkinSidebar({ email }: { email?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [dueVehicles, setDueVehicles] = useState<DueVehicle[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notifOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [notifOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pending, dueRes] = await Promise.all([
        supabaseFleet
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseFleet
          .from("vehicle_status_view")
          .select("id, plate_number, make, model, service_status, customer_id")
          .not("customer_id", "is", null)
          .neq("status", "archived")
          .in("service_status", ["OVERDUE", "DUE NOW"]),
      ]);
      if (cancelled) return;
      setPendingCount(pending.count ?? 0);

      const dueRows = (dueRes.data ?? []) as {
        id: string;
        plate_number: string;
        make: string;
        model: string;
        service_status: "OVERDUE" | "DUE NOW";
        customer_id: string;
      }[];
      setDueCount(dueRows.length);

      const customerIds = [...new Set(dueRows.map((v) => v.customer_id))];
      const nameById = new Map<string, string>();
      if (customerIds.length) {
        const { data: custs } = await supabaseFleet
          .from("customers")
          .select("id, full_name")
          .in("id", customerIds);
        for (const c of custs ?? []) nameById.set(c.id, c.full_name);
      }
      if (!cancelled) {
        setDueVehicles(
          dueRows
            .sort((a, b) => (a.service_status === b.service_status ? 0 : a.service_status === "OVERDUE" ? -1 : 1))
            .map((v) => ({
              id: v.id,
              plate_number: v.plate_number,
              make: v.make,
              model: v.model,
              service_status: v.service_status,
              customer_name: nameById.get(v.customer_id) ?? null,
            })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    await supabaseFleet.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-stone-700" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[280px] flex-col bg-stone-900 transition-transform duration-200 md:z-20 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#C9A227" }}
            >
              <Wrench className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold text-white">C-TECH</div>
              <div
                className="text-[10px] font-medium uppercase"
                style={{ letterSpacing: "0.3em", color: "#C9A227" }}
              >
                Client Dashboard
              </div>
            </div>
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={dueCount > 0 ? `Notifications: ${dueCount} vehicles due for service` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {dueCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {dueCount > 9 ? "9+" : dueCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-2xl">
                <div className="border-b border-stone-100 px-4 py-3">
                  <div className="text-sm font-bold" style={{ color: "#0F1E3A" }}>
                    Service Due Notifications
                  </div>
                  <div className="text-xs text-stone-500">
                    {dueCount === 0 ? "Nothing due right now" : `${dueCount} vehicle${dueCount === 1 ? "" : "s"} need PMS / oil change`}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {dueVehicles.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-stone-400">
                      All vehicles are on schedule.
                    </div>
                  ) : (
                    dueVehicles.slice(0, 8).map((v) => {
                      const s = STATUS_STYLES[v.service_status];
                      return (
                        <Link
                          key={v.id}
                          to="/admin/walkin/vehicles/$vehicleId"
                          params={{ vehicleId: v.id }}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center justify-between gap-3 border-b border-stone-50 px-4 py-3 text-sm hover:bg-stone-50"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold" style={{ color: "#0F1E3A" }}>
                              {v.plate_number} <span className="font-normal text-stone-500">· {v.make} {v.model}</span>
                            </div>
                            <div className="truncate text-xs text-stone-500">{v.customer_name ?? "—"}</div>
                          </div>
                          <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text} ${s.border}`}>
                            {v.service_status}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
                <Link
                  to="/admin/walkin/reminders"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-stone-100 px-4 py-3 text-center text-xs font-semibold hover:bg-stone-50"
                  style={{ color: "#0F1E3A" }}
                >
                  View all in Service Reminders →
                </Link>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {NAV.map(({ to, label, icon: Icon, showBadge }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {showBadge === "pending" && pendingCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
                {showBadge === "due" && dueCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {dueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            to="/admin/select"
            className="mb-3 flex items-center gap-2 text-xs text-white/50 hover:text-white"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch Panel
          </Link>
          <div className="mb-3 rounded-lg bg-white/5 px-4 py-3">
            <div
              className="text-[10px] uppercase"
              style={{ letterSpacing: "0.12em", color: "#C9A227" }}
            >
              Admin Account
            </div>
            <div className="truncate text-sm font-semibold text-white">
              {email ?? "—"}
            </div>
            <div className="mt-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
              >
                STAFF
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
