// Subdomain-scoped login/audience config.
//
// The single `ctech-portal` app is served on four subdomains, each a separate
// "door" with its own login page and allowed audience:
//
//   admin.ctechautomotiveph.com       → shop admin    (role: admin)         → /admin/walkin
//   fleetadmin.ctechautomotiveph.com  → fleet admin   (role: admin)         → /admin
//   portal.ctechautomotiveph.com      → retail client (role: customer)      → /my-car
//   fleet.ctechautomotiveph.com       → fleet client  (role: fleet_manager) → /dashboard
//
// Anything else (apex, www, localhost, Vercel preview URLs) resolves to "any",
// which keeps the original role-based routing so local dev is unchanged.

export type Audience =
  | "shop_admin"
  | "fleet_admin"
  | "customer"
  | "fleet_client"
  | "any";

export type Role = "admin" | "customer" | "fleet_manager";

type AudienceInfo = {
  /** The single user_roles.role permitted to use this door. */
  allowedRole: Role;
  /** Where a matching user lands after login. */
  landingPath: string;
  /** Short label shown on the login page. */
  label: string;
  /** Styling/branding variant. */
  kind: "admin" | "client";
};

/** Exact hostname → audience. */
export const HOST_AUDIENCE: Record<string, Exclude<Audience, "any">> = {
  "admin.ctechautomotiveph.com": "shop_admin",
  "fleetadmin.ctechautomotiveph.com": "fleet_admin",
  "portal.ctechautomotiveph.com": "customer",
  "fleet.ctechautomotiveph.com": "fleet_client",
};

export const AUDIENCE_INFO: Record<Exclude<Audience, "any">, AudienceInfo> = {
  shop_admin: {
    allowedRole: "admin",
    landingPath: "/admin/walkin",
    label: "Shop Admin",
    kind: "admin",
  },
  fleet_admin: {
    allowedRole: "admin",
    landingPath: "/admin",
    label: "Fleet Admin",
    kind: "admin",
  },
  customer: {
    allowedRole: "customer",
    landingPath: "/my-car",
    label: "Client Portal",
    kind: "client",
  },
  fleet_client: {
    allowedRole: "fleet_manager",
    landingPath: "/dashboard",
    label: "Fleet Client",
    kind: "client",
  },
};

/** The correct door (hostname) for a given role — used to build "wrong door" hints. */
export const ROLE_HOST: Record<Role, string> = {
  admin: "admin.ctechautomotiveph.com",
  customer: "portal.ctechautomotiveph.com",
  fleet_manager: "fleet.ctechautomotiveph.com",
};

const OVERRIDE_KEYS: Record<string, Exclude<Audience, "any">> = {
  shop_admin: "shop_admin",
  fleet_admin: "fleet_admin",
  customer: "customer",
  fleet_client: "fleet_client",
};

/**
 * Resolve the current audience from the hostname.
 *
 * On a real mapped host the mapping always wins (production-safe). Only when the
 * host is unmapped ("any" — localhost / preview) do we honor a `?as=<audience>`
 * query param (persisted to localStorage) so each door can be exercised without DNS.
 */
export function getAudience(): Audience {
  if (typeof window === "undefined") return "any";

  const host = window.location.hostname;
  const mapped = HOST_AUDIENCE[host];
  if (mapped) return mapped;

  // Unmapped host: allow a dev/test override.
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("as");
    if (q && OVERRIDE_KEYS[q]) {
      window.localStorage.setItem("ctech_audience", OVERRIDE_KEYS[q]);
      return OVERRIDE_KEYS[q];
    }
    const stored = window.localStorage.getItem("ctech_audience");
    if (stored && OVERRIDE_KEYS[stored]) return OVERRIDE_KEYS[stored];
  } catch {
    // localStorage/URL unavailable — fall through to "any".
  }

  return "any";
}

/** Info for the current audience, or null when "any". */
export function getAudienceInfo(): AudienceInfo | null {
  const a = getAudience();
  return a === "any" ? null : AUDIENCE_INFO[a];
}
