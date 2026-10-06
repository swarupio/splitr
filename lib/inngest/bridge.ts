import "server-only";
import {
  bridgeRequestSchema,
  bridgeResponseSchemas,
  type BridgeOperation,
  type BridgeRequest,
  type BridgeResponses,
} from "./bridge-contract";

export async function callInngestBridge<Operation extends BridgeOperation>(
  request: Extract<BridgeRequest, { operation: Operation }>,
): Promise<BridgeResponses[Operation]> {
  const secret = process.env.INNGEST_BRIDGE_SECRET;
  const httpUrl = process.env.CONVEX_HTTP_URL;
  if (!secret) throw new Error("Inngest bridge is not configured");
  if (!httpUrl) throw new Error("Convex HTTP URL is not configured");

  const url = new URL(httpUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".convex.site")) {
    throw new Error("Inngest bridge requires a hosted Convex HTTP URL");
  }
  url.pathname = "/inngest-bridge";
  url.search = "";
  url.hash = "";

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
    body: JSON.stringify(bridgeRequestSchema.parse(request)),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Inngest bridge request failed (HTTP " + response.status + ")");
  const data: unknown = await response.json();
  const parsed = bridgeResponseSchemas[request.operation].safeParse(data);
  if (!parsed.success) throw new Error("Inngest bridge returned an invalid response");
  if (request.operation === "sendEmail" && "success" in parsed.data && !parsed.data.success) {
    throw new Error(parsed.data.error);
  }
  return parsed.data as BridgeResponses[Operation];
}
