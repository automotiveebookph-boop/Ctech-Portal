import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export const Route = createFileRoute("/admin/walkin/bills/edit/$billId")({
  component: EditBillPage,
});

type CustomerResult = { id: string; full_name: string; email: string | null; phone: string | null };
type VehicleResult = { id: string; plate_number: string; make: string; model: string; year: number | null; customer_id: string | null };
type BillLine = { category: "service" | "part"; description: string; qty: number; unit_price: number; service_pricing_id: string | null };
type Loaded = {
  clientName: string; clientContact: string; vehicleDescription: string; plateNumber: string;
  odometerKm: string; dueDate: string; preparedBy: string; notes: string;
  customer: CustomerResult | null; vehicle: VehicleResult | null; lines: BillLine[];
};

function EditBillPage() {
  const { billId } = Route.useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    (async () => {
      const { data: b, error } = await supabaseFleet.from("bills").select("*").eq("id", billId).single();
      if (error || !b) {
        toast.error("Bill not found");
        navigate({ to: "/admin/walkin/bills" });
        return;
      }
      if (b.status === "void") {
        toast.error("This bill is void and can't be edited.");
        navigate({ to: "/admin/walkin/bills/$billId", params: { billId } });
        return;
      }

      const [customerRes, vehicleRes, linesRes] = await Promise.all([
        b.customer_id
          ? supabaseFleet.from("customers").select("id, full_name, email, phone").eq("id", b.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        b.vehicle_id
          ? supabaseFleet.from("vehicles").select("id, plate_number, make, model, year, customer_id").eq("id", b.vehicle_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseFleet.from("bill_line_items").select("category, description, qty, unit_price, service_pricing_id").eq("bill_id", billId).order("created_at"),
      ]);

      setData({
        clientName: b.client_name ?? "",
        clientContact: b.client_contact ?? "",
        vehicleDescription: b.vehicle_description ?? "",
        plateNumber: b.plate_number ?? "",
        odometerKm: b.odometer_km != null ? String(b.odometer_km) : "",
        dueDate: b.due_date,
        preparedBy: b.prepared_by ?? "",
        notes: b.notes ?? "",
        customer: (customerRes.data ?? null) as CustomerResult | null,
        vehicle: (vehicleRes.data ?? null) as VehicleResult | null,
        lines: (linesRes.data ?? []) as BillLine[],
      });
    })();
  }, [billId, navigate]);

  if (!data) return <main className="p-8 text-stone-500">Loading…</main>;

  return (
    <QuoteBuilder
      kind="bill"
      quoteId={billId}
      initialCustomer={data.customer}
      initialVehicle={data.vehicle}
      initialClientName={data.clientName}
      initialClientContact={data.clientContact}
      initialVehicleDescription={data.vehicleDescription}
      initialPlateNumber={data.plateNumber}
      initialOdometerKm={data.odometerKm}
      initialValidUntil={data.dueDate}
      initialPreparedBy={data.preparedBy}
      initialNotes={data.notes}
      initialLines={data.lines}
    />
  );
}
