import { peso } from "@/lib/fleet-utils";

// Discounts and "less" adjustments (part of a service not done) are stored as
// ordinary quote line items with a negative unit_price, so the DB totals trigger
// and job-order conversion net them out with no special handling.
type MoneyLine = { category: string; qty: number; unit_price: number };

export const isDeduction = (l: MoneyLine) => l.qty * l.unit_price < 0;

export function quoteTotals(lines: MoneyLine[]) {
  return lines.reduce(
    (acc, l) => {
      const amt = l.qty * l.unit_price;
      if (amt < 0) acc.deductions += -amt;
      else if (l.category === "service") acc.services += amt;
      else acc.parts += amt;
      acc.total += amt;
      return acc;
    },
    { services: 0, parts: 0, deductions: 0, total: 0 },
  );
}

// Shows a deduction as "−₱500" rather than "₱-500".
export const pesoSigned = (n: number) => (n < 0 ? `−${peso(-n)}` : peso(n));
