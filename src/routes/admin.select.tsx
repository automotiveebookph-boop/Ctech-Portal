import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, Wrench } from "lucide-react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { CTechLogo } from "@/components/CTechLogo";

export const Route = createFileRoute("/admin/select")({
  head: () => ({
    meta: [{ title: "Admin Panel — C-Tech Automotive" }],
  }),
  component: PanelSelector,
});

type Stats = {
  fleetClients: number;
  fleetVehicles: number;
  services: number;
  customers: number;
  customerVehicles: number;
  appointments: number;
};

function PanelSelector() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) return navigate({ to: "/" });
      const { data: role } = await supabaseFleet
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!role || role.role !== "admin") {
        if (role?.role === "customer") navigate({ to: "/my-car" });
        else if (role?.role === "fleet_manager") navigate({ to: "/dashboard" });
        else navigate({ to: "/" });
        return;
      }
      setAuthorized(true);

      const [fc, fv, sh, cu, cv, ap] = await Promise.all([
        supabaseFleet.from("fleet_clients").select("id", { count: "exact", head: true }),
        supabaseFleet.from("vehicles").select("id", { count: "exact", head: true }).not("client_id", "is", null),
        supabaseFleet.from("service_history").select("id", { count: "exact", head: true }),
        supabaseFleet.from("customers").select("id", { count: "exact", head: true }),
        supabaseFleet.from("vehicles").select("id", { count: "exact", head: true }).not("customer_id", "is", null),
        supabaseFleet.from("appointments").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        fleetClients: fc.count ?? 0,
        fleetVehicles: fv.count ?? 0,
        services: sh.count ?? 0,
        customers: cu.count ?? 0,
        customerVehicles: cv.count ?? 0,
        appointments: ap.count ?? 0,
      });
    })();
  }, [navigate]);

  async function signOut() {
    await supabaseFleet.auth.signOut();
    navigate({ to: "/" });
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center py-12">
      <div className="text-center mb-10 px-4">
        <div className="flex justify-center">
          <CTechLogo variant="dark" size="md" />
        </div>
        <p className="text-xs text-stone-500 mt-2 uppercase" style={{ letterSpacing: "0.2em" }}>
          Next-Level Automotive Excellence
        </p>
        <h1 className="text-2xl font-bold mt-4" style={{ color: "#0F1E3A" }}>
          Welcome back, Admin 👋
        </h1>
        <p className="text-stone-500 mt-1">Choose your workspace to continue</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto px-6 w-full">
        {/* Fleet Panel */}
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="group bg-white rounded-2xl border-2 border-stone-200 p-8 hover:shadow-lg transition text-left cursor-pointer flex flex-col items-center"
          style={{ borderColor: undefined }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0F1E3A")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
        >
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            <Truck className="w-8 h-8 text-white" />
          </div>
          <div className="text-xl font-bold mt-4 mb-2" style={{ color: "#0F1E3A" }}>
            Fleet Panel
          </div>
          <p className="text-sm text-stone-500 mb-6 text-center">
            Manage fleet clients, vehicles, service logs, monthly reports and pricing
          </p>
          <div className="border-t border-stone-100 w-full pt-4 mb-6">
            <div className="flex justify-around text-center">
              <Stat n={stats?.fleetClients} label="Clients" />
              <Stat n={stats?.fleetVehicles} label="Vehicles" />
              <Stat n={stats?.services} label="Services" />
            </div>
          </div>
          <div
            className="w-full py-3 rounded-xl text-white font-bold mt-auto text-center"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            Enter Fleet Panel →
          </div>
        </button>

        {/* Client Dashboard */}
        <button
          onClick={() => navigate({ to: "/admin/walkin" })}
          className="group bg-white rounded-2xl border-2 border-stone-200 p-8 hover:shadow-lg transition text-left cursor-pointer flex flex-col items-center"
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A227")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
        >
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#C9A227" }}
          >
            <Wrench className="w-8 h-8" style={{ color: "#0F1E3A" }} />
          </div>
          <div className="text-xl font-bold mt-4 mb-2" style={{ color: "#0F1E3A" }}>
            Client Dashboard
          </div>
          <p className="text-sm text-stone-500 mb-6 text-center">
            Manage walk-in customers, appointments, bookings and customer vehicles
          </p>
          <div className="border-t border-stone-100 w-full pt-4 mb-6">
            <div className="flex justify-around text-center">
              <Stat n={stats?.customers} label="Customers" />
              <Stat n={stats?.customerVehicles} label="Vehicles" />
              <Stat n={stats?.appointments} label="Bookings" />
            </div>
          </div>
          <div
            className="w-full py-3 rounded-xl font-bold mt-auto text-center"
            style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
          >
            Enter Client Dashboard →
          </div>
        </button>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={signOut}
          className="text-sm text-stone-400 hover:text-stone-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number | undefined; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>
        {n ?? "—"}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5">
        {label}
      </div>
    </div>
  );
}
