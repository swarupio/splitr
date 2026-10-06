import { describe, expect, it } from "vitest";
import { requireMember, requireUser } from "../convex/lib/auth";
import { createTestBackend } from "./convex.setup";

async function fixture() {
  const backend = createTestBackend();
  const ids = await backend.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", {
      name: "Member", email: "member@example.test", tokenIdentifier: "test-issuer|member",
    });
    const outsiderId = await ctx.db.insert("users", {
      name: "Outsider", email: "outsider@example.test", tokenIdentifier: "test-issuer|outsider",
    });
    const groupId = await ctx.db.insert("groups", {
      name: "Test group", createdBy: memberId,
      members: [{ userId: memberId, role: "admin", joinedAt: 0 }],
    });
    return { memberId, outsiderId, groupId };
  });
  return { backend, ...ids };
}

describe("requireUser", () => {
  it("rejects anonymous callers", async () => {
    await expect(createTestBackend().run(requireUser)).rejects.toThrow("Not authenticated");
  });

  it("rejects authenticated callers without a stored user", async () => {
    const caller = createTestBackend().withIdentity({ tokenIdentifier: "test-issuer|missing" });
    await expect(caller.run(requireUser)).rejects.toThrow("User not found");
  });

  it("resolves the caller from identity rather than a supplied user id", async () => {
    const { backend, outsiderId } = await fixture();
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|outsider" });
    expect((await caller.run(requireUser))._id).toBe(outsiderId);
  });
});

describe("requireMember", () => {
  it("rejects anonymous callers", async () => {
    const { backend, groupId } = await fixture();
    await expect(backend.run((ctx) => requireMember(ctx, groupId))).rejects.toThrow("Not authenticated");
  });

  it("rejects unregistered identities", async () => {
    const { backend, groupId } = await fixture();
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|missing" });
    await expect(caller.run((ctx) => requireMember(ctx, groupId))).rejects.toThrow("User not found");
  });

  it("rejects authenticated nonmembers", async () => {
    const { backend, groupId } = await fixture();
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|outsider" });
    await expect(caller.run((ctx) => requireMember(ctx, groupId))).rejects.toThrow("You are not a member");
  });

  it("rejects a missing group", async () => {
    const { backend, groupId } = await fixture();
    await backend.run((ctx) => ctx.db.delete(groupId));
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|member" });
    await expect(caller.run((ctx) => requireMember(ctx, groupId))).rejects.toThrow("Group not found");
  });

  it("returns the authenticated member and their group", async () => {
    const { backend, memberId, groupId } = await fixture();
    const caller = backend.withIdentity({ tokenIdentifier: "test-issuer|member" });
    const result = await caller.run((ctx) => requireMember(ctx, groupId));
    expect(result.user._id).toBe(memberId);
    expect(result.group._id).toBe(groupId);
  });
});
