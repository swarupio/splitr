import { beforeEach, describe, expect, it, vi } from "vitest";
import { callInngestBridge } from "../lib/inngest/bridge";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected bridge request"));
  vi.stubEnv("INNGEST_BRIDGE_SECRET", "synthetic-test-bridge-credential");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://different-deployment.convex.cloud");
  vi.stubEnv("CONVEX_HTTP_URL", "https://synthetic-test.convex.site");
});

describe("server-side Inngest bridge client", () => {
  it("uses the HTTP-action domain, bearer authentication and no redirect following", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", {
      headers: { "Content-Type": "application/json" },
    }));
    expect(await callInngestBridge({ operation: "outstandingDebts" })).toEqual([]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://synthetic-test.convex.site/inngest-bridge");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).has("Authorization")).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual({ operation: "outstandingDebts" });
  });

  it("fails closed without a bridge credential and does not make a request", async () => {
    vi.stubEnv("INNGEST_BRIDGE_SECRET", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow("not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["http://synthetic-test.convex.site", "https://example.test", "https://synthetic-test.convex.cloud"])(
    "rejects unsupported deployment URLs (%#)", async (url) => {
      vi.stubEnv("CONVEX_HTTP_URL", url);
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow("Convex HTTP URL");
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("requires explicit HTTP configuration even when the public deployment URL is set", async () => {
    vi.stubEnv("CONVEX_HTTP_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow("not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not reflect bridge error response bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("untrusted detail", { status: 401 }));
    await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow(
      "Inngest bridge request failed (HTTP 401)",
    );
  });

  it("rejects malformed response data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow("invalid response");
  });

  it("propagates unconfigured email as failure rather than claiming it was sent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: false, error: "EMAIL_NOT_CONFIGURED",
    })));
    await expect(callInngestBridge({
      operation: "sendEmail", to: "test@example.test", subject: "Synthetic", html: "<p>Test</p>",
    })).rejects.toThrow("EMAIL_NOT_CONFIGURED");
  });
});
