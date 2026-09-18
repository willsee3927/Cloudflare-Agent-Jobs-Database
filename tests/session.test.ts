import { describe, expect, it } from "vitest";
import { issueSession, verifySession, sessionCookie, sameOrigin, RETENTION_MS } from "../src/session";

describe("visitor identity", () => {
  const secret = "a-test-only-secret-that-is-long-enough";
  it("restores signed identity but rejects tampering and a different signing key", async () => {
    const issued = await issueSession(secret);
    expect(await verifySession(sessionCookie(issued.token), secret)).toBe(issued.id);
    expect(await verifySession(sessionCookie(issued.token.replace(issued.id, crypto.randomUUID())), secret)).toBeNull();
    expect(await verifySession(sessionCookie(issued.token), "different-secret")).toBeNull();
  });
  it("expires old cookies and never shares a fixed default identity", async () => {
    const now = Date.now();
    const a = await issueSession(secret, now);
    const b = await issueSession(secret, now);
    expect(a.id).not.toBe(b.id);
    expect(await verifySession(sessionCookie(a.token), secret, now + RETENTION_MS + 1)).toBeNull();
    expect(await verifySession(null, secret)).toBeNull();
  });
  it("renews an active browser without changing its conversation identity", async () => {
    const now = Date.now();
    const original = await issueSession(secret, now);
    const renewed = await issueSession(secret, now + RETENTION_MS - 1_000, original.id);
    expect(renewed.id).toBe(original.id);
    expect(await verifySession(sessionCookie(original.token), secret, now + RETENTION_MS + 1)).toBeNull();
    expect(await verifySession(sessionCookie(renewed.token), secret, now + RETENTION_MS + 1)).toBe(original.id);
  });
  it("requires exact origin for writes", () => {
    expect(sameOrigin(new Request("https://jobs.example/api/chat", { headers: { Origin: "https://evil.example" } }))).toBe(false);
    expect(sameOrigin(new Request("https://jobs.example/api/chat", { headers: { Origin: "https://jobs.example" } }))).toBe(true);
  });
});
