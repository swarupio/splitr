import { beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { createTestBackend } from "./convex.setup";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const args = { to: "test@example.test", subject: "Synthetic", html: "<p>Test</p>" };

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "");
  send.mockReset();
});

describe("optional internal email integration", () => {
  it("does not call a provider without configuration", async () => {
    expect(await createTestBackend().action(internal.email.sendEmail, args)).toEqual({
      success: false, error: "EMAIL_NOT_CONFIGURED",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("uses the provider's actual data.id acknowledgment", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-provider-credential");
    send.mockResolvedValue({ data: { id: "synthetic-email-id" }, error: null });
    expect(await createTestBackend().action(internal.email.sendEmail, args)).toEqual({
      success: true, id: "synthetic-email-id",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports provider rejection without returning provider details", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-provider-credential");
    send.mockResolvedValue({ data: null, error: { message: "untrusted provider detail" } });
    expect(await createTestBackend().action(internal.email.sendEmail, args)).toEqual({
      success: false, error: "EMAIL_SEND_FAILED",
    });
  });

  it("does not log or reflect thrown provider errors", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-provider-credential");
    send.mockRejectedValue(new Error("untrusted provider detail"));
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    expect(await createTestBackend().action(internal.email.sendEmail, args)).toEqual({
      success: false, error: "EMAIL_SEND_FAILED",
    });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
