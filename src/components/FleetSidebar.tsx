import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Car,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Wrench,
  X,
} from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";

type ClientInfo = {
  company_name: string;
  fleet_manager: string;
  tier: string;
};

type NavItem = {
  to: "/dashboard" | "/vehicles" | "/report" | "/history";
  label: string;
  icon: typeof LayoutDashboard;
  badge?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "My Vehicles", icon: Car, badge: true },
  { to: "/report", label: "Monthly Report", icon: FileText },
  { to: "/history", label: "Service History", icon: History },
];

export function FleetSidebar({
  client,
  vehicleCount,
}: {
  client?: ClientInfo | null;
  vehicleCount?: number;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    await supabaseFleet.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-stone-700" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[280px] flex-col transition-transform duration-200 md:z-20 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ backgroundColor: "#0F1E3A" }}
      >
        {/* Mobile close */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand */}
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
              className="text-[10px] font-medium uppercase text-white/50"
              style={{ letterSpacing: "0.3em" }}
            >
              Fleet Portal
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {NAV.map(({ to, label, icon: Icon, badge }) => {
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
                {badge && vehicleCount !== undefined && vehicleCount > 0 && (
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                  >
                    {vehicleCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Account */}
        <div className="border-t border-white/10 p-4">
          {client && (
            <div className="mb-3 rounded-lg bg-white/5 px-4 py-3">
              <div
                className="text-[10px] uppercase text-white/50"
                style={{ letterSpacing: "0.12em" }}
              >
                Account
              </div>
              <div className="truncate text-sm font-semibold text-white">
                {client.company_name}
              </div>
              <div className="truncate text-xs text-white/60">
                {client.fleet_manager}
              </div>
              <div className="mt-2">
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
                >
                  TIER {client.tier}
                </span>
              </div>
            </div>
          )}
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
