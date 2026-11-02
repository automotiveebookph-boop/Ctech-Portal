// Job orders dispatched from the office to a technician's phone app.
export type PlannedItem = { title: string; category: "service" | "part"; qty: number; price: number; service_pricing_id?: string | null };

export type TechJob = {
  id: string;
  job_no: string | null;
  status: "unassigned" | "assigned" | "accepted" | "on_the_way" | "in_progress" | "done" | "cancelled";
  assigned_to: string | null;
  scheduled_date: string | null;
  time_slot: string | null;
  client_name: string;
  client_contact: string | null;
  vehicle_description: string | null;
  plate_number: string | null;
  address: string | null;
  maps_link: string | null;
  instructions: string | null;
  planned_items: PlannedItem[];
  home_service_booking_id: string | null;
  quote_id: string | null;
  bill_id: string | null;
  completed_at: string | null;
  created_at: string;
};

export const JOB_STATUS_LABEL: Record<TechJob["status"], string> = {
  unassigned: "Not assigned",
  assigned: "Assigned",
  accepted: "Accepted",
  on_the_way: "On the way",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const JOB_STATUS_STYLE: Record<TechJob["status"], string> = {
  unassigned: "bg-stone-100 text-stone-600 border-stone-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  on_the_way: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-orange-50 text-orange-700 border-orange-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-50 text-stone-500 border-stone-200",
};

export const ACTIVE_JOB_STATUSES: TechJob["status"][] = ["assigned", "accepted", "on_the_way", "in_progress"];

export const fmtJobDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) : "No date";

/** Ready-to-paste Messenger message telling a technician about their job. */
export function buildDispatchMessage(job: TechJob, techName: string): string {
  const first = techName.split(" ")[0];
  const items = job.planned_items.filter((i) => i.price >= 0).map((i) => `• ${i.qty > 1 ? `${i.qty} × ` : ""}${i.title}`);
  return [
    `Hi ${first}! 🔧 May bagong job ka: ${job.job_no ?? ""}`,
    `📅 ${fmtJobDate(job.scheduled_date)}${job.time_slot ? `, ${job.time_slot}` : ""}`,
    `👤 ${job.client_name}${job.client_contact ? ` · ${job.client_contact}` : ""}`,
    job.vehicle_description || job.plate_number ? `🚗 ${[job.vehicle_description, job.plate_number].filter(Boolean).join(" · ")}` : "",
    job.address ? `📍 ${job.address}` : "",
    job.maps_link ? job.maps_link : "",
    items.length ? `🛠 Gagawin:\n${items.join("\n")}` : "",
    job.instructions ? `📝 ${job.instructions}` : "",
    `Buksan sa app: https://staff.ctechautomotiveph.com/tech`,
  ].filter(Boolean).join("\n");
}
