// Sorts typed quote lines into car systems by keyword, first match wins — so
// "ATF filter" lands in Transmission before the generic Filters rule.
export const ITEM_CATEGORIES: { key: string; label: string; test: RegExp }[] = [
  { key: "pms", label: "PMS & Oil Change", test: /\bpms\b|oil change|change oil|synthetic oil|^\d+l (gas|diesel)/ },
  { key: "transmission", label: "Transmission & Clutch", test: /\batf\b|\bcvt|\bdct|transmission|clutch|friction disc|torque converter|flywheel|transfer case|gear oil|differential|pan pull ?down|pull ?down atf|atf pan/ },
  { key: "aircon", label: "Aircon", test: /aircon|air con|evaporator|condenser|freon|r-22|141b|filter drier|compressor|a\/c/ },
  { key: "brakes", label: "Brakes", test: /brake|rotor|caliper|wheel cylinder|wheel cup/ },
  { key: "cooling", label: "Cooling", test: /coolant|radiator|thermostat|cooling|aux fan|\bfan\b/ },
  { key: "engine", label: "Engine & Intake", test: /egr|throttle|intake|\bmaf|turbo|injector|valve|gasket|head|overhaul|spark|engine|crank ?shaft|oil seal|machine shop|oxygen|fuel line|oil pan|support/ },
  { key: "belts", label: "Belts & Timing", test: /belt|tensioner|idler|timing/ },
  { key: "suspension", label: "Suspension & Steering", test: /shock|stabilizer|tie rod|rack|ball ?joint|lower arm|bushing|steering|mounting/ },
  { key: "wheels", label: "Wheels, Tires & Bearings", test: /wheel|tire|bearing|\bhub\b/ },
  { key: "filters", label: "Filters", test: /filter|fitler/ },
  { key: "electrical", label: "Electrical & Diagnostics", test: /wiring|autowire|fuse|relay|bulb|electrical|starter|sensor|scanning|\becu\b|battery/ },
  { key: "fees", label: "Fees & Labor", test: /\bfee\b|mobilization|^labor$|roadside|home service|certified/ },
];
export const OTHER_CATEGORY = { key: "other", label: "Fluids & Other" };

export function categorizeItem(title: string): { key: string; label: string } {
  const t = title.toLowerCase();
  return ITEM_CATEGORIES.find((c) => c.test.test(t)) ?? OTHER_CATEGORY;
}
