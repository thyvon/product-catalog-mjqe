const LOGO_URL = "https://sms.mjqeducation.edu.kh/assets/images/logo/logo-dark.png";
const LOGO_WIDTH = 140;
const LOGO_HEIGHT = 67;

let logoBase64: string | null = null;
let loadPromise: Promise<void> | null = null;

async function loadLogo(): Promise<void> {
  try {
    const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error("Empty image response");
    logoBase64 = buffer.toString("base64");
    console.log(`[logo] Debit note logo loaded (${buffer.length} bytes): ${LOGO_URL}`);
  } catch (err: any) {
    console.warn(`[logo] Failed to load debit note logo from ${LOGO_URL}:`, err?.message || err);
  }
}

export function ensureDebitNoteLogo(): void {
  if (!loadPromise) loadPromise = loadLogo();
}

export function getDebitNoteLogo(): { base64: string; width: number; height: number } | null {
  if (!logoBase64) return null;
  return { base64: logoBase64, width: LOGO_WIDTH, height: LOGO_HEIGHT };
}
