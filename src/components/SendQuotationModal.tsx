import { useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, MessageCircle, X } from "lucide-react";
import {
  buildQuotationMessage,
  type CustomerTitle,
  MESSENGER_URL,
  META_BUSINESS_SUITE_URL,
} from "@/lib/quotation-message";

type Props = {
  clientName: string | null;
  quotationLink: string;
  onClose: () => void;
  onSent?: () => void;
};

const TITLE_OPTIONS: { value: CustomerTitle; label: string }[] = [
  { value: "", label: "No title" },
  { value: "Sir", label: "Sir" },
  { value: "Ma'am", label: "Ma'am" },
];

export function SendQuotationModal({ clientName, quotationLink, onClose, onSent }: Props) {
  const [title, setTitle] = useState<CustomerTitle>("");
  const [message, setMessage] = useState(() => buildQuotationMessage({ clientName, title: "", quotationLink }));
  const [edited, setEdited] = useState(false);

  function pickTitle(t: CustomerTitle) {
    setTitle(t);
    if (!edited) setMessage(buildQuotationMessage({ clientName, title: t, quotationLink }));
  }

  function copyMessage(): Promise<void> {
    return navigator.clipboard.writeText(message).catch(() => {
      throw new Error("copy-failed");
    });
  }

  function copy() {
    copyMessage().then(
      () => toast.success("Message copied! 😊"),
      () => toast.error("Couldn't copy — please select and copy the text manually."),
    );
  }

  function sendVia(kind: "messenger" | "meta") {
    copyMessage().then(
      () => {
        if (kind === "messenger") {
          toast.success("Message copied! 😊 Open the customer's Messenger conversation and paste the prepared quotation message.");
          window.open(MESSENGER_URL, "_blank", "noopener");
        } else {
          toast.success("Quotation message ready! We've copied the personalized message for you. Open the customer's conversation in Meta Business Suite and paste it to send.");
          window.open(META_BUSINESS_SUITE_URL, "_blank", "noopener");
        }
        onSent?.();
        onClose();
      },
      () => toast.error("Couldn't copy — please select and copy the text manually."),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#0F1E3A" }}>Send Quotation</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 text-xs font-semibold uppercase text-stone-600">Customer prefers to be called</div>
          <div className="flex gap-2">
            {TITLE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => pickTitle(opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  title === opt.value ? "border-transparent text-white" : "border-stone-300 text-stone-600 hover:bg-stone-50"
                }`}
                style={title === opt.value ? { backgroundColor: "#0F1E3A" } : undefined}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-stone-400">Only pick this if the customer has actually said they prefer it — otherwise leave it as "No title."</p>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase text-stone-600">Message Preview</label>
            <span className="text-right text-[11px] text-stone-400">Edit freely — this is exactly what gets copied</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
            rows={9}
            className="w-full rounded-lg border border-stone-300 p-3 text-sm leading-relaxed focus:border-[#0F1E3A] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => sendVia("messenger")}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "#0084FF" }}
          >
            <MessageCircle className="h-4 w-4" /> Send via Messenger
          </button>
          <button
            type="button"
            onClick={() => sendVia("meta")}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            <Building2 className="h-4 w-4" /> Send via Meta Business Suite
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            <Copy className="h-4 w-4" /> Copy Message
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-stone-400">
          This copies the message and opens the app — you still choose the conversation and hit send yourself.
        </p>
      </div>
    </div>
  );
}
