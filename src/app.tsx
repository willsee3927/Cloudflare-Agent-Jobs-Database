import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Conversation, ChatMessage } from "./types";
import type { Filters, Job } from "./search";
import "./styles.css";

const examples = [
  "Mid-level data engineering jobs from the last day",
  "Remote analytics jobs posted this week",
  "Senior ML or AI roles paying at least $150,000",
];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = await response.json() as Conversation & { error?: string };
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function money(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function salary(job: Job) {
  if (job.salary_annual_min != null) {
    return job.salary_annual_max != null ? `${money(job.salary_annual_min)}–${money(job.salary_annual_max)} / year` : `From ${money(job.salary_annual_min)} / year`;
  }
  if (job.salary_min != null && job.salary_currency) {
    const high = job.salary_max != null ? `–${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(job.salary_max)}` : "+";
    return `${job.salary_currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(job.salary_min)}${high}${job.salary_interval ? ` · ${job.salary_interval}` : ""}`;
  }
  return "Salary not listed";
}

function FilterSummary({ filters, start }: { filters: Filters; start: string | null }) {
  const items = [
    filters.role_family?.join(" or "), filters.seniority?.join(" or "),
    filters.remote === true ? "Remote" : filters.remote === false ? "Not flagged remote" : null,
    start ? `Since ${start}` : "Any date", filters.min_salary != null ? `At least ${money(filters.min_salary)} / year` : null,
  ].filter(Boolean);
  return <div className="filters">{items.map(String).map(item => <span key={item}>{item}</span>)}</div>;
}

function JobCard({ job }: { job: Job }) {
  let safeUrl: string | undefined;
  try { const parsed = new URL(job.job_url); if (parsed.protocol === "https:" && !parsed.username && !parsed.password) safeUrl = parsed.href; } catch { /* hide unsafe link */ }
  return <article className="job-card">
    <div className="job-top"><div><h3>{job.title}</h3><p className="company">{job.company}</p></div><span className={job.is_remote ? "remote yes" : "remote"}>{job.is_remote ? "Remote" : "Not flagged remote"}</span></div>
    <p className="salary">{salary(job)}</p>
    <div className="meta"><span>{job.seniority_band === "mid" ? "Mid*" : job.seniority_band}</span><span>{job.role_family}</span><span>{job.effective_date ? `${job.date_basis} ${job.effective_date}` : "Date unavailable"}</span><span>{job.source}</span></div>
    {safeUrl ? <a className="apply" href={safeUrl} target="_blank" rel="noopener noreferrer">View posting <span aria-hidden>↗</span></a> : <span className="bad-link">Application link unavailable</span>}
  </article>;
}

function Message({ message }: { message: ChatMessage }) {
  return <div className={`message ${message.role}${message.error ? " error" : ""}`}>
    <div className="bubble"><span className="role">{message.role === "user" ? "You" : "Job Scout"}</span><p>{message.text}</p></div>
    {message.result && <section className="results">
      <FilterSummary filters={message.result.filters} start={message.result.window.start}/>
      {message.result.capped && <p className="notice">Results were capped at 20.</p>}
      <div className="jobs">{message.result.jobs.map(job => <JobCard job={job} key={job.posting_key}/>)}</div>
      <p className="fine-print">Newest eligible matches first. “Mid” includes titles with no stated level. “First observed” is when the daily scraper first saw a posting, not necessarily its publication date. Remote status does not establish where you may live.</p>
    </section>}
  </div>;
}

export default function App() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { api("/api/session").then(setConversation).catch(e => setError(e.message)); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages.length, busy]);
  const preferences = useMemo(() => Object.entries(conversation?.preferences ?? {}).filter(([, value]) => value != null), [conversation]);

  async function send(value: string) {
    const clean = value.trim(); if (!clean || busy) return;
    setText(""); setBusy(true); setError(null);
    try { setConversation(await api("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: clean, requestId: crypto.randomUUID() }) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  async function mutate(path: string) {
    setBusy(true); setError(null);
    try { setConversation(await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })); }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(text); }

  return <main>
    <header><a className="brand" href="/" aria-label="Job Scout home"><span className="mark">JS</span><span>Job Scout</span></a><button className="memory-button" onClick={() => setMemoryOpen(v => !v)}>Memory {preferences.length ? <b>{preferences.length}</b> : null}</button></header>
    {memoryOpen && <aside className="memory"><div><h2>Memory</h2><p>Saved preferences apply to future searches in this browser.</p></div>{preferences.length ? <dl>{preferences.map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}</dl> : <p className="empty-memory">No saved preferences. Say “remember that I prefer remote jobs” to add one.</p>}<div className="memory-actions"><button disabled={busy || !preferences.length} onClick={() => void mutate("/api/preferences/clear")}>Clear preferences</button><button className="danger" disabled={busy} onClick={() => void mutate("/api/forget")}>Forget everything</button></div></aside>}
    <section className="chat" aria-live="polite">
      {!conversation && !error && <div className="loading">Opening your private conversation…</div>}
      {(conversation?.messages.length === 0 || (!conversation && error)) && <div className="welcome"><p className="eyebrow">178,000+ open postings · refreshed daily</p><h1>Find the right job.<br/><em>Ask naturally.</em></h1><p className="lead">I search a live warehouse using safe, fixed filters for role, seniority, remote status, date, and salary.</p><div className="examples">{examples.map(example => <button disabled={!conversation} key={example} onClick={() => void send(example)}>{example}<span>→</span></button>)}</div><p className="scope">Location and skills filters aren’t supported in this quick version.</p></div>}
      {conversation?.messages.map(message => <Message message={message} key={message.id}/>)}
      {busy && <div className="message assistant"><div className="bubble thinking"><span/><span/><span/><small>Searching thoughtfully</small></div></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div ref={bottom}/>
    </section>
    <footer><form onSubmit={submit}><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} maxLength={2000} rows={1} placeholder="Describe the jobs you’re looking for…" disabled={busy || !conversation}/><button aria-label="Send message" disabled={busy || !text.trim()}>↑</button></form><div className="footer-row"><span>Powered by Cloudflare Workers AI</span>{conversation?.messages.length ? <button disabled={busy} onClick={() => void mutate("/api/clear")}>Clear conversation</button> : null}</div></footer>
  </main>;
}
