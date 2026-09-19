import { z } from "zod";

// Canonical values from the warehouse's role_family_rules.csv, plus its fallback.
export const ROLE_FAMILIES = ["Data engineering", "Analytics", "DS / ML / AI", "Design / research", "Legal / risk / security", "Software engineering", "Product / program", "Sales", "Marketing", "Support / CS", "Finance", "People / HR", "Healthcare", "Operations", "Unclassified"] as const;
export const SENIORITIES = ["intern", "junior", "mid", "senior", "staff", "principal", "leadership"] as const;
export const filterPatchSchema = z.object({
  role_family: z.array(z.enum(ROLE_FAMILIES)).min(1).max(15).nullable().optional().describe("Changed role families only. Data engineering requests use exactly ['Data engineering']. Null clears this filter."),
  seniority: z.array(z.enum(SENIORITIES)).min(1).max(7).nullable().optional().describe("Changed seniority levels only. 'mid-level' or 'mid range' means exactly ['mid']; 'mid or below' means ['intern','junior','mid']. Null clears this filter."),
  remote: z.boolean().nullable().optional().describe("True means only flagged remote; false means only explicitly not flagged remote; null clears the restriction."),
  posted_within: z.enum(["day", "week", "month", "any"]).nullable().optional().describe("Changed date window only. 'last day' or 'past day' means 'day'; 'last seven days' means 'week'; null clears to any date."),
  min_salary: z.number().finite().min(0).max(10_000_000).nullable().optional().describe("Changed annual USD minimum only, as a number. Null removes the salary minimum."),
  limit: z.number().int().min(1).max(1000).nullable().optional().describe("Requested result count. Omit when the user did not ask for a count; the application defaults to 10 and caps at 20."),
}).strict().describe("A patch containing only filters explicitly set or changed by the current user message. Do not broaden requested filters.");
export type FilterPatch = z.infer<typeof filterPatchSchema>;
export interface Filters {
  role_family: typeof ROLE_FAMILIES[number][] | null;
  seniority: typeof SENIORITIES[number][] | null;
  remote: boolean | null;
  posted_within: "day" | "week" | "month" | "any";
  min_salary: number | null;
  limit: number;
}
export const DEFAULT_FILTERS: Filters = { role_family: null, seniority: null, remote: null, posted_within: "week", min_salary: null, limit: 10 };

// Preserve explicit, unambiguous phrases even when a small model broadens them.
// The model still selects the action and remaining filters; this is a narrow
// server-owned semantic guard, like the result-count cap below.
export function constrainExplicitFilters(message: string, input: FilterPatch): FilterPatch {
  const text = message.toLowerCase().replaceAll("–", "-").replaceAll("—", "-");
  const patch = { ...input };
  let roleMentioned = false;
  if (/\banalytics?\s+engineer/.test(text) || /\bdata\s+engineer(?:ing|s)?\b/.test(text)) {
    patch.role_family = ["Data engineering"]; roleMentioned = true;
  } else if (/\bdata\s+analyst|\banalytics?\s+(?:job|role|position)/.test(text)) {
    patch.role_family = ["Analytics"]; roleMentioned = true;
  } else if (/\bmachine\s+learning\b|\bml\b|\bartificial\s+intelligence\b|\bai\b|\bdata\s+scien(?:ce|tist)/.test(text)) {
    patch.role_family = ["DS / ML / AI"]; roleMentioned = true;
  } else if (/\bsoftware\s+engineer|\b(?:backend|front[- ]?end|full[- ]?stack)\b|\bdeveloper\b/.test(text)) {
    patch.role_family = ["Software engineering"]; roleMentioned = true;
  }

  let seniorityMentioned = false;
  if (/\bmid(?:-|\s)+(?:level|range)\b/.test(text)) { patch.seniority = ["mid"]; seniorityMentioned = true; }
  if (/\bmid(?:-|\s)+(?:level|range)?\s*(?:or|and)\s+below\b|\bmid\s+or\s+below\b/.test(text)) {
    patch.seniority = ["intern", "junior", "mid"];
    seniorityMentioned = true;
  } else if (/\bsenior\s+(?:or|and)\s+(?:above|up)\b/.test(text)) {
    patch.seniority = ["senior", "staff", "principal", "leadership"]; seniorityMentioned = true;
  } else if (/\bsenior\b/.test(text)) {
    patch.seniority = ["senior"]; seniorityMentioned = true;
  } else if (/\bstaff\b/.test(text)) {
    patch.seniority = ["staff"]; seniorityMentioned = true;
  } else if (/\bprincipal\b/.test(text)) {
    patch.seniority = ["principal"]; seniorityMentioned = true;
  } else if (/\bjunior\b|\bentry[- ]level\b/.test(text)) {
    patch.seniority = ["junior"]; seniorityMentioned = true;
  } else if (/\bintern(?:ship)?\b/.test(text)) {
    patch.seniority = ["intern"]; seniorityMentioned = true;
  }

  let dateMentioned = false;
  if (/\b(?:last|past|previous)\s+(?:one\s+)?day\b|\bsince\s+yesterday\b|\bposted\s+today\b/.test(text)) {
    patch.posted_within = "day"; dateMentioned = true;
  } else if (/\b(?:last|past)\s+(?:seven|7)\s+days\b|\b(?:this|past|last)\s+week\b/.test(text)) {
    patch.posted_within = "week"; dateMentioned = true;
  } else if (/\b(?:last|past)\s+(?:thirty|30)\s+days\b|\b(?:this|past|last)\s+month\b/.test(text)) {
    patch.posted_within = "month"; dateMentioned = true;
  } else if (/\bany\s+(?:date|time)\b|\bremove\s+(?:the\s+)?date/.test(text)) {
    patch.posted_within = "any"; dateMentioned = true;
  }

  let remoteMentioned = false;
  if (/\binclude\s+all\s+jobs\b|\bany\s+remote\s+status\b|\b(?:remove|clear)\s+(?:the\s+)?remote/.test(text)) {
    patch.remote = null; remoteMentioned = true;
  } else if (/\bnot\s+remote\b|\bnon[- ]remote\b/.test(text)) {
    patch.remote = false; remoteMentioned = true;
  } else if (/\bremote\b/.test(text)) {
    patch.remote = true; remoteMentioned = true;
  }

  let salaryMentioned = false;
  if (/\b(?:remove|clear|drop)\s+(?:the\s+)?salary\s+(?:minimum|filter)\b|\bno\s+salary\s+minimum\b/.test(text)) {
    patch.min_salary = null; salaryMentioned = true;
  } else {
    const amount = text.match(/(?:\$|usd\s*)?([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{2,3}(?:\.\d+)?\s*k)\b/);
    if (amount && /\b(?:salary|pay|paying|minimum|at\s+least|over|above)\b|\$/.test(text)) {
      const raw = amount[1]!.replaceAll(",", "").replaceAll(" ", "");
      patch.min_salary = raw.endsWith("k") ? Number(raw.slice(0, -1)) * 1000 : Number(raw);
      salaryMentioned = true;
    }
  }

  let limitMentioned = false;
  const count = text.match(/\b(?:top|show|give\s+me|return)\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:jobs|results|postings)\b/);
  if (count) {
    patch.limit = Number(count[1] ?? count[2]); limitMentioned = true;
  }

  const followUp = /\b(?:only|instead|now|remove|clear|drop|include\s+all|same|also|just)\b/.test(text);
  if (followUp) {
    if (!roleMentioned) delete patch.role_family;
    if (!seniorityMentioned) delete patch.seniority;
    if (!dateMentioned) delete patch.posted_within;
    if (!remoteMentioned) delete patch.remote;
    if (!salaryMentioned) delete patch.min_salary;
    if (!limitMentioned) delete patch.limit;
  }
  return patch;
}

