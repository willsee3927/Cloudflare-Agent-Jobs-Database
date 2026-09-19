import { Agent, getAgentByName } from "agents";
import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { searchJobs } from "./database";
import { interpret, type Action } from "./model";
import { DEFAULT_FILTERS, constrainExplicitFilters, mergeFilters, dateWindow } from "./search";
import { issueSession, verifySession, sessionCookie, sameOrigin, RETENTION_MS } from "./session";
import type { Conversation, ChatMessage } from "./types";

export interface AppEnv extends Env {
  JobAgent: DurableObjectNamespace<JobAgent>;
  UsageGuard: DurableObjectNamespace<UsageGuard>;
  AI: Ai; ASSETS: Fetcher;
  DATABASE_URL: string; SESSION_SECRET: string;
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function emptyConversation(): Conversation {
  return { messages: [], filters: { ...DEFAULT_FILTERS }, preferences: {}, lastActive: Date.now() };
}
const messageSchema = z.object({ text: z.string().trim().min(1).max(2000), requestId: z.string().uuid() }).strict();

// A shared counter enforces the daily model-call cap across all visitors.
export class UsageGuard extends DurableObject<AppEnv> {
  async reserve(visitor: string, ipHash: string, modelCall: boolean) {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const day = new Date(now).toISOString().slice(0, 10);
    const allowed = await this.ctx.storage.transaction(async tx => {
      const daily = await tx.get<{ day: string; count: number }>("daily") ?? { day, count: 0 };
      if (daily.day !== day) { daily.day = day; daily.count = 0; }
      const counters = await tx.get<{ minute: number; visitors: Record<string, number>; ips: Record<string, number> }>("minute") ?? { minute, visitors: {}, ips: {} };
      if (counters.minute !== minute) { counters.minute = minute; counters.visitors = {}; counters.ips = {}; }
      const v = counters.visitors[visitor] ?? 0;
      const ip = counters.ips[ipHash] ?? 0;
      const configured = Number(this.env.DAILY_AI_LIMIT);
      const cap = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 10000) : 300;
      if (modelCall && daily.count >= cap) return false;
      if (!modelCall && (v >= 10 || ip >= 30 || Object.keys(counters.visitors).length >= 2000)) return false;
      if (modelCall) daily.count++;
      else { counters.visitors[visitor] = v + 1; counters.ips[ipHash] = ip + 1; }
      await tx.put("daily", daily); await tx.put("minute", counters);
      return true;
    });
    await this.ctx.storage.setAlarm(now + 2 * 24 * 60 * 60 * 1000);
    return allowed;
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

// HTTP provides one server-owned entry point without exposing the generic
// Agents WebSocket/state mutation protocol. The Agents durable runtime persists.
export class JobAgent extends Agent<AppEnv> {
  private busy = false;

  async expireConversation() {
    const state = await this.ctx.storage.get<Conversation>("conversation");
    if (!state) return;
    const expiresAt = state.lastActive + RETENTION_MS;
    if (Date.now() >= expiresAt) {
      await this.ctx.storage.delete("conversation");
      return;
    }
    // An older idempotent callback may run after newer activity. Move expiry
    // forward so an active conversation still receives a full retention window.
    await this.schedule(new Date(expiresAt), "expireConversation", undefined, { idempotent: true });
  }

  private async readConversation() {
    await this.expireConversation();
    return await this.ctx.storage.get<Conversation>("conversation") ?? emptyConversation();
  }

  private async saveConversation(state: Conversation) {
    state.lastActive = Date.now();
    state.messages = state.messages.slice(-200);
    for (const message of state.messages.slice(0, -20)) delete message.result;
    await this.ctx.storage.put("conversation", state);
    await this.schedule(new Date(state.lastActive + RETENTION_MS), "expireConversation", undefined, { idempotent: true });
  }

