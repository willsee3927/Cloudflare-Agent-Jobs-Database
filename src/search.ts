import { z } from "zod";

// Canonical values from the warehouse's role_family_rules.csv, plus its fallback.
export const ROLE_FAMILIES = ["Data engineering", "Analytics", "DS / ML / AI", "Design / research", "Legal / risk / security", "Software engineering", "Product / program", "Sales", "Marketing", "Support / CS", "Finance", "People / HR", "Healthcare", "Operations", "Unclassified"] as const;
export const SENIORITIES = ["intern", "junior", "mid", "senior", "staff", "principal", "leadership"] as const;
export const filterPatchSchema = z.object({
  role_family: z.array(z.enum(ROLE_FAMILIES)).min(1).max(15).nullable().optional(),
  seniority: z.array(z.enum(SENIORITIES)).min(1).max(7).nullable().optional(),
  remote: z.boolean().nullable().optional(),
  posted_within: z.enum(["day", "week", "month", "any"]).nullable().optional(),
  min_salary: z.number().finite().min(0).max(10_000_000).nullable().optional(),
  limit: z.number().int().min(1).max(1000).nullable().optional(),
}).strict();
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
