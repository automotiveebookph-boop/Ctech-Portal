import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { WalkinSidebar } from "@/components/WalkinSidebar";

export const Route = createFileRoute("/admin/walkin")({
  head: () => ({
    meta: [{ title: "Walk-in Admin — C-Tech Automotive" }],
  }),
  component: WalkinLayout,
});

function WalkinLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabaseFleet.auth.getUser();
      if (!user) return navigate({ to: "/" });
      setEmail(user.email ?? "");
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
    })();
  }, [navigate]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-stone-50">
        <WalkinSidebar email={email} />
        <div className="p-4 pt-16 md:ml-64 md:p-8 md:pt-8">
          <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <WalkinSidebar email={email} />
      <div className="md:ml-64">
        <Outlet />
      </div>
    </div>
  );
}
