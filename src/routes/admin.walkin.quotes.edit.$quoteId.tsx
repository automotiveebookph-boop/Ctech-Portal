import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export const Route = createFileRoute("/admin/walkin/quotes/edit/$quoteId")({
  component: EditQuotePage,
});

type CustomerResult = { id: string; full_name: string; email: string | null; phone: string | null };
type VehicleResult = { id: string; plate_number: string; make: string; model: string; year: number | null; customer_id: string | null };
type QuoteLine = { category: "service" | "part"; description: string; qty: number; unit_price: number; service_pricing_id: string | null };
type Loaded = {
  clientName: string; clientContact: string; vehicleDescription: string; plateNumber: string;
  odometerKm: string; validUntil: string; preparedBy: string; notes: string;
  customer: CustomerResult | null; vehicle: VehicleResult | null; lines: QuoteLine[];
};

function EditQuotePage() {
  const { quoteId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      const { data: q, error } = await supabaseFleet.from("quotes").select("*").eq("id", quoteId).single();
      if (error || !q) {
        toast.error("Quotation not found");
        navigate({ to: "/admin/walkin/quotes" });
        return;
      }
      if (q.converted_job_order_id) {
        toast.error("This quotation was already converted to a job order and can't be edited.");
        navigate({ to: "/admin/walkin/quotes/$quoteId", params: { quoteId } });
        return;
      }

      const [customerRes, vehicleRes, linesRes] = await Promise.all([
        q.customer_id
          ? supabaseFleet.from("customers").select("id, full_name, email, phone").eq("id", q.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        q.vehicle_id
          ? supabaseFleet.from("vehicles").select("id, plate_number, make, model, year, customer_id").eq("id", q.vehicle_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseFleet.from("quote_line_items").select("category, description, qty, unit_price, service_pricing_id").eq("quote_id", quoteId).order("created_at"),
      ]);

      setData({
        clientName: q.client_name ?? "",
        clientContact: q.client_contact ?? "",
        vehicleDescription: q.vehicle_description ?? "",
        plateNumber: q.plate_number ?? "",
        odometerKm: q.odometer_km != null ? String(q.odometer_km) : "",
        validUntil: q.valid_until,
        preparedBy: q.prepared_by ?? "",
        notes: q.notes ?? "",
        customer: (customerRes.data ?? null) as CustomerResult | null,
        vehicle: (vehicleRes.data ?? null) as VehicleResult | null,
        lines: (linesRes.data ?? []) as QuoteLine[],
      });
      setLoading(false);
    })();
  }, [quoteId, navigate]);

  if (loading || !data) return <main className="p-8 text-stone-500">Loading…</main>;

  return (
    <QuoteBuilder
      quoteId={quoteId}
      initialCustomer={data.customer}
      initialVehicle={data.vehicle}
      initialClientName={data.clientName}
      initialClientContact={data.clientContact}
      initialVehicleDescription={data.vehicleDescription}
      initialPlateNumber={data.plateNumber}
      initialOdometerKm={data.odometerKm}
      initialValidUntil={data.validUntil}
      initialPreparedBy={data.preparedBy}
      initialNotes={data.notes}
      initialLines={data.lines}
    />
  );
}
