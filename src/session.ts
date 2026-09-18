const COOKIE = "job_scout_session";
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function decode(value: string) { return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)); }
async function key(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function issueSession(secret: string, now = Date.now(), existingId?: string) {
  const id = existingId ?? crypto.randomUUID();
  const payload = `${id}.${now + RETENTION_MS}`;
  const sig = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload));
  return { id, token: `${payload}.${encode(new Uint8Array(sig))}` };
}
export async function verifySession(cookie: string | null, secret: string, now = Date.now()): Promise<string | null> {
  const token = cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || token.length > 250) return null;
  const [id, expiry, signature, extra] = token.split(".");
  if (extra || !id || !signature || !/^[0-9a-f-]{36}$/.test(id) || !/^\d{13}$/.test(expiry ?? "")) return null;
  const exp = Number(expiry);
  if (exp <= now || exp > now + RETENTION_MS + 60_000) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await key(secret), decode(signature), new TextEncoder().encode(`${id}.${expiry}`));
    return valid ? id : null;
  } catch { return null; }
}
export function sessionCookie(token: string, secure = true) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${RETENTION_MS / 1000}${secure ? "; Secure" : ""}`;
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}
