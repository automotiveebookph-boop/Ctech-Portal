// Landing-page bookings have no customer/vehicle record yet — the booking RPC
// packs the details into `notes` as:
//   "Landing reservation · Name: … · Contact: … · Email: … · Vehicle: …"
export type LandingContact = { name: string; contact: string; email: string; vehicle: string };

export function parseLandingNotes(notes: string | null | undefined): LandingContact | null {
  if (!notes || !notes.startsWith("Landing reservation")) return null;
  const field = (label: string) => notes.match(new RegExp(`${label}:\\s*([^·]+)`))?.[1]?.trim() ?? "";
  return { name: field("Name"), contact: field("Contact"), email: field("Email"), vehicle: field("Vehicle") };
}

/** "0917 123 4567" / "+63 917…" → "+639171234567" style digits for tel:/sms: links. */
export function phoneHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? digits : null;
}

/** A pending booking whose preferred date has already passed (Manila time). */
export function isMissedBooking(b: { status: string; preferred_date: string }): boolean {
  const todayManila = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return b.status === "pending" && b.preferred_date < todayManila;
}
