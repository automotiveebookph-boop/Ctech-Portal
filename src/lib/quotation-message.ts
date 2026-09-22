export type CustomerTitle = "" | "Sir" | "Ma'am";

// Some walk-in quotes already have a courtesy title typed straight into the
// free-text client-name field (e.g. "Sir Ian Susi", "Mr John Miranda") —
// skip past that so we grab the actual first name, not the honorific.
const HONORIFIC_PREFIXES = new Set(["mr", "mrs", "ms", "miss", "sir", "maam", "madam", "dr", "engr", "atty"]);

/** "Juan Dela Cruz" -> "Juan". "Sir Ian Susi" -> "Ian". Empty input returns "". */
export function firstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length - 1 && HONORIFIC_PREFIXES.has(tokens[i].toLowerCase().replace(/[.']/g, ""))) {
    i++;
  }
  return tokens[i] ?? tokens[0] ?? "";
}

export function buildQuotationMessage(opts: {
  clientName: string | null | undefined;
  title?: CustomerTitle;
  quotationLink: string;
}): string {
  const first = firstName(opts.clientName);
  const title = opts.title || "";

  let greeting: string;
  if (!first) {
    greeting = "Good day po! 😊";
  } else if (title) {
    greeting = `Good day po, ${title} ${first}! 😊`;
  } else {
    greeting = `Good day po, ${first}! 😊`;
  }

  return [
    greeting,
    "Sharing po the quotation for your vehicle for your review.",
    "Please feel free to check the details, and if may questions or may gusto po kayong ipa-clarify, just let us know. We’ll be happy to assist you.",
    "Thank you po for considering C-Tech Automotive. 🙏",
    "You may view your quotation here:",
    opts.quotationLink,
  ].join("\n");
}

export function publicQuoteUrl(quoteId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://admin.ctechautomotiveph.com";
  return `${origin}/quote/${quoteId}`;
}

export const MESSENGER_URL = "https://m.me/cteachautomotive";
export const META_BUSINESS_SUITE_URL = "https://business.facebook.com/latest/inbox/all";
