import { httpRouter } from "convex/server";
import { bridgeRequestSchema } from "../lib/inngest/bridge-contract";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { hasBridgeAuthorization } from "./lib/bridge-auth";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const bridge = httpAction(async (ctx, request) => {
  if (!(await hasBridgeAuthorization(request))) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const parsed = bridgeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const args = parsed.data;

  try {
    switch (args.operation) {
      case "outstandingDebts":
        return json(await ctx.runQuery(internal.inngest.getUsersWithOutstandingDebts, {}));
      case "usersWithExpenses":
        return json(await ctx.runQuery(internal.inngest.getUsersWithExpenses, {}));
      case "monthlyExpenses":
        // Convex's v.id validator checks this ID at the internal function boundary.
        return json(await ctx.runQuery(internal.inngest.getUserMonthlyExpenses, {
          userId: args.userId as Id<"users">,
        }));
      case "sendEmail":
        return json(await ctx.runAction(internal.email.sendEmail, {
          to: args.to, subject: args.subject, html: args.html,
          ...(args.text === undefined ? {} : { text: args.text }),
        }));
    }
  } catch {
    // Neither request headers/bodies nor provider errors belong in responses/logs.
    return json({ error: "Bridge operation failed" }, 500);
  }
});

const http = httpRouter();
http.route({ path: "/inngest-bridge", method: "POST", handler: bridge });
export default http;
