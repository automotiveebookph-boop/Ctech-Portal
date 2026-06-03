import { BUSINESS } from "@/lib/business";

export function MyCarFooter() {
  return (
    <footer className="mt-8 border-t border-stone-100 py-6 text-center text-xs text-stone-400">
      © {new Date().getFullYear()} {BUSINESS.name} · {BUSINESS.address} ·{" "}
      {BUSINESS.email}
    </footer>
  );
}