export function mergeFilters(base: Filters, input: unknown): { filters: Filters; capped: boolean } {
  const patch = filterPatchSchema.parse(input);
  const merged = { ...base, ...patch };
  const limit = merged.limit ?? 10;
  return { filters: { ...merged, posted_within: merged.posted_within ?? "any", limit: Math.min(limit, 20) }, capped: limit > 20 };
}

export function dateWindow(filters: Filters, now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const days = { day: 1, week: 6, month: 29, any: null }[filters.posted_within];
  if (days === null) return { start: null, end };
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return { start: start.toISOString().slice(0, 10), end };
}

// All SQL identifiers and ordering are owned by the application. Only values vary.
export const SEARCH_SQL = `
WITH dated AS (
  SELECT posting_key, title, company, job_url, source, is_remote,
    role_family, seniority_band, salary_min, salary_max, salary_interval,
    salary_currency, salary_annual_min, salary_annual_max, application_close_date,
    mart_built_at,
    CASE WHEN posted_date IS NOT NULL THEN posted_date
      WHEN has_true_start IS TRUE THEN first_seen ELSE NULL END AS effective_date,
    CASE WHEN posted_date IS NOT NULL THEN 'posted'
      WHEN has_true_start IS TRUE AND first_seen IS NOT NULL THEN 'first observed'
      ELSE 'unknown' END AS date_basis
  FROM analytics.mart_job_search
), matched AS (
  SELECT * FROM dated
  WHERE ($1::text[] IS NULL OR role_family = ANY($1::text[]))
    AND ($2::text[] IS NULL OR seniority_band = ANY($2::text[]))
    AND ($3::boolean IS NULL OR is_remote = $3::boolean)
    AND ($4::date IS NULL OR effective_date >= $4::date)
    AND (effective_date IS NULL OR effective_date <= $5::date)
    AND ($6::numeric IS NULL OR salary_annual_min >= $6::numeric)
    AND (application_close_date IS NULL OR application_close_date >= $5::date)
)
SELECT posting_key, title, company, job_url, source, is_remote, role_family,
  seniority_band, salary_min::float8, salary_max::float8, salary_interval,
  salary_currency, salary_annual_min::float8, salary_annual_max::float8,
  effective_date::text, date_basis, application_close_date::text,
  mart_built_at::text
FROM matched
ORDER BY effective_date DESC NULLS LAST, posting_key ASC
LIMIT $7::integer`;

export function searchParameters(filters: Filters, now = new Date()) {
  // Revalidate even callers that claim to have a Filters value.
  const validated = mergeFilters(DEFAULT_FILTERS, filters).filters;
  const window = dateWindow(validated, now);
  return [validated.role_family, validated.seniority, validated.remote, window.start, window.end, validated.min_salary, validated.limit];
}

export interface Job {
  posting_key: string; title: string; company: string; job_url: string; source: string;
  is_remote: boolean | null; role_family: string; seniority_band: string;
  salary_min: number | null; salary_max: number | null; salary_interval: string | null;
  salary_currency: string | null; salary_annual_min: number | null; salary_annual_max: number | null;
  effective_date: string | null; date_basis: string; application_close_date: string | null;
  mart_built_at: string | null;
}
export interface SearchResult { filters: Filters; jobs: Job[]; window: ReturnType<typeof dateWindow>; capped: boolean; searchedAt: string }

export function safeJobUrl(raw: string): string | null {
  try { const url = new URL(raw); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
