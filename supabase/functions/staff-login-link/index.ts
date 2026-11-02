import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Owner-only: creates (or re-issues) a one-time "set your password" link for a
// staff member and gives them the 'technician' role, so they can sign in to
// the Home Service phone screen. The owner sends the link via Messenger/SMS —
// no email delivery needed.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT = "https://admin.ctechautomotiveph.com/reset-password";
const APP_ORIGIN = "https://staff.ctechautomotiveph.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: adminRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return json({ error: "Only the owner/admin can create staff logins." }, 403);

    const { staff_id } = await req.json();
    if (!staff_id) return json({ error: "Missing staff_id" }, 400);
    const { data: staff } = await supabase.from("staff").select("id, full_name, email, shop_role, active").eq("id", staff_id).maybeSingle();
    if (!staff) return json({ error: "Staff member not found" }, 404);
    if (!staff.active) return json({ error: "This staff member is inactive." }, 400);
    const email = (staff.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "Add a valid email for this staff member first." }, 400);

    // New person → invite link. Already has an account → password-reset link.
    let kind: "invite" | "recovery" = "invite";
    let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite", email, options: { redirectTo: REDIRECT, data: { full_name: staff.full_name } },
    });
    if (linkError && /already|registered|exists/i.test(linkError.message)) {
      kind = "recovery";
      ({ data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: REDIRECT } }));
    }
    if (linkError || !linkData?.properties?.hashed_token || !linkData.user) {
      return json({ error: "Couldn't create the link: " + (linkError?.message ?? "unknown error") }, 500);
    }
    const userId = linkData.user.id;

    // Never downgrade an existing admin; everyone else becomes a technician.
    const { data: existing } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "technician" });
      if (error) return json({ error: "Login created but role failed: " + error.message }, 500);
    } else if (existing.role !== "admin" && existing.role !== "technician") {
      const { error } = await supabase.from("user_roles").update({ role: "technician", customer_id: null, client_id: null }).eq("user_id", userId);
      if (error) return json({ error: "Couldn't set technician role: " + error.message }, 500);
    }
    await supabase.from("staff").update({ auth_user_id: userId }).eq("id", staff.id);

    // Send our own /activate page, not Supabase's one-time verify URL: chat apps
    // preload links, which would use the one-time code before the tech taps it.
    const link = `${APP_ORIGIN}/activate?th=${encodeURIComponent(linkData.properties.hashed_token)}&type=${kind}`;
    return json({ link, kind, role: existing?.role ?? "technician" });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
