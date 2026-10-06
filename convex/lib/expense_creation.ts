import { v, type Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { requireMember, requireUser } from "./auth";

const expenseArgs = {
  description: v.string(),
  amount: v.number(),
  category: v.optional(v.string()),
  date: v.number(), // timestamp
  paidByUserId: v.id("users"),
  splitType: v.string(), // "equal", "percentage", "exact"
  splits: v.array(
    v.object({
      userId: v.id("users"),
      amount: v.number(),
      paid: v.boolean(),
    })
  ),
  groupId: v.optional(v.id("groups")),
};
const expenseInput = v.object(expenseArgs);

// Plain definition consumed by expenses.js; this helper registers no additional endpoint.
export const createExpenseDefinition = {
  args: expenseInput.fields,
  handler: async (ctx: MutationCtx, args: Infer<typeof expenseInput>) => {
    const { user, group } = args.groupId
      ? await requireMember(ctx, args.groupId)
      : { user: await requireUser(ctx), group: undefined };

    if (!group && args.paidByUserId !== user._id &&
        !args.splits.some((split) => split.userId === user._id)) {
      throw new Error("Personal expenses must involve the caller");
    }

    const payer = await ctx.db.get(args.paidByUserId);
    if (!payer) throw new Error("Payer not found");
    if (group && !group.members.some((member) => member.userId === payer._id)) {
      throw new Error("Payer is not a member of this group");
    }

    for (const split of args.splits) {
      const participant = await ctx.db.get(split.userId);
      if (!participant) throw new Error("Participant not found");
      if (group && !group.members.some((member) => member.userId === participant._id)) {
        throw new Error("Participant is not a member of this group");
      }
    }

    // Verify that splits add up to the total amount (with small tolerance for floating point issues)
    const totalSplitAmount = args.splits.reduce(
      (sum, split) => sum + split.amount,
      0
    );
    const tolerance = 0.01; // Allow for small rounding errors
    if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
      throw new Error("Split amounts must add up to the total expense amount");
    }

    // Create the expense
    const expenseId = await ctx.db.insert("expenses", {
      description: args.description,
      amount: args.amount,
      category: args.category || "Other",
      date: args.date,
      paidByUserId: args.paidByUserId,
      splitType: args.splitType,
      splits: args.splits,
      groupId: args.groupId,
      createdBy: user._id,
    });

    return expenseId;
  },
};
