import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { FleetSidebar } from "@/components/FleetSidebar";

type ClientInfo = {
  company_name: string;
  fleet_manager: string;
  tier: string;
};

export function PlaceholderPage({ title }: { title: string }) {
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [vehicleCount, setVehicleCount] = useState<number | undefined>();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabaseFleet.auth.getUser();
      if (!user) {
        navigate({ to: "/" });
        return;
      }
      const { data: roleData } = await supabaseFleet
        .from("user_roles")
        .select("role, client_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!roleData) {
        navigate({ to: "/" });
        return;
      }
      if (roleData.role !== "fleet_manager") {
        navigate({ to: "/admin" });
        return;
      }
      const [c, v] = await Promise.all([
        supabaseFleet
          .from("fleet_clients")
          .select("company_name, fleet_manager, tier")
          .eq("id", roleData.client_id)
          .maybeSingle(),
        supabaseFleet
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("client_id", roleData.client_id),
      ]);
      setClient(c.data as ClientInfo | null);
      setVehicleCount(v.count ?? 0);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-stone-50">
      <FleetSidebar client={client} vehicleCount={vehicleCount} />
      <main className="p-8 pt-16 md:ml-64 md:p-16">
        <h1 className="text-3xl font-bold" style={{ color: "#0F1E3A" }}>
          {title}
        </h1>
      </main>
    </div>
  );
}
