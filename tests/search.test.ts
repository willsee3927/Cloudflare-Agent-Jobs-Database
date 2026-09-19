import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { DEFAULT_FILTERS, SENIORITIES, constrainExplicitFilters, mergeFilters, dateWindow, SEARCH_SQL, searchParameters, safeJobUrl } from "../src/search";

describe("search boundary", () => {
  it("retains filters across follow-ups and explicitly clears remote", () => {
    const initial = mergeFilters(DEFAULT_FILTERS, { role_family: ["Data engineering"], seniority: ["mid"], posted_within: "day" }).filters;
    const remote = mergeFilters(initial, { remote: true }).filters;
    expect(remote.role_family).toEqual(["Data engineering"]);
    expect(remote.posted_within).toBe("day");
    expect(mergeFilters(remote, { remote: null }).filters.remote).toBeNull();
    expect(mergeFilters(remote, { remote: false }).filters.remote).toBe(false);
  });
  it.each([{ location: "US" }, { state: "ID" }, { remote: "true" }, { role_family: ["Data engineering'); DROP TABLE jobs; --"] }, { seniority: [] }, { min_salary: -1 }, { limit: 1.5 }, { query: "select *" }])("rejects invalid input %j", (input) => {
    expect(() => mergeFilters(DEFAULT_FILTERS, input)).toThrow();
  });
  it("caps oversized result requests and preserves explicit zero salary", () => {
    expect(mergeFilters(DEFAULT_FILTERS, { limit: 50, min_salary: 0 })).toMatchObject({ capped: true, filters: { limit: 20, min_salary: 0 } });
  });
  it("prevents broadening explicit level and date phrases", () => {
    expect(constrainExplicitFilters("Mid-level data engineering jobs from the last day", {
      seniority: ["mid", "junior", "intern"], posted_within: "week",
    })).toEqual({ role_family: ["Data engineering"], seniority: ["mid"], posted_within: "day" });
    expect(constrainExplicitFilters("Show me mid or below roles from the last seven days", {
      seniority: ["mid"], posted_within: "day",
    })).toEqual({ seniority: ["intern", "junior", "mid"], posted_within: "week" });
  });
  it("grounds salary searches and preserves unrelated filters in follow-ups", () => {
    expect(constrainExplicitFilters("Senior ML or AI roles paying at least $150,000", {
      role_family: ["DS / ML / AI"], seniority: [...SENIORITIES], min_salary: null,
    })).toEqual({ role_family: ["DS / ML / AI"], seniority: ["senior"], min_salary: 150000 });
    expect(constrainExplicitFilters("Remove the salary minimum and show only remote", {
      role_family: null, seniority: null, remote: true, min_salary: null,
    })).toEqual({ remote: true, min_salary: null });
    expect(constrainExplicitFilters("Include all jobs", {
      role_family: ["DS / ML / AI"], seniority: ["leadership"], remote: true,
    })).toEqual({ remote: null });
  });
  it("computes UTC calendar ranges across month boundaries", () => {
    const now = new Date("2026-03-01T23:30:00-07:00");
    expect(dateWindow({ ...DEFAULT_FILTERS, posted_within: "day" }, now)).toEqual({ start: "2026-03-01", end: "2026-03-02" });
    expect(dateWindow({ ...DEFAULT_FILTERS, posted_within: "week" }, now).start).toBe("2026-02-24");
  });
  it("accepts only safe HTTPS application links", () => {
    expect(safeJobUrl("javascript:alert(1)")).toBeNull();
    expect(safeJobUrl("https://name:password@example.com")).toBeNull();
    expect(safeJobUrl("https://example.com/job")).toBe("https://example.com/job");
  });
});

describe("actual PostgreSQL query against controlled fixtures", () => {
  let db: PGlite;
  const now = new Date("2026-09-18T12:00:00Z");
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA analytics; CREATE TABLE analytics.mart_job_search (
      posting_key text, title text, company text, job_url text, source text,
      is_remote boolean, role_family text, seniority_band text,
      salary_min numeric, salary_max numeric, salary_interval text, salary_currency text,
      salary_annual_min numeric, salary_annual_max numeric, application_close_date date,
      mart_built_at timestamptz, posted_date date, first_seen date, has_true_start boolean
    );`);
    for (const row of [
      ["a",true,120000,"2026-09-18",null,false,null],
      ["b",false,150000,"2026-09-18",null,false,null],
      ["c",null,null,"2026-09-17",null,false,null],
      ["d",true,130000,null,"2026-09-17",true,null],
      ["old-board",true,130000,null,"2026-09-18",false,null],
      ["expired",true,130000,"2026-09-18",null,false,"2026-09-17"],
      ["future",true,130000,"2026-09-19",null,false,null],
      ["older",true,130000,"2026-09-16",null,false,null],
    ]) {
      await db.query(`INSERT INTO analytics.mart_job_search
        (posting_key,is_remote,salary_annual_min,posted_date,first_seen,has_true_start,application_close_date,title,company,job_url,source,role_family,seniority_band,mart_built_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'Data Engineer','Example','https://example.com/job','ashby','Data engineering','mid','2026-09-18T08:00:00Z')`, row);
    }
  });
  afterAll(async () => { await db.close(); });
  async function keys(patch: unknown) {
    const filters = mergeFilters(DEFAULT_FILTERS, patch).filters;
    const { rows } = await db.query<{ posting_key: string }>(SEARCH_SQL, searchParameters(filters, now));
    return rows.map(r => r.posting_key);
  }
  it("filters recent jobs, includes truthful observations, excludes old-board and expired/future rows", async () => {
    expect(await keys({ posted_within: "day" })).toEqual(["a","b","c","d"]);
  });
  it("distinguishes false from null and excludes unknown flags from strict matches", async () => {
    expect(await keys({ posted_within: "day", remote: false })).toEqual(["b"]);
    expect(await keys({ posted_within: "day", remote: true })).toEqual(["a","d"]);
  });
  it("enforces salary floor and orders before limiting", async () => {
    expect(await keys({ posted_within: "day", min_salary: 130000, limit: 1 })).toEqual(["b"]);
  });
  it("includes unknown recency only for any and sorts it last", async () => {
    expect(await keys({ posted_within: "any" })).toEqual(["a","b","c","d","older","old-board"]);
  });
  it("applies role and seniority as mandatory filters", async () => {
    expect(await keys({ role_family: ["Analytics"] })).toEqual([]);
    expect(await keys({ seniority: ["senior"] })).toEqual([]);
  });
});
