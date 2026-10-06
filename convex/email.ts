import { v } from "convex/values";
import { Resend } from "resend";
import type { EmailResult } from "../lib/inngest/bridge-contract";
import { internalAction } from "./_generated/server";

// Optional legacy job integration; no UI depends on email.
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<EmailResult> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { success: false, error: "EMAIL_NOT_CONFIGURED" };

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: "Splitr <onboarding@resend.dev>",
        to: args.to, subject: args.subject, html: args.html, text: args.text,
      });
      if (result.error || !result.data?.id) {
        return { success: false, error: "EMAIL_SEND_FAILED" };
      }
      return { success: true, id: result.data.id };
    } catch {
      return { success: false, error: "EMAIL_SEND_FAILED" };
    }
  },
});
