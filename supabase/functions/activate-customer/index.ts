import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

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

function inviteEmailHtml(fullName: string, actionLink: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#0F1E3A;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="background:#C9A227;border-radius:8px;width:36px;height:36px;display:inline-block;line-height:36px;text-align:center;font-size:18px;">🔧</div>
                <div style="text-align:left;display:inline-block;vertical-align:middle;margin-left:10px;">
                  <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.05em;">C-TECH</div>
                  <div style="color:#C9A227;font-size:10px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;">Automotive</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1E3A;">You're invited!</h1>
              <p style="margin:0 0 24px;color:#78716c;font-size:15px;line-height:1.6;">
                Hi <strong style="color:#0F1E3A;">${fullName}</strong>, your C-Tech Fleet Portal account is ready.
                Click below to set your password and activate your account.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:#C9A227;">
                    <a href="${actionLink}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#0F1E3A;text-decoration:none;">Activate My Account</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#a8a29e;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${actionLink}" style="color:#0F1E3A;word-break:break-all;">${actionLink}</a>
              </p>

              <p style="margin:0;font-size:14px;color:#78716c;">
                Questions? Call or text us directly:
              </p>
              <p style="margin:8px 0 0;font-size:15px;font-weight:600;color:#0F1E3A;">
                📞 0998-151-6245 / 0995-230-0296
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">
                © ${new Date().getFullYear()} C-Tech Automotive · Pulilan, Bulacan
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    // 3. Generate the invite link ourselves instead of relying on
    // inviteUserByEmail, which always sends via Supabase's built-in mailer
    // (noreply@mail.app.supabase.io). That mailer has strict rate limits and
    // poor deliverability, so invite emails were silently failing to reach
    // customers. We deliver the link via Resend instead, same as the
    // request-confirmation email.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: "https://admin.ctechautomotiveph.com/reset-password",
        data: { full_name, customer_id: customer.id },
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      await supabase.from("customers").delete().eq("id", customer.id);
      return json({ error: "Failed to generate invite link: " + (linkError?.message ?? "unknown error") }, 500);
    }

    const userId = linkData.user.id;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "C-Tech Automotive <noreply@ctechautomotiveph.com>",
        to: [email],
        subject: "You're invited — activate your C-Tech Fleet Portal account",
        html: inviteEmailHtml(full_name, linkData.properties.action_link),
      }),
    });

    if (!emailRes.ok) {
      const emailError = await emailRes.text();
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("customers").delete().eq("id", customer.id);
      return json({ error: "Failed to send invite email: " + emailError }, 500);
    }

    // 4. Create user_roles entry
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
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
