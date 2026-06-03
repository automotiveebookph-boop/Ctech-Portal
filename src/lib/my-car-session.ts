import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabaseFleet } from "@/lib/supabase-fleet";
import type { Vehicle } from "@/lib/fleet-utils";
import { getOrCreateCustomerRole } from "@/lib/customer-role-linking";

export type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
};

export type MyCarSession = {
  loading: boolean;
  customer: Customer | null;
  vehicle: Vehicle | null;
  userEmail: string;
};

export function useMyCarSession(): MyCarSession {
  const navigate = useNavigate();
  const [state, setState] = useState<MyCarSession>({
    loading: true,
    customer: null,
    vehicle: null,
    userEmail: "",
  });

  useEffect(() => {
    let cancelled = false;
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
        .select("role, customer_id, client_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const linkedRole = await getOrCreateCustomerRole(user.id, user.email, roleData);

      if (!linkedRole) {
        navigate({ to: "/" });
        return;
      }
      if (linkedRole.role === "admin") {
        navigate({ to: "/admin" });
        return;
      }
      if (linkedRole.role === "fleet_manager") {
        navigate({ to: "/dashboard" });
        return;
      }
      if (linkedRole.role !== "customer") {
        await supabaseFleet.auth.signOut();
        navigate({ to: "/" });
        return;
      }
      const customerId = linkedRole.customer_id;
      if (!customerId) {
        await supabaseFleet.auth.signOut();
        navigate({ to: "/" });
        return;
      }

      const [custRes, vehRes] = await Promise.all([
        supabaseFleet.from("customers").select("*").eq("id", customerId).maybeSingle(),
        supabaseFleet
          .from("vehicle_status_view")
          .select("*")
          .eq("customer_id", customerId)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setState({
        loading: false,
        customer: (custRes.data ?? null) as Customer | null,
        vehicle: (vehRes.data ?? null) as Vehicle | null,
        userEmail: user.email ?? "",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return state;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "OVERDUE":
      return "bg-red-600 text-white";
    case "DUE NOW":
      return "bg-amber-500 text-white";
    case "DUE SOON":
      return "bg-yellow-400 text-[#0F1E3A]";
    default:
      return "bg-emerald-500 text-white";
  }
}

export function progressColor(pct: number): string {
  if (pct >= 100) return "bg-red-600";
  if (pct >= 90) return "bg-amber-500";
  if (pct >= 70) return "bg-yellow-400";
  return "bg-emerald-500";
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
