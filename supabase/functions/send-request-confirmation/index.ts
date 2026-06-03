import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Until a custom domain is verified in Resend, emails can only be sent to the
// Resend account owner's email. SHOP_EMAIL must match the Resend account email.
const SHOP_EMAIL = Deno.env.get("SHOP_EMAIL") ?? "automotiveebookph@gmail.com";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    const html = `
<!DOCTYPE html>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1E3A;">We received your request!</h1>
              <p style="margin:0 0 24px;color:#78716c;font-size:15px;line-height:1.6;">
                Hi <strong style="color:#0F1E3A;">${record.full_name}</strong>, thank you for reaching out to C-Tech Automotive.
                We've received your access request and our team will review it shortly.
              </p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#C9A227;margin-bottom:12px;">Your Submission</div>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#78716c;padding:4px 0;width:110px;">Name</td>
                      <td style="font-size:13px;color:#1c1917;font-weight:600;padding:4px 0;">${record.full_name}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#78716c;padding:4px 0;">Email</td>
                      <td style="font-size:13px;color:#1c1917;font-weight:600;padding:4px 0;">${record.email}</td>
                    </tr>
                    ${record.phone ? `<tr>
                      <td style="font-size:13px;color:#78716c;padding:4px 0;">Phone</td>
                      <td style="font-size:13px;color:#1c1917;font-weight:600;padding:4px 0;">${record.phone}</td>
                    </tr>` : ""}
                    ${record.vehicle_info ? `<tr>
                      <td style="font-size:13px;color:#78716c;padding:4px 0;">Vehicle</td>
                      <td style="font-size:13px;color:#1c1917;font-weight:600;padding:4px 0;">${record.vehicle_info}</td>
                    </tr>` : ""}
                  </table>
                </td></tr>
              </table>

              <!-- What happens next -->
              <div style="margin-bottom:24px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#C9A227;margin-bottom:12px;">What Happens Next</div>
                <table cellpadding="0" cellspacing="0">
                  ${["Our team reviews your request (usually within 24 hours).",
                     "We'll set up your account and send you a separate email with your login link.",
                     "Log in to view your vehicle's service history and book appointments."]
                    .map((step, i) => `
                  <tr>
                    <td style="padding:6px 0;vertical-align:top;">
                      <span style="display:inline-block;background:#C9A227;color:#0F1E3A;font-size:11px;font-weight:700;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;margin-right:10px;">${i + 1}</span>
                    </td>
                    <td style="padding:6px 0;font-size:14px;color:#57534e;line-height:1.5;">${step}</td>
                  </tr>`).join("")}
                </table>
              </div>

              <p style="margin:0 0 8px;font-size:14px;color:#78716c;">
                Questions? Call or text us directly:
              </p>
              <p style="margin:0 0 24px;font-size:15px;font-weight:600;color:#0F1E3A;">
                📞 0998-151-6245 / 0995-230-0296
              </p>

              <p style="margin:0;font-size:14px;color:#78716c;">
                Mon – Sat · 8:00 AM – 5:00 PM<br/>
                Sto. Cristo, Pulilan, Bulacan
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">
                © ${new Date().getFullYear()} C-Tech Automotive · Pulilan, Bulacan<br/>
                This email was sent because you submitted an access request on our portal.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "C-Tech Automotive <noreply@ctechportal.com>",
        to: [record.email],
        reply_to: SHOP_EMAIL,
        subject: "We received your request — C-Tech Automotive",
        html,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), { status: res.ok ? 200 : 500 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
