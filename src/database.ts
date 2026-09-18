import { neon } from "@neondatabase/serverless";
import { SEARCH_SQL, searchParameters, type Filters, type Job } from "./search";

export async function searchJobs(databaseUrl: string, filters: Filters, now: Date): Promise<Job[]> {
  const sql = neon(databaseUrl);
  const rows = await sql.query(SEARCH_SQL, searchParameters(filters, now), {
    fetchOptions: { signal: AbortSignal.timeout(10_000) },
  });
  return rows as Job[];
}
