import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { contact_request_id, email, full_name, phone } = await req.json();

    if (!contact_request_id || !email || !full_name) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Check if customer already exists (fast direct lookup, no listUsers)
    const { data: existingRow } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingRow) {
      return json({ error: "A customer with this email already exists." }, 409);
    }

    // 2. Create customer record
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ full_name, email, phone: phone || null })
      .select("id")
      .single();

    if (customerError) {
      return json({ error: "Failed to create customer: " + customerError.message }, 500);
    }

    // 3. Invite user via email (sends set-password link)
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://ctechautomotiveph.com/login",
      data: { full_name, customer_id: customer.id },
    });

    if (inviteError) {
      await supabase.from("customers").delete().eq("id", customer.id);
      return json({ error: "Failed to send invite: " + inviteError.message }, 500);
    }

    // 4. Create user_roles entry
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: inviteData.user.id,
      role: "customer",
      customer_id: customer.id,
    });

    if (roleError) {
      return json({ error: "User invited but role assignment failed: " + roleError.message }, 500);
    }

    // 5. Mark contact_request as activated
    await supabase
      .from("contact_requests")
      .update({ status: "activated" })
      .eq("id", contact_request_id);

    return json({ success: true, customer_id: customer.id });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
