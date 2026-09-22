import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSession(...args) } }
}));

// import after the mock so the module under test picks up the mocked supabase client
const { pinStatus, pinSetup, pinVerify, createCheckoutOrder } = await import("./payments");

const originalFetch = globalThis.fetch;

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    status,
    json: async () => body
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("payments client — auth/config guards", () => {
  it("returns a 401-shaped response without calling fetch when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    globalThis.fetch = vi.fn();
    const result = await pinVerify("1234");
    expect(result).toEqual({ outcome: "error", error: "Please sign in again." });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("sends the vendor's access token as a bearer header", async () => {
    mockFetchOnce(200, { unlockToken: "tok", expiresInSeconds: 300 });
    await pinVerify("1234");
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });
});

describe("pinVerify — status-code to outcome mapping", () => {
  it("maps 200 to a success outcome carrying the unlock token", async () => {
    mockFetchOnce(200, { unlockToken: "abc123", expiresInSeconds: 300 });
    const result = await pinVerify("1234");
    expect(result).toEqual({ outcome: "success", unlockToken: "abc123", expiresInSeconds: 300 });
  });

  it("maps 423 to a locked outcome", async () => {
    mockFetchOnce(423, { error: "Too many attempts.", lockedUntil: "2026-01-01T00:00:00Z" });
    const result = await pinVerify("0000");
    expect(result).toEqual({ outcome: "locked", error: "Too many attempts.", lockedUntil: "2026-01-01T00:00:00Z" });
  });

  it("maps 401 to an incorrect outcome with attempts remaining", async () => {
    mockFetchOnce(401, { error: "Incorrect PIN.", attemptsRemaining: 2 });
    const result = await pinVerify("9999");
    expect(result).toEqual({ outcome: "incorrect", error: "Incorrect PIN.", attemptsRemaining: 2 });
  });

  it("maps any other non-200 status to a generic error outcome", async () => {
    mockFetchOnce(500, {});
    const result = await pinVerify("1234");
    expect(result).toEqual({ outcome: "error", error: "Something went wrong. Please try again." });
  });

  it("never leaks the raw PIN value into the returned result", async () => {
    mockFetchOnce(401, { error: "Incorrect PIN.", attemptsRemaining: 1 });
    const result = await pinVerify("4321");
    expect(JSON.stringify(result)).not.toContain("4321");
  });
});

describe("pinSetup / pinStatus", () => {
  it("pinSetup treats any non-200 status as a failure with a fallback message", async () => {
    mockFetchOnce(400, {});
    const result = await pinSetup("1234", "1234", "pw");
    expect(result).toEqual({ ok: false, error: "Could not set your PIN." });
  });

  it("pinSetup succeeds on 200 with no error text", async () => {
    mockFetchOnce(200, {});
    const result = await pinSetup("1234", "1234", "pw");
    expect(result).toEqual({ ok: true });
  });

  it("pinStatus passes the server response straight through", async () => {
    mockFetchOnce(200, { configured: true, locked: false, lockedUntil: null });
    const result = await pinStatus();
    expect(result).toEqual({ configured: true, locked: false, lockedUntil: null });
  });
});

describe("createCheckoutOrder — status-code to outcome mapping", () => {
  const args = { applicationId: "app1", unlockToken: "tok", idempotencyKey: "idem1", online: true };

  it("maps 503 to not_configured", async () => {
    mockFetchOnce(503, { error: "Online payments are not yet available for this event." });
    const result = await createCheckoutOrder(args);
    expect(result.outcome).toBe("not_configured");
  });

  it("maps 401 to unlock_required", async () => {
    mockFetchOnce(401, { error: "Please verify your payment PIN again." });
    const result = await createCheckoutOrder(args);
    expect(result.outcome).toBe("unlock_required");
  });

  it("maps 200 + configured:true to a created outcome", async () => {
    mockFetchOnce(200, {
      ok: true,
      configured: true,
      testMode: true,
      order: { id: "o1", applicationId: "app1", amountMinor: 50000, currency: "INR", status: "created", providerOrderId: "p1" },
      provider: { name: "razorpay", keyId: "rzp_test_1" }
    });
    const result = await createCheckoutOrder(args);
    expect(result).toMatchObject({ outcome: "created", configured: true, testMode: true });
  });

  it("maps 200 + configured:false to an existing outcome (idempotent replay)", async () => {
    mockFetchOnce(200, {
      ok: true,
      configured: false,
      order: { id: "o1", applicationId: "app1", amountMinor: 50000, currency: "INR", status: "paid", providerOrderId: "p1" }
    });
    const result = await createCheckoutOrder(args);
    expect(result.outcome).toBe("existing");
  });

  it("maps ok:false on a 200 response to a generic error, not a false success", async () => {
    mockFetchOnce(200, { ok: false, error: "Amount mismatch." });
    const result = await createCheckoutOrder(args);
    expect(result).toEqual({ outcome: "error", error: "Amount mismatch." });
  });
});
