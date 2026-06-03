// supabase/functions/send-pms-reminder-sms/index.ts
// Scans vehicles whose service is DUE SOON / DUE NOW / OVERDUE and sends an SMS via Semaphore
// to the associated client's contact_number. Supports dry-run mode and de-dupes per vehicle/day.
//
// Trigger: HTTP POST. Requires header `x-cron-secret: <AUTOMATION_CRON_SECRET>`.
// Query params:
//   ?dry_run=true   → log only, do not call Semaphore
//   ?limit=50       → cap vehicles processed (default 100)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEMAPHORE_API_KEY = Deno.env.get("SEMAPHORE_API_KEY")!;
const SEMAPHORE_SENDERNAME = Deno.env.get("SEMAPHORE_SENDERNAME") ?? "CTECH";
const CRON_SECRET = Deno.env.get("AUTOMATION_CRON_SECRET")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// Threshold for "due soon" — we send SMS when km_to_next_service <= 500 or already past due
const DUE_SOON_KM = 500;

function buildMessage(v: any, client: any) {
  const due = v.km_to_next_service ?? 0;
  const state =
    due < 0 ? `OVERDUE by ${Math.abs(due).toLocaleString()} km`
    : due === 0 ? "DUE NOW"
    : `due in ${due.toLocaleString()} km`;
  return `CTech PMS reminder: ${v.unit_id} (${v.plate_number}) ${v.make} ${v.model} is ${state}. Please schedule service. — CTech`;
}

async function sendSemaphore(phone: string, message: string) {
  const body = new URLSearchParams({
    apikey: SEMAPHORE_API_KEY,
    number: phone,
    message,
    sendername: SEMAPHORE_SENDERNAME,
  });
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Semaphore ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  // Pull candidate vehicles. We compute due state in JS to avoid relying on a view.
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, unit_id, plate_number, make, model, client_id, current_km, next_service_km")
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const results: any[] = [];

  for (const v of vehicles ?? []) {
    const km_to_next = (v.next_service_km ?? 0) - (v.current_km ?? 0);
    if (km_to_next > DUE_SOON_KM) continue; // not due yet

    // Skip if we already sent one today for this vehicle
    const { count: alreadySent } = await supabase
      .from("pms_sms_log")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", v.id)
      .gte("created_at", `${today}T00:00:00Z`)
      .in("status", ["sent", "dry_run"]);
    if ((alreadySent ?? 0) > 0) continue;

    const { data: client } = await supabase
      .from("fleet_clients").select("*").eq("id", v.client_id).single();
    const phone = client?.contact_number ?? client?.phone;
    if (!phone) {
      results.push({ vehicle: v.unit_id, skipped: "no phone" });
      continue;
    }

    const message = buildMessage({ ...v, km_to_next_service: km_to_next }, client);

    if (dryRun) {
      await supabase.from("pms_sms_log").insert({
        vehicle_id: v.id, client_id: v.client_id, phone, message,
        status: "dry_run", dry_run: true,
      });
      results.push({ vehicle: v.unit_id, dry_run: true, phone, message });
      continue;
    }

    try {
      const resp = await sendSemaphore(phone, message);
      const msgId = Array.isArray(resp) ? resp[0]?.message_id : resp?.message_id;
      await supabase.from("pms_sms_log").insert({
        vehicle_id: v.id, client_id: v.client_id, phone, message,
        status: "sent", semaphore_message_id: msgId ? String(msgId) : null,
      });
      results.push({ vehicle: v.unit_id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("pms_sms_log").insert({
        vehicle_id: v.id, client_id: v.client_id, phone, message,
        status: "failed", error: msg,
      });
      results.push({ vehicle: v.unit_id, ok: false, error: msg });
    }
  }

  return new Response(
    JSON.stringify({ scanned: vehicles?.length ?? 0, processed: results.length, dry_run: dryRun, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
