import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import {
  TIME_BLOCKS,
  type Schedule,
  type TimeBlock,
  fetchSchedulesForMonth,
  ymd,
} from "@/lib/schedules";

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";

export function SchedulesCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchSchedulesForMonth(
        cursor.getFullYear(),
        cursor.getMonth(),
      );
      setSchedules(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const byDate = useMemo(() => {
    const m = new Map<string, Schedule[]>();
    schedules.forEach((s) => {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    });
    return m;
  }, [schedules]);

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <main className="p-4 md:p-8">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: `linear-gradient(135deg, ${NAVY}, #1E3464)` }}
          >
            <button
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: GOLD }}
              >
                Calendar
              </div>
              <div className="text-xl font-bold text-white">{monthLabel}</div>
            </div>
            <button
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((day, i) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const dateStr = ymd(day);
              const isPast = day < today;
              const isSunday = day.getDay() === 0;
              const list = byDate.get(dateStr) ?? [];
              const totalActive = list.filter((s) => s.is_active).length;
              const totalBooked = list.reduce(
                (sum, s) => (s.is_active ? sum + s.booked_count : sum),
                0,
              );
              const totalCap = list.reduce(
                (sum, s) => (s.is_active ? sum + s.capacity : sum),
                0,
              );
              const allFull = totalActive > 0 && totalBooked >= totalCap;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!inMonth || isPast || isSunday}
                  onClick={() => setSelectedDate(dateStr)}
                  title={isSunday && inMonth ? "Closed on Sundays" : undefined}
                  className={`relative min-h-[88px] border-b border-r border-stone-100 p-2 text-left transition ${
                    !inMonth
                      ? "bg-stone-50 text-stone-300"
                      : isPast
                        ? "bg-stone-50 text-stone-400"
                        : isSunday
                          ? "bg-stone-50 text-stone-400"
                          : "bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        ymd(today) === dateStr ? "" : ""
                      }`}
                      style={
                        ymd(today) === dateStr
                          ? { color: GOLD }
                          : inMonth && !isPast && !isSunday
                            ? { color: NAVY }
                            : undefined
                      }
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  {inMonth && isSunday && (
                    <div className="mt-2 inline-flex rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600">
                      Closed
                    </div>
                  )}
                  {inMonth && !isPast && !isSunday && totalActive > 0 && (
                    <div className="mt-2 space-y-1">
                      <div
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          allFull
                            ? "bg-red-100 text-red-700"
                            : totalBooked > 0
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {totalBooked}/{totalCap} booked
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {totalActive} block{totalActive === 1 ? "" : "s"} open
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-600">
          <Legend color="#10b981" label="Available" />
          <Legend color={GOLD} label="Has bookings" />
          <Legend color="#ef4444" label="Full" />
        </div>
      </main>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded"
        style={{ backgroundColor: color }}
      />
      {label}
    </div>
  );
}

function DayModal({
  date,
  onClose,
  onChanged,
}: {
  date: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabaseFleet
      .from("schedules")
      .select("*")
      .eq("date", date);
    if (error) {
      toast.error("Failed to load day");
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Schedule[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function toggleBlock(block: TimeBlock) {
    const existing = rows.find((r) => r.time_block === block);
    setSaving(block);
    try {
      if (!existing) {
        const { data: { user } } = await supabaseFleet.auth.getUser();
        const { error } = await supabaseFleet.from("schedules").insert({
          date,
          time_block: block,
          capacity: 2,
          booked_count: 0,
          is_active: true,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabaseFleet
          .from("schedules")
          .update({ is_active: !existing.is_active })
          .eq("id", existing.id);
        if (error) throw error;
      }
      await load();
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("Could not update slot");
    } finally {
      setSaving(null);
    }
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between rounded-t-2xl px-6 py-4"
          style={{ background: `linear-gradient(135deg, ${NAVY}, #1E3464)` }}
        >
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: GOLD }}
            >
              Manage Slots
            </div>
            <div className="text-lg font-bold text-white">{dateLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-6">
          {loading ? (
            <div className="py-8 text-center text-sm text-stone-500">Loading…</div>
          ) : (
            TIME_BLOCKS.map((block) => {
              const row = rows.find((r) => r.time_block === block);
              const active = row?.is_active ?? false;
              const booked = row?.booked_count ?? 0;
              const capacity = row?.capacity ?? 2;
              const full = active && booked >= capacity;
              const hasBookings = booked > 0;

              const statusColor = !active
                ? "bg-stone-100 text-stone-500"
                : full
                  ? "bg-red-50 text-red-700 border-red-200"
                  : hasBookings
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";

              return (
                <div
                  key={block}
                  className={`flex items-center justify-between rounded-xl border p-4 ${statusColor}`}
                >
                  <div>
                    <div className="text-sm font-bold" style={{ color: NAVY }}>
                      {block}
                    </div>
                    <div className="mt-1 text-xs">
                      {active ? (
                        <span className="font-semibold">
                          {capacity - booked}/{capacity} available
                          {full ? " · FULL" : hasBookings ? " · partly booked" : ""}
                        </span>
                      ) : (
                        <span>Closed</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleBlock(block)}
                    disabled={saving === block || (row != null && booked > 0 && active)}
                    title={
                      row && booked > 0 && active
                        ? "Cannot close — has bookings"
                        : ""
                    }
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                      active ? "" : "bg-stone-300"
                    } disabled:opacity-50`}
                    style={active ? { backgroundColor: GOLD } : undefined}
                    aria-label="Toggle slot"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-stone-100 px-6 py-3 text-[11px] text-stone-500">
          Each time block has a capacity of 2. Closed slots are hidden from
          customers.
        </div>
      </div>
    </div>
  );
}

function buildMonthGrid(cursor: Date): Date[][] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back to Sunday
  const weeks: Date[][] = [];
  const d = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}
