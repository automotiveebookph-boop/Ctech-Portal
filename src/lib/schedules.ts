import { supabaseFleet } from "@/lib/supabase-fleet";

export const TIME_BLOCKS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
] as const;

export type TimeBlock = (typeof TIME_BLOCKS)[number];

export type Schedule = {
  id: string;
  date: string; // yyyy-mm-dd
  time_block: TimeBlock;
  capacity: number;
  booked_count: number;
  is_active: boolean;
  created_by: string | null;
};

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchSchedulesForMonth(year: number, month: number) {
  const start = ymd(new Date(year, month, 1));
  const end = ymd(new Date(year, month + 1, 0));
  const { data, error } = await supabaseFleet
    .from("schedules")
    .select("*")
    .gte("date", start)
    .lte("date", end);
  if (error) throw error;
  return (data ?? []) as Schedule[];
}

export async function fetchAvailableForDate(date: string) {
  const { data, error } = await supabaseFleet
    .from("available_schedules")
    .select("*")
    .eq("date", date);
  if (error) throw error;
  return (data ?? []) as Schedule[];
}

export async function fetchAvailableDates(fromDate: string) {
  const { data, error } = await supabaseFleet
    .from("available_schedules")
    .select("date")
    .gte("date", fromDate);
  if (error) throw error;
  const set = new Set<string>();
  (data ?? []).forEach((r: { date: string }) => set.add(r.date));
  return set;
}
