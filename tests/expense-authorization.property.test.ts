import fc from "fast-check";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestBackend } from "./convex.setup";

const userIndexes = Array.from({ length: 8 }, (_, index) => index);
const parties = fc.record({
  caller: fc.integer({ min: 0, max: 7 }),
  payer: fc.integer({ min: 0, max: 7 }),
  participants: fc.uniqueArray(fc.integer({ min: 0, max: 7 }), {
    minLength: 1,
    maxLength: 8,
  }),
});

async function fixture() {
  const backend = createTestBackend();
  const users = await backend.run(async (ctx) => {
    const ids = [];
    for (const index of userIndexes) {
      ids.push(
        await ctx.db.insert("users", {
          name: "Synthetic member " + index,
          email: "member" + index + "@example.test",
          tokenIdentifier: "test-issuer|member" + index,
        }),
      );
    }
    return ids;
  });
  return { backend, users };
}

it("personal expense creation succeeds only when the caller is payer or participant", async () => {
  await fc.assert(
    fc.asyncProperty(parties, async ({ caller, payer, participants }) => {
      const { backend, users } = await fixture();
      const session = backend.withIdentity({
        tokenIdentifier: "test-issuer|member" + caller,
      });
      const args = {
        description: "Synthetic personal expense",
        amount: participants.length,
        date: 0,
        paidByUserId: users[payer],
        splitType: "exact",
        splits: participants.map((index) => ({
          userId: users[index],
          amount: 1,
          paid: false,
        })),
      };
      if (caller === payer || participants.includes(caller)) {
        const id = await session.mutation(api.expenses.createExpense, args);
        expect(await backend.run((ctx) => ctx.db.get(id))).toMatchObject({
          ...args,
          createdBy: users[caller],
        });
      } else {
        await expect(
          session.mutation(api.expenses.createExpense, args),
        ).rejects.toThrow("Personal expenses must involve the caller");
        expect(
          await backend.run((ctx) => ctx.db.query("expenses").collect()),
        ).toEqual([]);
      }
    }),
    { numRuns: 100, seed: 7008 },
  );
});

it("group expense creation succeeds only when caller, payer and all participants are members", async () => {
  await fc.assert(
    fc.asyncProperty(
      parties,
      fc.subarray(userIndexes),
      async ({ caller, payer, participants }, members) => {
        const { backend, users } = await fixture();
        const groupId = await backend.run((ctx) =>
          ctx.db.insert("groups", {
            name: "Synthetic group",
            createdBy: users[0],
            members: members.map((index) => ({
              userId: users[index],
              role: "member",
              joinedAt: 0,
            })),
          }),
        );
        const session = backend.withIdentity({
          tokenIdentifier: "test-issuer|member" + caller,
        });
        const args = {
          description: "Synthetic group expense",
          amount: participants.length,
          date: 0,
          paidByUserId: users[payer],
          splitType: "exact",
          groupId,
          splits: participants.map((index) => ({
            userId: users[index],
            amount: 1,
            paid: false,
          })),
        };
        const allowed = [caller, payer, ...participants].every((index) =>
          members.includes(index),
        );
        if (allowed) {
          const id = await session.mutation(api.expenses.createExpense, args);
          expect(await backend.run((ctx) => ctx.db.get(id))).toMatchObject({
            ...args,
            createdBy: users[caller],
          });
        } else {
          await expect(
            session.mutation(api.expenses.createExpense, args),
          ).rejects.toThrow(/not a member/);
          expect(
            await backend.run((ctx) => ctx.db.query("expenses").collect()),
          ).toEqual([]);
        }
      },
    ),
    { numRuns: 100, seed: 8009 },
  );
});
