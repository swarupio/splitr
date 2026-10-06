import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { QueryCtx } from "../convex/_generated/server";
import { requireUser } from "../convex/lib/auth";
import { getSettlementData } from "../convex/settlements";
import { createTestBackend } from "./convex.setup";

// Convex exposes this hook at runtime for test execution, but hides its type.
const settlementHandler = (
  getSettlementData as unknown as {
    _handler: (
      ctx: QueryCtx,
      args: { entityType: string; entityId: string },
    ) => Promise<unknown>;
  }
)._handler;

async function fixture(recipient: "B" | "C", groupPayment = false) {
  const backend = createTestBackend();
  const ids = await backend.run(async (ctx) => {
    const [A, B, C] = await Promise.all(
      ["A", "B", "C"].map((name) =>
        ctx.db.insert("users", {
          name,
          email: name + "@example.test",
          tokenIdentifier: "test-issuer|" + name,
        }),
      ),
    );
    const groupId = groupPayment
      ? await ctx.db.insert("groups", {
          name: "Synthetic group",
          createdBy: A,
          members: [A, B, C].map((userId) => ({
            userId,
            role: "member",
            joinedAt: 0,
          })),
        })
      : undefined;
    await ctx.db.insert("expenses", {
      description: "A owes B 50",
      amount: 50,
      date: 0,
      splitType: "exact",
      paidByUserId: B,
      splits: [{ userId: A, amount: 50, paid: false }],
      createdBy: B,
    });
    await ctx.db.insert("settlements", {
      amount: 30,
      date: 0,
      paidByUserId: A,
      receivedByUserId: recipient === "B" ? B : C,
      createdBy: A,
      groupId,
    });
    return { A, B, C };
  });

  async function readPair(caller: "A" | "B") {
    return backend
      .withIdentity({ tokenIdentifier: "test-issuer|" + caller })
      .run(async (ctx) => {
        // convex-test does not propagate identity into this nested runQuery.
        // Resolve only the existing caller lookup with its actual auth helper;
        // the real handler, indexed queries and balance loop run unchanged.
        const lookup = vi
          .spyOn(ctx, "runQuery")
          .mockResolvedValue(await requireUser(ctx));
        const result = await settlementHandler(ctx, {
          entityType: "user",
          entityId: caller === "A" ? ids.B : ids.A,
        });
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(getFunctionName(lookup.mock.calls[0][0])).toBe(
          "users:getCurrentUser",
        );
        return result;
      });
  }

  return { backend, ids, readPair };
}

describe("personal settlement balances are restricted to the selected pair", () => {
  it.each(["A", "B"] as const)(
    "A paying C 30 leaves the A/B debt at 50 when viewed by %s",
    async (caller) => {
      const f = await fixture("C");
      const result = await f.readPair(caller);
      expect(result).toMatchObject({
        type: "user",
        youOwe: caller === "A" ? 50 : 0,
        youAreOwed: caller === "B" ? 50 : 0,
        netBalance: caller === "A" ? -50 : 50,
      });
    },
  );

  it.each(["A", "B"] as const)(
    "A paying B 30 reduces the A/B debt to 20 when viewed by %s",
    async (caller) => {
      const f = await fixture("B");
      expect(await f.readPair(caller)).toMatchObject({
        youOwe: caller === "A" ? 20 : 0,
        youAreOwed: caller === "B" ? 20 : 0,
        netBalance: caller === "A" ? -20 : 20,
      });
    },
  );

  it.each(["A", "B"] as const)(
    "group payments do not change personal balances when viewed by %s",
    async (caller) => {
      const f = await fixture("B", true);
      expect(await f.readPair(caller)).toMatchObject({
        youOwe: caller === "A" ? 50 : 0,
        youAreOwed: caller === "B" ? 50 : 0,
      });
    },
  );

  it("rejects anonymous access to the registered settlement query", async () => {
    const f = await fixture("C");
    await expect(
      f.backend.query(api.settlements.getSettlementData, {
        entityType: "user",
        entityId: f.ids.B,
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
