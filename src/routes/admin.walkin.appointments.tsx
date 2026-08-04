import { createFileRoute } from "@tanstack/react-router";
import { AdminAppointments } from "./admin.appointments";

export const Route = createFileRoute("/admin/walkin/appointments")({
  component: () => <AdminAppointments title="All Appointments" />,
});
