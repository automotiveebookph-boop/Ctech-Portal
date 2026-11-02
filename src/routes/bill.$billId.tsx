import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabaseFleet } from "@/lib/supabase-fleet";
import { BillDocument, type BillHeader, type BillLine } from "@/components/BillDocument";

export const Route = createFileRoute("/bill/$billId")({
  head: () => ({ meta: [{ title: "Your Billing Statement — C-Tech Automotive" }] }),
  component: PublicBillPage,
});

type PublicBillResponse = { ok: boolean; bill?: BillHeader; lines?: BillLine[]; preparer_name?: string };

function PublicBillPage() {
  const { billId } = Route.useParams();
  const [state, setState] = useState<"loading" | "notfound" | "ok">("loading");
  const [res, setRes] = useState<PublicBillResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseFleet.rpc("get_public_bill", { p_bill_id: billId });
      if (cancelled) return;
      const r = data as PublicBillResponse | null;
      if (error || !r?.ok || !r.bill) { setState("notfound"); return; }
      setRes(r);
      setState("ok");
    })();
    return () => { cancelled = true; };
  }, [billId]);

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-400">Loading your billing statement…</div>;
  }

  if (state === "notfound" || !res?.bill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <div className="mb-2 text-3xl">🤔</div>
          <h1 className="mb-1 text-lg font-bold" style={{ color: "#0F1E3A" }}>Billing statement not found</h1>
          <p className="text-sm text-stone-500">This link may be incorrect. Please contact C-Tech Automotive at 0998-1516-245 for help.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-3 py-6 sm:px-4 sm:py-8">
      <BillDocument bill={res.bill} lines={res.lines ?? []} preparerName={res.preparer_name ?? "—"} />
      <div className="mx-auto mt-4 max-w-3xl rounded-lg bg-white p-4 text-center text-sm text-stone-600">
        Questions about this bill? Message us on{" "}
        <a href="https://m.me/cteachautomotive" target="_blank" rel="noopener" className="font-semibold" style={{ color: "#0F1E3A" }}>
          Messenger
        </a>
        {" "}or call <strong>0998-1516-245</strong>.
      </div>
    </div>
  );
}
