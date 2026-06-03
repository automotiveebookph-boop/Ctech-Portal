import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Menu, Wrench, X } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";

type NavLink = {
  to: "/my-car" | "/my-car/history" | "/my-car/book" | "/my-car/appointments";
  label: string;
};

const LINKS: NavLink[] = [
  { to: "/my-car", label: "My Car" },
  { to: "/my-car/history", label: "History" },
  { to: "/my-car/book", label: "Book Service" },
  { to: "/my-car/appointments", label: "My Bookings" },
];

export function MyCarTopNav({
  firstName,
  customerId,
}: {
  firstName: string;
  customerId?: string | null;
}) {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabaseFleet
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .in("status", ["pending", "confirmed"]);
      if (!cancelled) setPendingCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    await supabaseFleet.auth.signOut();
    navigate({ to: "/" });
  }

  const initial = (firstName?.[0] ?? "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white px-4 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* Left: brand */}
        <Link to="/my-car" className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#C9A227" }}
          >
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold" style={{ color: "#0F1E3A" }}>
              C-TECH
            </div>
            <div
              className="text-[9px] font-semibold uppercase"
              style={{ letterSpacing: "0.2em", color: "#C9A227" }}
            >
              My Car
            </div>
          </div>
        </Link>

        {/* Center nav (desktop) */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.to;
            const showBadge = l.to === "/my-car/appointments" && pendingCount > 0;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-stone-100 text-[#0F1E3A]"
                    : "text-stone-600 hover:bg-stone-50 hover:text-[#0F1E3A]"
                }`}
              >
                {l.label}
                {showBadge && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: name + avatar (desktop) / hamburger (mobile) */}
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-100"
            >
              <span className="text-sm font-medium" style={{ color: "#0F1E3A" }}>
                {firstName}
              </span>
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: "#0F1E3A", color: "#C9A227" }}
              >
                {initial}
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-stone-700" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white md:hidden">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: "#0F1E3A", color: "#C9A227" }}
                >
                  {initial}
                </span>
                <span className="text-sm font-semibold" style={{ color: "#0F1E3A" }}>
                  {firstName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {LINKS.map((l) => {
                const active = pathname === l.to;
                const showBadge =
                  l.to === "/my-car/appointments" && pendingCount > 0;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`flex min-h-[44px] items-center justify-between rounded-lg px-4 py-3 text-sm font-medium ${
                      active
                        ? "bg-stone-100 text-[#0F1E3A]"
                        : "text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <span>{l.label}</span>
                    {showBadge && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-stone-200 p-3">
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </aside>
        </>
      )}
    </header>
  );
}
