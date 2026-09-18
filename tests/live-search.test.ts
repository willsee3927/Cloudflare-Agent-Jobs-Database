import { describe, expect, it } from "vitest";
import { searchJobs } from "../src/database";
import { DEFAULT_FILTERS } from "../src/search";

const live = process.env.LIVE_DATABASE_URL ? describe : describe.skip;

live("read-only production search smoke test", () => {
  it("executes application-owned SQL and returns bounded, valid rows", async () => {
    const rows = await searchJobs(process.env.LIVE_DATABASE_URL!, {
      ...DEFAULT_FILTERS,
      role_family: ["Data engineering"],
      posted_within: "week",
      limit: 3,
    }, new Date());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    for (const row of rows) {
      expect(row.role_family).toBe("Data engineering");
      expect(row.job_url).toMatch(/^https:\/\//);
      expect(row.mart_built_at).toBeTruthy();
    }
  }, 15_000);
});
