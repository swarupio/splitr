import { z } from "zod";

export const bridgeRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("outstandingDebts") }).strict(),
  z.object({ operation: z.literal("usersWithExpenses") }).strict(),
  z.object({ operation: z.literal("monthlyExpenses"), userId: z.string().min(1).max(128) }).strict(),
  z.object({
    operation: z.literal("sendEmail"),
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
    text: z.string().optional(),
  }).strict(),
]);

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;
export type BridgeOperation = BridgeRequest["operation"];

const emailResultSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), id: z.string() }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

export const bridgeResponseSchemas = {
  outstandingDebts: z.array(z.object({
    _id: z.string(), name: z.string(), email: z.string(),
    debts: z.array(z.object({ userId: z.string(), name: z.string(), amount: z.number(), since: z.number() })),
  })),
  usersWithExpenses: z.array(z.object({ _id: z.string(), name: z.string(), email: z.string() })),
  monthlyExpenses: z.array(z.object({
    description: z.string(), category: z.string().optional(), date: z.number(), amount: z.number(),
    isPayer: z.boolean(), isGroup: z.boolean(),
  })),
  sendEmail: emailResultSchema,
};

export type EmailResult = z.infer<typeof emailResultSchema>;
export type BridgeResponses = {
  [Operation in BridgeOperation]: z.infer<(typeof bridgeResponseSchemas)[Operation]>;
};
