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
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!secret) throw new Error("Inngest bridge is not configured");
  if (!deploymentUrl) throw new Error("Convex deployment URL is not configured");

  const url = new URL(deploymentUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".convex.cloud")) {
    throw new Error("Inngest bridge requires a hosted Convex deployment URL");
  }
  url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
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
