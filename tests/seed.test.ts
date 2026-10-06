import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { createTestBackend } from "./convex.setup";

describe("removed public seed mutation", () => {
  it.each(["anonymous", "authenticated"])("cannot be called by an %s caller", async (identity) => {
    const backend = createTestBackend();
    await backend.run(async (ctx) => {
      for (const name of ["caller", "second", "third"]) {
        await ctx.db.insert("users", {
          name, email: name + "@example.test", tokenIdentifier: "test-issuer|" + name,
        });
      }
    });
    const caller = identity === "authenticated"
      ? backend.withIdentity({ tokenIdentifier: "test-issuer|caller" })
      : backend;
    const oldSeed = makeFunctionReference<"mutation">("seed:seedDatabase");
    await expect(caller.mutation(oldSeed, {})).rejects.toThrow('Could not find module for: "seed"');
    await backend.run(async (ctx) => {
      expect(await ctx.db.query("expenses").collect()).toEqual([]);
      expect(await ctx.db.query("groups").collect()).toEqual([]);
      expect(await ctx.db.query("settlements").collect()).toEqual([]);
    });
  });
});
