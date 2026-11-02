// "PMS Package — 4L Gas · Fully Synthetic (5W-30)" → { type, size: "4L Gas", liters: 4, grade }
export type PackageInfo = { type: "PMS" | "Oil Change"; size: string; liters: number; grade: string };

export function parsePackage(name: string): PackageInfo | null {
  const m = name.match(/^(PMS|Oil Change) Package\s+—\s+((\d+)L\s+[^·]+?)\s+·\s+([^(]+?)\s*(\(|$)/);
  return m ? { type: m[1] as PackageInfo["type"], size: m[2].trim(), liters: Number(m[3]), grade: m[4].trim() } : null;
}

// What each package covers — prints on quotes and is the technician's job checklist.
export const PMS_INCLUSIONS = [
  "Engine Oil",
  "Oil Filter",
  "Cabin Filter Cleaning",
  "Air Filter Cleaning",
  "Fluid Top-Up",
  "Battery Health Check-Up",
  "Labor",
  "Brake Cleaning",
  "Brake Cleaner",
  "Under Chassis Check-Up",
  "Tire Rotation (upon request)",
  "Windshield Washer Fluid",
  "Engine Bay Cleaning",
  "Car Seat Cover Kit",
  "FREE! Full System ECU Scanning",
  "FREE! Safety Inspection",
];
export const OIL_CHANGE_INCLUSIONS = [
  "Engine Oil",
  "Oil Filter",
  "Cabin Filter Cleaning",
  "Air Filter Cleaning",
  "Fluid Top-Up",
  "Battery Health Check-Up",
  "Labor",
];
