import type { ClerkMiddlewareAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (auth: ClerkMiddlewareAuth, request: NextRequest) => Promise<unknown>;
const harness = vi.hoisted(() => ({
  handler: undefined as Handler | undefined,
}));
vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    clerkMiddleware: (handler: Handler) => {
      harness.handler = handler;
      return handler;
    },
  };
});
import "../middleware";

const redirect = vi.fn();
const auth = vi.fn();
beforeEach(() => {
  redirect.mockReset().mockReturnValue(NextResponse.redirect("https://app.example.test/sign-in"));
  auth.mockReset().mockResolvedValue({ userId: null, redirectToSignIn: redirect });
});
async function run(path: string) {
  if (!harness.handler) throw new Error("Middleware was not registered");
  return harness.handler(auth as unknown as ClerkMiddlewareAuth,
    new NextRequest("https://app.example.test" + path));
}
const protectedPaths = ["/dashboard", "/contacts", "/expenses", "/groups", "/person", "/settlements"]
  .flatMap((path) => [path, path + "/nested/detail"]);

describe("protected routes", () => {
  it.each(protectedPaths)("redirects anonymous visitors to %s", async (path) => {
    const response = await run(path);
    expect(redirect).toHaveBeenCalledOnce();
    expect(response).toBe(redirect.mock.results[0].value);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(307);
  });

  it.each(protectedPaths)("allows authenticated visitors to %s", async (path) => {
    auth.mockResolvedValue({ userId: "synthetic-user", redirectToSignIn: redirect });
    const response = await run(path) as Response;
    expect(redirect).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("public routes", () => {
  it.each(["/", "/sign-in", "/sign-in/factor-one", "/sign-up", "/api/inngest", "/dashboard-other", "/contacts-other"])(
    "allows anonymous visitors to %s", async (path) => {
      const response = await run(path) as Response;
      expect(redirect).not.toHaveBeenCalled();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );
});
