import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  fetchAvailableDates,
  fetchAvailableForDate,
  type Schedule,
  ymd,
} from "@/lib/schedules";

const NAVY = "#0F1E3A";
const GOLD = "#C9A227";

export type ScheduleSelection = {
  schedule_id: string;
  date: string;
  time_block: string;
};

export function ScheduleBookingPicker({
  value,
  onChange,
}: {
  value: ScheduleSelection | null;
  onChange: (v: ScheduleSelection | null) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);
  const [blocks, setBlocks] = useState<Schedule[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDates(true);
      try {
        const set = await fetchAvailableDates(ymd(today));
        if (!cancelled) setAvailableDates(set);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [today]);

  useEffect(() => {
    if (!value?.date) {
      setBlocks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingBlocks(true);
      try {
        const list = await fetchAvailableForDate(value.date);
        if (!cancelled) setBlocks(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingBlocks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value?.date]);

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const rows: Date[][] = [];
    const d = new Date(start);
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let i = 0; i < 7; i++) {
        row.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-600">
          Select Date *
        </label>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: `linear-gradient(135deg, ${NAVY}, #1E3464)` }}
          >
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-bold text-white">{monthLabel}</div>
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 bg-stone-50 text-[10px] font-bold uppercase text-stone-500">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="py-1 text-center">
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
              const available = availableDates.has(dateStr);
              const selected = value?.date === dateStr;
              const selectable = inMonth && !isPast && !isSunday && available;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!selectable}
                  title={isSunday && inMonth ? "Closed on Sundays" : undefined}
                  onClick={() =>
                    onChange({ schedule_id: "", date: dateStr, time_block: "" })
                  }
                  className={`relative aspect-square text-sm transition ${
                    !inMonth
                      ? "text-stone-300"
                      : isSunday
                        ? "text-stone-300 line-through"
                        : !selectable
                          ? "text-stone-300"
                          : selected
                            ? "font-bold text-white"
                            : "text-stone-700 hover:bg-stone-100"
                  }`}
                  style={selected ? { backgroundColor: NAVY } : undefined}
                >
                  {day.getDate()}
                  {selectable && !selected && (
                    <span
                      className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ backgroundColor: GOLD }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {loadingDates && (
          <p className="mt-2 text-xs text-stone-400">Loading availability…</p>
        )}
        {!loadingDates && availableDates.size === 0 && (
          <p className="mt-2 text-xs text-stone-500">
            No available dates yet. Please check back soon.
          </p>
        )}
      </div>

      {value?.date && (
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-600">
            Select Time Block *
          </label>
          {loadingBlocks ? (
            <p className="text-xs text-stone-400">Loading time blocks…</p>
          ) : blocks.length === 0 ? (
            <p className="text-xs text-stone-500">
              No open time blocks for this date.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {blocks.map((b) => {
                const remaining = b.capacity - b.booked_count;
                const selected = value.schedule_id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        schedule_id: b.id,
                        date: b.date,
                        time_block: b.time_block,
                      })
                    }
                    className={`rounded-xl border-2 px-3 py-3 text-left transition ${
                      selected
                        ? "border-[#0F1E3A] bg-[#0F1E3A]/5"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <div
                      className="text-sm font-bold"
                      style={{ color: NAVY }}
                    >
                      {b.time_block}
                    </div>
                    <div
                      className="mt-1 text-[11px] font-semibold"
                      style={{ color: remaining === 1 ? "#b45309" : "#047857" }}
                    >
                      {remaining} slot{remaining === 1 ? "" : "s"} left
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
