import { createFileRoute } from "@tanstack/react-router";
import { SchedulesCalendar } from "@/components/SchedulesCalendar";

export const Route = createFileRoute("/admin/walkin/schedules")({
  component: WalkinSchedulesPage,
});

function WalkinSchedulesPage() {
  return (
    <>
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4 pl-16 md:px-8 md:py-6 md:pl-8">
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-wider md:text-xs"
            style={{ color: "#C9A227" }}
          >
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Schedule Management
          </h1>
        </div>
      </header>

      <SchedulesCalendar />
    </>
  );
}
