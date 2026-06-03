import { Wrench } from "lucide-react";

export function CTechLogo({
  variant = "light",
  size = "md",
}: {
  variant?: "light" | "dark";
  size?: "sm" | "md";
}) {
  const square = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const icon = size === "sm" ? 18 : 24;
  const wordmark = size === "sm" ? "text-base" : "text-xl";
  const sub = size === "sm" ? "text-[9px]" : "text-[10px]";
  const wordColor = variant === "light" ? "text-white" : "text-[#0F1E3A]";
  const subColor = variant === "light" ? "text-white/60" : "text-stone-500";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${square} flex items-center justify-center rounded-md`}
        style={{ backgroundColor: "#C9A227" }}
      >
        <Wrench size={icon} className="text-white" strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <div className={`${wordmark} font-bold tracking-tight ${wordColor}`}>
          C-TECH
        </div>
        <div
          className={`${sub} font-medium uppercase ${subColor}`}
          style={{ letterSpacing: "0.25em" }}
        >
          Automotive
        </div>
      </div>
    </div>
  );
}
