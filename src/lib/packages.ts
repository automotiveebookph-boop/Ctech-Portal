// "PMS Package — 4L Gas · Fully Synthetic (5W-30)" → { type, size: "4L Gas", liters: 4, grade }
export type PackageInfo = { type: "PMS" | "Oil Change"; size: string; liters: number; grade: string };

export function parsePackage(name: string): PackageInfo | null {
  const m = name.match(/^(PMS|Oil Change) Package\s+—\s+((\d+)L\s+[^·]+?)\s+·\s+([^(]+?)\s*(\(|$)/);
  return m ? { type: m[1] as PackageInfo["type"], size: m[2].trim(), liters: Number(m[3]), grade: m[4].trim() } : null;
}
