import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const CREATE_LEADS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  type TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  project TEXT,
  use_case TEXT,
  budget TEXT,
  timeline TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT leads_type_check CHECK(type IN ('sync', 'retail_waitlist')),
  CONSTRAINT leads_status_check CHECK(status IN ('new', 'contacted', 'qualified', 'closed', 'archived')),
  CONSTRAINT leads_email_length_check CHECK(length(email) BETWEEN 3 AND 254),
  CONSTRAINT leads_name_length_check CHECK(length(name) BETWEEN 1 AND 120),
  CONSTRAINT leads_company_length_check CHECK(length(company) BETWEEN 1 AND 160),
  CONSTRAINT leads_project_length_check CHECK(project IS NULL OR length(project) BETWEEN 1 AND 4000),
  CONSTRAINT leads_use_case_length_check CHECK(use_case IS NULL OR length(use_case) BETWEEN 1 AND 4000),
  CONSTRAINT leads_budget_length_check CHECK(budget IS NULL OR length(budget) BETWEEN 1 AND 120),
  CONSTRAINT leads_timeline_length_check CHECK(timeline IS NULL OR length(timeline) BETWEEN 1 AND 120),
  CONSTRAINT leads_request_shape_check CHECK(
    (type = 'sync' AND project IS NOT NULL AND use_case IS NULL)
    OR
    (type = 'retail_waitlist' AND use_case IS NOT NULL AND project IS NULL)
  )
)`;

let leadSchemaPromise: Promise<void> | null = null;

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureLeadSchema() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  if (!leadSchemaPromise) {
    leadSchemaPromise = env.DB.batch([
      env.DB.prepare(CREATE_LEADS_TABLE_SQL),
      env.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_leads_created_at_id ON leads(created_at, id)",
      ),
      env.DB.prepare("PRAGMA optimize"),
    ]).then(() => undefined).catch((error) => {
      leadSchemaPromise = null;
      throw error;
    });
  }

  return leadSchemaPromise;
}
