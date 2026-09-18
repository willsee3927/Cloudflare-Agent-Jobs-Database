import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobCard } from "../src/app";
import type { Job } from "../src/search";

const base: Job = {
  posting_key: "fixture",
  title: "Data Engineer",
  company: "Example",
  job_url: "https://example.com/job",
  source: "fixture",
  is_remote: true,
  role_family: "Data engineering",
  seniority_band: "mid",
  salary_min: null,
  salary_max: null,
  salary_interval: null,
  salary_currency: null,
  salary_annual_min: null,
  salary_annual_max: null,
  effective_date: "2026-09-18",
  date_basis: "posted",
  application_close_date: null,
  mart_built_at: "2026-09-18T12:00:00Z",
};

describe("job card trust boundary", () => {
  it("escapes hostile row text and suppresses unsafe application URLs", () => {
    const html = renderToStaticMarkup(<JobCard job={{
      ...base,
      title: '<img src=x onerror="alert(1)">',
      company: "</p><script>alert(2)</script>",
      job_url: "javascript:alert(3)",
    }}/>);

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;/p&gt;&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("href=");
    expect(html).toContain("Application link unavailable");
  });
});
