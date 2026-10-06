import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx, "auth" | "db">;

export async function requireUser(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

export async function requireMember(ctx: AuthContext, groupId: Id<"groups">) {
  const user = await requireUser(ctx);
  const group = await ctx.db.get(groupId);
  if (!group) throw new Error("Group not found");
  if (!group.members.some((member) => member.userId === user._id)) {
    throw new Error("You are not a member of this group");
  }
  return { user, group };
}
