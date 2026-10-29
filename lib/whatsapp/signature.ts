import { createHmac, timingSafeEqual } from "node:crypto";

// Verifica X-Hub-Signature-256 ("sha256=<hex>") sobre el body crudo con el App Secret.
export function verifySignature(rawBody: Buffer, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(header.slice("sha256=".length), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
