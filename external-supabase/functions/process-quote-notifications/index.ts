// supabase/functions/process-quote-notifications/index.ts
// Drains notification_queue rows of type 'quote_created' and emails admin + client via Resend.
// Triggered by HTTP (manual or pg_cron). Requires AUTOMATION_CRON_SECRET header `x-cron-secret`.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
const ADMIN_EMAIL = Deno.env.get("CTECH_ADMIN_EMAIL")!;
const CRON_SECRET = Deno.env.get("AUTOMATION_CRON_SECRET")!;
const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}

function renderQuoteHtml(quote: any, client: any, vehicle: any, items: any[]) {
  const rows = items
    .map(
      (i) =>
        `<tr><td>${i.description}</td><td align="right">${i.qty}</td><td align="right">₱${Number(i.unit_price).toLocaleString()}</td><td align="right">₱${Number(i.line_total).toLocaleString()}</td></tr>`,
    )
    .join("");
  const vehicleLine = vehicle
    ? `<p><b>Vehicle:</b> ${vehicle.unit_id} — ${vehicle.plate_number} (${vehicle.make} ${vehicle.model})</p>`
    : "";
  const link = SITE_URL ? `<p><a href="${SITE_URL}">Open CTech Fleet Portal</a></p>` : "";
  const footer = `
    <hr style="margin-top:24px;border:none;border-top:1px solid #ddd" />
    <p style="font-size:12px;color:#555;line-height:1.6">
      <b>C-Tech Automotive</b> — Next-Level Automotive Excellence<br/>
      📞 0998-151-6245 / 0995-230-0296<br/>
      📧 ctechautomotive.ph@gmail.com<br/>
      📍 9016 DRT Highway Sto. Cristo, Pulilan, Bulacan<br/>
      🕐 Mon-Sat 8:00 AM - 5:00 PM
    </p>
  `;
  return `
    <h2>Quotation ${quote.quote_number}</h2>
    <p><b>Client:</b> ${client?.client_name ?? "—"}</p>
    ${vehicleLine}
    <p><b>Valid until:</b> ${quote.valid_until ?? "—"}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3" align="right"><b>Total</b></td><td align="right"><b>₱${Number(quote.total_amount).toLocaleString()}</b></td></tr></tfoot>
    </table>
    ${quote.notes ? `<p><b>Notes:</b> ${quote.notes}</p>` : ""}
    ${link}
    ${footer}
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { data: jobs, error } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .eq("type", "quote_created")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const job of jobs ?? []) {
    try {
      const quoteId = job.payload.quote_id;
      const { data: quote } = await supabase
        .from("quotations").select("*").eq("id", quoteId).single();
      if (!quote) throw new Error("Quote not found");

      const [{ data: client }, { data: vehicle }, { data: items }] = await Promise.all([
        supabase.from("fleet_clients").select("*").eq("id", quote.client_id).single(),
        quote.vehicle_id
          ? supabase.from("vehicles").select("*").eq("id", quote.vehicle_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("quote_line_items").select("*").eq("quote_id", quoteId),
      ]);

      const html = renderQuoteHtml(quote, client, vehicle, items ?? []);
      const subject = `New Quotation ${quote.quote_number} — ${client?.client_name ?? ""}`;

      // Always email admin
      await sendEmail(ADMIN_EMAIL, subject, html);
      // Also email client if address is on file
      if (client?.email) await sendEmail(client.email, subject, html);

      await supabase.from("notification_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      }).eq("id", job.id);

      results.push({ id: job.id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const attempts = job.attempts + 1;
      await supabase.from("notification_queue").update({
        status: attempts >= 5 ? "failed" : "pending",
        attempts,
        last_error: msg,
      }).eq("id", job.id);
      results.push({ id: job.id, ok: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
