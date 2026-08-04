import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pending, due] = await Promise.all([
        supabaseFleet
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseFleet
          .from("vehicle_status_view")
          .select("id", { count: "exact", head: true })
          .not("customer_id", "is", null)
          .neq("status", "archived")
          .in("service_status", ["OVERDUE", "DUE NOW"]),
      ]);
      if (!cancelled) {
        setPendingCount(pending.count ?? 0);
        setDueCount(due.count ?? 0);
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

        <div className="flex items-center gap-3 border-b border-white/10 p-6">
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
