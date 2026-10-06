const encoder = new TextEncoder();
const algorithm = { name: "HMAC", hash: "SHA-256" };
const comparisonMessage = encoder.encode("splitr-inngest-bridge-v1");

/**
 * Compare credentials via fixed-size HMAC verification, avoiding a JavaScript
 * equality check or early-exit byte loop. WebCrypto performs the MAC comparison.
 * Keep credentials in this HTTP context: never forward them as function args.
 */
export async function hasBridgeAuthorization(request: Request): Promise<boolean> {
  const expected = process.env.INNGEST_BRIDGE_SECRET;
  const authorization = request.headers.get("Authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  if (!supplied) return false;

  const expectedDigest = await crypto.subtle.digest("SHA-256", encoder.encode(expected));
  const suppliedDigest = await crypto.subtle.digest("SHA-256", encoder.encode(supplied));
  const expectedKey = await crypto.subtle.importKey(
    "raw", expectedDigest, algorithm, false, ["verify"],
  );
  const suppliedKey = await crypto.subtle.importKey(
    "raw", suppliedDigest, algorithm, false, ["sign"],
  );
  const signature = await crypto.subtle.sign(algorithm, suppliedKey, comparisonMessage);
  return crypto.subtle.verify(algorithm, expectedKey, signature, comparisonMessage);
}
