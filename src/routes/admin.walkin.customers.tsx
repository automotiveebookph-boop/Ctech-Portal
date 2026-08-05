import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { formatDate } from "@/lib/my-car-session";
import { CUSTOMER_TYPE_LABEL, STATUS_STYLES, type Customer } from "@/lib/fleet-utils";
import { formatPHPhone } from "@/lib/phone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JobOrderModal } from "@/components/JobOrderModal";
import { BookAppointmentModal } from "@/components/BookAppointmentModal";
import { VehicleQuickModal } from "@/components/VehicleQuickModal";
import { CustomerModal } from "@/components/CustomerModal";

export const Route = createFileRoute("/admin/walkin/customers")({
  component: CustomersPage,
});

type VehicleLite = {
  id: string;
  customer_id: string | null;
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  current_km: number;
  service_status: "OK" | "DUE SOON" | "DUE NOW" | "OVERDUE";
  km_to_next_service: number;
};

const URGENCY: Record<VehicleLite["service_status"], number> = {
  OVERDUE: 0,
  "DUE NOW": 1,
  "DUE SOON": 2,
  OK: 3,
};

type ActionState =
  | { kind: "none" }
  | { kind: "editCustomer"; customer: Customer | null }
  | { kind: "addVehicle"; customer: Customer }
  | { kind: "jobOrder"; customer: Customer }
  | { kind: "appointment"; customer: Customer }
  | { kind: "archive"; customer: Customer };

function CustomersPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin/walkin/customers") {
    return <Outlet />;
  }
  return <CustomersListPage />;
}

function CustomersListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLite[]>([]);
  const [lastVisits, setLastVisits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActionState>({ kind: "none" });

  async function load() {
    setLoading(true);
    const [cu, veRes] = await Promise.all([
      supabaseFleet.from("customers").select("*").neq("status", "archived").order("created_at", { ascending: false }),
      supabaseFleet
        .from("vehicle_status_view")
        .select("id, customer_id, plate_number, make, model, year, current_km, service_status, km_to_next_service")
        .not("customer_id", "is", null)
        .neq("status", "archived"),
    ]);
    const cList = (cu.data ?? []) as Customer[];
    const vList = (veRes.data ?? []) as unknown as VehicleLite[];
    setCustomers(cList);
    setVehicles(vList);

    const vIds = vList.map((v) => v.id);
    if (vIds.length) {
      const { data } = await supabaseFleet
        .from("service_history")
        .select("vehicle_id, service_date")
        .in("vehicle_id", vIds)
        .order("service_date", { ascending: false });
      const vToC = new Map(vList.map((v) => [v.id, v.customer_id]));
      const lv: Record<string, string> = {};
      for (const r of (data ?? []) as { vehicle_id: string; service_date: string }[]) {
        const cId = vToC.get(r.vehicle_id);
        if (cId && !lv[cId]) lv[cId] = r.service_date;
      }
      setLastVisits(lv);
    } else {
      setLastVisits({});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const vehiclesByCustomer = useMemo(() => {
    const m = new Map<string, VehicleLite[]>();
    for (const v of vehicles) {
      if (!v.customer_id) continue;
      const list = m.get(v.customer_id) ?? [];
      list.push(v);
      m.set(v.customer_id, list);
    }
    return m;
  }, [vehicles]);

  function nextServiceFor(customerId: string) {
    const list = vehiclesByCustomer.get(customerId) ?? [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => URGENCY[a.service_status] - URGENCY[b.service_status])[0];
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) => {
      const vList = vehiclesByCustomer.get(c.id) ?? [];
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        vList.some((v) =>
          v.plate_number.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q)
        )
      );
    });
  }, [customers, search, vehiclesByCustomer]);

  async function doArchive() {
    if (action.kind !== "archive") return;
    const { error } = await supabaseFleet.from("customers").update({ status: "archived" }).eq("id", action.customer.id);
    if (error) toast.error(error.message);
    else toast.success("Customer archived");
    setAction({ kind: "none" });
    load();
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-4 pl-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-6 md:pl-8">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider md:text-xs" style={{ color: "#C9A227" }}>
            C-Tech Client Dashboard
          </div>
          <h1 className="text-lg font-bold md:text-2xl" style={{ color: "#0F1E3A" }}>
            Walk-in Customers
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {customers.length} customers registered
          </p>
        </div>
        <button
          onClick={() => setAction({ kind: "editCustomer", customer: null })}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "#C9A227", color: "#0F1E3A" }}
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="mb-6 max-w-md relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, email, plate, model…"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Customer</th>
                  <th className="px-4 py-3 text-left font-bold">Contact</th>
                  <th className="px-4 py-3 text-left font-bold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-bold">Last Visit</th>
                  <th className="px-4 py-3 text-left font-bold">Next Service</th>
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">No customers found.</td></tr>
                ) : (
                  filtered.map((c) => {
                    const vList = vehiclesByCustomer.get(c.id) ?? [];
                    const next = nextServiceFor(c.id);
                    return (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold" style={{ color: "#0F1E3A" }}>{c.full_name}</div>
                          <div className="text-[10px] uppercase tracking-wide text-stone-400">
                            {CUSTOMER_TYPE_LABEL[c.customer_type] ?? "Private"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-stone-700">{c.phone ? formatPHPhone(c.phone) : "—"}</div>
                          {c.email && <div className="text-xs text-stone-500">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {vList.length === 0 ? (
                            <span className="text-stone-400">—</span>
                          ) : vList.length === 1 ? (
                            <>
                              <div className="font-semibold">{vList[0].plate_number}</div>
                              <div className="text-xs text-stone-500">
                                {vList[0].make} {vList[0].model}{vList[0].year ? ` · ${vList[0].year}` : ""}
                              </div>
                            </>
                          ) : (
                            <span className="font-semibold" style={{ color: "#0F1E3A" }}>{vList.length} Vehicles</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {lastVisits[c.id] ? formatDate(lastVisits[c.id]) : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {!next ? (
                            <span className="text-stone-400">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[next.service_status].bg} ${STATUS_STYLES[next.service_status].text} ${STATUS_STYLES[next.service_status].border}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[next.service_status].dot}`} />
                              {next.service_status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to="/admin/walkin/customers/$customerId"
                              params={{ customerId: c.id }}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold"
                              style={{ backgroundColor: "#0F1E3A", color: "white" }}
                            >
                              View
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-100" aria-label="More actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setAction({ kind: "jobOrder", customer: c })}>Create Job Order</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAction({ kind: "appointment", customer: c })}>Book Appointment</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAction({ kind: "addVehicle", customer: c })}>Add Vehicle</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAction({ kind: "editCustomer", customer: c })}>Edit Customer</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setAction({ kind: "archive", customer: c })} className="text-red-600 focus:text-red-600">
                                  Archive Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {action.kind === "editCustomer" && (
        <CustomerModal
          initial={action.customer}
          onClose={() => setAction({ kind: "none" })}
          onSaved={() => { setAction({ kind: "none" }); load(); }}
        />
      )}

      {action.kind === "addVehicle" && (
        <VehicleQuickModal
          customerId={action.customer.id}
          customerName={action.customer.full_name}
          onClose={() => setAction({ kind: "none" })}
          onSaved={() => { setAction({ kind: "none" }); load(); }}
        />
      )}

      {action.kind === "jobOrder" && (
        <JobOrderModal
          vehicles={(vehiclesByCustomer.get(action.customer.id) ?? []).map((v) => ({
            id: v.id, plate_number: v.plate_number, make: v.make, model: v.model, current_km: v.current_km,
          }))}
          onClose={() => setAction({ kind: "none" })}
          onSaved={() => { setAction({ kind: "none" }); load(); }}
        />
      )}

      {action.kind === "appointment" && (
        <BookAppointmentModal
          customerId={action.customer.id}
          vehicles={(vehiclesByCustomer.get(action.customer.id) ?? []).map((v) => ({
            id: v.id, plate_number: v.plate_number, make: v.make, model: v.model,
          }))}
          onClose={() => setAction({ kind: "none" })}
          onSaved={() => { setAction({ kind: "none" }); load(); }}
        />
      )}

      {action.kind === "archive" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold mb-2" style={{ color: "#0F1E3A" }}>Archive Customer?</h2>
            <p className="text-sm text-stone-600 mb-4">
              <strong>{action.customer.full_name}</strong> and their records will be hidden from the active list.
              Service history and vehicles are kept and can be restored later. This does not delete anything.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAction({ kind: "none" })} className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
              <button onClick={doArchive} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Archive</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
