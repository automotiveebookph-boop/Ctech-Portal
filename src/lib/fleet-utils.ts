export type Vehicle = {
  id: string;
  unit_id: string;
  client_id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  oil_type: string;
  oil_liters: number;
  current_km: number;
  next_service_km: number;
  km_to_next_service: number;
  service_status: "OK" | "DUE SOON" | "DUE NOW" | "OVERDUE";
  last_service_km?: number | null;
  pms_interval_km?: number | null;
  vehicle_type?: string | null;
  engine?: string | null;
  engine_type?: string | null;
  last_service_date?: string | null;
  avg_km_per_month?: number | null;
};

export type ServiceRecord = {
  id: string;
  vehicle_id?: string | null;
  unit_id?: string | null;
  service_date: string;
  job_order_number?: string | null;
  odometer_km: number;
  service_performed: string;
  parts_cost?: number | null;
  labor_cost?: number | null;
  total_cost?: number | null;
  notes?: string | null;
};

export type Pricing = {
  service_code: string;
  standard_price: number;
};

export function calculateEstimate(
  vehicle: Pick<Vehicle, "oil_type" | "oil_liters">,
  partsDiscount: number,
  pricingData: Pricing[],
): number {
  let codeSuffix = "SS";
  if (vehicle.oil_type.includes("Fully Synth 5W30")) codeSuffix = "FS-5W30";
  else if (vehicle.oil_type.toLowerCase().includes("fully")) codeSuffix = "FS";

  const serviceCode = `OIL-${vehicle.oil_liters}L-${codeSuffix}`;
  const pricing = pricingData.find((p) => p.service_code === serviceCode);
  if (!pricing) return 0;
  return Math.round(pricing.standard_price * (1 - partsDiscount / 100));
}

export const STATUS_STYLES = {
  OVERDUE: {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  "DUE NOW": {
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  "DUE SOON": {
    text: "text-yellow-800",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    dot: "bg-yellow-400",
  },
  OK: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
} as const;

export function peso(n: number): string {
  return "₱" + n.toLocaleString("en-PH");
}
