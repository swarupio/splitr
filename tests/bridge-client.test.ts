import { beforeEach, describe, expect, it, vi } from "vitest";
import { callInngestBridge } from "../lib/inngest/bridge";

beforeEach(() => {
  vi.stubEnv("INNGEST_BRIDGE_SECRET", "synthetic-test-bridge-credential");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://synthetic-test.convex.cloud");
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

  it.each(["http://synthetic-test.convex.cloud", "https://example.test"])(
    "rejects unsupported deployment URLs (%#)", async (url) => {
      vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", url);
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      await expect(callInngestBridge({ operation: "outstandingDebts" })).rejects.toThrow("hosted Convex");
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

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