  async onRequest(request: Request) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/session") return json(await this.readConversation());
    if (request.method !== "POST") return json({ error: "Not found" }, 404);
    if (this.busy) return json({ error: "A request is already running. Please wait for it to finish." }, 409);
    this.busy = true;
    try {
      const state = await this.readConversation();
      if (path === "/api/clear") {
        state.messages = []; state.filters = mergeFilters(DEFAULT_FILTERS, state.preferences).filters;
        await this.saveConversation(state); return json(state);
      }
      if (path === "/api/forget") {
        await this.ctx.storage.delete("conversation");
        return json(emptyConversation());
      }
      if (path === "/api/preferences/clear") {
        state.preferences = {}; state.filters = { ...DEFAULT_FILTERS };
        await this.saveConversation(state); return json(state);
      }
      if (path !== "/api/chat") return json({ error: "Not found" }, 404);
      const input = messageSchema.safeParse(await request.json().catch(() => null));
      if (!input.success) return json({ error: "Send a message of 1–2,000 characters." }, 400);
      if (state.messages.some(m => m.id === input.data.requestId)) return json(state);
      if (!this.env.DATABASE_URL) return json({ error: "The database connection has not been configured yet." }, 503);
      const userMessage: ChatMessage = { id: input.data.requestId, role: "user", text: input.data.text, at: new Date().toISOString() };
      const history = [...state.messages, userMessage].slice(-12).map(m => ({ role: m.role, text: m.text.slice(0, 2000) }));
      const guard = this.env.UsageGuard.get(this.env.UsageGuard.idFromName("global"));
      let action: Action | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!await guard.reserve(this.name, "", true)) return json({ error: "The demo's daily AI allowance has been reached. Please try again tomorrow (UTC)." }, 429);
        try { action = await interpret(this.env.AI, this.env.AI_MODEL, history, state.filters, state.preferences, attempt > 0); break; }
        catch {
          console.warn(JSON.stringify({ event: "model_action_failed", attempt: attempt + 1 }));
        }
      }
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: "assistant", at: new Date().toISOString(), text: "" };
      if (!action) {
        assistant.text = "I couldn't interpret that request reliably. Please try a simpler request with a role, level, remote preference, date window, or salary minimum.";
        assistant.error = true;
      } else if (action.type === "search") {
        const guardedPatch = constrainExplicitFilters(input.data.text, action.patch);
        const { filters, capped } = mergeFilters(state.filters, guardedPatch);
        const started = Date.now();
        try {
          const now = new Date();
          const jobs = await searchJobs(this.env.DATABASE_URL, filters, now);
          assistant.result = { filters, capped, jobs, window: dateWindow(filters, now), searchedAt: now.toISOString() };
          assistant.text = jobs.length ? `Here ${jobs.length === 1 ? "is 1 matching posting" : `are ${jobs.length} matching postings`}, newest first.` : "No postings matched these filters. Try a wider date window or remove a restriction.";
          state.filters = filters;
          console.log(JSON.stringify({ event: "search", elapsedMs: Date.now() - started, count: jobs.length }));
        } catch {
          assistant.text = "The job database couldn't complete this search. Please try again. This is a service error, not a finding that no jobs match.";
          assistant.error = true;
          console.warn(JSON.stringify({ event: "search_failed", elapsedMs: Date.now() - started }));
        }
      } else if (action.type === "remember") {
        const guardedPatch = constrainExplicitFilters(input.data.text, action.patch);
        const validated = mergeFilters(mergeFilters(DEFAULT_FILTERS, state.preferences).filters, guardedPatch);
        state.preferences = { ...state.preferences, ...guardedPatch };
        if (state.preferences.limit != null) state.preferences.limit = validated.filters.limit;
        state.filters = mergeFilters(state.filters, guardedPatch).filters;
        assistant.text = "Saved those search preferences for this browser. You can review or remove them in Memory.";
      } else if (action.type === "forget") {
        state.preferences = {}; state.filters = { ...DEFAULT_FILTERS };
        assistant.text = "Your saved preferences are cleared. Your conversation remains available; use Forget everything to delete it too.";
      } else assistant.text = action.text;
      state.messages.push(userMessage, assistant);
      await this.saveConversation(state);
      return json(state);
    } finally { this.busy = false; }
  }
}

export default {
  async fetch(request: Request, env: AppEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) return json({ error: "Not found" }, 404);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return json({ error: "The application is not configured yet." }, 503);
    if (request.headers.get("Upgrade")) return json({ error: "Unsupported connection" }, 400);
    if (request.method !== "GET" && !sameOrigin(request)) return json({ error: "Request origin rejected" }, 403);
    if (request.method === "POST") {
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
      const body = await request.text();
      if (new TextEncoder().encode(body).length > 12000) return json({ error: "Message too large" }, 413);
      request = new Request(request, { body });
    }
    let id = await verifySession(request.headers.get("Cookie"), env.SESSION_SECRET);
    let cookie: string | undefined;
    if (!id) {
      if (url.pathname !== "/api/session" || request.method !== "GET") return json({ error: "Please reload to start a session." }, 401);
      const session = await issueSession(env.SESSION_SECRET);
      id = session.id;
      const local = String(env.DEV_MODE) === "true" && ["localhost", "127.0.0.1"].includes(url.hostname);
      cookie = sessionCookie(session.token, !local);
    } else {
      const session = await issueSession(env.SESSION_SECRET, Date.now(), id);
      const local = String(env.DEV_MODE) === "true" && ["localhost", "127.0.0.1"].includes(url.hostname);
      cookie = sessionCookie(session.token, !local);
    }
    if (!["/api/session", "/api/chat", "/api/clear", "/api/forget", "/api/preferences/clear"].includes(url.pathname)) return json({ error: "Not found" }, 404);
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.SESSION_SECRET}:${ip}`));
    const ipHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    const guard = env.UsageGuard.get(env.UsageGuard.idFromName("global"));
    if (!await guard.reserve(id, ipHash, false)) return json({ error: "Too many requests. Please wait a minute." }, 429);
    const agent = await getAgentByName(env.JobAgent, id);
    let response: Response;
    try { response = await agent.fetch(request); }
    catch { return json({ error: "The service couldn't complete this request. Please try again." }, 503); }
    const headers = new Headers(response.headers);
    if (cookie) headers.set("Set-Cookie", cookie);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<AppEnv>;
