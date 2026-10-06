import type { FunctionArgs } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestBackend } from "./convex.setup";

async function fixture() {
  const backend = createTestBackend();
  const ids = await backend.run(async (ctx) => {
    const users = await Promise.all(["caller", "payer", "participant", "outsider", "missing"].map((name) =>
      ctx.db.insert("users", {
        name, email: name + "@example.test", tokenIdentifier: "test-issuer|" + name,
      })));
    const [callerId, payerId, participantId, outsiderId, missingId] = users;
    await ctx.db.delete(missingId);
    const groupId = await ctx.db.insert("groups", {
      name: "Synthetic group", createdBy: callerId,
      members: [callerId, payerId, participantId, missingId].map((userId) => ({
        userId, role: "member", joinedAt: 0,
      })),
    });
    return { callerId, payerId, participantId, outsiderId, missingId, groupId };
  });
  const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|caller" });
  const args: FunctionArgs<typeof api.expenses.createExpense> = {
    description: "Synthetic expense", amount: 12.5, date: 0, splitType: "exact",
    paidByUserId: ids.callerId,
    splits: [{ userId: ids.participantId, amount: 12.5, paid: false }],
  };
  return { backend, caller, args, ...ids };
}

describe("expense creation authentication", () => {
  it.each(["anonymous", "unregistered"])("rejects %s callers", async (identity) => {
    const f = await fixture();
    const caller = identity === "anonymous" ? f.backend
      : f.backend.withIdentity({ tokenIdentifier: "test-issuer|unknown" });
    await expect(caller.mutation(api.expenses.createExpense, f.args))
      .rejects.toThrow(identity === "anonymous" ? "Not authenticated" : "User not found");
    expect(await f.backend.run((ctx) => ctx.db.query("expenses").collect())).toEqual([]);
  });
});

const invalidCases = [
  "unrelated personal debt", "nonmember payer", "nonmember participant",
  "missing personal payer", "missing personal participant",
  "missing group payer", "missing group participant", "nonmember caller", "missing group",
  "nonmember later participant", "missing later personal participant",
] as const;

describe("expense creation authorization", () => {
  it.each(invalidCases)("rejects %s without writing an expense", async (scenario) => {
    const f = await fixture();
    const args = { ...f.args };
    let caller = f.caller;
    let error = "";
    switch (scenario) {
      case "unrelated personal debt":
        args.paidByUserId = f.payerId;
        error = "Personal expenses must involve the caller";
        break;
      case "nonmember payer":
        args.groupId = f.groupId;
        args.paidByUserId = f.outsiderId;
        error = "Payer is not a member";
        break;
      case "nonmember participant":
        args.groupId = f.groupId;
        args.splits = [{ userId: f.outsiderId, amount: 12.5, paid: false }];
        error = "Participant is not a member";
        break;
      case "nonmember later participant":
        args.groupId = f.groupId;
        args.splits = [
          { userId: f.participantId, amount: 6.25, paid: false },
          { userId: f.outsiderId, amount: 6.25, paid: false },
        ];
        error = "Participant is not a member";
        break;
      case "missing later personal participant":
        args.splits = [
          { userId: f.participantId, amount: 6.25, paid: false },
          { userId: f.missingId, amount: 6.25, paid: false },
        ];
        error = "Participant not found";
        break;
      case "missing personal payer":
        args.paidByUserId = f.missingId;
        args.splits = [{ userId: f.callerId, amount: 12.5, paid: false }];
        error = "Payer not found";
        break;
      case "missing personal participant":
        args.splits = [{ userId: f.missingId, amount: 12.5, paid: false }];
        error = "Participant not found";
        break;
      case "missing group payer":
        args.groupId = f.groupId;
        args.paidByUserId = f.missingId;
        error = "Payer not found";
        break;
      case "missing group participant":
        args.groupId = f.groupId;
        args.splits = [{ userId: f.missingId, amount: 12.5, paid: false }];
        error = "Participant not found";
        break;
      case "nonmember caller":
        args.groupId = f.groupId;
        caller = f.backend.withIdentity({ tokenIdentifier: "test-issuer|outsider" });
        error = "You are not a member";
        break;
      case "missing group":
        await f.backend.run((ctx) => ctx.db.delete(f.groupId));
        args.groupId = f.groupId;
        error = "Group not found";
        break;
    }
    await expect(caller.mutation(api.expenses.createExpense, args)).rejects.toThrow(error);
    expect(await f.backend.run((ctx) => ctx.db.query("expenses").collect())).toEqual([]);
  });
});

describe("valid expense creation", () => {
  it.each(["personal payer", "personal participant", "group participant", "group organizer"])(
    "accepts a %s caller and preserves supplied splits", async (scenario) => {
      const f = await fixture();
      const args = { ...f.args };
      if (scenario !== "personal payer") {
        args.paidByUserId = f.payerId;
        args.splits = [{ userId: f.callerId, amount: 12.5, paid: false }];
      }
      if (scenario.startsWith("group")) args.groupId = f.groupId;
      if (scenario === "group organizer") args.splits = f.args.splits;
      const expenseId = await f.caller.mutation(api.expenses.createExpense, args);
      const expense = await f.backend.run((ctx) => ctx.db.get(expenseId));
      expect(expense).toMatchObject({
        ...args, createdBy: f.callerId, category: "Other",
      });
    },
  );

  it("preserves the existing floating-point tolerance", async () => {
    const f = await fixture();
    const args = { ...f.args, amount: 12.505 };
    const expenseId = await f.caller.mutation(api.expenses.createExpense, args);
    const expense = await f.backend.run((ctx) => ctx.db.get(expenseId));
    expect(expense).toMatchObject({ amount: 12.505, splits: args.splits });
  });

  it("still rejects totals outside the existing tolerance", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(api.expenses.createExpense, { ...f.args, amount: 13 }))
      .rejects.toThrow("Split amounts must add up");
    expect(await f.backend.run((ctx) => ctx.db.query("expenses").collect())).toEqual([]);
  });
});
