import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { contact_request_id, email, full_name, phone } = await req.json();

    if (!contact_request_id || !email || !full_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Check if user already exists — direct SQL lookup (fast, avoids listUsers pagination)
    const { data: existingRow } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingRow) {
      return new Response(JSON.stringify({ error: "A customer with this email already exists." }), { status: 409 });
    }

    // 2. Create customer record
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({ full_name, email, phone: phone || null })
      .select("id")
      .single();

    if (customerError) {
      return new Response(JSON.stringify({ error: "Failed to create customer: " + customerError.message }), { status: 500 });
    }

    // 3. Invite user via email (sends set-password link)
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "https://ctechautomotiveph.com/login",
      data: { full_name, customer_id: customer.id },
    });

    if (inviteError) {
      // Rollback customer record
      await supabase.from("customers").delete().eq("id", customer.id);
      return new Response(JSON.stringify({ error: "Failed to send invite: " + inviteError.message }), { status: 500 });
    }

    // 4. Create user_roles entry
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: inviteData.user.id,
      role: "customer",
      customer_id: customer.id,
    });

    if (roleError) {
      return new Response(JSON.stringify({ error: "User invited but role assignment failed: " + roleError.message }), { status: 500 });
    }

    // 5. Mark contact_request as activated
    await supabase
      .from("contact_requests")
      .update({ status: "activated" })
      .eq("id", contact_request_id);

    return new Response(JSON.stringify({ success: true, customer_id: customer.id }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
