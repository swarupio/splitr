import { beforeEach, describe, expect, it, vi } from "vitest";
import * as queries from "../convex/inngest";
import { sendEmail } from "../convex/email";
import { internal } from "../convex/_generated/api";
import { hasBridgeAuthorization } from "../convex/lib/bridge_auth";
import { createTestBackend } from "./convex.setup";

const credential = "synthetic-test-bridge-credential";
const operations = ["outstandingDebts", "usersWithExpenses", "monthlyExpenses", "sendEmail"] as const;

beforeEach(() => {
  vi.stubEnv("INNGEST_BRIDGE_SECRET", credential);
  vi.stubEnv("RESEND_API_KEY", "");
});

function post(body: unknown, authorization?: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization === undefined ? {} : { Authorization: authorization }),
    },
    body: JSON.stringify(body),
  };
}

async function fixture() {
  const backend = createTestBackend();
  const ids = await backend.run(async (ctx) => {
    const debtor = await ctx.db.insert("users", {
      name: "Debtor", email: "debtor@example.test", tokenIdentifier: "test-issuer|debtor",
    });
    const payer = await ctx.db.insert("users", {
      name: "Payer", email: "payer@example.test", tokenIdentifier: "test-issuer|payer",
    });
    await ctx.db.insert("expenses", {
      description: "Synthetic shared meal", amount: 50, category: "Food",
      date: Date.now(), paidByUserId: payer, splitType: "exact", createdBy: payer,
      splits: [{ userId: debtor, amount: 50, paid: false }],
    });
    return { debtor, payer };
  });
  return { backend, ...ids };
}

describe("background endpoint visibility", () => {
  it.each([
    ["getUsersWithOutstandingDebts", queries.getUsersWithOutstandingDebts],
    ["getUsersWithExpenses", queries.getUsersWithExpenses],
    ["getUserMonthlyExpenses", queries.getUserMonthlyExpenses],
    ["sendEmail", sendEmail],
  ])("registers %s as internal, never public", (_name, endpoint) => {
    expect(endpoint).toHaveProperty("isInternal", true);
    expect(endpoint).not.toHaveProperty("isPublic", true);
  });
});

describe("Inngest bridge authorization", () => {
  it.each(operations)("returns 401 without credentials for %s", async (operation) => {
    const response = await createTestBackend().fetch("/inngest-bridge", post({ operation }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it.each(operations)("returns 401 with incorrect credentials for %s", async (operation) => {
    const response = await createTestBackend().fetch(
      "/inngest-bridge", post({ operation }, "Bearer incorrect-test-credential"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("does not let a signed-in user bypass the job credential", async () => {
    const backend = createTestBackend().withIdentity({ tokenIdentifier: "test-issuer|caller" });
    const response = await backend.fetch("/inngest-bridge", post({ operation: "outstandingDebts" }));
    expect(response.status).toBe(401);
  });

  it("fails closed if the deployment credential is missing", async () => {
    vi.stubEnv("INNGEST_BRIDGE_SECRET", "");
    const response = await createTestBackend().fetch(
      "/inngest-bridge", post({ operation: "outstandingDebts" }, "Bearer " + credential),
    );
    expect(response.status).toBe(401);
  });

  it("checks authentication before parsing invalid JSON", async () => {
    const response = await createTestBackend().fetch("/inngest-bridge", { method: "POST", body: "{" });
    expect(response.status).toBe(401);
  });

  it.each(["Bearer ", "Basic invalid", "Bearer shortened", "Bearer " + credential + "x"])(
    "rejects empty, malformed, shortened and extended credentials (%#)",
    async (authorization) => {
      const response = await createTestBackend().fetch(
        "/inngest-bridge", post({ operation: "outstandingDebts" }, authorization),
      );
      expect(response.status).toBe(401);
    },
  );

  it("uses cryptographic MAC verification for both matches and mismatches", async () => {
    const verify = vi.spyOn(crypto.subtle, "verify");
    const check = (value: string) => hasBridgeAuthorization(new Request("https://example.test", {
      headers: { Authorization: "Bearer " + value },
    }));
    expect(await check(credential)).toBe(true);
    expect(await check("x" + credential.slice(1))).toBe(false);
    expect(await check(credential.slice(0, -1) + "x")).toBe(false);
    expect(verify).toHaveBeenCalledTimes(3);
  });
});

describe("authorized Inngest bridge operations", () => {
  it("returns debts only after successful service authorization", async () => {
    const { backend, debtor, payer } = await fixture();
    const response = await backend.fetch(
      "/inngest-bridge", post({ operation: "outstandingDebts" }, "Bearer " + credential),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject([{
      _id: debtor, debts: [{ userId: payer, amount: 50 }],
    }]);
  });

  it("returns spender discovery through the internal query", async () => {
    const { backend } = await fixture();
    const response = await backend.fetch(
      "/inngest-bridge", post({ operation: "usersWithExpenses" }, "Bearer " + credential),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(2);
  });

  it("returns the selected user's monthly expenses through the internal query", async () => {
    const { backend, debtor } = await fixture();
    const response = await backend.fetch(
      "/inngest-bridge", post({ operation: "monthlyExpenses", userId: debtor }, "Bearer " + credential),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ description: "Synthetic shared meal", amount: 50 }]);
  });

  it.each([
    { operation: "arbitraryFunction" },
    { operation: "monthlyExpenses" },
    { operation: "outstandingDebts", functionName: "seed:seedDatabase" },
    { operation: "sendEmail", to: "test@example.test", subject: "", html: "", apiKey: "not-accepted" },
  ])("rejects unknown operations and invalid arguments (%#)", async (body) => {
    const response = await createTestBackend().fetch(
      "/inngest-bridge", post(body, "Bearer " + credential),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
  });

  it("returns 400 for invalid JSON after service authorization", async () => {
    const response = await createTestBackend().fetch("/inngest-bridge", {
      method: "POST", headers: { Authorization: "Bearer " + credential }, body: "{",
    });
    expect(response.status).toBe(400);
  });

  it("reports optional email as unconfigured without sending anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await createTestBackend().fetch("/inngest-bridge", post({
      operation: "sendEmail", to: "test@example.test", subject: "Synthetic", html: "<p>Test</p>",
    }, "Bearer " + credential));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: false, error: "EMAIL_NOT_CONFIGURED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not require Resend credentials for the internal email action", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await createTestBackend().action(internal.email.sendEmail, {
      to: "test@example.test", subject: "Synthetic", html: "<p>Test</p>",
    });
    expect(result).toEqual({ success: false, error: "EMAIL_NOT_CONFIGURED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
