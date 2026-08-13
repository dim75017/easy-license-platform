import { env } from "cloudflare:workers";

const CREATE_USER_PROFILES_SQL = `
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  external_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  company TEXT,
  plan_preference TEXT NOT NULL,
  primary_platform TEXT NOT NULL,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  policies_acknowledged_at TEXT NOT NULL,
  onboarding_completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_profiles_external_user_id_length_check CHECK(length(external_user_id) BETWEEN 1 AND 256),
  CONSTRAINT user_profiles_email_length_check CHECK(length(email) BETWEEN 3 AND 254),
  CONSTRAINT user_profiles_display_name_length_check CHECK(length(display_name) BETWEEN 1 AND 120),
  CONSTRAINT user_profiles_company_length_check CHECK(company IS NULL OR length(company) BETWEEN 1 AND 160),
  CONSTRAINT user_profiles_plan_check CHECK(plan_preference IN ('creator', 'pro')),
  CONSTRAINT user_profiles_platform_check CHECK(primary_platform IN ('youtube', 'twitch', 'podcast', 'instagram', 'tiktok', 'other'))
)`;

let accountSchemaPromise: Promise<void> | null = null;

function requireAccountDatabase(): D1Database {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

export async function accountDatabase(): Promise<D1Database> {
  const database = requireAccountDatabase();
  if (!accountSchemaPromise) {
    accountSchemaPromise = database
      .batch([
        database.prepare(CREATE_USER_PROFILES_SQL),
        database.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_external_user_id ON user_profiles(external_user_id)",
        ),
        database.prepare(
          "CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email)",
        ),
        database.prepare("PRAGMA optimize"),
      ])
      .then(() => undefined)
      .catch((error) => {
        accountSchemaPromise = null;
        throw error;
      });
  }
  await accountSchemaPromise;
  return database;
}
