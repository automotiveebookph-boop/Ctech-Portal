import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const record = payload.record;

    const message = [
      "🔔 *New Access Request — C-Tech Portal*",
      "",
      `👤 *Name:* ${record.full_name}`,
      `📧 *Email:* ${record.email}`,
      record.phone ? `📱 *Phone:* ${record.phone}` : null,
      record.vehicle_info ? `🚗 *Vehicle:* ${record.vehicle_info}` : null,
      record.message ? `💬 *Message:* ${record.message}` : null,
      "",
      "👉 Review at: https://fleetconnectportal.lovable.app/admin/requests",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const result = await res.json();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
