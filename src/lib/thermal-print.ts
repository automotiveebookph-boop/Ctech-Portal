// 58mm thermal receipts (ESC/POS) for the technician phone app.
// Printing goes straight from Chrome on Android over Bluetooth Low Energy
// (Web Bluetooth). Printers that only speak classic Bluetooth can print
// through the free RawBT app instead (rawbt: link).

export type ReceiptLine = { title: string; qty: number; amount: number };
export type ReceiptData = {
  billNo: string;
  date: Date;
  client: string;
  phone?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  odometer?: number | null;
  lines: ReceiptLine[];
  deductions: number;
  total: number;
  paid: number;
  method?: string | null;
  technician?: string | null;
  link?: string | null;
  /** Multi-line job details: package checklist, oil used, next service, findings. */
  details?: string | null;
};

const WIDTH = 32; // characters per line, 58mm paper, font A
const ESC = 0x1b;
const GS = 0x1d;

// Printer codepages have no ₱ or fancy dashes — keep it to plain ASCII.
function ascii(s: string): string {
  return s
    .replace(/₱/g, "P")
    .replace(/✓/g, "[x]")
    .replace(/✗/g, "[ ]")
    .replace(/[—–]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/[ñÑ]/g, (c) => (c === "ñ" ? "n" : "N"))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}
const money = (n: number) => "P" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function wrap(text: string, width = WIDTH): string[] {
  const out: string[] = [];
  for (const para of ascii(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if ((line + " " + word).trim().length > width) {
        if (line) out.push(line);
        line = word.length > width ? word.slice(0, width) : word;
      } else line = (line + " " + word).trim();
    }
    if (line) out.push(line);
  }
  return out;
}
const leftRight = (l: string, r: string) => {
  const left = ascii(l), right = ascii(r);
  const space = Math.max(1, WIDTH - left.length - right.length);
  return (left + " ".repeat(space) + right).slice(0, Math.max(WIDTH, left.length + right.length + 1));
};

class Builder {
  private bytes: number[] = [];
  raw(...b: number[]) { this.bytes.push(...b); return this; }
  text(s: string) { for (const ch of ascii(s)) this.bytes.push(ch.charCodeAt(0)); return this; }
  line(s = "") { return this.text(s).raw(0x0a); }
  align(a: "left" | "center") { return this.raw(ESC, 0x61, a === "center" ? 1 : 0); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  size(big: boolean) { return this.raw(GS, 0x21, big ? 0x11 : 0x00); }
  divider() { return this.line("-".repeat(WIDTH)); }
  qr(data: string) {
    const d = Array.from(new TextEncoder().encode(data));
    const len = d.length + 3;
    this.raw(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00); // model 2
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 0x05); // module size
    this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30); // error correction L
    this.raw(GS, 0x28, 0x6b, len & 0xff, len >> 8, 0x31, 0x50, 0x30, ...d); // store
    return this.raw(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30); // print
  }
  build() { return new Uint8Array(this.bytes); }
}

export function buildReceipt(r: ReceiptData): Uint8Array {
  const b = new Builder().raw(ESC, 0x40); // init
  b.align("center").bold(true).size(true).line("C-TECH").size(false).line("AUTOMOTIVE").bold(false);
  b.line("9016 DRT Hwy, Sto. Cristo,").line("Pulilan, Bulacan").line("0998-1516-245");
  b.divider().bold(true).line("HOME SERVICE BILL").bold(false);
  b.line(r.billNo).line(r.date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }));
  b.align("left").divider();
  for (const l of wrap(`Client: ${r.client}`)) b.line(l);
  if (r.phone) b.line(`Contact: ${r.phone}`);
  if (r.vehicle || r.plate) for (const l of wrap(`Vehicle: ${[r.vehicle, r.plate].filter(Boolean).join(" - ")}`)) b.line(l);
  if (r.odometer) b.line(`Odometer: ${r.odometer.toLocaleString()} km`);
  b.divider();
  for (const l of r.lines) {
    const label = l.qty > 1 ? `${l.qty} x ${l.title}` : l.title;
    const wrapped = wrap(label, WIDTH - money(l.amount).length - 1);
    wrapped.forEach((w, i) => b.line(i === wrapped.length - 1 ? leftRight(w, money(l.amount)) : w));
  }
  b.divider();
  if (r.deductions > 0) b.line(leftRight("Less / discount", "-" + money(r.deductions)));
  b.bold(true).line(leftRight("TOTAL", money(r.total))).bold(false);
  b.line(leftRight(`Paid${r.method ? ` (${r.method})` : ""}`, money(r.paid)));
  b.bold(true).line(leftRight("BALANCE", money(Math.max(0, r.total - r.paid)))).bold(false);
  b.divider();
  if (r.details?.trim()) {
    b.bold(true).line("JOB DETAILS").bold(false);
    for (const raw of r.details.trim().split("\n")) {
      const isHeading = /:$/.test(raw.trim());
      if (isHeading) b.bold(true);
      for (const l of wrap(raw)) b.line(l);
      if (isHeading) b.bold(false);
    }
    b.divider();
  }
  if (r.technician) b.line(`Technician: ${r.technician}`);
  b.align("center");
  if (r.link) {
    b.line().line("Scan for your full bill:").qr(r.link).line();
  }
  b.line("This is not an official receipt.").line("Thank you for choosing C-Tech!").line().line().line();
  return b.build();
}

/* ---------- Bluetooth (BLE) printing ---------- */

// Service UUIDs used by common cheap BLE thermal printers.
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
];

type BleChar = { properties: { write: boolean; writeWithoutResponse: boolean }; writeValue(v: BufferSource): Promise<void>; writeValueWithoutResponse?(v: BufferSource): Promise<void> };
type BleDevice = { name?: string; gatt?: { connected: boolean; connect(): Promise<{ getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BleChar[]> }[]> }> } };
let cachedDevice: BleDevice | null = null;
let cachedChar: BleChar | null = null;

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const connectedPrinterName = () => cachedDevice?.name ?? null;

async function getCharacteristic(): Promise<BleChar> {
  const bt = (navigator as unknown as { bluetooth: { requestDevice(o: unknown): Promise<BleDevice> } }).bluetooth;
  if (!cachedDevice) {
    cachedDevice = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    cachedChar = null;
  }
  if (cachedChar && cachedDevice.gatt?.connected) return cachedChar;
  const server = await cachedDevice.gatt!.connect();
  for (const service of await server.getPrimaryServices()) {
    for (const c of await service.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        cachedChar = c;
        return c;
      }
    }
  }
  cachedDevice = null;
  throw new Error("This printer doesn't accept Bluetooth Low Energy printing. Try 'Print with RawBT app'.");
}

export async function printBluetooth(data: Uint8Array): Promise<void> {
  const c = await getCharacteristic();
  // BLE packets are small — send in chunks with a short pause so cheap printers keep up.
  for (let i = 0; i < data.length; i += 100) {
    const chunk = data.slice(i, i + 100);
    if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(chunk);
    else await c.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 20));
  }
}

export function forgetPrinter() {
  cachedDevice = null;
  cachedChar = null;
}

/** Classic-Bluetooth printers: hand the receipt to the RawBT Android app. */
export function rawbtUrl(data: Uint8Array): string {
  let bin = "";
  data.forEach((b) => (bin += String.fromCharCode(b)));
  return "rawbt:base64," + btoa(bin);
}
