import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestBackend } from "./convex.setup";

 describe("existing current-user authorization", () => {
  it("rejects an anonymous caller", async () => {
    const backend = createTestBackend();
    await expect(backend.query(api.users.getCurrentUser, {})).rejects.toThrow("Not authenticated");
  });

  it("rejects an authenticated identity without a user record", async () => {
    const backend = createTestBackend().withIdentity({ tokenIdentifier: "test-issuer|unregistered" });
    await expect(backend.query(api.users.getCurrentUser, {})).rejects.toThrow("User not found");
  });

  it("returns only the user matching the caller's identity", async () => {
    const backend = createTestBackend();
    const userId = await backend.run(async (ctx) => {
      await ctx.db.insert("users", {
        name: "Other user", email: "other@example.test", tokenIdentifier: "test-issuer|other",
      });
      return ctx.db.insert("users", {
        name: "Caller", email: "caller@example.test", tokenIdentifier: "test-issuer|caller",
      });
    });
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|caller" });
    const user = await caller.query(api.users.getCurrentUser, {});
    expect(user._id).toBe(userId);
  });
});
